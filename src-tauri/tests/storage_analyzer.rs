use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use zen_canvas_tauri::db::Database;
use zen_canvas_tauri::storage_analyzer::{
    analyze_storage_roots_for_test, classify_candidate_for_test,
    cleanup_preview_items_for_candidates, default_scan_roots_for_test,
    get_storage_cleanup_scan_status_for_test, is_forbidden_storage_path_for_test,
    is_main_window_label_for_test, move_cleanup_candidates_to_safe_trash_for_candidates,
    move_cleanup_candidates_to_trash_for_candidates, preview_cleanup_operations_for_candidates,
    preview_cleanup_restore_item_for_test, reconcile_pending_cleanup_journal,
    restore_cleanup_trash_items_for_db, restore_cleanup_trash_items_for_db_with_cancel_for_test,
    run_cleanup_restore_job_for_test, start_storage_cleanup_scan_for_test,
    validate_cleanup_roots_for_test, CleanupActionKind, CleanupRestoreJobStatus,
    CleanupRestoreState, CleanupRestoreTestOutcome, CleanupTier, StorageCandidate,
    StorageCleanupProgress, StorageCleanupState,
};

#[test]
fn storage_analyzer_classifies_regenerable_build_outputs_as_safe() {
    let root = test_dir();
    let project = root.join("workspace").join("node_modules");
    write_file(&project.join("package").join("index.js"), 128);

    let analysis = analyze_storage_roots_for_test(vec![root.clone()], Vec::new())
        .expect("analyze storage roots");
    let candidate = analysis
        .candidates
        .iter()
        .find(|candidate| candidate.path.ends_with("node_modules"))
        .expect("node_modules candidate");

    assert_eq!(candidate.tier, CleanupTier::Safe);
    assert_eq!(candidate.suggested_action, CleanupActionKind::MoveToTrash);
    assert!(candidate.trash_allowed);
    assert!(candidate.selected_by_default);
    assert!(candidate
        .risk_note
        .as_deref()
        .unwrap_or("")
        .contains("dependency"));
    assert!(analysis.reclaimable_estimate >= candidate.size);
}

#[test]
fn default_storage_cleanup_roots_do_not_scan_entire_appdata_or_program_files() {
    let roots = default_scan_roots_for_test()
        .into_iter()
        .map(|path| {
            path.to_string_lossy()
                .replace('\\', "/")
                .to_ascii_lowercase()
        })
        .collect::<Vec<_>>();

    assert!(roots.iter().any(|path| path.contains("/downloads")));
    assert!(roots.iter().any(|path| path.contains("/desktop")));
    assert!(roots.iter().any(|path| path.contains("/documents")));
    assert!(roots.iter().any(|path| path.contains("/temp")));
    assert!(roots
        .iter()
        .any(|path| path.contains(".npm") || path.contains("npm-cache")));
    assert!(!roots.iter().any(|path| path.ends_with("/.cargo")));
    assert!(!roots.iter().any(|path| path.ends_with("/.m2")));
    assert!(!roots.iter().any(|path| path.ends_with("/.gradle")));
    assert!(roots
        .iter()
        .any(|path| path.ends_with("/.cargo/registry/cache")));
    assert!(roots.iter().any(|path| path.ends_with("/.m2/repository")));
    assert!(roots.iter().any(|path| path.ends_with("/.gradle/caches")));
    assert!(!roots.iter().any(|path| path.ends_with("/appdata/local")));
    assert!(!roots.iter().any(|path| path.ends_with("/appdata/roaming")));
    assert!(!roots.iter().any(|path| path.ends_with("/program files")));
    assert!(!roots
        .iter()
        .any(|path| path.ends_with("/program files (x86)")));
}

#[test]
fn storage_cleanup_scan_requires_explicit_user_roots() {
    let result = validate_cleanup_roots_for_test(Vec::new());

    assert!(result.is_err());
}

