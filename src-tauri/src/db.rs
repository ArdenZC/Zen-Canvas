use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;
use thiserror::Error;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

#[derive(Debug, Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database pool error: {0}")]
    Pool(#[from] r2d2::Error),
}

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
    pool: Pool<SqliteConnectionManager>,
}

#[derive(Debug, Clone)]
struct IndexedFileRow {
    id: String,
    path: String,
    name: String,
    extension: String,
    size: i64,
    mtime: i64,
    is_dir: bool,
    state_code: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertFileRequest {
    pub id: String,
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: i64,
    pub mtime: i64,
    pub is_dir: bool,
    pub state_code: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResult {
    pub id: String,
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: i64,
    pub mtime: i64,
    pub is_dir: bool,
    pub state_code: i64,
    pub rank: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileRecordDto {
    pub id: String,
    pub name: String,
    pub path: String,
    pub directory: String,
    pub extension: String,
    pub size: i64,
    pub file_type: String,
    pub purpose: String,
    pub lifecycle: String,
    pub context: String,
    pub risk_level: String,
    pub hash: Option<String>,
    pub created_at: String,
    pub modified_at: String,
    pub scanned_at: String,
    pub last_seen_at: String,
    pub is_hidden: bool,
    pub is_deleted: bool,
    pub is_duplicate: bool,
    pub suggested_action: String,
    pub suggested_target_path: String,
    pub suggested_name: String,
    pub confidence: f64,
    pub classification_reason: String,
    pub matched_rules: Vec<String>,
    pub requires_confirmation: bool,
    pub last_opened_at: Option<String>,
    pub open_count: i64,
    pub indexed_at: String,
    pub source_id: Option<String>,
    pub is_stale: bool,
    pub state_code: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PagedFilesResult {
    pub files: Vec<FileRecordDto>,
    pub total: i64,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    pub total_files: i64,
    pub total_size: i64,
    pub disk_total_size: i64,
    pub disk_free_size: i64,
    pub disk_usage_ratio: f64,
    pub duplicate_files: i64,
    pub large_files: i64,
    pub sensitive_files: i64,
    pub needs_confirmation: i64,
    pub by_type: HashMap<String, i64>,
    pub by_lifecycle: HashMap<String, i64>,
    pub last_scanned_at: Option<String>,
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, DbError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let manager = SqliteConnectionManager::file(&path).with_init(configure_connection);
        let pool = Pool::builder().max_size(8).build(manager)?;
        {
            let conn = pool.get()?;
            migrate(&conn)?;
        }

        Ok(Self { path, pool })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn init(&self) -> Result<(), DbError> {
        let conn = self.conn()?;
        migrate(&conn)
    }

    pub fn insert_file(&self, file: InsertFileRequest) -> Result<(), DbError> {
        self.insert_files(&[file])
    }

    pub fn insert_files(&self, files: &[InsertFileRequest]) -> Result<(), DbError> {
        if files.is_empty() {
            return Ok(());
        }

        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                r#"
            INSERT INTO files (
                id, path, name, extension, size, mtime, is_dir, state_code
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                path = excluded.path,
                name = excluded.name,
                extension = excluded.extension,
                size = excluded.size,
                mtime = excluded.mtime,
                is_dir = excluded.is_dir,
                state_code = excluded.state_code
            "#,
            )?;

            for file in files {
                stmt.execute(params![
                    file.id,
                    file.path,
                    file.name,
                    file.extension,
                    file.size,
                    file.mtime,
                    bool_to_i64(file.is_dir),
                    file.state_code
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn search_files(
        &self,
        query: &str,
        limit: Option<u32>,
    ) -> Result<Vec<FileSearchResult>, DbError> {
        let Some(fts_query) = build_fts_query(query) else {
            return Ok(Vec::new());
        };

        let limit = i64::from(limit.unwrap_or(50).clamp(1, 200));
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                f.id,
                f.path,
                f.name,
                f.extension,
                f.size,
                f.mtime,
                f.is_dir,
                f.state_code,
                bm25(files_fts, 6.0, 1.5) AS rank
            FROM files_fts
            JOIN files AS f ON f.rowid = files_fts.rowid
            WHERE files_fts MATCH ?1
            ORDER BY rank ASC, f.mtime DESC, length(f.path) ASC
            LIMIT ?2
            "#,
        )?;

        let rows = stmt.query_map(params![fts_query, limit], |row| {
            Ok(FileSearchResult {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                size: row.get(4)?,
                mtime: row.get(5)?,
                is_dir: row.get::<_, i64>(6)? != 0,
                state_code: row.get(7)?,
                rank: row.get(8)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_paged_files(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        query: Option<&str>,
    ) -> Result<PagedFilesResult, DbError> {
        let limit = limit.unwrap_or(50).clamp(1, 200);
        let offset = offset.unwrap_or(0);
        let now = current_timestamp_iso();
        let conn = self.conn()?;

        if let Some(fts_query) = query.and_then(build_fts_query) {
            let total = conn.query_row(
                "SELECT COUNT(*) FROM files_fts WHERE files_fts MATCH ?1",
                params![fts_query],
                |row| row.get(0),
            )?;
            let mut stmt = conn.prepare(
                r#"
                SELECT
                    f.id,
                    f.path,
                    f.name,
                    f.extension,
                    f.size,
                    f.mtime,
                    f.is_dir,
                    f.state_code,
                    bm25(files_fts, 6.0, 1.5) AS rank
                FROM files_fts
                JOIN files AS f ON f.rowid = files_fts.rowid
                WHERE files_fts MATCH ?1
                ORDER BY rank ASC, f.mtime DESC, length(f.path) ASC
                LIMIT ?2 OFFSET ?3
                "#,
            )?;
            let rows = stmt.query_map(
                params![fts_query, i64::from(limit), i64::from(offset)],
                |row| indexed_file_from_row(row),
            )?;
            let files = rows
                .map(|row| row.map(|file| file_record_from_indexed(file, &now)))
                .collect::<Result<Vec<_>, _>>()?;

            return Ok(PagedFilesResult {
                files,
                total,
                limit,
                offset,
            });
        }

        let total = conn.query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))?;
        let mut stmt = conn.prepare(
            r#"
            SELECT id, path, name, extension, size, mtime, is_dir, state_code
            FROM files
            ORDER BY mtime DESC, name COLLATE NOCASE ASC
            LIMIT ?1 OFFSET ?2
            "#,
        )?;
        let rows = stmt.query_map(params![i64::from(limit), i64::from(offset)], |row| {
            indexed_file_from_row(row)
        })?;
        let files = rows
            .map(|row| row.map(|file| file_record_from_indexed(file, &now)))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(PagedFilesResult {
            files,
            total,
            limit,
            offset,
        })
    }

    pub fn get_stats_summary(&self) -> Result<StatsSummary, DbError> {
        let conn = self.conn()?;
        let (total_files, total_size): (i64, i64) = conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(size), 0) FROM files WHERE is_dir = 0",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let large_files = conn.query_row(
            "SELECT COUNT(*) FROM files WHERE is_dir = 0 AND size >= ?1",
            params![100_i64 * 1024 * 1024],
            |row| row.get(0),
        )?;
        let last_mtime: Option<i64> =
            conn.query_row("SELECT MAX(mtime) FROM files", [], |row| {
                row.get::<_, Option<i64>>(0)
            })?;

        let mut by_type = HashMap::new();
        let mut stmt = conn.prepare(
            r#"
            SELECT extension, is_dir, COUNT(*)
            FROM files
            GROUP BY extension, is_dir
            "#,
        )?;
        let type_rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)? != 0,
                row.get::<_, i64>(2)?,
            ))
        })?;
        for row in type_rows {
            let (extension, is_dir, count) = row?;
            *by_type
                .entry(infer_file_type(&extension, is_dir).to_string())
                .or_insert(0) += count;
        }

        let mut by_lifecycle = HashMap::new();
        by_lifecycle.insert("Inbox".to_string(), total_files);

        Ok(StatsSummary {
            total_files,
            total_size,
            disk_total_size: 0,
            disk_free_size: 0,
            disk_usage_ratio: 0.0,
            duplicate_files: 0,
            large_files,
            sensitive_files: 0,
            needs_confirmation: 0,
            by_type,
            by_lifecycle,
            last_scanned_at: last_mtime.map(unix_seconds_to_iso),
        })
    }

    fn conn(&self) -> Result<PooledConnection<SqliteConnectionManager>, DbError> {
        self.pool.get().map_err(DbError::from)
    }
}

#[tauri::command]
pub fn init_db(db: State<'_, Database>) -> Result<(), String> {
    db.init().map_err(command_error)
}

#[tauri::command]
pub fn insert_file(db: State<'_, Database>, file: InsertFileRequest) -> Result<(), String> {
    db.insert_file(file).map_err(command_error)
}

#[tauri::command]
pub fn search_files(
    db: State<'_, Database>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<FileSearchResult>, String> {
    db.search_files(&query, limit).map_err(command_error)
}

#[tauri::command]
pub fn get_paged_files(
    db: State<'_, Database>,
    limit: Option<u32>,
    offset: Option<u32>,
    query: Option<String>,
) -> Result<PagedFilesResult, String> {
    db.get_paged_files(limit, offset, query.as_deref())
        .map_err(command_error)
}

#[tauri::command]
pub fn get_stats_summary(db: State<'_, Database>) -> Result<StatsSummary, String> {
    db.get_stats_summary().map_err(command_error)
}

fn configure_connection(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(())
}

fn migrate(conn: &Connection) -> Result<(), DbError> {
    assert_fts5_available(conn)?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            extension TEXT NOT NULL DEFAULT '',
            size INTEGER NOT NULL DEFAULT 0,
            mtime INTEGER NOT NULL DEFAULT 0,
            is_dir INTEGER NOT NULL DEFAULT 0 CHECK (is_dir IN (0, 1)),
            state_code INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
        CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
        CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
        CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime DESC);

        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            name,
            path,
            content='files',
            content_rowid='rowid',
            tokenize='unicode61 remove_diacritics 2',
            prefix='2 3 4'
        );

        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, name, path)
            VALUES (new.rowid, new.name, new.path);
        END;

        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path)
            VALUES('delete', old.rowid, old.name, old.path);
        END;

        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path)
            VALUES('delete', old.rowid, old.name, old.path);
            INSERT INTO files_fts(rowid, name, path)
            VALUES (new.rowid, new.name, new.path);
        END;
        "#,
    )?;
    Ok(())
}

