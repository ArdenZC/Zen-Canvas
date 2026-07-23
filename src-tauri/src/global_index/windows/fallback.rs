use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexSink};
use crate::global_index::models::{
    GlobalEntryInput, GlobalSourceDescriptor, PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};

pub fn index_volume(
    source: &GlobalSourceDescriptor,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<(), GlobalIndexError> {
    let mut batch = Vec::with_capacity(512);
    walk(
        &source.volume.mount_path,
        &source.volume.id,
        &mut batch,
        sink,
        cancel,
    )?;
    if !batch.is_empty() {
        sink.write_batch(&batch)?;
    }
    Ok(())
}

fn walk(
    path: &str,
    volume_id: &str,
    batch: &mut Vec<GlobalEntryInput>,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<(), GlobalIndexError> {
    if cancel.load(Ordering::Acquire) {
        return Err(GlobalIndexError::Paused);
    }
    let entries = fs::read_dir(path).map_err(|error| {
        GlobalIndexError::Provider(format!("recursive fallback cannot read {}: {error}", path))
    })?;
    for item in entries {
        if cancel.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        let item = match item {
            Ok(item) => item,
            Err(_) => continue,
        };
        let item_path = item.path();
        let mut input =
            GlobalEntryInput::from_path(volume_id, &item_path, PROVIDER_WINDOWS_RECURSIVE_FALLBACK);
        input.source_provider = PROVIDER_WINDOWS_RECURSIVE_FALLBACK.to_string();
        let is_directory = item
            .file_type()
            .map(|value| value.is_dir())
            .unwrap_or(false);
        batch.push(input);
        if batch.len() >= 512 {
            sink.write_batch(batch)?;
            batch.clear();
        }
        if is_directory {
            let child = item_path.to_string_lossy().into_owned();
            walk(&child, volume_id, batch, sink, cancel)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_provider_name_is_explicit() {
        assert_eq!(
            PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
            "windows_recursive_fallback"
        );
    }
}
