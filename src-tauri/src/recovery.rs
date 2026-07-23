#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RecoveryErrorCode {
    ClaimIdentityMismatch,
    ClaimIdentityUnreadable,
    TargetCommittedIdentityMismatch,
    TargetCommittedIdentityUnreadable,
    RestoreSourceIdentityMismatch,
    RestoreSourceIdentityUnreadable,
    RestoreSourcePathReappeared,
    TargetCommittedDurabilityUnknown,
    RestorePendingReconciliation,
    TargetCommittedSourceCleanupPending,
    TargetCommittedSourceDeleteFailed,
    ManualReviewRequired,
}

impl RecoveryErrorCode {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::ClaimIdentityMismatch => "claim_identity_mismatch",
            Self::ClaimIdentityUnreadable => "claim_identity_unreadable",
            Self::TargetCommittedIdentityMismatch => "target_committed_identity_mismatch",
            Self::TargetCommittedIdentityUnreadable => "target_committed_identity_unreadable",
            Self::RestoreSourceIdentityMismatch => "restore_source_identity_mismatch",
            Self::RestoreSourceIdentityUnreadable => "restore_source_identity_unreadable",
            Self::RestoreSourcePathReappeared => "restore_source_path_reappeared",
            Self::TargetCommittedDurabilityUnknown => "target_committed_durability_unknown",
            Self::RestorePendingReconciliation => "restore_pending_reconciliation",
            Self::TargetCommittedSourceCleanupPending => "target_committed_source_cleanup_pending",
            Self::TargetCommittedSourceDeleteFailed => "target_committed_source_delete_failed",
            Self::ManualReviewRequired => "manual_review_required",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RecoveryFailure {
    pub(crate) code: RecoveryErrorCode,
    pub(crate) detail: String,
}

impl RecoveryFailure {
    pub(crate) fn new(code: RecoveryErrorCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
        }
    }

    pub(crate) fn message(&self) -> String {
        format_recovery_message(self.code, &self.detail)
    }
}

pub(crate) fn format_recovery_message(code: RecoveryErrorCode, detail: &str) -> String {
    let detail = detail.trim();
    if detail.is_empty() {
        code.as_str().to_string()
    } else {
        format!("{}: {detail}", code.as_str())
    }
}
