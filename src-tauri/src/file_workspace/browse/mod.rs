//! Session-scoped, non-durable Browse enumeration.
//!
//! This module deliberately accepts only a backend-resolved directory and
//! publishes only the W1-01 opaque workspace references.  It does not admit
//! scan roots, write managed state, or authorize reads or mutations.

#![allow(dead_code)]

use super::{BrowseEnumerationRef, BrowsePathRef, EntryRef, LocationRef, MaterializationState};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::fs::{self, DirEntry, ReadDir};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;
use uuid::Uuid;

const MAX_ID_LENGTH: usize = 256;

/// A directory already resolved and authorized by backend code.
///
/// The constructor is crate-visible so a future integration layer can pass a
/// backend-owned resolution result without accepting a renderer-supplied raw
/// path.  The path never crosses the Browse page/ref boundary.
#[derive(Debug, Clone)]
pub(crate) struct BackendResolvedDirectory {
    path: PathBuf,
}

impl BackendResolvedDirectory {
    pub(crate) fn from_backend_path(path: PathBuf) -> Result<Self, BrowseError> {
        validate_directory_path(&path)?;
        Ok(Self { path })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct BrowseLimits {
    pub(crate) max_sessions: usize,
    pub(crate) max_page_size: usize,
    pub(crate) max_path_refs: usize,
    pub(crate) max_entry_refs: usize,
}

impl Default for BrowseLimits {
    fn default() -> Self {
        Self {
            max_sessions: 32,
            max_page_size: 256,
            max_path_refs: 1_024,
            max_entry_refs: 4_096,
        }
    }
}

impl BrowseLimits {
    fn validate(self) -> Result<Self, BrowseError> {
        if self.max_sessions == 0
            || self.max_page_size == 0
            || self.max_path_refs == 0
            || self.max_entry_refs < self.max_page_size
        {
            return Err(BrowseError::InvalidLimits);
        }
        Ok(self)
    }

    fn page_size(self, requested: usize) -> Result<usize, BrowseError> {
        if requested == 0 {
            return Err(BrowseError::InvalidPageSize);
        }
        Ok(requested.min(self.max_page_size))
    }
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BrowseError {
    #[error("browse_session_not_found")]
    SessionNotFound,
    #[error("browse_session_capacity_exceeded")]
    SessionCapacityExceeded,
    #[error("browse_path_ref_invalid")]
    InvalidPathRef,
    #[error("browse_entry_ref_invalid")]
    InvalidEntryRef,
    #[error("browse_target_not_directory")]
    TargetNotDirectory,
    #[error("browse_directory_permission_denied")]
    DirectoryPermissionDenied,
    #[error("browse_directory_not_found")]
    DirectoryNotFound,
    #[error("browse_directory_unavailable")]
    DirectoryUnavailable,
    #[error("browse_entry_permission_denied")]
    EntryPermissionDenied,
    #[error("browse_entry_not_found")]
    EntryNotFound,
    #[error("browse_entry_unavailable")]
    EntryUnavailable,
    #[error("browse_unsupported_entry")]
    UnsupportedEntry,
    #[error("browse_cursor_invalid")]
    InvalidCursor,
    #[error("browse_enumeration_stale")]
    StaleEnumeration,
    #[error("browse_publication_stale")]
    StalePublication,
    #[error("browse_cancelled")]
    Cancelled,
    #[error("browse_request_invalid")]
    InvalidRequest,
    #[error("browse_page_size_invalid")]
    InvalidPageSize,
    #[error("browse_limits_invalid")]
    InvalidLimits,
    #[error("browse_temporary_state_unavailable")]
    StateUnavailable,
    #[error("browse_temporary_state_capacity_exceeded")]
    TemporaryStateCapacityExceeded,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowseCompletion {
    Partial,
    Complete,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowseEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EphemeralBrowseEntry {
    #[serde(rename = "ref")]
    pub(crate) entry_ref: EntryRef,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) path_ref: Option<BrowsePathRef>,
    pub(crate) name: String,
    /// Presentation only.  This value is never accepted as a resolver input.
    pub(crate) display_path: String,
    pub(crate) kind: BrowseEntryKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) extension: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) modified_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) created_at: Option<i64>,
    pub(crate) materialization: MaterializationState,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowsePage {
    pub(crate) session_id: String,
    pub(crate) request_id: String,
    pub(crate) enumeration_id: String,
    pub(crate) entries: Vec<EphemeralBrowseEntry>,
    pub(crate) next_cursor: Option<String>,
    pub(crate) completion: BrowseCompletion,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) known_count: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BrowseSessionInfo {
    pub(crate) session_id: String,
    pub(crate) location: LocationRef,
    pub(crate) root_path_ref: BrowsePathRef,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedBrowseEntry {
    pub(crate) path: PathBuf,
    pub(crate) kind: BrowseEntryKind,
}

#[cfg(test)]
#[derive(Debug, Default)]
struct TestPublishGate {
    state: Mutex<TestPublishGateState>,
    wake: std::sync::Condvar,
}

#[cfg(test)]
#[derive(Debug, Default)]
struct TestPublishGateState {
    reached: bool,
    release: bool,
}

#[cfg(test)]
impl TestPublishGate {
    fn pause(&self) {
        let mut state = self.state.lock().expect("test publish gate lock");
        state.reached = true;
        self.wake.notify_all();
        while !state.release {
            state = self.wake.wait(state).expect("test publish gate wait");
        }
    }

    fn wait_until_reached(&self) {
        let mut state = self.state.lock().expect("test publish gate lock");
        while !state.reached {
            state = self.wake.wait(state).expect("test publish gate wait");
        }
    }

    fn release(&self) {
        let mut state = self.state.lock().expect("test publish gate lock");
        state.release = true;
        self.wake.notify_all();
    }
}

#[derive(Debug)]
pub(crate) struct BrowseService {
    sessions: Mutex<HashMap<String, BrowseSessionState>>,
    limits: BrowseLimits,
    #[cfg(test)]
    test_publish_gate: Mutex<Option<Arc<TestPublishGate>>>,
}

impl Default for BrowseService {
    fn default() -> Self {
        Self::new(BrowseLimits::default()).expect("default BrowseLimits are valid")
    }
}

impl BrowseService {
    pub(crate) fn new(limits: BrowseLimits) -> Result<Self, BrowseError> {
        Ok(Self {
            sessions: Mutex::new(HashMap::new()),
            limits: limits.validate()?,
            #[cfg(test)]
            test_publish_gate: Mutex::new(None),
        })
    }

    pub(crate) fn start_session(
        &self,
        directory: BackendResolvedDirectory,
    ) -> Result<BrowseSessionInfo, BrowseError> {
        let session_id = opaque_id();
        let location_id = opaque_id();
        let root_path_ref = BrowsePathRef { id: opaque_id() };
        let location = LocationRef::Ephemeral {
            browse_session_id: session_id.clone(),
            location_id,
        };

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        if sessions.len() >= self.limits.max_sessions {
            return Err(BrowseError::SessionCapacityExceeded);
        }

        let mut paths = HashMap::new();
        paths.insert(root_path_ref.id.clone(), directory.path);
        let mut path_order = VecDeque::new();
        path_order.push_back(root_path_ref.id.clone());

        sessions.insert(
            session_id.clone(),
            BrowseSessionState {
                root_path_ref: root_path_ref.clone(),
                paths,
                path_order,
                entries: HashMap::new(),
                entry_order: VecDeque::new(),
                active: None,
            },
        );

        Ok(BrowseSessionInfo {
            session_id,
            location,
            root_path_ref,
        })
    }

    pub(crate) fn start_enumeration(
        &self,
        session_id: &str,
        request_id: impl Into<String>,
        path_ref: &BrowsePathRef,
        page_size: usize,
    ) -> Result<BrowsePage, BrowseError> {
        let request_id = request_id.into();
        self.validate_request_id(&request_id)?;
        let page_size = self.limits.page_size(page_size)?;

        let enumeration = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| BrowseError::StateUnavailable)?;
            let session = sessions
                .get_mut(session_id)
                .ok_or(BrowseError::SessionNotFound)?;
            let path = session
                .paths
                .get(&path_ref.id)
                .cloned()
                .ok_or(BrowseError::InvalidPathRef)?;
            validate_directory_path(&path)?;
            let source = fs::read_dir(&path).map_err(map_directory_error)?;

            if let Some(previous) = session.active.take() {
                previous.cancel(CancelReason::Superseded);
            }

            let enumeration = Arc::new(EnumerationState::new(
                BrowseEnumerationRef {
                    session_id: session_id.to_string(),
                    request_id,
                    enumeration_id: opaque_id(),
                },
                source,
            ));
            session.active = Some(Arc::clone(&enumeration));
            enumeration
        };

        self.read_page(session_id, enumeration, None, page_size)
    }

    pub(crate) fn next_page(
        &self,
        session_id: &str,
        cursor: &str,
        page_size: usize,
    ) -> Result<BrowsePage, BrowseError> {
        if cursor.is_empty() || cursor.len() > MAX_ID_LENGTH {
            return Err(BrowseError::InvalidCursor);
        }
        let page_size = self.limits.page_size(page_size)?;
        let enumeration = {
            let sessions = self
                .sessions
                .lock()
                .map_err(|_| BrowseError::StateUnavailable)?;
            let session = sessions
                .get(session_id)
                .ok_or(BrowseError::SessionNotFound)?;
            session
                .active
                .clone()
                .ok_or(BrowseError::StaleEnumeration)?
        };

        self.read_page(session_id, enumeration, Some(cursor), page_size)
    }

    pub(crate) fn cancel(
        &self,
        session_id: &str,
        identity: &BrowseEnumerationRef,
    ) -> Result<(), BrowseError> {
        let enumeration = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| BrowseError::StateUnavailable)?;
            let session = sessions
                .get_mut(session_id)
                .ok_or(BrowseError::SessionNotFound)?;
            let enumeration = session
                .active
                .clone()
                .ok_or(BrowseError::StaleEnumeration)?;
            if enumeration.identity != *identity {
                return Err(BrowseError::StaleEnumeration);
            }
            enumeration.cancel(CancelReason::Explicit);
            session.active = None;
            enumeration
        };

