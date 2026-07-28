use super::models::GlobalSearchResult;
use crate::db::{Database, DbError};
use rusqlite::{params, Connection};

const MAX_SEARCH_LIMIT: u32 = 200;
const MAX_SEARCH_OFFSET: u32 = 1_000_000;
// Each tier is deliberately bounded.  The final LIMIT/OFFSET is applied only
// after the tiered candidates have been de-duplicated, so later tiers can fill
// a short earlier tier without turning a keystroke into an unbounded scan.
const MAX_TIER_CANDIDATES: u32 = 4_096;

/// Global search is intentionally a separate entry point from the library
/// query. It never accepts `LibraryScope` and never joins the AI `files`
/// table, so a Spotlight query cannot accidentally widen an AI operation.
///
/// The result stream has four deterministic layers: exact name, name prefix,
/// extension exact/prefix, and bounded FTS/fallback matches. Every layer is
/// collected up to `MAX_TIER_CANDIDATES`, then duplicate ids are collapsed to
/// their earliest layer before the final order and page are applied. `offset`
/// therefore means an offset in that de-duplicated stream, and `cursor` in the
/// public command is the same numeric offset. The candidate window is bounded
/// at `MAX_TIER_CANDIDATES`; offsets beyond it return an empty page rather than
/// silently scanning the entire index.
pub fn search_global_entries(
    db: &Database,
    query: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let conn = db.conn()?;
    search_global_entries_on_connection(&conn, query, limit, offset)
}

