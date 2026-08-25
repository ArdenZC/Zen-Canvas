use std::rc::Rc;
use windows::{
    core::HRESULT,
    Win32::System::Com::{IStream, STREAM_SEEK_SET},
};
use zen_canvas_native_host::{
    BoundedContentRead, HostProvidedReadContext, HostProvidedReadSource, HostProvidedSourceError,
};

use crate::{S_FALSE, S_OK};

/// Explorer owns the supplied COM stream. The handler and its registry stay on
/// the COM caller's apartment/thread, so the stream is retained by `Rc` and is
/// never made `Send` or `Sync`.
pub(crate) struct ShellStreamSource {
    stream: Rc<IStream>,
}

impl ShellStreamSource {
    pub(crate) fn new(stream: Rc<IStream>) -> Self {
        Self { stream }
    }
}

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
        unsafe {
            self.stream
                .Seek(offset, STREAM_SEEK_SET, None)
                .map_err(|_| HostProvidedSourceError::Failed)?;
            let status: HRESULT =
                self.stream
                    .Read(bytes.as_mut_ptr().cast(), max_bytes, Some(&mut bytes_read));
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
    use std::rc::Rc;

    use windows::Win32::UI::Shell::SHCreateMemStream;
    use zen_canvas_native_host::{
        HostProvidedConfig, HostProvidedHost, HostProvidedReadRequest,
        HostProvidedThreadLocalRegistry, HostProvidedThreadRegistration,
    };

    use super::ShellStreamSource;

    #[test]
    fn shell_istream_reads_only_the_requested_offset_and_bound() {
        let stream =
            unsafe { SHCreateMemStream(Some(b"0123456789")) }.expect("Windows memory IStream");
        let registry = HostProvidedThreadLocalRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry
            .register(HostProvidedThreadRegistration {
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "stream-generation".to_string(),
                source: Rc::new(ShellStreamSource::new(Rc::new(stream))),
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
