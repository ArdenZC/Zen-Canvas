//! Hardened dispatcher for the Managed AI Index.
//!
//! The legacy module still owns the durable database transition helpers and
//! request builder. This dispatcher adds the production boundaries that must
//! hold at the final network edge: effective-scope deduplication, policy
//! serialization, fresh fingerprint validation, user-correction protection,
//! and strict response-schema validation.

use super::managed_worker::{build_managed_ai_request, ManagedAiJob};
use super::models::{unix_now, ManagedScope, AI_JOB_BLOCKED_BY_POLICY, AI_JOB_PENDING};
use crate::ai::{
    schema::AIProviderKind,
    settings::{get_ai_settings_for_db, normalize_ai_settings, provider_for_settings, AISettings},
};
use crate::db::{Database, DbError};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex, RwLock,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

const MAX_STORED_RESPONSE_CHARS: usize = 64 * 1024;
static MANAGED_POLICY_LOCK: RwLock<()> = RwLock::new(());

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DispatchDecision {
    Allowed,
    Inactive,
    Blocked(&'static str),
}

/// Serialize scope mutation against the final provider-dispatch boundary.
///
/// Existing in-flight blocking HTTP calls are allowed to finish, but a policy
/// command does not report success until they have left the read-side critical
/// section. No new provider request can start with the old policy after the
/// command commits.
pub(crate) fn with_managed_policy_write_lock<T>(action: impl FnOnce() -> T) -> T {
    let _guard = MANAGED_POLICY_LOCK
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    action()
}

/// Recalculate every non-terminal job after a scope policy change. This fixes
/// provider switches such as local -> cloud, which must not leave an
/// unclaimable local pending job behind.
pub(crate) fn reconcile_managed_scope_policy(
    db: &Database,
    scope: &ManagedScope,
) -> Result<(), DbError> {
    let mut conn = db.conn()?;
    let transaction = conn.transaction()?;
    let now = unix_now();
    let (provider, status, reason) =
        if !scope.enabled || (!scope.allow_local_ai && !scope.allow_cloud_ai) {
            (
                "none",
                AI_JOB_BLOCKED_BY_POLICY,
                Some("managed_scope_policy_disabled"),
            )
        } else if scope.allow_local_ai {
            ("local", AI_JOB_PENDING, None)
        } else {
            ("cloud", AI_JOB_PENDING, None)
        };

    transaction.execute(
        r#"
        UPDATE ai_jobs
        SET provider = ?2,
            status = ?3,
            started_at = NULL,
            completed_at = CASE WHEN ?3 = 'blocked_by_policy' THEN ?4 ELSE NULL END,
            last_error = ?5
        WHERE managed_scope_id = ?1
          AND status IN ('pending', 'running', 'blocked_by_policy')
        "#,
        params![scope.id, provider, status, now, reason],
    )?;
    transaction.execute(
        r#"
        UPDATE ai_job_items
        SET status = (
                SELECT job.status FROM ai_jobs job WHERE job.id = ai_job_items.job_id
            ),
            updated_at = ?2,
            last_error = (
                SELECT job.last_error FROM ai_jobs job WHERE job.id = ai_job_items.job_id
            )
        WHERE job_id IN (SELECT id FROM ai_jobs WHERE managed_scope_id = ?1)
          AND status IN ('pending', 'running', 'blocked_by_policy')
        "#,
        params![scope.id, now],
    )?;
    transaction.execute(
        r#"
        UPDATE ai_analysis_state
        SET status = ?2,
            provider = ?3,
            last_error = ?4,
            updated_at = ?5
        WHERE global_entry_id IN (
            SELECT global_entry_id FROM ai_jobs WHERE managed_scope_id = ?1
        )
          AND NOT EXISTS (
            SELECT 1
            FROM ai_jobs other
            WHERE other.global_entry_id = ai_analysis_state.global_entry_id
              AND other.managed_scope_id <> ?1
              AND other.status IN ('pending', 'running')
          )
        "#,
        params![scope.id, status, provider, reason, now],
    )?;
    transaction.commit()?;
    Ok(())
}

fn install_cancellation_guards(db: &Database) -> Result<(), DbError> {
    let conn = db.conn()?;
    conn.execute_batch(
        r#"
        CREATE TRIGGER IF NOT EXISTS ai_jobs_preserve_explicit_cancellation
        BEFORE UPDATE OF status ON ai_jobs
        WHEN OLD.status = 'canceled' AND NEW.status IN ('pending', 'running')
        BEGIN
            SELECT RAISE(IGNORE);
        END;

        CREATE TRIGGER IF NOT EXISTS ai_job_items_preserve_explicit_cancellation
        BEFORE UPDATE OF status ON ai_job_items
        WHEN OLD.status = 'canceled' AND NEW.status IN ('pending', 'running')
        BEGIN
            SELECT RAISE(IGNORE);
        END;

        CREATE TRIGGER IF NOT EXISTS ai_analysis_state_preserve_explicit_cancellation
        BEFORE UPDATE OF status ON ai_analysis_state
        WHEN OLD.status = 'canceled' AND NEW.status IN ('pending', 'running')
        BEGIN
            SELECT RAISE(IGNORE);
        END;
        "#,
    )?;
    Ok(())
}

#[derive(Clone)]
pub struct ManagedAiWorker {
    stop: Arc<AtomicBool>,
    handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl ManagedAiWorker {
    pub fn start(db: Database) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let stop_for_thread = stop.clone();
        let handle = thread::Builder::new()
            .name("zen-canvas-managed-ai-worker-hardened".to_string())
            .spawn(move || run_worker(db, stop_for_thread))
            .ok();
        Self {
            stop,
            handle: Arc::new(Mutex::new(handle)),
        }
    }

    pub fn shutdown(&self) {
        self.stop.store(true, Ordering::Release);
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

fn run_worker(db: Database, stop: Arc<AtomicBool>) {
    if install_cancellation_guards(&db).is_err() {
        return;
    }
    let _ = db.reset_running_managed_ai_jobs();
    let active = Arc::new(AtomicUsize::new(0));
    let mut handles = Vec::new();

    while !stop.load(Ordering::Acquire) {
        reap_finished(&mut handles);
        let settings = get_ai_settings_for_db(&db).map(normalize_ai_settings).ok();
        if let Some(settings) = settings.filter(|settings| settings.enabled) {
            let concurrency = settings.classification_concurrency.clamp(1, 4);
            while active.load(Ordering::Acquire) < concurrency && !stop.load(Ordering::Acquire) {
                let job = match claim_next_managed_ai_job(&db) {
                    Ok(Some(job)) => job,
                    Ok(None) | Err(_) => break,
                };
                let db_for_job = db.clone();
                let active_for_job = active.clone();
                let settings_for_job = settings.clone();
                let stop_for_job = stop.clone();
                let job_for_thread = job.clone();
                active.fetch_add(1, Ordering::AcqRel);
                let handle = thread::Builder::new()
                    .name(format!("zen-canvas-managed-ai-hardened-{}", job.id))
                    .spawn(move || {
                        process_job(
                            &db_for_job,
                            &job_for_thread,
                            &settings_for_job,
                            &stop_for_job,
                        );
                        active_for_job.fetch_sub(1, Ordering::AcqRel);
                    });
                match handle {
                    Ok(handle) => handles.push(handle),
                    Err(error) => {
                        active.fetch_sub(1, Ordering::AcqRel);
                        let _ =
                            db.fail_managed_ai_job(&job, &format!("worker_spawn_failed: {error}"));
                        break;
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(250));
    }

    while let Some(handle) = handles.pop() {
        let _ = handle.join();
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

fn claim_next_managed_ai_job(db: &Database) -> Result<Option<ManagedAiJob>, DbError> {
    let mut conn = db.conn()?;
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = unix_now();

    // A completed result or a user correction for the same immutable input is
    // authoritative. Pending scope duplicates must never incur another model
    // call or overwrite the protected state.
    transaction.execute(
        r#"
        UPDATE ai_jobs
        SET status = 'canceled', completed_at = ?1,
            last_error = 'duplicate_or_user_corrected_input'
        WHERE status = 'pending'
          AND (
            EXISTS (
                SELECT 1 FROM ai_jobs completed
                WHERE completed.global_entry_id = ai_jobs.global_entry_id
                  AND completed.input_fingerprint = ai_jobs.input_fingerprint
                  AND completed.status = 'completed'
            )
            OR EXISTS (
                SELECT 1 FROM ai_analysis_state state
                WHERE state.global_entry_id = ai_jobs.global_entry_id
                  AND state.user_corrected = 1
            )
          )
        "#,
        params![now],
    )?;
    transaction.execute(
        r#"
        UPDATE ai_job_items
        SET status = 'canceled', updated_at = ?1,
            last_error = 'duplicate_or_user_corrected_input'
        WHERE status = 'pending'
          AND EXISTS (
            SELECT 1 FROM ai_jobs job
            WHERE job.id = ai_job_items.job_id AND job.status = 'canceled'
          )
        "#,
        params![now],
    )?;

    let job = {
        let mut statement = transaction.prepare(
            r#"
            SELECT job.id, job.global_entry_id, job.input_fingerprint, job.provider,
                   entry.name, entry.path, entry.extension, entry.size,
                   entry.modified_at_fs
            FROM ai_jobs job
            JOIN managed_scopes scope ON scope.id = job.managed_scope_id
            JOIN managed_entries managed
              ON managed.global_entry_id = job.global_entry_id
             AND managed.managed_scope_id = job.managed_scope_id
            JOIN global_entries entry ON entry.id = job.global_entry_id
            JOIN global_volumes volume ON volume.id = entry.volume_id
            LEFT JOIN ai_analysis_state state
              ON state.global_entry_id = job.global_entry_id
            WHERE job.status = 'pending'
              AND scope.enabled = 1
              AND managed.enabled = 1
              AND volume.enabled = 1
              AND entry.is_stale = 0
              AND entry.is_directory = 0
              AND COALESCE(state.user_corrected, 0) = 0
              AND (
                  (job.provider = 'local' AND scope.allow_local_ai = 1)
                  OR (job.provider = 'cloud' AND scope.allow_cloud_ai = 1)
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ai_jobs running
                  WHERE running.global_entry_id = job.global_entry_id
                    AND running.input_fingerprint = job.input_fingerprint
                    AND running.status = 'running'
              )
            ORDER BY length(scope.path) DESC, job.created_at ASC, job.id ASC
            LIMIT 1
            "#,
        )?;
        statement
            .query_row([], |row| {
                Ok(ManagedAiJob {
                    id: row.get(0)?,
                    global_entry_id: row.get(1)?,
                    input_fingerprint: row.get(2)?,
                    provider: row.get(3)?,
                    name: row.get(4)?,
                    path: row.get(5)?,
                    extension: row.get(6)?,
                    size: row.get(7)?,
                    modified_at_fs: row.get(8)?,
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

    // The most specific eligible scope wins. Every sibling job for the same
    // entry and fingerprint becomes terminal before dispatch.
    transaction.execute(
        r#"
        UPDATE ai_jobs
        SET status = 'canceled', completed_at = ?3,
            last_error = 'duplicate_managed_scope'
        WHERE id <> ?1
          AND global_entry_id = ?2
          AND input_fingerprint = ?4
          AND status = 'pending'
        "#,
        params![job.id, job.global_entry_id, now, job.input_fingerprint],
    )?;
    transaction.execute(
        r#"
        UPDATE ai_job_items
        SET status = CASE
                WHEN job_id = ?1 THEN 'running'
                ELSE 'canceled'
            END,
            updated_at = ?3,
            last_error = CASE
                WHEN job_id = ?1 THEN NULL
                ELSE 'duplicate_managed_scope'
            END
        WHERE global_entry_id = ?2
          AND (
              job_id = ?1
              OR job_id IN (
                  SELECT id FROM ai_jobs
                  WHERE global_entry_id = ?2
                    AND input_fingerprint = ?4
                    AND status = 'canceled'
                    AND last_error = 'duplicate_managed_scope'
              )
          )
        "#,
        params![job.id, job.global_entry_id, now, job.input_fingerprint],
    )?;
    transaction.execute(
        r#"
        UPDATE ai_analysis_state
        SET status = 'running', input_fingerprint = ?2, provider = ?3,
            last_error = NULL, updated_at = ?4
        WHERE global_entry_id = ?1
        "#,
        params![
            job.global_entry_id,
            job.input_fingerprint,
            job.provider,
            now
        ],
    )?;
    transaction.commit()?;
    Ok(Some(job))
}

fn process_job(db: &Database, job: &ManagedAiJob, settings: &AISettings, stop: &AtomicBool) {
    if stop.load(Ordering::Acquire) || !settings.enabled {
        let _ = db.block_managed_ai_job(job, "ai_disabled_or_worker_stopping");
        return;
    }

    let _policy_guard = MANAGED_POLICY_LOCK
        .read()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    match validate_dispatch(db, job) {
        Ok(DispatchDecision::Allowed) => {}
        Ok(DispatchDecision::Inactive) => return,
        Ok(DispatchDecision::Blocked(reason)) => {
            let _ = db.block_managed_ai_job(job, reason);
            return;
        }
        Err(error) => {
            let _ =
                db.fail_managed_ai_job(job, &sanitize_worker_error(error.to_string(), settings));
            return;
        }
    }

    match (job.provider.as_str(), settings.provider) {
        ("local", AIProviderKind::Ollama) => {}
        ("cloud", AIProviderKind::OpenAICompatible) if !settings.api_key.is_empty() => {}
        ("local", _) => {
            let _ = db.block_managed_ai_job(job, "local_provider_required");
            return;
        }
        ("cloud", _) => {
            let _ = db.block_managed_ai_job(job, "cloud_provider_or_credentials_required");
            return;
        }
        _ => {
            let _ = db.block_managed_ai_job(job, "unknown_managed_ai_provider");
            return;
        }
    }

    if stop.load(Ordering::Acquire) {
        let _ = db.block_managed_ai_job(job, "worker_stopping_before_dispatch");
        return;
    }
    let request = build_managed_ai_request(job, settings);
    let provider = provider_for_settings(settings);
    match provider.chat_json(request) {
        Ok(response) => match validate_response(job, &response) {
            Ok(canonical) => {
                if let Err(error) = db.complete_managed_ai_job(job, &settings.model, &canonical) {
                    let _ = db.fail_managed_ai_job(
                        job,
                        &sanitize_worker_error(error.to_string(), settings),
                    );
                }
            }
            Err(error) => {
                let _ = db.fail_managed_ai_job(job, &error);
            }
        },
        Err(error) => {
            let error = sanitize_worker_error(error.to_string(), settings);
            let _ = db.fail_managed_ai_job(job, &error);
        }
    }
}

fn validate_dispatch(db: &Database, job: &ManagedAiJob) -> Result<DispatchDecision, DbError> {
    let conn = db.conn()?;
    let snapshot = conn
        .query_row(
            r#"
            SELECT job.status, job.provider, job.input_fingerprint,
                   scope.enabled, scope.allow_local_ai, scope.allow_cloud_ai,
                   managed.enabled, volume.enabled, entry.is_stale,
                   entry.is_directory, entry.volume_id, entry.platform_file_id,
                   entry.name, entry.size, entry.modified_at_fs,
                   COALESCE(state.user_corrected, 0)
            FROM ai_jobs job
            JOIN managed_scopes scope ON scope.id = job.managed_scope_id
            JOIN managed_entries managed
              ON managed.global_entry_id = job.global_entry_id
             AND managed.managed_scope_id = job.managed_scope_id
            JOIN global_entries entry ON entry.id = job.global_entry_id
            JOIN global_volumes volume ON volume.id = entry.volume_id
            LEFT JOIN ai_analysis_state state
              ON state.global_entry_id = job.global_entry_id
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
                    row.get::<_, i64>(8)? != 0,
                    row.get::<_, i64>(9)? != 0,
                    row.get::<_, String>(10)?,
                    row.get::<_, String>(11)?,
                    row.get::<_, String>(12)?,
                    row.get::<_, i64>(13)?,
                    row.get::<_, Option<i64>>(14)?,
                    row.get::<_, i64>(15)? != 0,
                ))
            },
        )
        .optional()?;

    let Some((
        status,
        provider,
        fingerprint,
        scope_enabled,
        allow_local,
        allow_cloud,
        managed_enabled,
        volume_enabled,
        is_stale,
        is_directory,
        volume_id,
        platform_file_id,
        name,
        size,
        modified_at_fs,
        user_corrected,
    )) = snapshot
    else {
        return Ok(DispatchDecision::Inactive);
    };

    if status != "running" {
        return Ok(DispatchDecision::Inactive);
    }
    if provider != job.provider || fingerprint != job.input_fingerprint {
        return Ok(DispatchDecision::Blocked("job_snapshot_changed"));
    }
    if !scope_enabled || !managed_enabled || !volume_enabled {
        return Ok(DispatchDecision::Blocked(
            "managed_scope_or_volume_disabled",
        ));
    }
    if is_stale || is_directory {
        return Ok(DispatchDecision::Blocked("global_entry_not_dispatchable"));
    }
    if user_corrected {
        return Ok(DispatchDecision::Blocked("user_corrected_result_locked"));
    }
    if (provider == "local" && !allow_local) || (provider == "cloud" && !allow_cloud) {
        return Ok(DispatchDecision::Blocked(
            "managed_scope_provider_disallowed",
        ));
    }
    let current_fingerprint = metadata_fingerprint(
        &volume_id,
        &platform_file_id,
        &name,
        size,
        modified_at_fs,
        is_directory,
    );
    if current_fingerprint != fingerprint {
        return Ok(DispatchDecision::Blocked(
            "input_fingerprint_changed_before_dispatch",
        ));
    }
    Ok(DispatchDecision::Allowed)
}

fn validate_response(job: &ManagedAiJob, response: &str) -> Result<String, String> {
    if response.chars().count() > MAX_STORED_RESPONSE_CHARS {
        return Err("managed_ai_response_exceeds_limit".to_string());
    }
    let json = extract_json_object(response)
        .ok_or_else(|| "managed_ai_response_missing_json_object".to_string())?;
    let result: ManagedClassificationResult = serde_json::from_str(json)
        .map_err(|error| format!("managed_ai_response_schema_invalid: {error}"))?;
    if result.ref_id != format!("managed:{}", job.global_entry_id) {
        return Err("managed_ai_response_ref_id_mismatch".to_string());
    }
    validate_text("fileType", &result.file_type, 80)?;
    validate_text("purpose", &result.purpose, 500)?;
    validate_text("lifecycle", &result.lifecycle, 120)?;
    validate_text("riskLevel", &result.risk_level, 80)?;
    validate_text("suggestedAction", &result.suggested_action, 500)?;
    validate_text("reason", &result.reason, 2_000)?;
    if !result.confidence.is_finite() || !(0.0..=1.0).contains(&result.confidence) {
        return Err("managed_ai_response_confidence_out_of_range".to_string());
    }
    serde_json::to_string(&result)
        .map_err(|error| format!("managed_ai_response_canonicalization_failed: {error}"))
}

fn validate_text(label: &str, value: &str, max_chars: usize) -> Result<(), String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("managed_ai_response_{label}_empty"));
    }
    if trimmed.chars().count() > max_chars {
        return Err(format!("managed_ai_response_{label}_too_long"));
    }
    Ok(())
}

fn extract_json_object(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    let start = trimmed.find('{')?;
    let end = trimmed.rfind('}')?;
    (start <= end).then(|| &trimmed[start..=end])
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

fn sanitize_worker_error(error: String, settings: &AISettings) -> String {
    let redacted = if settings.api_key.is_empty() {
        error
    } else {
        error.replace(&settings.api_key, "[redacted]")
    };
    redacted.chars().take(1_000).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job() -> ManagedAiJob {
        ManagedAiJob {
            id: "job".to_string(),
            global_entry_id: "entry".to_string(),
            input_fingerprint: "fingerprint".to_string(),
            provider: "local".to_string(),
            name: "report.txt".to_string(),
            path: "/tmp/report.txt".to_string(),
            extension: "txt".to_string(),
            size: 42,
            modified_at_fs: Some(10),
        }
    }

    #[test]
    fn managed_response_requires_the_exact_schema_and_reference() {
        let valid = r#"{
            "refId":"managed:entry",
            "fileType":"document",
            "purpose":"report",
            "lifecycle":"active",
            "riskLevel":"low",
            "suggestedAction":"keep",
            "confidence":0.9,
            "reason":"metadata is consistent"
        }"#;
        let canonical = validate_response(&job(), valid).expect("valid response");
        assert!(canonical.contains("managed:entry"));
        assert!(validate_response(&job(), r#"{"hello":"world"}"#).is_err());
        assert!(
            validate_response(&job(), &valid.replace("managed:entry", "managed:other")).is_err()
        );
    }

    #[test]
    fn managed_response_rejects_out_of_range_confidence() {
        let invalid = r#"{
            "refId":"managed:entry",
            "fileType":"document",
            "purpose":"report",
            "lifecycle":"active",
            "riskLevel":"low",
            "suggestedAction":"keep",
            "confidence":1.5,
            "reason":"metadata is consistent"
        }"#;
        assert!(validate_response(&job(), invalid).is_err());
    }
}
