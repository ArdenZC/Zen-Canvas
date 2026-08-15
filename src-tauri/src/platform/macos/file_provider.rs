//! File Provider domain and item identity probing.
//!
//! Generic providers expose a user-visible URL namespace to the application;
//! the native transaction boundary is supplied by `NSFileCoordinator` in the
//! mutation strategy. The item/domain pair is obtained only from the public
//! `NSFileProviderManager` bridge. Path and CloudStorage-domain detection are
//! routing hints only. NSURL's file-resource identifier and materialization
//! keys are diagnostic observations; they are never treated as the provider's
//! item/domain identity or as proof that third-party provider bytes are local.

use super::types::MacContentAvailability;
use std::path::{Path, PathBuf};

#[cfg(target_os = "macos")]
mod native_bridge {
    use block2::DynBlock;
    use objc2::rc::{Allocated, Retained};
    use objc2::runtime::NSObject;
    use objc2::AnyThread;
    use objc2::{extern_class, extern_conformance, extern_methods};
    use objc2_foundation::{NSError, NSObjectProtocol, NSRange, NSString, NSURL};

    #[link(name = "FileProvider", kind = "framework")]
    unsafe extern "C" {}

    extern_class!(
        #[unsafe(super(NSObject))]
        #[derive(Debug, PartialEq, Eq, Hash)]
        pub struct NSFileProviderManager;
    );

    extern_class!(
        #[unsafe(super(NSObject))]
        #[derive(Debug, PartialEq, Eq, Hash)]
        pub struct NSFileProviderDomain;
    );

    extern_conformance!(
        unsafe impl NSObjectProtocol for NSFileProviderManager {}
    );

    extern_conformance!(
        unsafe impl NSObjectProtocol for NSFileProviderDomain {}
    );

    impl NSFileProviderDomain {
        extern_methods!(
            #[unsafe(method(initWithIdentifier:displayName:))]
            #[unsafe(method_family = init)]
            pub unsafe fn init_with_identifier_display_name(
                this: Allocated<Self>,
                identifier: &NSString,
                display_name: &NSString,
            ) -> Retained<Self>;
        );
    }

    impl NSFileProviderManager {
        extern_methods!(
            #[unsafe(method(initForDomain:))]
            #[unsafe(method_family = init)]
            pub unsafe fn init_for_domain(
                this: Allocated<Self>,
                domain: &NSFileProviderDomain,
            ) -> Option<Retained<Self>>;

            /// # Safety
            ///
            /// The completion block must remain valid and sendable for the
            /// duration of the asynchronous File Provider callback.
            #[unsafe(method(getIdentifierForUserVisibleFileAtURL:completionHandler:))]
            pub unsafe fn get_identifier_for_user_visible_file_at_url_completion_handler(
                url: &NSURL,
                completion_handler: &DynBlock<
                    dyn Fn(*mut NSString, *mut NSFileProviderDomain, *mut NSError) + '_,
                >,
            );

            /// # Safety
            ///
            /// The completion block must remain valid and sendable for the
            /// duration of the asynchronous File Provider callback.
            #[unsafe(method(requestDownloadForItemWithIdentifier:requestedRange:completionHandler:))]
            pub unsafe fn request_download_for_item_with_identifier_requested_range_completion_handler(
                &self,
                item_identifier: &NSString,
                requested_range: NSRange,
                completion_handler: &DynBlock<dyn Fn(*mut NSError) + '_>,
            );
        );
    }

    impl NSFileProviderDomain {
        extern_methods!(
            #[unsafe(method(identifier))]
            #[unsafe(method_family = none)]
            pub fn identifier(&self) -> Retained<NSString>;
        );
    }

