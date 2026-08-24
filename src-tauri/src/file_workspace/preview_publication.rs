//! Bounded progressive publication contracts for Preview Core.
//!
//! This module owns only the publication update wire types and their
//! monotonic sequence guard. PreviewSession remains the lifecycle and
//! authority owner; it applies accepted updates to the current session
//! representation.

use super::preview::PreviewProviderResult;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewPublicationUpdate {
    pub sequence: u64,
    pub result: PreviewProviderResult,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum PreviewPublicationError {
    #[error("preview publication is stale")]
    StalePublication,
    #[error("preview publication sequence is out of order")]
    OutOfOrder,
    #[error("preview publication sequence is invalid")]
    InvalidSequence,
    #[error("preview representation is incompatible with the host")]
    HostIncompatible,
}

/// Provider-to-session callback for bounded progressive publication. The
/// callback updates one current representation under the session lock; it is
/// deliberately not an app-wide event bus or an unbounded queue.
pub trait PreviewPublicationSink: Send + Sync {
    fn publish(&self, update: PreviewPublicationUpdate) -> Result<(), PreviewPublicationError>;

    /// Allocate and publish the next sequence through the Preview Core-owned
    /// sequence authority. Providers use this helper for progressive output;
    /// the final coordinator continues to allocate its own next sequence.
    fn publish_next(&self, result: PreviewProviderResult) -> Result<(), PreviewPublicationError> {
        let _ = result;
        Err(PreviewPublicationError::InvalidSequence)
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct PublicationSequence {
    last: u64,
}

impl PublicationSequence {
    pub(crate) fn reset(&mut self) {
        self.last = 0;
    }

    pub(crate) fn next(&self) -> Result<u64, PreviewPublicationError> {
        self.last
            .checked_add(1)
            .ok_or(PreviewPublicationError::InvalidSequence)
    }

    pub(crate) fn accept(&mut self, sequence: u64) -> Result<(), PreviewPublicationError> {
        if sequence == 0 {
            return Err(PreviewPublicationError::InvalidSequence);
        }
        if sequence <= self.last {
            return Err(PreviewPublicationError::OutOfOrder);
        }
        self.last = sequence;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn publication_sequence_requires_strict_monotonic_progress() {
        let mut sequence = PublicationSequence::default();
        assert_eq!(sequence.next(), Ok(1));
        assert_eq!(
            sequence.accept(0),
            Err(PreviewPublicationError::InvalidSequence)
        );
        assert_eq!(sequence.accept(1), Ok(()));
        assert_eq!(sequence.next(), Ok(2));
        assert_eq!(sequence.accept(1), Err(PreviewPublicationError::OutOfOrder));
        assert_eq!(sequence.accept(3), Ok(()));
        sequence.reset();
        assert_eq!(sequence.next(), Ok(1));
    }
}
