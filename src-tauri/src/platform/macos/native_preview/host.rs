//! AppKit/QuickLookUI view lifecycle for Zen Preview hosts.
//!
//! The coordination state in this module contains only identity, generation
//! and opaque owner handles. The retained `QLPreviewView` values live in a
//! main-thread-only store and are created, updated, detached and released on
//! that thread. Native Preview Access claims keep the staged snapshot alive
//! until the view owner has cleared the Quick Look item and removed the view.

use super::view::{self, MainThreadDispatcher, NativeViewId};
use crate::file_workspace::{
    contracts::PreviewHostKind,
    integration::types::{PreviewNativeBounds, PreviewNativePresentation, PreviewSnapshotDto},
    native_preview::access::{
        NativePreviewAccessClaim, NativePreviewAccessError, NativePreviewAccessRegistry,
        NativePreviewAccessResolveRequest,
    },
    preview::PreviewRepresentation,
};
use std::sync::{Arc, Mutex};
use tauri::{Runtime, WebviewWindow};

#[derive(Clone)]
pub(crate) struct MacQuickLookPreviewHost {
    state: Arc<Mutex<HostState>>,
}

#[derive(Default)]
struct HostState {
    generation: u64,
    disposed: bool,
    current: Option<CurrentNativeView>,
    /// A failed dispatch retains ownership until a later detach/dispose can
    /// retry on the main thread. It is never dropped under this mutex.
    retired: Vec<CurrentNativeView>,
}

struct CurrentNativeView {
    identity: NativeViewIdentity,
    view_id: NativeViewId,
    dispatcher: MainThreadDispatcher,
    _access_claim: NativePreviewAccessClaim,
}

