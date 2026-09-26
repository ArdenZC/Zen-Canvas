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
}

/// Runtime-only state. It is deliberately not persisted or shared with the UI.
#[derive(Default)]
pub struct ExitIntentState {
    ledger: Mutex<ExitIntentLedger>,
}

/// Tracks an internal WebView destruction until it succeeds or is abandoned.
/// The guard also withdraws a predicted last-window suppression if teardown
/// fails or leaves another WebView alive.
pub struct InternalWindowTeardown<'a> {
    state: &'a ExitIntentState,
    webviews_on_abort: usize,
    active: bool,
}

impl ExitIntentState {
    pub fn begin_internal_window_teardown(
        &self,
        current_webview_count: usize,
    ) -> InternalWindowTeardown<'_> {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let next_in_flight = ledger.internal_teardowns_in_flight.saturating_add(1);
        if current_webview_count > 0
            && current_webview_count <= next_in_flight
            && !ledger.explicit_exit_pending
        {
            ledger.stay_resident_pending = true;
        }
        ledger.internal_teardowns_in_flight = next_in_flight;
        InternalWindowTeardown {
            state: self,
            webviews_on_abort: current_webview_count,
            active: true,
        }
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
        let explicit_exit = std::mem::take(&mut ledger.explicit_exit_pending);
        if code.is_some() || explicit_exit {
            ledger.stay_resident_pending = false;
            return ExitRequestedAction::Exit;
        }
        if std::mem::take(&mut ledger.stay_resident_pending) {
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
            ExitRequestedAction::Exit => shutdown_resident_owners(),
        }
        action
    }

    fn finish_internal_teardown(&self, remaining_webviews: usize) {
        let mut ledger = self
            .ledger
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        ledger.internal_teardowns_in_flight = ledger.internal_teardowns_in_flight.saturating_sub(1);
        if remaining_webviews > 0 && ledger.internal_teardowns_in_flight == 0 {
            ledger.stay_resident_pending = false;
        }
    }
}

impl InternalWindowTeardown<'_> {
    /// Complete after the native destroy call returns, passing the current
    /// WebView count so concurrent internal teardowns remain coordinated.
    pub fn complete(mut self, remaining_webviews: usize) {
        self.state.finish_internal_teardown(remaining_webviews);
        self.active = false;
    }
}

impl Drop for InternalWindowTeardown<'_> {
    fn drop(&mut self) {
        if self.active {
            self.state.finish_internal_teardown(self.webviews_on_abort);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ExitIntentState, ExitRequestedAction};
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn successful_last_window_teardown_consumes_one_resident_intent() {
        let state = ExitIntentState::default();
        state.begin_internal_window_teardown(1).complete(0);

        assert_eq!(
            state.exit_requested_action(None),
            ExitRequestedAction::StayResident
        );
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
            state.begin_internal_window_teardown(1).complete(0);
            assert_eq!(state.exit_requested_action(code), ExitRequestedAction::Exit);
            assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
        }
    }

    #[test]
    fn failed_last_window_teardown_does_not_leave_resident_suppression() {
        let state = ExitIntentState::default();
        state.begin_internal_window_teardown(1).complete(1);

        assert_eq!(state.exit_requested_action(None), ExitRequestedAction::Exit);
    }

    #[test]
    fn shutdown_owners_run_only_for_an_exit_decision() {
        let state = ExitIntentState::default();
        let prevented = AtomicUsize::new(0);
        let shutdowns = AtomicUsize::new(0);

        state.begin_internal_window_teardown(1).complete(0);
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
        assert_eq!(shutdowns.load(Ordering::SeqCst), 1);
    }
}
