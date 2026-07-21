#![cfg(all(feature = "native-qa", windows))]

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    env, fs,
    path::{Path, PathBuf},
};
use zen_canvas_tauri::{
    db::Database,
    file_ops::{
        execute_moves_with_persistence, reconcile_pending_operation_journal,
        restore_moves_with_persistence, ExecuteMovesRequest, OperationPreviewRequest,
        RestoreMovesRequest,
    },
    fs_safety::{
        atomic_move::test_faults::{self, AtomicFaultPoint},
        atomic_move_noreplace, capture_identity, claim_source, AtomicMoveError, VerifiedDirectory,
    },
    storage_analyzer::{
        classify_candidate_for_test, move_cleanup_candidates_to_safe_trash_for_candidates,
        reconcile_pending_cleanup_journal, restore_cleanup_trash_items_for_db,
    },
};

#[derive(Serialize)]
struct SmokeManifest {
    schema: &'static str,
    fixture_root: String,
    database: String,
    source_volume: String,
    target_volume: String,
    cross_volume_exercised: bool,
    operation_move_restore: &'static str,
    rename: &'static str,
    target_conflict: &'static str,
    source_replacement: &'static str,
    target_parent_replacement: &'static str,
    staging_handle_copy_commit: &'static str,
    cross_volume_directory_rejected: &'static str,
    durability_failure: &'static str,
    operation_reconciliation: &'static str,
    safe_trash_restore: &'static str,
    safe_trash_reconciliation: &'static str,
    sqlite_integrity: &'static str,
    canary_sha256_before: String,
    canary_sha256_after: String,
    canary_unchanged: bool,
    real_app_data_accessed: bool,
    fixture_cleaned: bool,
}

struct FixtureGuard {
    primary: PathBuf,
    secondary: Option<PathBuf>,
}

impl Drop for FixtureGuard {
    fn drop(&mut self) {
        remove_isolated_fixture_if_present(&self.primary);
        if let Some(secondary) = self.secondary.as_deref() {
            remove_isolated_fixture_if_present(secondary);
        }
    }
}

