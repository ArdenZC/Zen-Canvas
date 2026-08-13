use super::*;

#[cfg(all(test, windows))]
pub(crate) fn execute_preview_operation(
    batch_id: &str,
    created_at: &str,
    index: usize,
    operation: &OperationPreviewRequest,
    cancel_flag: Option<&AtomicBool>,
) -> OperationLogDto {
    execute_preview_operation_with_app_data(
        batch_id,
        created_at,
        index,
        operation,
        OperationExecutionContext {
            cancel_flag,
            app_data_dir: None,
            expected_identity: None,
            planned_claim_path: None,
            phase_observer: None,
        },
    )
}

pub(crate) struct OperationExecutionContext<'a> {
    pub(crate) cancel_flag: Option<&'a AtomicBool>,
    pub(crate) app_data_dir: Option<&'a Path>,
    pub(crate) expected_identity: Option<&'a crate::fs_safety::ExpectedFileIdentity>,
    pub(crate) planned_claim_path: Option<&'a Path>,
    pub(crate) phase_observer: Option<&'a mut crate::fs_safety::PhaseObserver<'a>>,
}

pub(crate) fn execute_preview_operation_with_app_data(
    batch_id: &str,
    created_at: &str,
    index: usize,
    operation: &OperationPreviewRequest,
    context: OperationExecutionContext<'_>,
) -> OperationLogDto {
    let source_fingerprint = context
        .expected_identity
        .cloned()
        .map(|identity| FileIdentityFingerprint {
            size: identity.size,
            modified_ns: identity.modified_ns,
            platform_volume_id: identity.platform_volume_id,
            platform_file_id: identity.platform_file_id,
            quick_hash: identity.sample_hash,
            full_hash: identity.full_hash,
        })
        .or_else(|| file_identity_fingerprint(Path::new(&operation.source_path)).ok());
    let status = if operation.is_executable == Some(false) {
        Err(FileMutationError::Validation(
            "Operation is not executable.".to_string(),
        ))
    } else {
        match operation.operation_type.as_str() {
            "rename" => rename_file_with_identity(
                operation.source_path.clone(),
                operation.new_name.clone(),
                context.expected_identity,
                context.cancel_flag,
                context.planned_claim_path,
                context.phase_observer,
            ),
            "move" | "move_rename" => move_file_with_parent_policy_with_cancel_and_identity(
                operation.source_path.clone(),
                operation.target_path.clone(),
                true,
                context.cancel_flag,
                context.expected_identity,
                context.planned_claim_path,
                context.phase_observer,
            ),
            "move_to_trash" => move_to_trash_with_safety(
                operation.source_path.clone(),
                context.app_data_dir,
                context.expected_identity,
                context.planned_claim_path,
                &operation.id,
            ),
            other => Err(FileMutationError::Validation(format!(
                "Unsupported operation type: {other}"
            ))),
        }
    };

    let mut log = match status {
        Ok(result) => make_operation_log(
            batch_id,
            created_at,
            index,
            operation,
            "success",
            None,
            result.target_path,
        ),
        Err(error) if error.is_cancelled() => make_operation_log(
            batch_id,
            created_at,
            index,
            operation,
            "skipped",
            None,
            operation.target_path.clone(),
        ),
        Err(error) => {
            let requires_recovery = error.requires_recovery();
            let status = if operation.is_executable == Some(false) {
                "skipped"
            } else if requires_recovery {
                "manual_review"
            } else {
                "failed"
            };
            let mut log = make_operation_log(
                batch_id,
                created_at,
                index,
                operation,
                status,
                Some(error.to_string()),
                operation.target_path.clone(),
            );
            if requires_recovery {
                log.operation_phase = error.journal_phase().to_string();
                log.can_undo = false;
                log.can_restore = false;
            }
            log
        }
    };
    if let Some(fingerprint) = source_fingerprint.as_ref() {
        apply_source_fingerprint(&mut log, fingerprint);
    }
    if log.status == "success" {
        if let Ok(target_fingerprint) = file_identity_fingerprint(Path::new(&log.path_after)) {
            log.target_platform_file_id = target_fingerprint.platform_file_id;
            log.target_platform_volume_id = target_fingerprint.platform_volume_id;
            log.target_full_hash = target_fingerprint.full_hash;
        }
    }
    log
}
