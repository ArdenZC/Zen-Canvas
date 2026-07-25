from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "src-tauri/src/ai/classification.rs"
text = PATH.read_text(encoding="utf-8")


def replace_regex(pattern: str, replacement: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"expected one match, found {count}: {pattern}")


replace_regex(
    r'''#\[tauri::command\]\npub async fn classify_files_with_ai<R: Runtime>\(.*?\n\}\n\n(?=#\[tauri::command\]\npub async fn classify_selected_files_with_ai)''',
    r'''#[tauri::command]
pub async fn classify_files_with_ai<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    _app: AppHandle<R>,
    cancellation: State<'_, AIClassificationCancellationToken>,
    scope: LibraryScope,
    options: Option<AIClassificationOptions>,
) -> Result<RuleExecutionSummary, String> {
    require_main_window(&window)?;
    let guard = cancellation.begin()?;
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        if !settings.enabled {
            return Err("AI classification is disabled.".to_string());
        }
        if settings.provider == AIProviderKind::OpenAICompatible
            && settings.api_key.trim().is_empty()
        {
            return Err("Cloud AI credentials are required.".to_string());
        }
        let force = options
            .as_ref()
            .and_then(|options| options.force)
            .unwrap_or(false);
        let targets = collect_ai_classification_targets(&db, &scope, options.as_ref(), &settings)
            .map_err(string_error)?;
        db.enqueue_legacy_targets_for_managed_ai(&targets, force)
            .map_err(string_error)
    })
    .await
    .map_err(|error| error.to_string())?
}

''',
)

replace_regex(
    r'''#\[tauri::command\]\npub async fn classify_selected_files_with_ai<R: Runtime>\(.*?\n\}\n\n(?=#\[tauri::command\]\npub fn cancel_ai_classification)''',
    r'''#[tauri::command]
pub async fn classify_selected_files_with_ai<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    _app: AppHandle<R>,
    cancellation: State<'_, AIClassificationCancellationToken>,
    file_ids: Vec<String>,
) -> Result<RuleExecutionSummary, String> {
    require_main_window(&window)?;
    let guard = cancellation.begin()?;
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        if !settings.enabled {
            return Err("AI classification is disabled.".to_string());
        }
        if settings.provider == AIProviderKind::OpenAICompatible
            && settings.api_key.trim().is_empty()
        {
            return Err("Cloud AI credentials are required.".to_string());
        }
        let targets =
            collect_selected_ai_classification_targets(&db, &file_ids).map_err(string_error)?;
        db.enqueue_legacy_targets_for_managed_ai(&targets, true)
            .map_err(string_error)
    })
    .await
    .map_err(|error| error.to_string())?
}

''',
)

replace_regex(
    r'''#\[tauri::command\]\npub fn cancel_ai_classification<R: Runtime>\(.*?\n\}\n''',
    r'''#[tauri::command]
pub fn cancel_ai_classification<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    cancellation: State<'_, AIClassificationCancellationToken>,
) -> Result<(), String> {
    require_main_window(&window)?;
    cancellation.cancel.store(true, Ordering::SeqCst);
    db.cancel_managed_ai_queue()
        .map(|_| ())
        .map_err(|error| error.to_string())
}
''',
)

PATH.write_text(text, encoding="utf-8")
print("Routed legacy AI commands through the persistent Managed AI queue")
