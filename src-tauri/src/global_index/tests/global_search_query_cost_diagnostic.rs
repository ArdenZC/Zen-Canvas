//! Bounded Issue #352/#359 investigation. Candidate instrumentation is
//! test-only; the production source-health SQL is evaluated through the real
//! repository snapshot path, while schema, search tiers, candidate cap, and
//! result semantics remain unchanged.

use super::{
    actual_match_count, assert_search_results, benchmark_context, benchmark_escape_glob,
    candidate_plan_sql, configured_connection, database_metrics, emit_record,
    populate_synthetic_database, sidecar_bytes, summarize_samples, test_db_path, BenchmarkCleanup,
    INSERT_SYNTHETIC_ENTRY, QUERY_MATRIX, SEARCH_CANDIDATE_LIMIT, SEARCH_RESULT_LIMIT,
};
use crate::db::Database;
use crate::global_index::models::GlobalSearchResult;
use crate::global_index::repository::{
    load_global_search_source_health_candidate, DiagnosticSourceHealth, GlobalSearchSnapshot,
    GlobalSearchSourceHealthQueryCandidate as SourceHealthCandidate,
};
use crate::global_index::search::{
    diagnostic_search_fts, diagnostic_search_fts_sql, diagnostic_search_tier,
    search_global_entries_on_connection,
};
use rusqlite::types::Value as SqlValue;
use rusqlite::{params, params_from_iter, Connection, StatementStatus};
use serde_json::{json, Value as JsonValue};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

const DIAGNOSTIC_ENTRIES: u64 = 500_000;
const STAGE_WARMUPS: usize = 3;
const STAGE_SAMPLES: usize = 10;
const PAIRED_WARMUPS: usize = 5;
const PAIRED_SAMPLES: usize = 30;
const QUERY_LIMIT: u32 = 80;
const TEST_INDEX_NAME: &str = "idx_issue352_diag_name_mtime";

const SAFE_PREFIX_CTE_SQL: &str = r#"
    WITH candidates AS MATERIALIZED (
        SELECT ge.rowid AS entry_rowid,
               ge.id AS entry_id,
               ge.modified_at_fs AS modified_at_fs
        FROM global_entries ge INDEXED BY idx_global_entries_active_name_order
        CROSS JOIN global_volumes gv
        WHERE gv.id = ge.volume_id
          AND gv.enabled = 1
          AND ge.is_stale = 0
          AND ge.name_normalized GLOB ?2
          AND ge.name_normalized <> lower(?1)
        ORDER BY ge.modified_at_fs DESC, ge.id ASC
        LIMIT ?3
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
    FROM candidates
    JOIN global_entries ge ON ge.rowid = candidates.entry_rowid
    ORDER BY candidates.modified_at_fs DESC, candidates.entry_id ASC
"#;

const TIME_INDEX_PREFIX_SQL: &str = r#"
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
    FROM global_entries ge INDEXED BY idx_issue352_diag_name_mtime
    CROSS JOIN global_volumes gv
    WHERE gv.id = ge.volume_id
      AND gv.enabled = 1
      AND ge.is_stale = 0
      AND ge.name_normalized GLOB ?2
      AND ge.name_normalized <> lower(?1)
    ORDER BY ge.modified_at_fs DESC, ge.id ASC
    LIMIT ?3
"#;

const SAFE_FTS_CTE_SQL: &str = r#"
    WITH candidates AS MATERIALIZED (
        SELECT ge.rowid AS entry_rowid,
               ge.id AS entry_id,
               ge.modified_at_fs AS modified_at_fs,
               bm25(global_entries_fts, 8.0, 2.0, 1.0) AS rank
        FROM global_entries_fts
        CROSS JOIN global_entries ge
        CROSS JOIN global_volumes gv
        WHERE global_entries_fts MATCH ?1
          AND ge.rowid = global_entries_fts.rowid
          AND gv.id = ge.volume_id
          AND gv.enabled = 1
          AND ge.is_stale = 0
        ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
        LIMIT ?2
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
           candidates.rank AS rank
    FROM candidates
    JOIN global_entries ge ON ge.rowid = candidates.entry_rowid
    ORDER BY candidates.rank ASC,
             candidates.modified_at_fs DESC,
             candidates.entry_id ASC
"#;

const FTS_WITHOUT_MANAGED_SQL: &str = r#"
    SELECT ge.rowid, ge.id, ge.volume_id, ge.platform_file_id, ge.name, ge.path,
           ge.extension, ge.is_directory, ge.size, ge.created_at_fs,
           ge.modified_at_fs, ge.file_attributes, ge.is_hidden, ge.is_system,
           ge.source_provider,
           0 AS managed,
           bm25(global_entries_fts, 8.0, 2.0, 1.0) AS rank
    FROM global_entries_fts
    CROSS JOIN global_entries ge
    CROSS JOIN global_volumes gv
    WHERE global_entries_fts MATCH ?1
      AND ge.rowid = global_entries_fts.rowid
      AND gv.id = ge.volume_id
      AND gv.enabled = 1
      AND ge.is_stale = 0
    ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
    LIMIT ?2
"#;

// Exact read-side SQL shapes used by repository.rs when it builds the
// production search snapshot. Kept here as test-only mirrors so their cost is
// visible separately from the search tier itself.
const SNAPSHOT_SOURCE_HEALTH_SQL: &str = r#"
    SELECT gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at,
           COUNT(ge.id), MAX(ge.last_seen_at)
    FROM global_volumes gv
    LEFT JOIN global_entries ge
      ON ge.volume_id = gv.id AND ge.is_stale = 0
    GROUP BY gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at
    ORDER BY gv.id ASC
"#;

const SNAPSHOT_INDEX_STATUS_SQL: &str = r#"
    SELECT
        (SELECT COUNT(*)
         FROM global_entries entry
         JOIN global_volumes volume ON volume.id = entry.volume_id
         WHERE entry.is_stale = 0 AND volume.enabled = 1),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'ready'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status IN ('discovered', 'indexing', 'syncing', 'rebuild_required')),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'spotlight_not_indexed'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'permission_required'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'spotlight_unavailable'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'spotlight_external_not_indexed'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'fsevents_unavailable'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'unavailable'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'error'),
        (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'paused'),
        (SELECT MAX(last_incremental_sync_at) FROM global_volumes WHERE enabled = 1),
        (SELECT last_error FROM global_volumes WHERE enabled = 1 AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1)
"#;

#[derive(Clone, Copy)]
struct PrefixQuery {
    class: &'static str,
    query: &'static str,
    extension: bool,
}

const PREFIX_QUERIES: [PrefixQuery; 6] = [
    PrefixQuery {
        class: "name_prefix",
        query: "quarterly",
        extension: false,
    },
    PrefixQuery {
        class: "common_prefix_high_fanout",
        query: "IMG_",
        extension: false,
    },
    PrefixQuery {
        class: "chinese_prefix",
        query: "数据库",
        extension: false,
    },
    PrefixQuery {
        class: "punctuation_prefix",
        query: "final-v2",
        extension: false,
    },
    PrefixQuery {
        class: "unicode_accented_prefix",
        query: "RÉSUMÉ",
        extension: false,
    },
    PrefixQuery {
        class: "extension_prefix",
        query: "jp",
        extension: true,
    },
];

const FTS_QUERIES: [(&str, &str); 4] = [
    ("fts_high_fanout_report", "report"),
    ("fts_high_fanout_invoice", "invoice"),
    ("fts_low_fanout", "0499981"),
    ("fts_no_result", "zzznomatchtoken"),
];

fn fts_phrase(query: &str) -> String {
    format!("\"{}\"", query.replace('"', "\"\""))
}

fn explain_details(conn: &Connection, sql: &str, values: &[SqlValue]) -> Vec<String> {
    let mut statement = conn
        .prepare(&format!("EXPLAIN QUERY PLAN {sql}"))
        .expect("prepare diagnostic EXPLAIN QUERY PLAN");
    statement
        .query_map(params_from_iter(values.iter()), |row| {
            row.get::<_, String>(3)
        })
        .expect("execute diagnostic EXPLAIN QUERY PLAN")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect diagnostic query plan")
}

fn sql_values_json(values: &[SqlValue]) -> Vec<JsonValue> {
    values
        .iter()
        .map(|value| match value {
            SqlValue::Null => JsonValue::Null,
            SqlValue::Integer(value) => json!(value),
            SqlValue::Real(value) => json!(value),
            SqlValue::Text(value) => json!(value),
            SqlValue::Blob(value) => json!({"blob_bytes": value.len()}),
        })
        .collect()
}

fn execute_count_once(
    conn: &Connection,
    sql: &str,
    values: &[SqlValue],
) -> (usize, f64, JsonValue) {
    let mut statement = conn.prepare(sql).expect("prepare staged diagnostic SQL");
    for status in [
        StatementStatus::Sort,
        StatementStatus::FullscanStep,
        StatementStatus::VmStep,
    ] {
        statement.reset_status(status);
    }
    let started = Instant::now();
    let count = statement
        .query_map(params_from_iter(values.iter()), |row| {
            row.get::<_, SqlValue>(0)
        })
        .expect("run staged diagnostic SQL")
        .try_fold(0_usize, |count, _row| Ok::<_, rusqlite::Error>(count + 1))
        .expect("drain staged diagnostic SQL");
    let elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0;
    let counters = json!({
        "sort_operations": statement.get_status(StatementStatus::Sort),
        "fullscan_steps": statement.get_status(StatementStatus::FullscanStep),
        "vm_steps": statement.get_status(StatementStatus::VmStep),
        "scope": "last execution; VM steps are work indicators, not CPU time or temp bytes"
    });
    (count, elapsed_ms, counters)
}

