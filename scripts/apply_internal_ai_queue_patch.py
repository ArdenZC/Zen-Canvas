from __future__ import annotations

from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "src-tauri/src/ai/classification.rs"
text = path.read_text(encoding="utf-8")

pattern = r'''pub async fn classify_files_with_ai_for_db\(.*?\n\}\n\npub async fn classify_selected_files_with_ai_for_db\(.*?\n\}\n'''
replacement = r'''pub async fn classify_files_with_ai_for_db(
    db: Database,
    scope: LibraryScope,
    options: Option<AIClassificationOptions>,
) -> Result<RuleExecutionSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        if !settings.enabled {
            return Err("AI classification is disabled.".to_string());
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

pub async fn classify_selected_files_with_ai_for_db(
    db: Database,
    file_ids: Vec<String>,
) -> Result<RuleExecutionSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        if !settings.enabled {
            return Err("AI classification is disabled.".to_string());
        }
        let targets =
            collect_selected_ai_classification_targets(&db, &file_ids).map_err(string_error)?;
        db.enqueue_legacy_targets_for_managed_ai(&targets, true)
            .map_err(string_error)
    })
    .await
    .map_err(|error| error.to_string())?
}
'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise RuntimeError(f"expected one internal helper block, found {count}")
path.write_text(text, encoding="utf-8")
print("Routed internal AI helpers through the Managed AI queue")
