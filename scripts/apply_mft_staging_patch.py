from __future__ import annotations

from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "src-tauri/src/global_index/windows/mft.rs"
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected one match, found {count}: {old[:120]}")
    text = text.replace(old, new, 1)


def regex_once(pattern: str, replacement: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"expected one regex match, found {count}: {pattern}")


replace_once(
    "use std::collections::{HashMap, HashSet};\nuse std::path::PathBuf;",
    "use rusqlite::{params, Connection};\nuse std::collections::{HashMap, HashSet};\nuse std::path::{Path, PathBuf};",
)
replace_once(
    "const ENUM_BUFFER_SIZE: usize = 1024 * 1024;",
    "const ENUM_BUFFER_SIZE: usize = 1024 * 1024;\nconst STAGING_READ_BATCH: i64 = 2048;",
)
old_enumerate = r'''fn enumerate_with_handle\(\n    source: &GlobalSourceDescriptor,\n    handle: HANDLE,\n    sink: &mut dyn GlobalIndexSink,\n    cancel: &AtomicBool,\n\) -> Result<MftJournalState, GlobalIndexError> \{.*?\n\}\n\npub\(crate\) fn parse_mft_page'''
new_enumerate = r'''fn enumerate_with_handle(
    source: &GlobalSourceDescriptor,
    handle: HANDLE,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<MftJournalState, GlobalIndexError> {
    let journal = query_journal(handle)?;
    let staging_path = std::env::temp_dir().join(format!(
        "zen-canvas-mft-{}-{}.sqlite",
        source.volume.id,
        uuid::Uuid::new_v4()
    ));
    let result = (|| {
        let mut staging = open_staging_database(&staging_path)?;
        stage_mft_records(&mut staging, handle, journal.NextUsn, cancel)?;
        let directories = load_staged_directories(&staging)?;
        let (directory_paths, parent_paths) =
            resolve_directory_paths(&source.volume.mount_path, &directories);
        stream_staged_entries(
            source,
            &staging,
            &directory_paths,
            &parent_paths,
            sink,
            cancel,
        )?;
        sink.checkpoint(
            &source.volume.id,
            Some(&journal.UsnJournalID.to_string()),
            Some(&journal.NextUsn.to_string()),
        )?;
        Ok(MftJournalState {
            journal_id: journal.UsnJournalID,
            next_usn: journal.NextUsn,
        })
    })();
    let _ = std::fs::remove_file(&staging_path);
    result
}

fn open_staging_database(path: &Path) -> Result<Connection, GlobalIndexError> {
    let connection = Connection::open(path).map_err(|error| {
        GlobalIndexError::Provider(format!("mft_staging_open_failed: {error}"))
    })?;
    connection
        .execute_batch(
            r#"
            PRAGMA journal_mode = OFF;
            PRAGMA synchronous = OFF;
            PRAGMA temp_store = MEMORY;
            CREATE TABLE mft_records (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                file_reference TEXT NOT NULL,
                parent_reference TEXT NOT NULL,
                name TEXT NOT NULL,
                timestamp INTEGER,
                reason INTEGER NOT NULL,
                attributes INTEGER NOT NULL
            );
            CREATE INDEX idx_mft_records_reference ON mft_records(file_reference);
            CREATE INDEX idx_mft_records_parent ON mft_records(parent_reference);
            "#,
        )
        .map_err(|error| {
            GlobalIndexError::Provider(format!("mft_staging_schema_failed: {error}"))
        })?;
    Ok(connection)
}

fn stage_mft_records(
    staging: &mut Connection,
    handle: HANDLE,
    high_usn: i64,
    cancel: &AtomicBool,
) -> Result<(), GlobalIndexError> {
    let mut cursor = 0u64;
    loop {
        if cancel.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        let input = MFT_ENUM_DATA_V0 {
            StartFileReferenceNumber: cursor,
            LowUsn: 0,
            HighUsn: high_usn,
        };
        let input_bytes = unsafe {
            std::slice::from_raw_parts(
                (&input as *const MFT_ENUM_DATA_V0).cast::<u8>(),
                std::mem::size_of::<MFT_ENUM_DATA_V0>(),
            )
        };
        let mut output = vec![0u8; ENUM_BUFFER_SIZE];
        let bytes = match unsafe {
            device_io_control_bytes(handle, FSCTL_ENUM_USN_DATA, input_bytes, &mut output)
        } {
            Ok(bytes) => bytes,
            Err(error) if is_win32_error(&error, ERROR_HANDLE_EOF) => break,
            Err(error) => return Err(error),
        };
        let (next_cursor, records) = parse_mft_page(&output[..bytes])?;
        if next_cursor <= cursor {
            return Err(mft_integrity_error("MFT continuation cursor did not advance"));
        }
        let transaction = staging.transaction().map_err(|error| {
            GlobalIndexError::Provider(format!("mft_staging_transaction_failed: {error}"))
        })?;
        {
            let mut insert = transaction
                .prepare_cached(
                    "INSERT INTO mft_records (file_reference, parent_reference, name, timestamp, reason, attributes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                )
                .map_err(|error| {
                    GlobalIndexError::Provider(format!("mft_staging_prepare_failed: {error}"))
                })?;
            for record in records {
                insert
                    .execute(params![
                        record.file_reference,
                        record.parent_reference,
                        record.name,
                        record.timestamp,
                        i64::from(record.reason),
                        i64::from(record.attributes)
                    ])
                    .map_err(|error| {
                        GlobalIndexError::Provider(format!("mft_staging_write_failed: {error}"))
                    })?;
            }
        }
        transaction.commit().map_err(|error| {
            GlobalIndexError::Provider(format!("mft_staging_commit_failed: {error}"))
        })?;
        cursor = next_cursor;
    }
    Ok(())
}

fn load_staged_directories(staging: &Connection) -> Result<Vec<MftRecord>, GlobalIndexError> {
    let mut statement = staging
        .prepare(
            "SELECT file_reference, parent_reference, name, timestamp, reason, attributes FROM mft_records WHERE (attributes & ?1) != 0",
        )
        .map_err(|error| {
            GlobalIndexError::Provider(format!("mft_staging_directory_prepare_failed: {error}"))
        })?;
    statement
        .query_map(params![i64::from(FILE_ATTRIBUTE_DIRECTORY)], staged_record_from_row)
        .map_err(|error| {
            GlobalIndexError::Provider(format!("mft_staging_directory_query_failed: {error}"))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| {
            GlobalIndexError::Provider(format!("mft_staging_directory_decode_failed: {error}"))
        })
}

fn resolve_directory_paths(
    root: &str,
    directories: &[MftRecord],
) -> (HashMap<String, String>, HashMap<String, String>) {
    let mut by_key = HashMap::new();
    let mut by_reference = HashMap::new();
    let mut unresolved = directories.iter().collect::<Vec<_>>();
    for directory in directories {
        if directory.name == "." || directory.parent_reference == directory.file_reference {
            by_key.insert(record_key(directory), root.to_string());
            by_reference
                .entry(directory.file_reference.clone())
                .or_insert_with(|| root.to_string());
        }
    }
    loop {
        let mut progressed = false;
        unresolved.retain(|directory| {
            let key = record_key(directory);
            if by_key.contains_key(&key) {
                return false;
            }
            let Some(parent) = by_reference.get(&directory.parent_reference) else {
                return true;
            };
            let path = join_windows_path(parent, &directory.name);
            by_key.insert(key, path.clone());
            by_reference
                .entry(directory.file_reference.clone())
                .and_modify(|current| {
                    if path.len() < current.len() {
                        *current = path.clone();
                    }
                })
                .or_insert(path);
            progressed = true;
            false
        });
        if !progressed || unresolved.is_empty() {
            break;
        }
    }
    (by_key, by_reference)
}

fn stream_staged_entries(
    source: &GlobalSourceDescriptor,
    staging: &Connection,
    directory_paths: &HashMap<String, String>,
    parent_paths: &HashMap<String, String>,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<(), GlobalIndexError> {
    let mut last_sequence = 0i64;
    let mut batch = Vec::with_capacity(512);
    loop {
        if cancel.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        let rows = {
            let mut statement = staging
                .prepare(
                    "SELECT sequence, file_reference, parent_reference, name, timestamp, reason, attributes FROM mft_records WHERE sequence > ?1 ORDER BY sequence LIMIT ?2",
                )
                .map_err(|error| {
                    GlobalIndexError::Provider(format!("mft_staging_read_prepare_failed: {error}"))
                })?;
            statement
                .query_map(params![last_sequence, STAGING_READ_BATCH], |row| {
                    Ok((row.get::<_, i64>(0)?, staged_record_from_row_offset(row, 1)?))
                })
                .map_err(|error| {
                    GlobalIndexError::Provider(format!("mft_staging_read_failed: {error}"))
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| {
                    GlobalIndexError::Provider(format!("mft_staging_decode_failed: {error}"))
                })?
        };
        if rows.is_empty() {
            break;
        }
        for (sequence, record) in rows {
            last_sequence = sequence;
            if record.name.is_empty() {
                continue;
            }
            let is_directory = record.attributes & FILE_ATTRIBUTE_DIRECTORY != 0;
            let path = if is_directory {
                directory_paths.get(&record_key(&record)).cloned()
            } else {
                parent_paths
                    .get(&record.parent_reference)
                    .map(|parent| join_windows_path(parent, &record.name))
            };
            let Some(path) = path else {
                // Fail closed: do not invent a root-level path for an orphaned
                // MFT record. A later USN update or rebuild can reconcile it.
                continue;
            };
            let extension = if is_directory {
                String::new()
            } else {
                PathBuf::from(&record.name)
                    .extension()
                    .map(|value| value.to_string_lossy().to_lowercase())
                    .unwrap_or_default()
            };
            let metadata = (!is_directory)
                .then(|| std::fs::symlink_metadata(&path).ok())
                .flatten();
            batch.push(GlobalEntryInput {
                volume_id: source.volume.id.clone(),
                platform_file_id: record.file_reference,
                parent_platform_file_id: record.parent_reference,
                name: record.name,
                path,
                extension,
                is_directory,
                size: metadata.as_ref().map(|value| value.len() as i64).unwrap_or(0),
                created_at_fs: record.timestamp,
                modified_at_fs: metadata
                    .as_ref()
                    .and_then(|value| value.modified().ok())
                    .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|value| value.as_secs() as i64)
                    .or(record.timestamp),
                file_attributes: i64::from(record.attributes),
                is_hidden: record.attributes & FILE_ATTRIBUTE_HIDDEN != 0,
                is_system: record.attributes & FILE_ATTRIBUTE_SYSTEM != 0,
                source_provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
                last_seen_at: crate::global_index::models::unix_now(),
            });
            if batch.len() >= 512 {
                sink.write_batch(&batch)?;
                batch.clear();
            }
        }
    }
    if !batch.is_empty() {
        sink.write_batch(&batch)?;
    }
    Ok(())
}

fn staged_record_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MftRecord> {
    staged_record_from_row_offset(row, 0)
}

fn staged_record_from_row_offset(
    row: &rusqlite::Row<'_>,
    offset: usize,
) -> rusqlite::Result<MftRecord> {
    Ok(MftRecord {
        file_reference: row.get(offset)?,
        parent_reference: row.get(offset + 1)?,
        name: row.get(offset + 2)?,
        timestamp: row.get(offset + 3)?,
        reason: row.get::<_, i64>(offset + 4)? as u32,
        attributes: row.get::<_, i64>(offset + 5)? as u32,
    })
}

pub(crate) fn parse_mft_page'''
regex_once(old_enumerate, new_enumerate)
# Keep the old collector only for focused unit fixtures; production uses staging.
text = text.replace("fn enumerate_mft_records(\n", "#[cfg(test)]\nfn enumerate_mft_records(\n", 1)
path.write_text(text, encoding="utf-8")
print("Applied disk-backed MFT staging patch")
