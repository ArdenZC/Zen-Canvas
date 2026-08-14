//! Safe Quick Look thumbnail adapter.
//!
//! The current objc2 bundle does not ship generated QuickLookThumbnailing
//! bindings. Until that bridge is available, /usr/bin/qlmanage is kept
//! behind this one adapter. It is used only after the same byte-read and
//! package gates as Content/Dedupe/Analysis, writes into a bounded cache, and
//! can be cancelled before the helper completes. QLPreviewPanel remains
//! deliberately deferred because it needs a stable AppKit view lifetime.

use std::collections::HashMap;
#[cfg(target_os = "macos")]
use std::ffi::OsStr;
#[cfg(target_os = "macos")]
use std::ffi::{CString, OsString};
use std::fs;
#[cfg(target_os = "macos")]
use std::fs::File;
#[cfg(target_os = "macos")]
use std::io::{Read, Seek, SeekFrom, Write};
#[cfg(target_os = "macos")]
use std::os::unix::ffi::OsStrExt;
#[cfg(target_os = "macos")]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};
#[cfg(target_os = "macos")]
use std::time::Duration;

#[cfg(target_os = "macos")]
const QLMANAGE_PATH: &str = "/usr/bin/qlmanage";
const DEFAULT_MAX_ENTRIES: usize = 128;
const DEFAULT_MAX_BYTES: u64 = 64 * 1024 * 1024;
#[cfg(target_os = "macos")]
const MAX_THUMBNAIL_SIZE: u32 = 2048;
#[cfg(target_os = "macos")]
const HELPER_TIMEOUT: Duration = Duration::from_secs(8);
#[cfg(target_os = "macos")]
const QUICK_LOOK_STAGE_HEADROOM_BYTES: u64 = 64 * 1024 * 1024;
#[cfg(target_os = "macos")]
const STALE_PENDING_AGE: Duration = Duration::from_secs(10 * 60);
#[cfg(target_os = "macos")]
const MAX_STALE_PENDING_ENTRIES: usize = 128;

pub const MAX_QUICK_LOOK_STAGE_BYTES: u64 = 256 * 1024 * 1024;
pub const QUICK_LOOK_SOURCE_TOO_LARGE: &str = "macos_quick_look_source_too_large";
pub const QUICK_LOOK_INSUFFICIENT_SPACE: &str = "macos_quick_look_insufficient_space";
pub const QUICK_LOOK_THUMBNAIL_CANCELLED: &str = "macos_quick_look_thumbnail_cancelled";
pub const QUICK_LOOK_THUMBNAIL_TIMEOUT: &str = "macos_quick_look_thumbnail_timeout";
pub const QUICK_LOOK_SOURCE_IDENTITY_CHANGED: &str = "macos_quick_look_source_identity_changed";
pub const QUICK_LOOK_PENDING_CLEANUP_FAILED: &str = "macos_quick_look_pending_cleanup_failed";

pub const PREVIEW_AVAILABLE: bool = false;

#[cfg(target_os = "macos")]
struct PreviewSourceSnapshot {
    handle: File,
    name: OsString,
    identity: crate::fs_safety::ExpectedFileIdentity,
}

#[cfg(target_os = "macos")]
struct PendingQuickLookGuard {
    path: PathBuf,
    armed: bool,
}

