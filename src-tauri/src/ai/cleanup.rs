use std::{collections::HashMap, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};

use super::{
    ollama::OllamaProvider,
    openai_compatible::OpenAICompatibleProvider,
    prompts::{
        ai_cleanup_analysis_system_prompt,
        build_ai_cleanup_analysis_prompt as build_ai_cleanup_analysis_prompt_body,
    },
    provider::AIProvider,
    schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderOptions},
    settings::{get_ai_settings_for_db, normalize_ai_settings, AISettings},
};
use crate::{
    db::Database,
    storage_analyzer::{CleanupActionKind, CleanupTier, StorageCandidate, StorageCleanupState},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AICleanupInputCandidate {
    pub candidate_id: String,
    pub name: String,
    pub parent_name: Option<String>,
    pub path: Option<String>,
    pub size: u64,
    pub tier: String,
    pub category: String,
    pub reason: String,
    pub suggested_action: String,
    pub risk_note: Option<String>,
    pub trash_allowed: bool,
    pub selected_by_default: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AICleanupAnalysisOutput {
    pub candidate_id: String,
    pub tier: Option<String>,
    pub category: Option<String>,
    pub suggested_action: Option<String>,
    pub confidence: Option<f64>,
    pub reason: Option<String>,
    pub risk_note: Option<String>,
    pub trash_allowed: Option<bool>,
    pub selected_by_default: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AICleanupAnalysisResponse {
    analyses: Vec<AICleanupAnalysisOutput>,
}

#[tauri::command]
pub async fn analyze_cleanup_candidates_with_ai<R: Runtime>(
    ids: Vec<String>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    state: State<'_, StorageCleanupState>,
) -> Result<Vec<StorageCandidate>, String> {
    let app_data_dir = app.path().app_data_dir().ok();
    let db = db.inner().clone();
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings =
            normalize_ai_settings(get_ai_settings_for_db(&db).map_err(|error| error.to_string())?);
        let candidates = state.candidates_by_id(&ids)?;
        let updated = analyze_cleanup_candidates_with_configured_provider(
            candidates,
            &settings,
            app_data_dir,
        )?;
        state.update_candidates(&updated)?;
        Ok(updated)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn analyze_cleanup_candidates_with_configured_provider(
    candidates: Vec<StorageCandidate>,
    settings: &AISettings,
    app_data_dir: Option<PathBuf>,
) -> Result<Vec<StorageCandidate>, String> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }
    if !settings.enabled {
        return Err("AI cleanup analysis is disabled because AI is not enabled.".to_string());
    }
    if !settings.cleanup_ai_enabled {
        return Err("AI cleanup analysis is disabled in AI settings.".to_string());
    }
    let provider: Box<dyn AIProvider> = match settings.provider {
        AIProviderKind::OpenAICompatible => {
            Box::new(OpenAICompatibleProvider::new(settings.clone()))
        }
        AIProviderKind::Ollama => Box::new(OllamaProvider::new(settings.clone())),
    };
    analyze_cleanup_candidates_with_provider(candidates, settings, provider.as_ref(), app_data_dir)
}

fn analyze_cleanup_candidates_with_provider(
    candidates: Vec<StorageCandidate>,
    settings: &AISettings,
    provider: &dyn AIProvider,
    app_data_dir: Option<PathBuf>,
) -> Result<Vec<StorageCandidate>, String> {
    let mut updated_by_id = HashMap::new();
    let batch_size = settings.batch_size.max(1);
    for batch in candidates.chunks(batch_size) {
        let content = call_ai_cleanup_provider(provider, settings, batch)?;
        let outputs = parse_ai_cleanup_analysis_response(&content)?;
        for output in outputs {
            if batch
                .iter()
                .any(|candidate| candidate.id == output.candidate_id)
            {
                updated_by_id.insert(output.candidate_id.clone(), output);
            }
        }
    }
    Ok(merge_ai_cleanup_results(
        &candidates,
        &updated_by_id,
        app_data_dir.as_ref(),
    ))
}

fn call_ai_cleanup_provider(
    provider: &dyn AIProvider,
    settings: &AISettings,
    candidates: &[StorageCandidate],
) -> Result<String, String> {
    let messages = build_ai_cleanup_analysis_prompt(candidates, settings)?;
    provider
        .chat_json(AIChatRequest {
            messages,
            model: settings.model.clone(),
            temperature: settings.temperature,
            max_tokens: settings.max_tokens,
            force_json: settings.force_json_output,
            provider_options: AIProviderOptions {
                enable_thinking: Some(settings.enable_thinking),
                reasoning_effort: settings.reasoning_effort.clone(),
                extra_body_json: None,
                use_response_format: None,
            },
        })
        .map_err(|error| sanitize_ai_cleanup_error(error.to_string(), &settings.api_key))
}

pub(crate) fn build_ai_cleanup_analysis_prompt(
    candidates: &[StorageCandidate],
    settings: &AISettings,
) -> Result<Vec<AIChatMessage>, String> {
    let input = candidates
        .iter()
        .map(|candidate| ai_cleanup_input_candidate(candidate, settings))
        .collect::<Vec<_>>();
    Ok(vec![
        AIChatMessage {
            role: "system".to_string(),
            content: ai_cleanup_analysis_system_prompt(settings.enable_thinking),
        },
        AIChatMessage {
            role: "user".to_string(),
            content: build_ai_cleanup_analysis_prompt_body(&input)?,
        },
    ])
}

fn ai_cleanup_input_candidate(
    candidate: &StorageCandidate,
    settings: &AISettings,
) -> AICleanupInputCandidate {
    let _send_file_content_ignored = settings.send_file_content;
    AICleanupInputCandidate {
        candidate_id: candidate.id.clone(),
        name: candidate.name.clone(),
        parent_name: settings
            .send_parent_path
            .then(|| parent_name(&candidate.path))
            .filter(|value| !value.is_empty()),
        path: settings.send_full_path.then(|| candidate.path.clone()),
        size: candidate.size,
        tier: tier_to_string(&candidate.tier).to_string(),
        category: candidate.category.clone(),
        reason: candidate.reason.clone(),
        suggested_action: action_to_string(&candidate.suggested_action).to_string(),
        risk_note: candidate.risk_note.clone(),
        trash_allowed: candidate.trash_allowed,
        selected_by_default: candidate.selected_by_default,
    }
}

pub(crate) fn parse_ai_cleanup_analysis_response(
    content: &str,
) -> Result<Vec<AICleanupAnalysisOutput>, String> {
    match serde_json::from_str::<AICleanupAnalysisResponse>(content) {
        Ok(response) => Ok(response.analyses),
        Err(first_error) => {
            let Some(object) = extract_first_json_object(content) else {
                return Err(format!(
                    "AI cleanup analysis response is not valid JSON: {first_error}"
                ));
            };
            serde_json::from_str::<AICleanupAnalysisResponse>(&object)
                .map(|response| response.analyses)
                .map_err(|error| {
                    format!(
                        "AI cleanup analysis response JSON did not match expected schema: {error}"
                    )
                })
        }
    }
}

fn merge_ai_cleanup_results(
    candidates: &[StorageCandidate],
    outputs_by_id: &HashMap<String, AICleanupAnalysisOutput>,
    app_data_dir: Option<&PathBuf>,
) -> Vec<StorageCandidate> {
    candidates
        .iter()
        .map(|candidate| match outputs_by_id.get(&candidate.id) {
            Some(output) => merge_ai_cleanup_analysis(candidate, output, app_data_dir),
            None => candidate.clone(),
        })
        .collect()
}

pub(crate) fn merge_ai_cleanup_analysis(
    original: &StorageCandidate,
    ai_result: &AICleanupAnalysisOutput,
    app_data_dir: Option<&PathBuf>,
) -> StorageCandidate {
    if ai_result.candidate_id != original.id {
        return original.clone();
    }

    let safety = CleanupPathSafety::from_candidate(original, app_data_dir);
    let mut merged = original.clone();
    if let Some(category) = sanitized_text(ai_result.category.as_deref(), 120) {
        merged.category = category;
    }
    if let Some(reason) = sanitized_text(ai_result.reason.as_deref(), 600) {
        merged.reason = reason;
    }
    if let Some(risk_note) = sanitized_text(ai_result.risk_note.as_deref(), 600) {
        merged.risk_note = Some(risk_note);
    }
    let _confidence = ai_result.confidence.unwrap_or(0.0).clamp(0.0, 1.0);

    let proposed_tier = ai_result
        .tier
        .as_deref()
        .and_then(parse_cleanup_tier)
        .unwrap_or_else(|| original.tier.clone());
    merged.tier = more_conservative_tier(&original.tier, &proposed_tier);
    if safety.force_caution {
        merged.tier = CleanupTier::Caution;
    } else if safety.force_review && merged.tier == CleanupTier::Safe {
        merged.tier = CleanupTier::Review;
    }

    let proposed_action = ai_result
        .suggested_action
        .as_deref()
        .and_then(parse_cleanup_action)
        .unwrap_or_else(|| original.suggested_action.clone());
    merged.suggested_action = conservative_action(original, proposed_action, &merged.tier, &safety);

    let proposed_trash_allowed = ai_result.trash_allowed.unwrap_or(original.trash_allowed);
    merged.trash_allowed = original.trash_allowed
        && proposed_trash_allowed
        && merged.tier == CleanupTier::Safe
        && merged.suggested_action == CleanupActionKind::MoveToTrash
        && !safety.prevent_trash;

    if !merged.trash_allowed && merged.suggested_action == CleanupActionKind::MoveToTrash {
        merged.suggested_action = fallback_non_trash_action(original, &safety);
    }

    let proposed_selected = ai_result
        .selected_by_default
        .unwrap_or(original.selected_by_default);
    merged.selected_by_default = original.selected_by_default
        && proposed_selected
        && merged.tier == CleanupTier::Safe
        && merged.trash_allowed
        && !safety.prevent_selected;
    if merged.tier == CleanupTier::Caution {
        merged.selected_by_default = false;
    }

    merged
}

fn conservative_action(
    original: &StorageCandidate,
    proposed: CleanupActionKind,
    final_tier: &CleanupTier,
    safety: &CleanupPathSafety,
) -> CleanupActionKind {
    if proposed == CleanupActionKind::MoveToTrash {
        if safety.prevent_trash || *final_tier != CleanupTier::Safe {
            return fallback_non_trash_action(original, safety);
        }
        if !original.trash_allowed {
            return original.suggested_action.clone();
        }
        if matches!(
            original.suggested_action,
            CleanupActionKind::None
                | CleanupActionKind::AppInternalCleanup
                | CleanupActionKind::UninstallAdvice
        ) {
            return original.suggested_action.clone();
        }
        if original.suggested_action == CleanupActionKind::Reveal && !original.trash_allowed {
            return CleanupActionKind::Reveal;
        }
    }
    proposed
}

fn fallback_non_trash_action(
    original: &StorageCandidate,
    safety: &CleanupPathSafety,
) -> CleanupActionKind {
    if matches!(
        original.suggested_action,
        CleanupActionKind::None
            | CleanupActionKind::Reveal
            | CleanupActionKind::UninstallAdvice
            | CleanupActionKind::AppInternalCleanup
    ) {
        return original.suggested_action.clone();
    }
    if safety.system_path {
        CleanupActionKind::None
    } else {
        CleanupActionKind::Reveal
    }
}

#[derive(Debug, Clone, Default)]
struct CleanupPathSafety {
    force_caution: bool,
    force_review: bool,
    prevent_trash: bool,
    prevent_selected: bool,
    system_path: bool,
}

impl CleanupPathSafety {
    fn from_candidate(candidate: &StorageCandidate, app_data_dir: Option<&PathBuf>) -> Self {
        let lower = normalize_path_text(&candidate.path).to_ascii_lowercase();
        let extension = lower
            .rsplit_once('.')
            .map(|(_, extension)| extension)
            .unwrap_or_default();
        let system_path = is_system_path_text(&lower);
        let program_files = is_program_files_path_text(&lower);
        let program_data = lower.contains("/programdata/");
        let app_data = is_appdata_path_text(&lower);
        let browser_profile = is_browser_profile_path_text(&lower);
        let chat_database = is_chat_database_path_text(&lower, extension);
        let database = is_database_extension(extension);
        let vm_image = is_virtual_machine_image(extension);
        let app_internal = app_data_dir
            .map(|dir| is_same_or_child_text(&lower, &normalize_path_text(&dir.to_string_lossy())))
            .unwrap_or(false);
        let force_caution = system_path
            || program_files
            || program_data
            || browser_profile
            || chat_database
            || database
            || vm_image
            || app_internal;
        let force_review = app_data;
        let prevent_trash = force_caution || app_data;
        let prevent_selected = force_caution || app_data;
        Self {
            force_caution,
            force_review,
            prevent_trash,
            prevent_selected,
            system_path,
        }
    }
}

fn parse_cleanup_tier(value: &str) -> Option<CleanupTier> {
    match value.trim() {
        "Safe" => Some(CleanupTier::Safe),
        "Review" => Some(CleanupTier::Review),
        "Caution" => Some(CleanupTier::Caution),
        _ => None,
    }
}

fn parse_cleanup_action(value: &str) -> Option<CleanupActionKind> {
    match value.trim() {
        "MoveToTrash" => Some(CleanupActionKind::MoveToTrash),
        "Reveal" => Some(CleanupActionKind::Reveal),
        "UninstallAdvice" => Some(CleanupActionKind::UninstallAdvice),
        "AppInternalCleanup" => Some(CleanupActionKind::AppInternalCleanup),
        "None" => Some(CleanupActionKind::None),
        _ => None,
    }
}

fn more_conservative_tier(original: &CleanupTier, proposed: &CleanupTier) -> CleanupTier {
    if tier_rank(proposed) > tier_rank(original) {
        proposed.clone()
    } else {
        original.clone()
    }
}

fn tier_rank(tier: &CleanupTier) -> u8 {
    match tier {
        CleanupTier::Safe => 0,
        CleanupTier::Review => 1,
        CleanupTier::Caution => 2,
    }
}

fn tier_to_string(tier: &CleanupTier) -> &'static str {
    match tier {
        CleanupTier::Safe => "Safe",
        CleanupTier::Review => "Review",
        CleanupTier::Caution => "Caution",
    }
}

fn action_to_string(action: &CleanupActionKind) -> &'static str {
    match action {
        CleanupActionKind::MoveToTrash => "MoveToTrash",
        CleanupActionKind::Reveal => "Reveal",
        CleanupActionKind::UninstallAdvice => "UninstallAdvice",
        CleanupActionKind::AppInternalCleanup => "AppInternalCleanup",
        CleanupActionKind::None => "None",
    }
}

