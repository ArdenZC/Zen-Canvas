pub mod atomic_move;
pub mod copy_commit;
pub mod identity;
pub mod path_guard;
pub mod platform_support;

pub use atomic_move::{
    atomic_move_noreplace, AtomicMoveError, AtomicMoveMethod, AtomicMoveOutcome,
};
pub use identity::{
    capture_identity, identity_matches, recovery_identity_matches, ExpectedFileIdentity,
    IdentityError,
};
pub use path_guard::{create_directory_chain_no_links, PathGuardError};
pub use platform_support::{
    ensure_supported_cleanup_mutation, ensure_supported_file_mutation, PlatformSupportError,
    UNSUPPORTED_PLATFORM_LINUX,
};