#[test]
fn storage_cleanup_scan_only_uses_user_selected_roots() {
    let selected_root = test_dir();
    let other_root = test_dir();
    let selected_cache = selected_root.join("project").join("node_modules");
    let other_cache = other_root.join("project").join("node_modules");
    write_file(&selected_cache.join("package").join("index.js"), 128);
    write_file(&other_cache.join("package").join("index.js"), 128);

    let analysis = analyze_storage_roots_for_test(vec![selected_root.clone()], Vec::new())
        .expect("analyze selected root");

    assert!(analysis
        .candidates
        .iter()
        .any(|candidate| candidate.path == selected_cache.to_string_lossy().replace('\\', "/")));
    assert!(!analysis
        .candidates
        .iter()
        .any(|candidate| candidate.path == other_cache.to_string_lossy().replace('\\', "/")));
}

#[test]
fn storage_cleanup_scan_rejects_protected_system_roots() {
    let result = validate_cleanup_roots_for_test(vec!["C:/Windows/System32".to_string()]);

    assert!(result.is_err());
}

#[test]
fn storage_cleanup_rejects_unix_system_roots() {
    for path in ["/", "/System", "/usr", "/etc", "/var", "/bin", "/sbin"] {
        assert!(
            is_forbidden_storage_path_for_test(Path::new(path)),
            "expected {path} to be protected"
        );
    }
}

#[test]
fn storage_cleanup_scan_accepts_user_selected_temp_directory() {
    let root = test_dir();
    let result = validate_cleanup_roots_for_test(vec![root.to_string_lossy().into_owned()]);

    assert!(result.is_ok());
}

#[cfg(target_os = "macos")]
#[test]
fn storage_cleanup_accepts_both_macos_temp_path_forms() {
    for path in [
        "/tmp/zen-canvas-test",
        "/var/folders/zen-canvas-test",
        "/private/tmp/zen-canvas-test",
        "/private/var/folders/zen-canvas-test",
    ] {
        assert!(
            !is_forbidden_storage_path_for_test(Path::new(path)),
            "expected macOS temp path {path} to remain eligible"
        );
    }
}

#[test]
fn storage_cleanup_scan_job_can_report_progress_and_be_cancelled() {
    let root = test_dir();
    for index in 0..150 {
        write_file(&root.join(format!("file-{index}.tmp")), 32);
    }
    let state = StorageCleanupState::default();

    let job_id =
        start_storage_cleanup_scan_for_test(vec![root.clone()], &state).expect("start job");
    thread::sleep(Duration::from_millis(30));
    let started = get_storage_cleanup_scan_status_for_test(&job_id, &state).expect("status");

    assert_eq!(started.job_id, job_id);
    assert!(matches!(started.status.as_str(), "running" | "completed"));
    assert!(started.progress.scanned_entries > 0 || started.analysis.is_some());

    zen_canvas_tauri::storage_analyzer::cancel_storage_cleanup_scan_for_test(&job_id, &state)
        .expect("cancel job");
    thread::sleep(Duration::from_millis(30));
    let cancelled = get_storage_cleanup_scan_status_for_test(&job_id, &state).expect("status");

    assert!(matches!(
        cancelled.status.as_str(),
        "cancelled" | "completed"
    ));
}

#[test]
fn storage_cleanup_progress_payload_serializes_camel_case() {
    let payload = StorageCleanupProgress {
        job_id: "job-1".to_string(),
        scanned_entries: 7,
        current_path: Some("C:/Users/Zen/file.tmp".to_string()),
        total_size: 99,
    };
    let value = serde_json::to_value(payload).expect("serialize progress");

    assert_eq!(value["jobId"], "job-1");
    assert_eq!(value["scannedEntries"], 7);
    assert_eq!(value["currentPath"], "C:/Users/Zen/file.tmp");
    assert_eq!(value["totalSize"], 99);
}

#[test]
fn storage_analyzer_marks_download_media_as_review_without_default_trash() {
    let candidate = classify_candidate_for_test(
        &PathBuf::from("C:/Users/zen/Downloads/movie.mp4"),
        50_000_000,
    );

    assert_eq!(candidate.tier, CleanupTier::Review);
    assert_eq!(candidate.suggested_action, CleanupActionKind::Reveal);
    assert!(!candidate.trash_allowed);
}

