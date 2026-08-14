#![cfg(all(feature = "native-qa", target_os = "macos", target_arch = "aarch64"))]

use std::{
    fs,
    panic::{catch_unwind, AssertUnwindSafe},
};

use zen_canvas_tauri::{
    db::Database,
    file_ops::{
        execute_moves_with_persistence, reconcile_pending_operation_journal,
        restore_moves_with_persistence, set_operation_test_fault, ExecuteMovesRequest,
        OperationPreviewRequest, OperationTestFaultPoint, RestoreMovesRequest,
    },
};

#[test]
fn macos_restore_fault_reconciles_after_target_commit() {
    let root = std::env::temp_dir().join(format!(
        "zen-canvas-macos-native-qa-{}",
        uuid::Uuid::new_v4()
    ));
    fs::create_dir_all(&root).expect("fixture root");
    let db = Database::open(root.join("qa.sqlite3")).expect("database");
    let source = root.join("source.txt");
    let target = root.join("target.txt");
    fs::write(&source, b"native restore fault payload").expect("source");

    let moved = execute_moves_with_persistence(
        &db,
        ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "macos-native-qa-move".to_string(),
                file_id: "macos-native-qa-file".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "source.txt".to_string(),
                new_name: "target.txt".to_string(),
                is_executable: Some(true),
            }],
        },
    )
    .expect("execute move");
    assert_eq!(moved.logs[0].status, "success");

    set_operation_test_fault(Some(
        OperationTestFaultPoint::AfterRestoreTargetCommittedBeforeFinalPersist,
    ));
    let panic_result = catch_unwind(AssertUnwindSafe(|| {
        let _ = restore_moves_with_persistence(
            &db,
            RestoreMovesRequest {
                logs: moved.logs.clone(),
            },
        );
    }));
    set_operation_test_fault(None);
    assert!(panic_result.is_err());
    assert!(source.exists());
    assert!(!target.exists());

    let pending = db
        .get_pending_restore_logs()
        .expect("pending restore logs")
        .into_iter()
        .find(|log| log.id == moved.logs[0].id)
        .expect("target-committed restore log");
    assert_eq!(pending.restore_phase, "target_committed");
    assert_eq!(
        reconcile_pending_operation_journal(&db).expect("reconcile target-committed restore"),
        1
    );
    let recovered = db
        .get_operation_logs(Some(20))
        .expect("recovered operation logs")
        .into_iter()
        .find(|log| log.id == moved.logs[0].id)
        .expect("recovered operation");
    assert_eq!(recovered.restore_status, "restored");
    assert_eq!(recovered.restore_phase, "completed");
    assert_eq!(
        fs::read(&source).expect("restored source"),
        b"native restore fault payload"
    );
    assert!(!target.exists());

    fs::remove_dir_all(root).expect("remove fixture");
}