fn profile_sql_stage(
    conn: &Connection,
    context: &JsonValue,
    class: &str,
    query: &str,
    stage: &str,
    sql: &str,
    values: Vec<SqlValue>,
) -> usize {
    let mut last_count = 0;
    for _ in 0..STAGE_WARMUPS {
        last_count = execute_count_once(conn, sql, &values).0;
    }
    let mut samples = Vec::with_capacity(STAGE_SAMPLES);
    let mut last_counters = JsonValue::Null;
    for _ in 0..STAGE_SAMPLES {
        let (count, elapsed_ms, counters) = execute_count_once(conn, sql, &values);
        last_count = count;
        samples.push(elapsed_ms);
        last_counters = counters;
    }
    let plan = explain_details(conn, sql, &values);
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "query_stage",
        "context": context,
        "query_class": class,
        "query": query,
        "stage": stage,
        "result_count": last_count,
        "latency_ms": summarize_samples(&samples),
        "warmups": STAGE_WARMUPS,
        "sample_policy": "10 consecutive warm-cache samples after three warmups; same SQLite connection and fixture",
        "sql": sql,
        "parameters": sql_values_json(&values),
        "explain_query_plan": plan,
        "uses_temp_btree": plan.iter().any(|line| line.contains("USE TEMP B-TREE")),
        "possible_full_table_scan": plan.iter().any(|line| line.contains("SCAN ge") || line.contains("SCAN global_entries ")),
        "sqlite_statement_counters": last_counters,
        "timing_includes_prepare": false
    }));
    last_count
}

fn prefix_stage_sql(spec: PrefixQuery) -> Vec<(&'static str, String, Vec<SqlValue>)> {
    let (column, index, exact_filter, rank) = if spec.extension {
        (
            "extension",
            "idx_global_entries_active_extension_order",
            "ge.extension <> lower(?1)",
            "1.0",
        )
    } else {
        (
            "name_normalized",
            "idx_global_entries_active_name_order",
            "ge.name_normalized <> lower(?1)",
            "0.0",
        )
    };
    let query = spec.query.to_string();
    let pattern = format!("{}*", benchmark_escape_glob(spec.query));
    let mut stages = Vec::new();
    let index_only = format!(
        "SELECT ge.rowid FROM global_entries ge INDEXED BY {index} WHERE ge.is_stale = 0 AND ge.{column} GLOB ?2 AND {exact_filter}"
    );
    stages.push((
        "A_index_range_without_volume_join",
        index_only,
        vec![
            SqlValue::Text(query.clone()),
            SqlValue::Text(pattern.clone()),
        ],
    ));
    let active = format!(
        "SELECT ge.rowid FROM global_entries ge INDEXED BY {index} JOIN global_volumes gv ON gv.id = ge.volume_id WHERE gv.enabled = 1 AND ge.is_stale = 0 AND ge.{column} GLOB ?2 AND {exact_filter}"
    );
    stages.push((
        "B_active_volume_and_stale_filter",
        active,
        vec![
            SqlValue::Text(query.clone()),
            SqlValue::Text(pattern.clone()),
        ],
    ));
    let order_all = format!(
        "SELECT ge.rowid FROM global_entries ge INDEXED BY {index} JOIN global_volumes gv ON gv.id = ge.volume_id WHERE gv.enabled = 1 AND ge.is_stale = 0 AND ge.{column} GLOB ?2 AND {exact_filter} ORDER BY ge.modified_at_fs DESC, ge.id ASC"
    );
    stages.push((
        "C_global_recency_sort_all_matches",
        order_all,
        vec![
            SqlValue::Text(query.clone()),
            SqlValue::Text(pattern.clone()),
        ],
    ));
    for (stage, limit) in [
        ("D_global_recency_sort_limit_80", SEARCH_RESULT_LIMIT),
        (
            "E_global_recency_sort_limit_4096",
            SEARCH_CANDIDATE_LIMIT as u32,
        ),
    ] {
        let sql = format!(
            "SELECT ge.rowid FROM global_entries ge INDEXED BY {index} JOIN global_volumes gv ON gv.id = ge.volume_id WHERE gv.enabled = 1 AND ge.is_stale = 0 AND ge.{column} GLOB ?2 AND {exact_filter} ORDER BY ge.modified_at_fs DESC, ge.id ASC LIMIT ?3"
        );
        stages.push((
            stage,
            sql,
            vec![
                SqlValue::Text(query.clone()),
                SqlValue::Text(pattern.clone()),
                SqlValue::Integer(limit as i64),
            ],
        ));
    }
    let no_managed = format!(
        r#"
        SELECT ge.rowid, ge.id, ge.volume_id, ge.platform_file_id, ge.name,
               ge.path, ge.extension, ge.is_directory, ge.size,
               ge.created_at_fs, ge.modified_at_fs, ge.file_attributes,
               ge.is_hidden, ge.is_system, ge.source_provider,
               0 AS managed, {rank} AS rank
        FROM global_entries ge INDEXED BY {index}
        JOIN global_volumes gv ON gv.id = ge.volume_id
        WHERE gv.enabled = 1 AND ge.is_stale = 0
          AND ge.{column} GLOB ?2 AND {exact_filter}
        ORDER BY ge.modified_at_fs DESC, ge.id ASC
        LIMIT ?3
        "#
    );
    stages.push((
        "F_full_projection_without_managed_exists_limit_80",
        no_managed,
        vec![
            SqlValue::Text(query.clone()),
            SqlValue::Text(pattern.clone()),
            SqlValue::Integer(QUERY_LIMIT as i64),
        ],
    ));
    let production_mirror = candidate_plan_sql(
        &format!(
            "global_entries ge INDEXED BY {index} JOIN global_volumes gv ON gv.id = ge.volume_id"
        ),
        &format!("gv.enabled = 1 AND ge.is_stale = 0 AND ge.{column} GLOB ?2 AND {exact_filter}"),
        "ge.modified_at_fs DESC, ge.id ASC",
        rank,
        "?3",
    );
    stages.push((
        "G_full_production_tier_projection_and_managed_exists_limit_80",
        production_mirror,
        vec![
            SqlValue::Text(query),
            SqlValue::Text(pattern),
            SqlValue::Integer(QUERY_LIMIT as i64),
        ],
    ));
    stages
}

fn map_search_result(row: &rusqlite::Row<'_>) -> rusqlite::Result<GlobalSearchResult> {
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

fn run_result_sql(conn: &Connection, sql: &str, values: &[SqlValue]) -> Vec<GlobalSearchResult> {
    conn.prepare(sql)
        .expect("prepare diagnostic result query")
        .query_map(params_from_iter(values.iter()), map_search_result)
        .expect("execute diagnostic result query")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect diagnostic result query")
}

fn prefix_variant_values(query: &str, limit: u32) -> Vec<SqlValue> {
    vec![
        SqlValue::Text(query.to_string()),
        SqlValue::Text(format!("{}*", benchmark_escape_glob(query))),
        SqlValue::Integer(limit as i64),
    ]
}

fn fts_variant_values(query: &str, limit: u32) -> Vec<SqlValue> {
    vec![
        SqlValue::Text(fts_phrase(query)),
        SqlValue::Integer(limit as i64),
    ]
}

struct CandidateVariant<'a> {
    name: &'a str,
    sql: &'a str,
    values: Vec<SqlValue>,
}

fn time_results(
    mut run: impl FnMut() -> Vec<GlobalSearchResult>,
) -> (Vec<GlobalSearchResult>, f64) {
    let started = Instant::now();
    let results = run();
    (results, started.elapsed().as_secs_f64() * 1_000.0)
}

fn profile_paired_variant(
    context: &JsonValue,
    conn: &Connection,
    class: &str,
    query: &str,
    variant: CandidateVariant<'_>,
    production: impl Fn() -> Vec<GlobalSearchResult>,
) {
    let variant_name = variant.name;
    let variant_sql = variant.sql;
    let variant_values = &variant.values;
    let expected = production();
    let candidate = run_result_sql(conn, variant_sql, variant_values);
    assert_eq!(
        candidate, expected,
        "unwarmed {variant_name} mismatch for {query:?}"
    );
    for _ in 0..PAIRED_WARMUPS {
        assert_eq!(production(), expected);
        assert_eq!(run_result_sql(conn, variant_sql, variant_values), expected);
    }
    let mut production_samples = Vec::with_capacity(PAIRED_SAMPLES);
    let mut candidate_samples = Vec::with_capacity(PAIRED_SAMPLES);
    for index in 0..PAIRED_SAMPLES {
        if index % 2 == 0 {
            let (actual, elapsed) = time_results(&production);
            assert_eq!(actual, expected);
            production_samples.push(elapsed);
            let (actual, elapsed) =
                time_results(|| run_result_sql(conn, variant_sql, variant_values));
            assert_eq!(actual, expected);
            candidate_samples.push(elapsed);
        } else {
            let (actual, elapsed) =
                time_results(|| run_result_sql(conn, variant_sql, variant_values));
            assert_eq!(actual, expected);
            candidate_samples.push(elapsed);
            let (actual, elapsed) = time_results(&production);
            assert_eq!(actual, expected);
            production_samples.push(elapsed);
        }
    }
    let production_summary = summarize_samples(&production_samples);
    let candidate_summary = summarize_samples(&candidate_samples);
    let production_median = production_summary["p50"].as_f64().unwrap_or_default();
    let candidate_median = candidate_summary["p50"].as_f64().unwrap_or_default();
    let reduction_percent = if production_median > 0.0 {
        (production_median - candidate_median) / production_median * 100.0
    } else {
        0.0
    };
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "paired_sql_variant",
        "context": context,
        "query_class": class,
        "query": query,
        "variant": variant_name,
        "production_latency_ms": production_summary,
        "candidate_latency_ms": candidate_summary,
        "paired_order": "production-first and candidate-first alternate for each sample on the same Windows job, same database and connection",
        "warmups_per_variant": PAIRED_WARMUPS,
        "samples_per_variant": PAIRED_SAMPLES,
        "semantic_equivalent": true,
        "result_count": expected.len(),
        "result_ids_prefix": expected.iter().take(8).map(|row| row.id.clone()).collect::<Vec<_>>(),
        "candidate_sql": variant_sql,
        "candidate_parameters": sql_values_json(variant_values),
        "candidate_explain_query_plan": explain_details(conn, variant_sql, variant_values),
        "candidate_uses_temp_btree": explain_details(conn, variant_sql, variant_values).iter().any(|line| line.contains("USE TEMP B-TREE")),
        "p50_reduction_percent": reduction_percent,
        "p50_interpretation": "descriptive within-run comparison; not the official baseline gate"
    }));
}

