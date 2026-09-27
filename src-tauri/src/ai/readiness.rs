use serde::{Deserialize, Serialize};

use super::{
    schema::{AIProviderKind, AIProviderPresetId},
    settings::{
        get_ai_settings_for_db_with_revision, get_ai_settings_with_store_and_revision,
        normalize_ai_settings, validate_ai_settings, AISettings, CredentialStore,
        SystemCredentialStore,
    },
};
use crate::{content::ContentScopePolicyDto, db::Database, global_index::ManagedScope};
use rusqlite::{params, OptionalExtension};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AIReadinessState {
    Ready,
    Disabled,
    NeedsProvider,
    NeedsCredential,
    NeedsConsent,
    ScopeMissing,
    ScopeDisabled,
    PolicyBlocked,
    TemporarilyUnavailable,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AIProviderMode {
    Local,
    Cloud,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AIDataDisclosure {
    pub sends_file_name: bool,
    pub sends_parent_path: bool,
    pub sends_full_path: bool,
    pub sends_file_content: bool,
    pub content_is_bounded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderReadiness {
    pub state: AIReadinessState,
    pub reason: String,
    pub provider_mode: Option<AIProviderMode>,
    pub provider_kind: Option<AIProviderKind>,
    pub provider_preset: Option<AIProviderPresetId>,
    pub model: Option<String>,
    pub credential_required: bool,
    pub credential_configured: bool,
    pub settings_revision: Option<String>,
    pub binding_fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManagedAIReadiness {
    pub state: AIReadinessState,
    pub reason: String,
    pub provider: AIProviderReadiness,
    pub managed_scope_id: String,
    pub scope_fingerprint: Option<String>,
    pub binding_fingerprint: String,
    pub disclosure: AIDataDisclosure,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContentPolicyBinding {
    pub root_id: String,
    pub root_revision: i64,
    pub policy_revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContentAIReadiness {
    pub state: AIReadinessState,
    pub reason: String,
    pub provider: AIProviderReadiness,
    pub root_ids: Vec<String>,
    pub policy_bindings: Vec<ContentPolicyBinding>,
    pub policy_fingerprint: Option<String>,
    pub binding_fingerprint: String,
    pub disclosure: AIDataDisclosure,
    pub requires_run_confirmation: bool,
}

#[derive(Debug, Clone)]
struct ProviderSnapshot {
    readiness: AIProviderReadiness,
    settings: Option<AISettings>,
}

fn fingerprint(parts: &[String]) -> String {
    let mut hasher = blake3::Hasher::new();
    for part in parts {
        hasher.update(&(part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    hasher.finalize().to_hex().to_string()
}

fn provider_mode(provider: AIProviderKind) -> AIProviderMode {
    match provider {
        AIProviderKind::Ollama => AIProviderMode::Local,
        AIProviderKind::OpenAICompatible => AIProviderMode::Cloud,
    }
}

fn provider_kind_wire(provider: AIProviderKind) -> &'static str {
    match provider {
        AIProviderKind::Ollama => "ollama",
        AIProviderKind::OpenAICompatible => "openai_compatible",
    }
}

fn preset_wire(preset: AIProviderPresetId) -> String {
    serde_json::to_value(preset)
        .ok()
        .and_then(|value| value.as_str().map(ToString::to_string))
        .unwrap_or_else(|| "unknown".to_string())
}

fn provider_error(reason: &str) -> AIProviderReadiness {
    let binding_fingerprint = fingerprint(&["provider_error".into(), reason.into()]);
    AIProviderReadiness {
        state: AIReadinessState::Error,
        reason: reason.to_string(),
        provider_mode: None,
        provider_kind: None,
        provider_preset: None,
        model: None,
        credential_required: false,
        credential_configured: false,
        settings_revision: None,
        binding_fingerprint,
    }
}

fn provider_snapshot_from_settings(
    mut settings: AISettings,
    settings_revision: String,
) -> ProviderSnapshot {
    settings = normalize_ai_settings(settings);
    let mode = provider_mode(settings.provider);
    let credential_required = settings.provider == AIProviderKind::OpenAICompatible;
    let credential_configured = settings.api_key_configured || !settings.api_key.trim().is_empty();
    let configuration_error = if settings.model.trim().is_empty() {
        Some("provider_model_missing")
    } else if validate_ai_settings(&settings, !cfg!(debug_assertions)).is_err() {
        Some("provider_configuration_invalid")
    } else {
        None
    };

    let (state, reason) = if !settings.enabled {
        (AIReadinessState::Disabled, "provider_disabled")
    } else if let Some(reason) = configuration_error {
        (AIReadinessState::NeedsProvider, reason)
    } else if credential_required && !credential_configured {
        (
            AIReadinessState::NeedsCredential,
            "provider_credential_required",
        )
    } else {
        (AIReadinessState::Ready, "provider_configuration_ready")
    };

    let binding_fingerprint = fingerprint(&[
        settings_revision.clone(),
        provider_kind_wire(settings.provider).into(),
        preset_wire(settings.preset),
        settings.model.trim().into(),
        credential_required.to_string(),
        credential_configured.to_string(),
        state_wire(state).into(),
    ]);

    let readiness = AIProviderReadiness {
        state,
        reason: reason.to_string(),
        provider_mode: Some(mode),
        provider_kind: Some(settings.provider),
        provider_preset: Some(settings.preset),
        model: Some(settings.model.clone()),
        credential_required,
        credential_configured,
        settings_revision: Some(settings_revision),
        binding_fingerprint,
    };
    ProviderSnapshot {
        readiness,
        settings: Some(settings),
    }
}

fn provider_snapshot_with_store(
    db: &Database,
    credentials: &impl CredentialStore,
) -> ProviderSnapshot {
    match get_ai_settings_with_store_and_revision(db, credentials) {
        Ok((settings, revision)) => provider_snapshot_from_settings(settings, revision),
        Err(_) => ProviderSnapshot {
            readiness: provider_error("provider_settings_unavailable"),
            settings: None,
        },
    }
}

fn state_wire(state: AIReadinessState) -> &'static str {
    match state {
        AIReadinessState::Ready => "ready",
        AIReadinessState::Disabled => "disabled",
        AIReadinessState::NeedsProvider => "needs_provider",
        AIReadinessState::NeedsCredential => "needs_credential",
        AIReadinessState::NeedsConsent => "needs_consent",
        AIReadinessState::ScopeMissing => "scope_missing",
        AIReadinessState::ScopeDisabled => "scope_disabled",
        AIReadinessState::PolicyBlocked => "policy_blocked",
        AIReadinessState::TemporarilyUnavailable => "temporarily_unavailable",
        AIReadinessState::Error => "error",
    }
}

pub fn provider_readiness(db: &Database) -> AIProviderReadiness {
    match get_ai_settings_for_db_with_revision(db) {
        Ok((settings, revision)) => provider_snapshot_from_settings(settings, revision).readiness,
        Err(_) => provider_error("provider_settings_unavailable"),
    }
}

fn managed_scope_fingerprint(scope: &ManagedScope) -> String {
    fingerprint(&[
        scope.id.clone(),
        scope.path.clone(),
        scope.global_entry_id.clone().unwrap_or_default(),
        scope.enabled.to_string(),
        scope.allow_local_ai.to_string(),
        scope.allow_cloud_ai.to_string(),
        scope.updated_at.to_string(),
    ])
}

fn managed_disclosure(settings: Option<&AISettings>) -> AIDataDisclosure {
    AIDataDisclosure {
        sends_file_name: true,
        sends_parent_path: settings
            .is_some_and(|settings| settings.send_parent_path || settings.send_full_path),
        sends_full_path: settings.is_some_and(|settings| settings.send_full_path),
        sends_file_content: false,
        content_is_bounded: false,
    }
}

fn managed_readiness_with_store(
    db: &Database,
    managed_scope_id: &str,
    credentials: &impl CredentialStore,
) -> ManagedAIReadiness {
    let provider = provider_snapshot_with_store(db, credentials);
    let disclosure = managed_disclosure(provider.settings.as_ref());
    let scope = db.list_managed_scopes().ok().and_then(|scopes| {
        scopes
            .into_iter()
            .find(|scope| scope.id == managed_scope_id.trim())
    });

    let Some(scope) = scope else {
        let binding_fingerprint = fingerprint(&[
            provider.readiness.binding_fingerprint.clone(),
            managed_scope_id.trim().into(),
            "scope_missing".into(),
        ]);
        return ManagedAIReadiness {
            state: AIReadinessState::ScopeMissing,
            reason: "managed_scope_missing".into(),
            provider: provider.readiness,
            managed_scope_id: managed_scope_id.trim().into(),
            scope_fingerprint: None,
            binding_fingerprint,
            disclosure,
        };
    };

    let scope_fingerprint = managed_scope_fingerprint(&scope);
    let (state, reason) = if !scope.enabled {
        (AIReadinessState::ScopeDisabled, "managed_scope_disabled")
    } else {
        match provider.readiness.provider_mode {
            Some(AIProviderMode::Local) if !scope.allow_local_ai => (
                AIReadinessState::PolicyBlocked,
                "managed_local_ai_policy_disabled",
            ),
            Some(AIProviderMode::Cloud) if !scope.allow_cloud_ai => (
                AIReadinessState::NeedsConsent,
                "managed_cloud_ai_consent_required",
            ),
            _ if provider.readiness.state != AIReadinessState::Ready => {
                (provider.readiness.state, provider.readiness.reason.as_str())
            }
            _ => (AIReadinessState::Ready, "managed_ai_ready"),
        }
    };
    let binding_fingerprint = fingerprint(&[
        provider.readiness.binding_fingerprint.clone(),
        scope_fingerprint.clone(),
        state_wire(state).into(),
        reason.into(),
    ]);

    ManagedAIReadiness {
        state,
        reason: reason.into(),
        provider: provider.readiness,
        managed_scope_id: scope.id,
        scope_fingerprint: Some(scope_fingerprint),
        binding_fingerprint,
        disclosure,
    }
}

pub fn managed_ai_readiness(db: &Database, managed_scope_id: &str) -> ManagedAIReadiness {
    managed_readiness_with_store(db, managed_scope_id, &SystemCredentialStore)
}

pub fn managed_ai_readiness_is_current(
    db: &Database,
    managed_scope_id: &str,
    expected_binding_fingerprint: &str,
) -> bool {
    managed_ai_readiness(db, managed_scope_id).binding_fingerprint == expected_binding_fingerprint
}

fn content_disclosure() -> AIDataDisclosure {
    AIDataDisclosure {
        sends_file_name: false,
        sends_parent_path: false,
        sends_full_path: false,
        sends_file_content: true,
        content_is_bounded: true,
    }
}

fn content_policy_fingerprint(
    policies: &[(ContentPolicyBinding, ContentScopePolicyDto)],
) -> String {
    let mut parts = Vec::with_capacity(policies.len() * 7);
    for (binding, policy) in policies {
        parts.push(binding.root_id.clone());
        parts.push(binding.root_revision.to_string());
        parts.push(binding.policy_revision.to_string());
        parts.push(policy.enabled.to_string());
        parts.push(policy.local_allowed.to_string());
        parts.push(policy.cloud_allowed.to_string());
        parts.push(policy.updated_at.to_string());
    }
    fingerprint(&parts)
}

fn content_readiness_with_store(
    db: &Database,
    root_ids: &[String],
    credentials: &impl CredentialStore,
) -> ContentAIReadiness {
    let provider = provider_snapshot_with_store(db, credentials);
    let disclosure = content_disclosure();
    let mut normalized_root_ids = root_ids
        .iter()
        .map(|root_id| root_id.trim().to_string())
        .filter(|root_id| !root_id.is_empty())
        .collect::<Vec<_>>();
    normalized_root_ids.sort();
    normalized_root_ids.dedup();

    if normalized_root_ids.is_empty() {
        let binding_fingerprint = fingerprint(&[
            provider.readiness.binding_fingerprint.clone(),
            "content_scope_missing".into(),
        ]);
        return ContentAIReadiness {
            state: AIReadinessState::ScopeMissing,
            reason: "content_scope_missing".into(),
            provider: provider.readiness,
            root_ids: normalized_root_ids,
            policy_bindings: Vec::new(),
            policy_fingerprint: None,
            binding_fingerprint,
            disclosure,
            requires_run_confirmation: true,
        };
    }

    let conn = match db.conn() {
        Ok(conn) => conn,
        Err(_) => {
            let binding_fingerprint = fingerprint(&[
                provider.readiness.binding_fingerprint.clone(),
                "content_scope_unavailable".into(),
            ]);
            return ContentAIReadiness {
                state: AIReadinessState::Error,
                reason: "content_scope_unavailable".into(),
                provider: provider.readiness,
                root_ids: normalized_root_ids,
                policy_bindings: Vec::new(),
                policy_fingerprint: None,
                binding_fingerprint,
                disclosure,
                requires_run_confirmation: true,
            };
        }
    };

    let mut policies = Vec::new();
    let mut disabled_root = false;
    for root_id in &normalized_root_ids {
        let root = conn
            .query_row(
                "SELECT enabled, revision FROM scan_roots WHERE id=?1 AND source_kind='file_library'",
                params![root_id],
                |row| Ok((row.get::<_, i64>(0)? != 0, row.get::<_, i64>(1)?)),
            )
            .optional();

        let Ok(root) = root else {
            let binding_fingerprint = fingerprint(&[
                provider.readiness.binding_fingerprint.clone(),
                root_id.clone(),
                "content_scope_unavailable".into(),
            ]);
            return ContentAIReadiness {
                state: AIReadinessState::Error,
                reason: "content_scope_unavailable".into(),
                provider: provider.readiness,
                root_ids: normalized_root_ids,
                policy_bindings: Vec::new(),
                policy_fingerprint: None,
                binding_fingerprint,
                disclosure,
                requires_run_confirmation: true,
            };
        };
        let Some((enabled, root_revision)) = root else {
            let binding_fingerprint = fingerprint(&[
                provider.readiness.binding_fingerprint.clone(),
                root_id.clone(),
                "content_root_missing".into(),
            ]);
            return ContentAIReadiness {
                state: AIReadinessState::ScopeMissing,
                reason: "content_root_missing".into(),
                provider: provider.readiness,
                root_ids: normalized_root_ids,
                policy_bindings: Vec::new(),
                policy_fingerprint: None,
                binding_fingerprint,
                disclosure,
                requires_run_confirmation: true,
            };
        };
        disabled_root |= !enabled;
        let policy = match db.get_content_scope_policy(root_id) {
            Ok(policy) => policy,
            Err(_) => {
                let binding_fingerprint = fingerprint(&[
                    provider.readiness.binding_fingerprint.clone(),
                    root_id.clone(),
                    "content_policy_unavailable".into(),
                ]);
                return ContentAIReadiness {
                    state: AIReadinessState::Error,
                    reason: "content_policy_unavailable".into(),
                    provider: provider.readiness,
                    root_ids: normalized_root_ids,
                    policy_bindings: Vec::new(),
                    policy_fingerprint: None,
                    binding_fingerprint,
                    disclosure,
                    requires_run_confirmation: true,
                };
            }
        };
        policies.push((
            ContentPolicyBinding {
                root_id: root_id.clone(),
                root_revision,
                policy_revision: policy.policy_revision,
            },
            policy,
        ));
    }

    let policy_fingerprint = content_policy_fingerprint(&policies);
    let provider_mode = provider.readiness.provider_mode;
    let consent_missing = policies.iter().any(|(_, policy)| {
        !policy.enabled
            || match provider_mode {
                Some(AIProviderMode::Local) => !policy.local_allowed,
                Some(AIProviderMode::Cloud) => !policy.cloud_allowed,
                None => false,
            }
    });

    let (state, reason) = if disabled_root {
        (AIReadinessState::ScopeDisabled, "content_scope_disabled")
    } else if consent_missing {
        let reason = match provider_mode {
            Some(AIProviderMode::Local) => "content_local_consent_required",
            Some(AIProviderMode::Cloud) => "content_cloud_consent_required",
            None => "content_policy_consent_required",
        };
        (AIReadinessState::NeedsConsent, reason)
    } else if provider.readiness.state != AIReadinessState::Ready {
        (provider.readiness.state, provider.readiness.reason.as_str())
    } else {
        (AIReadinessState::Ready, "content_ai_ready")
    };

    let binding_fingerprint = fingerprint(&[
        provider.readiness.binding_fingerprint.clone(),
        policy_fingerprint.clone(),
        state_wire(state).into(),
        reason.into(),
    ]);
    ContentAIReadiness {
        state,
        reason: reason.into(),
        provider: provider.readiness,
        root_ids: normalized_root_ids,
        policy_bindings: policies.into_iter().map(|(binding, _)| binding).collect(),
        policy_fingerprint: Some(policy_fingerprint),
        binding_fingerprint,
        disclosure,
        requires_run_confirmation: true,
    }
}

pub fn content_ai_readiness(db: &Database, root_ids: &[String]) -> ContentAIReadiness {
    content_readiness_with_store(db, root_ids, &SystemCredentialStore)
}

pub fn content_ai_readiness_is_current(
    db: &Database,
    root_ids: &[String],
    expected_binding_fingerprint: &str,
) -> bool {
    content_ai_readiness(db, root_ids).binding_fingerprint == expected_binding_fingerprint
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ai::{
            schema::{AIProviderKind, AIProviderPresetId},
            settings::{save_ai_settings_with_store, ApiKeyAction, InMemoryCredentialStore},
        },
        content::{default_policy, SetContentScopePolicyRequest},
        db::Database,
        global_index::{AddManagedScopeRequest, UpdateManagedScopePolicyRequest},
    };
    use std::sync::atomic::{AtomicUsize, Ordering};

    static TEST_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn test_db(label: &str) -> Database {
        let sequence = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "zen-ai-readiness-{label}-{}-{sequence}.sqlite3",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&path);
        Database::open(path).expect("open readiness test database")
    }

    fn save_cloud_settings(
        db: &Database,
        store: &InMemoryCredentialStore,
        send_full_path: bool,
        send_parent_path: bool,
    ) -> AISettings {
        let mut settings = AISettings::default();
        settings.enabled = true;
        settings.send_full_path = send_full_path;
        settings.send_parent_path = send_parent_path;
        settings.api_key = "readiness-test-key".into();
        settings.api_key_action = ApiKeyAction::Replace;
        save_ai_settings_with_store(db, &settings, store).expect("save cloud settings")
    }

    fn save_local_settings(db: &Database, store: &InMemoryCredentialStore) -> AISettings {
        let mut settings = AISettings::default();
        settings.enabled = true;
        settings.provider = AIProviderKind::Ollama;
        settings.preset = AIProviderPresetId::Ollama;
        settings.base_url = "http://127.0.0.1:11434".into();
        settings.model = "llama3.2".into();
        settings.api_key.clear();
        settings.api_key_action = ApiKeyAction::Clear;
        save_ai_settings_with_store(db, &settings, store).expect("save local settings")
    }

    fn provider_with_store(db: &Database, store: &InMemoryCredentialStore) -> AIProviderReadiness {
        provider_snapshot_with_store(db, store).readiness
    }

    fn add_scope(db: &Database, allow_local_ai: bool, allow_cloud_ai: bool) -> ManagedScope {
        db.add_managed_scope(AddManagedScopeRequest {
            path: format!(r"C:\Managed\{}", uuid::Uuid::new_v4()),
            global_entry_id: None,
            enabled: true,
            allow_local_ai,
            allow_cloud_ai,
        })
        .expect("add managed scope")
    }

    fn insert_content_root(db: &Database, root_id: &str, enabled: bool) {
        db.conn()
            .expect("content root connection")
            .execute(
                "INSERT INTO scan_roots(
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, revision, needs_reconciliation,
                    created_at, updated_at
                 ) VALUES (?1,?2,?1,'file_library',?3,'healthy',1,1,0,1,1)",
                params![
                    root_id,
                    format!("/tmp/{root_id}"),
                    if enabled { 1_i64 } else { 0_i64 }
                ],
            )
            .expect("insert content root");
    }

    fn set_content_policy(
        db: &Database,
        root_id: &str,
        expected_policy_revision: i64,
        enabled: bool,
        local_allowed: bool,
        cloud_allowed: bool,
    ) -> ContentScopePolicyDto {
        db.set_content_scope_policy(SetContentScopePolicyRequest {
            version: 1,
            root_id: root_id.into(),
            expected_root_revision: 1,
            expected_policy_revision,
            confirmed: true,
            policy: ContentScopePolicyDto {
                root_revision: 1,
                policy_revision: expected_policy_revision,
                enabled,
                local_allowed,
                cloud_allowed,
                ..default_policy(root_id, 1)
            },
        })
        .expect("set content policy")
    }

    #[test]
    fn provider_readiness_distinguishes_disabled_missing_credential_and_local_ready() {
        let db = test_db("provider-states");
        let store = InMemoryCredentialStore::default();

        let disabled = provider_with_store(&db, &store);
        assert_eq!(disabled.state, AIReadinessState::Disabled);

        save_cloud_settings(&db, &store, false, true);
        store.delete().expect("delete credential");
        let missing = provider_with_store(&db, &store);
        assert_eq!(missing.state, AIReadinessState::NeedsCredential);
        assert!(missing.credential_required);
        assert!(!missing.credential_configured);

        save_local_settings(&db, &store);
        let local = provider_with_store(&db, &store);
        assert_eq!(local.state, AIReadinessState::Ready);
        assert_eq!(local.provider_mode, Some(AIProviderMode::Local));
        assert!(!local.credential_required);
    }

    #[test]
    fn provider_readiness_rejects_invalid_or_missing_model_configuration() {
        let mut settings = AISettings::default();
        settings.enabled = true;
        settings.model.clear();
        settings.api_key_configured = true;
        settings.api_key = "key".into();
        let snapshot = provider_snapshot_from_settings(settings, "settings-revision".into());
        assert_eq!(snapshot.readiness.state, AIReadinessState::NeedsProvider);
        assert_eq!(snapshot.readiness.reason, "provider_model_missing");
    }

    #[test]
    fn managed_readiness_requires_exact_scope_and_cloud_consent() {
        let db = test_db("managed-cloud");
        let store = InMemoryCredentialStore::default();
        save_cloud_settings(&db, &store, false, true);

        let arbitrary_path = managed_readiness_with_store(&db, r"C:\Managed", &store);
        assert_eq!(arbitrary_path.state, AIReadinessState::ScopeMissing);

        let scope = add_scope(&db, true, false);
        let blocked = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(blocked.state, AIReadinessState::NeedsConsent);
        assert_eq!(blocked.reason, "managed_cloud_ai_consent_required");
        assert!(blocked.disclosure.sends_file_name);
        assert!(blocked.disclosure.sends_parent_path);
        assert!(!blocked.disclosure.sends_full_path);
        assert!(!blocked.disclosure.sends_file_content);

        db.update_managed_scope_policy(UpdateManagedScopePolicyRequest {
            id: scope.id.clone(),
            enabled: None,
            allow_local_ai: None,
            allow_cloud_ai: Some(true),
        })
        .expect("enable cloud scope");
        let ready = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(ready.state, AIReadinessState::Ready);
        assert_ne!(blocked.binding_fingerprint, ready.binding_fingerprint);
    }

    #[test]
    fn managed_readiness_distinguishes_disabled_scope_and_local_policy_block() {
        let db = test_db("managed-local");
        let store = InMemoryCredentialStore::default();
        save_local_settings(&db, &store);
        let scope = add_scope(&db, false, false);

        let blocked = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(blocked.state, AIReadinessState::PolicyBlocked);

        db.update_managed_scope_policy(UpdateManagedScopePolicyRequest {
            id: scope.id.clone(),
            enabled: Some(false),
            allow_local_ai: None,
            allow_cloud_ai: None,
        })
        .expect("disable scope");
        let disabled = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(disabled.state, AIReadinessState::ScopeDisabled);
        assert_ne!(blocked.binding_fingerprint, disabled.binding_fingerprint);
    }

    #[test]
    fn managed_disclosure_and_binding_follow_current_path_settings() {
        let db = test_db("managed-disclosure");
        let store = InMemoryCredentialStore::default();
        let mut settings = save_cloud_settings(&db, &store, false, false);
        let scope = add_scope(&db, true, true);

        let minimal = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(minimal.state, AIReadinessState::Ready);
        assert!(minimal.disclosure.sends_file_name);
        assert!(!minimal.disclosure.sends_parent_path);
        assert!(!minimal.disclosure.sends_full_path);

        settings.send_full_path = true;
        settings.api_key_action = ApiKeyAction::Preserve;
        save_ai_settings_with_store(&db, &settings, &store).expect("save full-path setting");
        let full = managed_readiness_with_store(&db, &scope.id, &store);
        assert!(full.disclosure.sends_parent_path);
        assert!(full.disclosure.sends_full_path);
        assert_ne!(minimal.binding_fingerprint, full.binding_fingerprint);
    }

    #[test]
    fn credential_loss_invalidates_managed_readiness_without_settings_json_change() {
        let db = test_db("managed-credential-stale");
        let store = InMemoryCredentialStore::default();
        save_cloud_settings(&db, &store, false, false);
        let scope = add_scope(&db, true, true);
        let ready = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(ready.state, AIReadinessState::Ready);

        store.delete().expect("remove credential");
        let stale = managed_readiness_with_store(&db, &scope.id, &store);
        assert_eq!(stale.state, AIReadinessState::NeedsCredential);
        assert_ne!(ready.binding_fingerprint, stale.binding_fingerprint);
    }

    #[test]
    fn content_readiness_requires_root_and_explicit_local_consent() {
        let db = test_db("content-local");
        let store = InMemoryCredentialStore::default();
        save_local_settings(&db, &store);

        let arbitrary_path =
            content_readiness_with_store(&db, &[String::from("/tmp/not-a-root-id")], &store);
        assert_eq!(arbitrary_path.state, AIReadinessState::ScopeMissing);

        let root_id = "content-local-root";
        insert_content_root(&db, root_id, true);
        let default_blocked = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(default_blocked.state, AIReadinessState::NeedsConsent);
        assert!(default_blocked.requires_run_confirmation);

        let policy = set_content_policy(&db, root_id, 0, true, true, false);
        let ready = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(ready.state, AIReadinessState::Ready);
        assert_eq!(
            ready.policy_bindings[0].policy_revision,
            policy.policy_revision
        );
        assert!(!ready.disclosure.sends_file_name);
        assert!(!ready.disclosure.sends_parent_path);
        assert!(!ready.disclosure.sends_full_path);
        assert!(ready.disclosure.sends_file_content);
        assert!(ready.disclosure.content_is_bounded);
        assert_ne!(
            default_blocked.binding_fingerprint,
            ready.binding_fingerprint
        );
    }

    #[test]
    fn content_cloud_consent_and_credential_are_independent_gates() {
        let db = test_db("content-cloud");
        let store = InMemoryCredentialStore::default();
        save_cloud_settings(&db, &store, false, false);
        let root_id = "content-cloud-root";
        insert_content_root(&db, root_id, true);
        set_content_policy(&db, root_id, 0, true, false, true);

        let ready = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(ready.state, AIReadinessState::Ready);

        store.delete().expect("remove cloud credential");
        let missing_credential = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(missing_credential.state, AIReadinessState::NeedsCredential);

        let current_policy = db
            .get_content_scope_policy(root_id)
            .expect("load content policy");
        set_content_policy(
            &db,
            root_id,
            current_policy.policy_revision,
            true,
            false,
            false,
        );
        let missing_consent = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(missing_consent.state, AIReadinessState::NeedsConsent);
        assert_eq!(missing_consent.reason, "content_cloud_consent_required");
    }

    #[test]
    fn content_policy_revision_change_invalidates_readiness_binding() {
        let db = test_db("content-stale");
        let store = InMemoryCredentialStore::default();
        save_local_settings(&db, &store);
        let root_id = "content-stale-root";
        insert_content_root(&db, root_id, true);
        let first_policy = set_content_policy(&db, root_id, 0, true, true, false);
        let first = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(first.state, AIReadinessState::Ready);

        set_content_policy(
            &db,
            root_id,
            first_policy.policy_revision,
            true,
            true,
            false,
        );
        let second = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_ne!(first.binding_fingerprint, second.binding_fingerprint);
        assert_ne!(
            first.policy_bindings[0].policy_revision,
            second.policy_bindings[0].policy_revision
        );
    }

    #[test]
    fn disabled_content_root_is_not_ready_even_with_consent() {
        let db = test_db("content-disabled-root");
        let store = InMemoryCredentialStore::default();
        save_local_settings(&db, &store);
        let root_id = "content-disabled-root";
        insert_content_root(&db, root_id, false);
        let readiness = content_readiness_with_store(&db, &[root_id.into()], &store);
        assert_eq!(readiness.state, AIReadinessState::ScopeDisabled);
    }
}
