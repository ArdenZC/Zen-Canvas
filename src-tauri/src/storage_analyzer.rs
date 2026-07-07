use serde::Serialize;
use std::{
    collections::{hash_map::DefaultHasher, HashMap, HashSet},
    env, fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, Runtime, State};

const LARGE_FILE_THRESHOLD: u64 = 100 * 1024 * 1024;
const LARGE_DIR_THRESHOLD: u64 = 500 * 1024 * 1024;
const MAX_CANDIDATES: usize = 120;

#[derive(Debug, Clone, Serialize)]
pub struct StorageAnalysis {
    pub total_size: u64,
    pub reclaimable_estimate: u64,
    pub review_estimate: u64,
    pub candidates: Vec<StorageCandidate>,
    pub denied_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageCandidate {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub tier: CleanupTier,
    pub category: String,
    pub reason: String,
    pub suggested_action: CleanupActionKind,
    pub risk_note: Option<String>,
    pub trash_allowed: bool,
    pub selected_by_default: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum CleanupTier {
    Safe,
    Review,
    Caution,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum CleanupActionKind {
    MoveToTrash,
    Reveal,
    UninstallAdvice,
    AppInternalCleanup,
    None,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupPreviewItem {
    pub id: String,
    pub candidate_id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub tier: CleanupTier,
    pub category: String,
    pub reason: String,
    pub operation_type: String,
    pub target_path: String,
    pub status: String,
    pub requires_confirmation: bool,
    pub is_executable: bool,
    pub blocking_reason: Option<String>,
}

#[derive(Default)]
pub struct StorageCleanupState {
    latest_candidates: Mutex<HashMap<String, StorageCandidate>>,
}

impl StorageCleanupState {
    fn replace_candidates(&self, candidates: &[StorageCandidate]) -> Result<(), String> {
        let mut cache = self
            .latest_candidates
            .lock()
            .map_err(|_| "Storage cleanup cache is unavailable.".to_string())?;
        cache.clear();
        cache.extend(
            candidates
                .iter()
                .cloned()
                .map(|candidate| (candidate.id.clone(), candidate)),
        );
        Ok(())
    }

    fn candidates_by_id(&self, ids: &[String]) -> Result<Vec<StorageCandidate>, String> {
        let cache = self
            .latest_candidates
            .lock()
            .map_err(|_| "Storage cleanup cache is unavailable.".to_string())?;
        Ok(ids.iter().filter_map(|id| cache.get(id).cloned()).collect())
    }
}

#[tauri::command]
pub async fn scan_storage_cleanup<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, StorageCleanupState>,
) -> Result<StorageAnalysis, String> {
    let app_data_dir = app.path().app_data_dir().ok();
    let analysis = tauri::async_runtime::spawn_blocking(move || {
        analyze_storage_roots(default_scan_roots(), app_data_dir.into_iter().collect())
    })
    .await
    .map_err(|error| format!("storage cleanup scan task failed: {error}"))??;

    state.replace_candidates(&analysis.candidates)?;
    Ok(analysis)
}

#[tauri::command]
pub fn reveal_storage_candidate(path: String) -> Result<(), String> {
    crate::file_ops::reveal_in_folder(path)
}

#[tauri::command]
pub fn preview_cleanup_candidates(
    ids: Vec<String>,
    state: State<'_, StorageCleanupState>,
) -> Result<Vec<CleanupPreviewItem>, String> {
    let candidates = state.candidates_by_id(&ids)?;
    cleanup_preview_items_for_candidates(ids, &candidates)
}

pub fn analyze_storage_roots_for_test(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
) -> Result<StorageAnalysis, String> {
    analyze_storage_roots(roots, excluded_paths)
}

pub fn classify_candidate_for_test(path: &Path, size: u64) -> StorageCandidate {
    classify_candidate(path, size)
}

pub fn default_scan_roots_for_test() -> Vec<PathBuf> {
    default_scan_roots()
}

pub fn is_forbidden_storage_path_for_test(path: &Path) -> bool {
    is_forbidden_storage_path(path, &[])
}

pub fn cleanup_preview_items_for_candidates(
    ids: Vec<String>,
    candidates: &[StorageCandidate],
) -> Result<Vec<CleanupPreviewItem>, String> {
    let requested: HashSet<&str> = ids.iter().map(String::as_str).collect();
    Ok(candidates
        .iter()
        .filter(|candidate| requested.contains(candidate.id.as_str()))
        .filter(|candidate| {
            candidate.tier == CleanupTier::Safe
                && candidate.trash_allowed
                && candidate.suggested_action == CleanupActionKind::MoveToTrash
                && !is_forbidden_storage_path(Path::new(&candidate.path), &[])
        })
        .map(cleanup_preview_item)
        .collect())
}

fn analyze_storage_roots(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
) -> Result<StorageAnalysis, String> {
    let mut context = ScanContext {
        excluded_paths,
        candidates: Vec::new(),
        denied_paths: Vec::new(),
    };
    let mut total_size = 0_u64;

    for root in roots {
        if root.as_os_str().is_empty() {
            continue;
        }
        if is_forbidden_storage_path(&root, &context.excluded_paths) {
            context.denied_paths.push(normalize_path(&root));
            continue;
        }
        if !root.exists() {
            continue;
        }
        total_size = total_size.saturating_add(scan_path_size(&root, &mut context));
    }

    context.candidates.sort_by(|left, right| {
        right
            .size
            .cmp(&left.size)
            .then_with(|| left.path.cmp(&right.path))
    });
    dedupe_candidates(&mut context.candidates);
    context.candidates.truncate(MAX_CANDIDATES);

    let reclaimable_estimate = context
        .candidates
        .iter()
        .filter(|candidate| candidate.tier == CleanupTier::Safe && candidate.trash_allowed)
        .map(|candidate| candidate.size)
        .sum();
    let review_estimate = context
        .candidates
        .iter()
        .filter(|candidate| candidate.tier == CleanupTier::Review)
        .map(|candidate| candidate.size)
        .sum();

    Ok(StorageAnalysis {
        total_size,
        reclaimable_estimate,
        review_estimate,
        candidates: context.candidates,
        denied_paths: context.denied_paths,
    })
}

struct ScanContext {
    excluded_paths: Vec<PathBuf>,
    candidates: Vec<StorageCandidate>,
    denied_paths: Vec<String>,
}

fn scan_path_size(path: &Path, context: &mut ScanContext) -> u64 {
    if is_forbidden_storage_path(path, &context.excluded_paths) {
        context.denied_paths.push(normalize_path(path));
        return 0;
    }

    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => {
            context.denied_paths.push(normalize_path(path));
            return 0;
        }
    };

    if metadata.file_type().is_symlink() {
        context.denied_paths.push(normalize_path(path));
        return 0;
    }

    if metadata.is_file() {
        let size = metadata.len();
        maybe_record_candidate(path, size, false, context);
        return size;
    }

    if !metadata.is_dir() {
        return 0;
    }

    let mut size = 0_u64;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => {
            context.denied_paths.push(normalize_path(path));
            return 0;
        }
    };

    for entry in entries.flatten() {
        size = size.saturating_add(scan_path_size(&entry.path(), context));
    }

    maybe_record_candidate(path, size, true, context);
    size
}

fn maybe_record_candidate(path: &Path, size: u64, is_dir: bool, context: &mut ScanContext) {
    if size == 0 {
        return;
    }

    let candidate = classify_candidate(path, size);
    let is_large = if is_dir {
        size >= LARGE_DIR_THRESHOLD
    } else {
        size >= LARGE_FILE_THRESHOLD
    };
    let known_candidate = candidate.tier != CleanupTier::Review || candidate.trash_allowed;
    let review_candidate = candidate.tier == CleanupTier::Review && is_large;

    if known_candidate || review_candidate || is_generated_dir_name(path) {
        context.candidates.push(candidate);
    }
}

fn classify_candidate(path: &Path, size: u64) -> StorageCandidate {
    let normalized = normalize_path(path);
    let lower = normalized.to_ascii_lowercase();
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(normalized.as_str())
        .to_string();
    let lower_name = name.to_ascii_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let (tier, category, reason, suggested_action, risk_note) = if is_system_path_text(&lower)
        || lower.contains("/programdata")
    {
        (
            CleanupTier::Caution,
            "System".to_string(),
            "System-managed location. Manual cleanup can break Windows or shared app state."
                .to_string(),
            CleanupActionKind::None,
            Some("No cleanup action is offered for system paths.".to_string()),
        )
    } else if is_program_files_path_text(&lower) {
        (
                CleanupTier::Caution,
                "Application".to_string(),
                "Installed application body. Use the app uninstaller or Windows Apps settings instead of deleting files directly.".to_string(),
                CleanupActionKind::UninstallAdvice,
                Some("Manual deletion can leave services, registry entries, and shared components behind.".to_string()),
            )
    } else if is_virtual_machine_image(&extension) {
        (
            CleanupTier::Caution,
            "Virtual machine image".to_string(),
            "Virtual machine images can contain full working systems or user data.".to_string(),
            CleanupActionKind::Reveal,
            Some("Confirm in the virtualization app before moving or deleting.".to_string()),
        )
    } else if is_chat_database_path(&lower, &extension) || is_database_extension(&extension) {
        (
                CleanupTier::Caution,
                "Application database".to_string(),
                "Database-like application data should not be moved while the owning app may be using it.".to_string(),
                CleanupActionKind::Reveal,
                Some("Use the app's own cleanup/export tools before touching database files.".to_string()),
            )
    } else if is_browser_profile_path(&lower) {
        (
            CleanupTier::Caution,
            "Browser profile".to_string(),
            "Browser profiles can contain sessions, passwords, cookies, and extension state."
                .to_string(),
            CleanupActionKind::AppInternalCleanup,
            Some("Use browser settings for cache, profile, or account cleanup.".to_string()),
        )
    } else if lower_name == "node_modules" {
        (
            CleanupTier::Safe,
            "Regenerable dependency folder".to_string(),
            "node_modules dependencies can usually be recreated by the package manager.".to_string(),
            CleanupActionKind::MoveToTrash,
            Some(
                "Review project context first: dependency folders can contain linked packages or local patches."
                    .to_string(),
            ),
        )
    } else if is_temp_path(&lower) {
        (
            CleanupTier::Safe,
            "Temporary files".to_string(),
            "Temporary directory content is normally regenerated by applications.".to_string(),
            CleanupActionKind::MoveToTrash,
            None,
        )
    } else if is_generated_dir_name(path) {
        (
            CleanupTier::Safe,
            "Regenerable development output".to_string(),
            "Build output can usually be recreated by the build tool.".to_string(),
            CleanupActionKind::MoveToTrash,
            Some(
                "Confirm this is generated output before adding it to the cleanup list."
                    .to_string(),
            ),
        )
    } else if is_package_cache_path(&lower, &lower_name) {
        (
            CleanupTier::Safe,
            "Developer cache".to_string(),
            "Package-manager cache is explicitly regenerable.".to_string(),
            CleanupActionKind::MoveToTrash,
            None,
        )
    } else if is_installer_residue(&lower, &extension) {
        (
            CleanupTier::Safe,
            "Installer residue".to_string(),
            "Installer packages can usually be downloaded again if needed.".to_string(),
            CleanupActionKind::MoveToTrash,
            None,
        )
    } else if is_appdata_path(&lower) {
        (
            CleanupTier::Caution,
            "Application data".to_string(),
            "AppData can contain account state, local databases, and app configuration."
                .to_string(),
            CleanupActionKind::Reveal,
            Some("Prefer app-provided cleanup controls for this location.".to_string()),
        )
    } else if is_downloads_path(&lower)
        || is_chat_file_path(&lower)
        || is_review_extension(&extension)
        || size >= LARGE_DIR_THRESHOLD
        || size >= LARGE_FILE_THRESHOLD
    {
        (
            CleanupTier::Review,
            review_category(&lower, &extension),
            "User-owned or unknown large content needs human review before cleanup.".to_string(),
            CleanupActionKind::Reveal,
            Some(
                "Open the location and select explicit items only after reviewing them."
                    .to_string(),
            ),
        )
    } else {
        (
            CleanupTier::Review,
            "Other".to_string(),
            "Unknown storage item.".to_string(),
            CleanupActionKind::Reveal,
            Some("No cleanup action is selected by default.".to_string()),
        )
    };

    let trash_allowed = tier == CleanupTier::Safe
        && suggested_action == CleanupActionKind::MoveToTrash
        && !is_forbidden_storage_path(path, &[]);
    let selected_by_default = trash_allowed
        && (is_temp_path(&lower)
            || is_package_cache_path(&lower, &lower_name)
            || lower_name == "node_modules");

    StorageCandidate {
        id: candidate_id(&normalized),
        path: normalized,
        name,
        size,
        tier,
        category,
        reason,
        suggested_action,
        risk_note,
        trash_allowed,
        selected_by_default,
    }
}

fn cleanup_preview_item(candidate: &StorageCandidate) -> CleanupPreviewItem {
    CleanupPreviewItem {
        id: format!("cleanup-preview-{}", candidate.id),
        candidate_id: candidate.id.clone(),
        path: candidate.path.clone(),
        name: candidate.name.clone(),
        size: candidate.size,
        tier: candidate.tier.clone(),
        category: candidate.category.clone(),
        reason: candidate.reason.clone(),
        operation_type: "move_to_trash_preview".to_string(),
        target_path: "Recycle Bin".to_string(),
        status: "pending".to_string(),
        requires_confirmation: true,
        is_executable: false,
        blocking_reason: Some(
            "Preview only: Zen Canvas has not enabled direct recycle-bin execution for storage cleanup."
                .to_string(),
        ),
    }
}

fn default_scan_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    push_if_some(&mut roots, dirs::download_dir());
    push_if_some(&mut roots, dirs::desktop_dir());
    push_if_some(&mut roots, dirs::document_dir());
    add_standard_user_roots(&mut roots);
    roots.push(env::temp_dir());
    add_home_dev_cache_roots(&mut roots);
    dedupe_paths(&mut roots);
    roots
}

