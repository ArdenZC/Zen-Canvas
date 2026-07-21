pub mod atomic_move;
#[cfg(any(windows, test))]
pub mod copy_commit;
pub mod identity;
pub mod path_guard;
pub mod platform_support;
pub mod source_claim;
pub mod verified_directory;

pub use atomic_move::{
    atomic_move_noreplace, atomic_move_noreplace_with_claim_path, AtomicMoveError,
    AtomicMoveMethod, AtomicMoveOutcome,
};
pub use identity::{
    capture_identity, identity_matches, recovery_identity_matches, ExpectedFileIdentity,
    IdentityError,
};
pub use path_guard::{create_directory_chain_no_links, PathGuardError};
pub use platform_support::{
    ensure_supported_cleanup_mutation, ensure_supported_file_mutation, PlatformSupportError,
    MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED, UNSUPPORTED_PLATFORM_LINUX,
};
pub use source_claim::{
    claim_source, claim_source_at, planned_claim_path, ClaimedEntryKind, SourceClaim,
    SourceClaimError,
};
pub use verified_directory::{DirectoryIdentity, VerifiedDirectory};

pub(crate) type PhaseObserver<'a> = dyn FnMut(&str) -> Result<(), AtomicMoveError> + 'a;
