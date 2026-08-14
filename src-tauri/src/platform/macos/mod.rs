//! macOS Foundation-backed file, package, cloud, and volume metadata.

#[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
compile_error!("Zen Canvas macOS builds require Apple Silicon (aarch64)");

pub mod cloud_item;
pub mod file_provider;
pub mod file_semantics;
pub mod finder;
pub mod package;
pub mod types;
pub mod volume;

pub use file_semantics::{MacContentReadEligibility, MacFileSemantics};
pub use types::{MacCloudBacking, MacContentAvailability};
pub use volume::MacVolumeSemantics;

#[cfg(target_os = "macos")]
pub fn operating_system_version() -> Option<String> {
    use objc2_foundation::NSProcessInfo;

    Some(
        NSProcessInfo::processInfo()
            .operatingSystemVersionString()
            .to_string(),
    )
}

#[cfg(not(target_os = "macos"))]
pub fn operating_system_version() -> Option<String> {
    None
}
