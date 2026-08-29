//! Product registration contract for the x64 Windows Preview Handler.
//!
//! The installer owns the real HKLM mutation. This crate owns the immutable
//! product identity, the exact association matrix, and a pure registration
//! planner used to prove installer behaviour without touching a developer's
//! registry.

use std::collections::BTreeMap;

pub const PRODUCTION_CLSID: &str = "{3D1A446C-162E-4313-A026-8ADC792C4862}";
pub const PRODUCTION_CLSID_U128: u128 = 0x3d1a446c_162e_4313_a026_8adc792c4862;
pub const FRIENDLY_NAME: &str = "Zen Canvas Preview Handler";
pub const SHELLEX_CATEGORY: &str = "{8895B1C6-B41F-4C1C-A562-0D564250836F}";
pub const SHELLEX_CATEGORY_U128: u128 = 0x8895b1c6_b41f_4c1c_a562_0d564250836f;
pub const PREVHOST_APP_ID: &str = "{6D2B5079-2F0B-48DD-AB7F-97CEC514D30B}";
pub const PREVHOST_APP_ID_U128: u128 = 0x6d2b5079_2f0b_48dd_ab7f_97cec514d30b;
pub const THREADING_MODEL: &str = "Apartment";
pub const INSTALLED_DLL_RELATIVE_PATH: &str = r"native\zen_canvas_windows_preview_handler.dll";
pub const PREVIEW_QUIESCE_ATTEMPTS: u32 = 20;
pub const PREVIEW_QUIESCE_DELAY_MS: u32 = 250;

pub const SUPPORTED_EXTENSIONS: [&str; 16] = [
    ".md",
    ".markdown",
    ".rs",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".ps1",
    ".sh",
    ".sql",
];

pub const CLSID_KEY: &str = r"Software\Classes\CLSID\{3D1A446C-162E-4313-A026-8ADC792C4862}";
pub const INPROC_SERVER32_KEY: &str =
    r"Software\Classes\CLSID\{3D1A446C-162E-4313-A026-8ADC792C4862}\InprocServer32";
pub const PREVIEW_HANDLERS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\PreviewHandlers";
pub const ASSOCIATION_ROOT: &str = r"Software\Classes\SystemFileAssociations";

