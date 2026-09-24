//! Read-only Windows power-state snapshot used by RuntimeResourceGovernor.

use crate::resource_governor::WindowsPowerSnapshot;
use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

pub fn current_snapshot() -> Option<WindowsPowerSnapshot> {
    let mut native = SYSTEM_POWER_STATUS::default();
    let succeeded = unsafe { GetSystemPowerStatus(&mut native) } != 0;
    if !succeeded {
        return None;
    }

    Some(WindowsPowerSnapshot {
        battery_saver: match native.SystemStatusFlag {
            0 => Some(false),
            flags => Some(flags & 0x01 != 0),
        },
        on_battery: match native.ACLineStatus {
            0 => Some(true),
            1 => Some(false),
            _ => None,
        },
    })
}
