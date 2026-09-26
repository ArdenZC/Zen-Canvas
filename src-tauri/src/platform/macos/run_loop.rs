//! Narrow stop/wake support for native macOS run-loop workers.

use std::sync::Mutex;

#[cfg(target_os = "macos")]
use objc2::rc::Retained;

#[cfg(target_os = "macos")]
use objc2_core_foundation::CFRunLoop;

type StopAction = Box<dyn Fn() + Send + Sync + 'static>;

#[derive(Default)]
struct StopState {
    requested: bool,
    delivered: bool,
    action: Option<StopAction>,
}

/// Owns a cross-thread stop request until the native run loop has returned.
/// The callback stays protected by the mutex while it runs so its retained
/// native handle cannot be dropped concurrently with stop/wake.
#[derive(Default)]
pub(crate) struct NativeRunLoopStopSignal {
    state: Mutex<StopState>,
}

impl NativeRunLoopStopSignal {
    #[cfg(any(target_os = "macos", test))]
    pub(crate) fn install(&self, action: impl Fn() + Send + Sync + 'static) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.requested {
            if !state.delivered {
                state.delivered = true;
                action();
            }
        } else {
            state.action = Some(Box::new(action));
        }
    }

    pub(crate) fn request_stop(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.requested {
            return;
        }
        state.requested = true;
        let should_deliver = state.action.is_some();
        if should_deliver {
            state.delivered = true;
            if let Some(action) = state.action.as_ref() {
                action();
            }
        }
    }

    #[cfg(any(target_os = "macos", test))]
    pub(crate) fn clear(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.action = None;
    }
}

/// Builds the cross-thread stop/wake action for a retained CFRunLoop. The
/// action owns that handle until `clear` removes it from the signal.
#[cfg(target_os = "macos")]
pub(crate) fn cross_thread_stop_action(
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
        mpsc, Arc,
    };

    #[test]
    fn stop_before_run_loop_install_is_preserved() {
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
    fn stop_after_run_loop_start_wakes_a_blocked_worker() {
        let signal = Arc::new(NativeRunLoopStopSignal::default());
        let (wake_tx, wake_rx) = mpsc::channel();
        let (started_tx, started_rx) = mpsc::channel();
        let signal_for_worker = Arc::clone(&signal);
        let worker = std::thread::spawn(move || {
            signal_for_worker.install(move || wake_tx.send(()).expect("wake worker"));
            started_tx.send(()).expect("report installed run loop");
            wake_rx.recv().expect("native stop wakes blocked worker");
            signal_for_worker.clear();
        });

        started_rx.recv().expect("run loop installed");
        signal.request_stop();
        worker.join().expect("worker exits after wake");
    }

    #[test]
    fn repeated_stop_is_idempotent_and_clear_releases_the_action() {
        let signal = NativeRunLoopStopSignal::default();
        let calls = Arc::new(AtomicUsize::new(0));
        let observed = calls.clone();
        signal.install(move || {
            observed.fetch_add(1, Ordering::SeqCst);
        });
        signal.request_stop();
        signal.request_stop();
        signal.request_stop();
        signal.clear();
        signal.request_stop();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}
