//! Hardened persistent worker for the Managed AI Index.
//!
//! Global search entries remain metadata-only. A job is claimed only for the
//! currently configured provider, is revalidated immediately before and after
//! the network/model call, and can complete only while its scope, source,
//! fingerprint, and user-correction policy are still authoritative.

use super::models::{
    normalize_path, unix_now, AI_JOB_BLOCKED_BY_POLICY, AI_JOB_FAILED, AI_JOB_PENDING, AI_JOB_STALE,
};
use crate::ai::{
    schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderOptions},
    settings::{get_ai_settings_for_db, normalize_ai_settings, provider_for_settings, AISettings},
};
use crate::db::{Database, DbError};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    mpsc::{self, Receiver, RecvTimeoutError, SyncSender},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

const MAX_ATTEMPTS: i64 = 3;
const MAX_STORED_RESPONSE_BYTES: usize = 64 * 1024;
const ACTIVITY_BLOCKED_RECHECK: Duration = Duration::from_secs(5);

#[derive(Debug, Clone)]
pub(crate) struct ManagedAiJob {
    pub id: String,
    pub global_entry_id: String,
    #[allow(
        dead_code,
        reason = "retained in the durable job record for audit and forward-compatible scope checks"
    )]
    pub managed_scope_id: String,
    pub input_fingerprint: String,
    pub provider: String,
    pub name: String,
    pub path: String,
    pub extension: String,
    pub size: i64,
    pub modified_at_fs: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ValidationDisposition {
    Valid,
    Blocked(&'static str),
    Stale(&'static str),
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedClassificationResult {
    ref_id: String,
    file_type: String,
    purpose: String,
    lifecycle: String,
    risk_level: String,
    suggested_action: String,
    confidence: f64,
    reason: String,
}

impl ManagedClassificationResult {
    fn parse(job: &ManagedAiJob, response: &str) -> Result<String, String> {
        let parsed: Self = serde_json::from_str(response)
            .map_err(|error| format!("managed_ai_invalid_json: {error}"))?;
        let expected_ref = format!("managed:{}", job.global_entry_id);
        if parsed.ref_id != expected_ref {
            return Err("managed_ai_ref_id_mismatch".to_string());
        }
        for (field, value) in [
            ("fileType", parsed.file_type.as_str()),
            ("purpose", parsed.purpose.as_str()),
            ("lifecycle", parsed.lifecycle.as_str()),
            ("riskLevel", parsed.risk_level.as_str()),
            ("suggestedAction", parsed.suggested_action.as_str()),
            ("reason", parsed.reason.as_str()),
        ] {
            if value.trim().is_empty() {
                return Err(format!("managed_ai_missing_{field}"));
            }
        }
        if !parsed.confidence.is_finite() || !(0.0..=1.0).contains(&parsed.confidence) {
            return Err("managed_ai_confidence_out_of_range".to_string());
        }
        serde_json::to_string(&parsed)
            .map_err(|error| format!("managed_ai_result_encode_failed: {error}"))
    }
}

impl Database {
    fn has_eligible_managed_ai_work(&self, desired_provider: &str) -> Result<bool, DbError> {
        let conn = self.conn()?;
        let eligible = conn.query_row(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM ai_jobs job
                JOIN managed_scopes scope ON scope.id = job.managed_scope_id
                JOIN managed_entries managed
                  ON managed.global_entry_id = job.global_entry_id
                 AND managed.managed_scope_id = job.managed_scope_id
                JOIN global_entries entry ON entry.id = job.global_entry_id
                JOIN global_volumes volume ON volume.id = entry.volume_id
                LEFT JOIN ai_analysis_state state ON state.global_entry_id = job.global_entry_id
                WHERE job.status IN ('pending', 'blocked_by_policy')
                  AND scope.enabled = 1
                  AND managed.enabled = 1
                  AND volume.enabled = 1
                  AND entry.is_stale = 0
                  AND entry.is_directory = 0
                  AND COALESCE(state.user_corrected, 0) = 0
                  AND ((?1 = 'local' AND scope.allow_local_ai = 1)
                    OR (?1 = 'cloud' AND scope.allow_cloud_ai = 1))
            )
            "#,
            params![desired_provider],
            |row| row.get::<_, bool>(0),
        )?;
        Ok(eligible)
    }

    pub(crate) fn reset_running_managed_ai_jobs(&self) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let now = unix_now();
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM managed_scopes scope
                        JOIN managed_entries managed
                          ON managed.managed_scope_id = scope.id
                         AND managed.global_entry_id = ai_jobs.global_entry_id
                        JOIN global_entries entry ON entry.id = ai_jobs.global_entry_id
                        JOIN global_volumes volume ON volume.id = entry.volume_id
                        WHERE scope.id = ai_jobs.managed_scope_id
                          AND scope.enabled = 1
                          AND managed.enabled = 1
                          AND volume.enabled = 1
                          AND entry.is_stale = 0
                          AND entry.is_directory = 0
                    ) THEN 'pending'
                    ELSE 'blocked_by_policy'
                END,
                started_at = NULL,
                completed_at = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM managed_scopes scope
                        JOIN managed_entries managed
                          ON managed.managed_scope_id = scope.id
                         AND managed.global_entry_id = ai_jobs.global_entry_id
                        JOIN global_entries entry ON entry.id = ai_jobs.global_entry_id
                        JOIN global_volumes volume ON volume.id = entry.volume_id
                        WHERE scope.id = ai_jobs.managed_scope_id
                          AND scope.enabled = 1
                          AND managed.enabled = 1
                          AND volume.enabled = 1
                          AND entry.is_stale = 0
                          AND entry.is_directory = 0
                    ) THEN NULL ELSE ?1 END,
                last_error = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM managed_scopes scope
                        JOIN managed_entries managed
                          ON managed.managed_scope_id = scope.id
                         AND managed.global_entry_id = ai_jobs.global_entry_id
                        JOIN global_entries entry ON entry.id = ai_jobs.global_entry_id
                        JOIN global_volumes volume ON volume.id = entry.volume_id
                        WHERE scope.id = ai_jobs.managed_scope_id
                          AND scope.enabled = 1
                          AND managed.enabled = 1
                          AND volume.enabled = 1
                          AND entry.is_stale = 0
                          AND entry.is_directory = 0
                    ) THEN 'worker_restarted' ELSE 'managed_scope_policy_disabled' END
            WHERE status = 'running'
            "#,
            params![now],
        )?;
        sync_job_item_and_analysis_status(&transaction, now)?;
        transaction.commit()?;
        Ok(())
    }

    pub(crate) fn claim_next_managed_ai_job(
        &self,
        desired_provider: &str,
    ) -> Result<Option<ManagedAiJob>, DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let now = unix_now();

        // Reconcile pending/blocked jobs with the currently configured provider.
        // Canceled, stale, completed, and failed jobs are intentionally terminal.
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET provider = ?1,
                status = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM managed_scopes scope
                        WHERE scope.id = ai_jobs.managed_scope_id
                          AND scope.enabled = 1
                          AND ((?1 = 'local' AND scope.allow_local_ai = 1)
                            OR (?1 = 'cloud' AND scope.allow_cloud_ai = 1))
                    ) THEN 'pending'
                    ELSE 'blocked_by_policy'
                END,
                completed_at = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM managed_scopes scope
                        WHERE scope.id = ai_jobs.managed_scope_id
                          AND scope.enabled = 1
                          AND ((?1 = 'local' AND scope.allow_local_ai = 1)
                            OR (?1 = 'cloud' AND scope.allow_cloud_ai = 1))
                    ) THEN NULL ELSE ?2 END,
                last_error = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM managed_scopes scope
                        WHERE scope.id = ai_jobs.managed_scope_id
                          AND scope.enabled = 1
                          AND ((?1 = 'local' AND scope.allow_local_ai = 1)
                            OR (?1 = 'cloud' AND scope.allow_cloud_ai = 1))
                    ) THEN NULL ELSE 'managed_scope_policy_disabled' END
            WHERE status IN ('pending', 'blocked_by_policy')
              AND NOT EXISTS (
                  SELECT 1 FROM ai_analysis_state state
                  WHERE state.global_entry_id = ai_jobs.global_entry_id
                    AND state.user_corrected = 1
              )
            "#,
            params![desired_provider, now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'blocked_by_policy', completed_at = ?1,
                last_error = 'user_corrected'
            WHERE status IN ('pending', 'blocked_by_policy')
              AND EXISTS (
                  SELECT 1 FROM ai_analysis_state state
                  WHERE state.global_entry_id = ai_jobs.global_entry_id
                    AND state.user_corrected = 1
              )
            "#,
            params![now],
        )?;
        sync_job_item_and_analysis_status(&transaction, now)?;

        let job = {
            let mut statement = transaction.prepare(
                r#"
                SELECT job.id, job.global_entry_id, job.managed_scope_id,
                       job.input_fingerprint, job.provider,
                       entry.name, entry.path, entry.extension, entry.size,
                       entry.modified_at_fs
                FROM ai_jobs job
                JOIN managed_scopes scope ON scope.id = job.managed_scope_id
                JOIN managed_entries managed
                  ON managed.global_entry_id = job.global_entry_id
                 AND managed.managed_scope_id = job.managed_scope_id
                JOIN global_entries entry ON entry.id = job.global_entry_id
                JOIN global_volumes volume ON volume.id = entry.volume_id
                LEFT JOIN ai_analysis_state state ON state.global_entry_id = job.global_entry_id
                WHERE job.status = 'pending'
                  AND job.provider = ?1
                  AND scope.enabled = 1
                  AND managed.enabled = 1
                  AND volume.enabled = 1
                  AND entry.is_stale = 0
                  AND entry.is_directory = 0
                  AND COALESCE(state.user_corrected, 0) = 0
                  AND ((?1 = 'local' AND scope.allow_local_ai = 1)
                    OR (?1 = 'cloud' AND scope.allow_cloud_ai = 1))
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ai_jobs other
                      JOIN managed_scopes other_scope ON other_scope.id = other.managed_scope_id
                      JOIN managed_entries other_managed
                        ON other_managed.global_entry_id = other.global_entry_id
                       AND other_managed.managed_scope_id = other.managed_scope_id
                      WHERE other.global_entry_id = job.global_entry_id
                        AND other.input_fingerprint = job.input_fingerprint
                        AND other.id <> job.id
                        AND other.status IN ('pending', 'running')
                        AND other_scope.enabled = 1
                        AND other_managed.enabled = 1
                        AND ((?1 = 'local' AND other_scope.allow_local_ai = 1)
                          OR (?1 = 'cloud' AND other_scope.allow_cloud_ai = 1))
                        AND (
                            length(other_scope.path) > length(scope.path)
                            OR (length(other_scope.path) = length(scope.path)
                                AND other_scope.id < scope.id)
                        )
                  )
                ORDER BY job.created_at ASC, job.id ASC
                LIMIT 1
                "#,
            )?;
            statement
                .query_row(params![desired_provider], |row| {
                    Ok(ManagedAiJob {
                        id: row.get(0)?,
                        global_entry_id: row.get(1)?,
                        managed_scope_id: row.get(2)?,
                        input_fingerprint: row.get(3)?,
                        provider: row.get(4)?,
                        name: row.get(5)?,
                        path: row.get(6)?,
                        extension: row.get(7)?,
                        size: row.get(8)?,
                        modified_at_fs: row.get(9)?,
                    })
                })
                .optional()?
        };
        let Some(job) = job else {
            transaction.commit()?;
            return Ok(None);
        };

        let updated = transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'running', attempt_count = attempt_count + 1,
                started_at = ?2, completed_at = NULL, last_error = NULL
            WHERE id = ?1 AND status = 'pending'
            "#,
            params![job.id, now],
        )?;
        if updated == 0 {
            transaction.commit()?;
            return Ok(None);
        }
        transaction.execute(
            "UPDATE ai_job_items SET status = 'running', updated_at = ?2, last_error = NULL WHERE job_id = ?1",
            params![job.id, now],
        )?;
        transaction.execute(
            "UPDATE ai_analysis_state SET status = 'running', provider = ?3, last_error = NULL, updated_at = ?2 WHERE global_entry_id = ?1",
            params![job.global_entry_id, now, desired_provider],
        )?;
        transaction.commit()?;
        Ok(Some(job))
    }

    fn validate_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        expected_provider: &str,
    ) -> Result<ValidationDisposition, DbError> {
        let conn = self.conn()?;
        let row = conn
            .query_row(
                r#"
                SELECT job.status, job.input_fingerprint, job.provider,
                       scope.enabled, scope.allow_local_ai, scope.allow_cloud_ai,
                       managed.enabled, volume.enabled,
                       entry.volume_id, entry.platform_file_id, entry.name,
                       entry.size, entry.modified_at_fs, entry.is_directory,
                       entry.is_stale, COALESCE(state.user_corrected, 0)
                FROM ai_jobs job
                JOIN managed_scopes scope ON scope.id = job.managed_scope_id
                JOIN managed_entries managed
                  ON managed.global_entry_id = job.global_entry_id
                 AND managed.managed_scope_id = job.managed_scope_id
                JOIN global_entries entry ON entry.id = job.global_entry_id
                JOIN global_volumes volume ON volume.id = entry.volume_id
                LEFT JOIN ai_analysis_state state ON state.global_entry_id = job.global_entry_id
                WHERE job.id = ?1
                "#,
                params![job.id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)? != 0,
                        row.get::<_, i64>(4)? != 0,
                        row.get::<_, i64>(5)? != 0,
                        row.get::<_, i64>(6)? != 0,
                        row.get::<_, i64>(7)? != 0,
                        row.get::<_, String>(8)?,
                        row.get::<_, String>(9)?,
                        row.get::<_, String>(10)?,
                        row.get::<_, i64>(11)?,
                        row.get::<_, Option<i64>>(12)?,
                        row.get::<_, i64>(13)? != 0,
                        row.get::<_, i64>(14)? != 0,
                        row.get::<_, i64>(15)? != 0,
                    ))
                },
            )
            .optional()?;
        let Some((
            status,
            persisted_fingerprint,
            provider,
            scope_enabled,
            allow_local,
            allow_cloud,
            managed_enabled,
            volume_enabled,
            volume_id,
            platform_file_id,
            name,
            size,
            modified_at,
            is_directory,
            is_stale,
            user_corrected,
        )) = row
        else {
            return Ok(ValidationDisposition::Stale("managed_ai_job_missing"));
        };
        if status != "running" {
            return Ok(ValidationDisposition::Blocked("managed_ai_job_not_running"));
        }
        if provider != expected_provider || provider != job.provider {
            return Ok(ValidationDisposition::Blocked(
                "managed_ai_provider_changed",
            ));
        }
        let provider_allowed =
            (provider == "local" && allow_local) || (provider == "cloud" && allow_cloud);
        if !scope_enabled || !managed_enabled || !volume_enabled || !provider_allowed {
            return Ok(ValidationDisposition::Blocked(
                "managed_scope_policy_disabled",
            ));
        }
        if user_corrected {
            return Ok(ValidationDisposition::Blocked("user_corrected"));
        }
        if is_stale || is_directory {
            return Ok(ValidationDisposition::Stale("global_entry_stale"));
        }
        let current_fingerprint = metadata_fingerprint(
            &volume_id,
            &platform_file_id,
            &name,
            size,
            modified_at,
            is_directory,
        );
        if persisted_fingerprint != job.input_fingerprint
            || current_fingerprint != job.input_fingerprint
        {
            return Ok(ValidationDisposition::Stale("input_fingerprint_changed"));
        }
        Ok(ValidationDisposition::Valid)
    }

    pub(crate) fn complete_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        model: &str,
        response: &str,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let now = unix_now();
        let updated = transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'completed', model = ?2, completed_at = ?3, last_error = NULL
            WHERE id = ?1
              AND status = 'running'
              AND input_fingerprint = ?4
              AND EXISTS (
                  SELECT 1
                  FROM managed_scopes scope
                  JOIN managed_entries managed
                    ON managed.managed_scope_id = scope.id
                   AND managed.global_entry_id = ai_jobs.global_entry_id
                  JOIN global_entries entry ON entry.id = ai_jobs.global_entry_id
                  JOIN global_volumes volume ON volume.id = entry.volume_id
                  LEFT JOIN ai_analysis_state state ON state.global_entry_id = ai_jobs.global_entry_id
                  WHERE scope.id = ai_jobs.managed_scope_id
                    AND scope.enabled = 1
                    AND managed.enabled = 1
                    AND volume.enabled = 1
                    AND entry.is_stale = 0
                    AND entry.is_directory = 0
                    AND COALESCE(state.user_corrected, 0) = 0
                    AND ((ai_jobs.provider = 'local' AND scope.allow_local_ai = 1)
                      OR (ai_jobs.provider = 'cloud' AND scope.allow_cloud_ai = 1))
              )
            "#,
            params![job.id, model, now, job.input_fingerprint],
        )?;
        if updated == 0 {
            transaction.commit()?;
            return Ok(());
        }
        transaction.execute(
            "UPDATE ai_job_items SET status = 'completed', updated_at = ?2, last_error = NULL WHERE job_id = ?1",
            params![job.id, now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_analysis_state
            SET status = 'completed', model = ?2, classification_json = ?3,
                content_summary = 'metadata_only', last_error = NULL, updated_at = ?4
            WHERE global_entry_id = ?1
              AND input_fingerprint = ?5
              AND user_corrected = 0
            "#,
            params![
                job.global_entry_id,
                model,
                response,
                now,
                job.input_fingerprint
            ],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'stale', completed_at = ?3,
                last_error = 'superseded_by_effective_scope'
            WHERE global_entry_id = ?1
              AND input_fingerprint = ?2
              AND id <> ?4
              AND status IN ('pending', 'running', 'blocked_by_policy')
            "#,
            params![job.global_entry_id, job.input_fingerprint, now, job.id],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_job_items
            SET status = 'stale', updated_at = ?3,
                last_error = 'superseded_by_effective_scope'
            WHERE job_id IN (
                SELECT id FROM ai_jobs
                WHERE global_entry_id = ?1
                  AND input_fingerprint = ?2
                  AND id <> ?4
                  AND status = 'stale'
                  AND last_error = 'superseded_by_effective_scope'
            )
            "#,
            params![job.global_entry_id, job.input_fingerprint, now, job.id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub(crate) fn block_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        reason: &str,
    ) -> Result<(), DbError> {
        self.finish_managed_ai_job(job, AI_JOB_BLOCKED_BY_POLICY, reason)
    }

    pub(crate) fn stale_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        reason: &str,
    ) -> Result<(), DbError> {
        self.finish_managed_ai_job(job, AI_JOB_STALE, reason)
    }

    pub(crate) fn fail_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        error: &str,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let attempt_count: i64 = transaction.query_row(
            "SELECT attempt_count FROM ai_jobs WHERE id = ?1",
            params![job.id],
            |row| row.get(0),
        )?;
        let next_status = if attempt_count < MAX_ATTEMPTS {
            AI_JOB_PENDING
        } else {
            AI_JOB_FAILED
        };
        let now = unix_now();
        let updated = transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = ?2,
                completed_at = CASE WHEN ?2 = 'failed' THEN ?3 ELSE NULL END,
                last_error = ?4
            WHERE id = ?1 AND status = 'running'
            "#,
            params![job.id, next_status, now, error],
        )?;
        if updated == 0 {
            transaction.commit()?;
            return Ok(());
        }
        transaction.execute(
            "UPDATE ai_job_items SET status = ?2, updated_at = ?3, last_error = ?4 WHERE job_id = ?1",
            params![job.id, next_status, now, error],
        )?;
        transaction.execute(
            "UPDATE ai_analysis_state SET status = ?2, last_error = ?3, updated_at = ?4 WHERE global_entry_id = ?1 AND user_corrected = 0",
            params![job.global_entry_id, next_status, error, now],
        )?;
        transaction.commit()?;
        Ok(())
    }

    fn finish_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        status: &str,
        reason: &str,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let now = unix_now();
        let updated = transaction.execute(
            "UPDATE ai_jobs SET status = ?2, completed_at = ?3, last_error = ?4 WHERE id = ?1 AND status = 'running'",
            params![job.id, status, now, reason],
        )?;
        if updated == 0 {
            transaction.commit()?;
            return Ok(());
        }
        transaction.execute(
            "UPDATE ai_job_items SET status = ?2, updated_at = ?3, last_error = ?4 WHERE job_id = ?1",
            params![job.id, status, now, reason],
        )?;
        transaction.execute(
            "UPDATE ai_analysis_state SET status = ?2, last_error = ?3, updated_at = ?4 WHERE global_entry_id = ?1 AND user_corrected = 0",
            params![job.global_entry_id, status, reason, now],
        )?;
        transaction.commit()?;
        Ok(())
    }
}

