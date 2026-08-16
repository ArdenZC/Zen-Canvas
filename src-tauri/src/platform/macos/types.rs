//! Shared descriptive macOS file semantics.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacCloudBacking {
    Local,
    ICloud,
    FileProvider,
    Unknown,
}

impl MacCloudBacking {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::ICloud => "icloud",
            Self::FileProvider => "file_provider",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacContentAvailability {
    Local,
    BoundaryReadable,
    NotLocal,
    Downloading,
    MetadataOnly,
    Unknown,
}

impl MacContentAvailability {
    pub const fn is_local(self) -> bool {
        matches!(self, Self::Local)
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::BoundaryReadable => "boundary_readable",
            Self::NotLocal => "not_local",
            Self::Downloading => "downloading",
            Self::MetadataOnly => "metadata_only",
            Self::Unknown => "unknown",
        }
    }
}