fn add_standard_user_roots(roots: &mut Vec<PathBuf>) {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    for relative in ["Downloads", "Desktop", "Documents"] {
        roots.push(home.join(relative));
    }
}

fn add_home_dev_cache_roots(roots: &mut Vec<PathBuf>) {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    for relative in [
        ".npm",
        ".pnpm-store",
        ".cargo",
        ".gradle",
        ".m2",
        "AppData/Local/npm-cache",
        "AppData/Local/pnpm-store",
        "AppData/Local/Cargo",
        "AppData/Local/Temp",
    ] {
        roots.push(home.join(relative));
    }
}

fn push_if_some(roots: &mut Vec<PathBuf>, path: Option<PathBuf>) {
    if let Some(path) = path {
        roots.push(path);
    }
}

fn is_forbidden_storage_path(path: &Path, excluded_paths: &[PathBuf]) -> bool {
    let lower = normalize_for_compare(path);
    excluded_paths
        .iter()
        .any(|excluded| is_same_or_child(&lower, &normalize_for_compare(excluded)))
        || is_system_path_text(&lower)
        || lower.contains("/programdata")
        || lower.contains("/startlan/zen canvas")
        || lower.ends_with("/zen-canvas.sqlite3")
        || lower.ends_with("/zen-canvas.sqlite")
        || lower.ends_with("/zen-canvas.db")
}

