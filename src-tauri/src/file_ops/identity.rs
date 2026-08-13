use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct FileIdentityFingerprint {
    pub(crate) size: u64,
    pub(crate) modified_ns: Option<i128>,
    pub(crate) platform_volume_id: Option<String>,
    pub(crate) platform_file_id: Option<String>,
    pub(crate) quick_hash: Option<String>,
    pub(crate) full_hash: Option<String>,
}

pub(crate) fn file_identity_fingerprint(path: &Path) -> Result<FileIdentityFingerprint, String> {
    let identity =
        crate::fs_safety::capture_identity(path, None).map_err(|error| error.to_string())?;
    Ok(FileIdentityFingerprint {
        size: identity.size,
        modified_ns: identity.modified_ns,
        platform_volume_id: identity.platform_volume_id,
        platform_file_id: identity.platform_file_id,
        quick_hash: identity.sample_hash,
        full_hash: identity.full_hash,
    })
}