        drop(enumeration);
        Ok(())
    }

    pub(crate) fn invalidate(&self, session_id: &str) -> Result<(), BrowseError> {
        let enumeration = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| BrowseError::StateUnavailable)?;
            let session = sessions
                .get_mut(session_id)
                .ok_or(BrowseError::SessionNotFound)?;
            let enumeration = session.active.take();
            if let Some(enumeration) = &enumeration {
                enumeration.cancel(CancelReason::Invalidated);
            }
            enumeration
        };
        drop(enumeration);
        Ok(())
    }

    pub(crate) fn validate_page(&self, page: &BrowsePage) -> Result<(), BrowseError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        let session = sessions
            .get(&page.session_id)
            .ok_or(BrowseError::SessionNotFound)?;
        let current = session
            .active
            .as_ref()
            .ok_or(BrowseError::StaleEnumeration)?;
        if current.identity.session_id == page.session_id
            && current.identity.request_id == page.request_id
            && current.identity.enumeration_id == page.enumeration_id
        {
            Ok(())
        } else {
            Err(BrowseError::StaleEnumeration)
        }
    }

    pub(crate) fn resolve_entry(
        &self,
        entry_ref: &EntryRef,
    ) -> Result<ResolvedBrowseEntry, BrowseError> {
        let EntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } = entry_ref
        else {
            return Err(BrowseError::InvalidEntryRef);
        };

        let sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        let session = sessions
            .get(browse_session_id)
            .ok_or(BrowseError::SessionNotFound)?;
        let entry = session
            .entries
            .get(entry_id)
            .ok_or(BrowseError::InvalidEntryRef)?;
        Ok(ResolvedBrowseEntry {
            path: entry.path.clone(),
            kind: entry.kind,
        })
    }

    pub(crate) fn dispose_session(&self, session_id: &str) -> Result<(), BrowseError> {
        let session = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| BrowseError::StateUnavailable)?;
            let session = sessions
                .remove(session_id)
                .ok_or(BrowseError::SessionNotFound)?;
            if let Some(enumeration) = &session.active {
                enumeration.cancel(CancelReason::Disposed);
            }
            session
        };
        drop(session);
        Ok(())
    }

    #[cfg(test)]
    fn state_counts(&self, session_id: &str) -> Result<(usize, usize), BrowseError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        let session = sessions
            .get(session_id)
            .ok_or(BrowseError::SessionNotFound)?;
        Ok((session.paths.len(), session.entries.len()))
    }

    #[cfg(test)]
    fn set_test_publish_gate(&self, gate: Arc<TestPublishGate>) {
        *self
            .test_publish_gate
            .lock()
            .expect("test publish gate lock") = Some(gate);
    }

    #[cfg(test)]
    fn pause_before_publish(&self) {
        let gate = self
            .test_publish_gate
            .lock()
            .expect("test publish gate lock")
            .take();
        if let Some(gate) = gate {
            gate.pause();
        }
    }

    fn read_page(
        &self,
        session_id: &str,
        enumeration: Arc<EnumerationState>,
        cursor: Option<&str>,
        page_size: usize,
    ) -> Result<BrowsePage, BrowseError> {
        self.ensure_current_or_cancelled(session_id, &enumeration)?;
        enumeration.claim_cursor(cursor)?;

        let (pending_entries, complete) = match read_entries(&enumeration, page_size) {
            Ok(result) => result,
            Err(error) => {
                enumeration.fail();
                self.revoke_if_current(session_id, &enumeration)?;
                return Err(error);
            }
        };

        #[cfg(test)]
        self.pause_before_publish();

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        let session = sessions
            .get_mut(session_id)
            .ok_or(BrowseError::StalePublication)?;
        let is_current = session
            .active
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, &enumeration));
        if !is_current {
            return Err(enumeration.publication_error());
        }
        if let Some(reason) = enumeration.cancel_reason() {
            return Err(reason.error());
        }

        let mut entries = Vec::with_capacity(pending_entries.len());
        for pending in pending_entries {
            let entry_id = opaque_id();
            let path_ref = if pending.kind == BrowseEntryKind::Directory {
                Some(register_path(
                    session,
                    pending.path.clone(),
                    self.limits.max_path_refs,
                ))
            } else {
                None
            };
            let path_ref = match path_ref {
                Some(Ok(path_ref)) => Some(path_ref),
                Some(Err(error)) => {
                    enumeration.fail();
                    drop(sessions);
                    self.revoke_if_current(session_id, &enumeration)?;
                    return Err(error);
                }
                None => None,
            };
            let entry_ref = EntryRef::Ephemeral {
                browse_session_id: session_id.to_string(),
                entry_id: entry_id.clone(),
            };
            register_entry(
                session,
                entry_id,
                pending.path.clone(),
                pending.kind,
                self.limits.max_entry_refs,
            );
            entries.push(EphemeralBrowseEntry {
                entry_ref,
                path_ref,
                name: pending.name,
                display_path: pending.display_path,
                kind: pending.kind,
                extension: pending.extension,
                size: pending.size,
                modified_at: pending.modified_at,
                created_at: pending.created_at,
                materialization: MaterializationState::Unknown,
            });
        }

        let emitted_count = enumeration.add_emitted_count(entries.len());
        let next_cursor = if complete {
            enumeration.complete();
            None
        } else {
            let next_cursor = opaque_id();
            enumeration.publish_cursor(next_cursor.clone())?;
            Some(next_cursor)
        };

        Ok(BrowsePage {
            session_id: enumeration.identity.session_id.clone(),
            request_id: enumeration.identity.request_id.clone(),
            enumeration_id: enumeration.identity.enumeration_id.clone(),
            entries,
            next_cursor,
            completion: if complete {
                BrowseCompletion::Complete
            } else {
                BrowseCompletion::Partial
            },
            known_count: complete.then_some(emitted_count),
        })
    }

    fn revoke_if_current(
        &self,
        session_id: &str,
        enumeration: &EnumerationState,
    ) -> Result<(), BrowseError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        if let Some(session) = sessions.get_mut(session_id) {
            let is_current = session
                .active
                .as_ref()
                .is_some_and(|current| current.identity == enumeration.identity);
            if is_current {
                session.active = None;
            }
        }
        Ok(())
    }

    fn ensure_current_or_cancelled(
        &self,
        session_id: &str,
        enumeration: &EnumerationState,
    ) -> Result<(), BrowseError> {
        if let Some(reason) = enumeration.cancel_reason() {
            return Err(reason.error());
        }
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        let current = sessions
            .get(session_id)
            .and_then(|session| session.active.as_ref());
        if current.is_some_and(|current| current.identity == enumeration.identity) {
            Ok(())
        } else {
            Err(BrowseError::StaleEnumeration)
        }
    }

    fn validate_request_id(&self, request_id: &str) -> Result<(), BrowseError> {
        if request_id.is_empty() || request_id.len() > MAX_ID_LENGTH {
            Err(BrowseError::InvalidRequest)
        } else {
            Ok(())
        }
    }
}