fn assert_fts5_available(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        r#"
        CREATE VIRTUAL TABLE temp.fts5_probe USING fts5(value);
        DROP TABLE temp.fts5_probe;
        "#,
    )?;
    Ok(())
}

fn build_fts_query(input: &str) -> Option<String> {
    let tokens = input
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .take(12)
        .map(|token| format!("{}*", token.to_lowercase()))
        .collect::<Vec<_>>();

    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" AND "))
    }
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn command_error(error: DbError) -> String {
    error.to_string()
}

fn indexed_file_from_row(row: &Row<'_>) -> rusqlite::Result<IndexedFileRow> {
    Ok(IndexedFileRow {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        extension: row.get(3)?,
        size: row.get(4)?,
        mtime: row.get(5)?,
        is_dir: row.get::<_, i64>(6)? != 0,
        state_code: row.get(7)?,
    })
}

fn file_record_from_indexed(row: IndexedFileRow, now: &str) -> FileRecordDto {
    let modified_at = unix_seconds_to_iso(row.mtime);
    let file_type = infer_file_type(&row.extension, row.is_dir).to_string();

    FileRecordDto {
        id: row.id,
        name: row.name.clone(),
        path: row.path.clone(),
        directory: parent_directory(&row.path),
        extension: row.extension,
        size: row.size,
        file_type,
        purpose: "Unknown".to_string(),
        lifecycle: "Inbox".to_string(),
        context: String::new(),
        risk_level: "Normal".to_string(),
        hash: None,
        created_at: modified_at.clone(),
        modified_at,
        scanned_at: now.to_string(),
        last_seen_at: now.to_string(),
        is_hidden: row.name.starts_with('.'),
        is_deleted: false,
        is_duplicate: false,
        suggested_action: "Keep".to_string(),
        suggested_target_path: String::new(),
        suggested_name: row.name,
        confidence: 0.5,
        classification_reason: "Indexed by Zen Canvas Tauri backend.".to_string(),
        matched_rules: Vec::new(),
        requires_confirmation: false,
        last_opened_at: None,
        open_count: 0,
        indexed_at: now.to_string(),
        source_id: None,
        is_stale: false,
        state_code: row.state_code,
    }
}