#[derive(Clone)]
pub struct ManagedAiWorker {
    stop: Arc<AtomicBool>,
    wake: SyncSender<()>,
    handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl ManagedAiWorker {
    pub fn start(db: Database) -> Self {
        Self::start_inner(db, None)
    }

    #[cfg(test)]
    fn start_for_test(db: Database) -> (Self, Receiver<()>) {
        let (idle_tx, idle_rx) = mpsc::sync_channel(1);
        (Self::start_inner(db, Some(idle_tx)), idle_rx)
    }

    fn start_inner(db: Database, idle_ready: Option<SyncSender<()>>) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let stop_for_thread = stop.clone();
        let (wake, receiver) = mpsc::sync_channel(1);
        db.set_managed_ai_waker(wake.clone());
        let wake_for_thread = wake.clone();
        let handle = thread::Builder::new()
            .name("zen-canvas-managed-ai-worker".to_string())
            .spawn(move || run_worker(db, stop_for_thread, receiver, wake_for_thread, idle_ready))
            .ok();
        Self {
            stop,
            wake,
            handle: Arc::new(Mutex::new(handle)),
        }
    }

    pub fn shutdown(&self) {
        self.stop.store(true, Ordering::Release);
        let _ = self.wake.try_send(());
        if let Ok(mut handle) = self.handle.lock() {
            if let Some(handle) = handle.take() {
                let _ = handle.join();
            }
        }
    }
}