fn sanitized_text(value: Option<&str>, limit: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(limit).collect())
}

fn parent_name(path: &str) -> String {
    let normalized = normalize_path_text(path);
    normalized
        .rsplit_once('/')
        .and_then(|(parent, _)| parent.rsplit('/').next())
        .unwrap_or_default()
        .to_string()
}

fn normalize_path_text(path: &str) -> String {
    path.replace('\\', "/")
}

fn is_same_or_child_text(path: &str, parent: &str) -> bool {
    let path = path.trim_end_matches('/');
    let parent = parent.trim_end_matches('/').to_ascii_lowercase();
    path == parent || path.starts_with(&format!("{parent}/"))
}

fn is_system_path_text(lower: &str) -> bool {
    lower.contains("/windows/")
        || lower.ends_with("/windows")
        || lower.contains("/windows/system32/")
        || lower.contains("/system volume information/")
        || lower.contains("/$recycle.bin/")
}

fn is_program_files_path_text(lower: &str) -> bool {
    lower.contains("/program files/") || lower.contains("/program files (x86)/")
}

fn is_appdata_path_text(lower: &str) -> bool {
    lower.contains("/appdata/local/")
        || lower.contains("/appdata/roaming/")
        || lower.contains("/appdata/locallow/")
}

fn is_browser_profile_path_text(lower: &str) -> bool {
    (lower.contains("/google/chrome/user data")
        || lower.contains("/microsoft/edge/user data")
        || lower.contains("/mozilla/firefox/profiles"))
        && !lower.contains("/cache/")
}