fn parent_directory(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    normalized
        .rsplit_once('/')
        .map(|(parent, _)| parent.to_string())
        .unwrap_or_default()
}

fn infer_file_type(extension: &str, is_dir: bool) -> &'static str {
    if is_dir {
        return "Other";
    }

    match extension.to_ascii_lowercase().as_str() {
        "pdf" | "doc" | "docx" | "txt" | "md" | "rtf" => "Document",
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "svg" => "Image",
        "mp4" | "mov" | "mkv" | "avi" | "webm" => "Video",
        "mp3" | "wav" | "flac" | "aac" | "m4a" => "Audio",
        "zip" | "rar" | "7z" | "tar" | "gz" => "ArchivePackage",
        "exe" | "msi" | "dmg" | "pkg" | "appimage" => "Installer",
        "xls" | "xlsx" | "csv" | "numbers" => "Spreadsheet",
        "ppt" | "pptx" | "key" => "Presentation",
        "js" | "jsx" | "ts" | "tsx" | "rs" | "go" | "py" | "java" | "kt" | "swift" | "c"
        | "cpp" | "h" | "hpp" | "cs" | "php" | "rb" | "html" | "css" | "scss" | "json" | "yaml"
        | "yml" | "toml" => "Code",
        _ => "Other",
    }
}