impl Drop for ManagedAiWorker {
    fn drop(&mut self) {
        if Arc::strong_count(&self.handle) == 1 {
            self.shutdown();
        }
    }
}

fn run_worker(
    db: Database,
    stop: Arc<AtomicBool>,
    wake_rx: Receiver<()>,
    wake_tx: SyncSender<()>,
    idle_ready: Option<SyncSender<()>>,
) {
    let _ = db.reset_running_managed_ai_jobs();
    let active = Arc::new(AtomicUsize::new(0));
    let mut handles = Vec::new();
    while !stop.load(Ordering::Acquire) {
        reap_finished(&mut handles);
        let settings = get_ai_settings_for_db(&db)
            .map(normalize_ai_settings)
            .ok()
            .filter(|settings| settings.enabled);
        db.set_managed_ai_work_wakes_armed(settings.is_some());
        if let Some(settings) = settings {
            let desired_provider = match settings.provider {
                AIProviderKind::Ollama => "local",
                AIProviderKind::OpenAICompatible => "cloud",
            };
            let activity_policy = crate::platform::macos::activity::policy_for(
                crate::platform::macos::activity::MacActivitySnapshot::current(),
                settings.classification_concurrency.clamp(1, 4),
                true,
            );
            if !activity_policy.allow_nonessential_background_work {
                let pending_work = db
                    .has_eligible_managed_ai_work(desired_provider)
                    .unwrap_or(false);
                if pending_work {
                    match wake_rx.recv_timeout(ACTIVITY_BLOCKED_RECHECK) {
                        Ok(()) | Err(RecvTimeoutError::Timeout) => continue,
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                } else {
                    signal_test_idle_wait(&idle_ready);
                    if wake_rx.recv().is_err() {
                        break;
                    }
                }
                continue;
            }
            let concurrency = settings
                .classification_concurrency
                .clamp(1, 4)
                .min(activity_policy.max_parallelism);
            while active.load(Ordering::Acquire) < concurrency && !stop.load(Ordering::Acquire) {
                let job = match db.claim_next_managed_ai_job(desired_provider) {
                    Ok(Some(job)) => job,
                    Ok(None) | Err(_) => break,
                };
                let db_for_job = db.clone();
                let active_for_job = active.clone();
                let settings_for_job = settings.clone();
                let job_for_thread = job.clone();
                let wake_for_job = wake_tx.clone();
                active.fetch_add(1, Ordering::AcqRel);
                let handle = thread::Builder::new()
                    .name(format!("zen-canvas-managed-ai-{}", job.id))
                    .spawn(move || {
                        process_job(&db_for_job, &job_for_thread, &settings_for_job);
                        active_for_job.fetch_sub(1, Ordering::AcqRel);
                        let _ = wake_for_job.try_send(());
                    });
                match handle {
                    Ok(handle) => handles.push(handle),
                    Err(error) => {
                        active.fetch_sub(1, Ordering::AcqRel);
                        let _ =
                            db.fail_managed_ai_job(&job, &format!("worker_spawn_failed: {error}"));
                    }
                }
            }
        }
        signal_test_idle_wait(&idle_ready);
        if wake_rx.recv().is_err() {
            break;
        }
    }
    db.set_managed_ai_work_wakes_armed(false);
    while let Some(handle) = handles.pop() {
        let _ = handle.join();
    }
}

fn signal_test_idle_wait(idle_ready: &Option<SyncSender<()>>) {
    if let Some(ready) = idle_ready.as_ref() {
        let _ = ready.try_send(());
    }
}

fn reap_finished(handles: &mut Vec<JoinHandle<()>>) {
    let mut index = 0;
    while index < handles.len() {
        if handles[index].is_finished() {
            let handle = handles.swap_remove(index);
            let _ = handle.join();
        } else {
            index += 1;
        }
    }
}

fn process_job(db: &Database, job: &ManagedAiJob, settings: &AISettings) {
    if !settings.enabled {
        let _ = db.block_managed_ai_job(job, "ai_disabled");
        return;
    }
    let expected_provider = match settings.provider {
        AIProviderKind::Ollama => "local",
        AIProviderKind::OpenAICompatible => "cloud",
    };
    if job.provider != expected_provider {
        let _ = db.block_managed_ai_job(job, "managed_ai_provider_changed");
        return;
    }
    if expected_provider == "cloud" && settings.api_key.is_empty() {
        let _ = db.block_managed_ai_job(job, "cloud_provider_or_credentials_required");
        return;
    }

    if !apply_validation(db, job, expected_provider) {
        return;
    }
    let request = build_managed_ai_request(job, settings);
    let provider = provider_for_settings(settings);
    match provider.chat_json(request) {
        Ok(response) => {
            if !apply_validation(db, job, expected_provider) {
                return;
            }
            match ManagedClassificationResult::parse(job, &response) {
                Ok(canonical) => {
                    let canonical = canonical
                        .chars()
                        .take(MAX_STORED_RESPONSE_BYTES)
                        .collect::<String>();
                    if let Err(error) = db.complete_managed_ai_job(job, &settings.model, &canonical)
                    {
                        let _ = db.fail_managed_ai_job(
                            job,
                            &sanitize_worker_error(error.to_string(), settings),
                        );
                    }
                }
                Err(error) => {
                    let _ = db.fail_managed_ai_job(job, &error);
                }
            }
        }
        Err(error) => {
            if !apply_validation(db, job, expected_provider) {
                return;
            }
            let error = sanitize_worker_error(error.to_string(), settings);
            let _ = db.fail_managed_ai_job(job, &error);
        }
    }
}

fn apply_validation(db: &Database, job: &ManagedAiJob, provider: &str) -> bool {
    match db.validate_managed_ai_job(job, provider) {
        Ok(ValidationDisposition::Valid) => true,
        Ok(ValidationDisposition::Blocked(reason)) => {
            let _ = db.block_managed_ai_job(job, reason);
            false
        }
        Ok(ValidationDisposition::Stale(reason)) => {
            let _ = db.stale_managed_ai_job(job, reason);
            false
        }
        Err(error) => {
            let _ = db.fail_managed_ai_job(job, &format!("managed_ai_validation_failed: {error}"));
            false
        }
    }
}

pub(crate) fn build_managed_ai_request(job: &ManagedAiJob, settings: &AISettings) -> AIChatRequest {
    let mut metadata = json!({
        "refId": format!("managed:{}", job.global_entry_id),
        "name": job.name,
        "extension": job.extension,
        "size": job.size,
        "modifiedAt": job.modified_at_fs,
        "isDirectory": false,
    });
    if settings.send_full_path {
        metadata["path"] = json!(job.path);
    } else if settings.send_parent_path {
        if let Some(parent) = parent_path(&job.path).filter(|path| !is_system_path(path)) {
            metadata["parent"] = json!(parent);
        }
    }
    AIChatRequest {
        messages: vec![
            AIChatMessage {
                role: "system".to_string(),
                content: "Classify one explicitly managed file from metadata only. Return exactly one JSON object with refId, fileType, purpose, lifecycle, riskLevel, suggestedAction, confidence (0 to 1), and reason. Never infer or request file contents.".to_string(),
            },
            AIChatMessage {
                role: "user".to_string(),
                content: serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string()),
            },
        ],
        model: settings.model.clone(),
        temperature: settings.temperature,
        max_tokens: settings.max_tokens.min(4096),
        force_json: true,
        provider_options: AIProviderOptions {
            enable_thinking: Some(false),
            reasoning_effort: None,
            extra_body_json: settings.extra_body_json.clone(),
            use_response_format: Some(true),
            trace_context: None,
        },
    }
}

