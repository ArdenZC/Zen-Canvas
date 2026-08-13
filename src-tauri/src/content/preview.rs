use super::*;

pub(crate) fn build_content_snapshot(
    conn: &Connection,
    request: ContentPreviewRequest,
) -> Result<ContentSnapshot, DbError> {
    validate_preview_request(&request)?;
    let library_revision = current_library_revision(conn)?;
    if library_revision != request.expected_library_revision {
        return Err(DbError::Validation(
            "content_library_revision_conflict".into(),
        ));
    }
    let resolved = resolve_scope(conn, &request.scope)?;
    let root_ids = resolved
        .health
        .roots
        .iter()
        .map(|root| root.id.clone())
        .collect::<Vec<_>>();
    let mut policies = Vec::new();
    let mut policy_revisions = Vec::new();
    let mut local_allowed = true;
    let mut cloud_allowed = false;
    let expected_roots = request
        .expected_policy_revisions
        .iter()
        .map(|item| item.root_id.as_str())
        .collect::<HashSet<_>>();
    if expected_roots.len() != request.expected_policy_revisions.len()
        || expected_roots.len() != root_ids.len()
        || expected_roots
            .iter()
            .any(|root_id| !root_ids.iter().any(|id| id == root_id))
    {
        return Err(DbError::Validation(
            "content_root_or_policy_revision_required".into(),
        ));
    }
    for root_id in &root_ids {
        let policy = load_policy(conn, root_id)?;
        if let Some(expected) = request
            .expected_policy_revisions
            .iter()
            .find(|item| item.root_id == *root_id)
        {
            if policy.root_revision != expected.root_revision
                || policy.policy_revision != expected.policy_revision
            {
                return Err(DbError::Validation(
                    "content_root_or_policy_revision_conflict".into(),
                ));
            }
        } else {
            return Err(DbError::Validation(
                "content_root_or_policy_revision_required".into(),
            ));
        }
        local_allowed &= policy.local_allowed && policy.enabled;
        cloud_allowed |= policy.cloud_allowed;
        policy_revisions.push(ContentPolicyRevisionRequest {
            root_id: root_id.clone(),
            root_revision: policy.root_revision,
            policy_revision: policy.policy_revision,
        });
        policies.push(Policy { dto: policy });
    }
    let candidate_count = candidate_count(conn, &request.scope, &request.selection_file_ids)?;
    let candidates = if candidate_count <= MAX_ITEMS as i64 {
        select_candidates(
            conn,
            &request.scope,
            &request.selection_file_ids,
            Some(candidate_count as usize),
        )?
    } else {
        Vec::new()
    };
    let mut supported = 0_i64;
    let mut unsupported = 0_i64;
    let mut blocked = 0_i64;
    let mut failed = 0_i64;
    let mut supported_formats = HashSet::new();
    let mut unsupported_formats = HashSet::new();
    let mut blocked_reasons = HashSet::new();
    let mut sample = Vec::new();
    let mut total_byte_budget = 0_i64;
    let mut total_char_budget = 0_i64;
    let mut per_file_byte_budget = 0_i64;
    let mut per_file_char_budget = 0_i64;
    for_each_candidate(
        conn,
        &request.scope,
        &request.selection_file_ids,
        None,
        |candidate| {
            let policy = policies
                .iter()
                .find(|policy| policy.dto.root_id == candidate.root_id)
                .map(|policy| &policy.dto);
            let item = classify_candidate(&candidate, policy);
            if let Some(policy) = policy {
                per_file_byte_budget = per_file_byte_budget.max(policy.max_bytes);
                per_file_char_budget = per_file_char_budget.max(policy.max_chars);
                total_byte_budget =
                    total_byte_budget.saturating_add(candidate.size.max(0).min(policy.max_bytes));
                total_char_budget = total_char_budget.saturating_add(policy.max_chars);
            }
            match item.status.as_str() {
                "supported" => {
                    supported += 1;
                    if let Some(family) = item.extractor_family.clone() {
                        supported_formats.insert(family);
                    }
                }
                "unsupported" => {
                    unsupported += 1;
                    unsupported_formats.insert(candidate.extension.clone());
                }
                "blocked" => {
                    blocked += 1;
                    if let Some(reason) = item.reason.clone() {
                        blocked_reasons.insert(reason);
                    }
                }
                _ => failed += 1,
            }
            if sample.len() < MAX_SAMPLE as usize {
                sample.push(ContentSampleDto {
                    file_id: candidate.id.clone(),
                    name: candidate.name.clone(),
                    extension: candidate.extension.clone(),
                    size: candidate.size,
                    modified_at: candidate.mtime,
                    status: item.status,
                    extractor_family: item.extractor_family,
                    reason: item.reason,
                });
            }
            Ok(())
        },
    )?;
    let exact_count = candidate_count;
    let exact_state = if exact_count > MAX_ITEMS as i64 {
        "deferred"
    } else {
        "exact"
    };
    let candidate_fingerprint =
        candidate_stream_fingerprint(conn, &request.scope, &request.selection_file_ids, &policies)?;
    let policy_payload = serde_json::to_vec(&policy_revisions)?;
    let policy_fingerprint = hash_bytes(&policy_payload);
    let scope_health = ContentScopeHealthDto {
        scope: request.scope.clone(),
        health: resolved.health,
        root_ids,
        policy_revisions,
    };
    let candidate_resolver = hash_bytes(
        serde_json::to_string(&serde_json::json!({
            "scope": &request.scope,
            "selection": &request.selection_file_ids,
            "libraryRevision": library_revision,
            "policyFingerprint": policy_fingerprint,
            "candidateFingerprint": candidate_fingerprint,
            "count": exact_count,
        }))?
        .as_bytes(),
    );
    let preview_payload = serde_json::json!({
        "version": CONTENT_VERSION,
        "scope": &scope_health,
        "libraryRevision": library_revision,
        "policyFingerprint": policy_fingerprint,
        "candidateFingerprint": candidate_fingerprint,
        "candidateResolver": candidate_resolver,
        "mode": request.mode,
        "providerMode": request.provider_mode,
        "count": exact_count,
        "exactState": exact_state,
        "totalByteBudget": total_byte_budget,
        "totalCharBudget": total_char_budget,
        "perFileByteBudget": per_file_byte_budget,
        "perFileCharBudget": per_file_char_budget,
        "selection": &request.selection_file_ids,
    });
    let preview_fingerprint = hash_bytes(serde_json::to_string(&preview_payload)?.as_bytes());
    Ok(ContentSnapshot {
        candidates,
        preview: ContentPreviewDto {
            version: CONTENT_VERSION,
            request_id: request.request_id,
            scope_health,
            exact_count,
            deferred_count: (exact_state == "deferred").then_some(exact_count),
            exact_state: exact_state.into(),
            candidate_resolver,
            candidate_fingerprint,
            per_file_byte_budget,
            per_file_char_budget,
            total_byte_budget,
            total_char_budget,
            byte_budget: total_byte_budget,
            char_budget: total_char_budget,
            supported_count: supported,
            unsupported_count: unsupported,
            blocked_count: blocked,
            failed_count: failed,
            supported_formats: sorted_strings(supported_formats),
            unsupported_formats: sorted_strings(unsupported_formats),
            blocked_reasons: sorted_strings(blocked_reasons),
            local_allowed,
            cloud_allowed,
            raw_retention_disclosure: "Raw text is not retained by default; bounded retention requires an explicit per-root policy.".into(),
            sample,
            library_revision,
            policy_fingerprint,
            preview_fingerprint,
            requires_confirmation: true,
        },
    })
}
