//! Persistent worker for the Managed AI Index.
//!
//! Global search entries are metadata-only and remain searchable regardless of
//! this worker. The worker claims only enabled, non-directory entries that are
//! explicitly attached to an enabled managed scope. Its AI request contains
//! metadata only; it never reads file contents and never sends an unmanaged
//! path, hash, or identifier to a provider.

use super::models::{AI_JOB_BLOCKED_BY_POLICY, AI_JOB_FAILED, AI_JOB_PENDING};
use crate::ai::{
    schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderOptions},
    settings::{get_ai_settings_for_db, normalize_ai_settings, provider_for_settings, AISettings},
};
use crate::db::{Database, DbError};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde_json::json;
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

const MAX_ATTEMPTS: i64 = 3;
const MAX_STORED_RESPONSE_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone)]
pub(crate) struct ManagedAiJob {
    pub id: String,
    pub global_entry_id: String,
    pub input_fingerprint: String,
    pub provider: String,
    pub name: String,
    pub path: String,
    pub extension: String,
    pub size: i64,
    pub modified_at_fs: Option<i64>,
}

impl Database {
    pub(crate) fn reset_running_managed_ai_jobs(&self) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let now = crate::global_index::models::unix_now();
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'pending', started_at = NULL,
                last_error = 'worker_restarted'
            WHERE status = 'running'
              AND EXISTS (
                  SELECT 1 FROM managed_scopes scope
                  WHERE scope.id = ai_jobs.managed_scope_id
                    AND scope.enabled = 1
                    AND (
                        (ai_jobs.provider = 'local' AND scope.allow_local_ai = 1)
                        OR (ai_jobs.provider = 'cloud' AND scope.allow_cloud_ai = 1)
                    )
              )
            "#,
            [],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'blocked_by_policy', started_at = NULL,
                completed_at = ?1, last_error = 'managed_scope_policy_disabled'
            WHERE status = 'running'
            "#,
            params![now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_job_items
            SET status = 'pending', updated_at = ?1, last_error = 'worker_restarted'
            WHERE status = 'running'
              AND EXISTS (
                  SELECT 1 FROM ai_jobs job
                  WHERE job.id = ai_job_items.job_id
                    AND job.status = 'pending'
              )
            "#,
            params![now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_job_items
            SET status = 'blocked_by_policy', updated_at = ?1,
                last_error = 'managed_scope_policy_disabled'
            WHERE status = 'running'
              AND EXISTS (
                  SELECT 1 FROM ai_jobs job
                  WHERE job.id = ai_job_items.job_id
                    AND job.status = 'blocked_by_policy'
              )
            "#,
            params![now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_analysis_state
            SET status = 'pending', last_error = 'worker_restarted', updated_at = ?1
            WHERE status = 'running'
              AND EXISTS (
                  SELECT 1 FROM ai_jobs job
                  WHERE job.global_entry_id = ai_analysis_state.global_entry_id
                    AND job.status = 'pending'
              )
            "#,
            params![now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_analysis_state
            SET status = 'blocked_by_policy', last_error = 'managed_scope_policy_disabled', updated_at = ?1
            WHERE status = 'running'
              AND EXISTS (
                  SELECT 1 FROM ai_jobs job
                  WHERE job.global_entry_id = ai_analysis_state.global_entry_id
                    AND job.status = 'blocked_by_policy'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ai_jobs job
                  WHERE job.global_entry_id = ai_analysis_state.global_entry_id
                    AND job.status IN ('pending', 'running')
              )
            "#,
            params![now],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub(crate) fn claim_next_managed_ai_job(&self) -> Result<Option<ManagedAiJob>, DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
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
                WHERE job.status = 'pending'
                  AND scope.enabled = 1
                  AND managed.enabled = 1
                  AND entry.is_stale = 0
                  AND entry.is_directory = 0
                  AND (
                      (job.provider = 'local' AND scope.allow_local_ai = 1)
                      OR (job.provider = 'cloud' AND scope.allow_cloud_ai = 1)
                  )
                ORDER BY job.created_at ASC, job.id ASC
                LIMIT 1
                "#,
            )?;
            statement
                .query_row([], |row| {
                    Ok(ManagedAiJob {
                        id: row.get(0)?,
                        global_entry_id: row.get(1)?,
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
        let now = crate::global_index::models::unix_now();
        transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'running', attempt_count = attempt_count + 1,
                started_at = ?2, last_error = NULL
            WHERE id = ?1 AND status = 'pending'
            "#,
            params![job.id, now],
        )?;
        transaction.execute(
            "UPDATE ai_job_items SET status = 'running', updated_at = ?2, last_error = NULL WHERE job_id = ?1",
            params![job.id, now],
        )?;
        transaction.execute(
            "UPDATE ai_analysis_state SET status = 'running', last_error = NULL, updated_at = ?2 WHERE global_entry_id = ?1",
            params![job.global_entry_id, now],
        )?;
        transaction.commit()?;
        Ok(Some(job))
    }

    pub(crate) fn complete_managed_ai_job(
        &self,
        job: &ManagedAiJob,
        model: &str,
        response: &str,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let now = crate::global_index::models::unix_now();
        let updated = transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'completed', model = ?2, completed_at = ?3, last_error = NULL
            WHERE id = ?1 AND status = 'running'
              AND input_fingerprint = ?4
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
            SET status = 'completed',
                model = ?2,
                classification_json = CASE
                    WHEN user_corrected = 1 THEN classification_json
                    ELSE ?3
                END,
                content_summary = CASE
                    WHEN user_corrected = 1 THEN content_summary
                    ELSE 'metadata_only'
                END,
                last_error = NULL,
                updated_at = ?4
            WHERE global_entry_id = ?1
              AND input_fingerprint = ?5
            "#,
            params![
                job.global_entry_id,
                model,
                response,
                now,
                job.input_fingerprint
            ],
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
        let now = crate::global_index::models::unix_now();
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
            "UPDATE ai_analysis_state SET status = ?2, last_error = ?3, updated_at = ?4 WHERE global_entry_id = ?1",
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
        let now = crate::global_index::models::unix_now();
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
            "UPDATE ai_analysis_state SET status = ?2, last_error = ?3, updated_at = ?4 WHERE global_entry_id = ?1",
            params![job.global_entry_id, status, reason, now],
        )?;
        transaction.commit()?;
        Ok(())
    }
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
            .name("zen-canvas-managed-ai-worker".to_string())
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
    let _ = db.reset_running_managed_ai_jobs();
    let active = Arc::new(AtomicUsize::new(0));
    let mut handles = Vec::new();
    while !stop.load(Ordering::Acquire) {
        reap_finished(&mut handles);
        let settings = get_ai_settings_for_db(&db).map(normalize_ai_settings).ok();
        if let Some(settings) = settings.filter(|settings| settings.enabled) {
            let concurrency = settings.classification_concurrency.clamp(1, 4);
            while active.load(Ordering::Acquire) < concurrency && !stop.load(Ordering::Acquire) {
                let job = match db.claim_next_managed_ai_job() {
                    Ok(Some(job)) => job,
                    Ok(None) | Err(_) => break,
                };
                let db_for_job = db.clone();
                let active_for_job = active.clone();
                let settings_for_job = settings.clone();
                let job_for_thread = job.clone();
                active.fetch_add(1, Ordering::AcqRel);
                let handle = thread::Builder::new()
                    .name(format!("zen-canvas-managed-ai-{}", job.id))
                    .spawn(move || {
                        process_job(&db_for_job, &job_for_thread, &settings_for_job);
                        active_for_job.fetch_sub(1, Ordering::AcqRel);
                    });
                match handle {
                    Ok(handle) => {
                        handles.push(handle);
                    }
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

fn process_job(db: &Database, job: &ManagedAiJob, settings: &AISettings) {
    if !settings.enabled {
        let _ = db.block_managed_ai_job(job, "ai_disabled");
        return;
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

    let request = build_managed_ai_request(job, settings);
    let provider = provider_for_settings(settings);
    match provider.chat_json(request) {
        Ok(response) => {
            let response = response
                .chars()
                .take(MAX_STORED_RESPONSE_BYTES)
                .collect::<String>();
            if let Err(error) = db.complete_managed_ai_job(job, &settings.model, &response) {
                let _ = db
                    .fail_managed_ai_job(job, &sanitize_worker_error(error.to_string(), settings));
            }
        }
        Err(error) => {
            let error = sanitize_worker_error(error.to_string(), settings);
            let _ = db.fail_managed_ai_job(job, &error);
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
        metadata["parent"] = json!(std::path::Path::new(&job.path)
            .parent()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_default());
    }
    AIChatRequest {
        messages: vec![
            AIChatMessage {
                role: "system".to_string(),
                content: "Classify one explicitly managed file from metadata only. Return one JSON object with refId, fileType, purpose, lifecycle, riskLevel, suggestedAction, confidence, and reason. Never infer or request file contents.".to_string(),
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
    use crate::global_index::models::{
        AddManagedScopeRequest, GlobalEntryInput, GlobalVolume, UpdateManagedScopePolicyRequest,
        INDEX_STATUS_DISCOVERED, PROVIDER_WINDOWS_MFT_USN,
    };
    use rusqlite::Connection;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn test_db() -> (Database, PathBuf) {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "zen-canvas-managed-worker-{}-{id}.db",
            std::process::id()
        ));
        (
            Database::open(&path).expect("open managed worker database"),
            path,
        )
    }

    fn test_volume() -> GlobalVolume {
        GlobalVolume {
            id: "gv_worker".to_string(),
            platform: "windows".to_string(),
            stable_volume_id: "worker-volume".to_string(),
            display_name: "Worker volume".to_string(),
            mount_path: r"C:\Managed\".to_string(),
            filesystem_type: "ntfs".to_string(),
            drive_kind: "fixed".to_string(),
            enabled: true,
            provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
            index_status: INDEX_STATUS_DISCOVERED.to_string(),
            last_error: None,
            journal_id: None,
            journal_cursor: None,
            last_full_index_at: None,
            last_incremental_sync_at: None,
            entry_count: 0,
            created_at: 1,
            updated_at: 1,
        }
    }

    fn test_entry(path: &str, name: &str, is_directory: bool) -> GlobalEntryInput {
        GlobalEntryInput {
            volume_id: "gv_worker".to_string(),
            platform_file_id: format!("worker:{path}"),
            parent_platform_file_id: "worker:parent".to_string(),
            name: name.to_string(),
            path: path.to_string(),
            extension: if is_directory {
                String::new()
            } else {
                "txt".to_string()
            },
            is_directory,
            size: if is_directory { 0 } else { 42 },
            created_at_fs: Some(1),
            modified_at_fs: Some(2),
            file_attributes: 0,
            is_hidden: false,
            is_system: false,
            source_provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
            last_seen_at: 3,
        }
    }

    fn settings(provider: AIProviderKind) -> AISettings {
        AISettings {
            enabled: true,
            provider,
            api_key: if provider == AIProviderKind::OpenAICompatible {
                "secret-key".to_string()
            } else {
                String::new()
            },
            send_full_path: false,
            send_parent_path: true,
            ..AISettings::default()
        }
    }

    fn job() -> ManagedAiJob {
        ManagedAiJob {
            id: "job".to_string(),
            global_entry_id: "entry".to_string(),
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
    fn managed_request_contains_metadata_but_not_file_contents_or_hashes() {
        let request = build_managed_ai_request(&job(), &settings(AIProviderKind::Ollama));
        let content = &request.messages[1].content;
        assert!(content.contains("report.txt"));
        assert!(content.contains("Private"));
        assert!(!content.contains("fingerprint"));
        assert!(!content.contains("content"));
    }

    #[test]
    fn cloud_request_omits_path_when_user_disabled_path_sharing() {
        let mut settings = settings(AIProviderKind::OpenAICompatible);
        settings.send_parent_path = false;
        let request = build_managed_ai_request(
            &ManagedAiJob {
                provider: "cloud".to_string(),
                ..job()
            },
            &settings,
        );
        assert!(!request.messages[1].content.contains("C:\\Private"));
    }

    #[test]
    fn queue_claims_only_enabled_managed_files_and_excludes_directories() {
        let (db, path) = test_db();
        db.upsert_global_volume(&test_volume()).expect("volume");
        db.upsert_global_entries_batch(&[
            test_entry(r"C:\Managed\folder", "folder", true),
            test_entry(r"C:\Managed\report.txt", "report.txt", false),
        ])
        .expect("entries");
        db.add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Managed".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("scope");

        let job = db
            .claim_next_managed_ai_job()
            .expect("claim")
            .expect("file job");
        assert_eq!(job.name, "report.txt");
        assert!(db
            .claim_next_managed_ai_job()
            .expect("second claim")
            .is_none());
        let conn = Connection::open(&path).expect("inspect queue");
        let directory_jobs: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ai_jobs job JOIN global_entries entry ON entry.id = job.global_entry_id WHERE entry.is_directory = 1",
                [],
                |row| row.get(0),
            )
            .expect("directory jobs");
        assert_eq!(directory_jobs, 0);
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn failed_jobs_retry_then_become_terminal_after_three_attempts() {
        let (db, path) = test_db();
        db.upsert_global_volume(&test_volume()).expect("volume");
        db.upsert_global_entries_batch(&[test_entry(
            r"C:\Managed\report.txt",
            "report.txt",
            false,
        )])
        .expect("entry");
        db.add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Managed".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("scope");

        for attempt in 0..3 {
            let job = db
                .claim_next_managed_ai_job()
                .expect("claim")
                .expect("retryable job");
            db.fail_managed_ai_job(&job, "transient_provider_error")
                .expect("record failure");
            let conn = Connection::open(&path).expect("inspect retry");
            let status: String = conn
                .query_row(
                    "SELECT status FROM ai_jobs WHERE id = ?1",
                    params![job.id],
                    |row| row.get(0),
                )
                .expect("job status");
            let expected = if attempt == 2 {
                AI_JOB_FAILED
            } else {
                AI_JOB_PENDING
            };
            assert_eq!(status, expected);
            drop(conn);
        }
        assert!(db
            .claim_next_managed_ai_job()
            .expect("terminal claim")
            .is_none());
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn restarting_worker_requeues_running_jobs() {
        let (db, path) = test_db();
        db.upsert_global_volume(&test_volume()).expect("volume");
        db.upsert_global_entries_batch(&[test_entry(
            r"C:\Managed\report.txt",
            "report.txt",
            false,
        )])
        .expect("entry");
        db.add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Managed".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("scope");
        let running = db.claim_next_managed_ai_job().expect("claim").expect("job");
        db.reset_running_managed_ai_jobs().expect("reset");
        let resumed = db
            .claim_next_managed_ai_job()
            .expect("reclaim")
            .expect("restarted job");
        assert_eq!(resumed.id, running.id);
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn restarting_worker_blocks_jobs_that_lost_scope_policy() {
        let (db, path) = test_db();
        db.upsert_global_volume(&test_volume()).expect("volume");
        db.upsert_global_entries_batch(&[test_entry(
            r"C:\Managed\report.txt",
            "report.txt",
            false,
        )])
        .expect("entry");
        let scope = db
            .add_managed_scope(AddManagedScopeRequest {
                path: r"C:\Managed".to_string(),
                global_entry_id: None,
                enabled: true,
                allow_local_ai: true,
                allow_cloud_ai: false,
            })
            .expect("scope");
        let running = db.claim_next_managed_ai_job().expect("claim").expect("job");
        db.update_managed_scope_policy(UpdateManagedScopePolicyRequest {
            id: scope.id,
            enabled: Some(false),
            allow_local_ai: None,
            allow_cloud_ai: None,
        })
        .expect("disable scope");

        db.reset_running_managed_ai_jobs().expect("reset");
        let conn = Connection::open(&path).expect("inspect blocked job");
        let status: String = conn
            .query_row(
                "SELECT status FROM ai_jobs WHERE id = ?1",
                params![running.id],
                |row| row.get(0),
            )
            .expect("job status");
        assert_eq!(status, AI_JOB_BLOCKED_BY_POLICY);
        let item_status: String = conn
            .query_row(
                "SELECT status FROM ai_job_items WHERE job_id = ?1",
                params![running.id],
                |row| row.get(0),
            )
            .expect("item status");
        assert_eq!(item_status, AI_JOB_BLOCKED_BY_POLICY);
        db.complete_managed_ai_job(&running, "model", "should_not_apply")
            .expect("stale completion is harmless");
        let state_status: String = conn
            .query_row(
                "SELECT status FROM ai_analysis_state WHERE global_entry_id = ?1",
                params![running.global_entry_id],
                |row| row.get(0),
            )
            .expect("analysis state status");
        assert_eq!(state_status, AI_JOB_BLOCKED_BY_POLICY);
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(path);
    }
}