fn sync_job_item_and_analysis_status(
    transaction: &rusqlite::Transaction<'_>,
    now: i64,
) -> Result<(), DbError> {
    transaction.execute(
        r#"
        UPDATE ai_job_items
        SET status = (SELECT status FROM ai_jobs job WHERE job.id = ai_job_items.job_id),
            updated_at = ?1,
            last_error = (SELECT last_error FROM ai_jobs job WHERE job.id = ai_job_items.job_id)
        WHERE EXISTS (SELECT 1 FROM ai_jobs job WHERE job.id = ai_job_items.job_id)
        "#,
        params![now],
    )?;
    transaction.execute(
        r#"
        UPDATE ai_analysis_state
        SET status = COALESCE((
                SELECT job.status FROM ai_jobs job
                WHERE job.global_entry_id = ai_analysis_state.global_entry_id
                ORDER BY CASE job.status
                    WHEN 'running' THEN 0
                    WHEN 'pending' THEN 1
                    WHEN 'completed' THEN 2
                    WHEN 'failed' THEN 3
                    WHEN 'blocked_by_policy' THEN 4
                    WHEN 'stale' THEN 5
                    ELSE 6 END,
                    job.created_at DESC
                LIMIT 1
            ), status),
            last_error = (
                SELECT job.last_error FROM ai_jobs job
                WHERE job.global_entry_id = ai_analysis_state.global_entry_id
                ORDER BY CASE job.status
                    WHEN 'running' THEN 0
                    WHEN 'pending' THEN 1
                    WHEN 'completed' THEN 2
                    WHEN 'failed' THEN 3
                    WHEN 'blocked_by_policy' THEN 4
                    WHEN 'stale' THEN 5
                    ELSE 6 END,
                    job.created_at DESC
                LIMIT 1
            ),
            updated_at = ?1
        WHERE user_corrected = 0
        "#,
        params![now],
    )?;
    Ok(())
}