#[test]
#[ignore = "native filesystem QA harness; run explicitly with --features 'desktop-runtime native-qa'"]
fn native_file_hardening_smoke() {
    let run_id = uuid::Uuid::new_v4().to_string();
    let fixture_root = env::temp_dir().join(format!("zen-canvas-final-hardening-v411-{run_id}"));
    let source_volume = fixture_root.join("source-volume");
    let target_volume = secondary_target_root(&fixture_root, &run_id);
    let secondary_fixture = (!target_volume.starts_with(&fixture_root)).then(|| {
        target_volume
            .parent()
            .expect("secondary fixture root")
            .to_path_buf()
    });
    let fixture_guard = FixtureGuard {
        primary: fixture_root.clone(),
        secondary: secondary_fixture,
    };
    let app_data = fixture_root.join("app-data");
    let database_dir = fixture_root.join("database");
    let canary_dir = fixture_root.join("canary");
    for path in [
        &source_volume,
        &target_volume,
        &app_data,
        &database_dir,
        &canary_dir,
    ] {
        fs::create_dir_all(path).expect("create isolated smoke directory");
    }
    let canary = canary_dir.join("do-not-touch.txt");
    fs::write(&canary, b"native-qa-canary").expect("write canary");
    let canary_sha256_before = sha256_file(&canary);
    let database_path = database_dir.join("native-qa.sqlite3");
    let db = Database::open(&database_path).expect("open isolated database");

    let source = source_volume.join("unicode-源-file.txt");
    let target = target_volume.join("unicode-目标-file.txt");
    fs::write(&source, b"bound native operation payload").expect("write operation source");
    let operation = OperationPreviewRequest {
        id: format!("native-operation-{run_id}"),
        file_id: format!("native-file-{run_id}"),
        operation_type: "move".to_string(),
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        old_name: "unicode-源-file.txt".to_string(),
        new_name: "unicode-目标-file.txt".to_string(),
        is_executable: Some(true),
    };
    let moved = execute_moves_with_persistence(
        &db,
        ExecuteMovesRequest {
            operations: vec![operation],
        },
    )
    .expect("execute production persisted move");
    assert_eq!(moved.logs[0].status, "success");
    assert_eq!(
        fs::read(&target).expect("read target"),
        b"bound native operation payload"
    );

    let mut interrupted = moved.logs[0].clone();
    interrupted.status = "pending".to_string();
    interrupted.operation_phase = "target_committed".to_string();
    db.save_operation_logs(&interrupted.batch_id, std::slice::from_ref(&interrupted))
        .expect("simulate interrupted operation journal");
    assert_eq!(
        reconcile_pending_operation_journal(&db).expect("reconcile operation"),
        1
    );

    let restored = restore_moves_with_persistence(
        &db,
        RestoreMovesRequest {
            logs: moved.logs.clone(),
        },
    )
    .expect("restore production persisted move");
    assert_eq!(restored.restored, 1);
    assert_eq!(
        fs::read(&source).expect("read restored source"),
        b"bound native operation payload"
    );

    let rename_source = source_volume.join("rename-before.txt");
    let rename_target = source_volume.join("rename-after.txt");
    fs::write(&rename_source, b"native rename payload").expect("write rename source");
    let renamed = execute_moves_with_persistence(
        &db,
        ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: format!("native-rename-{run_id}"),
                file_id: format!("native-rename-file-{run_id}"),
                operation_type: "rename".to_string(),
                source_path: rename_source.to_string_lossy().into_owned(),
                target_path: rename_target.to_string_lossy().into_owned(),
                old_name: "rename-before.txt".to_string(),
                new_name: "rename-after.txt".to_string(),
                is_executable: Some(true),
            }],
        },
    )
    .expect("execute production persisted rename");
    assert_eq!(renamed.logs[0].status, "success");
    assert_eq!(
        fs::read(&rename_target).expect("renamed target"),
        b"native rename payload"
    );

    let conflict_source = source_volume.join("conflict-source.txt");
    let conflict_target = source_volume.join("conflict-target.txt");
    fs::write(&conflict_source, b"conflict source").expect("conflict source");
    fs::write(&conflict_target, b"competing target").expect("conflict target");
    assert!(matches!(
        atomic_move_noreplace(&conflict_source, &conflict_target, None, None),
        Err(AtomicMoveError::TargetExists)
    ));
    assert_eq!(
        fs::read(&conflict_source).expect("source retained"),
        b"conflict source"
    );
    assert_eq!(
        fs::read(&conflict_target).expect("target retained"),
        b"competing target"
    );

    let replacement_source = source_volume.join("replacement-source.txt");
    let replacement_target = source_volume.join("replacement-target.txt");
    fs::write(&replacement_source, b"replacement original").expect("replacement original");
    let replacement_expected =
        capture_identity(&replacement_source, None).expect("replacement expected identity");
    fs::write(&replacement_source, b"replacement changed!").expect("replace source");
    assert!(matches!(
        atomic_move_noreplace(
            &replacement_source,
            &replacement_target,
            Some(&replacement_expected),
            None,
        ),
        Err(AtomicMoveError::SourceChanged)
    ));
    assert_eq!(
        fs::read(&replacement_source).expect("replacement retained"),
        b"replacement changed!"
    );
    assert!(!replacement_target.exists());

    let bound_source = source_volume.join("bound-parent-source.txt");
    let bound_parent = source_volume.join("bound-parent");
    let displaced_parent = source_volume.join("bound-parent-displaced");
    fs::write(&bound_source, b"bound parent payload").expect("bound parent source");
    fs::create_dir(&bound_parent).expect("bound parent");
    let bound_expected = capture_identity(&bound_source, None).expect("bound source identity");
    let mut bound_claim = claim_source(&bound_source, &bound_expected, "native-bound-parent", None)
        .expect("bound source claim");
    let verified_parent =
        VerifiedDirectory::open_existing(&bound_parent).expect("verified target parent");
    fs::rename(&bound_parent, &displaced_parent).expect("displace target parent");
    fs::create_dir(&bound_parent).expect("replacement target parent");
    let parent_error = bound_claim
        .commit_to(verified_parent, std::ffi::OsStr::new("committed.txt"))
        .expect_err("replaced target parent must fail closed");
    assert!(parent_error
        .to_string()
        .contains("verified directory identity changed"));
    bound_claim
        .rollback_to_original()
        .expect("rollback bound source");
    assert_eq!(
        fs::read(&bound_source).expect("bound source retained"),
        b"bound parent payload"
    );
    assert!(!bound_parent.join("committed.txt").exists());
    assert!(!displaced_parent.join("committed.txt").exists());

    let durability_source = source_volume.join("durability-source.txt");
    let durability_target = source_volume.join("durability-target.txt");
    fs::write(&durability_source, b"durability payload").expect("durability source");
    test_faults::set_fault(Some(AtomicFaultPoint::TargetDurability));
    let durability = execute_moves_with_persistence(
        &db,
        ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: format!("native-durability-{run_id}"),
                file_id: format!("native-durability-file-{run_id}"),
                operation_type: "move".to_string(),
                source_path: durability_source.to_string_lossy().into_owned(),
                target_path: durability_target.to_string_lossy().into_owned(),
                old_name: "durability-source.txt".to_string(),
                new_name: "durability-target.txt".to_string(),
                is_executable: Some(true),
            }],
        },
    )
    .expect("durability execution result");
    test_faults::set_fault(None);
    assert_eq!(durability.logs[0].status, "manual_review");
    assert!(durability.logs[0]
        .error_message
        .as_deref()
        .is_some_and(|message| message.contains("target_committed_durability_unknown")));
    assert!(!durability_source.exists());
    assert_eq!(
        fs::read(&durability_target).expect("durability target"),
        b"durability payload"
    );

    if volume_prefix(&source_volume) != volume_prefix(&target_volume) {
        let directory_source = source_volume.join("cross-volume-directory");
        let directory_target = target_volume.join("cross-volume-directory");
        fs::create_dir_all(&directory_source).expect("cross-volume directory source");
        fs::write(directory_source.join("canary.txt"), b"directory canary")
            .expect("directory canary");
        let error = atomic_move_noreplace(&directory_source, &directory_target, None, None)
            .expect_err("cross-volume directory must fail closed");
        assert_eq!(error.to_string(), "cross_volume_directory_move_unsupported");
        assert_eq!(
            fs::read(directory_source.join("canary.txt")).expect("directory source unchanged"),
            b"directory canary"
        );
        assert!(!directory_target.exists());
    }

    let cleanup_source = target_volume.join("node_modules");
    fs::create_dir_all(cleanup_source.join("package")).expect("create cleanup fixture");
    fs::write(
        cleanup_source.join("package").join("index.js"),
        b"safe trash payload",
    )
    .expect("write cleanup fixture");
    let cleanup = classify_candidate_for_test(&cleanup_source, b"safe trash payload".len() as u64);
    let cleanup_result = move_cleanup_candidates_to_safe_trash_for_candidates(
        vec![cleanup.id.clone()],
        std::slice::from_ref(&cleanup),
        &db,
        Some(&app_data),
    )
    .expect("move through production Safe Trash");
    assert_eq!(
        cleanup_result.moved,
        1,
        "{}",
        serde_json::to_string(&cleanup_result).expect("cleanup result JSON")
    );
    let mut trash_item =
        db.list_cleanup_trash_batches().expect("list Safe Trash")[0].items[0].clone();
    trash_item.status = "pending".to_string();
    trash_item.operation_phase = "target_committed".to_string();
    db.update_cleanup_trash_item_status(&trash_item)
        .expect("simulate interrupted Safe Trash journal");
    assert_eq!(
        reconcile_pending_cleanup_journal(&db).expect("reconcile Safe Trash"),
        1
    );
    let cleanup_restore = restore_cleanup_trash_items_for_db(vec![trash_item.id], &db)
        .expect("restore through production Safe Trash");
    assert_eq!(cleanup_restore.restored, 1);
    assert!(cleanup_source.exists());

    let cross_volume_exercised = volume_prefix(&source_volume) != volume_prefix(&target_volume);
    let sqlite_integrity = rusqlite::Connection::open(&database_path)
        .expect("open SQLite integrity connection")
        .query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
        .expect("SQLite integrity_check");
    assert_eq!(sqlite_integrity, "ok");
    let manifest_path = env::temp_dir()
        .join("zen-canvas-native-qa-artifacts")
        .join("native-file-hardening-smoke.json");
    fs::create_dir_all(manifest_path.parent().expect("manifest parent"))
        .expect("create manifest directory");
    let fixture_text = fixture_root.to_string_lossy().into_owned();
    let database_text = database_path.to_string_lossy().into_owned();
    let source_text = source_volume.to_string_lossy().into_owned();
    let target_text = target_volume.to_string_lossy().into_owned();
    let canary_sha256_after = sha256_file(&canary);
    let canary_unchanged = canary_sha256_before == canary_sha256_after;
    assert!(canary_unchanged);
    drop(db);
    remove_isolated_fixture(&fixture_root);
    if !target_volume.starts_with(&fixture_root) {
        let secondary_root = target_volume.parent().expect("secondary fixture root");
        remove_isolated_fixture(secondary_root);
    }
    let manifest = SmokeManifest {
        schema: "zen-canvas-native-file-hardening-smoke/v1",
        fixture_root: fixture_text,
        database: database_text,
        source_volume: source_text,
        target_volume: target_text,
        cross_volume_exercised,
        operation_move_restore: "passed",
        rename: "passed",
        target_conflict: "passed",
        source_replacement: "passed",
        target_parent_replacement: "passed",
        staging_handle_copy_commit: if cross_volume_exercised {
            "passed"
        } else {
            "skipped_no_secondary_volume"
        },
        cross_volume_directory_rejected: if cross_volume_exercised {
            "passed"
        } else {
            "skipped_no_secondary_volume"
        },
        durability_failure: "passed",
        operation_reconciliation: "passed",
        safe_trash_restore: "passed",
        safe_trash_reconciliation: "passed",
        sqlite_integrity: "ok",
        canary_sha256_before,
        canary_sha256_after,
        canary_unchanged,
        real_app_data_accessed: false,
        fixture_cleaned: !fixture_root.exists() && !target_volume.exists(),
    };
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&manifest).expect("serialize manifest"),
    )
    .expect("write manifest");
    println!(
        "{}",
        serde_json::to_string(&manifest).expect("manifest line")
    );
    println!("manifest={}", manifest_path.display());
    drop(fixture_guard);
}

