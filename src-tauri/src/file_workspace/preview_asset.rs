//! Bounded Preview-specific asset publication and retrieval.
//!
//! Asset bytes are an ephemeral projection owned by one Preview runtime. The
//! registry is not a file server: providers submit already-authorized bounded
//! bytes through the Preview environment and consumers must present the exact
//! session/request/sourceVersion/token tuple to retrieve them.

use super::preview::{PreviewAssetError, PreviewAssetPublisher, PreviewOperationContext};
#[cfg(test)]
use std::sync::Condvar;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, MutexGuard},
    time::{Duration, Instant},
};
use thiserror::Error;
use uuid::Uuid;

pub(crate) const MAX_PREVIEW_ASSETS: usize = 64;
pub(crate) const MAX_PREVIEW_ASSET_BYTES: usize = 16 * 1024 * 1024;
pub(crate) const MAX_PREVIEW_ASSET_TOTAL_BYTES: usize = 32 * 1024 * 1024;
pub(crate) const PREVIEW_ASSET_TTL: Duration = Duration::from_secs(30);
const MAX_MEDIA_TYPE_BYTES: usize = 256;

fn lock<T>(value: &Mutex<T>) -> MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PreviewAssetArtifact {
    pub(crate) media_type: String,
    pub(crate) bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PreviewAssetRequest {
    pub(crate) session_id: String,
    pub(crate) request_id: String,
    pub(crate) source_version: String,
    pub(crate) asset_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub(crate) enum PreviewAssetReadError {
    #[error("preview asset token is invalid or stale")]
    InvalidOrStale,
    #[error("preview asset registry is disposed")]
    Disposed,
}

#[derive(Debug)]
struct AssetRecord {
    session_id: String,
    request_id: String,
    source_version: String,
    media_type: String,
    bytes: Vec<u8>,
    expires_at: Instant,
}

#[derive(Debug, Default)]
struct AssetState {
    records: HashMap<String, AssetRecord>,
    total_bytes: usize,
    disposed: bool,
}

#[cfg(test)]
#[derive(Debug, Default)]
struct RevokeGateState {
    entered: bool,
    released: bool,
}

#[cfg(test)]
#[derive(Debug, Default)]
pub(crate) struct PreviewAssetRevokeGate {
    state: Mutex<RevokeGateState>,
    wake: Condvar,
}

#[cfg(test)]
impl PreviewAssetRevokeGate {
    pub(crate) fn wait_until_entered(&self) {
        let mut state = lock(&self.state);
        while !state.entered {
            state = self
                .wake
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }

    pub(crate) fn release(&self) {
        let mut state = lock(&self.state);
        state.released = true;
        self.wake.notify_all();
    }

    fn pause(&self) {
        let mut state = lock(&self.state);
        state.entered = true;
        self.wake.notify_all();
        while !state.released {
            state = self
                .wake
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }
}

/// Process-local, bounded and disposable Preview asset owner.
#[derive(Debug)]
pub(crate) struct PreviewAssetRegistry {
    state: Mutex<AssetState>,
    #[cfg(test)]
    revoke_gate: Mutex<Option<Arc<PreviewAssetRevokeGate>>>,
}

impl PreviewAssetRegistry {
    pub(crate) fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(AssetState::default()),
            #[cfg(test)]
            revoke_gate: Mutex::new(None),
        })
    }

    pub(crate) fn read(
        &self,
        request: &PreviewAssetRequest,
    ) -> Result<PreviewAssetArtifact, PreviewAssetReadError> {
        if !valid_opaque(&request.session_id)
            || !valid_opaque(&request.request_id)
            || !valid_opaque(&request.source_version)
            || !valid_opaque(&request.asset_token)
            || request.asset_token.contains('/')
            || request.asset_token.contains('\\')
        {
            return Err(PreviewAssetReadError::InvalidOrStale);
        }
        let mut state = lock(&self.state);
        if state.disposed {
            return Err(PreviewAssetReadError::Disposed);
        }
        prune_expired(&mut state);
        let record = state
            .records
            .get(request.asset_token.as_str())
            .ok_or(PreviewAssetReadError::InvalidOrStale)?;
        if record.session_id != request.session_id
            || record.request_id != request.request_id
            || record.source_version != request.source_version
        {
            return Err(PreviewAssetReadError::InvalidOrStale);
        }
        Ok(PreviewAssetArtifact {
            media_type: record.media_type.clone(),
            bytes: record.bytes.clone(),
        })
    }

    pub(crate) fn revoke_session(&self, session_id: &str) {
        let mut state = lock(&self.state);
        remove_where(&mut state, |record| record.session_id == session_id);
        drop(state);
        #[cfg(test)]
        self.pause_after_revoke_for_test();
    }

    #[cfg(test)]
    pub(crate) fn set_revoke_gate_for_test(&self, gate: Option<Arc<PreviewAssetRevokeGate>>) {
        *lock(&self.revoke_gate) = gate;
    }

    #[cfg(test)]
    fn pause_after_revoke_for_test(&self) {
        let gate = lock(&self.revoke_gate).clone();
        if let Some(gate) = gate {
            gate.pause();
        }
    }

    #[cfg(test)]
    pub(crate) fn revoke_request(&self, session_id: &str, request_id: &str) {
        let mut state = lock(&self.state);
        remove_where(&mut state, |record| {
            record.session_id == session_id && record.request_id == request_id
        });
    }

    pub(crate) fn dispose(&self) {
        let mut state = lock(&self.state);
        state.records.clear();
        state.total_bytes = 0;
        state.disposed = true;
    }

    #[cfg(test)]
    pub(crate) fn counts(&self) -> (usize, usize) {
        let mut state = lock(&self.state);
        prune_expired(&mut state);
        (state.records.len(), state.total_bytes)
    }
}

impl PreviewAssetPublisher for PreviewAssetRegistry {
    fn publish_asset(
        &self,
        context: &PreviewOperationContext,
        media_type: &str,
        bytes: Vec<u8>,
    ) -> Result<String, PreviewAssetError> {
        context.ensure_active().map_err(|error| match error {
            super::preview::PreviewContextError::Cancelled => PreviewAssetError::Cancelled,
            super::preview::PreviewContextError::TimedOut
            | super::preview::PreviewContextError::StalePublication => {
                PreviewAssetError::StalePublication
            }
        })?;
        if media_type.is_empty()
            || media_type.len() > MAX_MEDIA_TYPE_BYTES
            || media_type.bytes().any(|byte| byte.is_ascii_control())
        {
            return Err(PreviewAssetError::InvalidMediaType);
        }
        if bytes.len() > MAX_PREVIEW_ASSET_BYTES {
            return Err(PreviewAssetError::OutputTooLarge);
        }

        let mut state = lock(&self.state);
        if state.disposed {
            return Err(PreviewAssetError::Disposed);
        }
        prune_expired(&mut state);
        let new_total = state
            .total_bytes
            .checked_add(bytes.len())
            .ok_or(PreviewAssetError::CapacityExceeded)?;
        if state.records.len() >= MAX_PREVIEW_ASSETS || new_total > MAX_PREVIEW_ASSET_TOTAL_BYTES {
            return Err(PreviewAssetError::CapacityExceeded);
        }
        let source_version = context
            .source_version()
            .ok_or(PreviewAssetError::StalePublication)?
            .to_string();
        let token = format!("preview-asset-{}", Uuid::new_v4());
        state.total_bytes = new_total;
        state.records.insert(
            token.clone(),
            AssetRecord {
                session_id: context.session_id().to_string(),
                request_id: context.request_id().to_string(),
                source_version,
                media_type: media_type.to_string(),
                bytes,
                expires_at: Instant::now() + PREVIEW_ASSET_TTL,
            },
        );
        Ok(token)
    }
}

fn prune_expired(state: &mut AssetState) {
    let now = Instant::now();
    remove_where(state, |record| record.expires_at <= now);
}

fn remove_where<F>(state: &mut AssetState, mut predicate: F)
where
    F: FnMut(&AssetRecord) -> bool,
{
    let tokens: Vec<String> = state
        .records
        .iter()
        .filter(|(_, record)| predicate(record))
        .map(|(token, _)| token.clone())
        .collect();
    for token in tokens {
        if let Some(record) = state.records.remove(&token) {
            state.total_bytes = state.total_bytes.saturating_sub(record.bytes.len());
        }
    }
}

fn valid_opaque(value: &str) -> bool {
    !value.is_empty() && value.len() <= 4096 && !value.contains('\0')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::preview::{PreviewCancellation, PreviewOperationContext};
    use std::time::Instant;

    fn context(
        session_id: &str,
        request_id: &str,
        source_version: &str,
    ) -> PreviewOperationContext {
        PreviewOperationContext::for_backend_content_read(
            session_id,
            request_id,
            source_version,
            PreviewCancellation::default(),
            Instant::now() + Duration::from_secs(5),
        )
    }

    #[test]
    fn asset_is_opaque_bound_and_revocable() {
        let registry = PreviewAssetRegistry::new();
        let context = context("preview-1", "request-1", "version-1");
        let token = registry
            .publish_asset(&context, "image/png", vec![1, 2, 3])
            .expect("publish asset");
        assert!(token.starts_with("preview-asset-"));
        assert!(!token.contains('/') && !token.contains('\\'));
        let artifact = registry
            .read(&PreviewAssetRequest {
                session_id: "preview-1".to_string(),
                request_id: "request-1".to_string(),
                source_version: "version-1".to_string(),
                asset_token: token.clone(),
            })
            .expect("read asset");
        assert_eq!(artifact.media_type, "image/png");
        assert_eq!(artifact.bytes, vec![1, 2, 3]);
        assert_eq!(
            registry.read(&PreviewAssetRequest {
                session_id: "preview-2".to_string(),
                request_id: "request-1".to_string(),
                source_version: "version-1".to_string(),
                asset_token: token.clone(),
            }),
            Err(PreviewAssetReadError::InvalidOrStale)
        );
        registry.revoke_request("preview-1", "request-1");
        assert_eq!(registry.counts(), (0, 0));
        assert_eq!(
            registry.read(&PreviewAssetRequest {
                session_id: "preview-1".to_string(),
                request_id: "request-1".to_string(),
                source_version: "version-1".to_string(),
                asset_token: token,
            }),
            Err(PreviewAssetReadError::InvalidOrStale)
        );
    }

    #[test]
    fn capacity_and_size_are_bounded() {
        let registry = PreviewAssetRegistry::new();
        let context = context("preview-1", "request-1", "version-1");
        assert_eq!(
            registry.publish_asset(&context, "image/png", vec![0; MAX_PREVIEW_ASSET_BYTES + 1]),
            Err(PreviewAssetError::OutputTooLarge)
        );
        assert_eq!(
            registry.publish_asset(&context, "", vec![1]),
            Err(PreviewAssetError::InvalidMediaType)
        );
        registry.dispose();
        assert_eq!(
            registry.publish_asset(&context, "image/png", vec![1]),
            Err(PreviewAssetError::Disposed)
        );
    }
}
