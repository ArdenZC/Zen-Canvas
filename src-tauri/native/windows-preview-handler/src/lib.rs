//! W4-03 Windows Preview Handler lifecycle spike.
//!
//! This is a dedicated Windows-only COM DLL shape. It is intentionally not a
//! Tauri crate, does not register file associations, and does not parse files
//! or execute content. `DoPreview` performs one bounded inert read from the
//! shell-provided IStream and renders a plain-text summary into one child HWND.

#![cfg(windows)]

mod com;
mod completion;
mod read_worker;
mod state;
mod stream;
mod window;

#[cfg(any(test, feature = "test-registration"))]
pub mod test_registration;

use std::sync::{atomic::AtomicU32, Arc, OnceLock};
use windows::core::{GUID, HRESULT};
use zen_canvas_native_host::{HostProvidedConfig, HostProvidedRegistry};

pub const PREVIEW_HANDLER_CLSID: GUID = GUID::from_u128(0x7e5a6c11_3a6d_4c92_9352_8e9b501a557c);
pub(crate) const S_OK: HRESULT = HRESULT(0);
pub(crate) const S_FALSE: HRESULT = HRESULT(1);
pub(crate) const E_FAIL: HRESULT = HRESULT(0x80004005_u32 as _);
pub(crate) const E_NOTIMPL: HRESULT = HRESULT(0x80004001_u32 as _);
pub(crate) const E_POINTER: HRESULT = HRESULT(0x80004003_u32 as _);
pub(crate) const E_UNEXPECTED: HRESULT = HRESULT(0x8000FFFF_u32 as _);
pub(crate) const CLASS_E_CLASSNOTAVAILABLE: HRESULT = HRESULT(0x80040111_u32 as _);
pub(crate) const CLASS_E_NOAGGREGATION: HRESULT = HRESULT(0x80040110_u32 as _);
pub(crate) const E_ABORT: HRESULT = HRESULT(0x80004004_u32 as _);

pub(crate) static ACTIVE_OBJECTS: AtomicU32 = AtomicU32::new(0);
pub(crate) static SERVER_LOCKS: AtomicU32 = AtomicU32::new(0);

#[cfg(feature = "test-observability")]
static TEST_UNLOAD_PHASE: AtomicU32 = AtomicU32::new(0);

#[cfg(feature = "test-observability")]
pub(crate) fn set_test_unload_phase(phase: u32) {
    TEST_UNLOAD_PHASE.store(phase, std::sync::atomic::Ordering::Release);
}

static HOST_REGISTRY: OnceLock<Arc<HostProvidedRegistry>> = OnceLock::new();

pub(crate) fn host_registry() -> Arc<HostProvidedRegistry> {
    Arc::clone(HOST_REGISTRY.get_or_init(|| {
        HostProvidedRegistry::new(HostProvidedConfig::default())
            .expect("valid W4-03 host-provided registry configuration")
    }))
}

#[no_mangle]
/// # Safety
///
/// This export has no pointer arguments and only reads process-local COM
/// lifetime counters maintained by the DLL.
pub unsafe extern "system" fn DllCanUnloadNow() -> HRESULT {
    if ACTIVE_OBJECTS.load(std::sync::atomic::Ordering::Acquire) == 0
        && SERVER_LOCKS.load(std::sync::atomic::Ordering::Acquire) == 0
        && read_worker::active_count() == 0
    {
        S_OK
    } else {
        S_FALSE
    }
}

