use std::sync::Mutex;
use windows::{
    core::HRESULT,
    Win32::System::Com::{IStream, STREAM_SEEK_SET},
};
use zen_canvas_native_host::{
    BoundedContentRead, HostProvidedReadContext, HostProvidedReadSource, HostProvidedSourceError,
};

use crate::{S_FALSE, S_OK};

/// Explorer owns the supplied COM stream. The registry trait is Send + Sync
/// because it also supports the app-side lifecycle race tests; this adapter
/// serializes all stream calls and the handler performs reads synchronously on
/// the COM caller thread. It never moves stream work to a worker thread.
pub(crate) struct ShellStreamSource {
    stream: Mutex<IStream>,
}

impl ShellStreamSource {
    pub(crate) fn new(stream: IStream) -> Self {
        Self {
            stream: Mutex::new(stream),
        }
    }
}

// IStream is apartment-bound in general. The registry does not spawn a read
// worker, and this wrapper serializes the only calls made by the handler. A
// future async host must replace this with an explicit COM marshal boundary.
unsafe impl Send for ShellStreamSource {}
unsafe impl Sync for ShellStreamSource {}

impl HostProvidedReadSource for ShellStreamSource {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        if context.is_cancelled() {
            return Err(HostProvidedSourceError::Cancelled);
        }
        let offset = i64::try_from(offset_bytes).map_err(|_| HostProvidedSourceError::Failed)?;
        let mut bytes = vec![0_u8; max_bytes as usize];
        let mut bytes_read = 0_u32;
        let stream = self
            .stream
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        unsafe {
            stream
                .Seek(offset, STREAM_SEEK_SET, None)
                .map_err(|_| HostProvidedSourceError::Failed)?;
            let status: HRESULT =
                stream.Read(bytes.as_mut_ptr().cast(), max_bytes, Some(&mut bytes_read));
            if status != S_OK && status != S_FALSE {
                return Err(HostProvidedSourceError::Failed);
            }
        }
        if context.is_cancelled() {
            return Err(HostProvidedSourceError::Cancelled);
        }
        bytes.truncate(bytes_read as usize);
        Ok(BoundedContentRead {
            complete: bytes_read < max_bytes,
            bytes,
        })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use windows::Win32::UI::Shell::SHCreateMemStream;
    use zen_canvas_native_host::{
        HostProvidedConfig, HostProvidedHost, HostProvidedReadRequest, HostProvidedRegistration,
        HostProvidedRegistry,
    };

    use super::ShellStreamSource;

    #[test]
    fn shell_istream_reads_only_the_requested_offset_and_bound() {
        let stream =
            unsafe { SHCreateMemStream(Some(b"0123456789")) }.expect("Windows memory IStream");
        let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry
            .register(HostProvidedRegistration {
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "stream-generation".to_string(),
                source: Arc::new(ShellStreamSource::new(stream)),
            })
            .unwrap();
        let read = registry
            .read(&HostProvidedReadRequest {
                host_token: handle.host_token.clone(),
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "stream-generation".to_string(),
                offset_bytes: 3,
                max_bytes: 4,
            })
            .unwrap();
        assert_eq!(read.bytes, b"3456");
        assert!(!read.complete);

        let read = registry
            .read(&HostProvidedReadRequest {
                host_token: handle.host_token,
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "stream-generation".to_string(),
                offset_bytes: 8,
                max_bytes: 4,
            })
            .unwrap();
        assert_eq!(read.bytes, b"89");
        assert!(read.complete);
    }
}
