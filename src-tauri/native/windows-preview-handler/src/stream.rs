#[cfg(test)]
use std::rc::Rc;
use std::{
    ffi::c_void,
    mem::ManuallyDrop,
    ptr::NonNull,
    sync::{Arc, Mutex},
};
use windows::{
    core::{Interface, HRESULT},
    Win32::{
        Foundation::RPC_E_CALL_CANCELED,
        System::Com::{
            IStream,
            Marshal::{CoMarshalInterThreadInterfaceInStream, CoReleaseMarshalData},
            StructuredStorage::CoGetInterfaceAndReleaseStream,
            STREAM_SEEK_SET,
        },
    },
};
use zen_canvas_native_host::{
    BoundedContentRead, HostProvidedReadContext, HostProvidedReadSource, HostProvidedSourceError,
};

use crate::{read_worker::ReadObservation, E_FAIL, S_FALSE, S_OK};

/// Explorer owns the supplied COM stream. The handler and its registry stay on
/// the COM caller's apartment/thread, so the stream is retained by `Rc` and is
/// never made `Send` or `Sync`.
#[cfg(test)]
pub(crate) struct ShellStreamSource {
    stream: Rc<IStream>,
}

#[cfg(test)]
impl ShellStreamSource {
    pub(crate) fn new(stream: Rc<IStream>) -> Self {
        Self { stream }
    }
}

#[cfg(test)]
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
                .map_err(map_stream_error)?;
            let status: HRESULT =
                self.stream
                    .Read(bytes.as_mut_ptr().cast(), max_bytes, Some(&mut bytes_read));
            if status == RPC_E_CALL_CANCELED {
                return Err(HostProvidedSourceError::Cancelled);
            }
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

/// A COM marshal packet, rather than the incoming `IStream`, is the only
/// interface value transferred to the read worker. The packet is produced by
/// `CoMarshalInterThreadInterfaceInStream` and is consumed by
/// `CoGetInterfaceAndReleaseStream` (or released with `CoReleaseMarshalData`)
/// in the destination apartment. It is therefore safe to move as a packet;
/// it must never be used as an ordinary COM interface on the wrong apartment.
struct MarshaledStreamPacket {
    raw: NonNull<c_void>,
}

// SAFETY: this wrapper contains only the owning COM standard-marshal stream
// reference. It is not the incoming source interface and is never used for
// ordinary IStream calls. The wrapper is consumed exactly once by the COM
// marshal APIs below.
unsafe impl Send for MarshaledStreamPacket {}

impl MarshaledStreamPacket {
    fn from_stream(stream: &IStream) -> windows::core::Result<Self> {
        let marshaled = unsafe { CoMarshalInterThreadInterfaceInStream(&IStream::IID, stream)? };
        let raw = marshaled.into_raw();
        let Some(raw) = NonNull::new(raw) else {
            return Err(windows::core::Error::from_hresult(E_FAIL));
        };
        Ok(Self { raw })
    }

    fn into_stream(self) -> windows::core::Result<IStream> {
        let raw = self.raw;
        // CoGetInterfaceAndReleaseStream consumes/releases the marshal stream
        // interface. Prevent the Rust wrapper from releasing that same pointer.
        std::mem::forget(self);
        let marshal_stream = ManuallyDrop::new(unsafe { IStream::from_raw(raw.as_ptr()) });
        unsafe { CoGetInterfaceAndReleaseStream(&*marshal_stream) }
    }
}

impl Drop for MarshaledStreamPacket {
    fn drop(&mut self) {
        // This path runs only when the worker has not claimed the packet. The
        // owner and worker apartments both initialize COM before this source
        // can be dropped, and the marshal data is released before the wrapper
        // itself releases its IStream reference.
        let marshal_stream = unsafe { IStream::from_raw(self.raw.as_ptr()) };
        unsafe {
            let _ = CoReleaseMarshalData(&marshal_stream);
        }
    }
}

/// HostProvided adapter for the asynchronous handler read. The mutex protects
/// only the one-time transfer of the marshal packet; it is not held across
/// `IStream::Seek` or `IStream::Read`.
pub(crate) struct MarshaledShellStreamSource {
    packet: Mutex<Option<MarshaledStreamPacket>>,
    observation: Arc<ReadObservation>,
}

impl MarshaledShellStreamSource {
    pub(crate) fn new(
        stream: &IStream,
        observation: Arc<ReadObservation>,
    ) -> windows::core::Result<Self> {
        Ok(Self {
            packet: Mutex::new(Some(MarshaledStreamPacket::from_stream(stream)?)),
            observation,
        })
    }
}

impl HostProvidedReadSource for MarshaledShellStreamSource {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        if context.is_cancelled() {
            return Err(HostProvidedSourceError::Cancelled);
        }
        let packet = lock(&self.packet)
            .take()
            .ok_or(HostProvidedSourceError::Failed)?;
        let stream = packet
            .into_stream()
            .map_err(|_| HostProvidedSourceError::Failed)?;
        if context.is_cancelled() {
            return Err(HostProvidedSourceError::Cancelled);
        }

        // The observation is set immediately before any COM stream operation.
        // The harness uses this barrier to revoke the token while Read is
        // genuinely blocked, rather than racing a guessed timing window.
        self.observation.mark_entered();
        let offset = i64::try_from(offset_bytes).map_err(|_| HostProvidedSourceError::Failed)?;
        let mut bytes = vec![0_u8; max_bytes as usize];
        let mut bytes_read = 0_u32;
        let mut new_position = 0_u64;
        unsafe {
            stream
                .Seek(offset, STREAM_SEEK_SET, Some(&mut new_position))
                .map_err(map_stream_error)?;
            let status: HRESULT =
                stream.Read(bytes.as_mut_ptr().cast(), max_bytes, Some(&mut bytes_read));
            if status == RPC_E_CALL_CANCELED {
                return Err(HostProvidedSourceError::Cancelled);
            }
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

fn map_stream_error(error: windows::core::Error) -> HostProvidedSourceError {
    if error.code() == RPC_E_CALL_CANCELED {
        HostProvidedSourceError::Cancelled
    } else {
        HostProvidedSourceError::Failed
    }
}

fn lock<T>(value: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
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
