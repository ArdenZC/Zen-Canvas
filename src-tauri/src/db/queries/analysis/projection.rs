use super::*;
use rusqlite::{params, Connection, Row};

pub(super) fn load_analysis_detectors(
    conn: &Connection,
    run_id: &str,
) -> Result<Vec<AnalysisDetectorDto>, DbError> {
    let mut statement = conn.prepare(&format!(
        "{ANALYSIS_DETECTOR_SELECT} WHERE run_id = ?1 ORDER BY detector_id"
    ))?;
    let result = statement
        .query_map(params![run_id], analysis_detector_from_row)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from);
    result
}

pub(super) fn query_analysis_run(
    conn: &Connection,
    run_id: &str,
) -> Result<AnalysisRunDto, DbError> {
    conn.query_row(
        &format!("{ANALYSIS_RUN_SELECT} WHERE id = ?1"),
        params![run_id],
        analysis_run_from_row,
    )
    .map_err(DbError::from)
}

pub(super) const ANALYSIS_RUN_SELECT: &str = r#"
    SELECT id, request_key, request_attempt, scope_json, scope_hash,
           source_snapshot_json, source_snapshot_hash, detector_set_json,
           detector_set_hash, status, phase, revision, cancel_requested,
           rerun_required, detectors_total, detectors_completed, detectors_failed,
           findings_staged, findings_published, safe_count, review_count,
           caution_count, exact_reclaimable_bytes, potential_reclaimable_bytes,
           warning_count, error_count, started_at, finished_at, last_checkpoint_at,
           created_at, updated_at, error_code, error_message
    FROM analysis_runs
"#;

pub(super) const ANALYSIS_DETECTOR_SELECT: &str = r#"
    SELECT run_id, detector_id, detector_version, status, revision,
           scanned_subjects, findings_staged, findings_published,
           exact_reclaimable_bytes, potential_reclaimable_bytes,
           started_at, finished_at, error_code, error_message
    FROM analysis_run_detectors
"#;

pub(super) const ANALYSIS_FINDING_SELECT: &str = r#"
    SELECT f.id, f.finding_key, f.run_id, f.detector_id, f.detector_version,
           f.scope_hash, f.status, f.tier, f.category, f.action_kind, f.title,
           f.reason, f.risk_note, f.confidence, f.size_bytes,
           f.exact_reclaimable_bytes, f.potential_reclaimable_bytes,
           f.requires_confirmation, f.executable, f.primary_subject_kind,
           f.primary_subject_id, f.path_snapshot, f.identity_snapshot_json,
           f.evidence_summary_json, f.revision, f.created_at, f.updated_at,
           f.published_at, f.stale_at,
           CASE WHEN d.decision = 'snoozed' AND d.snoozed_until <= unixepoch() THEN 'open' ELSE d.decision END,
           d.snoozed_until, d.revision
    FROM analysis_findings AS f
"#;

pub(super) fn analysis_run_from_row(row: &Row<'_>) -> rusqlite::Result<AnalysisRunDto> {
    let scope: String = row.get(3)?;
    let source: String = row.get(5)?;
    let detectors: String = row.get(7)?;
    Ok(AnalysisRunDto {
        id: row.get(0)?,
        request_key: row.get(1)?,
        request_attempt: row.get(2)?,
        scope: serde_json::from_str(&scope).unwrap_or(Value::Null),
        scope_hash: row.get(4)?,
        source_snapshot: serde_json::from_str(&source).unwrap_or(Value::Null),
        source_snapshot_hash: row.get(6)?,
        detector_set: serde_json::from_str(&detectors).unwrap_or_default(),
        detector_set_hash: row.get(8)?,
        status: row.get(9)?,
        phase: row.get(10)?,
        revision: row.get(11)?,
        cancel_requested: row.get::<_, i64>(12)? != 0,
        rerun_required: row.get::<_, i64>(13)? != 0,
        detectors_total: row.get(14)?,
        detectors_completed: row.get(15)?,
        detectors_failed: row.get(16)?,
        findings_staged: row.get(17)?,
        findings_published: row.get(18)?,
        safe_count: row.get(19)?,
        review_count: row.get(20)?,
        caution_count: row.get(21)?,
        exact_reclaimable_bytes: row.get(22)?,
        potential_reclaimable_bytes: row.get(23)?,
        warning_count: row.get(24)?,
        error_count: row.get(25)?,
        started_at: row.get(26)?,
        finished_at: row.get(27)?,
        last_checkpoint_at: row.get(28)?,
        created_at: row.get(29)?,
        updated_at: row.get(30)?,
        error_code: row.get(31)?,
        error_message: row.get(32)?,
    })
}

pub(super) fn analysis_detector_from_row(row: &Row<'_>) -> rusqlite::Result<AnalysisDetectorDto> {
    Ok(AnalysisDetectorDto {
        run_id: row.get(0)?,
        detector_id: row.get(1)?,
        detector_version: row.get(2)?,
        status: row.get(3)?,
        revision: row.get(4)?,
        scanned_subjects: row.get(5)?,
        findings_staged: row.get(6)?,
        findings_published: row.get(7)?,
        exact_reclaimable_bytes: row.get(8)?,
        potential_reclaimable_bytes: row.get(9)?,
        started_at: row.get(10)?,
        finished_at: row.get(11)?,
        error_code: row.get(12)?,
        error_message: row.get(13)?,
    })
}

