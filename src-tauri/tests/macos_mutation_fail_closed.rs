#![cfg(target_os = "macos")]

use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime},
};
use zen_canvas_tauri::{
    db::Database,
    file_ops::{
        execute_moves_with_persistence, restore_moves_with_persistence, ExecuteMovesRequest,
        OperationPreviewRequest, RestoreMovesRequest,
    },
    fs_safety::atomic_move_noreplace,
    storage_analyzer::{
        move_cleanup_candidates_to_safe_trash_for_candidates,
        preview_cleanup_operations_for_candidates, restore_cleanup_trash_items_for_db,
        CleanupActionKind, CleanupTier, StorageCandidate,
    },
};

const CODE: &str = "macos_file_mutation_source_binding_unsupported";

#[test]
fn macos_mutation_entrypoints_fail_closed_without_touching_fixture() {
    let root = std::env::temp_dir().join(format!(
        "zen-canvas-macos-fail-closed-{}",
        uuid::Uuid::new_v4()
    ));
    fs::create_dir_all(&root).expect("fixture");
    let source = root.join("source.txt");
    let target = root.join("target.txt");
    fs::write(&source, b"macos canary").expect("source");
    fs::File::options()
        .write(true)
        .open(&source)
        .expect("open source")
        .set_times(
            fs::FileTimes::new()
                .set_modified(SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60)),
        )
        .expect("age source for cleanup preview policy");
    let db = Database::open(root.join("qa.sqlite3")).expect("database");

    assert_eq!(
        atomic_move_noreplace(&source, &target, None, None)
            .expect_err("macOS atomic move must fail closed")
            .to_string(),
        CODE
    );
    let operation = OperationPreviewRequest {
        id: "macos-operation".to_string(),
        file_id: "macos-file".to_string(),
        operation_type: "move".to_string(),
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        old_name: "source.txt".to_string(),
        new_name: "target.txt".to_string(),
        is_executable: Some(true),
    };
    assert_eq!(
        execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![operation]
            }
        )
        .expect_err("execute must fail closed"),
        CODE
    );
    let rename = OperationPreviewRequest {
        id: "macos-rename".to_string(),
        file_id: "macos-file".to_string(),
        operation_type: "rename".to_string(),
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        old_name: "source.txt".to_string(),
        new_name: "target.txt".to_string(),
        is_executable: Some(true),
    };
    assert_eq!(
        execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![rename]
            }
        )
        .expect_err("rename must fail closed"),
        CODE
    );
    assert_eq!(
        restore_moves_with_persistence(&db, RestoreMovesRequest { logs: vec![] })
            .expect_err("restore must fail closed"),
        CODE
    );

    let cleanup = StorageCandidate {
        id: "macos-cleanup".to_string(),
        path: source.to_string_lossy().into_owned(),
        name: "source.txt".to_string(),
        size: b"macos canary".len() as u64,
        tier: CleanupTier::Safe,
        category: "QA".to_string(),
        reason: "isolated fixture".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };
    let preview = preview_cleanup_operations_for_candidates(
        vec![cleanup.id.clone()],
        std::slice::from_ref(&cleanup),
        None,
    )
    .expect("preview remains available");
    assert_eq!(preview.total, 1);
    assert_eq!(
        move_cleanup_candidates_to_safe_trash_for_candidates(
            vec![cleanup.id.clone()],
            &[cleanup],
            &db,
            Some(&root),
        )
        .expect_err("Safe Trash must fail closed"),
        CODE
    );
    assert_eq!(
        restore_cleanup_trash_items_for_db(vec![], &db)
            .expect_err("cleanup restore must fail closed"),
        CODE
    );

    assert_eq!(
        fs::read(&source).expect("source unchanged"),
        b"macos canary"
    );
    assert!(!target.exists());
    assert!(!fs::read_dir(&root)
        .expect("entries")
        .filter_map(Result::ok)
        .any(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            name.starts_with(".zen-canvas-claim-") || name.starts_with(".zen-canvas-stage-")
        }));
    drop(db);
    assert!(Path::new(&root).starts_with(std::env::temp_dir()));
    fs::remove_dir_all(root).expect("cleanup fixture");
}
