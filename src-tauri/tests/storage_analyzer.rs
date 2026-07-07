use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use zen_canvas_tauri::storage_analyzer::{
    analyze_storage_roots_for_test, classify_candidate_for_test,
    cleanup_preview_items_for_candidates, default_scan_roots_for_test,
    is_forbidden_storage_path_for_test, preview_cleanup_operations_for_candidates,
    CleanupActionKind, CleanupTier, StorageCandidate,
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
    assert!(!roots.iter().any(|path| path.ends_with("/appdata/local")));
    assert!(!roots.iter().any(|path| path.ends_with("/appdata/roaming")));
    assert!(!roots.iter().any(|path| path.ends_with("/program files")));
    assert!(!roots
        .iter()
        .any(|path| path.ends_with("/program files (x86)")));
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

fn test_dir() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("zen-canvas-storage-analyzer-test-{nonce}"));
    fs::create_dir_all(&dir).expect("test dir");
    dir
}

fn write_file(path: &Path, size: usize) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("parent dir");
    }
    fs::write(path, vec![b'x'; size]).expect("write file");
}