#[derive(Debug)]
struct BrowseSessionState {
    root_path_ref: BrowsePathRef,
    paths: HashMap<String, PathBuf>,
    path_order: VecDeque<String>,
    entries: HashMap<String, StoredEntry>,
    entry_order: VecDeque<String>,
    active: Option<Arc<EnumerationState>>,
}

#[derive(Debug)]
struct StoredEntry {
    path: PathBuf,
    kind: BrowseEntryKind,
}

#[derive(Debug)]
struct EnumerationState {
    identity: BrowseEnumerationRef,
    source: Mutex<EnumerationSource>,
    cursor: Mutex<CursorState>,
    cancel_reason: AtomicU8,
    emitted_count: AtomicUsize,
}

impl EnumerationState {
    fn new(identity: BrowseEnumerationRef, source: ReadDir) -> Self {
        Self {
            identity,
            source: Mutex::new(EnumerationSource {
                read_dir: source,
                pending: None,
            }),
            cursor: Mutex::new(CursorState::Initial),
            cancel_reason: AtomicU8::new(CancelReason::None as u8),
            emitted_count: AtomicUsize::new(0),
        }
    }

    fn claim_cursor(&self, requested: Option<&str>) -> Result<(), BrowseError> {
        let mut cursor = self
            .cursor
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        let valid = match (&*cursor, requested) {
            (CursorState::Initial, None) => true,
            (CursorState::Ready(expected), Some(actual)) => expected == actual,
            _ => false,
        };
        if !valid {
            return Err(BrowseError::InvalidCursor);
        }
        *cursor = CursorState::InFlight;
        Ok(())
    }