fn is_system_path_text(lower: &str) -> bool {
    lower.starts_with("c:/windows")
        || lower.contains("/windows/system32")
        || lower.contains("/windows/winsxs")
        || lower.contains("/system volume information")
        || lower.contains("/$recycle.bin")
}

fn is_program_files_path_text(lower: &str) -> bool {
    lower.starts_with("c:/program files/")
        || lower.starts_with("c:/program files (x86)/")
        || lower.contains("/program files/")
        || lower.contains("/program files (x86)/")
}

fn is_appdata_path(lower: &str) -> bool {
    lower.contains("/appdata/local/") || lower.contains("/appdata/roaming/")
}

fn is_temp_path(lower: &str) -> bool {
    lower.contains("/appdata/local/temp/") || lower.ends_with("/appdata/local/temp")
}

fn is_generated_dir_name(path: &Path) -> bool {
    let lower_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(
        lower_name.as_str(),
        "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt" | ".turbo"
    )
}

fn is_package_cache_path(lower: &str, lower_name: &str) -> bool {
    matches!(
        lower_name,
        ".npm" | ".pnpm-store" | ".cargo" | ".gradle" | ".m2" | "npm-cache" | "pnpm-store"
    ) || lower.contains("/.cargo/registry/")
        || lower.contains("/.gradle/caches/")
        || lower.contains("/.m2/repository/")
}

