//! Memory/disk thumbnail cache ownership, atomic publication and eviction.

use super::{
    lock,
    types::{ThumbnailArtifact, ThumbnailServiceConfig, ThumbnailVariant},
};
use std::{
    collections::HashMap,
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(super) enum CacheIdentity {
    Durable {
        source_identity: String,
        source_version: String,
    },
    Session {
        session_id: String,
        generation: String,
        entry_id: String,
        source_version: String,
    },
}

impl CacheIdentity {
    pub(super) fn is_durable(&self) -> bool {
        matches!(self, Self::Durable { .. })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(super) struct GenerationKey {
    pub(super) identity: CacheIdentity,
    pub(super) variant: ThumbnailVariant,
    pub(super) renderer_id: String,
    pub(super) renderer_version: String,
}

impl GenerationKey {
    pub(super) fn logical_key(&self) -> String {
        let identity = match &self.identity {
            CacheIdentity::Durable {
                source_identity,
                source_version,
            } => format!("durable:{source_identity}:{source_version}"),
            CacheIdentity::Session {
                session_id,
                generation,
                entry_id,
                source_version,
            } => format!("session:{session_id}:{generation}:{entry_id}:{source_version}"),
        };
        let material = format!(
            "thumbnail-v1:{identity}:{}:{}:{}",
            self.variant.pixels(),
            self.renderer_id,
            self.renderer_version
        );
        blake3::hash(material.as_bytes()).to_hex().to_string()
    }
}

struct MemoryCacheEntry {
    artifact: ThumbnailArtifact,
    last_used: u64,
}

#[derive(Default)]
struct MemoryState {
    entries: HashMap<GenerationKey, MemoryCacheEntry>,
    bytes: u64,
    access_counter: u64,
}

/// The cache owns all memory and disk cache state.  Service coordination never
/// guards disk lookup, atomic commit, fsync, rename or eviction.
pub(super) struct ThumbnailCache {
    cache_dir: Option<PathBuf>,
    memory: Mutex<MemoryState>,
    memory_max_entries: usize,
    memory_max_bytes: u64,
    disk_max_entries: usize,
    disk_max_bytes: u64,
    max_disk_entry_bytes: u64,
}

impl ThumbnailCache {
    pub(super) fn new(
        cache_dir: Option<PathBuf>,
        config: &ThumbnailServiceConfig,
    ) -> Result<Self, String> {
        if let Some(cache_dir) = cache_dir.as_ref() {
            ensure_cache_dir(cache_dir)?;
        }
        Ok(Self {
            cache_dir,
            memory: Mutex::new(MemoryState::default()),
            memory_max_entries: config.memory_max_entries,
            memory_max_bytes: config.memory_max_bytes,
            disk_max_entries: config.disk_max_entries,
            disk_max_bytes: config.disk_max_bytes,
            max_disk_entry_bytes: config.disk_max_bytes.min(config.max_output_bytes),
        })
    }

    pub(super) fn memory_lookup(&self, key: &GenerationKey) -> Option<ThumbnailArtifact> {
        let mut memory = lock(&self.memory);
        memory.access_counter = memory.access_counter.wrapping_add(1).max(1);
        let access = memory.access_counter;
        memory.entries.get_mut(key).map(|entry| {
            entry.last_used = access;
            entry.artifact.clone()
        })
    }

    pub(super) fn memory_insert(&self, key: GenerationKey, artifact: ThumbnailArtifact) {
        let size = artifact.bytes.len() as u64;
        if size > self.memory_max_bytes {
            return;
        }
        let mut memory = lock(&self.memory);
        if let Some(previous) = memory.entries.remove(&key) {
            memory.bytes = memory
                .bytes
                .saturating_sub(previous.artifact.bytes.len() as u64);
        }
        memory.access_counter = memory.access_counter.wrapping_add(1).max(1);
        let access = memory.access_counter;
        memory.bytes = memory.bytes.saturating_add(size);
        memory.entries.insert(
            key,
            MemoryCacheEntry {
                artifact,
                last_used: access,
            },
        );
        while memory.entries.len() > self.memory_max_entries || memory.bytes > self.memory_max_bytes
        {
            let Some(oldest) = memory
                .entries
                .iter()
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some(removed) = memory.entries.remove(&oldest) {
                memory.bytes = memory
                    .bytes
                    .saturating_sub(removed.artifact.bytes.len() as u64);
            }
        }
    }

    pub(super) fn memory_len(&self) -> usize {
        lock(&self.memory).entries.len()
    }

    pub(super) fn clear_memory(&self) {
        let mut memory = lock(&self.memory);
        memory.entries.clear();
        memory.bytes = 0;
    }

    pub(super) fn disk_lookup(&self, key: &GenerationKey) -> Option<ThumbnailArtifact> {
        let path = self.cache_file_path(key)?;
        let metadata = fs::symlink_metadata(&path).ok()?;
        if !is_safe_regular_file(&metadata) || metadata.len() > self.max_disk_entry_bytes {
            return None;
        }
        let bytes = fs::read(&path).ok()?;
        if bytes.len() as u64 > self.max_disk_entry_bytes {
            return None;
        }
        Some(ThumbnailArtifact {
            cache_key: key.logical_key(),
            bytes,
        })
    }

    pub(super) fn disk_store(&self, key: &GenerationKey, bytes: &[u8]) -> io::Result<()> {
        let Some(cache_dir) = self.cache_dir.as_ref() else {
            return Ok(());
        };
        if bytes.len() as u64 > self.max_disk_entry_bytes {
            return Ok(());
        }
        ensure_cache_dir(cache_dir).map_err(io::Error::other)?;
        let target = cache_dir.join(format!("{}.thumb", key.logical_key()));
        reject_cache_symlink(&target).map_err(io::Error::other)?;
        if let Ok(metadata) = fs::symlink_metadata(&target) {
            if is_safe_regular_file(&metadata) && metadata.len() <= self.max_disk_entry_bytes {
                return Ok(());
            }
        }
        let pending = cache_dir.join(format!(".pending-thumbnail-{}", uuid::Uuid::new_v4()));
        let result = (|| {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&pending)?;
            file.write_all(bytes)?;
            file.sync_all()?;
            fs::rename(&pending, &target)?;
            Ok::<(), io::Error>(())
        })();
        let _ = fs::remove_file(&pending);
        if result.is_ok() {
            trim_disk_cache(cache_dir, self.disk_max_entries, self.disk_max_bytes);
        }
        result
    }

    fn cache_file_path(&self, key: &GenerationKey) -> Option<PathBuf> {
        self.cache_dir
            .as_ref()
            .map(|root| root.join(format!("{}.thumb", key.logical_key())))
    }
}

fn trim_disk_cache(cache_dir: &Path, max_entries: usize, max_bytes: u64) {
    let mut entries = fs::read_dir(cache_dir)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("thumb") {
                return None;
            }
            let metadata = fs::symlink_metadata(&path).ok()?;
            if !is_safe_regular_file(&metadata) {
                return None;
            }
            Some((path, metadata.len(), metadata.modified().ok()))
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|(_, _, modified)| *modified);
    let mut total = 0_u64;
    let mut count = 0_usize;
    for (path, size, _) in entries.into_iter().rev() {
        if count < max_entries && total.saturating_add(size) <= max_bytes {
            total = total.saturating_add(size);
            count += 1;
        } else {
            let _ = fs::remove_file(path);
        }
    }
}

pub(super) fn ensure_cache_dir(cache_dir: &Path) -> Result<(), String> {
    if let Ok(metadata) = fs::symlink_metadata(cache_dir) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() || is_reparse_point(&metadata) {
            return Err("thumbnail_cache_directory_not_safe".to_string());
        }
        return Ok(());
    }
    fs::create_dir_all(cache_dir)
        .map_err(|error| format!("thumbnail_cache_create_failed:{error}"))?;
    let metadata = fs::symlink_metadata(cache_dir)
        .map_err(|error| format!("thumbnail_cache_stat_failed:{error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() || is_reparse_point(&metadata) {
        return Err("thumbnail_cache_directory_not_safe".to_string());
    }
    Ok(())
}

fn reject_cache_symlink(path: &Path) -> Result<(), String> {
    if fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink() || is_reparse_point(&metadata))
        .unwrap_or(false)
    {
        return Err("thumbnail_cache_entry_not_safe".to_string());
    }
    Ok(())
}

pub(super) fn is_safe_regular_file(metadata: &fs::Metadata) -> bool {
    metadata.is_file() && !metadata.file_type().is_symlink() && !is_reparse_point(metadata)
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