#[test]
fn storage_analyzer_keeps_program_files_and_database_like_paths_cautious() {
    let app_candidate = classify_candidate_for_test(
        &PathBuf::from("C:/Program Files/Example/app.exe"),
        50_000_000,
    );
    let db_candidate = classify_candidate_for_test(
        &PathBuf::from("C:/Users/zen/AppData/Roaming/Tencent/WeChat/msg.db"),
        50_000_000,
    );

    assert_eq!(app_candidate.tier, CleanupTier::Caution);
    assert_eq!(
        app_candidate.suggested_action,
        CleanupActionKind::UninstallAdvice
    );
    assert!(!app_candidate.trash_allowed);
    assert_eq!(db_candidate.tier, CleanupTier::Caution);
    assert!(!db_candidate.trash_allowed);
}

#[test]
fn storage_analyzer_rejects_forbidden_system_and_app_database_paths() {
    let app_data = PathBuf::from("C:/Users/zen/AppData/Roaming/Startlan/Zen Canvas");

    assert!(is_forbidden_storage_path_for_test(Path::new(
        "C:/Windows/System32"
    )));
    assert!(is_forbidden_storage_path_for_test(Path::new(
        "C:/ProgramData"
    )));
    assert!(is_forbidden_storage_path_for_test(&app_data));
}

#[test]
fn storage_analyzer_records_forbidden_roots_as_denied_without_safe_candidates() {
    let analysis =
        analyze_storage_roots_for_test(vec![PathBuf::from("C:/Windows/System32")], Vec::new())
            .expect("analyze forbidden root");

    assert_eq!(analysis.total_size, 0);
    assert!(analysis
        .denied_paths
        .iter()
        .any(|path| path.contains("Windows/System32")));
    assert!(analysis
        .candidates
        .iter()
        .all(|candidate| candidate.tier != CleanupTier::Safe));
}

#[test]
fn storage_analyzer_marks_temp_and_package_caches_safe() {
    let temp_candidate = classify_candidate_for_test(
        &PathBuf::from("C:/Users/zen/AppData/Local/Temp/zen-cache.tmp"),
        500,
    );
    let cargo_candidate =
        classify_candidate_for_test(&PathBuf::from("C:/Users/zen/.cargo/registry/cache"), 500);

    assert_eq!(temp_candidate.tier, CleanupTier::Safe);
    assert!(temp_candidate.trash_allowed);
    assert!(temp_candidate.selected_by_default);
    assert_eq!(cargo_candidate.tier, CleanupTier::Safe);
    assert!(cargo_candidate.trash_allowed);
    assert!(cargo_candidate.selected_by_default);
}

#[test]
fn storage_analyzer_never_selects_developer_credentials_or_config() {
    for path in [
        "C:/Users/zen/.cargo/credentials.toml",
        "C:/Users/zen/.m2/settings.xml",
        "C:/Users/zen/.gradle/init.gradle",
    ] {
        let candidate = classify_candidate_for_test(Path::new(path), 500);
        assert_ne!(candidate.tier, CleanupTier::Safe, "{path}");
        assert!(!candidate.trash_allowed, "{path}");
        assert!(!candidate.selected_by_default, "{path}");
    }
}

#[test]
fn storage_analyzer_does_not_select_build_outputs_by_default() {
    for path in [
        "C:/Users/zen/project/build",
        "C:/Users/zen/project/dist",
        "C:/Users/zen/project/target",
    ] {
        let candidate = classify_candidate_for_test(&PathBuf::from(path), 500);

        assert_eq!(candidate.tier, CleanupTier::Safe);
        assert!(candidate.trash_allowed);
        assert!(!candidate.selected_by_default);
    }
}

#[test]
fn storage_analyzer_does_not_return_overlapping_safe_parent_and_child_candidates() {
    let root = test_dir();
    let parent = root.join("node_modules");
    let child = parent.join("package").join("dist");
    write_file(&child.join("index.js"), 128);

    let analysis = analyze_storage_roots_for_test(vec![root], Vec::new())
        .expect("analyze nested cleanup candidates");
    let safe_paths = analysis
        .candidates
        .iter()
        .filter(|candidate| candidate.trash_allowed)
        .map(|candidate| candidate.path.as_str())
        .collect::<Vec<_>>();

    assert!(safe_paths.iter().any(|path| path.ends_with("node_modules")));
    assert!(!safe_paths.iter().any(|path| path.ends_with("package/dist")));
}