struct ReplacementReservation {
    generation: u64,
    current_identity: Option<NativeViewIdentity>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NativeViewIdentity {
    preview_id: String,
    session_id: String,
    request_id: String,
    source_version: String,
    host: PreviewHostKind,
    token: String,
}

impl NativeViewIdentity {
    fn from_snapshot(
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Self {
        Self {
            preview_id: snapshot.preview_id.clone(),
            session_id: snapshot.session_id.clone(),
            request_id: snapshot.request_id.clone(),
            source_version: presentation.source_version.clone(),
            host: presentation.host,
            token: presentation.token.clone(),
        }
    }
}

impl MacQuickLookPreviewHost {
    pub(crate) fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(HostState::default())),
        }
    }

    pub(crate) fn attach<R: Runtime + 'static>(
        &self,
        window: &WebviewWindow<R>,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        validate_presentation(snapshot, presentation)?;
        let parent_ptr = view::parent_ptr(window)?;
        let dispatcher = view::dispatcher_for_window(window);
        self.attach_with_dispatcher(parent_ptr, dispatcher, access, snapshot, presentation)
    }

    #[cfg(feature = "native-qa")]
    pub(crate) fn attach_for_harness(
        &self,
        parent_ptr: usize,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        validate_presentation(snapshot, presentation)?;
        self.attach_with_dispatcher(
            parent_ptr,
            super::native_qa::harness_dispatcher(),
            access,
            snapshot,
            presentation,
        )
    }

    fn attach_with_dispatcher(
        &self,
        parent_ptr: usize,
        dispatcher: MainThreadDispatcher,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        validate_presentation(snapshot, presentation)?;
        let identity = NativeViewIdentity::from_snapshot(snapshot, presentation);

        // A geometry-only update never resolves the token and never replaces
        // the Quick Look view or refreshes its item.
        if self.current_identity_matches(&identity) {
            return self.update_geometry_with_dispatcher(
                parent_ptr,
                access,
                snapshot,
                presentation,
            );
        }

        // Reserve the replacement while retaining the current view. Any
        // later attach/detach advances the generation, so a candidate that
        // resumes after a newer owner commits can only roll back itself.
        let reservation = self.begin_replacement()?;

        let resolve_request = resolve_request(snapshot, presentation);
        let access_claim = access
            .claim_for_native_bind(&resolve_request)
            .map_err(map_access_error)?;
        let staged_path = access_claim.staged_path().to_owned();
        let bounds = presentation.bounds;
        let access_for_bind = Arc::clone(&access);
        let bind_request = resolve_request.clone();
        let view_id = view::dispatch_sync(dispatcher.clone(), move || {
            access_for_bind
                .validate_native_bind(&bind_request)
                .map_err(map_access_error)?;
            view::create_native_view(parent_ptr, &staged_path, bounds)
        })?;

        // The lifecycle may have been cancelled or switched while AppKit was
        // creating/binding the view. This is the final exact staging check
        // before the view enters HostState.
        if let Err(error) = access_claim.validate() {
            let cleanup = remove_view(&dispatcher, view_id);
            return Err(match cleanup {
                Ok(()) => map_access_error(error),
                Err(cleanup_error) => {
                    format!("{};{cleanup_error}", map_access_error(error))
                }
            });
        }

        // Keep a dispatcher clone for the stale-generation rollback; the
        // accepted path moves the other clone into the current owner.
        let cleanup_dispatcher = Arc::clone(&dispatcher);
        let previous =
            match self.commit_replacement(reservation, identity, view_id, dispatcher, access_claim)
            {
                Ok(previous) => previous,
                Err(error) => {
                    let cleanup = remove_view(&cleanup_dispatcher, view_id);
                    return Err(match cleanup {
                        Ok(()) => error,
                        Err(cleanup_error) => format!("{error};{cleanup_error}"),
                    });
                }
            };
        if let Some(previous) = previous {
            if let Err((error, previous)) = release_native_view(previous) {
                lock_state(&self.state).retired.push(*previous);
                return Err(error);
            }
        }
        Ok(())
    }

    #[cfg(feature = "native-qa")]
    pub(crate) fn update_geometry_for_harness(
        &self,
        parent_ptr: usize,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        validate_presentation(snapshot, presentation)?;
        self.update_geometry_with_dispatcher(parent_ptr, access, snapshot, presentation)
    }

    fn update_geometry_with_dispatcher(
        &self,
        parent_ptr: usize,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        let identity = NativeViewIdentity::from_snapshot(snapshot, presentation);
        let (view_id, dispatcher) = {
            let state = lock_state(&self.state);
            let Some(current) = state.current.as_ref() else {
                return Err("macos_quick_look_native_view_missing".to_string());
            };
            if current.identity != identity {
                return Err("macos_quick_look_native_identity_changed".to_string());
            }
            (current.view_id, Arc::clone(&current.dispatcher))
        };
        access
            .validate_native_bind(&resolve_request(snapshot, presentation))
            .map_err(map_access_error)?;
        let bounds = presentation.bounds;
        view::dispatch_sync(dispatcher, move || {
            view::update_native_view(parent_ptr, view_id, bounds)
        })?;
        Ok(())
    }

    pub(crate) fn detach(
        &self,
        preview_id: &str,
        expected_snapshot: Option<&PreviewSnapshotDto>,
    ) -> Result<(), String> {
        let expected_identity = expected_snapshot.and_then(identity_from_snapshot);
        let previous = {
            let mut state = lock_state(&self.state);
            if state.current.is_none() {
                bump_generation(&mut state);
                None
            } else if state.current.as_ref().is_some_and(|current| {
                current.identity.preview_id != preview_id
                    || expected_identity
                        .as_ref()
                        .is_some_and(|expected| &current.identity != expected)
                    || expected_snapshot.is_some() && expected_identity.is_none()
            }) {
                None
            } else {
                bump_generation(&mut state);
                state.current.take()
            }
        };
        if let Some(previous) = previous {
            if let Err((error, previous)) = release_native_view(previous) {
                lock_state(&self.state).retired.push(*previous);
                return Err(error);
            }
        }
        self.retry_retired()
    }

    /// Invalidates the host and releases all native views synchronously on
    /// their recorded main-thread dispatcher. Runtime disposal calls this
    /// only after PreviewSession publication invalidation and before access
    /// registry disposal.
    pub(crate) fn dispose(&self) -> Result<(), String> {
        let owned = {
            let mut state = lock_state(&self.state);
            state.disposed = true;
            bump_generation(&mut state);
            let mut owned = state.retired.drain(..).collect::<Vec<_>>();
            if let Some(current) = state.current.take() {
                owned.push(current);
            }
            owned
        };
        let mut first_error = None;
        for current in owned {
            if let Err((error, current)) = release_native_view(current) {
                if first_error.is_none() {
                    first_error = Some(error);
                }
                lock_state(&self.state).retired.push(*current);
            }
        }
        first_error.map_or(Ok(()), Err)
    }

    fn begin_replacement(&self) -> Result<ReplacementReservation, String> {
        let mut state = lock_state(&self.state);
        if state.disposed {
            return Err("macos_quick_look_host_disposed".to_string());
        }
        let current_identity = state
            .current
            .as_ref()
            .map(|current| current.identity.clone());
        bump_generation(&mut state);
        Ok(ReplacementReservation {
            generation: state.generation,
            current_identity,
        })
    }

    fn commit_replacement(
        &self,
        reservation: ReplacementReservation,
        identity: NativeViewIdentity,
        view_id: NativeViewId,
        dispatcher: MainThreadDispatcher,
        access_claim: NativePreviewAccessClaim,
    ) -> Result<Option<CurrentNativeView>, String> {
        let mut state = lock_state(&self.state);
        let current_identity = state.current.as_ref().map(|current| &current.identity);
        if state.disposed
            || !replacement_is_current(state.generation, current_identity, &reservation)
        {
            return Err("macos_quick_look_presentation_stale".to_string());
        }

        // This is the final exact staging check while the host transaction is
        // still unpublished. A revoked claim can never displace the retained
        // current owner.
        access_claim.validate().map_err(map_access_error)?;
        Ok(state.current.replace(CurrentNativeView {
            identity,
            view_id,
            dispatcher,
            _access_claim: access_claim,
        }))
    }

    fn current_identity_matches(&self, identity: &NativeViewIdentity) -> bool {
        lock_state(&self.state)
            .current
            .as_ref()
            .is_some_and(|current| &current.identity == identity)
    }

    fn retry_retired(&self) -> Result<(), String> {
        let retired = {
            let mut state = lock_state(&self.state);
            std::mem::take(&mut state.retired)
        };
        let mut first_error = None;
        for current in retired {
            if let Err((error, current)) = release_native_view(current) {
                if first_error.is_none() {
                    first_error = Some(error);
                }
                lock_state(&self.state).retired.push(*current);
            }
        }
        first_error.map_or(Ok(()), Err)
    }
}

