use crate::db::{Database, DbError};
use rusqlite::params;
use serde::Serialize;
use std::{
    fs::File,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Runtime};
use thiserror::Error;

pub const DEDUPE_PROGRESS_EVENT: &str = "dedupe-progress";
pub const DEDUPE_COMPLETE_EVENT: &str = "dedupe-complete";

const DEDUPE_BATCH_SIZE: usize = 500;
const DEDUPE_EMIT_INTERVAL: Duration = Duration::from_millis(200);

#[derive(Debug, Error)]
pub enum DedupeError {
    #[error(transparent)]
    Db(#[from] DbError),
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error at {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("event emit failed: {0}")]
    Event(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DedupeProgressPayload {
    pub processed: u64,
    pub total: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DedupeCompletePayload {
    pub candidate_files: u64,
    pub hashed_files: u64,
    pub duplicate_files: i64,
    pub skipped_files: u64,
    pub error_files: u64,
    pub duration_ms: u128,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DedupeSummary {
    pub candidate_files: u64,
    pub hashed_files: u64,
    pub duplicate_files: i64,
    pub skipped_files: u64,
    pub error_files: u64,
    pub duration_ms: u128,
}

impl DedupeSummary {
    fn complete_payload(&self) -> DedupeCompletePayload {
        DedupeCompletePayload {
            candidate_files: self.candidate_files,
            hashed_files: self.hashed_files,
            duplicate_files: self.duplicate_files,
            skipped_files: self.skipped_files,
            error_files: self.error_files,
            duration_ms: self.duration_ms,
            success: true,
            error: None,
        }
    }
}

pub trait ContentHasher {
    fn hash_file(&mut self, path: &Path) -> Result<String, DedupeError>;
}

pub struct Blake3ContentHasher;

impl ContentHasher for Blake3ContentHasher {
    fn hash_file(&mut self, path: &Path) -> Result<String, DedupeError> {
        hash_file_blake3(path)
    }
}

pub trait DedupeEventEmitter {
    fn emit_progress(&self, payload: &DedupeProgressPayload) -> Result<(), DedupeError>;
    fn emit_complete(&self, payload: &DedupeCompletePayload) -> Result<(), DedupeError>;
}

pub struct NoopDedupeEventEmitter;

impl DedupeEventEmitter for NoopDedupeEventEmitter {
    fn emit_progress(&self, _payload: &DedupeProgressPayload) -> Result<(), DedupeError> {
        Ok(())
    }

    fn emit_complete(&self, _payload: &DedupeCompletePayload) -> Result<(), DedupeError> {
        Ok(())
    }
}

pub struct TauriDedupeEventEmitter<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriDedupeEventEmitter<R> {
    fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> DedupeEventEmitter for TauriDedupeEventEmitter<R> {
    fn emit_progress(&self, payload: &DedupeProgressPayload) -> Result<(), DedupeError> {
        self.app
            .emit(DEDUPE_PROGRESS_EVENT, payload.clone())
            .map_err(|error| DedupeError::Event(error.to_string()))
    }

    fn emit_complete(&self, payload: &DedupeCompletePayload) -> Result<(), DedupeError> {
        self.app
            .emit(DEDUPE_COMPLETE_EVENT, payload.clone())
            .map_err(|error| DedupeError::Event(error.to_string()))
    }
}

struct CandidateSize {
    size: i64,
    count: u64,
}

struct CandidateFile {
    id: String,
    path: PathBuf,
}

pub fn run_duplicate_detection(
    db: &Database,
    emitter: &impl DedupeEventEmitter,
) -> Result<DedupeSummary, DedupeError> {
    let mut hasher = Blake3ContentHasher;
    run_duplicate_detection_with_hasher(db, emitter, &mut hasher)
}

pub fn run_duplicate_detection_with_hasher(
    db: &Database,
    emitter: &impl DedupeEventEmitter,
    hasher: &mut impl ContentHasher,
) -> Result<DedupeSummary, DedupeError> {
    let started_at = Instant::now();
    let candidate_sizes = candidate_sizes(db)?;
    let total_candidates = candidate_sizes
        .iter()
        .map(|candidate| candidate.count)
        .sum::<u64>();
    let mut progress = DedupeProgress::new(total_candidates);
    let mut updates = Vec::with_capacity(DEDUPE_BATCH_SIZE);
    let mut processed = 0_u64;
    let mut hashed = 0_u64;
    let skipped = 0_u64;
    let mut errors = 0_u64;

    for candidate_size in candidate_sizes {
        for candidate in candidate_files_for_size(db, candidate_size.size)? {
            processed += 1;
            match hasher.hash_file(&candidate.path) {
                Ok(hash) => {
                    hashed += 1;
                    updates.push((candidate.id, hash));
                    if updates.len() >= DEDUPE_BATCH_SIZE {
                        flush_hash_updates(db, &mut updates)?;
                    }
                }
                Err(DedupeError::Io { .. }) => {
                    errors += 1;
                }
                Err(error) => return Err(error),
            }

            progress.maybe_emit(emitter, processed)?;
        }
    }

    flush_hash_updates(db, &mut updates)?;
    progress.emit_final(emitter, processed)?;
    let duplicate_files = duplicate_file_count(db)?;
    let summary = DedupeSummary {
        candidate_files: total_candidates,
        hashed_files: hashed,
        duplicate_files,
        skipped_files: skipped,
        error_files: errors,
        duration_ms: started_at.elapsed().as_millis(),
    };
    emitter.emit_complete(&summary.complete_payload())?;
    Ok(summary)
}

pub fn spawn_duplicate_detection<R: Runtime>(app: AppHandle<R>, db: Database) {
    tauri::async_runtime::spawn_blocking(move || {
        let emitter = TauriDedupeEventEmitter::new(app);
        if let Err(error) = run_duplicate_detection(&db, &emitter) {
            let payload = DedupeCompletePayload {
                candidate_files: 0,
                hashed_files: 0,
                duplicate_files: 0,
                skipped_files: 0,
                error_files: 0,
                duration_ms: 0,
                success: false,
                error: Some(error.to_string()),
            };
            if let Err(emit_error) = emitter.emit_complete(&payload) {
                eprintln!("Dedupe complete event failed: {emit_error}");
            }
        }
    });
}

fn hash_file_blake3(path: &Path) -> Result<String, DedupeError> {
    let mut file = File::open(path).map_err(|source| DedupeError::Io {
        path: path.to_string_lossy().into_owned(),
        source,
    })?;
    let mut hasher = blake3::Hasher::new();
    hasher
        .update_reader(&mut file)
        .map_err(|source| DedupeError::Io {
            path: path.to_string_lossy().into_owned(),
            source,
        })?;

    Ok(hasher.finalize().to_hex().to_string())
}

fn candidate_sizes(db: &Database) -> Result<Vec<CandidateSize>, DedupeError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT size, COUNT(*)
        FROM files
        WHERE is_dir = 0
          AND is_stale = 0
          AND size > 0
          AND content_hash = ''
        GROUP BY size
        HAVING COUNT(*) > 1
        ORDER BY size ASC
        "#,
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CandidateSize {
            size: row.get(0)?,
            count: row.get::<_, i64>(1).map(|count| count.max(0) as u64)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(DedupeError::from)
}

fn candidate_files_for_size(db: &Database, size: i64) -> Result<Vec<CandidateFile>, DedupeError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, path
        FROM files
        WHERE is_dir = 0
          AND is_stale = 0
          AND size = ?1
          AND content_hash = ''
        ORDER BY path COLLATE NOCASE ASC
        "#,
    )?;
    let rows = stmt.query_map(params![size], |row| {
        let path = row.get::<_, String>(1)?;
        Ok(CandidateFile {
            id: row.get(0)?,
            path: PathBuf::from(path),
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(DedupeError::from)
}

fn flush_hash_updates(
    db: &Database,
    updates: &mut Vec<(String, String)>,
) -> Result<(), DedupeError> {
    if updates.is_empty() {
        return Ok(());
    }

    let mut conn = db.conn()?;
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare("UPDATE files SET content_hash = ?2 WHERE id = ?1")?;
        for (id, hash) in updates.iter() {
            stmt.execute(params![id, hash])?;
        }
    }
    tx.commit()?;
    updates.clear();
    Ok(())
}

fn duplicate_file_count(db: &Database) -> Result<i64, DedupeError> {
    let conn = db.conn()?;
    conn.query_row(
        r#"
        WITH dup_groups AS (
            SELECT size, content_hash
            FROM files
            WHERE is_dir = 0
              AND is_stale = 0
              AND size > 0
              AND content_hash <> ''
            GROUP BY size, content_hash
            HAVING COUNT(*) > 1
        )
        SELECT COUNT(*)
        FROM files AS f
        LEFT JOIN dup_groups AS dg
          ON dg.size = f.size
         AND dg.content_hash = f.content_hash
        WHERE f.is_dir = 0
          AND f.is_stale = 0
          AND dg.content_hash IS NOT NULL
        "#,
        [],
        |row| row.get(0),
    )
    .map_err(DedupeError::from)
}

struct DedupeProgress {
    total: u64,
    last_emit_at: Instant,
}

impl DedupeProgress {
    fn new(total: u64) -> Self {
        Self {
            total,
            last_emit_at: Instant::now(),
        }
    }

    fn maybe_emit(
        &mut self,
        emitter: &impl DedupeEventEmitter,
        processed: u64,
    ) -> Result<(), DedupeError> {
        let now = Instant::now();
        if processed < self.total && now.duration_since(self.last_emit_at) < DEDUPE_EMIT_INTERVAL {
            return Ok(());
        }
        self.emit(emitter, processed)
    }

    fn emit_final(
        &mut self,
        emitter: &impl DedupeEventEmitter,
        processed: u64,
    ) -> Result<(), DedupeError> {
        self.emit(emitter, processed)
    }

    fn emit(
        &mut self,
        emitter: &impl DedupeEventEmitter,
        processed: u64,
    ) -> Result<(), DedupeError> {
        emitter.emit_progress(&DedupeProgressPayload {
            processed,
            total: self.total,
        })?;
        self.last_emit_at = Instant::now();
        Ok(())
    }
}