fn record_production_results(
    context: &JsonValue,
    class: &str,
    query: &str,
    stage: &str,
    samples: Vec<f64>,
    results: &[GlobalSearchResult],
    timing_scope: &str,
) {
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "production_query_timing",
        "context": context,
        "query_class": class,
        "query": query,
        "stage": stage,
        "result_count": results.len(),
        "result_ids_prefix": results.iter().take(8).map(|row| row.id.clone()).collect::<Vec<_>>(),
        "latency_ms": summarize_samples(&samples),
        "warmups": PAIRED_WARMUPS,
        "sample_policy": format!("{} warm samples after {} warmups", samples.len(), PAIRED_WARMUPS),
        "timing_scope": timing_scope
    }));
}

fn source_health_candidate_name(candidate: SourceHealthCandidate) -> &'static str {
    match candidate {
        SourceHealthCandidate::Original => "original",
        SourceHealthCandidate::CorrelatedAggregates => "correlated_aggregates",
        SourceHealthCandidate::NarrowAggregate => "narrow_aggregate",
    }
}

fn measure_source_health_sql_once(
    conn: &Connection,
    candidate: SourceHealthCandidate,
) -> (usize, f64, JsonValue) {
    execute_count_once(conn, candidate.sql(), &[])
}

fn profile_source_health_sql_candidates(context: &JsonValue, conn: &Connection, path: &Path) {
    let original = SourceHealthCandidate::Original;
    for candidate in [
        SourceHealthCandidate::CorrelatedAggregates,
        SourceHealthCandidate::NarrowAggregate,
    ] {
        let mut original_rows = 0;
        let mut candidate_rows = 0;
        for _ in 0..PAIRED_WARMUPS {
            let (base_count, _, _) = measure_source_health_sql_once(conn, original);
            let (candidate_count, _, _) = measure_source_health_sql_once(conn, candidate);
            original_rows = base_count;
            candidate_rows = candidate_count;
            assert_eq!(base_count, candidate_count);
        }

        let mut original_samples = Vec::with_capacity(PAIRED_SAMPLES);
        let mut candidate_samples = Vec::with_capacity(PAIRED_SAMPLES);
        let mut original_counters = JsonValue::Null;
        let mut candidate_counters = JsonValue::Null;
        for sample in 0..PAIRED_SAMPLES {
            if sample % 2 == 0 {
                let (count, elapsed, counters) = measure_source_health_sql_once(conn, original);
                original_rows = count;
                original_samples.push(elapsed);
                original_counters = counters;
                let (count, elapsed, counters) = measure_source_health_sql_once(conn, candidate);
                candidate_rows = count;
                candidate_samples.push(elapsed);
                candidate_counters = counters;
            } else {
                let (count, elapsed, counters) = measure_source_health_sql_once(conn, candidate);
                candidate_rows = count;
                candidate_samples.push(elapsed);
                candidate_counters = counters;
                let (count, elapsed, counters) = measure_source_health_sql_once(conn, original);
                original_rows = count;
                original_samples.push(elapsed);
                original_counters = counters;
            }
            assert_eq!(original_rows, candidate_rows);
        }
        let original_plan = explain_details(conn, original.sql(), &[]);
        let candidate_plan = explain_details(conn, candidate.sql(), &[]);
        emit_record(&json!({
            "schema_version": 1,
            "record_type": "source_health_sql_paired",
            "context": context,
            "candidate": source_health_candidate_name(candidate),
            "pairing": "alternating execution order on same Windows runner, same SQLite connection and same 500k fixture",
            "warmups_per_variant": PAIRED_WARMUPS,
            "samples_per_variant": PAIRED_SAMPLES,
            "original": {
                "sql": original.sql(),
                "parameters": [],
                "row_count": original_rows,
                "latency_ms": summarize_samples(&original_samples),
                "explain_query_plan": original_plan,
                "sqlite_statement_counters": original_counters
            },
            "candidate_result": {
                "sql": candidate.sql(),
                "parameters": [],
                "row_count": candidate_rows,
                "latency_ms": summarize_samples(&candidate_samples),
                "explain_query_plan": candidate_plan,
                "sqlite_statement_counters": candidate_counters
            },
            "database": database_metrics(conn, path),
            "schema_or_index_changes": false
        }));
    }
}

fn measure_source_health_function_once(
    conn: &mut Connection,
    candidate: SourceHealthCandidate,
) -> (DiagnosticSourceHealth, f64) {
    let transaction = conn
        .transaction()
        .expect("begin source-health function sample");
    let started = Instant::now();
    let result = load_global_search_source_health_candidate(&transaction, candidate)
        .expect("run complete source-health function candidate");
    let elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0;
    transaction
        .commit()
        .expect("commit source-health function sample");
    (result, elapsed_ms)
}

fn profile_source_health_functions(db: &Database, path: &Path, context: &JsonValue) {
    let mut conn = db.conn().expect("borrow source-health function connection");
    let original = SourceHealthCandidate::Original;
    for candidate in [
        SourceHealthCandidate::CorrelatedAggregates,
        SourceHealthCandidate::NarrowAggregate,
    ] {
        for _ in 0..PAIRED_WARMUPS {
            let (baseline, _) = measure_source_health_function_once(&mut conn, original);
            let (optimized, _) = measure_source_health_function_once(&mut conn, candidate);
            assert_eq!(baseline, optimized);
        }

        let mut original_samples = Vec::with_capacity(PAIRED_SAMPLES);
        let mut candidate_samples = Vec::with_capacity(PAIRED_SAMPLES);
        let mut facts_match = true;
        for sample in 0..PAIRED_SAMPLES {
            let (baseline, baseline_ms, optimized, candidate_ms) = if sample % 2 == 0 {
                let (baseline, baseline_ms) =
                    measure_source_health_function_once(&mut conn, original);
                let (optimized, candidate_ms) =
                    measure_source_health_function_once(&mut conn, candidate);
                (baseline, baseline_ms, optimized, candidate_ms)
            } else {
                let (optimized, candidate_ms) =
                    measure_source_health_function_once(&mut conn, candidate);
                let (baseline, baseline_ms) =
                    measure_source_health_function_once(&mut conn, original);
                (baseline, baseline_ms, optimized, candidate_ms)
            };
            facts_match &= baseline == optimized;
            assert_eq!(baseline, optimized);
            original_samples.push(baseline_ms);
            candidate_samples.push(candidate_ms);
        }
        emit_record(&json!({
            "schema_version": 1,
            "record_type": "source_health_function_paired",
            "context": context,
            "candidate": source_health_candidate_name(candidate),
            "pairing": "alternating execution order, same pooled SQLite connection, each call in a fresh read transaction",
            "warmups_per_variant": PAIRED_WARMUPS,
            "samples_per_variant": PAIRED_SAMPLES,
            "original": summarize_samples(&original_samples),
            "candidate_result": summarize_samples(&candidate_samples),
            "complete_source_health_equal": facts_match,
            "revision_facts_bytes_and_blake3_equal": facts_match,
            "database": database_metrics(&conn, path),
            "timing_scope": "query execution, row mapping, revision-facts JSON serialization and BLAKE3; excludes pool checkout and transaction setup"
        }));
    }
}

fn run_snapshot_variant(
    db: &Database,
    query: &str,
    candidate: SourceHealthCandidate,
) -> GlobalSearchSnapshot {
    db.search_global_entries_snapshot_with_source_health_candidate(query, QUERY_LIMIT, 0, candidate)
        .expect("run diagnostic repository snapshot variant")
}

fn assert_snapshot_results_equal(
    original: &GlobalSearchSnapshot,
    candidate: &GlobalSearchSnapshot,
) {
    assert_eq!(original.results, candidate.results);
    assert_eq!(original.source_health, candidate.source_health);
    assert_eq!(
        original.source_revision.as_bytes(),
        candidate.source_revision.as_bytes()
    );
    assert_eq!(original.index_status, candidate.index_status);
}

