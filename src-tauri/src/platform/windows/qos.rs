//! Best-effort thread-local Windows EcoQoS hint for dedicated background work.

use std::mem::size_of;
use windows_sys::Win32::System::Threading::{
    GetCurrentThread, SetThreadInformation, ThreadPowerThrottling,
    THREAD_POWER_THROTTLING_CURRENT_VERSION, THREAD_POWER_THROTTLING_EXECUTION_SPEED,
    THREAD_POWER_THROTTLING_STATE,
};

pub fn set_current_thread_background_qos() -> bool {
    let state = THREAD_POWER_THROTTLING_STATE {
        Version: THREAD_POWER_THROTTLING_CURRENT_VERSION,
        ControlMask: THREAD_POWER_THROTTLING_EXECUTION_SPEED,
        StateMask: THREAD_POWER_THROTTLING_EXECUTION_SPEED,
    };
    unsafe {
        SetThreadInformation(
            GetCurrentThread(),
            ThreadPowerThrottling,
            &state as *const THREAD_POWER_THROTTLING_STATE as *const std::ffi::c_void,
            size_of::<THREAD_POWER_THROTTLING_STATE>() as u32,
        ) != 0
    }
}

pub fn reset_current_thread_power_throttling() {
    let state = THREAD_POWER_THROTTLING_STATE {
        Version: THREAD_POWER_THROTTLING_CURRENT_VERSION,
        ControlMask: THREAD_POWER_THROTTLING_EXECUTION_SPEED,
        StateMask: 0,
    };
    let _ = unsafe {
        SetThreadInformation(
            GetCurrentThread(),
            ThreadPowerThrottling,
            &state as *const THREAD_POWER_THROTTLING_STATE as *const std::ffi::c_void,
            size_of::<THREAD_POWER_THROTTLING_STATE>() as u32,
        )
    };
}