fn sha256_file(path: &Path) -> String {
    let bytes = fs::read(path).expect("read SHA-256 input");
    format!("{:x}", Sha256::digest(bytes))
}

fn secondary_target_root(fixture_root: &Path, run_id: &str) -> PathBuf {
    let source_prefix = volume_prefix(fixture_root);
    if let Ok(configured) = env::var("ZEN_CANVAS_NATIVE_QA_SECONDARY_TEMP") {
        let configured = PathBuf::from(configured);
        if configured.is_absolute() && volume_prefix(&configured) != source_prefix {
            return configured
                .join(format!("zen-canvas-final-hardening-v411-{run_id}"))
                .join("target-volume");
        }
    }
    for drive in b'C'..=b'Z' {
        let candidate_root = PathBuf::from(format!(
            "{}:\\zen-canvas-final-hardening-v411-{run_id}",
            drive as char
        ));
        if volume_prefix(&candidate_root) == source_prefix {
            continue;
        }
        let candidate = candidate_root.join("target-volume");
        if fs::create_dir_all(&candidate).is_ok() {
            return candidate;
        }
    }
    fixture_root.join("target-volume")
}

fn volume_prefix(path: &Path) -> String {
    path.components()
        .next()
        .map(|component| component.as_os_str().to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn remove_isolated_fixture(path: &Path) {
    let text = path.to_string_lossy().to_ascii_lowercase();
    assert!(text.contains("zen-canvas-final-hardening-v411-"));
    assert!(path.parent().is_some());
    if path.exists() {
        fs::remove_dir_all(path).expect("remove isolated native QA fixture");
    }
}

fn remove_isolated_fixture_if_present(path: &Path) {
    let text = path.to_string_lossy().to_ascii_lowercase();
    if text.contains("zen-canvas-final-hardening-v411-") && path.parent().is_some() && path.exists()
    {
        let _ = fs::remove_dir_all(path);
    }
}
