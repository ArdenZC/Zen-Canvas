//! W4-03 Windows Preview Handler lifecycle spike.
//!
//! This is a dedicated Windows-only COM DLL shape. It is intentionally not a
//! Tauri crate, does not register file associations, and does not parse files
//! or execute content. `DoPreview` performs one bounded inert read from the
//! shell-provided IStream and renders a plain-text summary into one child HWND.

#![cfg(windows)]

mod com;
mod state;
mod stream;
mod window;

#[cfg(any(test, feature = "test-registration"))]
pub mod test_registration;

use std::sync::{atomic::AtomicU32, OnceLock};
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

pub(crate) fn host_registry() -> &'static std::sync::Arc<HostProvidedRegistry> {
    static REGISTRY: OnceLock<std::sync::Arc<HostProvidedRegistry>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        HostProvidedRegistry::new(HostProvidedConfig::default())
            .expect("valid W4-03 host-provided registry configuration")
    })
}

#[no_mangle]
/// # Safety
///
/// This export has no pointer arguments and only reads process-local COM
/// lifetime counters maintained by the DLL.
pub unsafe extern "system" fn DllCanUnloadNow() -> HRESULT {
    if ACTIVE_OBJECTS.load(std::sync::atomic::Ordering::Acquire) == 0
        && SERVER_LOCKS.load(std::sync::atomic::Ordering::Acquire) == 0
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