#[cfg(target_os = "macos")]
impl PendingQuickLookGuard {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

#[cfg(target_os = "macos")]
impl Drop for PendingQuickLookGuard {
    fn drop(&mut self) {
        if !self.armed {
            return;
        }
        if let Err(error) = fs::remove_dir_all(&self.path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                eprintln!("{QUICK_LOOK_PENDING_CLEANUP_FAILED}:{error}");
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn open_preview_source(path: &Path) -> Result<PreviewSourceSnapshot, String> {
    let name = path
        .file_name()
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "macos_quick_look_source_name_missing".to_string())?
        .to_os_string();
    let handle = crate::platform::macos::file_semantics::open_content_read(path)
        .map_err(|reason| format!("macos_quick_look_content_blocked:{reason}"))?;
    let identity = crate::fs_safety::capture_identity_from_handle(&handle, path, None)
        .map_err(|error| format!("macos_quick_look_source_identity_failed:{error}"))?;
    ensure_preview_path_binding(&handle, path)?;
    Ok(PreviewSourceSnapshot {
        handle,
        name,
        identity,
    })
}

#[cfg(target_os = "macos")]
fn ensure_preview_path_binding(handle: &File, path: &Path) -> Result<(), String> {
    use std::os::unix::fs::MetadataExt;

    let path_metadata = fs::symlink_metadata(path)
        .map_err(|_| QUICK_LOOK_SOURCE_IDENTITY_CHANGED.to_string())?;
    let handle_metadata = handle
        .metadata()
        .map_err(|_| QUICK_LOOK_SOURCE_IDENTITY_CHANGED.to_string())?;
    if path_metadata.file_type().is_symlink()
        || !path_metadata.is_file()
        || !handle_metadata.is_file()
        || path_metadata.dev() != handle_metadata.dev()
        || path_metadata.ino() != handle_metadata.ino()
        || path_metadata.len() != handle_metadata.len()
    {
        return Err(QUICK_LOOK_SOURCE_IDENTITY_CHANGED.to_string());
    }
    Ok(())
}

pub fn thumbnail_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        Path::new(QLMANAGE_PATH).is_file()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[derive(Clone)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct MacThumbnailService {
    cache_dir: Arc<PathBuf>,
    max_entries: usize,
    max_bytes: u64,
    active: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl MacThumbnailService {
    pub fn new(cache_dir: PathBuf) -> Self {
        let service = Self {
            cache_dir: Arc::new(cache_dir),
            max_entries: DEFAULT_MAX_ENTRIES,
            max_bytes: DEFAULT_MAX_BYTES,
            active: Arc::new(Mutex::new(HashMap::new())),
        };
        initialize_cache_namespace(&service.cache_dir);
        service
    }

    pub fn with_limits(cache_dir: PathBuf, max_entries: usize, max_bytes: u64) -> Self {
        let service = Self {
            cache_dir: Arc::new(cache_dir),
            max_entries: max_entries.max(1),
            max_bytes: max_bytes.max(1),
            active: Arc::new(Mutex::new(HashMap::new())),
        };
        initialize_cache_namespace(&service.cache_dir);
        service
    }

    pub fn request(&self, path: &Path, size: u32) -> Result<MacThumbnailJob, String> {
        if !thumbnail_available() {
            return Err("macos_quick_look_thumbnail_unavailable".to_string());
        }
        if !path.is_absolute() {
            return Err("macos_quick_look_path_must_be_absolute".to_string());
        }

        #[cfg(not(target_os = "macos"))]
        let _ = size;

        #[cfg(not(target_os = "macos"))]
        return Err("macos_quick_look_thumbnail_unavailable".to_string());

        #[cfg(target_os = "macos")]
        {
            let snapshot = open_preview_source(path)?;
            let size = size.clamp(1, MAX_THUMBNAIL_SIZE);
            ensure_cache_dir(&self.cache_dir)?;
            let key = cache_key(path, size, &snapshot.identity);
            let cache_path = self.cache_dir.join(format!("{key}.png"));
            reject_cache_symlink(&cache_path)?;
            if is_usable_cache_file(&cache_path, self.max_bytes) {
                return Ok(MacThumbnailJob::ready(cache_path));
            }
            ensure_staging_space(&self.cache_dir, snapshot.identity.size)?;

            let cancel = Arc::new(AtomicBool::new(false));
            if let Ok(mut active) = self.active.lock() {
                if active.contains_key(&key) {
                    return Err("macos_quick_look_thumbnail_already_requested".to_string());
                }
                active.insert(key.clone(), Arc::clone(&cancel));
            }

            let cache_dir = Arc::clone(&self.cache_dir);
            let active = Arc::clone(&self.active);
            let max_entries = self.max_entries;
            let max_bytes = self.max_bytes;
            let source_path = path.to_path_buf();
            let source_handle = snapshot.handle;
            let source_name = snapshot.name;
            let source_identity = snapshot.identity;
            let pending_dir = cache_dir.join(format!(".pending-{key}-{}", uuid::Uuid::new_v4()));
            let worker_cancel = Arc::clone(&cancel);
            let worker_key = key.clone();
            let worker = thread::Builder::new()
                .name("zen-canvas-macos-quick-look".to_string())
                .spawn(move || {
                    let result = generate_thumbnail(
                        &source_handle,
                        &source_path,
                        &source_name,
                        &source_identity,
                        &pending_dir,
                        &cache_dir,
                        &worker_key,
                        size,
                        &worker_cancel,
                        max_entries,
                        max_bytes,
                        Path::new(QLMANAGE_PATH),
                        HELPER_TIMEOUT,
                    );
                    if let Ok(mut active) = active.lock() {
                        active.remove(&worker_key);
                    }
                    result
                })
                .map_err(|error| format!("macos_quick_look_thread_start_failed: {error}"));

            match worker {
                Ok(worker) => Ok(MacThumbnailJob {
                    cancel,
                    result: Some(worker),
                }),
                Err(error) => {
                    if let Ok(mut active) = self.active.lock() {
                        active.remove(&key);
                    }
                    Err(error)
                }
            }
        }
    }
}

pub struct MacThumbnailJob {
    cancel: Arc<AtomicBool>,
    result: Option<JoinHandle<Result<PathBuf, String>>>,
}

impl MacThumbnailJob {
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    fn ready(path: PathBuf) -> Self {
        let result = thread::spawn(move || Ok(path));
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            result: Some(result),
        }
    }

    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Release);
    }

    pub fn join(mut self) -> Result<PathBuf, String> {
        self.result
            .take()
            .ok_or_else(|| "macos_quick_look_thumbnail_missing_result".to_string())?
            .join()
            .map_err(|_| "macos_quick_look_thumbnail_worker_panicked".to_string())?
    }
}

impl Drop for MacThumbnailJob {
    fn drop(&mut self) {
        self.cancel();
    }
}

fn initialize_cache_namespace(cache_dir: &Path) {
    #[cfg(target_os = "macos")]
    {
        if let Err(error) = ensure_cache_dir(cache_dir) {
            eprintln!("macos_quick_look_cache_namespace_init_failed:{error}");
            return;
        }
        cleanup_stale_pending(cache_dir);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = cache_dir;
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn ensure_cache_dir(cache_dir: &Path) -> Result<(), String> {
    if let Ok(metadata) = fs::symlink_metadata(cache_dir) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("macos_quick_look_cache_directory_not_safe".to_string());
        }
        #[cfg(target_os = "macos")]
        set_private_directory(cache_dir)?;
        return Ok(());
    }
    fs::create_dir_all(cache_dir)
        .map_err(|error| format!("macos_quick_look_cache_create_failed:{error}"))?;
    let metadata = fs::symlink_metadata(cache_dir)
        .map_err(|error| format!("macos_quick_look_cache_stat_failed:{error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("macos_quick_look_cache_directory_not_safe".to_string());
    }
    #[cfg(target_os = "macos")]
    set_private_directory(cache_dir)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_private_directory(path: &Path) -> Result<(), String> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("macos_quick_look_cache_permissions_failed:{error}"))
}

#[cfg(target_os = "macos")]
fn set_private_file(path: &Path) -> Result<(), String> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|error| format!("macos_quick_look_cache_file_permissions_failed:{error}"))
}

