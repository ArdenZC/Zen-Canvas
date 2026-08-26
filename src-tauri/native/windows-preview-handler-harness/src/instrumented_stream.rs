use std::{
    ffi::c_void,
    sync::{Arc, Mutex},
};

use windows::{
    core::{implement, Error as WindowsError, Ref, HRESULT},
    Win32::System::Com::{
        ISequentialStream_Impl, IStream, IStream_Impl, LOCKTYPE, STATFLAG, STATSTG, STGC,
        STREAM_SEEK, STREAM_SEEK_CUR, STREAM_SEEK_END, STREAM_SEEK_SET,
    },
};

const E_FAIL: HRESULT = HRESULT(0x80004005_u32 as _);
const E_NOTIMPL: HRESULT = HRESULT(0x80004001_u32 as _);
const E_POINTER: HRESULT = HRESULT(0x80004003_u32 as _);

#[derive(Debug, Default)]
pub(crate) struct StreamObservation {
    pub read_calls: usize,
    pub seek_calls: usize,
    pub stat_calls: usize,
    pub accepted_bytes: usize,
    position: u64,
}

#[allow(non_snake_case)]
#[implement(IStream, Agile = false)]
struct CountingStream {
    bytes: Vec<u8>,
    observation: Arc<Mutex<StreamObservation>>,
}

#[allow(non_snake_case)]
impl ISequentialStream_Impl for CountingStream_Impl {
    fn Read(&self, pv: *mut c_void, cb: u32, pcbread: *mut u32) -> HRESULT {
        if (cb != 0 && pv.is_null()) || pcbread.is_null() {
            return E_POINTER;
        }
        let mut observation = self.observation.lock().expect("stream observation lock");
        observation.read_calls += 1;
        let start = observation.position as usize;
        let count = self.bytes.len().saturating_sub(start).min(cb as usize);
        if count != 0 {
            unsafe {
                std::ptr::copy_nonoverlapping(
                    self.bytes.as_ptr().add(start),
                    pv.cast::<u8>(),
                    count,
                );
            }
        }
        observation.position = observation.position.saturating_add(count as u64);
        observation.accepted_bytes = observation.accepted_bytes.saturating_add(count);
        unsafe {
            *pcbread = count as u32;
        }
        if count < cb as usize {
            HRESULT(1)
        } else {
            HRESULT(0)
        }
    }

    fn Write(&self, _pv: *const c_void, _cb: u32, pcbwritten: *mut u32) -> HRESULT {
        if !pcbwritten.is_null() {
            unsafe { *pcbwritten = 0 };
        }
        E_NOTIMPL
    }
}

#[allow(non_snake_case)]
impl IStream_Impl for CountingStream_Impl {
    fn Seek(
        &self,
        dlibmove: i64,
        dworigin: STREAM_SEEK,
        plibnewposition: *mut u64,
    ) -> windows::core::Result<()> {
        if plibnewposition.is_null() {
            return Err(WindowsError::from_hresult(E_POINTER));
        }
        let mut observation = self.observation.lock().expect("stream observation lock");
        observation.seek_calls += 1;
        let base = match dworigin {
            STREAM_SEEK_SET => 0_i128,
            STREAM_SEEK_CUR => i128::from(observation.position),
            STREAM_SEEK_END => i128::from(self.bytes.len() as u64),
            _ => return Err(WindowsError::from_hresult(E_FAIL)),
        };
        let position = base + i128::from(dlibmove);
        if position < 0 || position > i128::from(u64::MAX) {
            return Err(WindowsError::from_hresult(E_FAIL));
        }
        observation.position = position as u64;
        unsafe { *plibnewposition = observation.position };
        Ok(())
    }

    fn SetSize(&self, _libnewsize: u64) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn CopyTo(
        &self,
        _pstm: Ref<'_, IStream>,
        _cb: u64,
        _pcbread: *mut u64,
        _pcbwritten: *mut u64,
    ) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Commit(&self, _grfcommitflags: &STGC) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Revert(&self) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn LockRegion(
        &self,
        _liboffset: u64,
        _cb: u64,
        _dwlocktype: &LOCKTYPE,
    ) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn UnlockRegion(
        &self,
        _liboffset: u64,
        _cb: u64,
        _dwlocktype: u32,
    ) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Stat(&self, _pstatstg: *mut STATSTG, _grfstatflag: &STATFLAG) -> windows::core::Result<()> {
        self.observation
            .lock()
            .expect("stream observation lock")
            .stat_calls += 1;
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Clone(&self) -> windows::core::Result<IStream> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }
}

pub(crate) fn create(bytes: &[u8]) -> (IStream, Arc<Mutex<StreamObservation>>) {
    let observation = Arc::new(Mutex::new(StreamObservation::default()));
    let stream: IStream = CountingStream {
        bytes: bytes.to_vec(),
        observation: Arc::clone(&observation),
    }
    .into();
    (stream, observation)
}
