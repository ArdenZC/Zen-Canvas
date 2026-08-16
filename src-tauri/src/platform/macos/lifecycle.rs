//! macOS workspace lifecycle coordination.
//!
//! AppKit owns sleep, wake, mount, unmount, and volume-change notifications.
//! This adapter turns those notifications into one bounded state machine so
//! existing durable workers can pause and resume without creating a second
//! reconciliation authority or polling the filesystem.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
#[cfg(target_os = "macos")]
use std::thread;
use std::thread::JoinHandle;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacLifecycleEvent {
    WillSleep,
    DidWake,
    DidMount,
    WillUnmount,
    DidUnmount,
    VolumeChanged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacLifecycleState {
    Active,
    Suspended,
    ReconcileRequired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MacLifecycleSnapshot {
    pub state: MacLifecycleState,
    pub last_error: Option<String>,
}

#[derive(Clone)]
pub struct MacLifecycleController {
    state: Arc<Mutex<MacLifecycleSnapshot>>,
    stopped: Arc<AtomicBool>,
    worker: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl MacLifecycleController {
    pub fn start<F>(on_event: F) -> Result<Self, String>
    where
        F: Fn(MacLifecycleEvent) -> Result<(), String> + Send + Sync + 'static,
    {
        let controller = Self {
            state: Arc::new(Mutex::new(MacLifecycleSnapshot {
                state: MacLifecycleState::Active,
                last_error: None,
            })),
            stopped: Arc::new(AtomicBool::new(false)),
            worker: Arc::new(Mutex::new(None)),
        };

        #[cfg(target_os = "macos")]
        {
            let state = Arc::clone(&controller.state);
            let stopped = Arc::clone(&controller.stopped);
            let callback: Arc<dyn Fn(MacLifecycleEvent) -> Result<(), String> + Send + Sync> =
                Arc::new(on_event);
            let worker = thread::Builder::new()
                .name("zen-canvas-macos-lifecycle".to_string())
                .spawn(move || {
                    objc2::rc::autoreleasepool(|_| {
                        run_workspace_observer(&state, &stopped, &callback);
                    });
                })
                .map_err(|error| format!("macos_lifecycle_thread_start_failed: {error}"))?;
            if let Ok(mut slot) = controller.worker.lock() {
                *slot = Some(worker);
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = on_event;
        }

        Ok(controller)
    }

    pub fn snapshot(&self) -> MacLifecycleSnapshot {
        self.state
            .lock()
            .map(|state| state.clone())
            .unwrap_or(MacLifecycleSnapshot {
                state: MacLifecycleState::ReconcileRequired,
                last_error: Some("macos_lifecycle_state_unavailable".to_string()),
            })
    }

    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        if let Ok(mut slot) = self.worker.lock() {
            if let Some(worker) = slot.take() {
                let _ = worker.join();
            }
        }
    }

    #[cfg(any(target_os = "macos", test))]
    fn apply_event(
        state: &Arc<Mutex<MacLifecycleSnapshot>>,
        callback: &dyn Fn(MacLifecycleEvent) -> Result<(), String>,
        event: MacLifecycleEvent,
    ) {
        #[cfg(target_os = "macos")]
        if matches!(
            event,
            MacLifecycleEvent::DidMount
                | MacLifecycleEvent::WillUnmount
                | MacLifecycleEvent::DidUnmount
                | MacLifecycleEvent::VolumeChanged
        ) {
            crate::platform::macos::strategy::invalidate_source_retirement_capability_cache();
            crate::platform::macos::file_provider::invalidate_materialized_provider_items();
        }
        if let Ok(mut snapshot) = state.lock() {
            snapshot.last_error = None;
            snapshot.state = match event {
                MacLifecycleEvent::WillSleep => MacLifecycleState::Suspended,
                MacLifecycleEvent::DidWake
                | MacLifecycleEvent::DidMount
                | MacLifecycleEvent::WillUnmount
                | MacLifecycleEvent::DidUnmount
                | MacLifecycleEvent::VolumeChanged => MacLifecycleState::ReconcileRequired,
            };
        }

        let result = callback(event);
        if let Ok(mut snapshot) = state.lock() {
            match result {
                Ok(())
                    if matches!(
                        event,
                        MacLifecycleEvent::DidWake
                            | MacLifecycleEvent::DidMount
                            | MacLifecycleEvent::DidUnmount
                            | MacLifecycleEvent::VolumeChanged
                    ) =>
                {
                    snapshot.state = MacLifecycleState::Active;
                }
                Ok(()) => {}
                Err(error) => {
                    snapshot.state = MacLifecycleState::ReconcileRequired;
                    snapshot.last_error = Some(error);
                }
            }
        }
    }
}

impl Drop for MacLifecycleController {
    fn drop(&mut self) {
        if Arc::strong_count(&self.worker) == 1 {
            self.stop();
        }
    }
}

#[cfg(target_os = "macos")]
fn run_workspace_observer(
    state: &Arc<Mutex<MacLifecycleSnapshot>>,
    stopped: &AtomicBool,
    callback: &Arc<dyn Fn(MacLifecycleEvent) -> Result<(), String> + Send + Sync>,
) {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, ProtocolObject};
    use objc2_app_kit::{
        NSWorkspace, NSWorkspaceDidMountNotification, NSWorkspaceDidRenameVolumeNotification,
        NSWorkspaceDidUnmountNotification, NSWorkspaceDidWakeNotification,
        NSWorkspaceWillSleepNotification, NSWorkspaceWillUnmountNotification,
    };
    use objc2_foundation::{NSNotification, NSNotificationCenter, NSRunLoop};
    use std::ptr::NonNull;

    let workspace = NSWorkspace::sharedWorkspace();
    let center: Retained<NSNotificationCenter> = workspace.notificationCenter();
    let state_for_block = Arc::clone(state);
    let callback_for_block = Arc::clone(callback);
    let block = RcBlock::new(move |notification: NonNull<NSNotification>| {
        let notification = unsafe { notification.as_ref() };
        let name = notification.name().to_string();
        let event = if name == unsafe { NSWorkspaceWillSleepNotification }.to_string() {
            Some(MacLifecycleEvent::WillSleep)
        } else if name == unsafe { NSWorkspaceDidWakeNotification }.to_string() {
            Some(MacLifecycleEvent::DidWake)
        } else if name == unsafe { NSWorkspaceDidMountNotification }.to_string() {
            Some(MacLifecycleEvent::DidMount)
        } else if name == unsafe { NSWorkspaceWillUnmountNotification }.to_string() {
            Some(MacLifecycleEvent::WillUnmount)
        } else if name == unsafe { NSWorkspaceDidUnmountNotification }.to_string() {
            Some(MacLifecycleEvent::DidUnmount)
        } else if name == unsafe { NSWorkspaceDidRenameVolumeNotification }.to_string() {
            Some(MacLifecycleEvent::VolumeChanged)
        } else {
            None
        };
        if let Some(event) = event {
            MacLifecycleController::apply_event(&state_for_block, &*callback_for_block, event);
        }
    });

    let observer =
        unsafe { center.addObserverForName_object_queue_usingBlock(None, None, None, &block) };
    let run_loop = NSRunLoop::currentRunLoop();
    while !stopped.load(Ordering::Acquire) {
        let deadline = objc2_foundation::NSDate::dateWithTimeIntervalSinceNow(0.25);
        run_loop.runUntilDate(&deadline);
    }
    let protocol_object: &ProtocolObject<dyn objc2_foundation::NSObjectProtocol> =
        observer.as_ref();
    let observer_object: &AnyObject = protocol_object.as_ref();
    unsafe { center.removeObserver(observer_object) };
}

#[cfg(test)]
mod tests {
    use super::{MacLifecycleController, MacLifecycleEvent, MacLifecycleState};

    #[test]
    fn lifecycle_transitions_are_fail_closed_until_reconciliation_succeeds() {
        let controller = MacLifecycleController::start(|_| Ok(())).expect("controller starts");

        MacLifecycleController::apply_event(
            &controller.state,
            &|_| Ok(()),
            MacLifecycleEvent::WillSleep,
        );
        assert_eq!(controller.snapshot().state, MacLifecycleState::Suspended);
        MacLifecycleController::apply_event(
            &controller.state,
            &|_| Ok(()),
            MacLifecycleEvent::DidWake,
        );
        assert_eq!(controller.snapshot().state, MacLifecycleState::Active);
        controller.stop();
    }

    #[test]
    fn failed_reconciliation_remains_visible() {
        let controller = MacLifecycleController::start(|_| Err("reconcile_failed".to_string()))
            .expect("controller starts");
        MacLifecycleController::apply_event(
            &controller.state,
            &|_| Err("reconcile_failed".to_string()),
            MacLifecycleEvent::DidMount,
        );
        let snapshot = controller.snapshot();
        assert_eq!(snapshot.state, MacLifecycleState::ReconcileRequired);
        assert_eq!(snapshot.last_error.as_deref(), Some("reconcile_failed"));
        controller.stop();
    }
}
