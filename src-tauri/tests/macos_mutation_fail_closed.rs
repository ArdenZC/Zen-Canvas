#![cfg(all(target_os = "macos", target_arch = "aarch64"))]

use std::{
    fs,
    time::{Duration, SystemTime},
};

use zen_canvas_tauri::{
    db::Database,
    file_ops::{execute_moves_with_persistence, ExecuteMovesRequest, OperationPreviewRequest},
    fs_safety::{atomic_move_noreplace, AtomicMoveError},
    storage_analyzer::{
        move_cleanup_candidates_to_safe_trash_for_candidates, CleanupActionKind, CleanupTier,
        StorageCandidate,
    },
};

fn fixture(name: &str) -> std::path::PathBuf {
    let root = std::env::temp_dir().join(format!(
        "zen-canvas-macos-native-{name}-{}",
        uuid::Uuid::new_v4()
    ));
    fs::create_dir_all(&root).expect("fixture");
    root
}

#[test]
fn macos_mutation_surfaces_fail_closed_without_descriptor_bound_source_support() {
    let root = fixture("durable");
    let source_root = fixture("durable-source");
    let db = Database::open(root.join("qa.sqlite3")).expect("database");

    let source = root.join("source.txt");
    let target = root.join("target.txt");
    fs::write(&source, b"macos canary").expect("source");
    assert!(matches!(
        atomic_move_noreplace(&source, &target, None, None),
        Err(AtomicMoveError::MacosFileMutationSourceBindingUnsupported)
    ));
    assert_eq!(fs::read(&source).expect("source remains"), b"macos canary");
    assert!(!target.exists());

    let journal_source = root.join("journal-source.txt");
    let journal_target = root.join("journal-target.txt");
    fs::write(&journal_source, b"journal payload").expect("journal source");
    let operation = OperationPreviewRequest {
        id: "macos-operation".to_string(),
        file_id: "macos-file".to_string(),
        operation_type: "move".to_string(),
        source_path: journal_source.to_string_lossy().into_owned(),
        target_path: journal_target.to_string_lossy().into_owned(),
        old_name: "journal-source.txt".to_string(),
        new_name: "journal-target.txt".to_string(),
        is_executable: Some(true),
    };
    let operation_result = execute_moves_with_persistence(
        &db,
        ExecuteMovesRequest {
            operations: vec![operation],
        },
    );
    assert!(operation_result
        .expect_err("journal-backed mutation must fail closed")
        .contains("macos_file_mutation_source_binding_unsupported"));
    assert!(journal_source.exists());
    assert!(!journal_target.exists());

    let cleanup_source = source_root.join("cleanup.txt");
    fs::write(&cleanup_source, b"safe trash payload").expect("cleanup source");
    let cleanup_file = fs::OpenOptions::new()
        .write(true)
        .open(&cleanup_source)
        .expect("open cleanup source");
    cleanup_file
        .set_times(
            fs::FileTimes::new()
                .set_modified(SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60)),
        )
        .expect("age cleanup source");
    let cleanup = StorageCandidate {
        id: "macos-cleanup".to_string(),
        path: cleanup_source.to_string_lossy().into_owned(),
        name: "cleanup.txt".to_string(),
        size: b"safe trash payload".len() as u64,
        tier: CleanupTier::Safe,
        category: "QA".to_string(),
        reason: "isolated fixture".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };
    let cleanup_result = move_cleanup_candidates_to_safe_trash_for_candidates(
        vec![cleanup.id.clone()],
        std::slice::from_ref(&cleanup),
        &db,
        Some(&root),
    );
    assert!(cleanup_result
        .expect_err("Safe Trash mutation must fail closed")
        .contains("macos_file_mutation_source_binding_unsupported"));
    assert!(cleanup_source.exists());

    drop(db);
    fs::remove_dir_all(source_root).expect("remove source fixture");
    fs::remove_dir_all(root).expect("remove fixture");
}

#[test]
fn unsafe_entries_fail_closed_without_creating_a_claim_or_overwriting_a_target() {
    let root = fixture("unsafe");

    let source = root.join("source.txt");
    let target = root.join("target.txt");
    fs::write(&source, b"source").expect("source");
    fs::write(&target, b"competitor").expect("target");
    assert_eq!(
        atomic_move_noreplace(&source, &target, None, None)
            .expect_err("target must not be overwritten")
            .to_string(),
        "macos_file_mutation_source_binding_unsupported"
    );
    assert_eq!(fs::read(&source).expect("source remains"), b"source");
    assert_eq!(fs::read(&target).expect("target remains"), b"competitor");

    assert!(!fs::read_dir(&root)
        .expect("entries")
        .filter_map(Result::ok)
        .any(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            name.starts_with(".zen-canvas-claim-") || name.starts_with(".zen-canvas-stage-")
        }));
    fs::remove_dir_all(root).expect("remove fixture");
}