#[test]
fn cleanup_preview_items_only_include_safe_trash_allowed_candidates() {
    let safe = classify_candidate_for_test(&PathBuf::from("C:/Users/zen/project/target"), 100);
    let review =
        classify_candidate_for_test(&PathBuf::from("C:/Users/zen/Downloads/movie.zip"), 100);
    let caution = classify_candidate_for_test(&PathBuf::from("C:/Program Files/Example"), 100);

    let preview = cleanup_preview_items_for_candidates(
        vec![safe.id.clone(), review.id.clone(), caution.id.clone()],
        &[safe, review, caution],
    )
    .expect("preview items");

    assert_eq!(preview.len(), 1);
    assert_eq!(preview[0].tier, CleanupTier::Safe);
    assert_eq!(preview[0].operation_type, "move_to_trash_preview");
    assert!(!preview[0].is_executable);
}

#[test]
fn cleanup_preview_items_reject_system_paths_even_if_client_marks_them_safe() {
    let forged = StorageCandidate {
        id: "forged-system-safe".to_string(),
        path: "C:/Windows/Temp".to_string(),
        name: "Temp".to_string(),
        size: 100,
        tier: CleanupTier::Safe,
        category: "Forged".to_string(),
        reason: "Client supplied".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };

    let preview = cleanup_preview_items_for_candidates(vec![forged.id.clone()], &[forged])
        .expect("preview items");

    assert!(preview.is_empty());
}

#[test]
fn storage_analyzer_ignores_zen_canvas_safe_trash_paths() {
    let root = test_dir();
    let safe_trash = root.join(".zen-canvas-trash").join("items");
    write_file(
        &safe_trash
            .join("batch")
            .join("item")
            .join("node_modules")
            .join("x.js"),
        256,
    );

    let analysis =
        analyze_storage_roots_for_test(vec![root], Vec::new()).expect("analyze storage roots");

    assert!(analysis
        .candidates
        .iter()
        .all(|candidate| !candidate.path.contains(".zen-canvas-trash")));
}

#[test]
fn cleanup_operation_preview_only_includes_safe_trash_candidates() {
    let root = test_dir();
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);
    let review = classify_candidate_for_test(&root.join("Downloads").join("movie.mp4"), 128);
    let caution = classify_candidate_for_test(&PathBuf::from("C:/Program Files/Example"), 128);

    let preview = preview_cleanup_operations_for_candidates(
        vec![safe.id.clone(), review.id.clone(), caution.id.clone()],
        &[safe.clone(), review, caution],
        None,
    )
    .expect("cleanup operation preview");

    assert_eq!(preview.total, 1);
    assert_eq!(preview.previews.len(), 1);
    assert_eq!(preview.previews[0].operation_type, "move_to_trash");
    assert_eq!(preview.previews[0].source_path, safe.path);
    assert_eq!(preview.previews[0].target_path, "Recycle Bin");
    assert!(preview.previews[0].requires_confirmation);
    assert_eq!(preview.previews[0].suggested_action, "DeleteCandidate");
    assert_eq!(preview.previews[0].is_executable, Some(true));
    assert_eq!(preview.previews[0].editable_new_name, Some(false));
    assert_eq!(preview.previews[0].will_create_parent, Some(false));
}

#[test]
fn cleanup_operation_preview_rejects_system_and_app_data_paths() {
    let root = test_dir();
    let app_data = root.join("Zen Canvas");
    let app_data_child = app_data.join("cache");
    write_file(&app_data_child.join("owned.txt"), 64);
    let forged_app_data = StorageCandidate {
        id: "forged-app-data".to_string(),
        path: app_data_child.to_string_lossy().into_owned(),
        name: "cache".to_string(),
        size: 64,
        tier: CleanupTier::Safe,
        category: "Forged".to_string(),
        reason: "Client supplied".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };
    let forged_system = StorageCandidate {
        id: "forged-system".to_string(),
        path: "C:/Windows/System32".to_string(),
        name: "System32".to_string(),
        size: 64,
        tier: CleanupTier::Safe,
        category: "Forged".to_string(),
        reason: "Client supplied".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };

    let preview = preview_cleanup_operations_for_candidates(
        vec![forged_app_data.id.clone(), forged_system.id.clone()],
        &[forged_app_data, forged_system],
        Some(&app_data),
    )
    .expect("cleanup operation preview");

    assert!(preview.previews.is_empty());
    assert_eq!(preview.total, 0);
}

