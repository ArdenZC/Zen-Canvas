//! Event-driven suspend/resume wake only. No state, timer, queue or recurrence.
use crate::db::AutomationWake;
use std::sync::Arc;
use windows_sys::Win32::{
    System::Power::{
        PowerRegisterSuspendResumeNotification, PowerUnregisterSuspendResumeNotification,
        DEVICE_NOTIFY_SUBSCRIBE_PARAMETERS,
    },
    UI::WindowsAndMessaging::{DEVICE_NOTIFY_CALLBACK, PBT_APMRESUMEAUTOMATIC, PBT_APMSUSPEND},
};

pub(crate) struct AutomationResumeWake {
    handle: isize,
    context: Option<Arc<AutomationWake>>,
}
impl AutomationResumeWake {
    pub(crate) fn start(wake: Arc<AutomationWake>) -> Result<Self, String> {
        let context = wake;
        let parameters = DEVICE_NOTIFY_SUBSCRIBE_PARAMETERS {
            Callback: Some(receive),
            Context: Arc::as_ptr(&context).cast_mut().cast(),
        };
        let mut handle = std::ptr::null_mut();
        let status = unsafe {
            PowerRegisterSuspendResumeNotification(
                DEVICE_NOTIFY_CALLBACK,
                (&parameters as *const DEVICE_NOTIFY_SUBSCRIBE_PARAMETERS)
                    .cast_mut()
                    .cast(),
                &mut handle,
            )
        };
        if status != 0 {
            return Err(format!(
                "Automation resume notification registration failed: {status}"
            ));
        }
        Ok(Self {
            handle: handle as isize,
            context: Some(context),
        })
    }
}
unsafe extern "system" fn receive(
    context: *const core::ffi::c_void,
    event: u32,
    _setting: *const core::ffi::c_void,
) -> u32 {
    let wake = unsafe { &*context.cast::<AutomationWake>() };
    match event {
        PBT_APMSUSPEND => wake.set_paused(true),
        PBT_APMRESUMEAUTOMATIC => {
            wake.set_paused(false);
            crate::scheduler::WorkScheduler::global().notify_resource_policy_changed();
        }
        _ => {}
    }
    0
}
impl Drop for AutomationResumeWake {
    fn drop(&mut self) {
        let status = unsafe { PowerUnregisterSuspendResumeNotification(self.handle) };
        if status != 0 {
            // A failed unregister may leave the OS callback live. Preserve its
            // context rather than free memory still reachable by native code.
            if let Some(context) = self.context.take() {
                std::mem::forget(context);
            }
        }
    }
}