fn metadata_fingerprint(
    volume_id: &str,
    platform_file_id: &str,
    name: &str,
    size: i64,
    modified_at_fs: Option<i64>,
    is_directory: bool,
) -> String {
    format!(
        "mf_{}",
        blake3::hash(
            format!(
                "{}\0{}\0{}\0{}\0{}\0{}",
                volume_id,
                platform_file_id,
                name,
                size,
                modified_at_fs.unwrap_or_default(),
                is_directory
            )
            .as_bytes(),
        )
        .to_hex()
    )
}

fn parent_path(path: &str) -> Option<String> {
    let normalized = path.replace('\\', "/");
    let separator = normalized.rfind('/')?;
    (separator > 0).then(|| normalized[..separator].to_string())
}

fn is_system_path(path: &str) -> bool {
    let normalized = normalize_path(path).to_ascii_lowercase();
    [
        "/system",
        "/library",
        "/private",
        "/usr",
        "/bin",
        "/sbin",
        "/etc",
        "/var",
        "/opt",
        "/dev",
        "c:/windows",
        "c:/program files",
        "c:/programdata",
        "c:/recovery",
        "c:/system volume information",
    ]
    .iter()
    .any(|prefix| normalized == *prefix || normalized.starts_with(&format!("{prefix}/")))
}