fn is_installer_residue(lower: &str, extension: &str) -> bool {
    is_downloads_path(lower) && matches!(extension, "msi" | "dmg" | "pkg")
}

fn is_downloads_path(lower: &str) -> bool {
    lower.contains("/downloads/")
}

fn is_chat_file_path(lower: &str) -> bool {
    (lower.contains("/wechat files/")
        || lower.contains("/tencent/files/")
        || lower.contains("/qq/"))
        && !is_chat_database_text(lower)
}

fn is_chat_database_path(lower: &str, extension: &str) -> bool {
    is_chat_database_text(lower)
        || ((lower.contains("wechat") || lower.contains("/qq/"))
            && is_database_extension(extension))
}

fn is_chat_database_text(lower: &str) -> bool {
    (lower.contains("wechat") || lower.contains("/qq/") || lower.contains("tencent"))
        && (lower.ends_with(".db") || lower.ends_with(".sqlite") || lower.ends_with(".sqlite3"))
}

fn is_browser_profile_path(lower: &str) -> bool {
    (lower.contains("/google/chrome/user data")
        || lower.contains("/microsoft/edge/user data")
        || lower.contains("/mozilla/firefox/profiles"))
        && !lower.contains("/cache/")
}

fn is_database_extension(extension: &str) -> bool {
    matches!(extension, "db" | "sqlite" | "sqlite3" | "mdb" | "accdb")
}