    fn publish_cursor(&self, cursor_value: String) -> Result<(), BrowseError> {
        let mut cursor = self
            .cursor
            .lock()
            .map_err(|_| BrowseError::StateUnavailable)?;
        if !matches!(*cursor, CursorState::InFlight) {
            return Err(BrowseError::StalePublication);
        }
        *cursor = CursorState::Ready(cursor_value);
        Ok(())
    }

    fn complete(&self) {
        if let Ok(mut cursor) = self.cursor.lock() {
            *cursor = CursorState::Complete;
        }
    }

    fn fail(&self) {
        if let Ok(mut cursor) = self.cursor.lock() {
            *cursor = CursorState::Failed;
        }
    }

    fn cancel(&self, reason: CancelReason) {
        self.cancel_reason.store(reason as u8, Ordering::Release);
        if let Ok(mut cursor) = self.cursor.lock() {
            *cursor = CursorState::Cancelled;
        }
    }

    fn cancel_reason(&self) -> Option<CancelReason> {
        CancelReason::from_u8(self.cancel_reason.load(Ordering::Acquire))
            .filter(|reason| *reason != CancelReason::None)
    }

    fn publication_error(&self) -> BrowseError {
        self.cancel_reason()
            .map(CancelReason::error)
            .unwrap_or(BrowseError::StalePublication)
    }

    fn add_emitted_count(&self, count: usize) -> usize {
        self.emitted_count.fetch_add(count, Ordering::AcqRel) + count
    }
}

#[derive(Debug)]
struct EnumerationSource {
    read_dir: ReadDir,
    pending: Option<DirEntry>,
}

