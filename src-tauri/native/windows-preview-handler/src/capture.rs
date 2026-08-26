use std::ffi::c_void;

use windows::{
    core::HRESULT,
    Win32::System::Com::{IStream, STATFLAG_NONAME, STATSTG, STREAM_SEEK_SET},
};

pub(crate) const MAX_CAPTURE_BYTES: usize = 512 * 1024;
const READ_CHUNK_BYTES: usize = 64 * 1024;
const S_OK: HRESULT = HRESULT(0);
const S_FALSE: HRESULT = HRESULT(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CaptureError {
    StreamCall(HRESULT),
    InvalidReadCount,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CapturedSource {
    pub(crate) bytes: Vec<u8>,
    pub(crate) complete: bool,
    pub(crate) read_calls: usize,
    pub(crate) declared_size: Option<u64>,
}

/// The capture algorithm is generic so its budget/EOF rules can be proved
/// without a real shell. The concrete IStream adapter below is the only place
/// that calls COM, and it is used synchronously by the owning apartment.
pub(crate) trait CaptureReader {
    fn prepare(&mut self) -> Result<(), CaptureError> {
        Ok(())
    }

    fn declared_size(&mut self) -> Option<u64>;
    fn read(&mut self, destination: &mut [u8]) -> Result<usize, CaptureError>;
}

pub(crate) fn capture<R: CaptureReader>(reader: &mut R) -> Result<CapturedSource, CaptureError> {
    reader.prepare()?;
    let declared_size = reader.declared_size();
    let target = declared_size
        .map(|size| size.min(MAX_CAPTURE_BYTES as u64) as usize)
        .unwrap_or(MAX_CAPTURE_BYTES);
    let mut bytes = Vec::with_capacity(target);
    let mut read_calls = 0;
    let mut complete = declared_size == Some(0);

    while !complete && bytes.len() < target {
        let request = (target - bytes.len()).min(READ_CHUNK_BYTES);
        let start = bytes.len();
        bytes.resize(start + request, 0);
        let read = match reader.read(&mut bytes[start..]) {
            Ok(read) => read,
            Err(error) => {
                bytes.truncate(start);
                return Err(error);
            }
        };
        read_calls += 1;
        if read > request {
            bytes.truncate(start);
            return Err(CaptureError::InvalidReadCount);
        }
        bytes.truncate(start + read);
        if read < request {
            // IStream's short-read result is the only stream-observed EOF fact
            // needed here. No extra byte is requested to probe completeness.
            complete = true;
        }
    }

    if !complete {
        if let Some(size) = declared_size {
            if size <= MAX_CAPTURE_BYTES as u64 && bytes.len() as u64 == size {
                complete = true;
            }
        }
    }

    Ok(CapturedSource {
        bytes,
        complete,
        read_calls,
        declared_size,
    })
}

/// Owner-apartment-only adapter for the shell-owned stream. The resulting
/// `CapturedSource` contains no COM interface, proxy, clone or handle.
pub(crate) struct IStreamCaptureReader<'a> {
    stream: &'a IStream,
}

impl<'a> IStreamCaptureReader<'a> {
    pub(crate) fn new(stream: &'a IStream) -> Self {
        Self { stream }
    }
}

impl CaptureReader for IStreamCaptureReader<'_> {
    fn prepare(&mut self) -> Result<(), CaptureError> {
        unsafe {
            self.stream
                .Seek(0, STREAM_SEEK_SET, None)
                .map_err(|error| CaptureError::StreamCall(error.code()))
        }
    }

    fn declared_size(&mut self) -> Option<u64> {
        let mut stat = STATSTG::default();
        unsafe {
            self.stream
                .Stat(&mut stat, STATFLAG_NONAME)
                .ok()
                .map(|_| stat.cbSize)
        }
    }

    fn read(&mut self, destination: &mut [u8]) -> Result<usize, CaptureError> {
        let requested =
            u32::try_from(destination.len()).map_err(|_| CaptureError::InvalidReadCount)?;
        let mut bytes_read = 0_u32;
        let status = unsafe {
            self.stream.Read(
                destination.as_mut_ptr().cast::<c_void>(),
                requested,
                Some(&mut bytes_read),
            )
        };
        if status != S_OK && status != S_FALSE {
            return Err(CaptureError::StreamCall(status));
        }
        let bytes_read = usize::try_from(bytes_read).map_err(|_| CaptureError::InvalidReadCount)?;
        if bytes_read > destination.len() {
            return Err(CaptureError::InvalidReadCount);
        }
        Ok(bytes_read)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::{self, ThreadId};

    struct FixtureReader {
        bytes: Vec<u8>,
        offset: usize,
        declared_size: Option<u64>,
        pub max_request: usize,
        pub accepted: usize,
        pub calls: usize,
        pub thread_id: ThreadId,
    }

    impl FixtureReader {
        fn new(bytes: Vec<u8>, declared_size: Option<u64>) -> Self {
            Self {
                bytes,
                offset: 0,
                declared_size,
                max_request: 0,
                accepted: 0,
                calls: 0,
                thread_id: thread::current().id(),
            }
        }
    }

    impl CaptureReader for FixtureReader {
        fn declared_size(&mut self) -> Option<u64> {
            self.declared_size
        }

        fn read(&mut self, destination: &mut [u8]) -> Result<usize, CaptureError> {
            assert_eq!(self.thread_id, thread::current().id());
            self.calls += 1;
            self.max_request = self.max_request.max(destination.len());
            let remaining = self.bytes.len().saturating_sub(self.offset);
            let count = remaining.min(destination.len());
            destination[..count].copy_from_slice(&self.bytes[self.offset..self.offset + count]);
            self.offset += count;
            self.accepted += count;
            Ok(count)
        }
    }

    #[test]
    fn initialize_capture_algorithm_is_not_read_until_called() {
        let reader = FixtureReader::new(b"content".to_vec(), Some(7));
        assert_eq!(reader.calls, 0);
    }

    #[test]
    fn short_read_is_complete_without_probe_byte() {
        let mut reader = FixtureReader::new(b"short".to_vec(), None);
        let captured = capture(&mut reader).unwrap();
        assert!(captured.complete);
        assert_eq!(captured.bytes, b"short");
        assert_eq!(reader.accepted, 5);
        assert_eq!(reader.calls, 1);
    }

    #[test]
    fn exact_cap_without_eof_fact_is_partial_and_never_overreads() {
        let mut reader = FixtureReader::new(vec![b'x'; MAX_CAPTURE_BYTES], None);
        let captured = capture(&mut reader).unwrap();
        assert!(!captured.complete);
        assert_eq!(captured.bytes.len(), MAX_CAPTURE_BYTES);
        assert_eq!(reader.accepted, MAX_CAPTURE_BYTES);
        assert_eq!(reader.accepted, captured.bytes.len());
    }

    #[test]
    fn exact_cap_with_trustworthy_stat_is_complete() {
        let mut reader = FixtureReader::new(
            vec![b'x'; MAX_CAPTURE_BYTES],
            Some(MAX_CAPTURE_BYTES as u64),
        );
        let captured = capture(&mut reader).unwrap();
        assert!(captured.complete);
        assert_eq!(captured.bytes.len(), MAX_CAPTURE_BYTES);
        assert_eq!(reader.accepted, MAX_CAPTURE_BYTES);
    }

    #[test]
    fn larger_source_is_partial_and_budget_is_total() {
        let mut reader = FixtureReader::new(
            vec![b'x'; MAX_CAPTURE_BYTES + 1],
            Some((MAX_CAPTURE_BYTES + 1) as u64),
        );
        let captured = capture(&mut reader).unwrap();
        assert!(!captured.complete);
        assert_eq!(captured.bytes.len(), MAX_CAPTURE_BYTES);
        assert_eq!(reader.accepted, MAX_CAPTURE_BYTES);
    }
}
