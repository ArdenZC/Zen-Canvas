//! Process-local intent for distinguishing resident window teardown from an
//! actual application exit.

use std::sync::Mutex;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExitRequestedAction {
    StayResident,
    Exit,
}

impl ExitRequestedAction {
    pub const fn should_shutdown_resident(self) -> bool {
        matches!(self, Self::Exit)
    }
}

#[derive(Default)]
struct ExitIntentLedger {
    internal_teardowns_in_flight: usize,
    stay_resident_pending: bool,
    explicit_exit_pending: bool,
    shutdown_started: bool,
}

/// Runtime-only state. It is deliberately not persisted or shared with the UI.
#[derive(Default)]
pub struct ExitIntentState {
    ledger: Mutex<ExitIntentLedger>,
}

/// Tracks an internal WebView destruction until it succeeds or is abandoned.
/// A successful destroy queues native removal; its return does not prove that
/// Tauri has removed the WebView. An abandoned guard withdraws its prediction.
pub struct InternalWindowTeardown<'a> {
    state: &'a ExitIntentState,
    active: bool,
}

impl ExitIntentState {
    /// Bounded, opt-in build diagnostics; no paths or user payloads.
    #[cfg(feature = "native-qa")]
    pub fn trace(&self, stage: &str, detail: &str) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static RECORDS: AtomicUsize = AtomicUsize::new(0);
        let sequence = RECORDS.fetch_add(1, Ordering::Relaxed);
        if sequence >= 256 {
            return;
        }
        let ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let detail: String = detail.chars().take(900).collect();
        eprintln!("native_qa lifecycle seq={sequence} pid={} stage={stage} in_flight={} stay_resident={} explicit_exit={} predicted_last={} shutdown_started={} {detail}", std::process::id(), ledger.internal_teardowns_in_flight, ledger.stay_resident_pending, ledger.explicit_exit_pending, ledger.stay_resident_pending, ledger.shutdown_started);
    }

    pub fn begin_internal_window_teardown(
        &self,
        current_webview_count: usize,
    ) -> InternalWindowTeardown<'_> {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let next_in_flight = ledger.internal_teardowns_in_flight.saturating_add(1);
        let predicted_last = current_webview_count > 0
            && current_webview_count <= next_in_flight
            && !ledger.explicit_exit_pending;
        if predicted_last {
            ledger.stay_resident_pending = true;
        }
        ledger.internal_teardowns_in_flight = next_in_flight;
        InternalWindowTeardown {
            state: self,
            active: true,
        }
    }

    /// A newly created on-demand window ends the previous background lifetime.
    /// Call after native creation, before any fallible show/focus cleanup.
    pub fn record_window_created(&self) {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        ledger.stay_resident_pending = false;
    }

    /// Mark a user-visible Quit action before asking Tauri to exit.
    pub fn record_explicit_exit(&self) {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        ledger.explicit_exit_pending = true;
        ledger.stay_resident_pending = false;
    }

    pub fn exit_requested_action(&self, code: Option<i32>) -> ExitRequestedAction {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if code.is_some() || ledger.explicit_exit_pending || ledger.shutdown_started {
            ledger.explicit_exit_pending = true;
            ledger.stay_resident_pending = false;
            return ExitRequestedAction::Exit;
        }
        if ledger.stay_resident_pending {
            ExitRequestedAction::StayResident
        } else {
            ExitRequestedAction::Exit
        }
    }

    /// Keep the Tauri side effect tied to the same intent decision used by the
    /// deterministic contract tests.
    pub fn dispatch_exit_requested(
        &self,
        code: Option<i32>,
        prevent_exit: impl FnOnce(),
        shutdown_resident_owners: impl FnOnce(),
    ) -> ExitRequestedAction {
        let action = self.exit_requested_action(code);
        match action {
            ExitRequestedAction::StayResident => prevent_exit(),
            ExitRequestedAction::Exit => {
                let first_shutdown = {
                    let mut ledger = self
                        .ledger
                        .lock()
                        .unwrap_or_else(std::sync::PoisonError::into_inner);
                    let first = !ledger.shutdown_started;
                    ledger.shutdown_started = true;
                    first
                };
                if first_shutdown {
                    shutdown_resident_owners();
                }
            }
        }
        action
    }

    fn finish_internal_teardown(&self, accepted: bool) {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        ledger.internal_teardowns_in_flight = ledger.internal_teardowns_in_flight.saturating_sub(1);
        // An abandoned request invalidates the batch's last-window prediction:
        // another accepted destroy does not prove the failed window disappeared.
        if !accepted {
            ledger.stay_resident_pending = false;
        }
    }
}

