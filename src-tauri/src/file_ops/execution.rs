use super::*;

pub(crate) fn execute_moves_with_persistence_with_progress_and_app_data(
    db: &Database,
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
    app_data_dir: Option<PathBuf>,
    caller_batch_id: Option<String>,
) -> Result<ExecuteMovesResult, String> {
    crate::fs_safety::platform_support::ensure_supported_file_mutation()
        .map_err(|error| error.to_string())?;
    let operations = request.operations.clone();
    let batch_id = caller_batch_id.unwrap_or_else(|| new_job_id("operation-batch"));
    let created_at = current_timestamp_ms().to_string();
    let prepared_operations =
        persist_pending_operation_journal(db, &request, &batch_id, &created_at)?;
    let mut result = execute_moves_core_with_identity(
        request,
        cancel_flag,
        emitter,
        app_data_dir,
        batch_id,
        created_at,
        OperationPersistenceContext {
            prepared_operations: Some(&prepared_operations),
            journal_db: Some(db),
        },
    );

    for (operation, log) in operations.iter().zip(result.logs.iter_mut()) {
        if let Some(prepared) = prepared_operations.get(&operation.id) {
            apply_source_fingerprint(log, &prepared.fingerprint);
            log.source_claim_path = Some(normalize_path(&prepared.claim_path));
            log.claim_created_at = Some(prepared.claim_created_at.clone());
        }
        if log.status != "success" {
            continue;
        }
        let identity_path = if operation.operation_type == "replace" {
            crate::fs_safety::atomic_move::replacement_backup_path(
                Path::new(&log.path_before),
                Path::new(&log.path_after),
            )
        } else {
            PathBuf::from(&log.path_after)
        };
        if let Ok(target_fingerprint) =
            file_operation_fingerprint(&identity_path, &operation.operation_type)
        {
            apply_target_fingerprint(log, &target_fingerprint);
        }
        if cfg!(target_os = "macos") && operation.operation_type == "replace" {
            if let Err(error) = refresh_replacement_journal_identities(log) {
                log.status = "manual_review".to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.operation_phase = "target_committed".to_string();
                log.error_message = Some(format!(
                    "target_committed_identity_unreadable: replacement identities could not be captured: {error}"
                ));
            }
        }
        if log.status != "success" {
            continue;
        }
        if matches!(
            operation.operation_type.as_str(),
            "move_to_trash" | "copy" | "duplicate" | "permanent_delete"
        ) || operation.file_id == super::RECOVERY_ACTION_FILE_ID
        {
            continue;
        }

        if let Err(error) = db.update_file_after_successful_operation(
            &operation.file_id,
            &log.path_before,
            &log.path_after,
            &log.name_after,
        ) {
            let warning = format!("file index sync failed: {error}");
            eprintln!("{warning}");
            append_operation_log_error(log, warning);
        }
    }

    for log in &mut result.logs {
        log.operation_phase = operation_phase_for_log(log).to_string();
    }

    #[cfg(any(test, feature = "native-qa"))]
    if take_operation_test_fault(OperationTestFaultPoint::AfterCompletedPhaseBeforeFinalLogPersist)
    {
        return Err("injected after_completed_phase_before_final_log_persist failure".to_string());
    }

    db.save_operation_logs(&result.batch_id, &result.logs)
        .map_err(|error| format!("operation completed but failed to persist logs: {error}"))?;
    Ok(result)
}

pub(crate) fn execute_moves_core_with_progress_and_app_data(
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
    app_data_dir: Option<PathBuf>,
) -> ExecuteMovesResult {
    let batch_id = new_job_id("operation-batch");
    let created_at = current_timestamp_ms().to_string();
    execute_moves_core_with_identity(
        request,
        cancel_flag,
        emitter,
        app_data_dir,
        batch_id,
        created_at,
        OperationPersistenceContext {
            prepared_operations: None,
            journal_db: None,
        },
    )
}

pub(crate) struct OperationPersistenceContext<'a> {
    prepared_operations: Option<&'a std::collections::HashMap<String, PreparedOperation>>,
    journal_db: Option<&'a Database>,
}

fn execute_moves_core_with_identity(
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
    app_data_dir: Option<PathBuf>,
    batch_id: String,
    created_at: String,
    persistence: OperationPersistenceContext<'_>,
) -> ExecuteMovesResult {
    let prepared_operations = persistence.prepared_operations;
    let journal_db = persistence.journal_db;
    let total = request.operations.len() as u64;
    let mut progress = OperationProgressBuffer::new("execute", batch_id.clone(), total);
    let mut logs = Vec::with_capacity(request.operations.len());

    for (index, operation) in request.operations.iter().enumerate() {
        let log = if is_operation_cancelled(&cancel_flag) {
            make_canceled_operation_log(&batch_id, &created_at, index, operation)
        } else {
            let prepared = prepared_operations.and_then(|items| items.get(&operation.id));
            let expected_identity =
                prepared.map(|item| expected_identity_from_fingerprint(&item.fingerprint));
            let mut phase_log = prepared.map(|item| item.journal_log.clone());
            let mut observed_phase = None;
            let mut phase_observer = |phase: &str| {
                observed_phase = Some(phase.to_string());
                if let (Some(db), Some(log)) = (journal_db, phase_log.as_mut()) {
                    log.operation_phase = phase.to_string();
                    // The filesystem callback is not the durable operation
                    // completion boundary.  Keep the row pending until the
                    // final save_operation_logs transaction succeeds.
                    log.status = "pending".to_string();
                    log.error_message = None;
                    if cfg!(target_os = "macos")
                        && operation.operation_type == "replace"
                        && matches!(
                            phase,
                            "target_committed" | "source_cleanup_pending" | "completed"
                        )
                    {
                        refresh_replacement_journal_identities(log).map_err(|_| {
                            crate::fs_safety::AtomicMoveError::TargetCommittedDurabilityUnknown
                        })?;
                    }
                    db.update_operation_phase(log).map_err(|error| {
                        let message = format!("journal phase persistence failed: {error}");
                        if matches!(
                            phase,
                            "target_committed" | "source_cleanup_pending" | "completed"
                        ) {
                            crate::fs_safety::AtomicMoveError::TargetCommittedDurabilityUnknown
                        } else {
                            crate::fs_safety::AtomicMoveError::SourceClaimRecoveryRequired(message)
                        }
                    })?;
                }
                Ok(())
            };
            let mut log = execute_preview_operation_with_app_data(
                &batch_id,
                &created_at,
                index,
                operation,
                OperationExecutionContext {
                    cancel_flag: Some(cancel_flag.as_ref()),
                    app_data_dir: app_data_dir.as_deref(),
                    expected_identity: expected_identity.as_ref(),
                    planned_claim_path: prepared.map(|item| item.claim_path.as_path()),
                    phase_observer: journal_db
                        .map(|_| &mut phase_observer as &mut crate::fs_safety::PhaseObserver<'_>),
                },
            );
            if let Some(phase) = observed_phase {
                log.operation_phase = phase;
                if log.status != "success"
                    && !matches!(
                        log.operation_phase.as_str(),
                        "prepared" | "source_claimed" | "copying" | "rolled_back"
                    )
                {
                    log.status = "manual_review".to_string();
                    log.can_undo = false;
                    log.can_restore = false;
                }
            }
            log
        };
        let current_path = operation.source_path.clone();
        logs.push(log);
        progress.record(emitter, (index + 1) as u64, current_path);
    }

    ExecuteMovesResult { logs, batch_id }
}
