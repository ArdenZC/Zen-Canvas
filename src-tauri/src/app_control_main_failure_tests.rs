use super::destroy_failed_main_window;
use crate::exit_intent::{ExitIntentState, ExitRequestedAction};

#[test]
fn main_show_focus_failure_marks_last_webview_before_destroy() {
    let intent = ExitIntentState::default();
    destroy_failed_main_window(
        &intent,
        1,
        || {
            assert_eq!(
                intent.exit_requested_action(None),
                ExitRequestedAction::StayResident
            );
            Ok::<_, &str>(())
        },
        || 0,
    )
    .unwrap();
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::Exit
    );
}

#[test]
fn main_cleanup_delayed_native_exit_consumes_intent_once() {
    let intent = ExitIntentState::default();
    destroy_failed_main_window(&intent, 1, || Ok::<_, &str>(()), || 0).unwrap();
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::StayResident
    );
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::Exit
    );
}

#[test]
fn main_cleanup_failure_preserves_error_without_stale_suppression() {
    let intent = ExitIntentState::default();
    let result = destroy_failed_main_window(&intent, 1, || Err("native_destroy_failed"), || 0);
    assert_eq!(result, Err("native_destroy_failed"));
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::Exit
    );
}

#[test]
fn main_cleanup_uses_actual_remaining_webviews() {
    let intent = ExitIntentState::default();
    destroy_failed_main_window(&intent, 1, || Ok::<_, &str>(()), || 1).unwrap();
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::Exit
    );
}

#[test]
fn explicit_quit_overrides_main_failure_cleanup_intent() {
    let intent = ExitIntentState::default();
    destroy_failed_main_window(
        &intent,
        1,
        || {
            intent.record_explicit_exit();
            Ok::<_, &str>(())
        },
        || 0,
    )
    .unwrap();
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::Exit
    );
    assert_eq!(
        intent.exit_requested_action(None),
        ExitRequestedAction::Exit
    );
}