/// Runs the same search against an existing SQLite connection. The repository
/// snapshot uses this entry point while holding one read transaction so the
/// result rows and source/index facts cannot describe different database
/// states.
pub(crate) fn search_global_entries_on_connection(
    conn: &Connection,
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
    if offset >= MAX_TIER_CANDIDATES {
        return Ok(Vec::new());
    }

    let requested_window = offset.saturating_add(limit).min(MAX_TIER_CANDIDATES);
    // A later layer may repeat entries already admitted by earlier layers.
    // Four bounded passes leave room for that overlap while keeping a small
    // query limit genuinely small instead of always fetching 4,096 rows.
    let candidate_limit = requested_window
        .saturating_mul(4)
        .min(MAX_TIER_CANDIDATES)
        .max(limit);
    let name_prefix = format!("{}*", escape_glob(query));
    let is_fts_safe = query
        .chars()
        .all(|character| character.is_alphanumeric() || character.is_whitespace());

    let mut statement = if is_fts_safe && query.chars().count() >= 3 {
        conn.prepare(
            r#"
            WITH candidates(id, tier, rank) AS (
                SELECT id, tier, rank FROM (
                    SELECT ge.id, 0 AS tier, 0.0 AS rank
                    FROM global_entries ge INDEXED BY idx_global_entries_active_name
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1
                      AND ge.is_stale = 0
                      AND ge.name_normalized = lower(?1)
                    ORDER BY ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
                UNION ALL
                SELECT id, tier, rank FROM (
                    SELECT ge.id, 1 AS tier, 0.0 AS rank
                    FROM global_entries ge INDEXED BY idx_global_entries_active_name
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1
                      AND ge.is_stale = 0
                      AND ge.name_normalized GLOB ?2
                      AND ge.name_normalized <> lower(?1)
                    ORDER BY ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
                UNION ALL
                SELECT id, tier, rank FROM (
                    SELECT ge.id,
                           2 AS tier,
                           CASE WHEN ge.extension = lower(?1) THEN 0.0 ELSE 1.0 END AS rank
                    FROM global_entries ge INDEXED BY idx_global_entries_active_extension
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1
                      AND ge.is_stale = 0
                      AND (ge.extension = lower(?1) OR ge.extension GLOB ?2)
                    ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
                UNION ALL
                SELECT id, tier, rank FROM (
                    SELECT ge.rowid AS id,
                           3 AS tier,
                           bm25(global_entries_fts, 8.0, 2.0, 1.0) AS rank
                    FROM global_entries_fts
                    JOIN global_entries ge ON ge.rowid = global_entries_fts.rowid
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE global_entries_fts MATCH ?3
                      AND gv.enabled = 1
                      AND ge.is_stale = 0
                    ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
            ),
            ranked AS (
                SELECT id, MIN(tier) AS tier, MIN(rank) AS rank
                FROM candidates
                GROUP BY id
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
                   ranked.rank
            FROM ranked
            JOIN global_entries ge ON ge.id = ranked.id
            JOIN global_volumes gv ON gv.id = ge.volume_id
            WHERE gv.enabled = 1 AND ge.is_stale = 0
            ORDER BY ranked.tier ASC,
                     CASE WHEN ranked.tier = 3 THEN ranked.rank ELSE 0.0 END ASC,
                     ge.modified_at_fs DESC,
                     ge.id ASC
            LIMIT ?5 OFFSET ?6
            "#,
        )?
    } else {
        conn.prepare(
            r#"
            WITH candidates(id, tier, rank) AS (
                SELECT id, tier, rank FROM (
                    SELECT ge.id, 0 AS tier, 0.0 AS rank
                    FROM global_entries ge INDEXED BY idx_global_entries_active_name
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1
                      AND ge.is_stale = 0
                      AND ge.name_normalized = lower(?1)
                    ORDER BY ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
                UNION ALL
                SELECT id, tier, rank FROM (
                    SELECT ge.id, 1 AS tier, 0.0 AS rank
                    FROM global_entries ge INDEXED BY idx_global_entries_active_name
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1
                      AND ge.is_stale = 0
                      AND ge.name_normalized GLOB ?2
                      AND ge.name_normalized <> lower(?1)
                    ORDER BY ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
                UNION ALL
                SELECT id, tier, rank FROM (
                    SELECT ge.id,
                           2 AS tier,
                           CASE WHEN ge.extension = lower(?1) THEN 0.0 ELSE 1.0 END AS rank
                    FROM global_entries ge INDEXED BY idx_global_entries_active_extension
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE gv.enabled = 1
                      AND ge.is_stale = 0
                      AND (ge.extension = lower(?1) OR ge.extension GLOB ?2)
                    ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
                UNION ALL
                SELECT id, tier, rank FROM (
                    SELECT ge.id,
                           3 AS tier,
                           CASE
                               WHEN ge.name_normalized LIKE lower(?5) || '%' ESCAPE '~' THEN 1.0
                               WHEN ge.name_normalized LIKE lower(?5) ESCAPE '~' THEN 2.0
                               WHEN ge.extension LIKE lower(?5) ESCAPE '~' THEN 3.0
                               ELSE 4.0
                           END AS rank
                    FROM global_entries ge
                    JOIN global_volumes gv ON gv.id = ge.volume_id
                    WHERE ?3 = 1
                      AND gv.enabled = 1
                      AND ge.is_stale = 0
                      AND (
                            ge.name_normalized LIKE lower(?5) ESCAPE '~'
                         OR ge.path_normalized LIKE lower(?5) ESCAPE '~'
                         OR ge.extension LIKE lower(?5) ESCAPE '~'
                      )
                    ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
                    LIMIT ?4
                )
            ),
            ranked AS (
                SELECT id, MIN(tier) AS tier, MIN(rank) AS rank
                FROM candidates
                GROUP BY id
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
                   ranked.rank
            FROM ranked
            JOIN global_entries ge ON ge.id = ranked.id
            JOIN global_volumes gv ON gv.id = ge.volume_id
            WHERE gv.enabled = 1 AND ge.is_stale = 0
            ORDER BY ranked.tier ASC,
                     CASE WHEN ranked.tier = 3 THEN ranked.rank ELSE 0.0 END ASC,
                     ge.modified_at_fs DESC,
                     ge.id ASC
            LIMIT ?6 OFFSET ?7
            "#,
        )?
    };

    let fts_query = format!("\"{}\"", query.replace('"', "\"\""));
    let pattern = format!("%{}%", escape_like(query));
    let rows = if is_fts_safe && query.chars().count() >= 3 {
        statement.query_map(
            params![
                query,
                name_prefix,
                fts_query,
                candidate_limit,
                limit,
                offset
            ],
            map_global_search_result,
        )?
    } else {
        let broad_layer_enabled = if is_fts_safe && query.chars().count() < 3 {
            0
        } else {
            1
        };
        statement.query_map(
            params![
                query,
                name_prefix,
                broad_layer_enabled,
                candidate_limit,
                pattern,
                limit,
                offset
            ],
            map_global_search_result,
        )?
    };
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
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
