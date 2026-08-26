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

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum NativePreviewAttachError {
    /// The publication or access claim is stale. This is a benign race and
    /// must never trigger metadata fallback in the integration layer.
    Stale(String),
    /// AppKit/Quick Look could not present an otherwise-current publication.
    /// Only this class is eligible for the exact native-to-metadata fallback.
    Presentation(String),
    /// The candidate or superseded native owner could not be detached. The
    /// owner is retained for retry, so fallback would otherwise leak authority.
    Cleanup(String),
}

impl NativePreviewAttachError {
    pub(crate) fn into_message(self) -> String {
        match self {
            Self::Stale(error) | Self::Presentation(error) | Self::Cleanup(error) => error,
        }
    }
}

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
    #[cfg(test)]
    fail_next_detach: bool,
    #[cfg(test)]
    after_claim_validation: Option<Box<dyn FnOnce() + Send>>,
}

struct CurrentNativeView {
    identity: NativeViewIdentity,
    view_id: NativeViewId,
    dispatcher: MainThreadDispatcher,
    driver: Arc<dyn NativeViewDriver>,
    _access_claim: NativePreviewAccessClaim,
}

struct ReplacementReservation {
    generation: u64,
    current_identity: Option<NativeViewIdentity>,
}

trait NativeViewDriver: Send + Sync {
    fn create(
        &self,
        parent_ptr: usize,
        staged_path: &std::path::Path,
        bounds: PreviewNativeBounds,
    ) -> Result<NativeViewId, String>;

    fn update(
        &self,
        parent_ptr: usize,
        view_id: NativeViewId,
        bounds: PreviewNativeBounds,
    ) -> Result<(), String>;

    fn remove(&self, view_id: NativeViewId);
}

struct AppKitNativeViewDriver;

impl NativeViewDriver for AppKitNativeViewDriver {
    fn create(
        &self,
        parent_ptr: usize,
        staged_path: &std::path::Path,
        bounds: PreviewNativeBounds,
    ) -> Result<NativeViewId, String> {
        view::create_native_view(parent_ptr, staged_path, bounds)
    }

    fn update(
        &self,
        parent_ptr: usize,
        view_id: NativeViewId,
        bounds: PreviewNativeBounds,
    ) -> Result<(), String> {
        view::update_native_view(parent_ptr, view_id, bounds)
    }

    fn remove(&self, view_id: NativeViewId) {
        view::remove_native_view(view_id);
    }
}

enum NativeBindError {
    Access(NativePreviewAccessError),
    Presentation(String),
}

impl From<NativePreviewAccessError> for NativeBindError {
    fn from(error: NativePreviewAccessError) -> Self {
        Self::Access(error)
    }
}

impl From<String> for NativeBindError {
    fn from(error: String) -> Self {
        Self::Presentation(error)
    }
}