#[test]
fn move_cleanup_candidates_to_trash_only_allows_safe_latest_candidates() {
    let root = test_dir();
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);
    let review = classify_candidate_for_test(&root.join("Downloads").join("movie.mp4"), 128);
    let caution = classify_candidate_for_test(&PathBuf::from("C:/Program Files/Example"), 128);

    let result = move_cleanup_candidates_to_trash_for_candidates(
        vec![
            safe.id.clone(),
            review.id.clone(),
            caution.id.clone(),
            "missing-id".to_string(),
        ],
        &[safe.clone(), review, caution],
        None,
    )
    .expect("move cleanup candidates to trash");

    assert_eq!(result.moved, 1);
    assert_eq!(result.skipped, 3);
    assert_eq!(result.failed, 0);
    assert!(result.logs.iter().any(|log| log.status == "success"
        && log.path == safe.path
        && log.message.contains("system trash")));
    assert!(!safe_path.exists());
}

#[test]
fn move_cleanup_candidates_to_trash_revalidates_execution_forbidden_paths() {
    let root = test_dir();
    let app_data = root.join("Zen Canvas");
    let app_data_child = app_data.join("cache");
    write_file(&app_data_child.join("owned.txt"), 64);
    let forged = StorageCandidate {
        id: "forged-app-data".to_string(),
        path: app_data_child.to_string_lossy().replace('\\', "/"),
        name: "cache".to_string(),
        size: 64,
        tier: CleanupTier::Safe,
        category: "Forged".to_string(),
        reason: "Client supplied".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };

    let result = move_cleanup_candidates_to_trash_for_candidates(
        vec![forged.id.clone()],
        &[forged],
        Some(&app_data),
    )
    .expect("move cleanup candidates to trash");

    assert_eq!(result.moved, 0);
    assert_eq!(result.skipped, 1);
    assert!(app_data_child.exists());
}

#[test]
fn move_cleanup_candidates_to_safe_trash_records_and_restores_items() {
    let root = test_dir();
    let db = Database::open(test_db_path()).expect("open db");
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);

    let result = move_cleanup_candidates_to_safe_trash_for_candidates(
        vec![safe.id.clone()],
        &[safe.clone()],
        &db,
        None,
    )
    .expect("move to safe trash");

    assert_eq!(result.moved, 1);
    assert_eq!(result.failed, 0);
    assert!(!safe_path.exists());
    let item = db.list_cleanup_trash_batches().expect("trash batches")[0].items[0].clone();
    assert_eq!(item.original_path, safe.path);
    assert_eq!(item.status, "moved");
    assert!(Path::new(&item.trash_path).starts_with(root.join(".zen-canvas-trash")));
    assert!(Path::new(&item.trash_path).exists());

    let restore =
        restore_cleanup_trash_items_for_db(vec![item.id.clone()], &db).expect("restore safe trash");

    assert_eq!(restore.restored, 1);
    assert!(safe_path.exists());
    let restored_item = db.list_cleanup_trash_batches().expect("trash batches")[0].items[0].clone();
    assert_eq!(restored_item.status, "restored");
}

#[test]
fn pending_safe_trash_journal_reconciles_a_completed_move_after_restart() {
    let root = test_dir();
    let db = Database::open(test_db_path()).expect("open db");
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);
    move_cleanup_candidates_to_safe_trash_for_candidates(vec![safe.id.clone()], &[safe], &db, None)
        .expect("move to safe trash");
    let mut item = db.list_cleanup_trash_batches().expect("batches")[0].items[0].clone();
    item.status = "pending".to_string();
    item.message = Some("simulate interrupted journal update".to_string());
    db.update_cleanup_trash_item_status(&item)
        .expect("mark pending");

    let reconciled = reconcile_pending_cleanup_journal(&db).expect("reconcile cleanup");
    let batch = &db.list_cleanup_trash_batches().expect("batches after")[0];

    assert_eq!(reconciled, 1);
    assert_eq!(batch.status, "success");
    assert_eq!(batch.items[0].status, "moved");
}

