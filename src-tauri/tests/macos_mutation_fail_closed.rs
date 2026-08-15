#![cfg(all(target_os = "macos", target_arch = "aarch64"))]

use std::{
    fs,
    io::Write,
    sync::{Arc, Barrier},
    thread,
};

use zen_canvas_tauri::{
    db::Database,
    file_ops::{
        execute_moves_with_persistence, restore_moves_with_persistence, ExecuteMovesRequest,
        OperationPreviewRequest, RestoreMovesRequest,
    },
    fs_safety::{atomic_move_noreplace, AtomicMoveError},
};

fn fixture(name: &str) -> std::path::PathBuf {
    let root = std::env::temp_dir().join(format!(
        "zen-canvas-macos-native-{name}-{}",
        uuid::Uuid::new_v4()
    ));
    fs::create_dir_all(&root).expect("fixture");
    root
}

fn non_temp_fixture(name: &str) -> std::path::PathBuf {
    let root = std::env::current_dir()
        .expect("current directory")
        .join(format!(
            ".zen-canvas-macos-native-{name}-{}",
            uuid::Uuid::new_v4()
        ));
    fs::create_dir_all(&root).expect("non-temp fixture");
    root
}

fn execute(
    db: &Database,
    id: &str,
    operation_type: &str,
    source: &std::path::Path,
    target: &std::path::Path,
) -> zen_canvas_tauri::file_ops::OperationLogDto {
    execute_moves_with_persistence(
        db,
        ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: id.to_string(),
                file_id: format!("file-{id}"),
                operation_type: operation_type.to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: source
                    .file_name()
                    .expect("source name")
                    .to_string_lossy()
                    .into_owned(),
                new_name: target
                    .file_name()
                    .expect("target name")
                    .to_string_lossy()
                    .into_owned(),
                is_executable: Some(true),
            }],
        },
    )
    .expect("persist operation")
    .logs
    .into_iter()
    .next()
    .expect("operation log")
}

#[test]
fn macos_mutation_parity_supports_move_copy_replace_restore_and_delete() {
    let root = fixture("parity");
    let db = Database::open(root.join("qa.sqlite3")).expect("database");

    let source = root.join("source.txt");
    let moved = root.join("moved.txt");
    fs::write(&source, b"move payload").expect("source");
    let move_log = execute(&db, "move", "move", &source, &moved);
    assert_eq!(move_log.status, "success");
    assert!(!source.exists());
    assert_eq!(fs::read(&moved).expect("moved bytes"), b"move payload");
    let restored = restore_moves_with_persistence(
        &db,
        RestoreMovesRequest {
            logs: vec![move_log],
        },
    )
    .expect("restore move");
    assert_eq!(restored.restored, 1);
    assert_eq!(fs::read(&source).expect("restored bytes"), b"move payload");
    assert!(!moved.exists());

    let copy_target = root.join("copy.txt");
    let copy_log = execute(&db, "copy", "copy", &source, &copy_target);
    assert_eq!(copy_log.status, "success");
    assert!(source.exists());
    assert_eq!(fs::read(&copy_target).expect("copy bytes"), b"move payload");

    let duplicate_target = root.join("duplicate.txt");
    let duplicate_log = execute(&db, "duplicate", "duplicate", &source, &duplicate_target);
    assert_eq!(duplicate_log.status, "success");
    assert_eq!(
        fs::read(&duplicate_target).expect("duplicate bytes"),
        b"move payload"
    );

    let replace_source = root.join("replace-source.txt");
    let replace_target = root.join("replace-target.txt");
    fs::write(&replace_source, b"new target bytes").expect("replace source");
    fs::write(&replace_target, b"old target bytes").expect("replace target");
    let replace_log = execute(&db, "replace", "replace", &replace_source, &replace_target);
    assert_eq!(replace_log.status, "success");
    assert!(!replace_source.exists());
    assert_eq!(
        fs::read(&replace_target).expect("replacement bytes"),
        b"new target bytes"
    );
    let replacement_backup = fs::read_dir(&root)
        .expect("replacement entries")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(".zen-canvas-replace-"))
        })
        .expect("replacement backup path");
    assert_eq!(
        fs::read(&replacement_backup).expect("replacement backup"),
        b"old target bytes"
    );
    let restored_replace = restore_moves_with_persistence(
        &db,
        RestoreMovesRequest {
            logs: vec![replace_log],
        },
    )
    .expect("restore replacement");
    assert_eq!(
        restored_replace.restored, 1,
        "replacement restore result: {:?}",
        restored_replace.logs
    );
    assert_eq!(
        fs::read(&replace_source).expect("restored replacement source"),
        b"new target bytes"
    );
    assert_eq!(
        fs::read(&replace_target).expect("restored replacement target"),
        b"old target bytes"
    );
    assert!(!replacement_backup.exists());

    let delete_root = non_temp_fixture("delete");
    let delete_source = delete_root.join("delete.txt");
    fs::write(&delete_source, b"delete payload").expect("delete source");
    let delete_log = execute(
        &db,
        "delete",
        "permanent_delete",
        &delete_source,
        &delete_source,
    );
    assert_eq!(
        delete_log.status, "success",
        "permanent delete result: {:?}",
        delete_log
    );
    assert!(!delete_source.exists());
    fs::remove_dir_all(delete_root).expect("remove delete fixture");

    fs::remove_dir_all(root).expect("remove fixture");
}