impl InternalWindowTeardown<'_> {
    /// The runtime accepted the destroy request. Keep resident intent until
    /// window recreation or genuine Quit, including delayed/repeated requests.
    pub fn complete(mut self) {
        self.state.finish_internal_teardown(true);
        self.active = false;
    }
}

impl Drop for InternalWindowTeardown<'_> {
    fn drop(&mut self) {
        if self.active {
            self.state.finish_internal_teardown(false);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ExitIntentState, ExitRequestedAction};
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn queued_last_window_destroy_retains_intent_after_success_and_repeated_requests() {
        let state = ExitIntentState::default();
        state.begin_internal_window_teardown(1).complete();

        assert_eq!(
            state.exit_requested_action(None),
            ExitRequestedAction::StayResident
        );
        assert_eq!(
            state.exit_requested_action(None),
            ExitRequestedAction::StayResident
        );
        state.record_window_created();
        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
    }

    #[test]
    fn unmarked_native_exit_requested_without_code_exits() {
        assert_eq!(
            ExitIntentState::default().exit_requested_action(None),
            ExitRequestedAction::Exit
        );
    }

    #[test]
    fn explicit_quit_exits_even_without_an_exit_code() {
        let state = ExitIntentState::default();
        state.record_explicit_exit();

        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
    }

    #[test]
    fn coded_exit_clears_any_pending_resident_intent() {
        for code in [Some(0), Some(1), Some(-1)] {
            let state = ExitIntentState::default();
            state.begin_internal_window_teardown(1).complete();
            assert_eq!(state.exit_requested_action(code), ExitRequestedAction::Exit);
            assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
        }
    }

    #[test]
    fn failed_last_window_teardown_does_not_leave_resident_suppression() {
        let state = ExitIntentState::default();
        drop(state.begin_internal_window_teardown(1));

        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
    }

    #[test]
    fn repeated_background_reopen_and_failed_destroy_withdraw_prediction() {
        let state = ExitIntentState::default();
        for _ in 0..3 {
            // The native registry still reports one after destroy accepted it.
            state.begin_internal_window_teardown(1).complete();
            for _ in 0..2 {
                assert_eq!(
                    state.exit_requested_action(None),
                    ExitRequestedAction::StayResident
                );
            }
            state.record_window_created();
            drop(state.begin_internal_window_teardown(1));
            assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
        }
    }

    #[test]
    fn concurrent_teardowns_only_authorize_residence_for_the_last_window() {
        let state = ExitIntentState::default();
        state.begin_internal_window_teardown(2).complete();
        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
        let first = state.begin_internal_window_teardown(2);
        let last = state.begin_internal_window_teardown(2);
        first.complete();
        last.complete();
        assert_eq!(
            state.exit_requested_action(None),
            ExitRequestedAction::StayResident
        );
        state.record_explicit_exit();
        state.record_window_created();
        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
    }

    #[test]
    fn failed_concurrent_destroy_withdraws_the_batch_prediction_in_either_order() {
        for failure_first in [false, true] {
            let state = ExitIntentState::default();
            let failed = state.begin_internal_window_teardown(2);
            let accepted = state.begin_internal_window_teardown(2);
            if failure_first {
                drop(failed);
                accepted.complete();
            } else {
                accepted.complete();
                drop(failed);
            }
            assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
        }
    }

    #[test]
    fn shutdown_owners_run_only_for_an_exit_decision() {
        let state = ExitIntentState::default();
        let prevented = AtomicUsize::new(0);
        let shutdowns = AtomicUsize::new(0);

        state.begin_internal_window_teardown(1).complete();
        assert_eq!(
            state.dispatch_exit_requested(
                None,
                || {
                    prevented.fetch_add(1, Ordering::SeqCst);
                },
                || {
                    shutdowns.fetch_add(1, Ordering::SeqCst);
                },
            ),
            ExitRequestedAction::StayResident
        );
        assert_eq!(prevented.load(Ordering::SeqCst), 1);
        assert_eq!(shutdowns.load(Ordering::SeqCst), 0);

        state.record_explicit_exit();
        assert_eq!(
            state.dispatch_exit_requested(
                None,
                || {
                    prevented.fetch_add(1, Ordering::SeqCst);
                },
                || {
                    shutdowns.fetch_add(1, Ordering::SeqCst);
                },
            ),
            ExitRequestedAction::Exit
        );
        assert_eq!(prevented.load(Ordering::SeqCst), 1);
        state.dispatch_exit_requested(
            Some(0),
            || panic!("quit prevented"),
            || {
                shutdowns.fetch_add(1, Ordering::SeqCst);
            },
        );
        assert_eq!(shutdowns.load(Ordering::SeqCst), 1);
    }
}