pub(super) fn analysis_finding_from_row(row: &Row<'_>) -> rusqlite::Result<AnalysisFindingDto> {
    let identity: String = row.get(22)?;
    let evidence: String = row.get(23)?;
    Ok(AnalysisFindingDto {
        id: row.get(0)?,
        finding_key: row.get(1)?,
        run_id: row.get(2)?,
        detector_id: row.get(3)?,
        detector_version: row.get(4)?,
        scope_hash: row.get(5)?,
        status: row.get(6)?,
        tier: row.get(7)?,
        category: row.get(8)?,
        action_kind: row.get(9)?,
        title: row.get(10)?,
        reason: row.get(11)?,
        risk_note: row.get(12)?,
        confidence: row.get(13)?,
        size_bytes: row.get(14)?,
        exact_reclaimable_bytes: row.get(15)?,
        potential_reclaimable_bytes: row.get(16)?,
        requires_confirmation: row.get::<_, i64>(17)? != 0,
        executable: row.get::<_, i64>(18)? != 0,
        primary_subject_kind: row.get(19)?,
        primary_subject_id: row.get(20)?,
        path_snapshot: row.get(21)?,
        identity_snapshot: serde_json::from_str(&identity).unwrap_or(Value::Null),
        evidence_summary: serde_json::from_str(&evidence).unwrap_or(Value::Null),
        revision: row.get(24)?,
        created_at: row.get(25)?,
        updated_at: row.get(26)?,
        published_at: row.get(27)?,
        stale_at: row.get(28)?,
        decision: row.get(29)?,
        snoozed_until: row.get(30)?,
        decision_revision: row.get(31)?,
    })
}

pub(super) fn analysis_evidence_from_row(
    row: &Row<'_>,
) -> rusqlite::Result<AnalysisFindingEvidenceDto> {
    let value: String = row.get(6)?;
    Ok(AnalysisFindingEvidenceDto {
        id: row.get(0)?,
        finding_id: row.get(1)?,
        evidence_kind: row.get(2)?,
        subject_kind: row.get(3)?,
        subject_id: row.get(4)?,
        path_snapshot: row.get(5)?,
        value: serde_json::from_str(&value).unwrap_or(Value::Null),
        created_at: row.get(7)?,
    })
}

pub(super) fn analysis_decision_from_row(
    row: &Row<'_>,
) -> rusqlite::Result<AnalysisFindingDecisionDto> {
    Ok(AnalysisFindingDecisionDto {
        finding_key: row.get(0)?,
        decision: row.get(1)?,
        snoozed_until: row.get(2)?,
        note: row.get(3)?,
        revision: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

pub(super) fn managed_analysis_file_from_row(
    row: &Row<'_>,
) -> rusqlite::Result<ManagedAnalysisFile> {
    let fingerprint_status: Option<String> = row.get(13)?;
    let fingerprint = fingerprint_status.map(|fingerprint_status| ManagedAnalysisFingerprint {
        identity_status: row.get(5).unwrap_or_default(),
        platform_kind: row.get(6).unwrap_or_default(),
        platform_volume_id: row.get(7).unwrap_or_default(),
        platform_file_id: row.get(8).unwrap_or_default(),
        physical_key: row.get(9).unwrap_or_default(),
        size: row.get(10).unwrap_or_default(),
        modified_ns: row.get(11).unwrap_or_default(),
        full_hash: row.get(12).unwrap_or_default(),
        fingerprint_status,
        revision: row.get(14).unwrap_or_default(),
    });
    Ok(ManagedAnalysisFile {
        file_id: row.get(0)?,
        path: row.get(1)?,
        size: row.get(2)?,
        mtime: row.get(3)?,
        is_stale: row.get::<_, i64>(4)? != 0,
        fingerprint,
    })
}

pub(super) fn query_dedupe_authority(conn: &Connection) -> Result<DedupeAuthorityDto, DbError> {
    conn.query_row(
        "SELECT revision, status, last_authoritative_run_id, scope_hash, updated_at FROM dedupe_authority_state WHERE id = 1",
        [],
        |row| {
            Ok(DedupeAuthorityDto {
                revision: row.get(0)?,
                status: row.get(1)?,
                last_authoritative_run_id: row.get(2)?,
                scope_hash: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(DbError::from)
}

pub(super) fn deterministic_finding_id(run_id: &str, finding_key: &str) -> String {
    let value = format!("{run_id}:{finding_key}");
    let digest = blake3::hash(value.as_bytes()).to_hex().to_string();
    format!("analysis-finding-{}", &digest[..40])
}

pub(super) fn parse_finding_cursor(value: &str) -> Result<FindingCursor, DbError> {
    let cursor: FindingCursor = serde_json::from_str(value).map_err(|_| {
        DbError::Validation(
            "Analysis finding cursor is invalid or from another version.".to_string(),
        )
    })?;
    if cursor.version != 1
        || cursor.id.trim().is_empty()
        || cursor.tier_order > 2
        || cursor.tier_order < 0
    {
        return Err(DbError::Validation(
            "Analysis finding cursor is invalid.".to_string(),
        ));
    }
    Ok(cursor)
}

pub(super) fn tier_order(tier: &str) -> i64 {
    match tier {
        "safe" => 0,
        "review" => 1,
        _ => 2,
    }
}

pub(super) fn higher_risk_tier(current: &str, requested: &str) -> &'static str {
    if tier_order(requested) >= tier_order(current) {
        match requested {
            "safe" => "safe",
            "review" => "review",
            _ => "caution",
        }
    } else {
        match current {
            "safe" => "safe",
            "review" => "review",
            _ => "caution",
        }
    }
}

pub(super) fn normalized_aggregate_path(path: &str) -> String {
    let normalized = path.replace('\\', "/").trim_end_matches('/').to_string();
    #[cfg(windows)]
    {
        normalized.to_ascii_lowercase()
    }
    #[cfg(not(windows))]
    {
        normalized
    }
}

pub(super) fn aggregate_path_is_same_or_child(path: &str, parent: &str) -> bool {
    path == parent || path.starts_with(&format!("{parent}/"))
}
