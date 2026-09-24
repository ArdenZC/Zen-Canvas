//! Transient platform resource policy consumed by the existing WorkScheduler.
//!
//! The governor reads current OS facts on demand. It owns no queue, durable
//! work state, timer, or lifecycle; `WorkScheduler` remains the admission
//! authority.

use crate::{
    file_workspace::WorkClass,
    platform,
    scheduler::{PlatformResourcePolicy, ResourceCapacities, ResourcePolicyDecision},
};
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowsPowerSnapshot {
    /// `None` means Windows could not provide a trustworthy Battery Saver fact.
    pub battery_saver: Option<bool>,
    /// `Some(true)` means running on battery; `Some(false)` means AC is online.
    pub on_battery: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourcePressureSnapshot {
    MacOs(platform::macos::activity::MacActivitySnapshot),
    Windows(WindowsPowerSnapshot),
    Unknown,
}

impl From<platform::macos::activity::MacActivitySnapshot> for ResourcePressureSnapshot {
    fn from(snapshot: platform::macos::activity::MacActivitySnapshot) -> Self {
        Self::MacOs(snapshot)
    }
}

impl ResourcePressureSnapshot {
    pub fn current() -> Self {
        #[cfg(target_os = "macos")]
        {
            return Self::MacOs(platform::macos::activity::MacActivitySnapshot::current());
        }

        #[cfg(target_os = "windows")]
        {
            return platform::windows::power::current_snapshot()
                .map(Self::Windows)
                .unwrap_or(Self::Unknown);
        }

        #[allow(unreachable_code)]
        Self::Unknown
    }
}

/// One cheap, deterministic policy reader. Production reads a fresh native
/// snapshot for each scheduler decision; tests can inject fixed snapshots.
#[derive(Clone)]
pub struct RuntimeResourceGovernor {
    snapshot_provider: Arc<dyn Fn() -> ResourcePressureSnapshot + Send + Sync>,
}

impl std::fmt::Debug for RuntimeResourceGovernor {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("RuntimeResourceGovernor")
            .finish_non_exhaustive()
    }
}

impl RuntimeResourceGovernor {
    pub fn current() -> Self {
        Self::with_snapshot_provider(ResourcePressureSnapshot::current)
    }

    pub fn from_snapshot(snapshot: impl Into<ResourcePressureSnapshot>) -> Self {
        let snapshot = snapshot.into();
        Self::with_snapshot_provider(move || snapshot)
    }

    pub fn with_snapshot_provider<F>(provider: F) -> Self
    where
        F: Fn() -> ResourcePressureSnapshot + Send + Sync + 'static,
    {
        Self {
            snapshot_provider: Arc::new(provider),
        }
    }

    pub fn decision_for(
        snapshot: ResourcePressureSnapshot,
        class: WorkClass,
        configured_capacity: ResourceCapacities,
    ) -> ResourcePolicyDecision {
        let is_background = matches!(class, WorkClass::Background);
        let mut effective_capacity = configured_capacity;
        let mut allow_background = true;

        match snapshot {
            ResourcePressureSnapshot::MacOs(activity) => {
                let activity_policy = platform::macos::activity::policy_for(
                    activity,
                    configured_capacity.cpu.max(1) as usize,
                    is_background,
                );
                let parallelism = activity_policy.max_parallelism.max(1) as u32;
                effective_capacity.cpu = effective_capacity.cpu.min(parallelism);
                if is_background
                    || activity.low_power_mode
                    || matches!(
                        activity.thermal,
                        platform::macos::activity::MacThermalState::Serious
                            | platform::macos::activity::MacThermalState::Critical
                    )
                {
                    effective_capacity.io = effective_capacity.io.min(parallelism);
                    effective_capacity.provider_network =
                        effective_capacity.provider_network.min(parallelism);
                }
                if is_background {
                    allow_background = activity_policy.allow_nonessential_background_work;
                }
            }
            ResourcePressureSnapshot::Windows(power) if is_background => {
                if power.battery_saver == Some(true) {
                    allow_background = false;
                } else if power.on_battery != Some(false) || power.battery_saver.is_none() {
                    cap_background_parallelism(&mut effective_capacity, 2);
                }
            }
            ResourcePressureSnapshot::Windows(_) => {}
            ResourcePressureSnapshot::Unknown if is_background => {
                cap_background_parallelism(&mut effective_capacity, 2);
            }
            ResourcePressureSnapshot::Unknown => {}
        }

        ResourcePolicyDecision {
            effective_capacity,
            allow_background,
            efficiency_qos: is_background,
        }
    }
}