#[cfg(target_os = "macos")]
fn cleanup_stale_pending(cache_dir: &Path) {
    cleanup_stale_pending_at(cache_dir, std::time::SystemTime::now());
}

#[cfg(target_os = "macos")]
fn cleanup_stale_pending_at(cache_dir: &Path, now: std::time::SystemTime) {
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return;
    };
    let mut inspected = 0usize;
    for entry in entries.flatten() {
        if inspected >= MAX_STALE_PENDING_ENTRIES {
            break;
        }
        let path = entry.path();
        if path.parent() != Some(cache_dir)
            || !path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(".pending-"))
        {
            continue;
        }
        inspected += 1;
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        let old_enough = metadata
            .modified()
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age >= STALE_PENDING_AGE);
        if !old_enough {
            continue;
        }
        let result = if metadata.file_type().is_symlink() || metadata.is_file() {
            fs::remove_file(&path)
        } else if metadata.is_dir() {
            fs::remove_dir_all(&path)
        } else {
            Ok(())
        };
        if let Err(error) = result {
            eprintln!("{QUICK_LOOK_PENDING_CLEANUP_FAILED}:{error}");
        }
    }
}

#[cfg(target_os = "macos")]
fn ensure_pending_path(cache_dir: &Path, pending_dir: &Path) -> Result<(), String> {
    let is_direct_child = pending_dir.parent() == Some(cache_dir)
        && pending_dir
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(".pending-"));
    if !is_direct_child {
        return Err("macos_quick_look_pending_path_not_safe".to_string());
    }
    if let Ok(metadata) = fs::symlink_metadata(pending_dir) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("macos_quick_look_pending_path_not_safe".to_string());
        }
        return Err("macos_quick_look_pending_already_exists".to_string());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn validate_stage_budget(size: u64) -> Result<(), String> {
    if size > MAX_QUICK_LOOK_STAGE_BYTES {
        return Err(QUICK_LOOK_SOURCE_TOO_LARGE.to_string());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn ensure_staging_space(cache_dir: &Path, size: u64) -> Result<(), String> {
    validate_stage_budget(size)?;
    let required = size.saturating_add(QUICK_LOOK_STAGE_HEADROOM_BYTES);
    let path_bytes = CString::new(cache_dir.as_os_str().as_bytes())
        .map_err(|_| QUICK_LOOK_INSUFFICIENT_SPACE.to_string())?;
    let mut stats = unsafe { std::mem::zeroed::<libc::statvfs>() };
    let result = unsafe { libc::statvfs(path_bytes.as_ptr(), &mut stats) };
    if result != 0 {
        return Err(QUICK_LOOK_INSUFFICIENT_SPACE.to_string());
    }
    let available = (stats.f_bavail as u64).saturating_mul(stats.f_frsize as u64);
    if available < required {
        return Err(QUICK_LOOK_INSUFFICIENT_SPACE.to_string());
    }
    Ok(())
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn reject_cache_symlink(path: &Path) -> Result<(), String> {
    if fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("macos_quick_look_cache_entry_not_safe".to_string());
    }
    Ok(())
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn is_usable_cache_file(path: &Path, max_bytes: u64) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| {
            metadata.is_file()
                && !metadata.file_type().is_symlink()
                && metadata.len() <= max_bytes
                && is_private_cache_file(&metadata)
        })
        .unwrap_or(false)
}

fn is_private_cache_file(metadata: &fs::Metadata) -> bool {
    #[cfg(target_os = "macos")]
    {
        return metadata.permissions().mode() & 0o077 == 0;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = metadata;
        true
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn cache_key(path: &Path, size: u32, identity: &crate::fs_safety::ExpectedFileIdentity) -> String {
    let input = format!(
        "{}:{size}:{}:{}:{}:{}:{}:{}",
        path.to_string_lossy(),
        identity.platform_volume_id.as_deref().unwrap_or_default(),
        identity.platform_file_id.as_deref().unwrap_or_default(),
        identity.modified_ns.unwrap_or_default(),
        identity.size,
        identity.sample_hash.as_deref().unwrap_or_default(),
        identity.full_hash.as_deref().unwrap_or_default(),
    );
    blake3::hash(input.as_bytes()).to_hex().to_string()
}

#[cfg(target_os = "macos")]
#[expect(
    clippy::too_many_arguments,
    reason = "thumbnail helper keeps source identity, cache, cancellation, and bounds explicit"
)]
fn generate_thumbnail(
    source_handle: &File,
    source_path: &Path,
    source_name: &OsStr,
    expected_identity: &crate::fs_safety::ExpectedFileIdentity,
    pending_dir: &Path,
    cache_dir: &Path,
    key: &str,
    size: u32,
    cancel: &AtomicBool,
    max_entries: usize,
    max_bytes: u64,
    helper_path: &Path,
    helper_timeout: Duration,
) -> Result<PathBuf, String> {
    use std::process::{Command, Stdio};
    use std::time::Instant;

    let size_arg = size.to_string();
    ensure_staging_space(cache_dir, expected_identity.size)?;
    ensure_pending_path(cache_dir, pending_dir)?;
    let mut pending = PendingQuickLookGuard::new(pending_dir.to_path_buf());
    fs::create_dir(pending_dir)
        .map_err(|error| format!("macos_quick_look_pending_create_failed:{error}"))?;
    set_private_directory(pending_dir)?;
    let source_dir = pending_dir.join("source");
    let output_dir = pending_dir.join("output");
    fs::create_dir(&source_dir)
        .map_err(|error| format!("macos_quick_look_source_dir_failed:{error}"))?;
    set_private_directory(&source_dir)?;
    fs::create_dir(&output_dir)
        .map_err(|error| format!("macos_quick_look_output_dir_failed:{error}"))?;
    set_private_directory(&output_dir)?;
    let staged_source = source_dir.join(source_name);
    copy_preview_source(
        source_handle,
        source_path,
        &staged_source,
        expected_identity,
        cancel,
    )?;
    let mut child = Command::new(helper_path)
        .args(["-t", "-s"])
        .arg(size_arg)
        .arg("-o")
        .arg(&output_dir)
        .arg(&staged_source)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("macos_quick_look_helper_start_failed:{error}"))?;
    let started = Instant::now();
    let status = loop {
        if cancel.load(Ordering::Acquire) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(QUICK_LOOK_THUMBNAIL_CANCELLED.to_string());
        }
        if started.elapsed() >= helper_timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(QUICK_LOOK_THUMBNAIL_TIMEOUT.to_string());
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("macos_quick_look_helper_wait_failed:{error}"))?
        {
            break status;
        }
        thread::sleep(Duration::from_millis(25));
    };
    if !status.success() {
        return Err("macos_quick_look_thumbnail_failed".to_string());
    }

    let generated = fs::read_dir(&output_dir)
        .map_err(|error| format!("macos_quick_look_thumbnail_output_failed:{error}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            fs::symlink_metadata(path)
                .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
                .unwrap_or(false)
        })
        .ok_or_else(|| "macos_quick_look_thumbnail_output_missing".to_string())?;
    if fs::symlink_metadata(&generated)
        .map(|metadata| metadata.len() > max_bytes)
        .unwrap_or(true)
    {
        return Err("macos_quick_look_thumbnail_too_large".to_string());
    }
    let cache_path = cache_dir.join(format!("{key}.png"));
    reject_cache_symlink(&cache_path)?;
    if !is_usable_cache_file(&cache_path, max_bytes) {
        fs::rename(&generated, &cache_path)
            .map_err(|error| format!("macos_quick_look_thumbnail_cache_commit_failed:{error}"))?;
        set_private_file(&cache_path)?;
        pending.disarm();
    }
    trim_cache(cache_dir, max_entries, max_bytes, &cache_path);
    Ok(cache_path)
}