fn unix_seconds_to_iso(seconds: i64) -> String {
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|time| time.format(&Rfc3339).ok())
        .unwrap_or_else(current_timestamp_iso)
}

fn current_timestamp_iso() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|time| time.format(&Rfc3339).ok())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn get_paged_files_returns_limit_and_offset() {
        let db = Database::open(test_db_path()).expect("open test database");
        insert_test_file(&db, "file-1", "report.pdf", "pdf", 2_048, 1_800_000_000);
        insert_test_file(&db, "file-2", "photo.jpg", "jpg", 4_096, 1_900_000_000);

        let page = db.get_paged_files(Some(1), Some(1), None).expect("page");

        assert_eq!(page.total, 2);
        assert_eq!(page.limit, 1);
        assert_eq!(page.offset, 1);
        assert_eq!(page.files.len(), 1);
        assert_eq!(page.files[0].name, "report.pdf");
    }

    #[test]
    fn get_stats_summary_aggregates_files_and_types() {
        let db = Database::open(test_db_path()).expect("open test database");
        insert_test_file(&db, "file-1", "report.pdf", "pdf", 2_048, 1_800_000_000);
        insert_test_file(&db, "file-2", "photo.jpg", "jpg", 4_096, 1_900_000_000);

        let stats = db.get_stats_summary().expect("stats");

        assert_eq!(stats.total_files, 2);
        assert_eq!(stats.total_size, 6_144);
        assert_eq!(stats.by_type.get("Document"), Some(&1));
        assert_eq!(stats.by_type.get("Image"), Some(&1));
        assert_eq!(stats.by_lifecycle.get("Inbox"), Some(&2));
    }

    fn insert_test_file(
        db: &Database,
        id: &str,
        name: &str,
        extension: &str,
        size: i64,
        mtime: i64,
    ) {
        db.insert_file(InsertFileRequest {
            id: id.to_string(),
            path: format!("C:/Users/77588/Documents/{name}"),
            name: name.to_string(),
            extension: extension.to_string(),
            size,
            mtime,
            is_dir: false,
            state_code: 0,
        })
        .expect("insert file");
    }

    fn test_db_path() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("zen-canvas-db-test-{nonce}.sqlite3"))
    }
}
