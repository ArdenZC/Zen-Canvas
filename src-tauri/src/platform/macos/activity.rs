//! Bounded Apple Silicon activity policy for user work and background jobs.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacThermalState {
    Nominal,
    Fair,
    Serious,
    Critical,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MacActivitySnapshot {
    pub thermal: MacThermalState,
    pub low_power_mode: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MacActivityPolicy {
    pub max_parallelism: usize,
    pub allow_nonessential_background_work: bool,
}

impl MacActivitySnapshot {
    pub fn current() -> Self {
        #[cfg(target_os = "macos")]
        {
            use objc2_foundation::{NSProcessInfo, NSProcessInfoThermalState};
            let process = NSProcessInfo::processInfo();
            let thermal = match process.thermalState() {
                NSProcessInfoThermalState::Nominal => MacThermalState::Nominal,
                NSProcessInfoThermalState::Fair => MacThermalState::Fair,
                NSProcessInfoThermalState::Serious => MacThermalState::Serious,
                NSProcessInfoThermalState::Critical => MacThermalState::Critical,
                _ => MacThermalState::Unknown,
            };
            return Self {
                thermal,
                low_power_mode: process.isLowPowerModeEnabled(),
            };
        }

        #[cfg(not(target_os = "macos"))]
        {
            Self {
                thermal: MacThermalState::Unknown,
                low_power_mode: false,
            }
        }
    }
}

pub fn policy_for(
    snapshot: MacActivitySnapshot,
    requested_parallelism: usize,
    background: bool,
) -> MacActivityPolicy {
    let requested_parallelism = requested_parallelism.max(1);
    if matches!(snapshot.thermal, MacThermalState::Critical) {
        return MacActivityPolicy {
            max_parallelism: 1,
            allow_nonessential_background_work: false,
        };
    }
    if matches!(snapshot.thermal, MacThermalState::Serious) {
        return MacActivityPolicy {
            max_parallelism: requested_parallelism.min(2),
            allow_nonessential_background_work: !background,
        };
    }
    if snapshot.low_power_mode || background {
        return MacActivityPolicy {
            max_parallelism: requested_parallelism.min(2),
            allow_nonessential_background_work: true,
        };
    }
    MacActivityPolicy {
        max_parallelism: requested_parallelism,
        allow_nonessential_background_work: true,
    }
}

pub const AVAILABLE: bool = cfg!(target_os = "macos");

#[cfg(test)]
mod tests {
    use super::{policy_for, MacActivitySnapshot, MacThermalState};

    #[test]
    fn low_power_background_work_is_bounded() {
        let policy = policy_for(
            MacActivitySnapshot {
                thermal: MacThermalState::Nominal,
                low_power_mode: true,
            },
            8,
            true,
        );
        assert_eq!(policy.max_parallelism, 2);
        assert!(policy.allow_nonessential_background_work);
    }

    #[test]
    fn critical_thermal_state_pauses_nonessential_work() {
        let policy = policy_for(
            MacActivitySnapshot {
                thermal: MacThermalState::Critical,
                low_power_mode: false,
            },
            8,
            true,
        );
        assert_eq!(policy.max_parallelism, 1);
        assert!(!policy.allow_nonessential_background_work);
    }

    #[test]
    fn foreground_work_keeps_requested_parallelism_when_healthy() {
        let policy = policy_for(
            MacActivitySnapshot {
                thermal: MacThermalState::Nominal,
                low_power_mode: false,
            },
            4,
            false,
        );
        assert_eq!(policy.max_parallelism, 4);
    }
}