fn is_chat_database_path_text(lower: &str, extension: &str) -> bool {
    (lower.contains("wechat") || lower.contains("/qq/") || lower.contains("tencent"))
        && is_database_extension(extension)
}

fn is_database_extension(extension: &str) -> bool {
    matches!(extension, "db" | "sqlite" | "sqlite3" | "mdb" | "accdb")
}

fn is_virtual_machine_image(extension: &str) -> bool {
    matches!(
        extension,
        "vmdk" | "vhd" | "vhdx" | "qcow2" | "ova" | "avhdx"
    )
}

fn extract_first_json_object(content: &str) -> Option<String> {
    let mut start = None;
    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;
    for (index, ch) in content.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }
        match ch {
            '"' => in_string = true,
            '{' => {
                if start.is_none() {
                    start = Some(index);
                }
                depth += 1;
            }
            '}' => {
                if depth > 0 {
                    depth -= 1;
                    if depth == 0 {
                        let start = start?;
                        return Some(content[start..=index].to_string());
                    }
                }
            }
            _ => {}
        }
    }
    None
}

fn sanitize_ai_cleanup_error(message: String, api_key: &str) -> String {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        message
    } else {
        message.replace(api_key, "[redacted]")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ai_cannot_make_trash_disallowed_candidate_allowed() {
        let original = review_candidate("c1", "D:/Downloads/movie.mkv");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert!(!merged.trash_allowed);
        assert_ne!(merged.suggested_action, CleanupActionKind::MoveToTrash);
    }

    #[test]
    fn ai_cannot_upgrade_caution_to_safe() {
        let original = caution_candidate("c1", "D:/VMs/demo.vhdx");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Caution);
        assert!(!merged.trash_allowed);
    }

    #[test]
    fn caution_cannot_be_selected_by_default() {
        let original = caution_candidate("c1", "D:/data/app.db");
        let mut output = move_to_trash_output("c1");
        output.selected_by_default = Some(true);
        let merged = merge_ai_cleanup_analysis(&original, &output, None);
        assert!(!merged.selected_by_default);
    }

    #[test]
    fn program_files_cannot_move_to_trash() {
        let original = safe_candidate("c1", "C:/Program Files/App/cache");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Caution);
        assert_ne!(merged.suggested_action, CleanupActionKind::MoveToTrash);
        assert!(!merged.trash_allowed);
    }

    #[test]
    fn windows_path_cannot_move_to_trash() {
        let original = safe_candidate("c1", "C:/Windows/Temp/demo.tmp");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Caution);
        assert_ne!(merged.suggested_action, CleanupActionKind::MoveToTrash);
    }

    #[test]
    fn appdata_cannot_be_selected_by_default() {
        let original = safe_candidate("c1", "C:/Users/me/AppData/Local/App/cache");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Review);
        assert!(!merged.selected_by_default);
    }

    #[test]
    fn browser_profile_stays_caution() {
        let original = caution_candidate(
            "c1",
            "C:/Users/me/AppData/Local/Google/Chrome/User Data/Default",
        );
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Caution);
        assert!(!merged.trash_allowed);
    }

    #[test]
    fn database_file_stays_caution() {
        let original = caution_candidate("c1", "D:/data/prod.sqlite3");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Caution);
    }

    #[test]
    fn virtual_machine_image_stays_caution() {
        let original = caution_candidate("c1", "D:/VMs/demo.qcow2");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Caution);
    }

    #[test]
    fn node_modules_can_remain_safe() {
        let original = safe_candidate("c1", "D:/Projects/demo/node_modules");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Safe);
        assert_eq!(merged.suggested_action, CleanupActionKind::MoveToTrash);
        assert!(merged.trash_allowed);
    }

    #[test]
    fn node_modules_can_receive_risk_note() {
        let original = safe_candidate("c1", "D:/Projects/demo/node_modules");
        let mut output = move_to_trash_output("c1");
        output.risk_note = Some("Check npm link and local patches first.".to_string());
        let merged = merge_ai_cleanup_analysis(&original, &output, None);
        assert_eq!(
            merged.risk_note.as_deref(),
            Some("Check npm link and local patches first.")
        );
    }

    #[test]
    fn unknown_large_item_stays_review() {
        let original = review_candidate("c1", "D:/Downloads/archive.bin");
        let merged = merge_ai_cleanup_analysis(&original, &move_to_trash_output("c1"), None);
        assert_eq!(merged.tier, CleanupTier::Review);
        assert!(!merged.trash_allowed);
    }

    #[test]
    fn illegal_candidate_id_is_ignored() {
        let original = safe_candidate("c1", "D:/Projects/demo/node_modules");
        let mut outputs = HashMap::new();
        outputs.insert("other".to_string(), move_to_trash_output("other"));
        let merged = merge_ai_cleanup_results(&[original.clone()], &outputs, None);
        assert_eq!(merged[0].id, original.id);
        assert_eq!(merged[0].reason, original.reason);
    }

    #[test]
    fn illegal_enum_falls_back_to_original() {
        let original = safe_candidate("c1", "D:/Projects/demo/node_modules");
        let mut output = move_to_trash_output("c1");
        output.tier = Some("Danger".to_string());
        output.suggested_action = Some("DeleteNow".to_string());
        let merged = merge_ai_cleanup_analysis(&original, &output, None);
        assert_eq!(merged.tier, CleanupTier::Safe);
        assert_eq!(merged.suggested_action, CleanupActionKind::MoveToTrash);
    }

    #[test]
    fn api_key_is_redacted_from_errors() {
        let message = sanitize_ai_cleanup_error(
            "Provider rejected key sk-cleanup-secret".to_string(),
            "sk-cleanup-secret",
        );
        assert!(!message.contains("sk-cleanup-secret"));
        assert!(message.contains("[redacted]"));
    }

    fn safe_candidate(id: &str, path: &str) -> StorageCandidate {
        candidate(
            id,
            path,
            CleanupTier::Safe,
            CleanupActionKind::MoveToTrash,
            true,
            true,
        )
    }

    fn review_candidate(id: &str, path: &str) -> StorageCandidate {
        candidate(
            id,
            path,
            CleanupTier::Review,
            CleanupActionKind::Reveal,
            false,
            false,
        )
    }

    fn caution_candidate(id: &str, path: &str) -> StorageCandidate {
        candidate(
            id,
            path,
            CleanupTier::Caution,
            CleanupActionKind::Reveal,
            false,
            false,
        )
    }

    fn candidate(
        id: &str,
        path: &str,
        tier: CleanupTier,
        suggested_action: CleanupActionKind,
        trash_allowed: bool,
        selected_by_default: bool,
    ) -> StorageCandidate {
        StorageCandidate {
            id: id.to_string(),
            path: path.to_string(),
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            size: 820_000_000,
            tier,
            category: "Original category".to_string(),
            reason: "Original reason.".to_string(),
            suggested_action,
            risk_note: Some("Original risk.".to_string()),
            trash_allowed,
            selected_by_default,
        }
    }

    fn move_to_trash_output(id: &str) -> AICleanupAnalysisOutput {
        AICleanupAnalysisOutput {
            candidate_id: id.to_string(),
            tier: Some("Safe".to_string()),
            category: Some("AI category".to_string()),
            suggested_action: Some("MoveToTrash".to_string()),
            confidence: Some(0.95),
            reason: Some("AI reason.".to_string()),
            risk_note: Some("AI risk.".to_string()),
            trash_allowed: Some(true),
            selected_by_default: Some(true),
        }
    }
}