fn profile_repository_snapshot_candidates(db: &Database, path: &Path, context: &JsonValue) {
    for (class, query) in [
        ("no_result", "zzznomatchtoken"),
        ("name_prefix", "quarterly"),
        ("fts_high_fanout_report", "report"),
    ] {
        let original_kind = SourceHealthCandidate::Original;
        for candidate in [
            SourceHealthCandidate::CorrelatedAggregates,
            SourceHealthCandidate::NarrowAggregate,
        ] {
            for _ in 0..PAIRED_WARMUPS {
                let original = run_snapshot_variant(db, query, original_kind);
                let optimized = run_snapshot_variant(db, query, candidate);
                assert_snapshot_results_equal(&original, &optimized);
            }
            let mut original_samples = Vec::with_capacity(PAIRED_SAMPLES);
            let mut candidate_samples = Vec::with_capacity(PAIRED_SAMPLES);
            for sample in 0..PAIRED_SAMPLES {
                let (original, original_ms, optimized, candidate_ms) = if sample % 2 == 0 {
                    let started = Instant::now();
                    let original = run_snapshot_variant(db, query, original_kind);
                    let original_ms = started.elapsed().as_secs_f64() * 1_000.0;
                    let started = Instant::now();
                    let optimized = run_snapshot_variant(db, query, candidate);
                    let candidate_ms = started.elapsed().as_secs_f64() * 1_000.0;
                    (original, original_ms, optimized, candidate_ms)
                } else {
                    let started = Instant::now();
                    let optimized = run_snapshot_variant(db, query, candidate);
                    let candidate_ms = started.elapsed().as_secs_f64() * 1_000.0;
                    let started = Instant::now();
                    let original = run_snapshot_variant(db, query, original_kind);
                    let original_ms = started.elapsed().as_secs_f64() * 1_000.0;
                    (original, original_ms, optimized, candidate_ms)
                };
                assert_snapshot_results_equal(&original, &optimized);
                original_samples.push(original_ms);
                candidate_samples.push(candidate_ms);
            }
            let final_snapshot = run_snapshot_variant(db, query, candidate);
            emit_record(&json!({
                "schema_version": 1,
                "record_type": "repository_snapshot_paired",
                "context": context,
                "query_class": class,
                "query": query,
                "candidate": source_health_candidate_name(candidate),
                "pairing": "alternating complete snapshot calls, same 500k database and connection pool; each call performs search, source-health/revision and index status in one read transaction",
                "warmups_per_variant": PAIRED_WARMUPS,
                "samples_per_variant": PAIRED_SAMPLES,
                "original": summarize_samples(&original_samples),
                "candidate_result": summarize_samples(&candidate_samples),
                "source_health_equal": true,
                "source_revision_byte_equal": true,
                "index_status_equal": true,
                "search_results_equal": true,
                "result_count": final_snapshot.results.len(),
                "database": database_metrics(
                    &db.conn().expect("borrow database metrics connection"),
                    path,
                )
            }));
        }

        // The candidate selected for production is also exercised through the
        // public repository entry point on this same large fixture.
        let candidate = SourceHealthCandidate::NarrowAggregate;
        for _ in 0..PAIRED_WARMUPS {
            let actual = db
                .search_global_entries_snapshot(query, QUERY_LIMIT, 0)
                .expect("warm production repository snapshot");
            let candidate_snapshot = run_snapshot_variant(db, query, candidate);
            assert_snapshot_results_equal(&actual, &candidate_snapshot);
        }
        let mut production_samples = Vec::with_capacity(PAIRED_SAMPLES);
        let mut candidate_samples = Vec::with_capacity(PAIRED_SAMPLES);
        for sample in 0..PAIRED_SAMPLES {
            let (production, production_ms, candidate_snapshot, candidate_ms) = if sample % 2 == 0 {
                let started = Instant::now();
                let production = db
                    .search_global_entries_snapshot(query, QUERY_LIMIT, 0)
                    .expect("measure actual production repository snapshot");
                let production_ms = started.elapsed().as_secs_f64() * 1_000.0;
                let started = Instant::now();
                let candidate_snapshot = run_snapshot_variant(db, query, candidate);
                let candidate_ms = started.elapsed().as_secs_f64() * 1_000.0;
                (production, production_ms, candidate_snapshot, candidate_ms)
            } else {
                let started = Instant::now();
                let candidate_snapshot = run_snapshot_variant(db, query, candidate);
                let candidate_ms = started.elapsed().as_secs_f64() * 1_000.0;
                let started = Instant::now();
                let production = db
                    .search_global_entries_snapshot(query, QUERY_LIMIT, 0)
                    .expect("measure actual production repository snapshot");
                let production_ms = started.elapsed().as_secs_f64() * 1_000.0;
                (production, production_ms, candidate_snapshot, candidate_ms)
            };
            assert_snapshot_results_equal(&production, &candidate_snapshot);
            production_samples.push(production_ms);
            candidate_samples.push(candidate_ms);
        }
        emit_record(&json!({
            "schema_version": 1,
            "record_type": "production_repository_snapshot_validation",
            "context": context,
            "query_class": class,
            "query": query,
            "candidate": source_health_candidate_name(candidate),
            "pairing": "actual Database::search_global_entries_snapshot and test-only candidate snapshot alternate on the same 500k fixture; both use a read transaction for search, source facts and index status",
            "warmups_per_variant": PAIRED_WARMUPS,
            "samples_per_variant": PAIRED_SAMPLES,
            "production_entrypoint": summarize_samples(&production_samples),
            "candidate_snapshot_helper": summarize_samples(&candidate_samples),
            "source_health_equal": true,
            "source_revision_byte_equal": true,
            "index_status_equal": true,
            "search_results_equal": true
        }));
    }
}

fn measure_production_tier(
    context: &JsonValue,
    conn: &Connection,
    class: &str,
    query: &str,
    tier: &str,
    limit: u32,
    sample_count: usize,
) -> Vec<GlobalSearchResult> {
    let run = || {
        diagnostic_search_tier(conn, tier, query, limit)
            .unwrap_or_else(|error| panic!("run production {tier} tier: {error}"))
    };
    let expected = run();
    for _ in 0..PAIRED_WARMUPS {
        assert_eq!(run(), expected);
    }
    let mut samples = Vec::with_capacity(sample_count);
    for _ in 0..sample_count {
        let (results, elapsed) = time_results(run);
        assert_eq!(results, expected);
        samples.push(elapsed);
    }
    record_production_results(
        context,
        class,
        query,
        "production_tier_exact_helper",
        samples,
        &expected,
        "search.rs test-only wrapper around the actual production tier; connection reuse; includes statement preparation and result mapping",
    );
    expected
}

fn profile_full_search_entrypoint(
    context: &JsonValue,
    db: &Database,
    conn: &Connection,
    path: &Path,
    class: &str,
    query: &str,
) -> Vec<GlobalSearchResult> {
    let expected = db
        .search_global_entries(query, QUERY_LIMIT, 0)
        .expect("warm Global Search through pooled Database entrypoint");
    for _ in 0..PAIRED_WARMUPS {
        assert_eq!(
            db.search_global_entries(query, QUERY_LIMIT, 0)
                .expect("warm Global Search through pooled Database entrypoint"),
            expected
        );
    }
    let mut pooled_samples = Vec::with_capacity(PAIRED_SAMPLES);
    for _ in 0..PAIRED_SAMPLES {
        let started = Instant::now();
        let results = db
            .search_global_entries(query, QUERY_LIMIT, 0)
            .expect("search through pooled Database entrypoint");
        pooled_samples.push(started.elapsed().as_secs_f64() * 1_000.0);
        assert_eq!(results, expected);
    }
    record_production_results(
        context,
        class,
        query,
        "full_search_database_pool_entrypoint",
        pooled_samples,
        &expected,
        "Database::search_global_entries, includes pool checkout and all production tiers",
    );

    let snapshot_expected = db
        .search_global_entries_snapshot(query, QUERY_LIMIT, 0)
        .expect("warm repository search snapshot")
        .results;
    assert_eq!(snapshot_expected, expected);
    for _ in 0..PAIRED_WARMUPS {
        assert_eq!(
            db.search_global_entries_snapshot(query, QUERY_LIMIT, 0)
                .expect("warm repository search snapshot")
                .results,
            expected
        );
    }
    let mut snapshot_samples = Vec::with_capacity(PAIRED_SAMPLES);
    for _ in 0..PAIRED_SAMPLES {
        let started = Instant::now();
        let snapshot = db
            .search_global_entries_snapshot(query, QUERY_LIMIT, 0)
            .expect("search with repository snapshot facts");
        snapshot_samples.push(started.elapsed().as_secs_f64() * 1_000.0);
        assert_eq!(snapshot.results, expected);
    }
    record_production_results(
        context,
        class,
        query,
        "full_search_repository_snapshot",
        snapshot_samples,
        &expected,
        "GlobalIndexRepository snapshot read transaction plus source health, revision and index status; excludes Tauri command/coordinator serialization",
    );

    let expected_connection = search_global_entries_on_connection(conn, query, QUERY_LIMIT, 0)
        .expect("search on persistent diagnostic connection");
    assert_eq!(expected_connection, expected);
    let mut connection_samples = Vec::with_capacity(PAIRED_SAMPLES);
    for _ in 0..PAIRED_SAMPLES {
        let started = Instant::now();
        let results = search_global_entries_on_connection(conn, query, QUERY_LIMIT, 0)
            .expect("search on persistent diagnostic connection");
        connection_samples.push(started.elapsed().as_secs_f64() * 1_000.0);
        assert_eq!(results, expected);
    }
    record_production_results(
        context,
        class,
        query,
        "full_search_persistent_connection",
        connection_samples,
        &expected,
        "search_global_entries_on_connection; excludes pool checkout and repository source/status snapshot",
    );

    if matches!(
        class,
        "name_prefix"
            | "common_prefix_high_fanout"
            | "fts_high_fanout_report"
            | "fts_high_fanout_invoice"
    ) {
        let mut reopened_samples = Vec::with_capacity(PAIRED_SAMPLES);
        for _ in 0..PAIRED_WARMUPS {
            let reopened =
                configured_connection(path).expect("open warmup reopened SQLite connection");
            assert_eq!(
                search_global_entries_on_connection(&reopened, query, QUERY_LIMIT, 0)
                    .expect("warm search on reopened SQLite connection"),
                expected
            );
        }
        for _ in 0..PAIRED_SAMPLES {
            let reopened = configured_connection(path).expect("open reopened SQLite connection");
            let started = Instant::now();
            let results = search_global_entries_on_connection(&reopened, query, QUERY_LIMIT, 0)
                .expect("search on reopened SQLite connection");
            reopened_samples.push(started.elapsed().as_secs_f64() * 1_000.0);
            assert_eq!(results, expected);
        }
        record_production_results(
            context,
            class,
            query,
            "full_search_reopened_connection",
            reopened_samples,
            &expected,
            "each sample opens a fresh configured SQLite connection outside the timed interval; the operating-system file cache is not cleared",
        );
    }
    expected
}