fn sanitize_worker_error(error: String, settings: &AISettings) -> String {
    let redacted = if settings.api_key.is_empty() {
        error
    } else {
        error.replace(&settings.api_key, "[redacted]")
    };
    redacted.chars().take(1000).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{
        schema::{AIProviderKind, AIProviderPresetId},
        settings::{save_ai_settings_with_store, InMemoryCredentialStore},
    };
    use crate::global_index::models::{
        AddManagedScopeRequest, GlobalEntryInput, GlobalVolume, INDEX_STATUS_READY,
        PROVIDER_WINDOWS_MFT_USN,
    };
    use serde_json::Value;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        path::PathBuf,
        sync::mpsc,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    struct TestDatabaseDirectory(PathBuf);

    impl TestDatabaseDirectory {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(".tmp-tests")
                .join("zb-02-managed-ai-worker")
                .join(format!("{}-{nonce}", std::process::id()));
            std::fs::create_dir_all(&path).expect("create task-local worker test directory");
            Self(path)
        }

        fn database_path(&self) -> PathBuf {
            self.0.join("database.sqlite3")
        }
    }

    impl Drop for TestDatabaseDirectory {
        fn drop(&mut self) {
            if let Err(error) = std::fs::remove_dir_all(&self.0) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    eprintln!("failed to clean worker test data {:?}: {error}", self.0);
                }
            }
        }
    }

    fn read_json_request(stream: &mut TcpStream) -> Value {
        let mut bytes = Vec::new();
        let mut expected_length = None;
        loop {
            if expected_length.is_some_and(|length| bytes.len() >= length) {
                break;
            }
            let mut chunk = [0_u8; 4096];
            let read = stream.read(&mut chunk).expect("read local Ollama request");
            assert_ne!(read, 0, "local Ollama request ended before its body");
            bytes.extend_from_slice(&chunk[..read]);
            if expected_length.is_none() {
                if let Some(header_end) = bytes.windows(4).position(|window| window == b"\r\n\r\n")
                {
                    let headers = String::from_utf8_lossy(&bytes[..header_end]);
                    let content_length = headers
                        .lines()
                        .find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            name.eq_ignore_ascii_case("content-length")
                                .then(|| value.trim().parse::<usize>().ok())
                                .flatten()
                        })
                        .expect("JSON request content length");
                    expected_length = Some(header_end + 4 + content_length);
                }
            }
        }
        let header_end = bytes
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
            .expect("HTTP header terminator");
        serde_json::from_slice(&bytes[header_end + 4..]).expect("parse local Ollama request")
    }

    fn run_local_ollama(
        listener: TcpListener,
        stop_rx: mpsc::Receiver<()>,
        served_tx: mpsc::Sender<String>,
        expected_requests: usize,
    ) {
        let mut served = 0;
        while served < expected_requests {
            if stop_rx.try_recv().is_ok() {
                return;
            }
            match listener.accept() {
                Ok((mut stream, _)) => {
                    stream
                        .set_nonblocking(false)
                        .expect("make accepted Ollama stream blocking");
                    stream
                        .set_read_timeout(Some(Duration::from_secs(3)))
                        .expect("set local server read timeout");
                    let request = read_json_request(&mut stream);
                    let user_content = request["messages"]
                        .as_array()
                        .expect("request messages")
                        .iter()
                        .find(|message| message["role"] == "user")
                        .and_then(|message| message["content"].as_str())
                        .expect("managed metadata user message");
                    let metadata: Value =
                        serde_json::from_str(user_content).expect("managed metadata JSON");
                    let reference = metadata["refId"]
                        .as_str()
                        .expect("managed reference ID")
                        .to_string();
                    let classification = serde_json::json!({
                        "refId": reference,
                        "fileType": "document",
                        "purpose": "work",
                        "lifecycle": "active",
                        "riskLevel": "low",
                        "suggestedAction": "keep",
                        "confidence": 0.9,
                        "reason": "deterministic idle worker test"
                    })
                    .to_string();
                    let body = serde_json::json!({
                        "message": { "content": classification }
                    })
                    .to_string();
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    stream
                        .write_all(response.as_bytes())
                        .expect("write local Ollama response");
                    served_tx
                        .send(reference)
                        .expect("report served classification");
                    served += 1;
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(5));
                }
                Err(error) => panic!("accept local Ollama request: {error}"),
            }
        }
    }

    struct LocalOllamaServer {
        stop_tx: mpsc::Sender<()>,
        thread: Option<thread::JoinHandle<()>>,
    }

    impl LocalOllamaServer {
        fn stop_and_join(mut self) {
            let _ = self.stop_tx.send(());
            self.thread
                .take()
                .expect("local Ollama server thread")
                .join()
                .expect("local Ollama fixture thread");
        }
    }

    impl Drop for LocalOllamaServer {
        fn drop(&mut self) {
            let _ = self.stop_tx.send(());
            if let Some(thread) = self.thread.take() {
                let _ = thread.join();
            }
        }
    }

    fn worker_test_volume() -> GlobalVolume {
        GlobalVolume {
            id: "gv_zb02_worker_test".to_string(),
            platform: "windows".to_string(),
            stable_volume_id: "zb02-worker-test-volume".to_string(),
            display_name: "Worker test volume".to_string(),
            mount_path: r"C:\Managed".to_string(),
            filesystem_type: "ntfs".to_string(),
            drive_kind: "fixed".to_string(),
            enabled: true,
            provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
            index_status: INDEX_STATUS_READY.to_string(),
            last_error: None,
            journal_id: Some("1".to_string()),
            journal_cursor: Some("1".to_string()),
            last_full_index_at: Some(1),
            last_incremental_sync_at: Some(1),
            entry_count: 0,
            created_at: 1,
            updated_at: 1,
        }
    }

    fn worker_test_entry(index: usize) -> GlobalEntryInput {
        let name = format!("file-{index}.txt");
        GlobalEntryInput {
            volume_id: "gv_zb02_worker_test".to_string(),
            platform_file_id: format!("worker-test:{index}"),
            parent_platform_file_id: "worker-test:parent".to_string(),
            name: name.clone(),
            path: format!(r"C:\Managed\WakeTest\{name}"),
            extension: "txt".to_string(),
            is_directory: false,
            size: 42,
            created_at_fs: Some(1),
            modified_at_fs: Some(2),
            file_attributes: 0,
            is_hidden: false,
            is_system: false,
            source_provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
            last_seen_at: 2,
        }
    }

    fn job() -> ManagedAiJob {
        ManagedAiJob {
            id: "job".to_string(),
            global_entry_id: "entry".to_string(),
            managed_scope_id: "scope".to_string(),
            input_fingerprint: "fingerprint".to_string(),
            provider: "local".to_string(),
            name: "report.txt".to_string(),
            path: r"C:\Private\report.txt".to_string(),
            extension: "txt".to_string(),
            size: 42,
            modified_at_fs: Some(10),
        }
    }

    #[test]
    fn result_schema_rejects_wrong_reference_and_confidence() {
        let wrong_ref = r#"{"refId":"managed:other","fileType":"document","purpose":"work","lifecycle":"active","riskLevel":"low","suggestedAction":"keep","confidence":0.9,"reason":"test"}"#;
        assert!(ManagedClassificationResult::parse(&job(), wrong_ref).is_err());
        let wrong_confidence = r#"{"refId":"managed:entry","fileType":"document","purpose":"work","lifecycle":"active","riskLevel":"low","suggestedAction":"keep","confidence":2.0,"reason":"test"}"#;
        assert!(ManagedClassificationResult::parse(&job(), wrong_confidence).is_err());
    }

    #[test]
    fn result_schema_accepts_complete_canonical_json() {
        let response = r#"{"refId":"managed:entry","fileType":"document","purpose":"work","lifecycle":"active","riskLevel":"low","suggestedAction":"keep","confidence":0.9,"reason":"test"}"#;
        let canonical = ManagedClassificationResult::parse(&job(), response).expect("valid schema");
        assert!(canonical.contains("\"confidence\":0.9"));
    }

    #[test]
    fn idle_worker_shutdown_uses_an_explicit_wake() {
        let test_dir = TestDatabaseDirectory::new();
        let db = Database::open(test_dir.database_path()).expect("open worker database");
        let worker = ManagedAiWorker::start(db.clone());
        let started_at = Instant::now();
        worker.shutdown();
        assert!(started_at.elapsed() < Duration::from_secs(1));
        drop(worker);
        drop(db);
    }

    #[test]
    fn queued_work_wakes_idle_worker_and_child_completion_refills_queue() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local Ollama fixture");
        listener
            .set_nonblocking(true)
            .expect("make local Ollama fixture nonblocking");
        let address = listener.local_addr().expect("local Ollama address");
        let (served_tx, served_rx) = mpsc::channel();
        let (server_stop_tx, server_stop_rx) = mpsc::channel();
        let server = LocalOllamaServer {
            stop_tx: server_stop_tx,
            thread: Some(thread::spawn(move || {
                run_local_ollama(listener, server_stop_rx, served_tx, 3);
            })),
        };

        let test_dir = TestDatabaseDirectory::new();
        let db = Database::open(test_dir.database_path()).expect("open worker database");
        db.upsert_global_volume(&worker_test_volume())
            .expect("insert managed source");
        db.add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Managed\WakeTest".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("add eligible managed scope");
        let settings = AISettings {
            enabled: true,
            provider: AIProviderKind::Ollama,
            preset: AIProviderPresetId::Ollama,
            base_url: format!("http://{address}"),
            model: "test-model".to_string(),
            timeout_seconds: 5,
            ..AISettings::default()
        };
        save_ai_settings_with_store(&db, &settings, &InMemoryCredentialStore::default())
            .expect("enable local test provider");

        let (worker, idle_rx) = ManagedAiWorker::start_for_test(db.clone());
        idle_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("worker reached the empty-queue wait after startup recovery");
        // The worker has checked the empty durable queue and is at the check→wait
        // boundary. Its buffered signal must survive a producer commit in this gap.
        let entries = (0..3).map(worker_test_entry).collect::<Vec<_>>();
        db.upsert_global_entries_batch(&entries)
            .expect("enqueue three durable AI jobs");

        let mut served = Vec::new();
        for _ in 0..3 {
            match served_rx.recv_timeout(Duration::from_secs(5)) {
                Ok(reference) => served.push(reference),
                Err(_) => break,
            }
        }
        worker.shutdown();
        server.stop_and_join();
        assert_eq!(
            served.len(),
            3,
            "each queued job must be reached by a worker wake"
        );

        let completed_jobs: i64 = db
            .conn()
            .expect("database connection")
            .query_row(
                "SELECT COUNT(*) FROM ai_jobs WHERE status = 'completed'",
                [],
                |row| row.get(0),
            )
            .expect("count completed AI jobs");
        assert_eq!(
            completed_jobs, 3,
            "child completion must refill the worker slot"
        );
        drop(worker);
        drop(db);
    }

    #[test]
    fn disabled_worker_ignores_global_index_batches_until_settings_control_wake() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local Ollama fixture");
        listener
            .set_nonblocking(true)
            .expect("make local Ollama fixture nonblocking");
        let address = listener.local_addr().expect("local Ollama address");
        let (served_tx, served_rx) = mpsc::channel();
        let (server_stop_tx, server_stop_rx) = mpsc::channel();
        let server = LocalOllamaServer {
            stop_tx: server_stop_tx,
            thread: Some(thread::spawn(move || {
                run_local_ollama(listener, server_stop_rx, served_tx, 1);
            })),
        };

        let test_dir = TestDatabaseDirectory::new();
        let db = Database::open(test_dir.database_path()).expect("open worker database");
        db.upsert_global_volume(&worker_test_volume())
            .expect("insert managed source");
        db.add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Managed\WakeTest".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("add eligible managed scope");
        let mut settings = AISettings {
            enabled: false,
            provider: AIProviderKind::Ollama,
            preset: AIProviderPresetId::Ollama,
            base_url: format!("http://{address}"),
            model: "test-model".to_string(),
            timeout_seconds: 5,
            ..AISettings::default()
        };
        save_ai_settings_with_store(&db, &settings, &InMemoryCredentialStore::default())
            .expect("persist disabled local provider settings");

        let (worker, idle_rx) = ManagedAiWorker::start_for_test(db.clone());
        idle_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("disabled worker reached its blocking wait");

        // One batch creates durable eligible work, while many additional batches
        // exercise the Global Index hot path without matching a Managed Scope.
        db.upsert_global_entries_batch(&[worker_test_entry(0)])
            .expect("create durable pending work while AI is disabled");
        for index in 1..=32 {
            let mut entry = worker_test_entry(index);
            entry.path = format!(r"C:\Unmanaged\file-{index}.txt");
            db.upsert_global_entries_batch(&[entry])
                .expect("commit an unrelated Global Index batch");
        }
        let pending_jobs: i64 = db
            .conn()
            .expect("database connection")
            .query_row(
                "SELECT COUNT(*) FROM ai_jobs WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .expect("count durable pending jobs");
        assert_eq!(pending_jobs, 1);
        assert_eq!(
            idle_rx.recv_timeout(Duration::from_millis(100)),
            Err(mpsc::RecvTimeoutError::Timeout),
            "disabled AI must stay asleep across batches, including a newly pending job"
        );
        assert!(
            served_rx.try_recv().is_err(),
            "the disabled worker must not dispatch queued work"
        );

        settings.enabled = true;
        save_ai_settings_with_store(&db, &settings, &InMemoryCredentialStore::default())
            .expect("enable provider and force a control wake");
        served_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("settings control wake processes previously pending durable work");
        worker.shutdown();
        server.stop_and_join();

        let completed_jobs: i64 = db
            .conn()
            .expect("database connection")
            .query_row(
                "SELECT COUNT(*) FROM ai_jobs WHERE status = 'completed'",
                [],
                |row| row.get(0),
            )
            .expect("count completed AI jobs");
        assert_eq!(completed_jobs, 1);
        drop(worker);
        drop(db);
    }
}
