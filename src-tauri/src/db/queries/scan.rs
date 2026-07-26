use super::super::*;
use super::*;
use crate::ids::new_job_id;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};

const ACTIVE_RUN_STATUSES: &str = "'queued', 'running', 'cancelling'";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedScanRequest {
    pub roots: Vec<String>,
    #[serde(default)]
    pub request_key: Option<String>,
    #[serde(default)]
    pub dedupe: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootDto {
    pub id: String,
    pub normalized_path: String,
    pub display_name: String,
    pub source_kind: String,
    pub enabled: bool,
    pub health_status: String,
    pub current_generation: i64,
    pub active_run_id: Option<String>,
    pub active_generation: Option<i64>,
    pub revision: i64,
    pub last_successful_generation: Option<i64>,
    pub last_full_scan_at: Option<i64>,
    pub needs_reconciliation: bool,
    pub last_error_code: Option<String>,
    pub last_error_message: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSessionRootDto {
    pub session_id: String,
    pub requested_index: i64,
    pub requested_path: String,
    pub normalized_requested_path: String,
    pub resolution: String,
    pub effective_root_id: Option<String>,
    pub effective_path: Option<String>,
    pub effective_index: Option<i64>,
    pub run_id: Option<String>,
    pub status: String,
    pub reason: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRunDto {
    pub id: String,
    pub scan_root_id: String,
    pub root_path: String,
    pub generation: i64,
    pub parent_session_id: Option<String>,
    pub status: String,
    pub phase: String,
    pub scanned_files: i64,
    pub scanned_directories: i64,
    pub processed_bytes: i64,
    pub warnings_count: i64,
    pub errors_count: i64,
    pub metadata_error_count: i64,
    pub coverage_error_count: i64,
    pub coverage_complete: bool,
    pub stale_reconciliation_allowed: bool,
    pub cancel_requested: bool,
    pub revision: i64,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub last_checkpoint_at: Option<i64>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub result_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSessionDto {
    pub id: String,
    pub request_key: Option<String>,
    pub canonical_request_hash: Option<String>,
    pub status: String,
    pub phase: String,
    pub cancel_requested: bool,
    pub requested_root_count: i64,
    pub effective_root_count: i64,
    pub completed_root_count: i64,
    pub failed_root_count: i64,
    pub cancelled_root_count: i64,
    pub covered_root_count: i64,
    pub unstarted_root_count: i64,
    pub dedupe_requested: bool,
    pub dedupe_dispatch_state: String,
    pub dedupe_attempt_count: i64,
    pub dedupe_job_id: Option<String>,
    pub dedupe_last_error: Option<String>,
    pub scanned_files: i64,
    pub scanned_directories: i64,
    pub warnings_count: i64,
    pub errors_count: i64,
    pub revision: i64,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub last_checkpoint_at: Option<i64>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub result_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub roots: Vec<ScanSessionRootDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedScanStartDto {
    pub session: ScanSessionDto,
    pub runs: Vec<ScanRunDto>,
}

#[derive(Debug, Clone)]
pub(crate) struct ScanAdmissionOptions {
    pub request: ManagedScanRequest,
    pub run_id_override: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ScanAdmission {
    pub session: ScanSessionDto,
    pub runs: Vec<ScanRunDto>,
    pub created: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct ScanRunRecord {
    pub dto: ScanRunDto,
    pub lease_token: String,
    pub root_revision: i64,
    pub root_active_run_id: Option<String>,
    pub root_active_generation: Option<i64>,
    pub root_health_status: String,
}

#[derive(Debug, Clone)]
struct ScanRootSeed {
    id: String,
    path: String,
    current_generation: i64,
    revision: i64,
    active_run_id: Option<String>,
}

#[derive(Debug, Clone)]
struct ResolvedRequestedRoot {
    requested_index: i64,
    requested_path: String,
    normalized_path: String,
    key: String,
    resolution: &'static str,
    effective_key: Option<String>,
    effective_path: Option<String>,
    effective_index: Option<i64>,
    status: &'static str,
    reason: Option<String>,
}

#[derive(Debug, Clone)]
struct EffectiveRoot {
    key: String,
    path: String,
    first_index: i64,
}

impl Database {
    pub(crate) fn admit_managed_scan(
        &self,
        options: &ScanAdmissionOptions,
    ) -> Result<ScanAdmission, DbError> {
        let resolved = resolve_requested_roots(&options.request.roots);
        let canonical_hash = canonical_request_hash(&resolved, options.request.dedupe)?;
        let request_key = options
            .request
            .request_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;

        if let Some(request_key) = request_key.as_deref() {
            if let Some((session_id, existing_hash)) = tx
                .query_row(
                    "SELECT id, canonical_request_hash FROM scan_sessions WHERE request_key = ?1",
                    params![request_key],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
                )
                .optional()?
            {
                if existing_hash.as_deref() != Some(canonical_hash.as_str()) {
                    return Err(DbError::Validation(format!(
                        "Scan request key already belongs to a different canonical request: {request_key}"
                    )));
                }
                let admission = load_admission_tx(&tx, &session_id, false)?;
                tx.commit()?;
                return Ok(admission);
            }
        }

        let mut roots_by_key = HashMap::new();
        for effective in effective_roots(&resolved) {
            let seed = ensure_scan_root_tx(&tx, &effective.path)?;
            if seed.active_run_id.is_some() {
                return Err(DbError::Validation(format!(
                    "Scan root already has an active run: {}",
                    effective.path
                )));
            }
            roots_by_key.insert(effective.key.clone(), seed);
        }

        let now = current_unix_seconds();
        let session_id = new_job_id("scan-session");
        tx.execute(
            r#"
            INSERT INTO scan_sessions (
                id, request_key, canonical_request_hash, status, phase,
                requested_root_count, effective_root_count, dedupe_requested,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, 'queued', 'preparing', ?4, ?5, ?6, ?7, ?7)
            "#,
            params![
                session_id,
                request_key,
                canonical_hash,
                resolved.len() as i64,
                roots_by_key.len() as i64,
                bool_to_i64(options.request.dedupe),
                now,
            ],
        )?;

        for mapping in &resolved {
            let root_seed = mapping
                .effective_key
                .as_ref()
                .and_then(|key| roots_by_key.get(key));
            tx.execute(
                r#"
                INSERT INTO scan_session_roots (
                    session_id, requested_index, requested_path, normalized_requested_path,
                    resolution, effective_root_id, effective_path, effective_index,
                    status, reason, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
                "#,
                params![
                    session_id,
                    mapping.requested_index,
                    mapping.requested_path,
                    mapping.normalized_path,
                    mapping.resolution,
                    root_seed.map(|seed| seed.id.as_str()),
                    mapping.effective_path,
                    mapping.effective_index,
                    mapping.status,
                    mapping.reason,
                    now,
                ],
            )?;
        }

        for effective in effective_roots(&resolved) {
            let root_seed = roots_by_key
                .get(&effective.key)
                .expect("effective root was inserted into the admission map");
            let generation = root_seed.current_generation + 1;
            let run_id = if effective.first_index == 0 {
                options
                    .run_id_override
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| new_job_id("scan-run"))
            } else {
                new_job_id("scan-run")
            };
            let lease_token = new_job_id("scan-lease");
            tx.execute(
                r#"
                INSERT INTO scan_runs (
                    id, scan_root_id, generation, parent_session_id, lease_token,
                    status, phase, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, 'queued', 'preparing', ?6, ?6)
                "#,
                params![
                    run_id,
                    root_seed.id,
                    generation,
                    session_id,
                    lease_token,
                    now,
                ],
            )?;
            let changed = tx.execute(
                r#"
                UPDATE scan_roots
                SET current_generation = ?1,
                    active_run_id = ?2,
                    active_generation = ?1,
                    health_status = 'scanning',
                    revision = revision + 1,
                    updated_at = ?3
                WHERE id = ?4
                  AND revision = ?5
                  AND active_run_id IS NULL
                  AND active_generation IS NULL
                "#,
                params![generation, run_id, now, root_seed.id, root_seed.revision],
            )?;
            if changed != 1 {
                return Err(DbError::Validation(format!(
                    "Scan root lease admission CAS failed: {}",
                    effective.path
                )));
            }
            tx.execute(
                r#"
                UPDATE scan_session_roots
                SET run_id = ?1, updated_at = ?2
                WHERE session_id = ?3 AND effective_root_id = ?4
                "#,
                params![run_id, now, session_id, root_seed.id],
            )?;
        }

        let admission = load_admission_tx(&tx, &session_id, true)?;
        tx.commit()?;
        Ok(admission)
    }

    pub(crate) fn get_scan_run_record(&self, run_id: &str) -> Result<ScanRunRecord, DbError> {
        let conn = self.conn()?;
        load_scan_run_record(&conn, run_id)
    }

    pub(crate) fn get_scan_session(&self, session_id: &str) -> Result<ScanSessionDto, DbError> {
        let conn = self.conn()?;
        load_session(&conn, session_id)
    }

    pub(crate) fn list_scan_runs(
        &self,
        session_id: Option<&str>,
        root_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<ScanRunDto>, DbError> {
        let conn = self.conn()?;
        let limit = i64::try_from(limit.clamp(1, 500)).unwrap_or(500);
        let mut statement = conn.prepare(&format!(
            "{SCAN_RUN_SELECT} WHERE (?1 IS NULL OR run.parent_session_id = ?1) \
             AND (?2 IS NULL OR run.scan_root_id = ?2) \
             ORDER BY run.created_at DESC LIMIT ?3"
        ))?;
        let rows = statement
            .query_map(params![session_id, root_id, limit], scan_run_dto_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub(crate) fn list_scan_roots(&self) -> Result<Vec<ScanRootDto>, DbError> {
        let conn = self.conn()?;
        let mut statement = conn.prepare(
            r#"
            SELECT id, normalized_path, display_name, source_kind, enabled, health_status,
                   current_generation, active_run_id, active_generation, revision,
                   last_successful_generation, last_full_scan_at, needs_reconciliation,
                   last_error_code, last_error_message, created_at, updated_at
            FROM scan_roots
            ORDER BY normalized_path
            "#,
        )?;
        let rows = statement
            .query_map([], scan_root_from_row)
            .map_err(DbError::from)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub(crate) fn get_scan_root_health(
        &self,
        root_id: Option<&str>,
        path: Option<&str>,
    ) -> Result<ScanRootDto, DbError> {
        let conn = self.conn()?;
        let normalized_path = path.map(normalize_scan_root_path);
        conn.query_row(
            r#"
            SELECT id, normalized_path, display_name, source_kind, enabled, health_status,
                   current_generation, active_run_id, active_generation, revision,
                   last_successful_generation, last_full_scan_at, needs_reconciliation,
                   last_error_code, last_error_message, created_at, updated_at
            FROM scan_roots
            WHERE (?1 IS NOT NULL AND id = ?1)
               OR (?2 IS NOT NULL AND normalized_path = ?2)
            ORDER BY id
            LIMIT 1
            "#,
            params![root_id, normalized_path],
            scan_root_from_row,
        )
        .map_err(DbError::from)
    }
}

fn ensure_scan_root_tx(tx: &Transaction<'_>, path: &str) -> Result<ScanRootSeed, DbError> {
    let normalized_path = normalize_scan_root_path(path);
    if normalized_path.is_empty() {
        return Err(DbError::Validation(
            "Scan root path cannot be empty.".to_string(),
        ));
    }
    if let Some(seed) = tx
        .query_row(
            r#"
            SELECT id, normalized_path, current_generation, revision, active_run_id
            FROM scan_roots WHERE normalized_path = ?1
            "#,
            params![normalized_path],
            |row| {
                Ok(ScanRootSeed {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    current_generation: row.get(2)?,
                    revision: row.get(3)?,
                    active_run_id: row.get(4)?,
                })
            },
        )
        .optional()?
    {
        return Ok(seed);
    }

    let now = current_unix_seconds();
    let id = new_job_id("scan-root");
    let display_name = scan_root_display_name(&normalized_path);
    tx.execute(
        r#"
        INSERT INTO scan_roots (
            id, normalized_path, display_name, source_kind, created_at, updated_at
        ) VALUES (?1, ?2, ?3, 'file_library', ?4, ?4)
        "#,
        params![id, normalized_path, display_name, now],
    )?;
    Ok(ScanRootSeed {
        id,
        path: normalized_path,
        current_generation: 0,
        revision: 0,
        active_run_id: None,
    })
}

fn load_admission_tx(
    tx: &Transaction<'_>,
    session_id: &str,
    created: bool,
) -> Result<ScanAdmission, DbError> {
    let session = load_session(tx, session_id)?;
    let mut statement = tx.prepare(&format!(
        "{SCAN_RUN_SELECT} WHERE run.parent_session_id = ?1 ORDER BY run.created_at, run.id"
    ))?;
    let runs = statement
        .query_map(params![session_id], scan_run_dto_from_row)
        .map_err(DbError::from)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ScanAdmission {
        session,
        runs,
        created,
    })
}

fn load_session(conn: &Connection, session_id: &str) -> Result<ScanSessionDto, DbError> {
    let session = conn.query_row(
        r#"
        SELECT id, request_key, canonical_request_hash, status, phase, cancel_requested,
               requested_root_count, effective_root_count, completed_root_count,
               failed_root_count, cancelled_root_count, covered_root_count,
               unstarted_root_count, dedupe_requested, dedupe_dispatch_state,
               dedupe_attempt_count, dedupe_job_id, dedupe_last_error, scanned_files,
               scanned_directories, warnings_count, errors_count, revision, started_at,
               finished_at, last_checkpoint_at, error_code, error_message, result_json,
               created_at, updated_at
        FROM scan_sessions WHERE id = ?1
        "#,
        params![session_id],
        scan_session_from_row,
    )?;
    let mut mappings_statement = conn.prepare(
        r#"
        SELECT session_id, requested_index, requested_path, normalized_requested_path,
               resolution, effective_root_id, effective_path, effective_index, run_id,
               status, reason, created_at, updated_at
        FROM scan_session_roots
        WHERE session_id = ?1
        ORDER BY requested_index
        "#,
    )?;
    let roots = mappings_statement
        .query_map(params![session_id], scan_session_root_from_row)
        .map_err(DbError::from)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ScanSessionDto { roots, ..session })
}

fn load_scan_run_record(conn: &Connection, run_id: &str) -> Result<ScanRunRecord, DbError> {
    conn.query_row(
        &format!("{SCAN_RUN_SELECT} WHERE run.id = ?1"),
        params![run_id],
        scan_run_record_from_row,
    )
    .map_err(DbError::from)
}

const SCAN_RUN_SELECT: &str = r#"
    SELECT run.id, run.scan_root_id, root.normalized_path, run.generation,
           run.parent_session_id, run.lease_token, run.status, run.phase,
           run.scanned_files, run.scanned_directories, run.processed_bytes,
           run.warnings_count, run.errors_count, run.metadata_error_count,
           run.coverage_error_count, run.coverage_complete,
           run.stale_reconciliation_allowed, run.cancel_requested, run.revision,
           run.started_at, run.finished_at, run.last_checkpoint_at, run.error_code,
           run.error_message, run.result_json, run.created_at, run.updated_at,
           root.revision, root.active_run_id, root.active_generation, root.health_status
    FROM scan_runs AS run
    JOIN scan_roots AS root ON root.id = run.scan_root_id
"#;

fn scan_run_dto_from_row(row: &Row<'_>) -> rusqlite::Result<ScanRunDto> {
    Ok(scan_run_record_from_row(row)?.dto)
}

fn scan_run_record_from_row(row: &Row<'_>) -> rusqlite::Result<ScanRunRecord> {
    Ok(ScanRunRecord {
        dto: ScanRunDto {
            id: row.get(0)?,
            scan_root_id: row.get(1)?,
            root_path: row.get(2)?,
            generation: row.get(3)?,
            parent_session_id: row.get(4)?,
            status: row.get(6)?,
            phase: row.get(7)?,
            scanned_files: row.get(8)?,
            scanned_directories: row.get(9)?,
            processed_bytes: row.get(10)?,
            warnings_count: row.get(11)?,
            errors_count: row.get(12)?,
            metadata_error_count: row.get(13)?,
            coverage_error_count: row.get(14)?,
            coverage_complete: row.get::<_, i64>(15)? != 0,
            stale_reconciliation_allowed: row.get::<_, i64>(16)? != 0,
            cancel_requested: row.get::<_, i64>(17)? != 0,
            revision: row.get(18)?,
            started_at: row.get(19)?,
            finished_at: row.get(20)?,
            last_checkpoint_at: row.get(21)?,
            error_code: row.get(22)?,
            error_message: row.get(23)?,
            result_json: row.get(24)?,
            created_at: row.get(25)?,
            updated_at: row.get(26)?,
        },
        lease_token: row.get(5)?,
        root_revision: row.get(27)?,
        root_active_run_id: row.get(28)?,
        root_active_generation: row.get(29)?,
        root_health_status: row.get(30)?,
    })
}

fn scan_root_from_row(row: &Row<'_>) -> rusqlite::Result<ScanRootDto> {
    Ok(ScanRootDto {
        id: row.get(0)?,
        normalized_path: row.get(1)?,
        display_name: row.get(2)?,
        source_kind: row.get(3)?,
        enabled: row.get::<_, i64>(4)? != 0,
        health_status: row.get(5)?,
        current_generation: row.get(6)?,
        active_run_id: row.get(7)?,
        active_generation: row.get(8)?,
        revision: row.get(9)?,
        last_successful_generation: row.get(10)?,
        last_full_scan_at: row.get(11)?,
        needs_reconciliation: row.get::<_, i64>(12)? != 0,
        last_error_code: row.get(13)?,
        last_error_message: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

fn scan_session_from_row(row: &Row<'_>) -> rusqlite::Result<ScanSessionDto> {
    Ok(ScanSessionDto {
        id: row.get(0)?,
        request_key: row.get(1)?,
        canonical_request_hash: row.get(2)?,
        status: row.get(3)?,
        phase: row.get(4)?,
        cancel_requested: row.get::<_, i64>(5)? != 0,
        requested_root_count: row.get(6)?,
        effective_root_count: row.get(7)?,
        completed_root_count: row.get(8)?,
        failed_root_count: row.get(9)?,
        cancelled_root_count: row.get(10)?,
        covered_root_count: row.get(11)?,
        unstarted_root_count: row.get(12)?,
        dedupe_requested: row.get::<_, i64>(13)? != 0,
        dedupe_dispatch_state: row.get(14)?,
        dedupe_attempt_count: row.get(15)?,
        dedupe_job_id: row.get(16)?,
        dedupe_last_error: row.get(17)?,
        scanned_files: row.get(18)?,
        scanned_directories: row.get(19)?,
        warnings_count: row.get(20)?,
        errors_count: row.get(21)?,
        revision: row.get(22)?,
        started_at: row.get(23)?,
        finished_at: row.get(24)?,
        last_checkpoint_at: row.get(25)?,
        error_code: row.get(26)?,
        error_message: row.get(27)?,
        result_json: row.get(28)?,
        created_at: row.get(29)?,
        updated_at: row.get(30)?,
        roots: Vec::new(),
    })
}

fn scan_session_root_from_row(row: &Row<'_>) -> rusqlite::Result<ScanSessionRootDto> {
    Ok(ScanSessionRootDto {
        session_id: row.get(0)?,
        requested_index: row.get(1)?,
        requested_path: row.get(2)?,
        normalized_requested_path: row.get(3)?,
        resolution: row.get(4)?,
        effective_root_id: row.get(5)?,
        effective_path: row.get(6)?,
        effective_index: row.get(7)?,
        run_id: row.get(8)?,
        status: row.get(9)?,
        reason: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn resolve_requested_roots(paths: &[String]) -> Vec<ResolvedRequestedRoot> {
    let mut resolved = Vec::with_capacity(paths.len());
    let mut first_by_key = HashMap::<String, (i64, String)>::new();
    for (index, requested_path) in paths.iter().enumerate() {
        let requested_path = requested_path.trim().to_string();
        let normalized_path = normalize_scan_root_path(&requested_path);
        let key = root_identity_key(&normalized_path);
        let invalid = normalized_path.is_empty();
        if !invalid {
            first_by_key
                .entry(key.clone())
                .or_insert((index as i64, normalized_path.clone()));
        }
        resolved.push(ResolvedRequestedRoot {
            requested_index: index as i64,
            requested_path,
            normalized_path,
            key,
            resolution: if invalid { "invalid" } else { "effective" },
            effective_key: None,
            effective_path: None,
            effective_index: None,
            status: if invalid { "invalid" } else { "queued" },
            reason: invalid.then(|| "empty_root_path".to_string()),
        });
    }

    let unique = first_by_key
        .iter()
        .map(|(key, (first_index, path))| EffectiveRoot {
            key: key.clone(),
            path: path.clone(),
            first_index: *first_index,
        })
        .collect::<Vec<_>>();
    let effective = unique
        .iter()
        .filter(|candidate| {
            !unique.iter().any(|other| {
                other.key != candidate.key && is_nested_root(&other.path, &candidate.path)
            })
        })
        .cloned()
        .collect::<Vec<_>>();
    let mut effective = effective;
    effective.sort_by_key(|root| root.first_index);
    let effective_by_key = effective
        .iter()
        .enumerate()
        .map(|(index, root)| (root.key.clone(), (root.path.clone(), index as i64)))
        .collect::<HashMap<_, _>>();

    for item in &mut resolved {
        if item.resolution == "invalid" {
            continue;
        }
        let first_index = first_by_key
            .get(&item.key)
            .map(|value| value.0)
            .unwrap_or(item.requested_index);
        let is_duplicate = first_index != item.requested_index;
        let effective_key = effective_by_key
            .get(&item.key)
            .map(|_| item.key.clone())
            .or_else(|| {
                effective
                    .iter()
                    .filter(|root| is_nested_root(&root.path, &item.normalized_path))
                    .max_by_key(|root| root.path.len())
                    .map(|root| root.key.clone())
            });
        let Some(effective_key) = effective_key else {
            item.resolution = "invalid";
            item.status = "invalid";
            item.reason = Some("no_effective_root".to_string());
            continue;
        };
        let (effective_path, effective_index) = effective_by_key
            .get(&effective_key)
            .expect("effective mapping was computed from the effective set");
        item.effective_key = Some(effective_key);
        item.effective_path = Some(effective_path.clone());
        item.effective_index = Some(*effective_index);
        if is_duplicate {
            item.resolution = "duplicate_requested";
            item.status = "duplicate";
            item.reason = Some("same_normalized_root_requested_more_than_once".to_string());
        } else if first_by_key.contains_key(&item.key) && effective_by_key.contains_key(&item.key) {
            item.resolution = "effective";
            item.status = "queued";
        } else {
            item.resolution = "nested_under_effective";
            item.status = "nested";
            item.reason = Some("covered_by_effective_ancestor".to_string());
        }
    }
    resolved
}

fn effective_roots(resolved: &[ResolvedRequestedRoot]) -> Vec<EffectiveRoot> {
    let mut roots = resolved
        .iter()
        .filter(|item| item.resolution == "effective")
        .map(|item| EffectiveRoot {
            key: item.key.clone(),
            path: item.normalized_path.clone(),
            first_index: item.requested_index,
        })
        .collect::<Vec<_>>();
    roots.sort_by_key(|root| root.first_index);
    let mut seen = HashSet::new();
    roots.retain(|root| seen.insert(root.key.clone()));
    roots
}

fn canonical_request_hash(
    resolved: &[ResolvedRequestedRoot],
    dedupe: bool,
) -> Result<String, DbError> {
    let roots = resolved
        .iter()
        .map(|root| root.normalized_path.clone())
        .collect::<Vec<_>>();
    let canonical = serde_json::json!({ "roots": roots, "dedupe": dedupe });
    Ok(blake3::hash(serde_json::to_string(&canonical)?.as_bytes())
        .to_hex()
        .to_string())
}

pub(crate) fn normalize_scan_root_path(path: &str) -> String {
    let trimmed = trim_trailing_path_separators(path.trim());
    normalize_path_text(trimmed)
}

fn root_identity_key(path: &str) -> String {
    if cfg!(windows) {
        path.to_ascii_lowercase()
    } else {
        path.to_string()
    }
}

fn is_nested_root(parent: &str, child: &str) -> bool {
    let parent = root_identity_key(&normalize_scan_root_path(parent));
    let child = root_identity_key(&normalize_scan_root_path(child));
    child != parent
        && child
            .strip_prefix(&parent)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn scan_root_display_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or(path)
        .to_string()
}
