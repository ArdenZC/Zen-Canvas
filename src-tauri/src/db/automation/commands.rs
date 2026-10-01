use super::types::*;
use crate::db::Database;
use crate::window_auth::require_main_window;
use tauri::{Runtime, State, WebviewWindow};

#[tauri::command]
pub fn list_automation_intents<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
) -> Result<Vec<AutomationIntentV1>, String> {
    require_main_window(&window)?;
    db.list_automation_intents()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_automation_intent<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    intent_id: String,
) -> Result<AutomationIntentV1, String> {
    require_main_window(&window)?;
    db.get_automation_intent(&intent_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_automation_runs<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    intent_id: Option<String>,
) -> Result<Vec<AutomationRunV1>, String> {
    require_main_window(&window)?;
    db.list_automation_runs(intent_id.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_automation_intent<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    draft: AutomationIntentDraftV1,
) -> Result<AutomationIntentV1, String> {
    require_main_window(&window)?;
    db.create_automation_intent(draft)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_automation_intent<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: AutomationIntentUpdateV1,
) -> Result<AutomationIntentV1, String> {
    require_main_window(&window)?;
    db.update_automation_intent(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_automation_intent_enabled<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: AutomationIntentEnabledV1,
) -> Result<AutomationIntentV1, String> {
    require_main_window(&window)?;
    db.set_automation_intent_enabled(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn archive_automation_intent<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: AutomationIntentRevisionV1,
) -> Result<AutomationIntentV1, String> {
    require_main_window(&window)?;
    db.archive_automation_intent(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn run_automation_intent_manual<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: RunAutomationIntentV1,
) -> Result<AutomationRunV1, String> {
    require_main_window(&window)?;
    db.run_automation_intent_manual(request)
        .map_err(|error| error.to_string())
}