fn add_volume(db: &Database, id: &str, enabled: bool) {
    let mut volume = super::super::test_volume();
    volume.id = id.to_string();
    volume.stable_volume_id = format!("issue352-{id}");
    volume.display_name = id.to_string();
    volume.mount_path = format!(r"C:\{id}\");
    volume.enabled = enabled;
    db.upsert_global_volume(&volume)
        .expect("add adversarial test volume");
}

fn rollback_insert_samples(conn: &Connection, samples: usize, rows_per_sample: u64) -> Vec<f64> {
    let rows = (0..rows_per_sample)
        .map(|offset| super::generated_entry(DIAGNOSTIC_ENTRIES + 10_000 + offset))
        .collect::<Vec<_>>();
    let mut timings = Vec::with_capacity(samples);
    for _ in 0..samples {
        let transaction = conn
            .unchecked_transaction()
            .expect("begin rollback-only index maintenance sample");
        let mut statement = transaction
            .prepare(INSERT_SYNTHETIC_ENTRY)
            .expect("prepare rollback-only index maintenance insert");
        let started = Instant::now();
        for entry in &rows {
            statement
                .execute(params![
                    entry.id,
                    "gv_test",
                    entry.platform_file_id,
                    entry.parent_platform_file_id,
                    entry.name,
                    entry.name_normalized,
                    entry.path,
                    entry.path_normalized,
                    entry.extension,
                    0_i64,
                    entry.size,
                    entry.created_at_fs,
                    entry.modified_at_fs,
                    entry.file_attributes,
                    i64::from(entry.is_hidden),
                    i64::from(entry.is_system),
                    0_i64,
                    "issue352_index_write_cost",
                    1_700_600_000_i64 + entry.index as i64,
                ])
                .expect("insert rollback-only index maintenance row");
        }
        timings.push(started.elapsed().as_secs_f64() * 1_000.0);
        drop(statement);
        transaction
            .rollback()
            .expect("rollback index maintenance sample rows");
    }
    timings
}

fn insert_diagnostic_entry(
    conn: &Connection,
    id: &str,
    volume_id: &str,
    name: &str,
    path: &str,
    modified_at: i64,
) {
    let normalized_name = name.to_lowercase();
    let normalized_path = path.to_lowercase();
    let extension = name
        .rsplit_once('.')
        .map(|(_, suffix)| suffix.to_lowercase())
        .unwrap_or_default();
    conn.execute(
        INSERT_SYNTHETIC_ENTRY,
        params![
            id,
            volume_id,
            id,
            "issue352-parent",
            name,
            normalized_name,
            path,
            normalized_path,
            extension,
            0_i64,
            1_i64,
            1_700_000_000_i64,
            modified_at,
            0_i64,
            0_i64,
            0_i64,
            0_i64,
            "issue352_query_cost_diagnostic",
            1_700_000_000_i64,
        ],
    )
    .unwrap_or_else(|error| panic!("insert adversarial entry {id}: {error}"));
}

fn populate_scale_overlay(conn: &Connection) -> (f64, Vec<(String, usize)>) {
    let started = Instant::now();
    let transaction = conn
        .unchecked_transaction()
        .expect("begin match-scale overlay transaction");
    let mut statement = transaction
        .prepare(INSERT_SYNTHETIC_ENTRY)
        .expect("prepare scale overlay insert");
    for (label, count) in [
        ("scale5", 5_usize),
        ("scale100", 100),
        ("scale1000", 1_000),
        ("scale4096", 4_096),
        ("scale10000", 10_000),
        ("scale25000", 25_000),
    ] {
        for index in 0..count {
            let id = format!("issue352-{label}-{index:05}");
            let name = format!("{label} candidate {index:05}.txt");
            let normalized_name = name.to_lowercase();
            let path = format!(r"C:\Issue352Scale\{label}\{name}");
            let normalized_path = path.to_lowercase();
            statement
                .execute(params![
                    id,
                    "gv_test",
                    id,
                    "issue352-scale-parent",
                    name,
                    normalized_name,
                    path,
                    normalized_path,
                    "txt",
                    0_i64,
                    1_i64,
                    1_700_500_000_i64,
                    1_700_500_000_i64 + index as i64,
                    0_i64,
                    0_i64,
                    0_i64,
                    0_i64,
                    "issue352_query_cost_scale",
                    1_700_500_000_i64,
                ])
                .unwrap_or_else(|error| panic!("insert match-scale overlay row: {error}"));
        }
    }
    drop(statement);

    let mut actual = Vec::new();
    for (label, expected) in [
        ("zzznomatchtoken", 0_usize),
        ("scale5", 5),
        ("scale100", 100),
        ("scale1000", 1_000),
        ("scale4096", 4_096),
        ("scale10000", 10_000),
        ("scale25000", 25_000),
    ] {
        let query = if expected == 0 {
            label.to_string()
        } else {
            format!("{label} ")
        };
        let glob = format!("{}*", benchmark_escape_glob(&query));
        let actual_count: i64 = transaction
            .query_row(
                "SELECT COUNT(*) FROM global_entries ge JOIN global_volumes gv ON gv.id = ge.volume_id WHERE gv.enabled = 1 AND ge.is_stale = 0 AND ge.name_normalized GLOB ?1",
                [glob],
                |row| row.get(0),
            )
            .expect("count scale overlay matches");
        assert_eq!(actual_count as usize, expected, "scale count for {label}");
        actual.push((label.to_string(), expected));
    }
    let overlay_entries: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM global_entries WHERE id LIKE 'issue352-scale%'",
            [],
            |row| row.get(0),
        )
        .expect("count temporary scale rows");
    assert_eq!(
        overlay_entries, 40_201,
        "count temporary scale overlay rows"
    );

    for (label, expected) in &actual {
        let query = if label.starts_with("zzz") {
            label.clone()
        } else {
            format!("{label} ")
        };
        let count_sql = "SELECT ge.rowid FROM global_entries ge INDEXED BY idx_global_entries_active_name_order JOIN global_volumes gv ON gv.id = ge.volume_id WHERE gv.enabled = 1 AND ge.is_stale = 0 AND ge.name_normalized GLOB ?1 ORDER BY ge.modified_at_fs DESC, ge.id ASC LIMIT ?2";
        let values = vec![
            SqlValue::Text(format!("{}*", benchmark_escape_glob(&query))),
            SqlValue::Integer(QUERY_LIMIT as i64),
        ];
        let returned = profile_sql_stage(
            &transaction,
            &json!({"entries_before_overlay": DIAGNOSTIC_ENTRIES, "overlay_rows": overlay_entries}),
            "match_count_scaling",
            &query,
            "production_name_prefix_order_limit_80",
            count_sql,
            values,
        );
        assert_eq!(returned, (*expected).min(QUERY_LIMIT as usize));
    }
    transaction
        .rollback()
        .expect("rollback temporary match-scale overlay");
    (started.elapsed().as_secs_f64() * 1_000.0, actual)
}