    pub fn manager_for_domain(
        identity: &super::MacFileProviderIdentity,
    ) -> Option<Retained<NSFileProviderManager>> {
        let identifier = NSString::from_str(&identity.domain_identifier);
        let display_name = NSString::from_str("Zen Canvas");
        let domain = unsafe {
            NSFileProviderDomain::init_with_identifier_display_name(
                NSFileProviderDomain::alloc(),
                &identifier,
                &display_name,
            )
        };
        unsafe { NSFileProviderManager::init_for_domain(NSFileProviderManager::alloc(), &domain) }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileProviderDomainState {
    NotDetected,
    KnownDomain,
}

/// The CloudStorage path is only a routing hint.  A native provider identity
/// is required before a provider transaction may claim a path or treat its
/// bytes as local.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacFileProviderDetection {
    None,
    CloudStorageNamespaceHint,
    NativeProviderIdentified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacProviderMaterialization {
    Materialized,
    NotMaterialized,
    Downloading,
    MetadataOnly,
    Unknown,
}

impl MacProviderMaterialization {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Materialized => "materialized",
            Self::NotMaterialized => "not_materialized",
            Self::Downloading => "downloading",
            Self::MetadataOnly => "metadata_only",
            Self::Unknown => "unknown",
        }
    }

    pub const fn content_availability(self) -> MacContentAvailability {
        match self {
            Self::Materialized => MacContentAvailability::Local,
            Self::NotMaterialized => MacContentAvailability::NotLocal,
            Self::Downloading => MacContentAvailability::Downloading,
            Self::MetadataOnly => MacContentAvailability::MetadataOnly,
            Self::Unknown => MacContentAvailability::Unknown,
        }
    }
}

/// Provider identity must come from the provider API.  An NSURL resource
/// identifier, POSIX dev/ino pair, or CloudStorage path is not a substitute
/// for this pair.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MacFileProviderIdentity {
    pub item_identifier: String,
    pub domain_identifier: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileProviderProbe {
    pub domain_state: FileProviderDomainState,
    pub detection: MacFileProviderDetection,
    pub materialization: MacProviderMaterialization,
    pub content_availability: MacContentAvailability,
    pub provider_identity: Option<MacFileProviderIdentity>,
}

/// The bridge is compiled against Apple's public FileProvider framework. A
/// runtime identity is still required for every item; a path alone never
/// enables provider mutation.
pub const GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE: bool = cfg!(target_os = "macos");
pub const GENERIC_FILE_PROVIDER_NATIVE_IDENTITY_AVAILABLE: bool = cfg!(target_os = "macos");
pub const GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE: bool =
    cfg!(target_os = "macos") && GENERIC_FILE_PROVIDER_NATIVE_IDENTITY_AVAILABLE;

#[cfg(target_os = "macos")]
fn materialized_provider_items(
) -> &'static std::sync::Mutex<std::collections::HashSet<(String, String)>> {
    static ITEMS: std::sync::OnceLock<
        std::sync::Mutex<std::collections::HashSet<(String, String)>>,
    > = std::sync::OnceLock::new();
    ITEMS.get_or_init(|| std::sync::Mutex::new(std::collections::HashSet::new()))
}

#[cfg(target_os = "macos")]
pub fn invalidate_materialized_provider_items() {
    if let Ok(mut items) = materialized_provider_items().lock() {
        items.clear();
    }
}

#[cfg(target_os = "macos")]
fn native_provider_identity(path: &Path) -> Option<MacFileProviderIdentity> {
    use block2::RcBlock;
    use objc2_foundation::{NSString, NSURL};
    use std::{sync::mpsc, time::Duration};

    let path = path.to_str()?;
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let (sender, receiver) = mpsc::sync_channel(1);
    let callback = RcBlock::new(
        move |item_identifier: *mut NSString,
              domain: *mut native_bridge::NSFileProviderDomain,
              error: *mut objc2_foundation::NSError| {
            let item_identifier =
                (!item_identifier.is_null()).then(|| unsafe { &*item_identifier }.to_string());
            let domain_identifier = (!domain.is_null()).then(|| unsafe {
                native_bridge::NSFileProviderDomain::identifier(&*domain).to_string()
            });
            let _ = sender.send((item_identifier, domain_identifier, !error.is_null()));
        },
    );
    unsafe {
        native_bridge::NSFileProviderManager::get_identifier_for_user_visible_file_at_url_completion_handler(
            &url,
            &callback,
        );
    }
    let (item_identifier, domain_identifier, failed) =
        receiver.recv_timeout(Duration::from_millis(250)).ok()?;
    if failed {
        return None;
    }
    let item_identifier = item_identifier?.trim().to_string();
    let domain_identifier = domain_identifier?.trim().to_string();
    (!item_identifier.is_empty() && !domain_identifier.is_empty()).then_some(
        MacFileProviderIdentity {
            item_identifier,
            domain_identifier,
        },
    )
}