#[test]
fn move_cleanup_candidates_to_safe_trash_rejects_review_caution_missing_and_system_paths() {
    let root = test_dir();
    let db = Database::open(test_db_path()).expect("open db");
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let review = classify_candidate_for_test(&root.join("Downloads").join("movie.mp4"), 128);
    let caution = classify_candidate_for_test(&PathBuf::from("C:/Program Files/Example"), 128);
    let forged_system = StorageCandidate {
        id: "forged-system".to_string(),
        path: "C:/Windows/System32".to_string(),
        name: "System32".to_string(),
        size: 64,
        tier: CleanupTier::Safe,
        category: "Forged".to_string(),
        reason: "Client supplied".to_string(),
        suggested_action: CleanupActionKind::MoveToTrash,
        risk_note: None,
        trash_allowed: true,
        selected_by_default: true,
    };

    let result = move_cleanup_candidates_to_safe_trash_for_candidates(
        vec![
            review.id.clone(),
            caution.id.clone(),
            forged_system.id.clone(),
            "missing".to_string(),
        ],
        &[review, caution, forged_system],
        &db,
        None,
    )
    .expect("move to safe trash");

    assert_eq!(result.moved, 0);
    assert_eq!(result.skipped, 4);
    assert!(db
        .list_cleanup_trash_batches()
        .expect("trash batches")
        .is_empty());
}

#[test]
fn restore_cleanup_trash_items_blocks_conflicts_and_marks_missing_trash_paths() {
    let root = test_dir();
    let db = Database::open(test_db_path()).expect("open db");
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);
    let result = move_cleanup_candidates_to_safe_trash_for_candidates(
        vec![safe.id.clone()],
        &[safe],
        &db,
        None,
    )
    .expect("move to safe trash");
    assert_eq!(result.moved, 1);
    write_file(&safe_path.join("conflict.txt"), 16);
    let item = db.list_cleanup_trash_batches().expect("trash batches")[0].items[0].clone();

    let conflict =
        restore_cleanup_trash_items_for_db(vec![item.id.clone()], &db).expect("restore conflict");

    assert_eq!(conflict.restored, 0);
    assert_eq!(conflict.conflicts, 1);
    assert!(safe_path.exists());

    let trash_path = PathBuf::from(item.trash_path);
    if trash_path.exists() {
        if trash_path.is_dir() {
            fs::remove_dir_all(&trash_path).expect("remove trash path");
        } else {
            fs::remove_file(&trash_path).expect("remove trash path");
        }
    }
    fs::remove_dir_all(&safe_path).expect("remove conflict");
    let missing =
        restore_cleanup_trash_items_for_db(vec![item.id.clone()], &db).expect("restore missing");

    assert_eq!(missing.restored, 0);
    assert_eq!(missing.missing, 1);
    let missing_item = db.list_cleanup_trash_batches().expect("trash batches")[0].items[0].clone();
    assert_eq!(missing_item.status, "missing");
}

#[test]
fn cleanup_restore_preview_marks_filesystem_conflicts_and_missing_sources() {
    let root = test_dir();
    let db = Database::open(test_db_path()).expect("open db");
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);
    move_cleanup_candidates_to_safe_trash_for_candidates(vec![safe.id.clone()], &[safe], &db, None)
        .expect("move to safe trash");
    let item = db.list_cleanup_trash_batches().expect("trash batches")[0].items[0].clone();

    let executable = preview_cleanup_restore_item_for_test(item.clone());
    assert!(executable.can_restore);
    assert_eq!(executable.blocking_reason, None);

    write_file(&safe_path.join("conflict.txt"), 16);
    let conflict = preview_cleanup_restore_item_for_test(item.clone());
    assert!(!conflict.can_restore);
    assert_eq!(conflict.blocking_reason.as_deref(), Some("conflict"));

    fs::remove_dir_all(&safe_path).expect("remove conflict path");
    let trash_path = PathBuf::from(&item.trash_path);
    if trash_path.is_dir() {
        fs::remove_dir_all(&trash_path).expect("remove trash path");
    } else if trash_path.exists() {
        fs::remove_file(&trash_path).expect("remove trash path");
    }
    let missing = preview_cleanup_restore_item_for_test(item);
    assert!(!missing.can_restore);
    assert_eq!(missing.blocking_reason.as_deref(), Some("missing"));
}