fn validate_presentation(
    snapshot: &PreviewSnapshotDto,
    presentation: &PreviewNativePresentation,
) -> Result<(), String> {
    if !matches!(
        presentation.host,
        PreviewHostKind::ZenFloating | PreviewHostKind::ZenPinned
    ) || snapshot.host_kind != presentation.host
    {
        return Err("macos_quick_look_host_mismatch".to_string());
    }
    let Some(source_version) = snapshot.source_version.as_deref() else {
        return Err("macos_quick_look_source_version_missing".to_string());
    };
    if source_version != presentation.source_version {
        return Err("macos_quick_look_source_version_mismatch".to_string());
    }
    let Some(PreviewRepresentation::NativeOpaque { host, token }) = snapshot
        .representation
        .as_ref()
        .map(|envelope| &envelope.representation)
    else {
        return Err("macos_quick_look_representation_missing".to_string());
    };
    if *host != presentation.host || token != &presentation.token {
        return Err("macos_quick_look_token_mismatch".to_string());
    }
    validate_bounds(presentation.bounds)
}

fn identity_from_snapshot(snapshot: &PreviewSnapshotDto) -> Option<NativeViewIdentity> {
    let source_version = snapshot.source_version.as_ref()?.clone();
    let (host, token) = match snapshot
        .representation
        .as_ref()
        .map(|envelope| &envelope.representation)
    {
        Some(PreviewRepresentation::NativeOpaque { host, token }) => (*host, token.clone()),
        _ => return None,
    };
    Some(NativeViewIdentity {
        preview_id: snapshot.preview_id.clone(),
        session_id: snapshot.session_id.clone(),
        request_id: snapshot.request_id.clone(),
        source_version,
        host,
        token,
    })
}

fn validate_bounds(bounds: PreviewNativeBounds) -> Result<(), String> {
    if !(-32_768..=32_768).contains(&bounds.x)
        || !(-32_768..=32_768).contains(&bounds.y)
        || bounds.width == 0
        || bounds.width > 16_384
        || bounds.height == 0
        || bounds.height > 16_384
    {
        return Err("macos_quick_look_bounds_invalid".to_string());
    }
    Ok(())
}

fn resolve_request(
    snapshot: &PreviewSnapshotDto,
    presentation: &PreviewNativePresentation,
) -> NativePreviewAccessResolveRequest {
    NativePreviewAccessResolveRequest {
        token: presentation.token.clone(),
        session_id: snapshot.session_id.clone(),
        request_id: snapshot.request_id.clone(),
        source_version: presentation.source_version.clone(),
        host: presentation.host,
    }
}