#[cfg(target_os = "macos")]
pub fn request_download_for_item<F>(
    identity: &MacFileProviderIdentity,
    path: &Path,
    cancel: Option<&std::sync::atomic::AtomicBool>,
    mut progress: F,
) -> Result<(), &'static str>
where
    F: FnMut(u64, u64),
{
    use block2::RcBlock;
    use objc2_foundation::{NSNotFound, NSRange, NSString};
    use std::{
        fs::OpenOptions,
        io::Read,
        os::unix::fs::{MetadataExt, OpenOptionsExt},
        sync::{atomic::Ordering, mpsc},
        thread,
        time::Duration,
    };

    let manager =
        native_bridge::manager_for_domain(identity).ok_or("mac_provider_domain_unavailable")?;
    let item_identifier = NSString::from_str(&identity.item_identifier);
    let (sender, receiver) = mpsc::sync_channel(1);
    let callback = RcBlock::new(move |error: *mut objc2_foundation::NSError| {
        let _ = sender.send(error.is_null());
    });
    unsafe {
        manager.request_download_for_item_with_identifier_requested_range_completion_handler(
            &item_identifier,
            // Apple defines NSMakeRange(NSNotFound, 0) as the request for
            // the complete item; a zero-length range would only ask for an
            // empty extent on providers that support partial materialization.
            NSRange::new(NSNotFound as usize, 0),
            &callback,
        );
    }
    match receiver.recv_timeout(Duration::from_secs(30)) {
        Ok(false) => return Err("mac_provider_download_failed"),
        Err(_) => return Err("mac_provider_download_timeout"),
        Ok(true) => {}
    }

    // The completion handler acknowledges that the system accepted the
    // request; it does not mean that the provider has finished fetching the
    // bytes. Do not mark the item materialized until the requested full range
    // can be opened and consumed from the user-visible file.
    let total = std::fs::symlink_metadata(path)
        .map_err(|_| "mac_provider_item_unavailable")?
        .len();
    progress(0, total);
    for _ in 0..480 {
        if cancel.is_some_and(|flag| flag.load(Ordering::Acquire)) {
            return Err("mac_provider_materialization_cancelled");
        }
        match native_provider_identity(path) {
            Some(current) if current != *identity => return Err("mac_provider_url_changed"),
            None => {}
            Some(_) => {}
        }

        let metadata = match std::fs::symlink_metadata(path) {
            Ok(metadata) if metadata.is_file() => metadata,
            Ok(_) => return Err("mac_provider_item_unavailable"),
            Err(_) => {
                thread::sleep(Duration::from_millis(250));
                continue;
            }
        };
        let file = match OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW)
            .open(path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                return Err("mac_provider_permission_denied")
            }
            Err(_) => {
                thread::sleep(Duration::from_millis(250));
                continue;
            }
        };
        let opened_metadata = match file.metadata() {
            Ok(metadata) if metadata.is_file() => metadata,
            Ok(_) => return Err("mac_provider_url_changed"),
            Err(_) => {
                thread::sleep(Duration::from_millis(250));
                continue;
            }
        };
        if opened_metadata.dev() != metadata.dev()
            || opened_metadata.ino() != metadata.ino()
            || opened_metadata.len() != metadata.len()
        {
            continue;
        }
        let expected_size = metadata.len();
        let mut read_bytes = 0_u64;
        let mut buffer = [0_u8; 1024 * 1024];
        let read_complete = loop {
            if cancel.is_some_and(|flag| flag.load(Ordering::Acquire)) {
                return Err("mac_provider_materialization_cancelled");
            }
            match (&file).read(&mut buffer) {
                Ok(0) => break read_bytes == expected_size,
                Ok(count) => {
                    read_bytes = read_bytes.saturating_add(count as u64);
                    progress(read_bytes.min(expected_size), expected_size);
                }
                Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                    return Err("mac_provider_permission_denied")
                }
                Err(_) => break false,
            }
        };
        if read_complete {
            match native_provider_identity(path) {
                Some(current) if current == *identity => {
                    if let Ok(mut items) = materialized_provider_items().lock() {
                        items.insert((
                            identity.item_identifier.clone(),
                            identity.domain_identifier.clone(),
                        ));
                    }
                    progress(expected_size, expected_size);
                    return Ok(());
                }
                Some(_) => return Err("mac_provider_url_changed"),
                None => {}
            }
        }
        thread::sleep(Duration::from_millis(250));
    }
    Err("mac_provider_download_timeout")
}