enum ReplacementOutcome {
    Replaced(Option<CurrentNativeView>),
    Coalesced(CurrentNativeView),
    Stale(CurrentNativeView),
    ClaimStale(CurrentNativeView, NativePreviewAccessError),
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
    ) -> Result<(), NativePreviewAttachError> {
        validate_presentation(snapshot, presentation).map_err(NativePreviewAttachError::Stale)?;
        let parent_ptr =
            view::parent_ptr(window).map_err(NativePreviewAttachError::Presentation)?;
        let dispatcher = view::dispatcher_for_window(window);
        self.attach_with_dispatcher(
            parent_ptr,
            dispatcher,
            Arc::new(AppKitNativeViewDriver),
            access,
            snapshot,
            presentation,
        )
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
            Arc::new(AppKitNativeViewDriver),
            access,
            snapshot,
            presentation,
        )
        .map_err(NativePreviewAttachError::into_message)
    }

    fn attach_with_dispatcher(
        &self,
        parent_ptr: usize,
        dispatcher: MainThreadDispatcher,
        driver: Arc<dyn NativeViewDriver>,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), NativePreviewAttachError> {
        validate_presentation(snapshot, presentation).map_err(NativePreviewAttachError::Stale)?;
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

        let resolve_request = resolve_request(snapshot, presentation);
        let access_claim = access
            .claim_for_native_bind(&resolve_request)
            .map_err(|error| NativePreviewAttachError::Stale(map_access_error(error)))?;
        access_claim
            .validate()
            .map_err(|error| NativePreviewAttachError::Stale(map_access_error(error)))?;
        #[cfg(test)]
        self.run_after_claim_validation_hook();

        // Claim and validate the exact access tuple before advancing host
        // generation. A revoked/stale candidate must not invalidate a valid
        // native bind that is already in flight.
        let reservation = self
            .begin_replacement()
            .map_err(NativePreviewAttachError::Stale)?;
        let staged_path = access_claim.staged_path().to_owned();
        let bounds = presentation.bounds;
        let access_for_bind = Arc::clone(&access);
        let bind_request = resolve_request.clone();
        let driver_for_bind = Arc::clone(&driver);
        let view_id = match view::dispatch_sync(dispatcher.clone(), move || {
            access_for_bind
                .validate_native_bind(&bind_request)
                .map_err(NativeBindError::Access)?;
            driver_for_bind
                .create(parent_ptr, &staged_path, bounds)
                .map_err(NativeBindError::Presentation)
        }) {
            Ok(view_id) => view_id,
            Err(NativeBindError::Access(error)) => {
                return Err(NativePreviewAttachError::Stale(map_access_error(error)));
            }
            Err(NativeBindError::Presentation(error)) => {
                return Err(if self.reservation_is_current(&reservation) {
                    NativePreviewAttachError::Presentation(error)
                } else {
                    NativePreviewAttachError::Stale(
                        "macos_quick_look_presentation_stale".to_string(),
                    )
                });
            }
        };

        // The lifecycle may have been cancelled or switched while AppKit was
        // creating/binding the view. This is the final exact staging check
        // before the view enters HostState.
        let candidate = CurrentNativeView {
            identity,
            view_id,
            dispatcher,
            driver,
            _access_claim: access_claim,
        };
        if let Err(error) = candidate._access_claim.validate() {
            return Err(self.cleanup_candidate(
                candidate,
                NativePreviewAttachError::Stale(map_access_error(error)),
            ));
        }

        match self.commit_replacement(reservation, candidate) {
            ReplacementOutcome::Replaced(previous) => {
                if let Some(previous) = previous {
                    if let Err((error, previous)) = release_native_view(previous) {
                        lock_state(&self.state).retired.push(*previous);
                        return Err(NativePreviewAttachError::Cleanup(error));
                    }
                }
            }
            ReplacementOutcome::Coalesced(candidate) => {
                self.release_candidate(candidate)?;
            }
            ReplacementOutcome::Stale(candidate) => {
                return Err(self.cleanup_candidate(
                    candidate,
                    NativePreviewAttachError::Stale(
                        "macos_quick_look_presentation_stale".to_string(),
                    ),
                ));
            }
            ReplacementOutcome::ClaimStale(candidate, error) => {
                return Err(self.cleanup_candidate(
                    candidate,
                    NativePreviewAttachError::Stale(map_access_error(error)),
                ));
            }
        }
        Ok(())
    }

    fn cleanup_candidate(
        &self,
        candidate: CurrentNativeView,
        primary: NativePreviewAttachError,
    ) -> NativePreviewAttachError {
        match self.release_candidate(candidate) {
            Ok(()) => primary,
            Err(error) => NativePreviewAttachError::Cleanup(format!(
                "{};{}",
                primary.clone().into_message(),
                error.into_message()
            )),
        }
    }

    fn release_candidate(
        &self,
        candidate: CurrentNativeView,
    ) -> Result<(), NativePreviewAttachError> {
        match release_native_view(candidate) {
            Ok(()) => Ok(()),
            Err((error, candidate)) => {
                lock_state(&self.state).retired.push(*candidate);
                Err(NativePreviewAttachError::Cleanup(error))
            }
        }
    }

    fn reservation_is_current(&self, reservation: &ReplacementReservation) -> bool {
        let state = lock_state(&self.state);
        !state.disposed
            && replacement_is_current(
                state.generation,
                state.current.as_ref().map(|current| &current.identity),
                reservation,
            )
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
            .map_err(NativePreviewAttachError::into_message)
    }

    fn update_geometry_with_dispatcher(
        &self,
        parent_ptr: usize,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), NativePreviewAttachError> {
        let identity = NativeViewIdentity::from_snapshot(snapshot, presentation);
        let (view_id, dispatcher, driver) = {
            let state = lock_state(&self.state);
            let Some(current) = state.current.as_ref() else {
                return Err(NativePreviewAttachError::Stale(
                    "macos_quick_look_native_view_missing".to_string(),
                ));
            };
            if current.identity != identity {
                return Err(NativePreviewAttachError::Stale(
                    "macos_quick_look_native_identity_changed".to_string(),
                ));
            }
            (
                current.view_id,
                Arc::clone(&current.dispatcher),
                Arc::clone(&current.driver),
            )
        };
        access
            .validate_native_bind(&resolve_request(snapshot, presentation))
            .map_err(|error| NativePreviewAttachError::Stale(map_access_error(error)))?;
        let bounds = presentation.bounds;
        match view::dispatch_sync(dispatcher, move || {
            driver.update(parent_ptr, view_id, bounds)
        }) {
            Ok(()) => Ok(()),
            Err(error) => {
                if self.current_identity_matches(&identity) {
                    Err(NativePreviewAttachError::Presentation(error))
                } else {
                    Err(NativePreviewAttachError::Stale(
                        "macos_quick_look_presentation_stale".to_string(),
                    ))
                }
            }
        }
    }

    pub(crate) fn detach(
        &self,
        preview_id: &str,
        expected_snapshot: Option<&PreviewSnapshotDto>,
    ) -> Result<(), String> {
        #[cfg(test)]
        {
            let mut state = lock_state(&self.state);
            if state.fail_next_detach {
                state.fail_next_detach = false;
                return Err("macos_quick_look_test_detach_failed".to_string());
            }
        }
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
        let state = lock_state(&self.state);
        if state.disposed {
            return Err("macos_quick_look_host_disposed".to_string());
        }
        let current_identity = state
            .current
            .as_ref()
            .map(|current| current.identity.clone());
        Ok(ReplacementReservation {
            generation: state.generation,
            current_identity,
        })
    }

    fn commit_replacement(
        &self,
        reservation: ReplacementReservation,
        candidate: CurrentNativeView,
    ) -> ReplacementOutcome {
        let mut state = lock_state(&self.state);
        if state.disposed {
            return ReplacementOutcome::Stale(candidate);
        }

        // Another exact attach may have committed while this candidate was
        // being created. It is a benign coalescing race: keep the winner and
        // let the loser detach/release only its own candidate.
        if state
            .current
            .as_ref()
            .is_some_and(|current| current.identity == candidate.identity)
        {
            return ReplacementOutcome::Coalesced(candidate);
        }

        let current_identity = state.current.as_ref().map(|current| &current.identity);
        if !replacement_is_current(state.generation, current_identity, &reservation) {
            return ReplacementOutcome::Stale(candidate);
        }

        // This is the final exact staging check while the host transaction is
        // still unpublished. A revoked claim can never displace the retained
        // current owner.
        if let Err(error) = candidate._access_claim.validate() {
            return ReplacementOutcome::ClaimStale(candidate, error);
        }
        bump_generation(&mut state);
        ReplacementOutcome::Replaced(state.current.replace(candidate))
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
    let driver = Arc::clone(&current.driver);
    match view::dispatch_sync(current.dispatcher.clone(), move || {
        driver.remove(view_id);
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

#[cfg(any(test, feature = "native-qa"))]
impl MacQuickLookPreviewHost {
    pub(super) fn current_view_id(&self) -> Option<NativeViewId> {
        lock_state(&self.state)
            .current
            .as_ref()
            .map(|current| current.view_id)
    }
}

#[cfg(test)]
impl MacQuickLookPreviewHost {
    pub(crate) fn fail_next_detach_for_test(&self) {
        lock_state(&self.state).fail_next_detach = true;
    }

    fn set_after_claim_validation_hook(&self, hook: Option<Box<dyn FnOnce() + Send>>) {
        lock_state(&self.state).after_claim_validation = hook;
    }

    fn run_after_claim_validation_hook(&self) {
        let hook = lock_state(&self.state).after_claim_validation.take();
        if let Some(hook) = hook {
            hook();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        file_workspace::{
            contracts::PreviewSourceRef,
            integration::types::{
                PreviewNativeBounds, PreviewNativePresentation, PreviewSessionStateDto,
                PreviewSnapshotDto,
            },
            native_preview::access::{
                NativePreviewAccessConfig, NativePreviewAccessRegistry, NativePreviewAccessRequest,
                NativePreviewAccessResolveRequest,
            },
            preview::{
                PreviewCancellation, PreviewCapabilities, PreviewOperationContext,
                PreviewRepresentationEnvelope,
            },
            read_gate::{
                MaterializationReadGate, ReadGateConfig, ReadGateSourceResolver,
                ResolvedContentSource, SourceResolutionError,
            },
        },
        scheduler::WorkScheduler,
    };
    use std::{
        collections::HashSet,
        fs,
        path::{Path, PathBuf},
        sync::{
            atomic::{AtomicBool, AtomicU64, Ordering},
            mpsc, Arc, Mutex,
        },
        thread,
        time::{Duration, Instant},
    };

    struct TestFixture {
        root: PathBuf,
    }

    impl TestFixture {
        fn new(name: &str) -> Self {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .expect("workspace root")
                .join(".tmp-tests")
                .join(format!("native-host-{name}-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).expect("native host fixture root");
            fs::write(root.join("document.pdf"), b"native host fixture")
                .expect("native host fixture source");
            Self { root }
        }
    }

    impl Drop for TestFixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    struct TestResolver {
        source_path: PathBuf,
    }

    impl ReadGateSourceResolver for TestResolver {
        fn resolve_source(
            &self,
            source: &PreviewSourceRef,
        ) -> Result<ResolvedContentSource, SourceResolutionError> {
            match source {
                PreviewSourceRef::Managed { file_id } if file_id == "file-1" => Ok(
                    ResolvedContentSource::from_backend_path(self.source_path.clone()),
                ),
                _ => Err(SourceResolutionError::NotSupported),
            }
        }
    }

    fn access_fixture(name: &str) -> (TestFixture, Arc<NativePreviewAccessRegistry>, String) {
        let fixture = TestFixture::new(name);
        let source = PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        };
        let resolver = Arc::new(TestResolver {
            source_path: fixture.root.join("document.pdf"),
        });
        let gate = Arc::new(
            MaterializationReadGate::new(resolver, ReadGateConfig::default()).expect("read gate"),
        );
        let source_version = gate
            .current_source_version(&source)
            .expect("source version");
        let registry = NativePreviewAccessRegistry::new(
            fixture.root.join("native-preview"),
            gate,
            WorkScheduler::global(),
            NativePreviewAccessConfig::default(),
        )
        .expect("native access registry");
        (fixture, registry, source_version)
    }

    fn stage(
        registry: &Arc<NativePreviewAccessRegistry>,
        request_id: &str,
        source_version: &str,
    ) -> NativePreviewAccessResolveRequest {
        let source = PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        };
        let context = PreviewOperationContext::for_backend_content_read(
            "session",
            request_id,
            source_version,
            PreviewCancellation::default(),
            Instant::now() + Duration::from_secs(5),
        );
        let handle = registry
            .stage(
                NativePreviewAccessRequest {
                    session_id: "session".to_string(),
                    request_id: request_id.to_string(),
                    source,
                    source_version: source_version.to_string(),
                    host: PreviewHostKind::ZenFloating,
                },
                &context,
            )
            .expect("stage native access");
        NativePreviewAccessResolveRequest {
            token: handle.token,
            session_id: "session".to_string(),
            request_id: request_id.to_string(),
            source_version: source_version.to_string(),
            host: PreviewHostKind::ZenFloating,
        }
    }

    fn native_snapshot(
        request: &NativePreviewAccessResolveRequest,
    ) -> (PreviewSnapshotDto, PreviewNativePresentation) {
        let source = PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        };
        let representation = crate::file_workspace::preview::PreviewRepresentation::NativeOpaque {
            host: request.host,
            token: request.token.clone(),
        };
        let snapshot = PreviewSnapshotDto {
            preview_id: "preview".to_string(),
            session_id: request.session_id.clone(),
            request_id: request.request_id.clone(),
            source,
            host_kind: request.host,
            state: PreviewSessionStateDto::Ready,
            source_version: Some(request.source_version.clone()),
            representation: Some(PreviewRepresentationEnvelope {
                source_version: request.source_version.clone(),
                representation,
                completeness: crate::file_workspace::preview::PreviewCompleteness::Complete,
                warnings: Vec::new(),
                capabilities: PreviewCapabilities::all(),
            }),
            effective_capabilities: PreviewCapabilities::all(),
            active_provider_id: Some("native.macos.quick-look".to_string()),
        };
        let presentation = PreviewNativePresentation {
            host: request.host,
            token: request.token.clone(),
            source_version: request.source_version.clone(),
            bounds: PreviewNativeBounds {
                x: 0,
                y: 0,
                width: 400,
                height: 300,
            },
        };
        (snapshot, presentation)
    }

    #[derive(Default)]
    struct FakeNativeViewDriver {
        next_id: AtomicU64,
        live: Mutex<HashSet<NativeViewId>>,
        create_barrier: Mutex<Option<(mpsc::SyncSender<()>, mpsc::Receiver<()>)>>,
    }

    impl FakeNativeViewDriver {
        fn live_count(&self) -> usize {
            self.live.lock().expect("fake native view lock").len()
        }

        fn block_next_create(&self, entered: mpsc::SyncSender<()>, release: mpsc::Receiver<()>) {
            *self
                .create_barrier
                .lock()
                .expect("fake native create barrier lock") = Some((entered, release));
        }
    }

    impl NativeViewDriver for FakeNativeViewDriver {
        fn create(
            &self,
            _parent_ptr: usize,
            staged_path: &Path,
            _bounds: PreviewNativeBounds,
        ) -> Result<NativeViewId, String> {
            if !staged_path.is_file() {
                return Err("test_staged_path_missing".to_string());
            }
            if let Some((entered, release)) = self
                .create_barrier
                .lock()
                .expect("fake native create barrier lock")
                .take()
            {
                entered.send(()).expect("native create barrier receiver");
                release
                    .recv_timeout(Duration::from_secs(5))
                    .expect("native create barrier release");
            }
            let view_id = self.next_id.fetch_add(1, Ordering::AcqRel) + 1;
            self.live
                .lock()
                .expect("fake native view lock")
                .insert(view_id);
            Ok(view_id)
        }

        fn update(
            &self,
            _parent_ptr: usize,
            view_id: NativeViewId,
            _bounds: PreviewNativeBounds,
        ) -> Result<(), String> {
            self.live
                .lock()
                .expect("fake native view lock")
                .contains(&view_id)
                .then_some(())
                .ok_or_else(|| "test_native_view_missing".to_string())
        }

        fn remove(&self, view_id: NativeViewId) {
            self.live
                .lock()
                .expect("fake native view lock")
                .remove(&view_id);
        }
    }

    fn inline_dispatcher() -> MainThreadDispatcher {
        Arc::new(|task| {
            task();
            Ok(())
        })
    }

    fn one_shot_blocking_dispatcher(
        entered: mpsc::SyncSender<()>,
        release: mpsc::Receiver<()>,
    ) -> MainThreadDispatcher {
        let first = Arc::new(AtomicBool::new(true));
        let release = Mutex::new(release);
        Arc::new(move |task| {
            task();
            if first.swap(false, Ordering::AcqRel) {
                entered.send(()).expect("dispatcher entry receiver");
                release
                    .lock()
                    .expect("dispatcher release lock")
                    .recv_timeout(Duration::from_secs(5))
                    .expect("dispatcher release sender");
            }
            Ok(())
        })
    }

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

    #[allow(non_snake_case)]
    #[test]
    fn revoked_A_after_claim_validation_does_not_poison_valid_C_in_flight() {
        let (fixture, registry, source_version) = access_fixture("stale-a");
        let host = MacQuickLookPreviewHost::new();
        let driver = Arc::new(FakeNativeViewDriver::default());

        let access_b = stage(&registry, "request-b", &source_version);
        let (snapshot_b, presentation_b) = native_snapshot(&access_b);
        host.attach_with_dispatcher(
            0,
            inline_dispatcher(),
            driver.clone(),
            Arc::clone(&registry),
            &snapshot_b,
            &presentation_b,
        )
        .expect("B attach");
        let b_view_id = host.current_view_id().expect("B current view");
        assert_eq!(driver.live_count(), 1);
        assert!(registry.validate_native_bind(&access_b).is_ok());
        let generation_before_c = lock_state(&host.state).generation;

        let access_a = stage(&registry, "request-a", &source_version);
        let access_c = stage(&registry, "request-c", &source_version);
        let (snapshot_a, presentation_a) = native_snapshot(&access_a);
        let (snapshot_c, presentation_c) = native_snapshot(&access_c);
        let (a_validated_tx, a_validated_rx) = mpsc::sync_channel(0);
        let (a_resume_tx, a_resume_rx) = mpsc::channel();
        host.set_after_claim_validation_hook(Some(Box::new(move || {
            a_validated_tx
                .send(())
                .expect("A validation barrier receiver");
            a_resume_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("A validation barrier release");
        })));

        let host_a = host.clone();
        let registry_a = Arc::clone(&registry);
        let driver_a: Arc<dyn NativeViewDriver> = driver.clone();
        let snapshot_a_for_attach = snapshot_a.clone();
        let presentation_a_for_attach = presentation_a.clone();
        let a_thread = thread::spawn(move || {
            host_a.attach_with_dispatcher(
                0,
                inline_dispatcher(),
                driver_a,
                registry_a,
                &snapshot_a_for_attach,
                &presentation_a_for_attach,
            )
        });
        a_validated_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("A must pause after successful claim validation");
        assert!(registry.validate_native_bind(&access_a).is_ok());
        registry.revoke_token_for_native_failure(&access_a);
        assert!(registry.validate_native_bind(&access_a).is_err());

        let (c_created_tx, c_created_rx) = mpsc::sync_channel(0);
        let (c_resume_tx, c_resume_rx) = mpsc::channel();
        driver.block_next_create(c_created_tx, c_resume_rx);
        let c_host = host.clone();
        let c_registry = Arc::clone(&registry);
        let c_driver: Arc<dyn NativeViewDriver> = driver.clone();
        let snapshot_c_for_attach = snapshot_c.clone();
        let c_thread = thread::spawn(move || {
            c_host.attach_with_dispatcher(
                0,
                inline_dispatcher(),
                c_driver,
                c_registry,
                &snapshot_c_for_attach,
                &presentation_c,
            )
        });
        c_created_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("C must pause during native creation");
        let generation_during_c = lock_state(&host.state).generation;
        assert_eq!(generation_during_c, generation_before_c);
        a_resume_tx.send(()).expect("resume A after C reservation");
        let a_result = a_thread.join().expect("A attach thread");
        assert!(matches!(a_result, Err(NativePreviewAttachError::Stale(_))));
        assert_eq!(lock_state(&host.state).generation, generation_during_c);
        assert_eq!(host.current_view_id(), Some(b_view_id));
        assert_eq!(driver.live_count(), 2);
        assert!(registry.validate_native_bind(&access_b).is_ok());
        assert!(registry.validate_native_bind(&access_c).is_ok());

        c_resume_tx.send(()).expect("release C native creation");
        c_thread
            .join()
            .expect("C attach thread")
            .expect("C attach succeeds");
        let c_view_id = host.current_view_id().expect("C current view");
        assert_ne!(c_view_id, b_view_id);
        assert_eq!(driver.live_count(), 1);
        assert!(registry.validate_native_bind(&access_c).is_ok());
        assert!(registry.validate_native_bind(&access_b).is_err());
        assert!(registry
            .resolve(&access_c)
            .expect("C staged path")
            .is_file());

        host.detach("preview", Some(&snapshot_c)).expect("detach C");
        assert_eq!(driver.live_count(), 0);
        assert_eq!(registry.counts(), (0, 0, 0));
        assert_no_native_stage_roots(&fixture.root);
    }

    #[test]
    fn concurrent_exact_first_attaches_coalesce_and_release_only_loser() {
        let (_fixture, registry, source_version) = access_fixture("coalesce");
        let access_request = stage(&registry, "request", &source_version);
        let (snapshot, presentation) = native_snapshot(&access_request);
        let host = MacQuickLookPreviewHost::new();
        let driver = Arc::new(FakeNativeViewDriver::default());

        let (entered_a_tx, entered_a_rx) = mpsc::sync_channel(0);
        let (release_a_tx, release_a_rx) = mpsc::channel();
        let (entered_b_tx, entered_b_rx) = mpsc::sync_channel(0);
        let (release_b_tx, release_b_rx) = mpsc::channel();
        let dispatcher_a = one_shot_blocking_dispatcher(entered_a_tx, release_a_rx);
        let dispatcher_b = one_shot_blocking_dispatcher(entered_b_tx, release_b_rx);

        let host_a = host.clone();
        let registry_a = Arc::clone(&registry);
        let driver_a: Arc<dyn NativeViewDriver> = driver.clone();
        let snapshot_a = snapshot.clone();
        let presentation_a = presentation.clone();
        let thread_a = thread::spawn(move || {
            host_a.attach_with_dispatcher(
                0,
                dispatcher_a,
                driver_a,
                registry_a,
                &snapshot_a,
                &presentation_a,
            )
        });
        entered_a_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("first exact attach created candidate");

        let host_b = host.clone();
        let registry_b = Arc::clone(&registry);
        let driver_b: Arc<dyn NativeViewDriver> = driver.clone();
        let snapshot_b = snapshot.clone();
        let presentation_b = presentation.clone();
        let thread_b = thread::spawn(move || {
            host_b.attach_with_dispatcher(
                0,
                dispatcher_b,
                driver_b,
                registry_b,
                &snapshot_b,
                &presentation_b,
            )
        });
        entered_b_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("second exact attach created candidate");

        release_b_tx.send(()).expect("release winner candidate");
        thread_b
            .join()
            .expect("winner attach thread")
            .expect("winner attach succeeds");
        release_a_tx.send(()).expect("release coalesced candidate");
        thread_a
            .join()
            .expect("coalesced attach thread")
            .expect("coalesced attach succeeds");

        assert_eq!(driver.live_count(), 1);
        assert!(host.current_view_id().is_some());
        assert!(registry.validate_native_bind(&access_request).is_ok());
        host.detach("preview", Some(&snapshot))
            .expect("detach coalesced winner");
        assert_eq!(driver.live_count(), 0);
        assert_eq!(registry.counts(), (0, 0, 0));
    }

    #[test]
    fn failed_detach_retains_owner_until_retry_then_releases_claim_and_stage() {
        let (fixture, registry, source_version) = access_fixture("detach-retry");
        let access_request = stage(&registry, "request", &source_version);
        let (snapshot, presentation) = native_snapshot(&access_request);
        let staged_path = registry
            .resolve(&access_request)
            .expect("resolve staged path before attach");
        let host = MacQuickLookPreviewHost::new();
        let driver = Arc::new(FakeNativeViewDriver::default());
        let failed = Arc::new(AtomicBool::new(false));
        let failed_for_dispatch = Arc::clone(&failed);
        let dispatcher: MainThreadDispatcher = Arc::new(move |task| {
            if failed_for_dispatch.load(Ordering::Acquire) {
                return Err("test_main_thread_dispatch_failed".to_string());
            }
            task();
            Ok(())
        });
        host.attach_with_dispatcher(
            0,
            dispatcher,
            driver.clone(),
            Arc::clone(&registry),
            &snapshot,
            &presentation,
        )
        .expect("initial attach");
        failed.store(true, Ordering::Release);

        assert!(host.detach("preview", Some(&snapshot)).is_err());
        assert!(host.current_view_id().is_none());
        assert!(staged_path.is_file());
        assert!(registry.validate_native_bind(&access_request).is_ok());
        assert_eq!(driver.live_count(), 1);

        failed.store(false, Ordering::Release);
        host.detach("preview", Some(&snapshot))
            .expect("retry failed detach");
        assert!(!staged_path.exists());
        assert_eq!(driver.live_count(), 0);
        assert_eq!(registry.counts(), (0, 0, 0));
        assert_no_native_stage_roots(&fixture.root);
    }

    fn assert_no_native_stage_roots(root: &Path) {
        let count = fs::read_dir(root.join("native-preview"))
            .expect("native preview root")
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".native-preview-")
            })
            .count();
        assert_eq!(count, 0);
    }
}
