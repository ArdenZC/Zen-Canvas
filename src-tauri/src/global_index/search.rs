use super::models::GlobalSearchResult;
use crate::db::{Database, DbError};
use rusqlite::{params, Connection, Params};
use std::collections::HashSet;

const MAX_SEARCH_LIMIT: u32 = 200;
const MAX_SEARCH_OFFSET: u32 = 1_000_000;
// The final page is taken from this bounded, de-duplicated candidate window.
// A layer may fetch up to target + already-seen ids to compensate for overlap,
// but never turns a keystroke into an unbounded result materialization.
const MAX_TIER_CANDIDATES: u32 = 4_096;

/// Global search is intentionally a separate entry point from the library
/// query. It never accepts `LibraryScope` and never joins the AI `files`
/// table, so a Spotlight query cannot accidentally widen an AI operation.
///
/// The stream is filled in order by exact name, name prefix, extension exact,
/// extension prefix, and finally indexed FTS/punctuation-prefix candidates.
/// Each layer is queried only while the previous layers have not filled the
/// requested bounded window. Results are de-duplicated by stable entry id.
/// `offset` is applied after that deterministic de-duplication, and `cursor`
/// in the public command is the same numeric offset. The candidate window is
/// capped at `MAX_TIER_CANDIDATES`; an offset beyond it returns an empty page.
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

    let target = offset.saturating_add(limit).min(MAX_TIER_CANDIDATES);
    let mut results = Vec::with_capacity(target as usize);
    let mut seen = HashSet::new();

    let tier_limit = layer_limit(target, seen.len());
    append_unique(
        &mut results,
        &mut seen,
        search_exact_name(conn, query, tier_limit)?,
        target,
    );
    if results.len() < target as usize {
        let tier_limit = layer_limit(target, seen.len());
        append_unique(
            &mut results,
            &mut seen,
            search_name_prefix(conn, query, tier_limit)?,
            target,
        );
    }
    if results.len() < target as usize {
        let tier_limit = layer_limit(target, seen.len());
        append_unique(
            &mut results,
            &mut seen,
            search_exact_extension(conn, query, tier_limit)?,
            target,
        );
    }
    if results.len() < target as usize {
        let tier_limit = layer_limit(target, seen.len());
        append_unique(
            &mut results,
            &mut seen,
            search_extension_prefix(conn, query, tier_limit)?,
            target,
        );
    }

    if results.len() < target as usize && query.chars().count() >= 3 {
        let prefix_hint = punctuation_prefix(query);
        if query
            .chars()
            .all(|character| character.is_alphanumeric() || character.is_whitespace())
        {
            let tier_limit = layer_limit(target, seen.len());
            append_unique(
                &mut results,
                &mut seen,
                search_fts(conn, query, tier_limit)?,
                target,
            );
        } else if !prefix_hint.is_empty() {
            let tier_limit = layer_limit(target, seen.len());
            append_unique(
                &mut results,
                &mut seen,
                search_punctuation_prefix(conn, &prefix_hint, tier_limit)?,
                target,
            );
        }
    }

    Ok(results
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect())
}

fn layer_limit(target: u32, seen: usize) -> u32 {
    target
        .saturating_add(seen.min(MAX_TIER_CANDIDATES as usize) as u32)
        .clamp(1, MAX_TIER_CANDIDATES)
}

fn append_unique(
    results: &mut Vec<GlobalSearchResult>,
    seen: &mut HashSet<String>,
    candidates: Vec<GlobalSearchResult>,
    target: u32,
) {
    for candidate in candidates {
        if seen.insert(candidate.id.clone()) {
            results.push(candidate);
            if results.len() >= target as usize {
                break;
            }
        }
    }
}

fn candidate_sql(from: &str, predicate: &str, order: &str, rank: &str, limit_slot: &str) -> String {
    format!(
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
               {rank} AS rank
        FROM {from}
        WHERE {predicate}
        ORDER BY {order}
        LIMIT {limit_slot}
        "#
    )
}

fn collect_candidates<P: Params>(
    statement: &mut rusqlite::Statement<'_>,
    parameters: P,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let rows = statement.query_map(parameters, map_global_search_result)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
}