pub fn inspect(path: &Path) -> FileProviderProbe {
    #[cfg(target_os = "macos")]
    if let Some(provider_identity) = native_provider_identity(path) {
        let materialized = materialized_provider_items()
            .lock()
            .ok()
            .is_some_and(|items| {
                items.contains(&(
                    provider_identity.item_identifier.clone(),
                    provider_identity.domain_identifier.clone(),
                ))
            });
        let materialization = if materialized {
            MacProviderMaterialization::Materialized
        } else {
            match native_resource_probe(path) {
                // Generic File Provider domains do not consistently expose
                // iCloud's ubiquitous-item resource keys. Without a positive
                // materialization proof, route to the explicit download
                // action rather than treating metadata as local bytes.
                MacProviderMaterialization::Unknown => MacProviderMaterialization::NotMaterialized,
                observed => observed,
            }
        };
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            detection: MacFileProviderDetection::NativeProviderIdentified,
            content_availability: materialization.content_availability(),
            materialization,
            provider_identity: Some(provider_identity),
        };
    }

    if is_known_cloud_storage_path(path) {
        #[cfg(target_os = "macos")]
        let materialization = native_resource_probe(path);
        #[cfg(not(target_os = "macos"))]
        let materialization = MacProviderMaterialization::Unknown;
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            detection: MacFileProviderDetection::CloudStorageNamespaceHint,
            content_availability: materialization.content_availability(),
            materialization,
            provider_identity: None,
        };
    }

    FileProviderProbe {
        domain_state: FileProviderDomainState::NotDetected,
        detection: MacFileProviderDetection::None,
        materialization: MacProviderMaterialization::Unknown,
        content_availability: MacContentAvailability::Unknown,
        provider_identity: None,
    }
}

fn is_known_cloud_storage_path(path: &Path) -> bool {
    let Some(home) = native_home_directory() else {
        return false;
    };
    let root = home.join("Library").join("CloudStorage");
    path == root || path.starts_with(root)
}

