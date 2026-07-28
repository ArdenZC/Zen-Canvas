use super::models::GlobalSearchResult;
use crate::db::{Database, DbError};
use rusqlite::{params, Connection};

const MAX_SEARCH_LIMIT: u32 = 200;
const MAX_SEARCH_OFFSET: u32 = 1_000_000;

/// Global search is intentionally a separate entry point from the library
/// query. It never accepts `LibraryScope` and never joins the AI `files`
/// table, so a Spotlight query cannot accidentally widen an AI operation.
///
/// The query always joins `global_volumes` so disabling a source immediately
/// removes its entries from Spotlight without deleting durable index data.
/// One- and two-character queries are deliberately prefix-only: trigram FTS
/// cannot index them efficiently, and an unrestricted `%term%` fallback would
/// scan a multi-million-row table on every keystroke.
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

    if offset == 0 {
        let priority_results =
            search_priority_entries(&conn, query, limit, query.chars().count() < 3)?;
        if !priority_results.is_empty() {
            return Ok(priority_results);
        }
    }

    if query.chars().count() < 3 {
        let mut statement = conn.prepare(
            r#"
            WITH candidates(id, tier) AS (
                SELECT id, tier FROM (
                    SELECT ge.id, 0 AS tier
                    FROM global_entries ge
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1 AND ge.is_stale = 0
                      AND ge.name_normalized = lower(?1)
                    ORDER BY ge.id
                    LIMIT 200
                )
                UNION ALL
                SELECT id, tier FROM (
                    SELECT ge.id, 1 AS tier
                    FROM global_entries ge
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1 AND ge.is_stale = 0
                      AND ge.name_normalized <> lower(?1)
                      AND ge.name_normalized GLOB ?2
                    ORDER BY ge.name_normalized, ge.id
                    LIMIT 2000
                )
                UNION ALL
                SELECT id, tier FROM (
                    SELECT ge.id, 2 AS tier
                    FROM global_entries ge
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1 AND ge.is_stale = 0
                      AND (ge.extension = lower(?1)
                           OR ge.extension GLOB ?2)
                    ORDER BY ge.extension, ge.id
                    LIMIT 2000
                )
            )
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
            FROM candidates c
            JOIN global_entries ge ON ge.id = c.id
            GROUP BY ge.id
            ORDER BY
                MIN(c.tier),
                ge.modified_at_fs DESC,
                ge.id ASC
            LIMIT ?3 OFFSET ?4
            "#,
        )?;
        let rows = statement.query_map(
            params![query, format!("{}*", escape_glob(query)), limit, offset],
            map_global_search_result,
        )?;
        let results = rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)?;
        return Ok(results);
    }

    let mut priority_results = Vec::new();
    if query
        .chars()
        .any(|character| !character.is_alphanumeric() && !character.is_whitespace())
    {
        return search_global_entries_fallback(&conn, query, limit, offset, priority_results);
    }

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
          AND gv.enabled = 1
          AND ge.is_stale = 0
        ORDER BY
            CASE WHEN ge.name_normalized = lower(?2) THEN 0
                 WHEN ge.name_normalized LIKE lower(?2) || '%' THEN 1
                 WHEN ge.extension = lower(?2) THEN 2
                 WHEN ge.name_normalized LIKE '%' || lower(?2) || '%' THEN 3
                 ELSE 4 END,
            rank,
            ge.modified_at_fs DESC,
            ge.id ASC
        LIMIT ?3 OFFSET ?4
        "#,
    )?;
    let mut results = statement
        .query_map(
            params![fts_query, query, limit, offset],
            map_global_search_result,
        )?
        .collect::<Result<Vec<_>, _>>()?;
    results.retain(|candidate| {
        !priority_results
            .iter()
            .any(|priority| priority.id == candidate.id)
    });
    if !results.is_empty() {
        priority_results.extend(
            results
                .into_iter()
                .take(limit as usize - priority_results.len()),
        );
        return Ok(priority_results);
    }

    search_global_entries_fallback(&conn, query, limit, offset, priority_results)
}

fn search_priority_entries(
    conn: &Connection,
    query: &str,
    limit: u32,
    extension_prefix: bool,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    macro_rules! query_tier {
        ($index:literal, $predicate:literal, $value:expr) => {{
            let mut statement = conn.prepare(concat!(
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
                FROM global_entries ge INDEXED BY "#,
                $index,
                r#"
                JOIN global_volumes gv ON gv.id = ge.volume_id
                WHERE gv.enabled = 1
                  AND ge.is_stale = 0
                  AND
                "#,
                $predicate,
                r#"
                ORDER BY ge.modified_at_fs DESC, ge.id ASC
                LIMIT ?2
                "#
            ))?;
            let rows = statement.query_map(params![$value, limit], map_global_search_result)?;
            rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)?
        }};
    }

    let exact = query_tier!(
        "idx_global_entries_active_name",
        "ge.name_normalized = lower(?1)",
        query
    );
    if !exact.is_empty() {
        return Ok(exact);
    }

    let prefix = query_tier!(
        "idx_global_entries_active_name",
        "ge.name_normalized GLOB ?1",
        format!("{}*", escape_glob(query))
    );
    if !prefix.is_empty() {
        return Ok(prefix);
    }

    let extension = if extension_prefix {
        query_tier!(
            "idx_global_entries_active_extension",
            "ge.extension GLOB ?1",
            format!("{}*", escape_glob(query))
        )
    } else {
        query_tier!(
            "idx_global_entries_active_extension",
            "ge.extension = lower(?1)",
            query
        )
    };
    Ok(extension)
}

fn search_global_entries_fallback(
    conn: &Connection,
    query: &str,
    limit: u32,
    offset: u32,
    mut priority_results: Vec<GlobalSearchResult>,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    // Keep a compatibility fallback for punctuation-heavy terms while
    // preserving the same bounded result count.
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
        WHERE gv.enabled = 1
          AND ge.is_stale = 0
          AND (
                ge.name_normalized LIKE lower(?1) ESCAPE '~'
             OR ge.path_normalized LIKE lower(?1) ESCAPE '~'
             OR ge.extension LIKE lower(?1) ESCAPE '~'
          )
        ORDER BY
            CASE WHEN ge.name_normalized = lower(?2) THEN 0
                 WHEN ge.name_normalized LIKE lower(?2) || '%' THEN 1
                 WHEN ge.name_normalized LIKE '%' || lower(?2) || '%' THEN 2
                 WHEN ge.extension LIKE '%' || lower(?2) || '%' THEN 3
                 ELSE 4 END,
            ge.modified_at_fs DESC,
            ge.id ASC
        LIMIT ?3 OFFSET ?4
        "#,
    )?;
    let rows = statement.query_map(
        params![pattern, query, limit, offset],
        map_global_search_result,
    )?;
    let mut results = rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)?;
    results.retain(|candidate| {
        !priority_results
            .iter()
            .any(|priority| priority.id == candidate.id)
    });
    priority_results.extend(
        results
            .into_iter()
            .take(limit as usize - priority_results.len()),
    );
    Ok(priority_results)
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

fn escape_glob(value: &str) -> String {
    value
        .chars()
        .fold(String::with_capacity(value.len()), |mut result, ch| {
            match ch {
                '*' => result.push_str("[*]"),
                '?' => result.push_str("[?]"),
                '[' => result.push_str("[[]"),
                _ => result.extend(ch.to_lowercase()),
            }
            result
        })
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