fn is_virtual_machine_image(extension: &str) -> bool {
    matches!(
        extension,
        "vmdk" | "vhd" | "vhdx" | "qcow2" | "ova" | "avhdx"
    )
}

fn is_review_extension(extension: &str) -> bool {
    matches!(
        extension,
        "zip"
            | "rar"
            | "7z"
            | "tar"
            | "gz"
            | "mp4"
            | "mov"
            | "mkv"
            | "avi"
            | "pdf"
            | "doc"
            | "docx"
            | "ppt"
            | "pptx"
            | "xls"
            | "xlsx"
    )
}

fn review_category(lower: &str, extension: &str) -> String {
    if is_downloads_path(lower) {
        "Downloads".to_string()
    } else if is_chat_file_path(lower) {
        "Chat files".to_string()
    } else if matches!(extension, "zip" | "rar" | "7z" | "tar" | "gz") {
        "Archive".to_string()
    } else if matches!(extension, "mp4" | "mov" | "mkv" | "avi") {
        "Video".to_string()
    } else if matches!(
        extension,
        "pdf" | "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx"
    ) {
        "Documents".to_string()
    } else {
        "Large unknown directory".to_string()
    }
}

fn dedupe_candidates(candidates: &mut Vec<StorageCandidate>) {
    let mut seen = HashSet::new();
    candidates.retain(|candidate| seen.insert(normalize_compare_text(&candidate.path)));
}

fn dedupe_paths(paths: &mut Vec<PathBuf>) {
    let mut seen = HashSet::new();
    paths.retain(|path| seen.insert(normalize_for_compare(path)));
}

fn is_same_or_child(path: &str, parent: &str) -> bool {
    path == parent || path.starts_with(&format!("{parent}/"))
}

fn candidate_id(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    normalize_compare_text(path).hash(&mut hasher);
    format!("storage-{:016x}", hasher.finish())
}

fn normalize_for_compare(path: &Path) -> String {
    normalize_compare_text(&normalize_path(path))
}

fn normalize_compare_text(value: &str) -> String {
    let value = value
        .strip_prefix("//?/")
        .unwrap_or(value)
        .trim_end_matches('/')
        .replace('\\', "/");
    if cfg!(windows) || value.get(1..3) == Some(":/") {
        value.to_ascii_lowercase()
    } else {
        value
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