#[cfg(target_os = "macos")]
fn native_resource_probe(path: &Path) -> MacProviderMaterialization {
    use objc2_foundation::{
        NSArray, NSMetadataUbiquitousItemDownloadingStatusCurrent,
        NSMetadataUbiquitousItemDownloadingStatusDownloaded, NSNumber, NSString,
        NSURLFileResourceIdentifierKey, NSURLIsUbiquitousItemKey,
        NSURLUbiquitousItemDownloadingStatusKey, NSURL,
    };

    let Some(path) = path.to_str() else {
        return MacProviderMaterialization::Unknown;
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let identity_key = unsafe { NSURLFileResourceIdentifierKey };
    let ubiquitous_key = unsafe { NSURLIsUbiquitousItemKey };
    let downloading_status_key = unsafe { NSURLUbiquitousItemDownloadingStatusKey };
    let keys = NSArray::from_slice(&[identity_key, ubiquitous_key, downloading_status_key]);
    let Ok(values) = url.resourceValuesForKeys_error(&keys) else {
        return MacProviderMaterialization::Unknown;
    };

    // NSURLFileResourceIdentifierKey is useful diagnostic metadata, but it
    // is not the File Provider item/domain identity.  Read it only to make
    // the deliberate non-use explicit and prevent a future path-based
    // identity shortcut.
    let _resource_identifier = values.objectForKey(identity_key).and_then(|value| {
        value
            .clone()
            .downcast::<NSString>()
            .ok()
            .map(|value| value.to_string())
            .or_else(|| {
                value
                    .downcast::<NSNumber>()
                    .ok()
                    .map(|value| value.as_i64().to_string())
            })
    });
    let is_ubiquitous = values
        .objectForKey(ubiquitous_key)
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .map(|value| value.as_bool());
    let is_downloaded = values
        .objectForKey(downloading_status_key)
        .and_then(|value| value.downcast::<NSString>().ok())
        .map(|value| {
            value.isEqualToString(unsafe { NSMetadataUbiquitousItemDownloadingStatusCurrent })
                || value
                    .isEqualToString(unsafe { NSMetadataUbiquitousItemDownloadingStatusDownloaded })
        });
    match (is_ubiquitous, is_downloaded) {
        // A false iCloud flag says only that this is not an iCloud ubiquitous
        // item. It does not prove that a third-party File Provider has local
        // bytes, so remain conservative.
        (Some(false), _) => MacProviderMaterialization::Unknown,
        (Some(true), Some(true)) => MacProviderMaterialization::Materialized,
        (Some(true), Some(false)) => MacProviderMaterialization::NotMaterialized,
        _ => MacProviderMaterialization::Unknown,
    }
}

/// Returns the current user's home directory from Foundation rather than from
/// an environment variable. A hostile or incomplete environment must never
/// make a provider-like path look local.
#[cfg(target_os = "macos")]
pub(crate) fn native_home_directory() -> Option<PathBuf> {
    use objc2_foundation::NSHomeDirectory;

    let home = NSHomeDirectory();
    let text = home.to_string();
    (!text.is_empty()).then(|| PathBuf::from(text))
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn native_home_directory() -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::{
        inspect, FileProviderDomainState, MacFileProviderDetection, MacProviderMaterialization,
        GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE,
    };
    use std::path::Path;

    #[test]
    fn generic_provider_awareness_is_platform_scoped() {
        let probe = inspect(Path::new("/Users/example/Documents/report.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::NotDetected);
        assert_eq!(probe.provider_identity, None);
        assert_eq!(probe.detection, MacFileProviderDetection::None);
    }

    #[test]
    fn known_cloud_storage_roots_are_deferred_without_materialization() {
        let Some(home) = super::native_home_directory() else {
            return;
        };
        let probe = inspect(&home.join("Library/CloudStorage/Provider/item.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::KnownDomain);
        assert_eq!(
            probe.detection,
            MacFileProviderDetection::CloudStorageNamespaceHint
        );
        assert_eq!(probe.provider_identity, None);
        assert_eq!(probe.materialization, MacProviderMaterialization::Unknown);
        assert_eq!(
            probe.content_availability,
            super::MacContentAvailability::Unknown
        );
    }

    #[test]
    fn generic_provider_mutation_capability_matches_the_compiled_native_bridge() {
        assert_eq!(
            GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE,
            cfg!(target_os = "macos")
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn ordinary_fixture_never_gets_provider_identity_from_path_or_posix_metadata() {
        let root =
            std::env::temp_dir().join(format!("zen-canvas-provider-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("provider fixture");
        let probe = inspect(&root.join("ordinary.txt"));
        assert_ne!(
            probe.detection,
            MacFileProviderDetection::NativeProviderIdentified
        );
        assert_eq!(probe.provider_identity, None);
        std::fs::remove_dir_all(root).expect("remove provider fixture");
    }
}