fn bump_generation(state: &mut HostState) {
    state.generation = state.generation.wrapping_add(1);
    if state.generation == 0 {
        state.generation = 1;
    }
}

fn replacement_is_current(
    generation: u64,
    current_identity: Option<&NativeViewIdentity>,
    reservation: &ReplacementReservation,
) -> bool {
    generation == reservation.generation
        && current_identity == reservation.current_identity.as_ref()
}

fn release_native_view(current: CurrentNativeView) -> Result<(), (String, Box<CurrentNativeView>)> {
    let view_id = current.view_id;
    match view::dispatch_sync(current.dispatcher.clone(), move || {
        view::remove_native_view(view_id);
        Ok(())
    }) {
        Ok(()) => {
            // Drop the claim only after AppKit has cleared the item and
            // removed the view, so staging cleanup cannot race Quick Look.
            drop(current);
            Ok(())
        }
        Err(error) => Err((error, Box::new(current))),
    }
}

fn remove_view(dispatcher: &MainThreadDispatcher, view_id: NativeViewId) -> Result<(), String> {
    view::dispatch_sync(Arc::clone(dispatcher), move || {
        view::remove_native_view(view_id);
        Ok(())
    })
}

fn lock_state(state: &Mutex<HostState>) -> std::sync::MutexGuard<'_, HostState> {
    state
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn map_access_error(error: NativePreviewAccessError) -> String {
    format!("macos_quick_look_access_{error}")
}

pub(crate) fn available() -> bool {
    view::available()
}

#[cfg(feature = "native-qa")]
impl MacQuickLookPreviewHost {
    pub(super) fn current_view_id(&self) -> Option<NativeViewId> {
        lock_state(&self.state)
            .current
            .as_ref()
            .map(|current| current.view_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::mpsc, thread};

    fn identity(request_id: &str, source_version: &str, token: &str) -> NativeViewIdentity {
        NativeViewIdentity {
            preview_id: "preview".to_string(),
            session_id: "session".to_string(),
            request_id: request_id.to_string(),
            source_version: source_version.to_string(),
            host: PreviewHostKind::ZenFloating,
            token: token.to_string(),
        }
    }

    #[test]
    fn same_identity_is_geometry_only() {
        let current = identity("request", "version", "token");
        let updates = (0..3)
            .map(|_| identity("request", "version", "token"))
            .filter(|next| *next == current)
            .count();
        assert_eq!(updates, 3);
    }

    #[test]
    fn identity_change_requires_replacement() {
        let a = identity("request-a", "version-a", "token-a");
        let b = identity("request-b", "version-b", "token-b");
        assert_ne!(a, b);
        assert_eq!(a.preview_id, b.preview_id);
    }

    #[allow(non_snake_case)]
    #[test]
    fn late_A_does_not_replace_current_B() {
        let reservation = ReplacementReservation {
            generation: 1,
            current_identity: Some(identity("request-b-old", "version-b-old", "token-b-old")),
        };
        let current_b = identity("request-b", "version-b", "token-b");
        let (candidate_ready_sender, candidate_ready_receiver) = mpsc::sync_channel(0);
        let (resume_sender, resume_receiver) = mpsc::sync_channel(0);
        let candidate = thread::spawn(move || {
            candidate_ready_sender
                .send(())
                .expect("candidate barrier receiver");
            resume_receiver.recv().expect("candidate resume sender");
            replacement_is_current(2, Some(&current_b), &reservation)
        });
        candidate_ready_receiver
            .recv()
            .expect("candidate must pause before B commits");
        resume_sender.send(()).expect("candidate resume receiver");
        assert!(!candidate.join().expect("candidate thread completes"));
    }

    #[allow(non_snake_case)]
    #[test]
    fn late_A_claim_then_B_commit_then_A_resume_keeps_B() {
        let reservation = ReplacementReservation {
            generation: 1,
            current_identity: None,
        };
        let current_b = identity("request-b", "version-b", "token-b");
        let (claim_sender, claim_receiver) = mpsc::sync_channel(0);
        let (resume_sender, resume_receiver) = mpsc::sync_channel(0);
        let candidate = thread::spawn(move || {
            claim_sender.send(()).expect("claim barrier receiver");
            resume_receiver.recv().expect("claim resume sender");
            replacement_is_current(2, Some(&current_b), &reservation)
        });
        claim_receiver
            .recv()
            .expect("A claim must complete before B commits");
        resume_sender.send(()).expect("claim resume receiver");
        assert!(!candidate.join().expect("candidate thread completes"));
    }
}
