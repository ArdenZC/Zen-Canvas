use objc2::rc::Retained;
use objc2_core_foundation::CFRunLoop;
use std::sync::Mutex;

type StopAction = Box<dyn Fn() + Send + Sync + 'static>;

#[derive(Default)]
struct StopState {
    requested: bool,
    action: Option<StopAction>,
}

/// Owns the cross-thread stop request for one native provider run loop.
///
/// The callback is kept under the mutex while it is invoked so the retained
/// native run-loop handle cannot be dropped concurrently with stop/wake.
#[derive(Default)]
pub(super) struct NativeRunLoopStopSignal {
    state: Mutex<StopState>,
}

impl NativeRunLoopStopSignal {
    pub(super) fn install(&self, action: impl Fn() + Send + Sync + 'static) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.requested {
            action();
        } else {
            state.action = Some(Box::new(action));
        }
    }

    pub(super) fn request_stop(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.requested = true;
        if let Some(action) = state.action.as_ref() {
            action();
        }
    }

    pub(super) fn clear(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.action = None;
    }
}

/// Builds the narrowly scoped cross-thread action for a retained CFRunLoop.
/// The returned action owns that retained handle until `clear` removes it.
pub(super) fn cross_thread_stop_action(
    run_loop: Retained<CFRunLoop>,
) -> impl Fn() + Send + Sync + 'static {
    struct ThreadSafeRunLoop(Retained<CFRunLoop>);

    // Core Foundation documents run loops as thread-safe; stop and wake_up
    // are specifically intended to be called across threads. The enclosing
    // stop signal's mutex serializes this retained handle's lifetime with the
    // cross-thread calls, while the run-loop thread owns execution itself.
    unsafe impl Send for ThreadSafeRunLoop {}
    unsafe impl Sync for ThreadSafeRunLoop {}

    let run_loop = std::sync::Arc::new(ThreadSafeRunLoop(run_loop));
    move || {
        run_loop.0.stop();
        run_loop.0.wake_up();
    }
}

#[cfg(test)]
mod tests {
    use super::NativeRunLoopStopSignal;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    #[test]
    fn stop_before_native_run_loop_install_is_preserved() {
        let signal = NativeRunLoopStopSignal::default();
        signal.request_stop();
        let calls = Arc::new(AtomicUsize::new(0));
        let observed = calls.clone();
        signal.install(move || {
            observed.fetch_add(1, Ordering::SeqCst);
        });
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn stop_wakes_installed_run_loop_and_clear_releases_action() {
        let signal = NativeRunLoopStopSignal::default();
        let calls = Arc::new(AtomicUsize::new(0));
        let observed = calls.clone();
        signal.install(move || {
            observed.fetch_add(1, Ordering::SeqCst);
        });
        signal.request_stop();
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        signal.clear();
        signal.request_stop();
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}