#[derive(Debug)]
enum CursorState {
    Initial,
    Ready(String),
    InFlight,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
enum CancelReason {
    None = 0,
    Explicit = 1,
    Superseded = 2,
    Invalidated = 3,
    Disposed = 4,
}

impl CancelReason {
    fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::None),
            1 => Some(Self::Explicit),
            2 => Some(Self::Superseded),
            3 => Some(Self::Invalidated),
            4 => Some(Self::Disposed),
            _ => None,
        }
    }

    fn error(self) -> BrowseError {
        match self {
            Self::Explicit | Self::Disposed => BrowseError::Cancelled,
            Self::Superseded | Self::Invalidated => BrowseError::StalePublication,
            Self::None => BrowseError::StateUnavailable,
        }
    }
}

#[derive(Debug)]
struct PendingEntry {
    path: PathBuf,
    name: String,
    display_path: String,
    kind: BrowseEntryKind,
    extension: Option<String>,
    size: Option<u64>,
    modified_at: Option<i64>,
    created_at: Option<i64>,
}

fn read_entries(
    enumeration: &EnumerationState,
    page_size: usize,
) -> Result<(Vec<PendingEntry>, bool), BrowseError> {
    let mut source = enumeration
        .source
        .lock()
        .map_err(|_| BrowseError::StateUnavailable)?;
    let mut entries = Vec::with_capacity(page_size);

    while entries.len() < page_size {
        ensure_not_cancelled(enumeration)?;
        let Some(entry) = next_entry(&mut source)? else {
            return Ok((entries, true));
        };
        entries.push(read_entry(entry)?);
    }

    ensure_not_cancelled(enumeration)?;
    let complete = match source.read_dir.next() {
        None => true,
        Some(Ok(entry)) => {
            source.pending = Some(entry);
            false
        }
        Some(Err(error)) => return Err(map_entry_error(error)),
    };
    Ok((entries, complete))
}

fn next_entry(source: &mut EnumerationSource) -> Result<Option<DirEntry>, BrowseError> {
    if source.pending.is_some() {
        return Ok(source.pending.take());
    }
    match source.read_dir.next() {
        None => Ok(None),
        Some(Ok(entry)) => Ok(Some(entry)),
        Some(Err(error)) => Err(map_entry_error(error)),
    }
}

fn read_entry(entry: DirEntry) -> Result<PendingEntry, BrowseError> {
    let path = entry.path();
    let metadata = fs::symlink_metadata(&path).map_err(map_entry_error)?;
    if is_link_or_reparse(&metadata) {
        return Err(BrowseError::UnsupportedEntry);
    }

    let kind = if metadata.is_dir() {
        BrowseEntryKind::Directory
    } else if metadata.is_file() {
        BrowseEntryKind::File
    } else {
        return Err(BrowseError::UnsupportedEntry);
    };

    Ok(PendingEntry {
        name: entry.file_name().to_string_lossy().into_owned(),
        display_path: path.to_string_lossy().into_owned(),
        extension: path
            .extension()
            .and_then(|value| value.to_str())
            .map(str::to_owned),
        size: (kind == BrowseEntryKind::File).then_some(metadata.len()),
        modified_at: filesystem_time_seconds(&metadata, false),
        created_at: filesystem_time_seconds(&metadata, true),
        path,
        kind,
    })
}

fn ensure_not_cancelled(enumeration: &EnumerationState) -> Result<(), BrowseError> {
    if let Some(reason) = enumeration.cancel_reason() {
        Err(reason.error())
    } else {
        Ok(())
    }
}

fn register_path(
    session: &mut BrowseSessionState,
    path: PathBuf,
    max_path_refs: usize,
) -> Result<BrowsePathRef, BrowseError> {
    let path_ref = BrowsePathRef { id: opaque_id() };
    session.paths.insert(path_ref.id.clone(), path);
    session.path_order.push_back(path_ref.id.clone());
    trim_paths(session, max_path_refs);
    if session.paths.contains_key(&path_ref.id) {
        Ok(path_ref)
    } else {
        Err(BrowseError::TemporaryStateCapacityExceeded)
    }
}

fn trim_paths(session: &mut BrowseSessionState, max_path_refs: usize) {
    while session.paths.len() > max_path_refs {
        let Some(old_id) = session.path_order.pop_front() else {
            break;
        };
        if old_id == session.root_path_ref.id {
            session.path_order.push_back(old_id);
        } else {
            session.paths.remove(&old_id);
        }
    }
}

fn register_entry(
    session: &mut BrowseSessionState,
    entry_id: String,
    path: PathBuf,
    kind: BrowseEntryKind,
    max_entry_refs: usize,
) {
    session
        .entries
        .insert(entry_id.clone(), StoredEntry { path, kind });
    session.entry_order.push_back(entry_id);
    while session.entries.len() > max_entry_refs {
        let Some(old_id) = session.entry_order.pop_front() else {
            break;
        };
        session.entries.remove(&old_id);
    }
}

fn validate_directory_path(path: &Path) -> Result<(), BrowseError> {
    if path.as_os_str().is_empty() {
        return Err(BrowseError::DirectoryNotFound);
    }
    let metadata = fs::symlink_metadata(path).map_err(map_directory_error)?;
    if is_link_or_reparse(&metadata) {
        return Err(BrowseError::UnsupportedEntry);
    }
    if !metadata.is_dir() {
        return Err(BrowseError::TargetNotDirectory);
    }
    Ok(())
}