impl PlatformResourcePolicy for RuntimeResourceGovernor {
    fn decision(
        &self,
        class: WorkClass,
        configured_capacity: ResourceCapacities,
    ) -> ResourcePolicyDecision {
        Self::decision_for((self.snapshot_provider)(), class, configured_capacity)
    }
}

fn cap_background_parallelism(capacity: &mut ResourceCapacities, max_parallelism: u32) {
    capacity.cpu = capacity.cpu.min(max_parallelism.max(1));
    capacity.io = capacity.io.min(max_parallelism.max(1));
    capacity.provider_network = capacity.provider_network.min(max_parallelism.max(1));
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThreadQosApplication {
    NotRequested,
    Applied,
    Failed,
}

/// Apply best-effort efficiency QoS only for a dedicated Background worker.
/// The worker boundary is intentionally narrow so a reused UI/runtime thread
/// cannot retain a background classification after its task completes.
pub fn apply_thread_qos(class: WorkClass) -> ThreadQosApplication {
    apply_thread_qos_with(class, set_current_thread_background_qos)
}

/// Scope best-effort background QoS to one admitted work unit. Analysis and
/// Content may run on reusable blocking-pool threads, so restore the native
/// default when the unit releases its WorkScheduler lease.
pub struct ThreadQosScope {
    reset_on_drop: bool,
}

pub fn scope_thread_qos(class: WorkClass) -> ThreadQosScope {
    ThreadQosScope {
        reset_on_drop: matches!(class, WorkClass::Background)
            && set_current_thread_background_qos(),
    }
}

impl Drop for ThreadQosScope {
    fn drop(&mut self) {
        if self.reset_on_drop {
            reset_current_thread_qos();
        }
    }
}

fn apply_thread_qos_with<F>(class: WorkClass, apply: F) -> ThreadQosApplication
where
    F: FnOnce() -> bool,
{
    if !matches!(class, WorkClass::Background) {
        return ThreadQosApplication::NotRequested;
    }
    if apply() {
        ThreadQosApplication::Applied
    } else {
        ThreadQosApplication::Failed
    }
}

#[cfg(target_os = "windows")]
fn set_current_thread_background_qos() -> bool {
    platform::windows::qos::set_current_thread_background_qos()
}

#[cfg(target_os = "windows")]
fn reset_current_thread_qos() {
    platform::windows::qos::reset_current_thread_power_throttling();
}

#[cfg(target_os = "macos")]
fn reset_current_thread_qos() {
    platform::macos::qos::reset_current_thread_qos();
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn reset_current_thread_qos() {}

#[cfg(target_os = "macos")]
fn set_current_thread_background_qos() -> bool {
    platform::macos::qos::set_current_thread_background_qos()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn set_current_thread_background_qos() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::{
        apply_thread_qos_with, ResourcePressureSnapshot, RuntimeResourceGovernor,
        ThreadQosApplication, WindowsPowerSnapshot,
    };
    use crate::{
        file_workspace::WorkClass,
        platform::macos::activity::{MacActivitySnapshot, MacThermalState},
        scheduler::ResourceCapacities,
    };

    fn capacities() -> ResourceCapacities {
        ResourceCapacities::new(8, 8, 64, 2, 1, 4)
    }

    #[test]
    fn windows_normal_power_keeps_background_capacity_and_battery_saver_defers_it() {
        let normal = RuntimeResourceGovernor::decision_for(
            ResourcePressureSnapshot::Windows(WindowsPowerSnapshot {
                battery_saver: Some(false),
                on_battery: Some(false),
            }),
            WorkClass::Background,
            capacities(),
        );
        assert!(normal.allow_background);
        assert_eq!(normal.effective_capacity.cpu, 8);

        let saver = RuntimeResourceGovernor::decision_for(
            ResourcePressureSnapshot::Windows(WindowsPowerSnapshot {
                battery_saver: Some(true),
                on_battery: Some(true),
            }),
            WorkClass::Background,
            capacities(),
        );
        assert!(!saver.allow_background);

        for class in [WorkClass::Foreground, WorkClass::Interactive] {
            let decision = RuntimeResourceGovernor::decision_for(
                ResourcePressureSnapshot::Windows(WindowsPowerSnapshot {
                    battery_saver: Some(true),
                    on_battery: Some(true),
                }),
                class,
                capacities(),
            );
            assert!(decision.allow_background);
            assert_eq!(decision.effective_capacity, capacities());
            assert!(!decision.efficiency_qos);
        }
    }

    #[test]
    fn battery_power_and_unknown_windows_facts_remain_bounded() {
        for snapshot in [
            ResourcePressureSnapshot::Windows(WindowsPowerSnapshot {
                battery_saver: Some(false),
                on_battery: Some(true),
            }),
            ResourcePressureSnapshot::Windows(WindowsPowerSnapshot {
                battery_saver: None,
                on_battery: None,
            }),
            ResourcePressureSnapshot::Unknown,
        ] {
            let decision = RuntimeResourceGovernor::decision_for(
                snapshot,
                WorkClass::Background,
                capacities(),
            );
            assert!(decision.allow_background);
            assert_eq!(decision.effective_capacity.cpu, 2);
            assert_eq!(decision.effective_capacity.io, 2);
            assert_eq!(decision.effective_capacity.provider_network, 2);
        }
    }

    #[test]
    fn mac_low_power_and_thermal_states_bound_or_defer_background_work() {
        let low_power = RuntimeResourceGovernor::decision_for(
            ResourcePressureSnapshot::MacOs(MacActivitySnapshot {
                thermal: MacThermalState::Nominal,
                low_power_mode: true,
            }),
            WorkClass::Background,
            capacities(),
        );
        assert!(low_power.allow_background);
        assert_eq!(low_power.effective_capacity.cpu, 2);
        assert_eq!(low_power.effective_capacity.io, 2);

        for thermal in [MacThermalState::Serious, MacThermalState::Critical] {
            let decision = RuntimeResourceGovernor::decision_for(
                ResourcePressureSnapshot::MacOs(MacActivitySnapshot {
                    thermal,
                    low_power_mode: false,
                }),
                WorkClass::Background,
                capacities(),
            );
            assert!(!decision.allow_background);
            assert!(decision.effective_capacity.cpu <= 2);
        }
    }

    #[test]
    fn unknown_macos_state_is_conservative_and_keeps_interactive_classes_available() {
        let unknown = RuntimeResourceGovernor::decision_for(
            ResourcePressureSnapshot::MacOs(MacActivitySnapshot {
                thermal: MacThermalState::Unknown,
                low_power_mode: false,
            }),
            WorkClass::Background,
            capacities(),
        );
        assert!(unknown.allow_background);
        assert_eq!(unknown.effective_capacity.cpu, 2);

        for class in [WorkClass::Foreground, WorkClass::Interactive] {
            let decision = RuntimeResourceGovernor::decision_for(
                ResourcePressureSnapshot::MacOs(MacActivitySnapshot {
                    thermal: MacThermalState::Critical,
                    low_power_mode: false,
                }),
                class,
                capacities(),
            );
            assert!(decision.allow_background);
            assert_eq!(decision.effective_capacity.cpu, 1);
        }
    }

    #[test]
    fn only_background_workers_receive_qos_and_native_failure_is_non_fatal() {
        for class in [WorkClass::Foreground, WorkClass::Interactive] {
            let decision = apply_thread_qos_with(class, || panic!("must not call native QoS"));
            assert_eq!(decision, ThreadQosApplication::NotRequested);
        }
        assert_eq!(
            apply_thread_qos_with(WorkClass::Background, || true),
            ThreadQosApplication::Applied
        );
        assert_eq!(
            apply_thread_qos_with(WorkClass::Background, || false),
            ThreadQosApplication::Failed
        );
    }
}