fn add_adversarial_rows(db: &Database, conn: &mut Connection, context: &JsonValue) {
    add_volume(db, "gv_issue352_second_enabled", true);
    add_volume(db, "gv_issue352_disabled", false);
    let transaction = conn
        .unchecked_transaction()
        .expect("begin adversarial semantic transaction");

    for index in 0..100 {
        insert_diagnostic_entry(
            &transaction,
            &format!("issue352-disabled-quarterly-{index:03}"),
            "gv_issue352_disabled",
            &format!("Quarterly Review 2026 disabled-{index:03}.pdf"),
            &format!(r"C:\Disabled\Quarterly\{index:03}.pdf"),
            1_900_000_000 + index,
        );
        insert_diagnostic_entry(
            &transaction,
            &format!("issue352-stale-quarterly-{index:03}"),
            "gv_test",
            &format!("Quarterly Review 2026 stale-{index:03}.pdf"),
            &format!(r"C:\Stale\Quarterly\{index:03}.pdf"),
            1_950_000_000 + index,
        );
        insert_diagnostic_entry(
            &transaction,
            &format!("issue352-disabled-report-{index:03}"),
            "gv_issue352_disabled",
            "report.txt",
            &format!(r"C:\Disabled\r{index:03}.txt"),
            1_900_000_000 + index,
        );
        insert_diagnostic_entry(
            &transaction,
            &format!("issue352-stale-report-{index:03}"),
            "gv_test",
            "report.txt",
            &format!(r"C:\Stale\r{index:03}.txt"),
            1_950_000_000 + index,
        );
    }
    transaction
        .execute(
            "UPDATE global_entries SET is_stale = 1 WHERE id LIKE 'issue352-stale-%'",
            [],
        )
        .expect("mark adversarial stale rows");

    insert_diagnostic_entry(
        &transaction,
        "issue352-tie-a",
        "gv_test",
        "Quarterly Review 2026 duplicate.pdf",
        r"C:\Shared\Quarterly\duplicate.pdf",
        1_800_000_000,
    );
    insert_diagnostic_entry(
        &transaction,
        "issue352-tie-b",
        "gv_issue352_second_enabled",
        "Quarterly Review 2026 duplicate.pdf",
        r"C:\Shared\Quarterly\duplicate.pdf",
        1_800_000_000,
    );
    insert_diagnostic_entry(
        &transaction,
        "issue352-managed",
        "gv_test",
        "Quarterly Review 2026 managed.pdf",
        r"C:\Managed\Quarterly\managed.pdf",
        1_790_000_000,
    );
    insert_diagnostic_entry(
        &transaction,
        "issue352-unmanaged",
        "gv_test",
        "Quarterly Review 2026 unmanaged.pdf",
        r"C:\Unmanaged\Quarterly\unmanaged.pdf",
        1_780_000_000,
    );
    transaction
        .execute_batch(
            r#"
            INSERT INTO managed_scopes (
                id, path, global_entry_id, enabled, allow_local_ai, allow_cloud_ai,
                created_at, updated_at
            ) VALUES (
                'issue352-scope', 'C:\Managed\Quarterly', 'issue352-managed',
                1, 1, 0, 1700000000, 1700000000
            );
            INSERT INTO managed_entries (
                id, global_entry_id, managed_scope_id, enabled, created_at, updated_at
            ) VALUES (
                'issue352-managed-row', 'issue352-managed', 'issue352-scope',
                1, 1700000000, 1700000000
            );
            "#,
        )
        .expect("add managed marker to the enabled test scope");

    let production = diagnostic_search_tier(&transaction, "name_prefix", "quarterly", 80)
        .expect("run production prefix tier on adversarial rows");
    let values = prefix_variant_values("quarterly", 80);
    let safe = run_result_sql(&transaction, SAFE_PREFIX_CTE_SQL, &values);
    assert_eq!(
        safe, production,
        "safe prefix CTE must preserve every result field"
    );
    assert!(production.iter().any(|row| row.id == "issue352-tie-a"));
    let tie_a = production
        .iter()
        .position(|row| row.id == "issue352-tie-a")
        .expect("first tied entry");
    let tie_b = production
        .iter()
        .position(|row| row.id == "issue352-tie-b")
        .expect("second tied entry");
    assert!(tie_a < tie_b, "ID tie-break must remain ascending");
    assert!(production
        .iter()
        .any(|row| row.id == "issue352-managed" && row.managed));
    assert!(production
        .iter()
        .any(|row| row.id == "issue352-unmanaged" && !row.managed));
    assert!(!production.iter().any(|row| row.id.contains("disabled")));
    assert!(!production.iter().any(|row| row.id.contains("stale")));

    let production_4096 = diagnostic_search_tier(
        &transaction,
        "name_prefix",
        "quarterly",
        SEARCH_CANDIDATE_LIMIT as u32,
    )
    .expect("collect production prefix candidate window");
    let safe_4096 = run_result_sql(
        &transaction,
        SAFE_PREFIX_CTE_SQL,
        &prefix_variant_values("quarterly", SEARCH_CANDIDATE_LIMIT as u32),
    );
    assert_eq!(
        safe_4096, production_4096,
        "4096-candidate prefix CTE equivalence"
    );
    let production_page = search_global_entries_on_connection(&transaction, "quarterly", 80, 4_016)
        .expect("production search at candidate-window boundary");
    assert_eq!(production_page, production_4096[4_016..4_096]);
    assert!(
        search_global_entries_on_connection(&transaction, "quarterly", 80, 4_096)
            .expect("production search after candidate cap")
            .is_empty()
    );
    assert_eq!(
        search_global_entries_on_connection(&transaction, "quarterly", 500, 0)
            .expect("production search limit clamp")
            .len(),
        200
    );
    let clamped_production = search_global_entries_on_connection(&transaction, "quarterly", 500, 0)
        .expect("production search result at clamped limit");
    let clamped_candidate = run_result_sql(
        &transaction,
        SAFE_PREFIX_CTE_SQL,
        &prefix_variant_values("quarterly", 200),
    );
    assert_eq!(clamped_candidate, clamped_production);

    let duplicate_tier_results = search_global_entries_on_connection(
        &transaction,
        "Quarterly Review 2026 duplicate.pdf",
        80,
        0,
    )
    .expect("search duplicate basename across two enabled volumes");
    assert_eq!(
        duplicate_tier_results
            .iter()
            .map(|row| row.id.as_str())
            .collect::<std::collections::HashSet<_>>()
            .len(),
        duplicate_tier_results.len(),
        "tier overlap must be deduplicated by stable entry ID"
    );
    assert_eq!(duplicate_tier_results.len(), 2);
    assert!(duplicate_tier_results
        .iter()
        .any(|row| row.id == "issue352-tie-a"));
    assert!(duplicate_tier_results
        .iter()
        .any(|row| row.id == "issue352-tie-b"));

    let unsafe_prefix = r#"
        WITH candidates AS MATERIALIZED (
            SELECT ge.rowid AS entry_rowid, ge.modified_at_fs, ge.id
            FROM global_entries ge INDEXED BY idx_global_entries_active_name_order
            WHERE ge.is_stale = 0 AND ge.name_normalized GLOB ?1
            ORDER BY ge.modified_at_fs DESC, ge.id ASC
            LIMIT ?2
        )
        SELECT ge.rowid
        FROM candidates
        JOIN global_entries ge ON ge.rowid = candidates.entry_rowid
        JOIN global_volumes gv ON gv.id = ge.volume_id
        WHERE gv.enabled = 1 AND ge.is_stale = 0
        ORDER BY candidates.modified_at_fs DESC, candidates.id ASC
    "#;
    let unsafe_count = run_count_sql(
        &transaction,
        unsafe_prefix,
        &[
            SqlValue::Text("quarterly*".to_string()),
            SqlValue::Integer(80),
        ],
    );
    assert!(
        unsafe_count < 80,
        "limit-before-enabled-filter should underfill"
    );
    assert_eq!(
        production.len(),
        80,
        "filtered-first production query must fill page"
    );

    let fts_production = diagnostic_search_fts(&transaction, "report", 80)
        .expect("run production FTS tier on adversarial rows");
    let fts_safe = run_result_sql(
        &transaction,
        SAFE_FTS_CTE_SQL,
        &fts_variant_values("report", 80),
    );
    assert_eq!(
        fts_safe, fts_production,
        "safe FTS CTE must preserve every result field"
    );
    assert!(!fts_production.iter().any(|row| row.id.contains("disabled")));
    assert!(!fts_production.iter().any(|row| row.id.contains("stale")));

    let unsafe_fts = r#"
        WITH candidates AS MATERIALIZED (
            SELECT ge.rowid AS entry_rowid,
                   ge.modified_at_fs,
                   ge.id,
                   bm25(global_entries_fts, 8.0, 2.0, 1.0) AS rank
            FROM global_entries_fts
            CROSS JOIN global_entries ge
            WHERE global_entries_fts MATCH ?1
              AND ge.rowid = global_entries_fts.rowid
            ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC
            LIMIT ?2
        )
        SELECT ge.rowid
        FROM candidates
        CROSS JOIN global_entries ge
        CROSS JOIN global_volumes gv
        WHERE ge.rowid = candidates.entry_rowid
          AND gv.id = ge.volume_id
          AND gv.enabled = 1
          AND ge.is_stale = 0
        ORDER BY candidates.rank ASC, candidates.modified_at_fs DESC, candidates.id ASC
    "#;
    let unsafe_fts_count = run_count_sql(
        &transaction,
        unsafe_fts,
        &[SqlValue::Text(fts_phrase("report")), SqlValue::Integer(80)],
    );
    assert!(
        unsafe_fts_count < 80,
        "limit-before-FTS-eligibility filter should underfill"
    );

    let fts_plan = explain_details(
        &transaction,
        &diagnostic_search_fts_sql(),
        &fts_variant_values("report", 80),
    );
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "semantic_equivalence_gate",
        "context": context,
        "production_vs_safe_prefix_cte_fields_equal": true,
        "production_vs_safe_fts_cte_fields_equal": true,
        "safe_prefix_cte_equal_through_4096": true,
        "limit_80_offset_4016_equal": true,
        "offset_4096_returns_empty": true,
        "limit_clamps_to_200": true,
        "tier_overlap_deduplicates_by_stable_entry_id": true,
        "enabled_volumes": 2,
        "disabled_volume_rows_excluded": true,
        "stale_rows_excluded": true,
        "managed_and_unmanaged_projection_equal": true,
        "duplicate_basename_and_cross_volume_same_path_preserved": true,
        "equal_mtime_id_tie_order_equal": true,
        "unsafe_prefix_filter_after_limit_returned": unsafe_count,
        "unsafe_fts_filter_after_limit_returned": unsafe_fts_count,
        "unsafe_variants_underfilled_80_row_page": true,
        "production_fts_plan": fts_plan,
        "fixture_is_transactional_and_rolled_back": true
    }));

    transaction
        .rollback()
        .expect("rollback adversarial semantic rows");
}

fn run_count_sql(conn: &Connection, sql: &str, values: &[SqlValue]) -> usize {
    conn.prepare(sql)
        .expect("prepare count diagnostic SQL")
        .query_map(params_from_iter(values.iter()), |row| row.get::<_, i64>(0))
        .expect("execute count diagnostic SQL")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect count diagnostic SQL")
        .len()
}