#[cfg(target_os = "macos")]
fn copy_preview_source(
    source_handle: &File,
    source_path: &Path,
    staged_source: &Path,
    expected_identity: &crate::fs_safety::ExpectedFileIdentity,
    cancel: &AtomicBool,
) -> Result<(), String> {
    validate_stage_budget(expected_identity.size)?;
    ensure_preview_path_binding(source_handle, source_path)?;
    let mut source = source_handle
        .try_clone()
        .map_err(|error| format!("macos_quick_look_source_clone_failed:{error}"))?;
    source
        .seek(SeekFrom::Start(0))
        .map_err(|error| format!("macos_quick_look_source_seek_failed:{error}"))?;
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut staged = options
        .open(staged_source)
        .map_err(|error| format!("macos_quick_look_source_stage_failed:{error}"))?;
    let mut buffer = [0_u8; 1024 * 1024];
    let mut bytes_written = 0_u64;
    loop {
        if cancel.load(Ordering::Acquire) {
            return Err(QUICK_LOOK_THUMBNAIL_CANCELLED.to_string());
        }
        let read = source
            .read(&mut buffer)
            .map_err(|error| format!("macos_quick_look_source_read_failed:{error}"))?;
        if read == 0 {
            break;
        }
        bytes_written = bytes_written.saturating_add(read as u64);
        if bytes_written > MAX_QUICK_LOOK_STAGE_BYTES {
            return Err(QUICK_LOOK_SOURCE_TOO_LARGE.to_string());
        }
        staged
            .write_all(&buffer[..read])
            .map_err(|error| format!("macos_quick_look_source_stage_write_failed:{error}"))?;
    }
    staged
        .sync_all()
        .map_err(|error| format!("macos_quick_look_source_stage_sync_failed:{error}"))?;
    drop(staged);

    let actual = crate::fs_safety::capture_identity_from_handle(source_handle, source_path, None)
        .map_err(|error| format!("macos_quick_look_source_identity_failed:{error}"))?;
    if !crate::fs_safety::identity_matches(expected_identity, &actual) {
        return Err(QUICK_LOOK_SOURCE_IDENTITY_CHANGED.to_string());
    }
    ensure_preview_path_binding(source_handle, source_path)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn trim_cache(cache_dir: &Path, max_entries: usize, max_bytes: u64, keep: &Path) {
    let mut entries = fs::read_dir(cache_dir)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path).ok()?;
            if !metadata.is_file() || metadata.file_type().is_symlink() || path == keep {
                return None;
            }
            Some((path, metadata.len(), metadata.modified().ok()))
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|(_, _, modified)| *modified);
    let mut total = fs::symlink_metadata(keep)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let mut count = 1usize;
    for (path, size, _) in entries {
        if count < max_entries && total.saturating_add(size) <= max_bytes {
            total = total.saturating_add(size);
            count += 1;
        } else {
            let _ = fs::remove_file(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::cache_key;
    #[cfg(not(target_os = "macos"))]
    use super::thumbnail_available;
    #[cfg(target_os = "macos")]
    use super::{
        cleanup_stale_pending_at, copy_preview_source, ensure_cache_dir,
        ensure_preview_path_binding, generate_thumbnail, is_usable_cache_file, set_private_file,
        PendingQuickLookGuard, MAX_QUICK_LOOK_STAGE_BYTES, QUICK_LOOK_SOURCE_TOO_LARGE,
        QUICK_LOOK_THUMBNAIL_CANCELLED, STALE_PENDING_AGE,
    };
    use crate::fs_safety::ExpectedFileIdentity;

    #[test]
    fn thumbnail_availability_is_false_outside_native_macos() {
        #[cfg(not(target_os = "macos"))]
        assert!(!thumbnail_available());
    }

    #[test]
    fn cache_key_is_stable_and_path_specific() {
        let identity_a = ExpectedFileIdentity {
            size: 1,
            modified_ns: Some(2),
            platform_volume_id: Some("volume".to_string()),
            platform_file_id: Some("file-a".to_string()),
            sample_hash: Some("sample-a".to_string()),
            full_hash: Some("full-a".to_string()),
        };
        let identity_b = ExpectedFileIdentity {
            platform_file_id: Some("file-b".to_string()),
            ..identity_a.clone()
        };
        assert_eq!(
            cache_key(std::path::Path::new("/tmp/a.txt"), 256, &identity_a),
            cache_key(std::path::Path::new("/tmp/a.txt"), 256, &identity_a)
        );
        assert_ne!(
            cache_key(std::path::Path::new("/tmp/a.txt"), 256, &identity_a),
            cache_key(std::path::Path::new("/tmp/b.txt"), 256, &identity_a)
        );
        assert_ne!(
            cache_key(std::path::Path::new("/tmp/a.txt"), 256, &identity_a),
            cache_key(std::path::Path::new("/tmp/a.txt"), 256, &identity_b)
        );
    }

    #[cfg(target_os = "macos")]
    fn test_identity(size: u64) -> ExpectedFileIdentity {
        ExpectedFileIdentity {
            size,
            modified_ns: None,
            platform_volume_id: None,
            platform_file_id: None,
            sample_hash: None,
            full_hash: None,
        }
    }

    #[cfg(target_os = "macos")]
    fn test_root(name: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "zen-canvas-quick-look-{name}-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).expect("test root");
        root
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn oversized_source_is_rejected_before_staging() {
        let root = test_root("budget");
        let source = root.join("source.txt");
        let staged = root.join("staged.txt");
        std::fs::write(&source, b"small").expect("source");
        let handle = std::fs::File::open(&source).expect("open source");
        let error = copy_preview_source(
            &handle,
            &source,
            &staged,
            &test_identity(MAX_QUICK_LOOK_STAGE_BYTES + 1),
            &std::sync::atomic::AtomicBool::new(false),
        )
        .expect_err("oversized source must fail closed");
        assert_eq!(error, QUICK_LOOK_SOURCE_TOO_LARGE);
        assert!(!staged.exists());
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn pending_guard_removes_private_staging_on_drop() {
        let root = test_root("guard");
        let pending = root.join(".pending-guard");
        std::fs::create_dir(&pending).expect("pending");
        std::fs::write(pending.join("source"), b"private").expect("staged source");
        {
            let _guard = PendingQuickLookGuard::new(pending.clone());
        }
        assert!(!pending.exists());
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn startup_cleanup_removes_only_old_pending_entries() {
        let root = test_root("stale");
        let stale = root.join(".pending-stale");
        let unrelated = root.join("not-pending");
        std::fs::create_dir(&stale).expect("stale");
        std::fs::create_dir(&unrelated).expect("unrelated");
        cleanup_stale_pending_at(
            &root,
            std::time::SystemTime::now() + STALE_PENDING_AGE + std::time::Duration::from_secs(1),
        );
        assert!(!stale.exists());
        assert!(unrelated.exists());
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn cache_namespace_and_entries_are_private() {
        let root = test_root("permissions");
        ensure_cache_dir(&root).expect("cache dir");
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(&root)
                .expect("cache metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        let entry = root.join("entry.png");
        std::fs::write(&entry, b"png").expect("cache entry");
        set_private_file(&entry).expect("cache permissions");
        assert_eq!(
            std::fs::metadata(&entry)
                .expect("entry metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert!(is_usable_cache_file(&entry, 16));
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn canceled_copy_cleans_pending_directory() {
        let root = test_root("cancel");
        let source = root.join("source.txt");
        let pending = root.join(".pending-cancel");
        std::fs::write(&source, b"small").expect("source");
        let handle = std::fs::File::open(&source).expect("open source");
        let identity = crate::fs_safety::capture_identity_from_handle(&handle, &source, None)
            .expect("identity");
        let cancel = std::sync::atomic::AtomicBool::new(true);
        let error = generate_thumbnail(
            &handle,
            &source,
            source.file_name().expect("source name"),
            &identity,
            &pending,
            &root,
            "cancel-key",
            256,
            &cancel,
            4,
            1024,
            std::path::Path::new("/definitely/missing/qlmanage"),
            std::time::Duration::from_secs(1),
        )
        .expect_err("cancelled copy");
        assert_eq!(error, QUICK_LOOK_THUMBNAIL_CANCELLED);
        assert!(!pending.exists());
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn helper_spawn_failure_cleans_pending_directory() {
        let root = test_root("helper-failure");
        let source = root.join("source.txt");
        let pending = root.join(".pending-helper-failure");
        std::fs::write(&source, b"small").expect("source");
        let handle = std::fs::File::open(&source).expect("open source");
        let identity = crate::fs_safety::capture_identity_from_handle(&handle, &source, None)
            .expect("identity");
        let error = generate_thumbnail(
            &handle,
            &source,
            source.file_name().expect("source name"),
            &identity,
            &pending,
            &root,
            "helper-failure-key",
            256,
            &std::sync::atomic::AtomicBool::new(false),
            4,
            1024,
            std::path::Path::new("/definitely/missing/qlmanage"),
            std::time::Duration::from_secs(1),
        )
        .expect_err("helper spawn failure");
        assert!(error.starts_with("macos_quick_look_helper_start_failed:"));
        assert!(!pending.exists());
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn preview_source_binding_rejects_path_replacement() {
        let root = std::env::temp_dir().join(format!(
            "zen-canvas-quick-look-binding-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).expect("fixture");
        let source = root.join("source.txt");
        let displaced = root.join("displaced.txt");
        std::fs::write(&source, b"verified source").expect("source");
        let handle = std::fs::File::open(&source).expect("open source");

        std::fs::rename(&source, &displaced).expect("displace source");
        std::fs::write(&source, b"replacement source").expect("replacement");

        assert!(ensure_preview_path_binding(&handle, &source).is_err());
        std::fs::remove_dir_all(root).expect("remove fixture");
    }
}