fn map_directory_error(error: io::Error) -> BrowseError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => BrowseError::DirectoryPermissionDenied,
        io::ErrorKind::NotFound => BrowseError::DirectoryNotFound,
        _ => BrowseError::DirectoryUnavailable,
    }
}

fn map_entry_error(error: io::Error) -> BrowseError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => BrowseError::EntryPermissionDenied,
        io::ErrorKind::NotFound => BrowseError::EntryNotFound,
        _ => BrowseError::EntryUnavailable,
    }
}

fn filesystem_time_seconds(metadata: &fs::Metadata, created: bool) -> Option<i64> {
    let time = if created {
        metadata.created().ok()
    } else {
        metadata.modified().ok()
    }?;
    time.duration_since(std::time::UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_secs()).ok())
}

fn opaque_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(windows)]
fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use std::io::{self, ErrorKind};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    static FIXTURE_COUNTER: AtomicUsize = AtomicUsize::new(0);

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let id = FIXTURE_COUNTER.fetch_add(1, Ordering::Relaxed);
            let root = std::env::temp_dir().join(format!(
                "zen-canvas-browse-{}-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("clock")
                    .as_nanos(),
                id
            ));
            fs::create_dir_all(&root).expect("create fixture root");
            Self { root }
        }

        fn directory(&self) -> BackendResolvedDirectory {
            BackendResolvedDirectory::from_backend_path(self.root.clone()).expect("directory")
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn service(limits: BrowseLimits) -> BrowseService {
        BrowseService::new(limits).expect("valid limits")
    }

    #[test]
    fn normal_enumeration_is_progressive_and_supports_multiple_pages() {
        let fixture = Fixture::new();
        for name in ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"] {
            fs::write(fixture.root.join(name), name).expect("file");
        }
        let service = service(BrowseLimits {
            max_sessions: 2,
            max_page_size: 3,
            max_path_refs: 8,
            max_entry_refs: 8,
        });
        let session = service.start_session(fixture.directory()).expect("session");

        let first = service
            .start_enumeration(&session.session_id, "request-1", &session.root_path_ref, 2)
            .expect("first page");
        assert_eq!(first.entries.len(), 2);
        assert_eq!(first.completion, BrowseCompletion::Partial);
        assert!(first.known_count.is_none());
        let cursor = first.next_cursor.clone().expect("cursor");

        let second = service
            .next_page(&session.session_id, &cursor, 2)
            .expect("second page");
        assert_eq!(second.entries.len(), 2);
        assert_eq!(second.completion, BrowseCompletion::Partial);
        let cursor = second.next_cursor.clone().expect("cursor");

        let third = service
            .next_page(&session.session_id, &cursor, 2)
            .expect("third page");
        assert_eq!(third.entries.len(), 1);
        assert_eq!(third.completion, BrowseCompletion::Complete);
        assert_eq!(third.known_count, Some(5));
        assert!(third.next_cursor.is_none());
    }

    #[test]
    fn first_page_does_not_require_full_directory_enumeration() {
        let fixture = Fixture::new();
        for index in 0..512 {
            fs::write(fixture.root.join(format!("entry-{index:04}.txt")), b"x").expect("file");
        }
        let service = service(BrowseLimits {
            max_sessions: 2,
            max_page_size: 8,
            max_path_refs: 16,
            max_entry_refs: 16,
        });
        let session = service.start_session(fixture.directory()).expect("session");
        let page = service
            .start_enumeration(
                &session.session_id,
                "request-large",
                &session.root_path_ref,
                8,
            )
            .expect("page");

        assert_eq!(page.entries.len(), 8);
        assert_eq!(page.completion, BrowseCompletion::Partial);
        assert!(page.next_cursor.is_some());
        assert!(page.known_count.is_none());
    }

    #[test]
    fn cursor_is_bound_to_session_request_and_enumeration() {
        let fixture = Fixture::new();
        fs::write(fixture.root.join("entry.txt"), b"entry").expect("file");
        let service = service(BrowseLimits::default());
        let first_session = service.start_session(fixture.directory()).expect("session");
        let second_session = service.start_session(fixture.directory()).expect("session");

        let first = service
            .start_enumeration(
                &first_session.session_id,
                "request-a",
                &first_session.root_path_ref,
                1,
            )
            .expect("first page");
        let cursor = first.next_cursor.clone();
        assert!(cursor.is_none());

        fs::write(fixture.root.join("second.txt"), b"second").expect("file");
        let partial = service
            .start_enumeration(
                &first_session.session_id,
                "request-b",
                &first_session.root_path_ref,
                1,
            )
            .expect("partial page");
        let cursor = partial.next_cursor.expect("cursor");
        assert_eq!(
            service.next_page(&second_session.session_id, &cursor, 1),
            Err(BrowseError::StaleEnumeration)
        );
        let last_page = service
            .next_page(&first_session.session_id, &cursor, 1)
            .expect("current session cursor");
        assert_eq!(last_page.session_id, first_session.session_id);
        assert_eq!(last_page.request_id, "request-b");
        assert_eq!(last_page.enumeration_id, partial.enumeration_id);
        assert_eq!(last_page.completion, BrowseCompletion::Complete);
        assert_eq!(last_page.known_count, Some(2));
    }

    #[test]
    fn reenumeration_revokes_old_cursor_and_page_publication() {
        let fixture = Fixture::new();
        fs::write(fixture.root.join("a.txt"), b"a").expect("file");
        fs::write(fixture.root.join("b.txt"), b"b").expect("file");
        let service = service(BrowseLimits::default());
        let session = service.start_session(fixture.directory()).expect("session");
        let old_page = service
            .start_enumeration(
                &session.session_id,
                "request-old",
                &session.root_path_ref,
                1,
            )
            .expect("old page");
        let old_cursor = old_page.next_cursor.clone().expect("old cursor");

        let new_page = service
            .start_enumeration(
                &session.session_id,
                "request-new",
                &session.root_path_ref,
                1,
            )
            .expect("new page");
        assert_ne!(old_page.enumeration_id, new_page.enumeration_id);
        assert_eq!(
            service.next_page(&session.session_id, &old_cursor, 1),
            Err(BrowseError::InvalidCursor)
        );
        assert_eq!(
            service.validate_page(&old_page),
            Err(BrowseError::StaleEnumeration)
        );
        service.validate_page(&new_page).expect("new page current");
    }

    #[test]
    fn superseded_slow_page_cannot_publish_into_new_enumeration() {
        let fixture = Fixture::new();
        fs::write(fixture.root.join("a.txt"), b"a").expect("file");
        fs::write(fixture.root.join("b.txt"), b"b").expect("file");
        let service = Arc::new(service(BrowseLimits::default()));
        let session = service.start_session(fixture.directory()).expect("session");
        let gate = Arc::new(TestPublishGate::default());
        service.set_test_publish_gate(Arc::clone(&gate));

        let old_session_id = session.session_id.clone();
        let old_root_ref = session.root_path_ref.clone();
        let old_service = Arc::clone(&service);
        let old_worker = thread::spawn(move || {
            old_service.start_enumeration(&old_session_id, "request-old", &old_root_ref, 1)
        });

        gate.wait_until_reached();
        let new_page = service
            .start_enumeration(
                &session.session_id,
                "request-new",
                &session.root_path_ref,
                1,
            )
            .expect("new page");
        gate.release();

        assert_eq!(
            old_worker.join().expect("old worker join"),
            Err(BrowseError::StalePublication)
        );
        service.validate_page(&new_page).expect("new page current");
        assert_eq!(new_page.request_id, "request-new");
    }

    #[test]
    fn cancellation_revokes_cursor_and_does_not_publish_more_pages() {
        let fixture = Fixture::new();
        for name in ["a.txt", "b.txt", "c.txt"] {
            fs::write(fixture.root.join(name), name).expect("file");
        }
        let service = service(BrowseLimits::default());
        let session = service.start_session(fixture.directory()).expect("session");
        let page = service
            .start_enumeration(
                &session.session_id,
                "request-cancel",
                &session.root_path_ref,
                1,
            )
            .expect("page");
        let identity = BrowseEnumerationRef {
            session_id: page.session_id.clone(),
            request_id: page.request_id.clone(),
            enumeration_id: page.enumeration_id.clone(),
        };
        let cursor = page.next_cursor.expect("cursor");
        service
            .cancel(&session.session_id, &identity)
            .expect("cancel");
        assert_eq!(
            service.next_page(&session.session_id, &cursor, 1),
            Err(BrowseError::StaleEnumeration)
        );
    }

    #[test]
    fn disposing_session_clears_bounded_temporary_state() {
        let fixture = Fixture::new();
        fs::create_dir(fixture.root.join("nested")).expect("nested");
        fs::write(fixture.root.join("entry.txt"), b"entry").expect("file");
        let service = service(BrowseLimits {
            max_sessions: 1,
            max_page_size: 4,
            max_path_refs: 4,
            max_entry_refs: 4,
        });
        let session = service.start_session(fixture.directory()).expect("session");
        let page = service
            .start_enumeration(
                &session.session_id,
                "request-dispose",
                &session.root_path_ref,
                4,
            )
            .expect("page");
        assert!(!page.entries.is_empty());
        let counts = service.state_counts(&session.session_id).expect("counts");
        assert!(counts.0 >= 1);
        assert!(counts.1 >= 1);
        service
            .dispose_session(&session.session_id)
            .expect("dispose");
        assert_eq!(
            service.state_counts(&session.session_id),
            Err(BrowseError::SessionNotFound)
        );
    }

    #[test]
    fn directory_entry_path_refs_resolve_only_inside_the_session() {
        let fixture = Fixture::new();
        let nested = fixture.root.join("nested");
        fs::create_dir(&nested).expect("nested");
        fs::write(nested.join("child.txt"), b"child").expect("child");
        let service = service(BrowseLimits::default());
        let session = service.start_session(fixture.directory()).expect("session");

        let page = service
            .start_enumeration(
                &session.session_id,
                "request-path",
                &session.root_path_ref,
                4,
            )
            .expect("root page");
        let nested_path_ref = page
            .entries
            .iter()
            .find(|entry| entry.kind == BrowseEntryKind::Directory)
            .and_then(|entry| entry.path_ref.clone())
            .expect("nested path ref");
        let child_page = service
            .start_enumeration(&session.session_id, "request-child", &nested_path_ref, 4)
            .expect("child page");
        assert_eq!(child_page.entries.len(), 1);
        assert_eq!(child_page.entries[0].name, "child.txt");
        assert!(!serde_json::to_value(&nested_path_ref)
            .expect("path ref json")
            .to_string()
            .contains(fixture.root.to_string_lossy().as_ref()));
    }

    #[test]
    fn permission_and_disappearing_entries_fail_closed_without_path_leaks() {
        let fixture = Fixture::new();
        let missing_root = fixture.root.join("missing");
        assert!(matches!(
            BackendResolvedDirectory::from_backend_path(missing_root),
            Err(BrowseError::DirectoryNotFound)
        ));

        let service = service(BrowseLimits::default());
        let session = service.start_session(fixture.directory()).expect("session");
        let disappearing = fixture.root.join("disappearing.txt");
        fs::write(&disappearing, b"gone").expect("file");
        let directory_entry = fs::read_dir(&fixture.root)
            .expect("read fixture")
            .filter_map(Result::ok)
            .find(|entry| entry.file_name().to_string_lossy() == "disappearing.txt")
            .expect("directory entry");
        fs::remove_file(&disappearing).expect("remove");
        assert!(matches!(
            read_entry(directory_entry),
            Err(BrowseError::EntryNotFound)
        ));
        assert_eq!(
            map_directory_error(io::Error::from(ErrorKind::PermissionDenied)),
            BrowseError::DirectoryPermissionDenied
        );
        assert_eq!(
            map_entry_error(io::Error::from(ErrorKind::PermissionDenied)),
            BrowseError::EntryPermissionDenied
        );
        let page = service.start_enumeration(
            &session.session_id,
            "request-empty",
            &session.root_path_ref,
            4,
        );
        assert!(page.is_ok(), "a disappearing entry is not fabricated");

        let root_text = fixture.root.to_string_lossy().to_string();
        let location = serde_json::to_value(&session.location).expect("location json");
        let path_ref = serde_json::to_value(&session.root_path_ref).expect("path json");
        assert!(!location.to_string().contains(&root_text));
        assert!(!path_ref.to_string().contains(&root_text));
    }

    #[test]
    fn unsupported_symlink_is_rejected_without_following_it() {
        let fixture = Fixture::new();
        let target = fixture.root.join("target.txt");
        fs::write(&target, b"target").expect("target");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, fixture.root.join("link.txt")).expect("symlink");
        #[cfg(windows)]
        std::os::windows::fs::symlink_file(&target, fixture.root.join("link.txt"))
            .expect("symlink");
        #[cfg(not(any(unix, windows)))]
        return;

        let service = service(BrowseLimits::default());
        let session = service.start_session(fixture.directory()).expect("session");
        assert_eq!(
            service.start_enumeration(
                &session.session_id,
                "request-link",
                &session.root_path_ref,
                4
            ),
            Err(BrowseError::UnsupportedEntry)
        );
    }

    #[test]
    fn bounded_limits_evict_old_entry_refs_and_reject_evicted_refs() {
        let fixture = Fixture::new();
        for name in ["a.txt", "b.txt", "c.txt"] {
            fs::write(fixture.root.join(name), name).expect("file");
        }
        let service = service(BrowseLimits {
            max_sessions: 1,
            max_page_size: 1,
            max_path_refs: 1,
            max_entry_refs: 1,
        });
        let session = service.start_session(fixture.directory()).expect("session");
        let first = service
            .start_enumeration(
                &session.session_id,
                "request-bounded",
                &session.root_path_ref,
                1,
            )
            .expect("first");
        let first_ref = first.entries[0].entry_ref.clone();
        let cursor = first.next_cursor.expect("cursor");
        let second = service
            .next_page(&session.session_id, &cursor, 1)
            .expect("second");
        assert_eq!(
            service.resolve_entry(&first_ref),
            Err(BrowseError::InvalidEntryRef)
        );
        assert!(service.resolve_entry(&second.entries[0].entry_ref).is_ok());
    }

    #[test]
    fn opaque_refs_have_no_authoritative_path_fields() {
        let root = PathBuf::from("C:\\private\\browse-root");
        let entry_ref = EntryRef::Ephemeral {
            browse_session_id: "session-1".to_string(),
            entry_id: "entry-1".to_string(),
        };
        let location = LocationRef::Ephemeral {
            browse_session_id: "session-1".to_string(),
            location_id: "location-1".to_string(),
        };
        let path_ref = BrowsePathRef {
            id: "path-1".to_string(),
        };
        for value in [
            serde_json::to_value(entry_ref).expect("entry json"),
            serde_json::to_value(location).expect("location json"),
            serde_json::to_value(path_ref).expect("path json"),
        ] {
            assert!(value.get("path").is_none());
            assert!(!value.to_string().contains(root.to_string_lossy().as_ref()));
        }

        let page_shape = json!({
            "sessionId": "session-1",
            "requestId": "request-1",
            "enumerationId": "enum-1",
            "nextCursor": "opaque-cursor",
        });
        assert!(page_shape.get("path").is_none());
    }
}
