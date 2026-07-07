use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use zen_canvas_tauri::storage_analyzer::{
    analyze_storage_roots_for_test, classify_candidate_for_test,
    cleanup_preview_items_for_candidates, is_forbidden_storage_path_for_test, CleanupActionKind,
    CleanupTier, StorageCandidate,
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
    assert!(analysis.reclaimable_estimate >= candidate.size);
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
    assert_eq!(cargo_candidate.tier, CleanupTier::Safe);
    assert!(cargo_candidate.trash_allowed);
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
    };

    let preview = cleanup_preview_items_for_candidates(vec![forged.id.clone()], &[forged])
        .expect("preview items");

    assert!(preview.is_empty());
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