#[test]
fn cleanup_restore_cancellation_skips_remaining_items_without_moving_files() {
    let root = test_dir();
    let db = Database::open(test_db_path()).expect("open db");
    let safe_path = root.join("node_modules");
    write_file(&safe_path.join("package").join("index.js"), 128);
    let safe = classify_candidate_for_test(&safe_path, 128);
    move_cleanup_candidates_to_safe_trash_for_candidates(vec![safe.id.clone()], &[safe], &db, None)
        .expect("move to safe trash");
    let item = db.list_cleanup_trash_batches().expect("trash batches")[0].items[0].clone();
    let cancel = Arc::new(AtomicBool::new(true));

    let result = restore_cleanup_trash_items_for_db_with_cancel_for_test(
        vec![item.id.clone()],
        &db,
        Arc::clone(&cancel),
    )
    .expect("canceled restore");

    assert_eq!(result.restored, 0);
    assert_eq!(result.canceled, 1);
    assert_eq!(result.logs[0].status, "canceled");
    assert!(!safe_path.exists());
    assert!(Path::new(&item.trash_path).exists());
    assert!(cancel.load(Ordering::Relaxed));
}

#[test]
fn cleanup_restore_jobs_release_running_state_on_all_terminal_paths() {
    let state = CleanupRestoreState::default();
    state
        .start_job_for_test("running")
        .expect("start running job");
    assert_eq!(
        state.status_for_test("running"),
        Some(CleanupRestoreJobStatus::Running)
    );
    assert!(state.start_job_for_test("second").is_err());
    assert!(state.cancel_job_for_test("running").is_ok());
    assert!(state.cancel_job_for_test("running").is_ok());
    state
        .finish_job_for_test("running", CleanupRestoreJobStatus::Canceled)
        .expect("finish canceled job");
    assert_eq!(
        state.status_for_test("running"),
        Some(CleanupRestoreJobStatus::Canceled)
    );
    assert!(state.cancel_job_for_test("running").is_ok());
    assert!(state.cancel_job_for_test("forged-storage-job").is_err());

    run_cleanup_restore_job_for_test(&state, "completed", CleanupRestoreTestOutcome::Completed)
        .expect("completed job");
    run_cleanup_restore_job_for_test(&state, "failed", CleanupRestoreTestOutcome::Failed)
        .expect("failed job");
    assert_eq!(
        state.status_for_test("failed"),
        Some(CleanupRestoreJobStatus::Failed)
    );
    assert!(
        run_cleanup_restore_job_for_test(&state, "panic", CleanupRestoreTestOutcome::Panic)
            .is_err()
    );
    assert_eq!(
        state.status_for_test("panic"),
        Some(CleanupRestoreJobStatus::Failed)
    );

    for index in 0..10 {
        let id = format!("retained-{index}");
        run_cleanup_restore_job_for_test(&state, &id, CleanupRestoreTestOutcome::Completed)
            .expect("retained job");
    }
    assert!(state.status_for_test("retained-0").is_none());
    assert_eq!(
        state.status_for_test("retained-9"),
        Some(CleanupRestoreJobStatus::Completed)
    );
}

#[test]
fn cleanup_restore_cancellation_requires_the_main_window_label() {
    assert!(is_main_window_label_for_test("main"));
    assert!(!is_main_window_label_for_test("secondary"));
}

fn test_dir() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("zen-canvas-storage-analyzer-test-{nonce}"));
    fs::create_dir_all(&dir).expect("test dir");
    dir
}

fn test_db_path() -> PathBuf {
    test_dir().join("zen-canvas-storage-cleanup.sqlite3")
}

fn write_file(path: &Path, size: usize) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("parent dir");
    }
    fs::write(path, vec![b'x'; size]).expect("write file");
}