pub fn association_key(extension: &str) -> String {
    format!(r"{ASSOCIATION_ROOT}\{extension}\shellex\{SHELLEX_CATEGORY}")
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RegistrySnapshot {
    values: BTreeMap<RegistryValue, String>,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct RegistryValue {
    path: String,
    name: String,
}

impl RegistrySnapshot {
    pub fn set(
        &mut self,
        path: impl Into<String>,
        name: impl Into<String>,
        value: impl Into<String>,
    ) {
        self.values.insert(
            RegistryValue {
                path: path.into(),
                name: name.into(),
            },
            value.into(),
        );
    }

    pub fn get(&self, path: &str, name: &str) -> Option<&str> {
        self.values
            .get(&RegistryValue {
                path: path.to_owned(),
                name: name.to_owned(),
            })
            .map(String::as_str)
    }

    pub fn contains(&self, path: &str, name: &str) -> bool {
        self.get(path, name).is_some()
    }

    fn iter(&self) -> impl Iterator<Item = (&str, &str, &str)> {
        self.values
            .iter()
            .map(|(key, value)| (key.path.as_str(), key.name.as_str(), value.as_str()))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RegistrationAction {
    Set {
        path: String,
        name: String,
        value: String,
    },
    Remove {
        path: String,
        name: String,
    },
    NotifyAssociationChanged,
}

/// Result of the bounded installer-side release probe. Attempt numbers are
/// one-based so deterministic tests can model the NSIS retry window directly.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PreviewReleaseOutcome {
    Released { attempts: u32 },
    Exhausted { attempts: u32 },
}

pub fn probe_preview_release<F>(max_attempts: u32, mut is_released: F) -> PreviewReleaseOutcome
where
    F: FnMut(u32) -> bool,
{
    for attempt in 1..=max_attempts {
        if is_released(attempt) {
            return PreviewReleaseOutcome::Released { attempts: attempt };
        }
    }
    PreviewReleaseOutcome::Exhausted {
        attempts: max_attempts,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AssociationAdmission {
    Create,
    AlreadyOwned,
    PreserveConflict,
}

/// Mirrors the presence-aware NSIS association admission rule. An absent
/// value is claimable; an exact Zen value is idempotent; every present value,
/// including an empty string, is preserved as a conflict.
pub fn association_admission(existing: Option<&str>) -> AssociationAdmission {
    match existing {
        None => AssociationAdmission::Create,
        Some(value) if value == PRODUCTION_CLSID => AssociationAdmission::AlreadyOwned,
        Some(_) => AssociationAdmission::PreserveConflict,
    }
}

pub fn restore_registry_value(
    path: impl Into<String>,
    name: impl Into<String>,
    previous: Option<&str>,
) -> RegistrationAction {
    match previous {
        Some(value) => RegistrationAction::Set {
            path: path.into(),
            name: name.into(),
            value: value.to_owned(),
        },
        None => RegistrationAction::Remove {
            path: path.into(),
            name: name.into(),
        },
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AssociationConflict {
    pub extension: String,
    pub existing_clsid: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegistrationPlan {
    pub actions: Vec<RegistrationAction>,
    pub conflicts: Vec<AssociationConflict>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegistrationCollision {
    pub path: String,
    pub name: String,
    pub existing_value: String,
}

impl std::fmt::Display for RegistrationCollision {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "foreign registration at {}\\{}: {}",
            self.path, self.name, self.existing_value
        )
    }
}

impl std::error::Error for RegistrationCollision {}

pub fn plan_install(
    snapshot: &RegistrySnapshot,
    installed_dll_path: &str,
) -> Result<RegistrationPlan, RegistrationCollision> {
    validate_core_identity(snapshot, installed_dll_path)?;

    let mut actions = Vec::new();
    set_if_needed(snapshot, &mut actions, CLSID_KEY, "", FRIENDLY_NAME);
    set_if_needed(snapshot, &mut actions, CLSID_KEY, "AppID", PREVHOST_APP_ID);
    set_if_needed(
        snapshot,
        &mut actions,
        INPROC_SERVER32_KEY,
        "",
        installed_dll_path,
    );
    set_if_needed(
        snapshot,
        &mut actions,
        INPROC_SERVER32_KEY,
        "ThreadingModel",
        THREADING_MODEL,
    );
    set_if_needed(
        snapshot,
        &mut actions,
        PREVIEW_HANDLERS_KEY,
        PRODUCTION_CLSID,
        FRIENDLY_NAME,
    );

    let mut conflicts = Vec::new();
    for extension in SUPPORTED_EXTENSIONS {
        let path = association_key(extension);
        match association_admission(snapshot.get(&path, "")) {
            AssociationAdmission::Create => actions.push(RegistrationAction::Set {
                path,
                name: String::new(),
                value: PRODUCTION_CLSID.to_owned(),
            }),
            AssociationAdmission::AlreadyOwned => {}
            AssociationAdmission::PreserveConflict => {
                if let Some(value) = snapshot.get(&path, "") {
                    conflicts.push(AssociationConflict {
                        extension: extension.to_owned(),
                        existing_clsid: value.to_owned(),
                    });
                }
            }
        }
    }
    remove_stale_owned_associations(snapshot, &mut actions);
    actions.push(RegistrationAction::NotifyAssociationChanged);

    Ok(RegistrationPlan { actions, conflicts })
}

pub fn plan_uninstall(
    snapshot: &RegistrySnapshot,
    installed_dll_path: &str,
) -> Result<RegistrationPlan, RegistrationCollision> {
    validate_core_identity(snapshot, installed_dll_path)?;
    let mut actions = Vec::new();
    for (path, name, value) in snapshot.iter() {
        if name.is_empty()
            && path.starts_with(ASSOCIATION_ROOT)
            && path.ends_with(&format!(r"\shellex\{SHELLEX_CATEGORY}"))
            && value == PRODUCTION_CLSID
        {
            actions.push(RegistrationAction::Remove {
                path: path.to_owned(),
                name: name.to_owned(),
            });
        }
    }

    if snapshot.get(PREVIEW_HANDLERS_KEY, PRODUCTION_CLSID) == Some(FRIENDLY_NAME) {
        actions.push(RegistrationAction::Remove {
            path: PREVIEW_HANDLERS_KEY.to_owned(),
            name: PRODUCTION_CLSID.to_owned(),
        });
    }
    if snapshot.get(CLSID_KEY, "") == Some(FRIENDLY_NAME) {
        actions.push(RegistrationAction::Remove {
            path: CLSID_KEY.to_owned(),
            name: String::new(),
        });
    }
    if snapshot.get(CLSID_KEY, "AppID") == Some(PREVHOST_APP_ID) {
        actions.push(RegistrationAction::Remove {
            path: CLSID_KEY.to_owned(),
            name: "AppID".to_owned(),
        });
    }
    if snapshot.get(INPROC_SERVER32_KEY, "ThreadingModel") == Some(THREADING_MODEL) {
        actions.push(RegistrationAction::Remove {
            path: INPROC_SERVER32_KEY.to_owned(),
            name: "ThreadingModel".to_owned(),
        });
    }
    if snapshot.get(INPROC_SERVER32_KEY, "") == Some(installed_dll_path) {
        actions.push(RegistrationAction::Remove {
            path: INPROC_SERVER32_KEY.to_owned(),
            name: String::new(),
        });
    }
    actions.push(RegistrationAction::NotifyAssociationChanged);
    Ok(RegistrationPlan {
        actions,
        conflicts: Vec::new(),
    })
}

fn validate_core_identity(
    snapshot: &RegistrySnapshot,
    installed_dll_path: &str,
) -> Result<(), RegistrationCollision> {
    if installed_dll_path.is_empty() {
        return Err(RegistrationCollision {
            path: INPROC_SERVER32_KEY.to_owned(),
            name: String::new(),
            existing_value: "<current path is empty>".to_owned(),
        });
    }
    let core_markers = [
        (CLSID_KEY, "", FRIENDLY_NAME),
        (CLSID_KEY, "AppID", PREVHOST_APP_ID),
        (INPROC_SERVER32_KEY, "ThreadingModel", THREADING_MODEL),
        (PREVIEW_HANDLERS_KEY, PRODUCTION_CLSID, FRIENDLY_NAME),
    ];
    for (path, name, expected) in core_markers {
        if let Some(existing_value) = snapshot.get(path, name) {
            if existing_value != expected {
                return Err(RegistrationCollision {
                    path: path.to_owned(),
                    name: name.to_owned(),
                    existing_value: existing_value.to_owned(),
                });
            }
        }
    }

    let core_present = snapshot.contains(CLSID_KEY, "")
        || snapshot.contains(CLSID_KEY, "AppID")
        || snapshot.contains(INPROC_SERVER32_KEY, "")
        || snapshot.contains(INPROC_SERVER32_KEY, "ThreadingModel")
        || snapshot.contains(PREVIEW_HANDLERS_KEY, PRODUCTION_CLSID);
    if !core_present {
        return Ok(());
    }
    if let Some((path, name, _)) = core_markers
        .into_iter()
        .find(|(path, name, _)| !snapshot.contains(path, name))
    {
        return Err(RegistrationCollision {
            path: path.to_owned(),
            name: name.to_owned(),
            existing_value: "<absent>".to_owned(),
        });
    }

    if let Some(existing_value) = snapshot.get(INPROC_SERVER32_KEY, "") {
        if existing_value.is_empty() || !core_identity_is_zen_owned(snapshot, installed_dll_path) {
            return Err(RegistrationCollision {
                path: INPROC_SERVER32_KEY.to_owned(),
                name: String::new(),
                existing_value: existing_value.to_owned(),
            });
        }
    }
    Ok(())
}

fn core_identity_is_zen_owned(snapshot: &RegistrySnapshot, installed_dll_path: &str) -> bool {
    snapshot.get(CLSID_KEY, "") == Some(FRIENDLY_NAME)
        && snapshot.get(CLSID_KEY, "AppID") == Some(PREVHOST_APP_ID)
        && snapshot.get(INPROC_SERVER32_KEY, "") == Some(installed_dll_path)
        && snapshot.get(INPROC_SERVER32_KEY, "ThreadingModel") == Some(THREADING_MODEL)
        && snapshot.get(PREVIEW_HANDLERS_KEY, PRODUCTION_CLSID) == Some(FRIENDLY_NAME)
}

fn set_if_needed(
    snapshot: &RegistrySnapshot,
    actions: &mut Vec<RegistrationAction>,
    path: &str,
    name: &str,
    value: &str,
) {
    if snapshot.get(path, name) != Some(value) {
        actions.push(RegistrationAction::Set {
            path: path.to_owned(),
            name: name.to_owned(),
            value: value.to_owned(),
        });
    }
}

fn remove_stale_owned_associations(
    snapshot: &RegistrySnapshot,
    actions: &mut Vec<RegistrationAction>,
) {
    for (path, name, value) in snapshot.iter() {
        if name.is_empty()
            && path.starts_with(ASSOCIATION_ROOT)
            && path.ends_with(&format!(r"\shellex\{SHELLEX_CATEGORY}"))
            && value == PRODUCTION_CLSID
            && !SUPPORTED_EXTENSIONS
                .iter()
                .any(|extension| path == association_key(extension))
        {
            actions.push(RegistrationAction::Remove {
                path: path.to_owned(),
                name: name.to_owned(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owned_snapshot(dll_path: &str) -> RegistrySnapshot {
        let mut snapshot = RegistrySnapshot::default();
        snapshot.set(CLSID_KEY, "", FRIENDLY_NAME);
        snapshot.set(CLSID_KEY, "AppID", PREVHOST_APP_ID);
        snapshot.set(INPROC_SERVER32_KEY, "", dll_path);
        snapshot.set(INPROC_SERVER32_KEY, "ThreadingModel", THREADING_MODEL);
        snapshot.set(PREVIEW_HANDLERS_KEY, PRODUCTION_CLSID, FRIENDLY_NAME);
        for extension in SUPPORTED_EXTENSIONS {
            snapshot.set(association_key(extension), "", PRODUCTION_CLSID);
        }
        snapshot
    }

    fn has_set(plan: &RegistrationPlan, path: &str, name: &str, value: &str) -> bool {
        plan.actions.iter().any(|action| {
            matches!(
                action,
                RegistrationAction::Set {
                    path: action_path,
                    name: action_name,
                    value: action_value,
                } if action_path == path && action_name == name && action_value == value
            )
        })
    }

    fn has_remove(plan: &RegistrationPlan, path: &str, name: &str) -> bool {
        plan.actions.iter().any(|action| {
            matches!(
                action,
                RegistrationAction::Remove {
                    path: action_path,
                    name: action_name,
                } if action_path == path && action_name == name
            )
        })
    }

    fn function_body<'a>(hooks: &'a str, function: &str) -> &'a str {
        hooks
            .split(&format!("Function {function}"))
            .nth(1)
            .and_then(|body| body.split("FunctionEnd").next())
            .unwrap_or_else(|| panic!("missing NSIS function {function}"))
    }

    fn macro_body<'a>(hooks: &'a str, macro_name: &str) -> &'a str {
        hooks
            .split(&format!("!macro {macro_name}"))
            .nth(1)
            .and_then(|body| body.split("!macroend").next())
            .unwrap_or_else(|| panic!("missing NSIS macro {macro_name}"))
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum PreviewArtifactState {
        Present,
        Replaced,
        Removed,
    }

    struct PreviewLifecycleModel {
        before: RegistrySnapshot,
        current: RegistrySnapshot,
        artifact: PreviewArtifactState,
        release_ready: bool,
        transaction_open: bool,
        notifications: u32,
    }

    impl PreviewLifecycleModel {
        fn new(before: RegistrySnapshot) -> Self {
            Self {
                current: before.clone(),
                before,
                artifact: PreviewArtifactState::Present,
                release_ready: false,
                transaction_open: false,
                notifications: 0,
            }
        }

        fn withdraw(&mut self) {
            self.current = RegistrySnapshot::default();
            self.transaction_open = true;
            self.notifications += 1;
        }

        fn settle<F>(&mut self, max_attempts: u32, can_round_trip: F) -> PreviewReleaseOutcome
        where
            F: FnMut(u32) -> bool,
        {
            let outcome = probe_preview_release(max_attempts, can_round_trip);
            self.release_ready = matches!(outcome, PreviewReleaseOutcome::Released { .. });
            outcome
        }

        fn rollback(&mut self) {
            if self.transaction_open {
                self.current = self.before.clone();
                self.transaction_open = false;
                self.release_ready = false;
                self.notifications += 1;
            }
        }

        fn commit(&mut self) {
            assert!(self.transaction_open);
            assert!(self.release_ready);
            self.transaction_open = false;
        }

        fn replace_after_commit(&mut self) {
            assert!(!self.transaction_open);
            assert!(self.release_ready);
            self.artifact = PreviewArtifactState::Replaced;
        }

        fn remove_after_commit(&mut self) {
            assert!(!self.transaction_open);
            assert!(self.release_ready);
            self.artifact = PreviewArtifactState::Removed;
        }
    }

    #[test]
    fn t1_exact_production_identity_is_frozen() {
        assert_eq!(PRODUCTION_CLSID, "{3D1A446C-162E-4313-A026-8ADC792C4862}");
        assert_eq!(FRIENDLY_NAME, "Zen Canvas Preview Handler");
        assert_eq!(SHELLEX_CATEGORY, "{8895B1C6-B41F-4C1C-A562-0D564250836F}");
        assert_eq!(PREVHOST_APP_ID, "{6D2B5079-2F0B-48DD-AB7F-97CEC514D30B}");
        assert_eq!(THREADING_MODEL, "Apartment");
    }

    #[test]
    fn t2_exactly_sixteen_extensions_are_supported() {
        assert_eq!(SUPPORTED_EXTENSIONS.len(), 16);
        assert_eq!(
            SUPPORTED_EXTENSIONS
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len(),
            16
        );
    }

    #[test]
    fn t3_excluded_extensions_are_not_in_matrix() {
        for extension in [
            ".txt", ".log", ".json", ".yaml", ".xml", ".csv", ".html", ".css", ".pdf",
        ] {
            assert!(!SUPPORTED_EXTENSIONS.contains(&extension));
        }
    }

    #[test]
    fn t4_registry_paths_are_exact_64_bit_machine_paths() {
        assert_eq!(
            association_key(".rs"),
            r"Software\Classes\SystemFileAssociations\.rs\shellex\{8895B1C6-B41F-4C1C-A562-0D564250836F}"
        );
        assert!(CLSID_KEY.starts_with(r"Software\Classes\CLSID\"));
        assert!(PREVIEW_HANDLERS_KEY.starts_with(r"Software\Microsoft\Windows\CurrentVersion\"));
    }

    #[test]
    fn t5_plan_has_no_default_app_or_low_il_writes() {
        let plan = plan_install(
            &RegistrySnapshot::default(),
            r"C:\Program Files\Zen Canvas\native\zen_canvas_windows_preview_handler.dll",
        )
        .unwrap();
        for action in plan.actions {
            if let RegistrationAction::Set { path, name, .. } = action {
                assert!(!path.contains("UserChoice"));
                assert!(!path.contains("OpenWith"));
                assert!(!(path.ends_with(r"\shellex") && name.is_empty()));
                assert!(!name.eq_ignore_ascii_case("DisableLowILProcessIsolation"));
            }
        }
    }

    #[test]
    fn t6_fresh_unowned_associations_are_claimed() {
        let plan =
            plan_install(&RegistrySnapshot::default(), "C:\\Zen\\native\\handler.dll").unwrap();
        assert_eq!(
            plan.actions
                .iter()
                .filter(|action| matches!(action, RegistrationAction::Set { path, name, value } if name.is_empty() && path.starts_with(ASSOCIATION_ROOT) && value == PRODUCTION_CLSID))
                .count(),
            16
        );
        assert!(plan.conflicts.is_empty());
    }

    #[test]
    fn t7_zen_owned_state_is_idempotent() {
        let plan = plan_install(
            &owned_snapshot("C:\\Zen\\native\\handler.dll"),
            "C:\\Zen\\native\\handler.dll",
        )
        .unwrap();
        assert!(plan
            .actions
            .iter()
            .all(|action| matches!(action, RegistrationAction::NotifyAssociationChanged)));
        assert!(plan.conflicts.is_empty());
    }

    #[test]
    fn t8_foreign_system_file_association_is_not_overwritten() {
        let mut snapshot = RegistrySnapshot::default();
        let path = association_key(".rs");
        snapshot.set(path.clone(), "", "{11111111-2222-3333-4444-555555555555}");
        let plan = plan_install(&snapshot, "C:\\Zen\\native\\handler.dll").unwrap();
        assert!(!has_set(&plan, &path, "", PRODUCTION_CLSID));
        assert_eq!(plan.conflicts.len(), 1);
        assert_eq!(plan.conflicts[0].extension, ".rs");
    }

    #[test]
    fn t9_higher_priority_progid_handler_is_untouched() {
        let mut snapshot = RegistrySnapshot::default();
        let path =
            r"Software\Classes\ZenCanvas.Source\shellex\{8895B1C6-B41F-4C1C-A562-0D564250836F}";
        snapshot.set(path, "", "{11111111-2222-3333-4444-555555555555}");
        snapshot.set(r"Software\Classes\.rs", "", "ZenCanvas.Source");
        let plan = plan_install(&snapshot, "C:\\Zen\\native\\handler.dll").unwrap();
        assert!(!plan.actions.iter().any(|action| {
            matches!(action, RegistrationAction::Set { path, .. } | RegistrationAction::Remove { path, .. } if path == r"Software\Classes\.rs" || path == r"Software\Classes\ZenCanvas.Source\shellex\{8895B1C6-B41F-4C1C-A562-0D564250836F}")
        }));
    }

    #[test]
    fn t10_unexpected_non_current_inproc_path_fails_closed() {
        let mut snapshot = owned_snapshot(r"C:\Old Zen\native\handler.dll");
        snapshot.set(association_key(".legacy"), "", PRODUCTION_CLSID);
        snapshot.set(association_key(".rs"), "", PRODUCTION_CLSID);
        assert!(plan_install(
            &snapshot,
            r"C:\Program Files\Zen Canvas\native\zen_canvas_windows_preview_handler.dll",
        )
        .is_err());
        assert!(plan_uninstall(
            &snapshot,
            r"C:\Program Files\Zen Canvas\native\zen_canvas_windows_preview_handler.dll",
        )
        .is_err());
    }

    #[test]
    fn t11_uninstall_removes_only_exact_owned_values() {
        let mut snapshot = owned_snapshot("C:\\Zen\\native\\handler.dll");
        let foreign_path = association_key(".rs");
        snapshot.set(
            foreign_path.clone(),
            "",
            "{11111111-2222-3333-4444-555555555555}",
        );
        let plan = plan_uninstall(&snapshot, "C:\\Zen\\native\\handler.dll").unwrap();
        assert!(!has_remove(&plan, &foreign_path, ""));
        assert!(has_remove(&plan, &association_key(".md"), ""));
        assert!(has_remove(&plan, PREVIEW_HANDLERS_KEY, PRODUCTION_CLSID));
    }

    #[test]
    fn t12_foreign_inproc_mutation_blocks_install_and_uninstall() {
        let mut snapshot = owned_snapshot("C:\\Zen\\native\\handler.dll");
        snapshot.set(
            association_key(".py"),
            "",
            "{11111111-2222-3333-4444-555555555555}",
        );
        snapshot.set(INPROC_SERVER32_KEY, "", "C:\\Other\\PreviewHandler.dll");
        assert!(plan_install(&snapshot, "C:\\Zen\\native\\handler.dll").is_err());
        assert!(plan_uninstall(&snapshot, "C:\\Zen\\native\\handler.dll").is_err());
    }

    #[test]
    fn t13_installer_manifest_handler_and_matrix_stay_equal() {
        let manifest = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/preview-handler-registration.nsh"
        ));
        for (name, value) in [
            ("ZC_PREVIEW_PRODUCTION_CLSID", PRODUCTION_CLSID),
            ("ZC_PREVIEW_FRIENDLY_NAME", FRIENDLY_NAME),
            ("ZC_PREVIEW_SHELLEX_CATEGORY", SHELLEX_CATEGORY),
            ("ZC_PREVIEW_PREVHOST_APP_ID", PREVHOST_APP_ID),
            ("ZC_PREVIEW_THREADING_MODEL", THREADING_MODEL),
            ("ZC_PREVIEW_DLL_RELATIVE_PATH", INSTALLED_DLL_RELATIVE_PATH),
        ] {
            assert!(manifest.contains(&format!("!define {name} \"{value}\"")));
        }
        for (index, extension) in SUPPORTED_EXTENSIONS.iter().enumerate() {
            assert!(manifest.contains(&format!(
                "!define ZC_PREVIEW_EXTENSION_{:02} \"{extension}\"",
                index + 1
            )));
        }
    }

    #[test]
    fn t19_test_identity_is_absent_from_production_manifest() {
        let manifest = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/preview-handler-registration.nsh"
        ));
        assert!(!manifest.contains("5B6E7F80-91A2-43B4-C5D6-E7F8091A2B3C"));
    }

    #[test]
    fn t14_notification_is_last_after_registration_actions() {
        let plan =
            plan_install(&RegistrySnapshot::default(), "C:\\Zen\\native\\handler.dll").unwrap();
        assert_eq!(
            plan.actions.last(),
            Some(&RegistrationAction::NotifyAssociationChanged)
        );
        let uninstall = plan_uninstall(
            &owned_snapshot("C:\\Zen\\native\\handler.dll"),
            "C:\\Zen\\native\\handler.dll",
        )
        .unwrap();
        assert_eq!(
            uninstall.actions.last(),
            Some(&RegistrationAction::NotifyAssociationChanged)
        );
    }

    #[test]
    fn t15_package_config_is_separate_from_ordinary_cargo_resources() {
        let ordinary_config = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../tauri.windows.conf.json"
        ));
        let package_config = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../tauri.windows.package.conf.json"
        ));
        let native_build = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../scripts/buildWindowsPreviewHandler.mjs"
        ));
        let package_build = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../scripts/buildWindowsPackage.mjs"
        ));

        assert!(!ordinary_config.contains("\"resources\""));
        assert!(!ordinary_config.contains("target/release"));
        assert!(package_config.contains("native/packaged/zen_canvas_windows_preview_handler.dll"));
        assert!(package_config.contains("native/zen_canvas_windows_preview_handler.dll"));
        assert!(native_build.contains("nativeDllStats.size === 0"));
        assert!(native_build.contains("copyFileSync(nativeDllPath, packageResourcePath)"));
        assert!(package_build.contains("run(process.execPath, [nativeBuildScript])"));
        assert!(package_build.contains("tauriArgs.push(\"--config\", packageConfig)"));
    }

    #[test]
    fn t16_release_probe_succeeds_after_n_bounded_attempts_or_exhausts() {
        let mut attempts = Vec::new();
        assert_eq!(
            probe_preview_release(5, |attempt| {
                attempts.push(attempt);
                attempt == 3
            }),
            PreviewReleaseOutcome::Released { attempts: 3 }
        );
        assert_eq!(attempts, vec![1, 2, 3]);
        assert_eq!(
            probe_preview_release(4, |_| false),
            PreviewReleaseOutcome::Exhausted { attempts: 4 }
        );
        assert_eq!(PREVIEW_QUIESCE_ATTEMPTS, 20);
        assert_eq!(PREVIEW_QUIESCE_DELAY_MS, 250);
    }

    #[test]
    fn t17_registry_rollback_distinguishes_absent_empty_and_non_empty() {
        assert_eq!(
            restore_registry_value("HKLM\\Path", "Value", None),
            RegistrationAction::Remove {
                path: "HKLM\\Path".to_owned(),
                name: "Value".to_owned(),
            }
        );
        assert_eq!(
            restore_registry_value("HKLM\\Path", "Value", Some("")),
            RegistrationAction::Set {
                path: "HKLM\\Path".to_owned(),
                name: "Value".to_owned(),
                value: String::new(),
            }
        );
        assert_eq!(
            restore_registry_value("HKLM\\Path", "Value", Some("prior")),
            RegistrationAction::Set {
                path: "HKLM\\Path".to_owned(),
                name: "Value".to_owned(),
                value: "prior".to_owned(),
            }
        );
    }

    #[test]
    fn t18_core_admission_stops_foreign_state_and_requires_current_path() {
        let mut foreign_core = RegistrySnapshot::default();
        foreign_core.set(CLSID_KEY, "", "{11111111-2222-3333-4444-555555555555}");
        assert!(plan_install(&foreign_core, "C:\\Zen\\native\\handler.dll").is_err());

        let fresh_plan =
            plan_install(&RegistrySnapshot::default(), "C:\\Zen\\native\\handler.dll").unwrap();
        assert!(fresh_plan.conflicts.is_empty());

        let current_path =
            r"C:\Program Files\Zen Canvas\native\zen_canvas_windows_preview_handler.dll";
        let current_plan = plan_install(&owned_snapshot(current_path), current_path).unwrap();
        assert!(current_plan
            .actions
            .iter()
            .all(|action| matches!(action, RegistrationAction::NotifyAssociationChanged)));

        let old_path = r"C:\Old Zen\native\zen_canvas_windows_preview_handler.dll";
        assert!(plan_install(&owned_snapshot(old_path), current_path).is_err());
        assert!(plan_uninstall(&owned_snapshot(old_path), current_path).is_err());

        let mut foreign_path = owned_snapshot(current_path);
        foreign_path.set(INPROC_SERVER32_KEY, "", r"C:\Other\PreviewHandler.dll");
        assert!(plan_install(&foreign_path, current_path).is_err());
        assert!(plan_uninstall(&foreign_path, current_path).is_err());

        let mut partial_core = RegistrySnapshot::default();
        partial_core.set(CLSID_KEY, "", FRIENDLY_NAME);
        assert!(plan_install(&partial_core, current_path).is_err());

        let mut empty_path = owned_snapshot(current_path);
        empty_path.set(INPROC_SERVER32_KEY, "", "");
        assert!(plan_install(&empty_path, current_path).is_err());
    }

    #[test]
    fn t19_association_admission_preserves_present_empty_and_foreign_values() {
        assert_eq!(association_admission(None), AssociationAdmission::Create);
        assert_eq!(
            association_admission(Some(PRODUCTION_CLSID)),
            AssociationAdmission::AlreadyOwned
        );
        assert_eq!(
            association_admission(Some("")),
            AssociationAdmission::PreserveConflict
        );
        assert_eq!(
            association_admission(Some("{11111111-2222-3333-4444-555555555555}")),
            AssociationAdmission::PreserveConflict
        );

        let mut snapshot = RegistrySnapshot::default();
        let path = association_key(".rs");
        snapshot.set(path.clone(), "", "");
        let plan = plan_install(&snapshot, "C:\\Zen\\native\\handler.dll").unwrap();
        assert!(!has_set(&plan, &path, "", PRODUCTION_CLSID));
        assert_eq!(plan.conflicts[0].existing_clsid, "");
    }

    #[test]
    fn t20_quiesce_timeout_rolls_back_exactly_and_preserves_artifact() {
        let before = owned_snapshot(r"C:\Old Zen\native\handler.dll");
        let mut lifecycle = PreviewLifecycleModel::new(before.clone());
        lifecycle.withdraw();
        assert_eq!(
            lifecycle.settle(PREVIEW_QUIESCE_ATTEMPTS, |_| false),
            PreviewReleaseOutcome::Exhausted {
                attempts: PREVIEW_QUIESCE_ATTEMPTS
            }
        );
        lifecycle.rollback();
        assert_eq!(lifecycle.current, before);
        assert_eq!(lifecycle.artifact, PreviewArtifactState::Present);
        assert_eq!(lifecycle.notifications, 2);
        assert!(!lifecycle.transaction_open);
    }

    #[test]
    fn t21_later_preinstall_failure_rolls_back_after_successful_probe() {
        let before = owned_snapshot(r"C:\Old Zen\native\handler.dll");
        let mut lifecycle = PreviewLifecycleModel::new(before.clone());
        lifecycle.withdraw();
        assert_eq!(
            lifecycle.settle(PREVIEW_QUIESCE_ATTEMPTS, |attempt| attempt == 3),
            PreviewReleaseOutcome::Released { attempts: 3 }
        );
        lifecycle.rollback();
        assert_eq!(lifecycle.current, before);
        assert_eq!(lifecycle.artifact, PreviewArtifactState::Present);
        assert_eq!(lifecycle.notifications, 2);
    }

    #[test]
    fn t22_successful_quiesce_allows_replacement_or_removal_after_commit() {
        let before = owned_snapshot(r"C:\Old Zen\native\handler.dll");
        let mut replacement = PreviewLifecycleModel::new(before.clone());
        replacement.withdraw();
        assert!(matches!(
            replacement.settle(PREVIEW_QUIESCE_ATTEMPTS, |_| true),
            PreviewReleaseOutcome::Released { attempts: 1 }
        ));
        replacement.commit();
        replacement.replace_after_commit();
        assert_eq!(replacement.artifact, PreviewArtifactState::Replaced);

        let mut removal = PreviewLifecycleModel::new(before);
        removal.withdraw();
        removal.settle(PREVIEW_QUIESCE_ATTEMPTS, |_| true);
        removal.commit();
        removal.remove_after_commit();
        assert_eq!(removal.artifact, PreviewArtifactState::Removed);
    }

    #[test]
    fn t23_installer_core_validation_precedes_every_destructive_preview_step() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let validation = macro_body(hooks, "ZC_VALIDATE_PREVIEW_CORE");
        assert!(!validation.to_ascii_lowercase().contains("deleteregvalue"));
        assert!(!validation.to_ascii_lowercase().contains("rename "));
        assert!(validation.contains("ZC_PREVIEW_CORE_PRESENT == 0"));
        assert!(validation.contains("production core registration is incomplete"));

        let install_quiesce = function_body(hooks, "QuiesceZenCanvasPreviewBeforeInstall");
        assert!(
            install_quiesce.find("Call ValidateZenCanvasPreviewCore")
                < install_quiesce.find("Call WithdrawZenCanvasPreviewRegistration")
        );
        assert!(
            install_quiesce.find("Call WithdrawZenCanvasPreviewRegistration")
                < install_quiesce.find("Call WaitForZenCanvasPreviewDllRelease")
        );
        assert!(install_quiesce.contains("Call RollbackZenCanvasPreviewQuiesce"));
        assert!(install_quiesce.contains("prior registration and DLL were preserved"));

        let install_handler = function_body(hooks, "InstallZenCanvasPreviewHandler");
        assert!(!install_handler.contains("ValidateZenCanvasPreviewCore"));

        let un_quiesce = function_body(hooks, "un.QuiesceZenCanvasPreviewBeforeUninstall");
        assert!(
            un_quiesce.find("Call un.ValidateZenCanvasPreviewCore")
                < un_quiesce.find("Call un.WithdrawZenCanvasPreviewRegistration")
        );
        assert!(un_quiesce.contains("Call un.RollbackZenCanvasPreviewQuiesce"));
    }

    #[test]
    fn t24_installer_release_probe_is_non_destructive_bounded_and_lifecycle_ordered() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let lower = hooks.to_ascii_lowercase();
        assert!(!lower.contains("taskkill"));
        assert!(!lower.contains("terminateprocess"));
        assert!(!lower.contains("explorer.exe"));
        assert!(!lower.contains("restart explorer"));
        assert!(hooks.contains("Sleep ${ZC_PREVIEW_QUIESCE_DELAY_MS}"));
        assert!(hooks.contains("IntCmp $0 ${ZC_PREVIEW_QUIESCE_ATTEMPTS}"));
        assert!(hooks.contains("ZC_PREVIEW_TXN_OLD_PRESENT"));
        assert!(hooks.contains("$ZC_PREVIEW_DLL_PROBE_PATH"));

        let wait = function_body(hooks, "WaitForZenCanvasPreviewDllRelease");
        let un_wait = function_body(hooks, "un.WaitForZenCanvasPreviewDllRelease");
        let wait_probe_call = wait
            .lines()
            .find(|line| line.contains("System::Call") && line.contains("CreateFileW"))
            .expect("install CreateFileW probe call");
        let un_wait_probe_call = un_wait
            .lines()
            .find(|line| line.contains("System::Call") && line.contains("CreateFileW"))
            .expect("uninstall CreateFileW probe call");
        assert_eq!(wait_probe_call, un_wait_probe_call);
        let assert_probe_contract = |body: &str, success_label: &str| {
            assert!(body.contains(
                "System::Call 'kernel32::CreateFileW(w \"$ZC_PREVIEW_DLL_PROBE_PATH\", i 0x40000000|0x00010000, i 0, p 0, i 3, i 0x00000080, p 0) p.r1'"
            ));
            assert!(body.contains("${IntPtrCmp} $1 -1"));
            assert!(body.contains("System::Call 'kernel32::CloseHandle(p $1) i.r2'"));
            assert!(body.contains("${If} $2 != 0"));
            assert!(body.find("CreateFileW").unwrap() < body.find("CloseHandle").unwrap());
            let close_to_success = body
                .find("CloseHandle")
                .and_then(|index| body[index..].find(success_label));
            assert!(close_to_success.is_some());
            assert!(!body.lines().any(|line| {
                let command = line.trim_start();
                command.starts_with("Delete ")
                    || command.starts_with("Rename ")
                    || command.starts_with("MoveFileEx")
            }));
        };
        assert_probe_contract(wait, "Goto preview_dll_release_success");
        assert_probe_contract(un_wait, "Goto un_preview_dll_release_success");
        assert!(wait_probe_call.contains("0x40000000|0x00010000"));
        assert!(wait_probe_call.contains(", i 0, p 0, i 3, i 0x00000080, p 0)"));
        assert!(!wait.contains(".zen-canvas-probe"));
        assert!(!un_wait.contains(".zen-canvas-probe"));

        let withdraw = macro_body(
            hooks,
            "ZC_WITHDRAW_PREVIEW_BODY ROLLBACK_FUNCTION STALE_FUNCTION NOTIFY_FUNCTION",
        );
        assert!(withdraw
            .contains("\"$ZC_PREVIEW_DLL_PROBE_PATH\" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}"));
        assert!(withdraw.find("Call ${STALE_FUNCTION}") < withdraw.find("Call ${NOTIFY_FUNCTION}"));
        assert!(!withdraw.contains("COMMIT_FUNCTION"));

        let preinstall = hooks
            .split("!macro NSIS_HOOK_PREINSTALL")
            .nth(1)
            .and_then(|body| body.split("!macroend").next())
            .expect("preinstall hook");
        assert!(
            preinstall
                .find("Call ValidateZenCanvasPreexistingProduct")
                .unwrap()
                < preinstall
                    .find("Call ValidateZenCanvasIndexServiceOwnership")
                    .unwrap()
        );
        assert!(
            preinstall
                .find("Call ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < preinstall
                    .find("Call QuiesceZenCanvasPreviewBeforeInstall")
                    .unwrap()
        );
        assert!(
            preinstall
                .find("Call QuiesceZenCanvasPreviewBeforeInstall")
                .unwrap()
                < preinstall.find("Call StopZenCanvasIndexService").unwrap()
        );
        assert!(!preinstall.contains("DeleteZenCanvasIndexService"));
        assert!(!preinstall.contains("Call CommitZenCanvasPreviewQuiesce"));
        assert!(!preinstall.contains("RemoveZenCanvasLegacyPreviewDll"));
        assert!(!preinstall.contains("Call CommitZenCanvasPreviewRegistration"));

        let postinstall = macro_body(hooks, "NSIS_HOOK_POSTINSTALL");
        assert!(
            postinstall
                .find("Call InstallZenCanvasIndexService")
                .unwrap()
                < postinstall
                    .find("Call InstallZenCanvasPreviewHandler")
                    .unwrap()
        );
        assert!(
            postinstall
                .find("Call InstallZenCanvasPreviewHandler")
                .unwrap()
                < postinstall
                    .find("Call CommitZenCanvasPreviewQuiesce")
                    .unwrap()
        );

        let installer_stop = function_body(hooks, "StopZenCanvasIndexService");
        assert!(
            installer_stop
                .find("Call ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < installer_stop.find("sc.exe\" stop").unwrap()
        );
        assert!(!installer_stop.contains("sc qc"));

        let preuninstall = hooks
            .split("!macro NSIS_HOOK_PREUNINSTALL")
            .nth(1)
            .and_then(|body| body.split("!macroend").next())
            .expect("preuninstall hook");
        assert!(
            preuninstall
                .find("Call un.QuiesceZenCanvasPreviewBeforeUninstall")
                .unwrap()
                < preuninstall
                    .find("Call un.StopZenCanvasIndexService")
                    .unwrap()
        );
        assert!(!preuninstall.contains("Call un.DeleteZenCanvasIndexService"));

        let un_stop = function_body(hooks, "un.StopZenCanvasIndexService");
        assert!(
            un_stop
                .find("Call un.ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < un_stop.find("sc.exe\" stop").unwrap()
        );
        assert!(un_stop.contains("Call un.RollbackZenCanvasPreviewQuiesce"));
        let un_delete = function_body(hooks, "un.DeleteZenCanvasIndexService");
        assert!(
            un_delete
                .find("Call un.ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < un_delete.find("sc.exe\" delete").unwrap()
        );
        assert!(!un_delete.contains("Call un.RollbackZenCanvasPreviewQuiesce"));

        let un_finalize = function_body(hooks, "un.FinalizeZenCanvasPreviewUninstall");
        assert!(un_finalize.contains("IfFileExists \"$ZC_PREVIEW_DLL_PROBE_PATH\""));
        assert!(un_finalize.contains("Call un.CommitZenCanvasPreviewQuiesce"));
        assert!(un_finalize.contains("ZC_PREVIEW_ARTIFACT_REMOVED"));
        assert!(un_finalize.contains("finalized as withdrawn"));
        assert!(!un_finalize.contains("Call un.RollbackZenCanvasPreviewQuiesce"));
        assert!(!un_finalize.contains("prior registration was restored"));
        let postuninstall = hooks
            .split("!macro NSIS_HOOK_POSTUNINSTALL")
            .nth(1)
            .and_then(|body| body.split("!macroend").next())
            .expect("postuninstall hook");
        assert!(
            postuninstall.find("Call un.FinalizeZenCanvasPreviewUninstall")
                < postuninstall.find("Call un.DeleteZenCanvasIndexService")
        );
        assert!(!postuninstall.contains("Call un.StopZenCanvasIndexService"));
    }

    #[test]
    fn t25_association_presence_and_unrelated_foreign_slots_are_contractual() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let associations = macro_body(hooks, "ZC_REGISTER_ASSOC EXT");
        assert!(associations.contains("ClearErrors"));
        assert!(associations.contains("${If} ${Errors}"));
        assert!(associations.contains("${ElseIf} $0 == \"${ZC_PREVIEW_PRODUCTION_CLSID}\""));
        assert!(associations.contains("preserved ${EXT}"));
        assert!(!associations.contains("${If} $0 == \"\""));

        let mut foreign_association = RegistrySnapshot::default();
        let path = association_key(".rs");
        foreign_association.set(path.clone(), "", "{11111111-2222-3333-4444-555555555555}");
        let plan = plan_install(&foreign_association, "C:\\Zen\\native\\handler.dll").unwrap();
        assert_eq!(plan.conflicts.len(), 1);
        assert!(!has_set(&plan, &path, "", PRODUCTION_CLSID));
    }

    #[test]
    fn t26_service_contract_uses_tauri_main_binary_authority() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let postinstall = macro_body(hooks, "NSIS_HOOK_POSTINSTALL");
        let service = function_body(hooks, "InstallZenCanvasIndexService");
        let service_host = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../src/global_index/windows/service_host.rs"
        ));
        let main = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src/main.rs"));

        assert!(!hooks.contains("Zen Canvas.exe"));
        assert!(postinstall.contains("StrCpy $ZC_MAIN_BINARY_FILENAME \"${MAINBINARYNAME}.exe\""));
        assert!(service.contains("$INSTDIR\\$ZC_MAIN_BINARY_FILENAME"));
        assert!(service.contains("--index-service"));
        assert!(
            postinstall.find("MAINBINARYNAME").unwrap()
                < postinstall
                    .find("Call InstallZenCanvasIndexService")
                    .unwrap()
        );
        assert!(
            service_host.contains("pub const INDEX_SERVICE_NAME: &str = \"ZenCanvasGlobalIndex\";")
        );
        assert!(service_host
            .contains("pub const INDEX_SERVICE_DISPLAY_NAME: &str = \"Zen Canvas Global Index\";"));
        assert!(service_host.contains("--index-service"));
        assert!(main.contains("argument == \"--index-service\""));
    }

    #[test]
    fn t27_fatal_installer_messages_default_to_silent_abort() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let lines = hooks.lines().collect::<Vec<_>>();
        let mut message_count = 0;
        for (index, line) in lines.iter().enumerate() {
            if !line.contains("MessageBox") {
                continue;
            }
            message_count += 1;
            assert!(line.contains("MB_OK"));
            assert!(
                line.contains("/SD IDOK"),
                "fatal MessageBox lacks a silent default: {line}"
            );
            assert!(
                lines
                    .iter()
                    .skip(index + 1)
                    .take(6)
                    .any(|candidate| candidate.trim() == "Abort"),
                "fatal MessageBox is not followed by Abort: {line}"
            );
        }
        assert!(message_count >= 10);
    }

    #[test]
    fn t28_postinstall_failures_compensate_transaction_service_and_arp_in_order() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let write_value = macro_body(hooks, "ZC_WRITE_REG_VALUE PATH NAME VALUE");
        let fail = function_body(hooks, "FailZenCanvasPostInstall");
        let service = function_body(hooks, "InstallZenCanvasIndexService");
        let postinstall = macro_body(hooks, "NSIS_HOOK_POSTINSTALL");

        assert!(write_value.contains("Call FailZenCanvasPostInstall"));
        assert!(service.matches("Call FailZenCanvasPostInstall").count() >= 5);
        assert!(!service.contains("rolled back"));
        assert!(!postinstall.contains("CommitZenCanvasPreviewRegistration"));
        assert!(
            postinstall
                .find("Call InstallZenCanvasIndexService")
                .unwrap()
                < postinstall
                    .find("Call InstallZenCanvasPreviewHandler")
                    .unwrap()
        );
        assert!(
            postinstall
                .find("Call InstallZenCanvasPreviewHandler")
                .unwrap()
                < postinstall
                    .find("Call CommitZenCanvasPreviewQuiesce")
                    .unwrap()
        );

        let rollback = fail.find("Call RollbackZenCanvasPreviewQuiesce").unwrap();
        let service_cleanup = fail
            .find("Call CompensateZenCanvasPostInstallService")
            .unwrap();
        let restore = fail
            .find("Call RestoreZenCanvasPreexistingService")
            .unwrap();
        let fresh_cleanup = fail
            .find("Call CompensateZenCanvasFreshProductMetadata")
            .unwrap();
        let message = fail.find("MessageBox").unwrap();
        let abort = fail.find("Abort").unwrap();
        assert!(rollback < service_cleanup);
        assert!(service_cleanup < restore);
        assert!(restore < fresh_cleanup);
        assert!(fresh_cleanup < message);
        assert!(message < abort);
        assert!(fail.contains("ZC_PREEXISTING_PRODUCT == 0"));
        assert!(fail.contains("ZC_PREEXISTING_PRODUCT == 1"));
        assert!(fail.contains("existing Add/Remove Programs metadata"));
        assert!(!fail.contains("DeleteRegKey HKLM \"$ZC_UNINSTALLER_REGISTRY_KEY\""));
        assert!(!fail.contains("Delete \"$INSTDIR\\uninstall.exe\""));

        let fresh_metadata = function_body(hooks, "CompensateZenCanvasFreshProductMetadata");
        assert!(fresh_metadata.contains("DeleteRegKey HKLM \"$ZC_UNINSTALLER_REGISTRY_KEY\""));
        assert!(fresh_metadata.contains("Delete \"$INSTDIR\\uninstall.exe\""));
        assert!(fresh_metadata.contains("ZC_FRESH_UNINSTALL_METADATA_OWNED"));
        assert!(fresh_metadata.contains("ZC_EXPECTED_INSTALL_LOCATION"));

        let failed_callback = function_body(hooks, ".onInstFailed");
        assert!(failed_callback.contains("ZC_INSTALL_LIFECYCLE_ACTIVE"));
        assert!(failed_callback.contains("ZC_INSTALL_FAILURE_COMPENSATED"));
        assert!(failed_callback.contains("Call RollbackZenCanvasPreviewQuiesce"));
        assert!(failed_callback.contains("Call RestoreZenCanvasPreexistingService"));
        assert!(failed_callback.contains("ZC_PREEXISTING_PRODUCT == 0"));
        assert!(failed_callback.contains("ZC_PREEXISTING_PRODUCT == 1"));
        assert!(!failed_callback.contains("MessageBox"));
        assert!(!failed_callback.lines().any(|line| line.trim() == "Abort"));
    }

    #[test]
    fn t29_service_readiness_is_bounded_and_requires_stable_running() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let readiness = function_body(hooks, "WaitForZenCanvasIndexServiceRunning");
        let install = function_body(hooks, "InstallZenCanvasIndexService");

        assert!(readiness.contains("sc.exe\" query \"${ZC_INDEX_SERVICE_NAME}\""));
        assert!(readiness.contains("RUNNING"));
        assert!(readiness.contains("STOPPED"));
        assert!(readiness.contains("FAILED"));
        assert!(readiness.contains("ZC_INDEX_SERVICE_READY_ATTEMPTS"));
        assert!(readiness.contains("ZC_INDEX_SERVICE_RUNNING_CONFIRMATIONS"));
        assert!(readiness.contains("IntCmp"));
        assert!(
            install.find("sc.exe\" start").unwrap()
                < install
                    .find("Call WaitForZenCanvasIndexServiceRunning")
                    .unwrap()
        );
        assert!(install.contains("stable RUNNING state"));
    }

    #[test]
    fn t30_inproc_ownership_is_current_path_only_and_never_deletes_probe_path() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let validation = macro_body(hooks, "ZC_VALIDATE_PREVIEW_CORE");
        assert!(validation.contains("$0 != \"${ZC_PREVIEW_INSTALLED_DLL}\""));
        assert!(validation.to_ascii_lowercase().contains("canonical"));
        assert!(!hooks.contains("Delete \"$ZC_PREVIEW_DLL_PROBE_PATH\""));
        assert!(!hooks.contains("RemoveZenCanvasLegacyPreviewDll"));
    }

    #[test]
    fn t31_service_mutation_requires_exact_registry_image_path_ownership() {
        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let ownership = macro_body(hooks, "ZC_READ_INDEX_SERVICE_OWNERSHIP_BODY");
        assert!(ownership.contains("ReadRegStr $0 HKLM \"${ZC_INDEX_SERVICE_KEY}\" \"ImagePath\""));
        assert!(ownership.contains("$ZC_INDEX_SERVICE_EXPECTED_IMAGE_PATH"));
        assert!(ownership.contains("--index-service"));
        assert!(ownership.contains("StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 2"));
        assert!(ownership.contains("EnumRegKey $2 HKLM \"${ZC_INDEX_SERVICE_PARENT_KEY}\""));
        assert!(!hooks.to_ascii_lowercase().contains("sc qc"));

        let expected = "\"C:\\\\Program Files\\\\Zen Canvas\\\\zen-canvas.exe\" --index-service";
        let can_mutate_service =
            |image_path: Option<&str>| matches!(image_path, Some(value) if value == expected);
        assert!(!can_mutate_service(None));
        assert!(!can_mutate_service(Some("")));
        assert!(!can_mutate_service(Some(
            "\"C:\\\\foreign\\\\other.exe\" --index-service"
        )));
        assert!(can_mutate_service(Some(expected)));

        let installer_stop = function_body(hooks, "StopZenCanvasIndexService");
        assert!(
            installer_stop
                .find("Call ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < installer_stop.find("sc.exe\" stop").unwrap()
        );
        let un_stop = function_body(hooks, "un.StopZenCanvasIndexService");
        assert!(
            un_stop
                .find("Call un.ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < un_stop.find("sc.exe\" stop").unwrap()
        );
        let compensation = function_body(hooks, "CompensateZenCanvasPostInstallService");
        let delete_index = compensation.find("sc.exe\" delete").unwrap();
        assert!(
            compensation[..delete_index]
                .rfind("Call ReadZenCanvasIndexServiceOwnership")
                .unwrap()
                < delete_index
        );
        let un_delete = function_body(hooks, "un.DeleteZenCanvasIndexService");
        assert!(
            un_delete
                .find("Call un.ValidateZenCanvasIndexServiceOwnership")
                .unwrap()
                < un_delete.find("sc.exe\" delete").unwrap()
        );
    }

    #[test]
    fn t32_fresh_repair_and_generated_failure_semantics_are_distinct() {
        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        enum ProductState {
            Fresh,
            Repair,
            Inconsistent,
        }

        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        struct FailurePlan {
            admitted: bool,
            rollback_preview: bool,
            preserve_existing_uninstall_metadata: bool,
            preserve_existing_uninstaller: bool,
            compensate_current_service: bool,
            restore_existing_service: bool,
            neutralize_fresh_metadata: bool,
            callback_is_silent: bool,
        }

        let failure_plan =
            |state: ProductState, postinstall_started: bool, current_service_created: bool| {
                match state {
                    ProductState::Fresh => FailurePlan {
                        admitted: true,
                        rollback_preview: true,
                        preserve_existing_uninstall_metadata: false,
                        preserve_existing_uninstaller: false,
                        compensate_current_service: current_service_created,
                        restore_existing_service: false,
                        neutralize_fresh_metadata: true,
                        callback_is_silent: true,
                    },
                    ProductState::Repair => FailurePlan {
                        admitted: true,
                        rollback_preview: true,
                        preserve_existing_uninstall_metadata: true,
                        preserve_existing_uninstaller: true,
                        compensate_current_service: current_service_created,
                        restore_existing_service: !current_service_created,
                        neutralize_fresh_metadata: false,
                        callback_is_silent: true,
                    },
                    ProductState::Inconsistent => FailurePlan {
                        admitted: false,
                        rollback_preview: false,
                        preserve_existing_uninstall_metadata: true,
                        preserve_existing_uninstaller: true,
                        compensate_current_service: false,
                        restore_existing_service: false,
                        neutralize_fresh_metadata: false,
                        callback_is_silent: !postinstall_started,
                    },
                }
            };

        let fresh_before_postinstall = failure_plan(ProductState::Fresh, false, false);
        assert!(fresh_before_postinstall.admitted);
        assert!(fresh_before_postinstall.rollback_preview);
        assert!(fresh_before_postinstall.neutralize_fresh_metadata);
        assert!(!fresh_before_postinstall.preserve_existing_uninstall_metadata);
        assert!(!fresh_before_postinstall.preserve_existing_uninstaller);
        assert!(!fresh_before_postinstall.compensate_current_service);

        let repair_before_postinstall = failure_plan(ProductState::Repair, false, false);
        assert!(repair_before_postinstall.admitted);
        assert!(repair_before_postinstall.rollback_preview);
        assert!(repair_before_postinstall.preserve_existing_uninstall_metadata);
        assert!(repair_before_postinstall.preserve_existing_uninstaller);
        assert!(repair_before_postinstall.restore_existing_service);
        assert!(!repair_before_postinstall.neutralize_fresh_metadata);
        assert!(!repair_before_postinstall.compensate_current_service);

        let repair_after_service_creation = failure_plan(ProductState::Repair, true, true);
        assert!(repair_after_service_creation.preserve_existing_uninstall_metadata);
        assert!(repair_after_service_creation.preserve_existing_uninstaller);
        assert!(repair_after_service_creation.compensate_current_service);
        assert!(!repair_after_service_creation.restore_existing_service);
        assert!(!repair_after_service_creation.neutralize_fresh_metadata);

        let inconsistent = failure_plan(ProductState::Inconsistent, false, false);
        assert!(!inconsistent.admitted);
        assert!(!inconsistent.rollback_preview);
        assert!(!inconsistent.neutralize_fresh_metadata);

        let hooks = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../windows/installer-hooks.nsh"
        ));
        let callback = function_body(hooks, ".onInstFailed");
        let rollback = callback
            .find("Call RollbackZenCanvasPreviewQuiesce")
            .unwrap();
        let restore = callback
            .find("Call RestoreZenCanvasPreexistingService")
            .unwrap();
        let fresh_cleanup = callback
            .find("Call CompensateZenCanvasFreshProductMetadata")
            .unwrap();
        assert!(rollback < restore);
        assert!(restore < fresh_cleanup);
        assert!(callback.contains("ZC_PREEXISTING_PRODUCT == 0"));
        assert!(callback.contains("ZC_PREEXISTING_PRODUCT == 1"));
        assert!(!callback.contains("MessageBox"));
        assert!(!callback.lines().any(|line| line.trim() == "Abort"));
    }
}
