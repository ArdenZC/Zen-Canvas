#![cfg(all(target_os = "macos", target_arch = "aarch64"))]

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
    fs_safety::{atomic_move_noreplace, AtomicMoveCommitState, AtomicMoveMethod},
    platform::macos::mutation::{
        MAC_HARDLINK_NOT_SUPPORTED, MAC_PACKAGE_MUTATION_NOT_SUPPORTED, MAC_SYMLINK_NOT_ALLOWED,
    },
    storage_analyzer::{
        move_cleanup_candidates_to_safe_trash_for_candidates, restore_cleanup_trash_items_for_db,
        CleanupActionKind, CleanupTier, StorageCandidate,
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
fn same_volume_move_operation_restore_and_safe_trash_use_durable_authorities() {
    let root = fixture("durable");
    let source_root = fixture("durable-source");
    let db = Database::open(root.join("qa.sqlite3")).expect("database");

    let source = root.join("source.txt");
    let target = root.join("target.txt");
    fs::write(&source, b"macos canary").expect("source");
    let outcome = atomic_move_noreplace(&source, &target, None, None).expect("native move");
    assert_eq!(outcome.method, AtomicMoveMethod::SameVolumeNoReplace);
    assert_eq!(outcome.commit_state, AtomicMoveCommitState::Completed);
    assert!(!source.exists());
    assert_eq!(fs::read(&target).expect("target bytes"), b"macos canary");

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
    let executed = execute_moves_with_persistence(
        &db,
        ExecuteMovesRequest {
            operations: vec![operation],
        },
    )
    .expect("journal-backed move");
    assert_eq!(executed.logs[0].status, "success");
    assert!(journal_target.exists());

    let restored = restore_moves_with_persistence(
        &db,
        RestoreMovesRequest {
            logs: executed.logs,
        },
    )
    .expect("journal-backed restore");
    assert_eq!(restored.restored, 1);
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
    )
    .expect("Safe Trash move");
    assert_eq!(cleanup_result.moved, 1);
    let item_id = cleanup_result.logs[0]
        .item_id
        .clone()
        .expect("trash item id");
    assert!(!cleanup_source.exists());
    assert!(Path::new(
        &cleanup_result.logs[0]
            .trash_path
            .clone()
            .expect("trash path")
    )
    .exists());

    let cleanup_restore =
        restore_cleanup_trash_items_for_db(vec![item_id], &db).expect("Safe Trash restore");
    assert_eq!(cleanup_restore.restored, 1);
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
        "target_exists"
    );
    assert_eq!(fs::read(&source).expect("source remains"), b"source");
    assert_eq!(fs::read(&target).expect("target remains"), b"competitor");

    let symlink_source = root.join("symlink-source.txt");
    std::os::unix::fs::symlink(&source, &symlink_source).expect("symlink");
    assert_eq!(
        atomic_move_noreplace(
            &symlink_source,
            &root.join("symlink-target.txt"),
            None,
            None
        )
        .expect_err("symlink must fail closed")
        .to_string(),
        MAC_SYMLINK_NOT_ALLOWED
    );

    let hardlink_source = root.join("hardlink-source.txt");
    let hardlink_alias = root.join("hardlink-alias.txt");
    fs::write(&hardlink_source, b"hardlink").expect("hardlink source");
    fs::hard_link(&hardlink_source, &hardlink_alias).expect("hardlink alias");
    assert_eq!(
        atomic_move_noreplace(
            &hardlink_source,
            &root.join("hardlink-target.txt"),
            None,
            None,
        )
        .expect_err("hardlink must fail closed")
        .to_string(),
        MAC_HARDLINK_NOT_SUPPORTED
    );

    let package = root.join("Fixture.app");
    let package_source = package.join("Contents/Resources/source.txt");
    fs::create_dir_all(package_source.parent().expect("package parent")).expect("package");
    fs::write(&package_source, b"package").expect("package source");
    assert_eq!(
        atomic_move_noreplace(
            &package_source,
            &root.join("package-target.txt"),
            None,
            None
        )
        .expect_err("package must fail closed")
        .to_string(),
        MAC_PACKAGE_MUTATION_NOT_SUPPORTED
    );

    assert!(!fs::read_dir(&root)
        .expect("entries")
        .filter_map(Result::ok)
        .any(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            name.starts_with(".zen-canvas-claim-") || name.starts_with(".zen-canvas-stage-")
        }));
    fs::remove_dir_all(root).expect("remove fixture");
}