fn search_exact_name(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let sql = candidate_sql(
        "global_entries ge INDEXED BY idx_global_entries_active_name JOIN global_volumes gv ON gv.id = ge.volume_id",
        "gv.enabled = 1 AND ge.is_stale = 0 AND ge.name_normalized = lower(?1)",
        "ge.modified_at_fs DESC, ge.id ASC",
        "0.0",
        "?2",
    );
    let mut statement = conn.prepare(&sql)?;
    collect_candidates(&mut statement, params![query, limit])
}

fn search_name_prefix(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let sql = candidate_sql(
        "global_entries ge INDEXED BY idx_global_entries_active_name JOIN global_volumes gv ON gv.id = ge.volume_id",
        "gv.enabled = 1 AND ge.is_stale = 0 AND ge.name_normalized GLOB ?2 AND ge.name_normalized <> lower(?1)",
        "ge.modified_at_fs DESC, ge.id ASC",
        "0.0",
        "?3",
    );
    let mut statement = conn.prepare(&sql)?;
    collect_candidates(
        &mut statement,
        params![query, format!("{}*", escape_glob(query)), limit],
    )
}

fn search_exact_extension(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let sql = candidate_sql(
        "global_entries ge INDEXED BY idx_global_entries_active_extension JOIN global_volumes gv ON gv.id = ge.volume_id",
        "gv.enabled = 1 AND ge.is_stale = 0 AND ge.extension = lower(?1)",
        // rowid is the implicit stable tie key of the extension index. The
        // outer stream still exposes the durable entry id and remains
        // deterministic across repeated reads without sorting every matching
        // extension in memory.
        "ge.modified_at_fs DESC, ge.rowid ASC",
        "0.0",
        "?2",
    );
    let mut statement = conn.prepare(&sql)?;
    collect_candidates(&mut statement, params![query, limit])
}

fn search_extension_prefix(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let sql = candidate_sql(
        "global_entries ge INDEXED BY idx_global_entries_active_extension JOIN global_volumes gv ON gv.id = ge.volume_id",
        "gv.enabled = 1 AND ge.is_stale = 0 AND ge.extension GLOB ?2 AND ge.extension <> lower(?1)",
        "ge.modified_at_fs DESC, ge.rowid ASC",
        "1.0",
        "?3",
    );
    let mut statement = conn.prepare(&sql)?;
    collect_candidates(
        &mut statement,
        params![query, format!("{}*", escape_glob(query)), limit],
    )
}

fn search_fts(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let sql = candidate_sql(
        "global_entries_fts JOIN global_entries ge ON ge.rowid = global_entries_fts.rowid JOIN global_volumes gv ON gv.id = ge.volume_id",
        "global_entries_fts MATCH ?1 AND gv.enabled = 1 AND ge.is_stale = 0",
        "rank ASC, ge.modified_at_fs DESC, ge.id ASC",
        "bm25(global_entries_fts, 8.0, 2.0, 1.0)",
        "?2",
    );
    let mut statement = conn.prepare(&sql)?;
    let fts_query = format!("\"{}\"", query.replace('"', "\"\""));
    collect_candidates(&mut statement, params![fts_query, limit])
}

fn search_punctuation_prefix(
    conn: &Connection,
    prefix: &str,
    limit: u32,
) -> Result<Vec<GlobalSearchResult>, DbError> {
    let sql = candidate_sql(
        "global_entries ge INDEXED BY idx_global_entries_active_name JOIN global_volumes gv ON gv.id = ge.volume_id",
        "gv.enabled = 1 AND ge.is_stale = 0 AND ge.name_normalized GLOB ?1",
        "ge.modified_at_fs DESC, ge.id ASC",
        "0.0",
        "?2",
    );
    let mut statement = conn.prepare(&sql)?;
    collect_candidates(
        &mut statement,
        params![format!("{}*", escape_glob(prefix)), limit],
    )
}

fn punctuation_prefix(value: &str) -> String {
    value
        .trim_start_matches(|character: char| !character.is_alphanumeric())
        .trim_end_matches(|character: char| !character.is_alphanumeric())
        .to_string()
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
