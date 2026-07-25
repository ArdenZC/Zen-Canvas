use super::models::GlobalSearchResult;
use crate::db::{Database, DbError};
use rusqlite::params;

const MAX_SEARCH_LIMIT: u32 = 200;
const MAX_SEARCH_OFFSET: u32 = 1_000_000;

/// Global search is intentionally a separate entry point from the library
/// query. It never accepts `LibraryScope` and never joins the AI `files`
/// table, so a Spotlight query cannot accidentally widen an AI operation.
///
/// Search results are also constrained to enabled volumes. Disabling a source
/// is therefore an immediate privacy and correctness boundary even if a native
/// provider still has an in-flight batch when the setting changes.
pub fn search_global_entries(
    db: &Database,
    query: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let limit = limit.clamp(1, MAX_SEARCH_LIMIT);
    let offset = offset.min(MAX_SEARCH_OFFSET);
    let conn = db.conn()?;
    let mut results = if query.chars().count() >= 3 {
        let fts_query = format!("\"{}\"", query.replace('"', "\"\""));
        let mut statement = conn.prepare(
            r#"
            SELECT ge.id, ge.volume_id, ge.platform_file_id, ge.name, ge.path,
                   ge.extension, ge.is_directory, ge.size, ge.created_at_fs,
                   ge.modified_at_fs, ge.file_attributes, ge.is_hidden, ge.is_system,
                   ge.source_provider,
                   EXISTS (
                       SELECT 1
                       FROM managed_entries me
                       JOIN managed_scopes ms ON ms.id = me.managed_scope_id
                       WHERE me.global_entry_id = ge.id
                         AND me.enabled = 1
                         AND ms.enabled = 1
                   ) AS managed,
                   bm25(global_entries_fts, 8.0, 2.0, 1.0) AS rank
            FROM global_entries_fts
            JOIN global_entries ge ON ge.rowid = global_entries_fts.rowid
            JOIN global_volumes gv ON gv.id = ge.volume_id
            WHERE global_entries_fts MATCH ?1
              AND ge.is_stale = 0
              AND gv.enabled = 1
            ORDER BY
                CASE WHEN ge.name_normalized = lower(?2) THEN 0
                     WHEN ge.name_normalized LIKE lower(?2) || '%' THEN 1
                     WHEN ge.name_normalized LIKE '%' || lower(?2) || '%' THEN 2
                     ELSE 3 END,
                rank,
                ge.modified_at_fs DESC
            LIMIT ?3 OFFSET ?4
            "#,
        )?;
        statement
            .query_map(
                params![fts_query, query, limit, offset],
                map_global_search_result,
            )?
            .collect::<Result<Vec<_>, _>>()?
    } else {
        Vec::new()
    };

    if results.is_empty() {
        let pattern = format!("%{}%", escape_like(query));
        let mut statement = conn.prepare(
            r#"
            SELECT ge.id, ge.volume_id, ge.platform_file_id, ge.name, ge.path,
                   ge.extension, ge.is_directory, ge.size, ge.created_at_fs,
                   ge.modified_at_fs, ge.file_attributes, ge.is_hidden, ge.is_system,
                   ge.source_provider,
                   EXISTS (
                       SELECT 1
                       FROM managed_entries me
                       JOIN managed_scopes ms ON ms.id = me.managed_scope_id
                       WHERE me.global_entry_id = ge.id
                         AND me.enabled = 1
                         AND ms.enabled = 1
                   ) AS managed,
                   0.0 AS rank
            FROM global_entries ge
            JOIN global_volumes gv ON gv.id = ge.volume_id
            WHERE ge.is_stale = 0
              AND gv.enabled = 1
              AND (ge.name_normalized LIKE lower(?1) ESCAPE '~'
                   OR ge.path_normalized LIKE lower(?1) ESCAPE '~'
                   OR ge.extension LIKE lower(?1) ESCAPE '~')
            ORDER BY
                CASE WHEN ge.name_normalized = lower(?2) THEN 0
                     WHEN ge.name_normalized LIKE lower(?2) || '%' THEN 1
                     WHEN ge.name_normalized LIKE '%' || lower(?2) || '%' THEN 2
                     WHEN ge.extension LIKE '%' || lower(?2) || '%' THEN 3
                     ELSE 4 END,
                ge.modified_at_fs DESC
            LIMIT ?3 OFFSET ?4
            "#,
        )?;
        results = statement
            .query_map(
                params![pattern, query, limit, offset],
                map_global_search_result,
            )?
            .collect::<Result<Vec<_>, _>>()?;
    }

    Ok(results)
}

fn map_global_search_result(row: &rusqlite::Row<'_>) -> rusqlite::Result<GlobalSearchResult> {
    Ok(GlobalSearchResult {
        id: row.get(0)?,
        volume_id: row.get(1)?,
        platform_file_id: row.get(2)?,
        name: row.get(3)?,
        path: row.get(4)?,
        extension: row.get(5)?,
        is_directory: row.get::<_, i64>(6)? != 0,
        size: row.get(7)?,
        created_at_fs: row.get(8)?,
        modified_at_fs: row.get(9)?,
        file_attributes: row.get(10)?,
        is_hidden: row.get::<_, i64>(11)? != 0,
        is_system: row.get::<_, i64>(12)? != 0,
        source_provider: row.get(13)?,
        managed: row.get::<_, i64>(14)? != 0,
        rank: row.get(15)?,
    })
}

fn escape_like(value: &str) -> String {
    value
        .chars()
        .fold(String::with_capacity(value.len()), |mut result, ch| {
            if matches!(ch, '~' | '%' | '_') {
                result.push('~');
            }
            result.push(ch.to_ascii_lowercase());
            result
        })
}