#[test]
fn macos_symlink_and_package_mutations_keep_namespace_boundaries() {
    let root = fixture("namespace");
    let db = Database::open(root.join("qa.sqlite3")).expect("database");

    let target = root.join("target.txt");
    fs::write(&target, b"symlink target").expect("target");
    let link = root.join("link.txt");
    std::os::unix::fs::symlink("target.txt", &link).expect("symlink");
    let moved_link = root.join("moved-link.txt");
    let link_log = execute(&db, "symlink", "move", &link, &moved_link);
    assert_eq!(link_log.status, "success");
    assert_eq!(
        fs::read_link(&moved_link).expect("moved symlink"),
        std::path::PathBuf::from("target.txt")
    );
    assert!(target.exists());

    let package = root.join("Example.app");
    fs::create_dir_all(package.join("Contents/Resources")).expect("package");
    fs::write(package.join("Contents/Resources/data.txt"), b"package data").expect("package data");
    let moved_package = root.join("Moved.app");
    let package_log = execute(&db, "package", "move", &package, &moved_package);
    assert_eq!(package_log.status, "success");
    assert!(!package.exists());
    assert_eq!(
        fs::read(moved_package.join("Contents/Resources/data.txt")).expect("moved package data"),
        b"package data"
    );

    fs::remove_dir_all(root).expect("remove fixture");
}

#[test]
fn macos_target_conflict_preserves_both_objects_without_claim_artifacts() {
    let root = fixture("conflict");
    let source = root.join("source.txt");
    let target = root.join("target.txt");
    fs::write(&source, b"source").expect("source");
    fs::write(&target, b"competitor").expect("target");

    assert!(matches!(
        atomic_move_noreplace(&source, &target, None, None),
        Err(AtomicMoveError::TargetExists)
    ));
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

#[test]
fn macos_target_creation_race_never_loses_source_payload() {
    let root = fixture("race");
    let source_payload = b"race source payload";
    let competitor_payload = b"race competitor payload";

    for iteration in 0..256 {
        let case_root = root.join(format!("case-{iteration:04}"));
        fs::create_dir_all(&case_root).expect("race case root");
        let source = case_root.join("source.txt");
        let target = case_root.join("target.txt");
        fs::write(&source, source_payload).expect("race source");

        let barrier = Arc::new(Barrier::new(2));
        let attacker_barrier = Arc::clone(&barrier);
        let attacker_target = target.clone();
        let attacker = thread::spawn(move || {
            attacker_barrier.wait();
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            if let Ok(mut file) = options.open(attacker_target) {
                file.write_all(competitor_payload)
                    .expect("competitor payload");
            }
        });

        barrier.wait();
        let result = atomic_move_noreplace(&source, &target, None, None);
        attacker.join().expect("join target competitor");

        let source_exists = fs::symlink_metadata(&source).is_ok();
        let target_exists = fs::symlink_metadata(&target).is_ok();
        assert!(
            source_exists || target_exists,
            "both objects disappeared: {iteration}"
        );
        if source_exists {
            assert_eq!(
                fs::read(&source).expect("read surviving source"),
                source_payload
            );
        }
        if target_exists {
            let target_bytes = fs::read(&target).expect("read surviving target");
            assert!(
                target_bytes == source_payload || target_bytes == competitor_payload,
                "unexpected target payload in race case {iteration}"
            );
        }
        if result.is_ok() {
            assert!(
                !source_exists,
                "successful move left source behind: {iteration}"
            );
            assert_eq!(
                fs::read(&target).expect("read committed target"),
                source_payload
            );
        }
        assert!(!fs::read_dir(&case_root)
            .expect("race entries")
            .filter_map(Result::ok)
            .any(|entry| {
                let name = entry.file_name().to_string_lossy().into_owned();
                name.starts_with(".zen-canvas-claim-") || name.starts_with(".zen-canvas-stage-")
            }));
        fs::remove_dir_all(&case_root).expect("remove race case");
    }

    fs::remove_dir_all(root).expect("remove race fixture");
}