#[no_mangle]
/// # Safety
///
/// The caller must provide valid readable `rclsid`/`riid` pointers and a
/// writable `ppv` pointer, as required by the COM class-factory ABI.
pub unsafe extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut core::ffi::c_void,
) -> HRESULT {
    com::dll_get_class_object(rclsid, riid, ppv)
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export reads the apartment-local registry count. It is not
/// part of the production DLL ABI and is never compiled without the narrow
/// observability feature.
pub unsafe extern "system" fn W4_03_TestHostProvidedRecordCount() -> u32 {
    host_registry().count() as u32
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export waits on the current read observation. It has no
/// pointer arguments and does not perform COM or filesystem work itself.
pub unsafe extern "system" fn W4_03_TestWaitForReadEntered(timeout_ms: u32) -> windows::core::BOOL {
    read_worker::wait_for_read_entered(std::time::Duration::from_millis(timeout_ms as u64)).into()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export waits until all detached bounded-read workers have
/// completed. It does not retain a handler or COM interface reference.
pub unsafe extern "system" fn W4_03_TestWaitForReadQuiescence(
    timeout_ms: u32,
) -> windows::core::BOOL {
    read_worker::wait_for_quiescence(std::time::Duration::from_millis(timeout_ms as u64)).into()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export returns the number of reads whose result was
/// rejected after HostProvided cancellation/staleness revalidation.
pub unsafe extern "system" fn W4_03_TestCancelledReadCount() -> u32 {
    read_worker::cancelled_count()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export reports whether the most recently completed read was
/// rejected as stale/cancelled.
pub unsafe extern "system" fn W4_03_TestLastReadCancelled() -> windows::core::BOOL {
    read_worker::last_cancelled().into()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export arms a barrier immediately before the shell stream
/// adapter invokes `IStream::Seek`. It is never compiled into the production
/// DLL ABI.
pub unsafe extern "system" fn W4_03_TestArmBeforeStreamOperations() {
    read_worker::arm_before_stream_operations();
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export waits for the worker to reach the pre-`Seek` barrier.
pub unsafe extern "system" fn W4_03_TestWaitForBeforeStreamOperations(
    timeout_ms: u32,
) -> windows::core::BOOL {
    read_worker::wait_for_before_stream_operations(std::time::Duration::from_millis(
        timeout_ms as u64,
    ))
    .into()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export releases the pre-`Seek` barrier.
pub unsafe extern "system" fn W4_03_TestReleaseBeforeStreamOperations() {
    read_worker::release_before_stream_operations();
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export arms a barrier after `IStream::Seek` returns and
/// immediately before `IStream::Read`.
pub unsafe extern "system" fn W4_03_TestArmAfterSeek() {
    read_worker::arm_after_seek();
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export waits for the worker to reach the post-`Seek`
/// barrier.
pub unsafe extern "system" fn W4_03_TestWaitForAfterSeek(timeout_ms: u32) -> windows::core::BOOL {
    read_worker::wait_for_after_seek(std::time::Duration::from_millis(timeout_ms as u64)).into()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export releases the post-`Seek` barrier.
pub unsafe extern "system" fn W4_03_TestReleaseAfterSeek() {
    read_worker::release_after_seek();
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export clears process-local diagnostic cancellation
/// observations before one deterministic experiment.
pub unsafe extern "system" fn W4_03_TestResetCancelObservation() {
    read_worker::reset_cancel_observation();
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export reports the number of `CoCancelCall` attempts.
pub unsafe extern "system" fn W4_03_TestCancelCallCount() -> u32 {
    read_worker::cancel_call_count()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export reports the first raw `CoCancelCall` HRESULT, or
/// zero when no call was attempted.
pub unsafe extern "system" fn W4_03_TestFirstCancelHRESULT() -> i32 {
    read_worker::first_cancel_hresult()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export reports the last raw `CoCancelCall` HRESULT, or zero
/// when no call was attempted.
pub unsafe extern "system" fn W4_03_TestLastCancelHRESULT() -> i32 {
    read_worker::last_cancel_hresult()
}

#[cfg(feature = "test-observability")]
#[no_mangle]
/// # Safety
///
/// This test-only export reports the last owner-side `Unload` phase marker.
/// The marker changes no production control flow.
pub unsafe extern "system" fn W4_03_TestUnloadPhase() -> u32 {
    TEST_UNLOAD_PHASE.load(std::sync::atomic::Ordering::Acquire)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn class_identity_is_stable() {
        assert_eq!(
            PREVIEW_HANDLER_CLSID,
            GUID::from_u128(0x7e5a6c11_3a6d_4c92_9352_8e9b501a557c)
        );
    }
}