#[test]
#[ignore = "single 500k-row Issue #352 query-stage diagnostic; one reusable Windows Hosted fixture"]
fn global_search_query_cost_diagnostic() {
    assert_eq!(
        env::var("ZC_GLOBAL_SEARCH_BENCHMARK_ENTRIES")
            .ok()
            .as_deref(),
        Some("500000"),
        "Issue #352 diagnostic is fixed at 500,000 rows; it must not become a 1m run"
    );
    let output_path = env::var("ZC_GLOBAL_SEARCH_BENCHMARK_OUTPUT").ok();
    if let Some(path) = &output_path {
        let path = PathBuf::from(path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create query-cost evidence directory");
        }
        fs::write(path, "").expect("truncate query-cost JSONL evidence");
    }

    let context = benchmark_context(DIAGNOSTIC_ENTRIES);
    let path = test_db_path();
    let _cleanup = BenchmarkCleanup(path.clone());
    let db = Database::open(&path).expect("open single 500k diagnostic SQLite fixture");
    db.upsert_global_volume(&super::super::test_volume())
        .expect("insert the base enabled synthetic volume");
    let population_started = Instant::now();
    let (expectations, generation_ms, population_ms, transaction_samples) =
        populate_synthetic_database(&db, DIAGNOSTIC_ENTRIES);
    let fixture_elapsed_ms = population_started.elapsed().as_secs_f64() * 1_000.0;
    let conn = configured_connection(&path).expect("open configured query-cost reader");

    let sqlite_version: String = conn
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .expect("read SQLite version");
    let pragmas = json!({
        "journal_mode": conn.query_row("PRAGMA journal_mode", [], |row| row.get::<_, String>(0)).expect("journal mode"),
        "synchronous": conn.query_row("PRAGMA synchronous", [], |row| row.get::<_, i64>(0)).expect("synchronous"),
        "foreign_keys": conn.query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0)).expect("foreign keys"),
        "temp_store": conn.query_row("PRAGMA temp_store", [], |row| row.get::<_, i64>(0)).expect("temp store"),
        "mmap_size": conn.query_row("PRAGMA mmap_size", [], |row| row.get::<_, i64>(0)).expect("mmap size"),
        "page_size": conn.query_row("PRAGMA page_size", [], |row| row.get::<_, i64>(0)).expect("page size")
    });
    let actual_total: i64 = conn
        .query_row("SELECT COUNT(*) FROM global_entries", [], |row| row.get(0))
        .expect("count exact base fixture entries");
    assert_eq!(actual_total, DIAGNOSTIC_ENTRIES as i64);
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "diagnostic_environment_and_dataset",
        "context": context,
        "runner": {
            "os": env::consts::OS,
            "arch": env::consts::ARCH,
            "image_os": env::var("ImageOS").ok(),
            "image_version": env::var("ImageVersion").ok(),
            "github_job": env::var("GITHUB_JOB").ok(),
            "github_run_attempt": env::var("GITHUB_RUN_ATTEMPT").ok()
        },
        "entries": actual_total,
        "fixture_type": "the existing global_search_benchmark.rs deterministic synthetic fixture with production schema, indices, FTS triggers and 512-row insert transactions",
        "sqlite_version": sqlite_version,
        "sqlite_pragmas": pragmas,
        "generation_ms": generation_ms,
        "population_ms": population_ms,
        "total_fixture_build_wall_ms": fixture_elapsed_ms,
        "population_transaction_ms": summarize_samples(&transaction_samples),
        "database": database_metrics(&conn, &path),
        "filesystem_or_OS_file_discovery_measured": false,
        "process_cpu_and_working_set_bytes": "NOT CAPTURED; VM steps and SQLite sort counters are reported instead"
    }));

    // The real command calls search_global_entries_snapshot(), which runs
    // these two repository reads after search. Profile their exact SQL shapes
    // separately so its extra latency is not attributed to candidate search.
    for (stage, sql) in [
        (
            "repository_snapshot_source_health_count_max",
            SNAPSHOT_SOURCE_HEALTH_SQL,
        ),
        (
            "repository_snapshot_index_status_aggregate",
            SNAPSHOT_INDEX_STATUS_SQL,
        ),
    ] {
        profile_sql_stage(
            &conn,
            &context,
            "repository_snapshot_facts",
            "search_global_files",
            stage,
            sql,
            Vec::new(),
        );
    }

    // Reuse this exact fixture for Issue #359: compare both exact source-health
    // candidates, their facts/hash work, and complete repository snapshots.
    profile_source_health_sql_candidates(&context, &conn, &path);
    profile_source_health_functions(&db, &path, &context);
    profile_repository_snapshot_candidates(&db, &path, &context);

    let mut correctness_classes = 0;
    for (query_case, expectation) in QUERY_MATRIX.iter().copied().zip(expectations.iter()) {
        let actual_count = actual_match_count(&conn, query_case);
        assert_eq!(
            actual_count as u64, expectation.total_matches,
            "500k count oracle for {}",
            query_case.class
        );
        assert_search_results(
            &conn,
            query_case,
            expectation,
            SEARCH_RESULT_LIMIT,
            0,
            DIAGNOSTIC_ENTRIES,
        );
        correctness_classes += 1;
    }
    assert_eq!(correctness_classes, QUERY_MATRIX.len());
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "source_health_diagnostic_500k_correctness",
        "context": context,
        "official_query_classes_checked": correctness_classes,
        "official_query_classes_passed": correctness_classes,
        "query_correctness": true,
        "performance_matrix_repeated": false,
        "performance_gate_changed": false
    }));

    for spec in PREFIX_QUERIES.iter().copied() {
        let expectation_index = QUERY_MATRIX
            .iter()
            .position(|item| item.class == spec.class)
            .expect("corresponding fixed baseline query class");
        let expected_count = expectations[expectation_index].total_matches as usize;
        let actual_count = actual_match_count(&conn, QUERY_MATRIX[expectation_index]);
        assert_eq!(
            actual_count as usize, expected_count,
            "fixture count for {}",
            spec.class
        );
        let tier = if spec.extension {
            "extension_prefix"
        } else {
            "name_prefix"
        };
        let actual_tier = diagnostic_search_tier(&conn, tier, spec.query, QUERY_LIMIT)
            .expect("probe actual routed production tier");
        assert_eq!(actual_tier.len(), expected_count.min(QUERY_LIMIT as usize));
        if !spec.extension {
            assert_eq!(
                run_result_sql(
                    &conn,
                    SAFE_PREFIX_CTE_SQL,
                    &prefix_variant_values(spec.query, QUERY_LIMIT),
                ),
                actual_tier,
                "safe prefix CTE equality for Unicode and punctuation behavior"
            );
        }

        let stage_records = prefix_stage_sql(spec);
        for (stage, sql, values) in &stage_records {
            let stage_count = profile_sql_stage(
                &conn,
                &context,
                spec.class,
                spec.query,
                stage,
                sql,
                values.clone(),
            );
            match *stage {
                "A_index_range_without_volume_join"
                | "B_active_volume_and_stale_filter"
                | "C_global_recency_sort_all_matches" => {
                    assert_eq!(stage_count, expected_count);
                }
                "D_global_recency_sort_limit_80"
                | "F_full_projection_without_managed_exists_limit_80"
                | "G_full_production_tier_projection_and_managed_exists_limit_80" => {
                    assert_eq!(stage_count, expected_count.min(QUERY_LIMIT as usize));
                }
                "E_global_recency_sort_limit_4096" => {
                    assert_eq!(stage_count, expected_count.min(SEARCH_CANDIDATE_LIMIT));
                }
                _ => unreachable!("unknown prefix stage: {stage}"),
            }
        }
        let (column, index, predicate, rank, glob_value) = if spec.extension {
            (
                "extension",
                "idx_global_entries_active_extension_order",
                "ge.extension <> lower(?1)",
                "1.0",
                format!("{}*", benchmark_escape_glob(spec.query)),
            )
        } else {
            (
                "name_normalized",
                "idx_global_entries_active_name_order",
                "ge.name_normalized <> lower(?1)",
                "0.0",
                format!("{}*", benchmark_escape_glob(spec.query)),
            )
        };
        let production_plan_sql = candidate_plan_sql(
            &format!("global_entries ge INDEXED BY {index} JOIN global_volumes gv ON gv.id = ge.volume_id"),
            &format!("gv.enabled = 1 AND ge.is_stale = 0 AND ge.{column} GLOB ?2 AND {predicate}"),
            "ge.modified_at_fs DESC, ge.id ASC",
            rank,
            "?3",
        );
        let production_plan_values = vec![
            SqlValue::Text(spec.query.to_string()),
            SqlValue::Text(glob_value),
            SqlValue::Integer(QUERY_LIMIT as i64),
        ];
        emit_record(&json!({
            "schema_version": 1,
            "record_type": "production_tier_plan",
            "context": context,
            "query_class": spec.class,
            "query": spec.query,
            "production_tier": tier,
            "total_eligible_matches": expected_count,
            "plan_sql_mirrors_actual_search_rs_candidate_sql": production_plan_sql,
            "parameters": sql_values_json(&production_plan_values),
            "explain_query_plan": explain_details(&conn, &production_plan_sql, &production_plan_values),
            "actual_runtime_tier_helper": true
        }));

        let tier_results = measure_production_tier(
            &context,
            &conn,
            spec.class,
            spec.query,
            tier,
            QUERY_LIMIT,
            PAIRED_SAMPLES,
        );
        let aggregate =
            profile_full_search_entrypoint(&context, &db, &conn, &path, spec.class, spec.query);
        assert_eq!(
            aggregate, tier_results,
            "the expected tier should fill aggregate page"
        );
    }

    for (class, query) in FTS_QUERIES {
        for tier in [
            "exact_name",
            "name_prefix",
            "exact_extension",
            "extension_prefix",
        ] {
            assert!(diagnostic_search_tier(&conn, tier, query, QUERY_LIMIT)
                .expect("prove FTS query reaches only after the earlier tiers")
                .is_empty());
        }
        let fts_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM global_entries_fts WHERE global_entries_fts MATCH ?1",
                [fts_phrase(query)],
                |row| row.get(0),
            )
            .expect("count exact FTS match set");
        let values = fts_variant_values(query, QUERY_LIMIT);
        let limit4096 = fts_variant_values(query, SEARCH_CANDIDATE_LIMIT as u32);
        let stages: Vec<(&str, String, Vec<SqlValue>)> = vec![
            (
                "A_fts_match_rowids_only",
                "SELECT global_entries_fts.rowid FROM global_entries_fts WHERE global_entries_fts MATCH ?1".to_string(),
                vec![SqlValue::Text(fts_phrase(query))],
            ),
            (
                "B_fts_match_plus_bm25_no_order",
                "SELECT global_entries_fts.rowid, bm25(global_entries_fts, 8.0, 2.0, 1.0) FROM global_entries_fts WHERE global_entries_fts MATCH ?1".to_string(),
                vec![SqlValue::Text(fts_phrase(query))],
            ),
            (
                "C_fts_bm25_rank_sort_all_hits",
                "SELECT global_entries_fts.rowid FROM global_entries_fts WHERE global_entries_fts MATCH ?1 ORDER BY bm25(global_entries_fts, 8.0, 2.0, 1.0) ASC".to_string(),
                vec![SqlValue::Text(fts_phrase(query))],
            ),
            (
                "D_fts_rowid_join_global_entries",
                "SELECT ge.rowid FROM global_entries_fts CROSS JOIN global_entries ge WHERE global_entries_fts MATCH ?1 AND ge.rowid = global_entries_fts.rowid".to_string(),
                vec![SqlValue::Text(fts_phrase(query))],
            ),
            (
                "E_fts_enabled_volume_and_stale_filter",
                "SELECT ge.rowid FROM global_entries_fts CROSS JOIN global_entries ge CROSS JOIN global_volumes gv WHERE global_entries_fts MATCH ?1 AND ge.rowid = global_entries_fts.rowid AND gv.id = ge.volume_id AND gv.enabled = 1 AND ge.is_stale = 0".to_string(),
                vec![SqlValue::Text(fts_phrase(query))],
            ),
            (
                "F_fts_bm25_limit_80",
                "SELECT ge.rowid FROM global_entries_fts CROSS JOIN global_entries ge CROSS JOIN global_volumes gv WHERE global_entries_fts MATCH ?1 AND ge.rowid = global_entries_fts.rowid AND gv.id = ge.volume_id AND gv.enabled = 1 AND ge.is_stale = 0 ORDER BY bm25(global_entries_fts, 8.0, 2.0, 1.0) ASC, ge.modified_at_fs DESC, ge.id ASC LIMIT ?2".to_string(),
                values.clone(),
            ),
            (
                "G_fts_bm25_limit_4096",
                "SELECT ge.rowid FROM global_entries_fts CROSS JOIN global_entries ge CROSS JOIN global_volumes gv WHERE global_entries_fts MATCH ?1 AND ge.rowid = global_entries_fts.rowid AND gv.id = ge.volume_id AND gv.enabled = 1 AND ge.is_stale = 0 ORDER BY bm25(global_entries_fts, 8.0, 2.0, 1.0) ASC, ge.modified_at_fs DESC, ge.id ASC LIMIT ?2".to_string(),
                limit4096,
            ),
            (
                "H_fts_full_projection_without_managed_limit_80",
                FTS_WITHOUT_MANAGED_SQL.to_string(),
                values.clone(),
            ),
            (
                "I_fts_exact_production_projection_managed_rank_limit_80",
                diagnostic_search_fts_sql().replacen("SELECT ge.id,", "SELECT ge.rowid, ge.id,", 1),
                values,
            ),
        ];
        for (stage, sql, values) in stages {
            let returned = profile_sql_stage(&conn, &context, class, query, stage, &sql, values);
            match stage {
                "A_fts_match_rowids_only"
                | "B_fts_match_plus_bm25_no_order"
                | "C_fts_bm25_rank_sort_all_hits"
                | "D_fts_rowid_join_global_entries"
                | "E_fts_enabled_volume_and_stale_filter" => {
                    assert_eq!(
                        returned as i64, fts_count,
                        "unbounded FTS stage count for {query}"
                    );
                }
                "F_fts_bm25_limit_80"
                | "H_fts_full_projection_without_managed_limit_80"
                | "I_fts_exact_production_projection_managed_rank_limit_80" => {
                    assert_eq!(returned, (fts_count as usize).min(QUERY_LIMIT as usize));
                }
                "G_fts_bm25_limit_4096" => {
                    assert_eq!(returned, (fts_count as usize).min(SEARCH_CANDIDATE_LIMIT));
                }
                _ => unreachable!(),
            }
        }
        let fts_results = measure_production_tier(
            &context,
            &conn,
            class,
            query,
            "fts",
            QUERY_LIMIT,
            PAIRED_SAMPLES,
        );
        let full = profile_full_search_entrypoint(&context, &db, &conn, &path, class, query);
        assert_eq!(fts_results, full, "FTS tier should be the only match tier");
        assert_eq!(
            run_result_sql(
                &conn,
                SAFE_FTS_CTE_SQL,
                &fts_variant_values(query, QUERY_LIMIT),
            ),
            fts_results,
            "safe FTS CTE must equal the production tier for every measured hit count"
        );
        if fts_count as usize > SEARCH_CANDIDATE_LIMIT {
            let production_window =
                diagnostic_search_fts(&conn, query, SEARCH_CANDIDATE_LIMIT as u32)
                    .expect("collect production FTS candidate cap");
            let safe_window = run_result_sql(
                &conn,
                SAFE_FTS_CTE_SQL,
                &fts_variant_values(query, SEARCH_CANDIDATE_LIMIT as u32),
            );
            assert_eq!(
                safe_window, production_window,
                "FTS candidate-window equivalence"
            );
            let boundary_page = search_global_entries_on_connection(&conn, query, 80, 4_016)
                .expect("full search at FTS candidate-window boundary");
            assert_eq!(boundary_page, production_window[4_016..4_096]);
            assert!(search_global_entries_on_connection(&conn, query, 80, 4_096)
                .expect("full search after FTS candidate cap")
                .is_empty());
        }
        if query == "report" || query == "invoice" {
            let values = fts_variant_values(query, QUERY_LIMIT);
            profile_paired_variant(
                &context,
                &conn,
                class,
                query,
                CandidateVariant {
                    name: "key-only-materialized-fts-cte",
                    sql: SAFE_FTS_CTE_SQL,
                    values,
                },
                || {
                    diagnostic_search_fts(&conn, query, QUERY_LIMIT)
                        .expect("paired production FTS tier")
                },
            );
        }
    }

    // Measure the disposable time-first index only after all production-plan
    // baselines have been captured. It is never part of Schema migrations.
    let pages_before: i64 = conn
        .query_row("PRAGMA page_count", [], |row| row.get(0))
        .expect("read page count before test-only index");
    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |row| row.get(0))
        .expect("read SQLite page size for test-only index");
    let main_bytes_before = fs::metadata(&path)
        .expect("read database size before test-only index")
        .len();
    let wal_bytes_before = sidecar_bytes(&path, "-wal");
    let fts_values = fts_variant_values("report", QUERY_LIMIT);
    let fts_plan_before = explain_details(&conn, &diagnostic_search_fts_sql(), &fts_values);
    let index_started = Instant::now();
    conn.execute_batch(&format!(
        "CREATE INDEX {TEST_INDEX_NAME} ON global_entries (modified_at_fs DESC, id ASC, name_normalized, volume_id) WHERE is_stale = 0"
    ))
    .expect("create disposable time-first name index");
    let index_build_ms = index_started.elapsed().as_secs_f64() * 1_000.0;
    let pages_after: i64 = conn
        .query_row("PRAGMA page_count", [], |row| row.get(0))
        .expect("read page count after test-only index");
    let main_bytes_after = fs::metadata(&path)
        .expect("read database size after test-only index")
        .len();
    let wal_bytes_after = sidecar_bytes(&path, "-wal");
    let time_values = prefix_variant_values("quarterly", QUERY_LIMIT);
    let production_prefix = || {
        diagnostic_search_tier(&conn, "name_prefix", "quarterly", QUERY_LIMIT)
            .expect("paired production prefix query")
    };
    profile_paired_variant(
        &context,
        &conn,
        "name_prefix",
        "quarterly",
        CandidateVariant {
            name: "key-only-materialized-prefix-cte",
            sql: SAFE_PREFIX_CTE_SQL,
            values: time_values.clone(),
        },
        production_prefix,
    );
    profile_paired_variant(
        &context,
        &conn,
        "name_prefix",
        "quarterly",
        CandidateVariant {
            name: "disposable-time-first-index",
            sql: TIME_INDEX_PREFIX_SQL,
            values: time_values.clone(),
        },
        production_prefix,
    );
    let index_plan = explain_details(&conn, TIME_INDEX_PREFIX_SQL, &time_values);
    let base_plan = explain_details(
        &conn,
        &candidate_plan_sql(
            "global_entries ge INDEXED BY idx_global_entries_active_name_order JOIN global_volumes gv ON gv.id = ge.volume_id",
            "gv.enabled = 1 AND ge.is_stale = 0 AND ge.name_normalized GLOB ?2 AND ge.name_normalized <> lower(?1)",
            "ge.modified_at_fs DESC, ge.id ASC",
            "0.0",
            "?3",
        ),
        &time_values,
    );
    let fts_plan_after = explain_details(&conn, &diagnostic_search_fts_sql(), &fts_values);
    let write_with_index = rollback_insert_samples(&conn, 5, 256);
    conn.execute_batch(&format!("DROP INDEX {TEST_INDEX_NAME}"))
        .expect("drop disposable time-first index before baseline write samples");
    let write_without_index = rollback_insert_samples(&conn, 5, 256);
    let with_index_p50 = summarize_samples(&write_with_index)["p50"]
        .as_f64()
        .unwrap_or_default();
    let without_index_p50 = summarize_samples(&write_without_index)["p50"]
        .as_f64()
        .unwrap_or_default();
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "ephemeral_index_cost",
        "context": context,
        "index_name": TEST_INDEX_NAME,
        "index_sql": format!("CREATE INDEX {TEST_INDEX_NAME} ON global_entries (modified_at_fs DESC, id ASC, name_normalized, volume_id) WHERE is_stale = 0"),
        "build_ms": index_build_ms,
        "page_count_before": pages_before,
        "page_count_after": pages_after,
        "page_count_delta": pages_after - pages_before,
        "estimated_index_bytes_from_page_delta": (pages_after - pages_before) * page_size,
        "database_main_bytes_before": main_bytes_before,
        "database_main_bytes_after": main_bytes_after,
        "database_wal_bytes_before": wal_bytes_before,
        "database_wal_bytes_after": wal_bytes_after,
        "database_main_plus_wal_bytes_delta": (main_bytes_after + wal_bytes_after).saturating_sub(main_bytes_before + wal_bytes_before),
        "index_plan": index_plan,
        "index_uses_temp_btree": index_plan.iter().any(|line| line.contains("USE TEMP B-TREE")),
        "production_prefix_plan_unchanged_by_explicit_index_hint": base_plan,
        "fts_plan_unchanged": fts_plan_before == fts_plan_after,
        "fts_plan_before": fts_plan_before,
        "fts_plan_after": fts_plan_after,
        "rollback_insert_write_sample_rows": 256,
        "rollback_insert_write_samples": 5,
        "write_with_index_latency_ms": summarize_samples(&write_with_index),
        "write_without_index_latency_ms": summarize_samples(&write_without_index),
        "write_p50_change_percent": if without_index_p50 > 0.0 { (with_index_p50 - without_index_p50) / without_index_p50 * 100.0 } else { 0.0 },
        "write_cost_scope": "small transaction-only diagnostic with production entry and FTS triggers; not a bulk population or full writer benchmark",
        "index_dropped_before_remaining_tests": true
    }));

    let (scale_overlay_ms, scale_results) = populate_scale_overlay(&conn);
    let count_before_rollback: i64 = conn
        .query_row("SELECT COUNT(*) FROM global_entries", [], |row| row.get(0))
        .expect("count rows before adversarial rollback");
    assert_eq!(count_before_rollback, DIAGNOSTIC_ENTRIES as i64);
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "match_count_scale_summary",
        "context": context,
        "database_rows_during_queries": DIAGNOSTIC_ENTRIES,
        "synthetic_overlay_rows": 40_201,
        "overlay_insert_and_query_wall_ms": scale_overlay_ms,
        "overlay_transaction_rolled_back": true,
        "eligible_match_counts": scale_results,
        "result_page_limit": QUERY_LIMIT,
        "candidate_window": SEARCH_CANDIDATE_LIMIT
    }));

    let mut conn = conn;
    add_adversarial_rows(&db, &mut conn, &context);
    let final_rows: i64 = conn
        .query_row("SELECT COUNT(*) FROM global_entries", [], |row| row.get(0))
        .expect("verify only base entries remain after test overlays");
    assert_eq!(final_rows, DIAGNOSTIC_ENTRIES as i64);
    emit_record(&json!({
        "schema_version": 1,
        "record_type": "diagnostic_complete",
        "context": context,
        "base_rows_after_rollback": final_rows,
        "100ms_historical_gate_changed": false,
        "source_health_candidate_exercised": true,
        "search_tier_sql_changed": false,
        "schema_or_index_changed": false,
        "source_health_candidates_and_full_snapshots_measured": true,
        "official_500k_query_correctness_classes_checked": QUERY_MATRIX.len(),
        "official_500k_query_correctness_passed": true,
        "one_fixture_build": true,
        "one_million_row_benchmark_run": false,
        "official_full_benchmark_matrix_repeated": false,
        "normal_production_search_semantics_modified": false
    }));
}
