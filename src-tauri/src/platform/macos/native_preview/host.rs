//! AppKit/QuickLookUI view lifecycle for Zen Preview hosts.
//!
//! The coordination state in this module contains only identity, generation
//! and opaque owner handles. The retained `QLPreviewView` values live in a
//! main-thread-only store and are created, updated, detached and released on
//! that thread. Native Preview Access claims keep the staged snapshot alive
//! until the view owner has cleared the Quick Look item and removed the view.

use crate::file_workspace::{
    contracts::PreviewHostKind,
    integration::types::{
        PreviewNativeBounds, PreviewNativePresentation, PreviewSessionStateDto, PreviewSnapshotDto,
    },
    native_preview::access::{
        NativePreviewAccessClaim, NativePreviewAccessError, NativePreviewAccessRegistry,
        NativePreviewAccessResolveRequest,
    },
    preview::{
        PreviewCapabilities, PreviewCompleteness, PreviewRepresentation,
        PreviewRepresentationEnvelope,
    },
};
use objc2::{
    extern_class, rc::Retained, runtime::AnyClass, ClassType, MainThreadMarker, MainThreadOnly,
};
#[cfg(feature = "native-qa")]
use objc2_app_kit::NSApplication;
use objc2_app_kit::NSView;
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSURL};
use std::{
    cell::RefCell,
    collections::HashMap,
    path::Path,
    sync::{mpsc, Arc, Mutex},
};
use tauri::{Runtime, WebviewWindow};

#[cfg(feature = "native-qa")]
use crate::file_workspace::{
    contracts::PreviewSourceRef,
    native_preview::access::{NativePreviewAccessConfig, NativePreviewAccessRequest},
    preview::{PreviewCancellation, PreviewOperationContext},
    read_gate::{
        MaterializationReadGate, ReadGateConfig, ReadGateSourceResolver, ResolvedContentSource,
        SourceResolutionError,
    },
};
#[cfg(feature = "native-qa")]
use crate::scheduler::{PermissiveResourcePolicy, SchedulerConfig, WorkScheduler};
#[cfg(feature = "native-qa")]
use std::{
    fs,
    path::PathBuf,
    time::{Duration, Instant},
};

#[link(name = "QuickLookUI", kind = "framework")]
unsafe extern "C" {}

extern_class!(
    #[unsafe(super(NSView))]
    #[thread_kind = MainThreadOnly]
    #[name = "QLPreviewView"]
    struct QLPreviewView;
);

pub(crate) type NativeViewId = u64;
type MainThreadTask = Box<dyn FnOnce() + Send + 'static>;
type MainThreadDispatcher = Arc<dyn Fn(MainThreadTask) -> Result<(), String> + Send + Sync>;

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
    access_claim: NativePreviewAccessClaim,
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

/// Main-thread-owned retained AppKit values. No `QLPreviewView` crosses the
/// coordination mutex or is represented by a reconstructed raw pointer.
#[cfg(feature = "native-qa")]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct NativeViewMetrics {
    creations: usize,
    binds: usize,
    refreshes: usize,
    frame_updates: usize,
    detachments: usize,
}

#[derive(Default)]
struct NativeViewStore {
    next_id: NativeViewId,
    views: HashMap<NativeViewId, Retained<QLPreviewView>>,
    #[cfg(feature = "native-qa")]
    metrics: NativeViewMetrics,
}

thread_local! {
    static NATIVE_VIEW_STORE: RefCell<NativeViewStore> = RefCell::new(NativeViewStore {
        next_id: 1,
        views: HashMap::new(),
        #[cfg(feature = "native-qa")]
        metrics: NativeViewMetrics::default(),
    });
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
        let parent_ptr = parent_ptr(window)?;
        let dispatcher = dispatcher_for_window(window);
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
            harness_dispatcher(),
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

        let (generation, previous) = self.begin_replace()?;
        if let Some(previous) = previous {
            if let Err((error, previous)) = release_native_view(previous) {
                lock_state(&self.state).retired.push(previous);
                return Err(error);
            }
        }

        let resolve_request = resolve_request(snapshot, presentation);
        let access_claim = access
            .claim_for_native_bind(&resolve_request)
            .map_err(map_access_error)?;
        let staged_path = access_claim.staged_path().to_owned();
        let bounds = presentation.bounds;
        let access_for_bind = Arc::clone(&access);
        let bind_request = resolve_request.clone();
        let view_id = dispatch_sync(dispatcher.clone(), move || {
            access_for_bind
                .validate_native_bind(&bind_request)
                .map_err(map_access_error)?;
            create_native_view(parent_ptr, &staged_path, bounds)
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
        let accepted = {
            let mut state = lock_state(&self.state);
            if state.disposed || state.generation != generation {
                false
            } else {
                state.current = Some(CurrentNativeView {
                    identity,
                    view_id,
                    dispatcher,
                    access_claim,
                });
                true
            }
        };
        if !accepted {
            let _ = remove_view(&cleanup_dispatcher, view_id);
            return Err("macos_quick_look_presentation_stale".to_string());
        }
        Ok(())
    }

    pub(crate) fn update_geometry<R: Runtime + 'static>(
        &self,
        window: &WebviewWindow<R>,
        access: Arc<NativePreviewAccessRegistry>,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        validate_presentation(snapshot, presentation)?;
        let parent_ptr = parent_ptr(window)?;
        self.update_geometry_with_dispatcher(parent_ptr, access, snapshot, presentation)
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
        dispatch_sync(dispatcher, move || {
            update_native_view(parent_ptr, view_id, bounds)
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
                lock_state(&self.state).retired.push(previous);
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
                lock_state(&self.state).retired.push(current);
            }
        }
        first_error.map_or(Ok(()), Err)
    }

    fn begin_replace(&self) -> Result<(u64, Option<CurrentNativeView>), String> {
        let mut state = lock_state(&self.state);
        if state.disposed {
            return Err("macos_quick_look_host_disposed".to_string());
        }
        bump_generation(&mut state);
        Ok((state.generation, state.current.take()))
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
                lock_state(&self.state).retired.push(current);
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

fn parent_ptr<R: Runtime>(window: &WebviewWindow<R>) -> Result<usize, String> {
    let parent_ptr = window
        .ns_view()
        .map_err(|error| format!("macos_quick_look_parent_unavailable:{error}"))?
        as usize;
    if parent_ptr == 0 {
        return Err("macos_quick_look_parent_unavailable".to_string());
    }
    Ok(parent_ptr)
}

fn dispatcher_for_window<R: Runtime + 'static>(window: &WebviewWindow<R>) -> MainThreadDispatcher {
    let window = window.clone();
    Arc::new(move |task| {
        window
            .run_on_main_thread(move || task())
            .map_err(|error| format!("macos_quick_look_main_thread_unavailable:{error}"))
    })
}

fn dispatch_sync<T, F>(dispatcher: MainThreadDispatcher, task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let (sender, receiver) = mpsc::sync_channel(1);
    dispatcher(Box::new(move || {
        let _ = sender.send(task());
    }))?;
    receiver
        .recv()
        .map_err(|_| "macos_quick_look_main_thread_unavailable".to_string())?
}

fn release_native_view(current: CurrentNativeView) -> Result<(), (String, CurrentNativeView)> {
    let view_id = current.view_id;
    match dispatch_sync(current.dispatcher.clone(), move || {
        remove_native_view(view_id);
        Ok(())
    }) {
        Ok(()) => {
            // Drop the claim only after AppKit has cleared the item and
            // removed the view, so staging cleanup cannot race Quick Look.
            drop(current);
            Ok(())
        }
        Err(error) => Err((error, current)),
    }
}

fn remove_view(dispatcher: &MainThreadDispatcher, view_id: NativeViewId) -> Result<(), String> {
    dispatch_sync(Arc::clone(dispatcher), move || {
        remove_native_view(view_id);
        Ok(())
    })
}

fn create_native_view(
    parent_ptr: usize,
    staged_path: &Path,
    bounds: PreviewNativeBounds,
) -> Result<NativeViewId, String> {
    let parent = unsafe { &*(parent_ptr as *const NSView) };
    let frame = frame_for_parent(parent.bounds().size.height, bounds);
    let initial_frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0));
    let marker = MainThreadMarker::new()
        .ok_or_else(|| "macos_quick_look_main_thread_unavailable".to_string())?;
    let view: Retained<QLPreviewView> = unsafe {
        objc2::msg_send![QLPreviewView::alloc(marker), initWithFrame: initial_frame, style: 0isize]
    };
    let staged_name = staged_path
        .to_str()
        .ok_or_else(|| "macos_quick_look_staged_name_invalid".to_string())?;
    let path = NSString::from_str(staged_name);
    let url = NSURL::fileURLWithPath(&path);
    unsafe {
        let _: () = objc2::msg_send![&*view, setPreviewItem: &*url];
        let _: () = objc2::msg_send![&*view, refreshPreviewItem];
    }
    #[cfg(feature = "native-qa")]
    NATIVE_VIEW_STORE.with(|store| {
        let mut store = store.borrow_mut();
        store.metrics.binds += 1;
        store.metrics.refreshes += 1;
    });
    view.as_super().setFrame(frame);
    parent.addSubview(view.as_super());
    NATIVE_VIEW_STORE.with(|store| {
        let mut store = store.borrow_mut();
        let view_id = store.next_id;
        store.next_id = store.next_id.wrapping_add(1).max(1);
        store.views.insert(view_id, view);
        #[cfg(feature = "native-qa")]
        {
            store.metrics.creations += 1;
        }
        Ok(view_id)
    })
}

fn update_native_view(
    parent_ptr: usize,
    view_id: NativeViewId,
    bounds: PreviewNativeBounds,
) -> Result<(), String> {
    let parent = unsafe { &*(parent_ptr as *const NSView) };
    let frame = frame_for_parent(parent.bounds().size.height, bounds);
    NATIVE_VIEW_STORE.with(|store| {
        let mut store = store.borrow_mut();
        {
            let view = store
                .views
                .get(&view_id)
                .ok_or_else(|| "macos_quick_look_native_view_missing".to_string())?;
            view.as_super().setFrame(frame);
        }
        #[cfg(feature = "native-qa")]
        {
            store.metrics.frame_updates += 1;
        }
        Ok(())
    })
}

fn frame_for_parent(parent_height: f64, bounds: PreviewNativeBounds) -> NSRect {
    NSRect::new(
        NSPoint::new(
            bounds.x as f64,
            parent_height - bounds.y as f64 - bounds.height as f64,
        ),
        NSSize::new(bounds.width as f64, bounds.height as f64),
    )
}

fn remove_native_view(view_id: NativeViewId) {
    NATIVE_VIEW_STORE.with(|store| {
        let mut store = store.borrow_mut();
        let Some(view) = store.views.remove(&view_id) else {
            return;
        };
        unsafe {
            let no_item: Option<&NSURL> = None;
            let _: () = objc2::msg_send![&*view, setPreviewItem: no_item];
        }
        view.as_super().removeFromSuperview();
        drop(view);
        #[cfg(feature = "native-qa")]
        {
            store.metrics.detachments += 1;
        }
    });
}

#[cfg(feature = "native-qa")]
pub(crate) fn native_view_is_attached(view_id: NativeViewId) -> bool {
    NATIVE_VIEW_STORE.with(|store| {
        let store = store.borrow();
        store
            .views
            .get(&view_id)
            .is_some_and(|view| unsafe { view.as_super().superview().is_some() })
    })
}

#[cfg(feature = "native-qa")]
fn reset_native_view_metrics() {
    NATIVE_VIEW_STORE.with(|store| {
        store.borrow_mut().metrics = NativeViewMetrics::default();
    });
}

#[cfg(feature = "native-qa")]
fn native_view_metrics() -> NativeViewMetrics {
    NATIVE_VIEW_STORE.with(|store| store.borrow().metrics)
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
    AnyClass::get(c"QLPreviewView").is_some()
}

#[cfg(feature = "native-qa")]
impl MacQuickLookPreviewHost {
    fn current_view_id(&self) -> Option<NativeViewId> {
        lock_state(&self.state)
            .current
            .as_ref()
            .map(|current| current.view_id)
    }
}

#[cfg(feature = "native-qa")]
struct HarnessSourceResolver {
    path: PathBuf,
}

#[cfg(feature = "native-qa")]
impl ReadGateSourceResolver for HarnessSourceResolver {
    fn resolve_source(
        &self,
        _source: &PreviewSourceRef,
    ) -> Result<ResolvedContentSource, SourceResolutionError> {
        Ok(ResolvedContentSource::from_backend_path(self.path.clone()))
    }
}

#[cfg(feature = "native-qa")]
struct HarnessAccess {
    registry: Arc<NativePreviewAccessRegistry>,
    source: PreviewSourceRef,
    source_version: String,
    session_id: String,
    host: PreviewHostKind,
}

#[cfg(feature = "native-qa")]
impl HarnessAccess {
    fn new(source_path: PathBuf, stage_root: PathBuf, entry_id: &str) -> Result<Self, String> {
        let read_gate = Arc::new(
            MaterializationReadGate::new(
                HarnessSourceResolver { path: source_path },
                ReadGateConfig::default(),
            )
            .map_err(|error| format!("native_qa_read_gate_{error}"))?,
        );
        let source = PreviewSourceRef::Ephemeral {
            browse_session_id: "native-qa-session".to_string(),
            entry_id: entry_id.to_string(),
        };
        let source_version = read_gate
            .current_source_version(&source)
            .map_err(|error| format!("native_qa_source_version_{error}"))?;
        let scheduler = Arc::new(WorkScheduler::new(
            SchedulerConfig::default().with_policy(Arc::new(PermissiveResourcePolicy)),
        ));
        let registry = NativePreviewAccessRegistry::new(
            stage_root,
            read_gate,
            scheduler,
            NativePreviewAccessConfig::default(),
        )
        .map_err(|error| format!("native_qa_access_{error}"))?;
        Ok(Self {
            registry,
            source,
            source_version,
            session_id: "native-qa-session".to_string(),
            host: PreviewHostKind::ZenFloating,
        })
    }

    fn stage(&self, request_id: &str) -> Result<NativePreviewAccessHandleForHarness, String> {
        let context = PreviewOperationContext::for_backend_content_read(
            &self.session_id,
            request_id,
            &self.source_version,
            PreviewCancellation::default(),
            Instant::now() + Duration::from_secs(5),
        );
        let request = NativePreviewAccessRequest {
            session_id: self.session_id.clone(),
            request_id: request_id.to_string(),
            source: self.source.clone(),
            source_version: self.source_version.clone(),
            host: self.host,
        };
        let handle = self
            .registry
            .stage(request, &context)
            .map_err(|error| format!("native_qa_stage_{error}"))?;
        let bind_request = NativePreviewAccessResolveRequest {
            token: handle.token.clone(),
            session_id: self.session_id.clone(),
            request_id: request_id.to_string(),
            source_version: self.source_version.clone(),
            host: self.host,
        };
        let staged_path = self
            .registry
            .resolve(&bind_request)
            .map_err(|error| format!("native_qa_resolve_{error}"))?;
        Ok(NativePreviewAccessHandleForHarness {
            token: handle.token,
            staged_path,
        })
    }
}

#[cfg(feature = "native-qa")]
struct NativePreviewAccessHandleForHarness {
    token: String,
    staged_path: PathBuf,
}

#[cfg(feature = "native-qa")]
struct HarnessHostGuard(MacQuickLookPreviewHost);

#[cfg(feature = "native-qa")]
impl Drop for HarnessHostGuard {
    fn drop(&mut self) {
        let _ = self.0.dispose();
    }
}

#[cfg(feature = "native-qa")]
struct HarnessCleanup(PathBuf);

#[cfg(feature = "native-qa")]
impl Drop for HarnessCleanup {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[cfg(feature = "native-qa")]
fn harness_dispatcher() -> MainThreadDispatcher {
    Arc::new(|task| {
        task();
        Ok(())
    })
}

#[cfg(feature = "native-qa")]
fn harness_snapshot(access: &HarnessAccess, request_id: &str, token: &str) -> PreviewSnapshotDto {
    PreviewSnapshotDto {
        preview_id: "native-qa-preview".to_string(),
        session_id: access.session_id.clone(),
        request_id: request_id.to_string(),
        source: access.source.clone(),
        host_kind: access.host,
        state: PreviewSessionStateDto::Ready,
        source_version: Some(access.source_version.clone()),
        representation: Some(PreviewRepresentationEnvelope {
            source_version: access.source_version.clone(),
            representation: PreviewRepresentation::NativeOpaque {
                host: access.host,
                token: token.to_string(),
            },
            completeness: PreviewCompleteness::Complete,
            warnings: Vec::new(),
            capabilities: PreviewCapabilities::all(),
        }),
        effective_capabilities: PreviewCapabilities::all(),
        active_provider_id: Some("native.macos.quick-look".to_string()),
    }
}

#[cfg(feature = "native-qa")]
fn harness_presentation(
    access: &HarnessAccess,
    token: &str,
    bounds: PreviewNativeBounds,
) -> PreviewNativePresentation {
    PreviewNativePresentation {
        host: access.host,
        token: token.to_string(),
        source_version: access.source_version.clone(),
        bounds,
    }
}

#[cfg(feature = "native-qa")]
fn write_harness_pdf(path: &Path, label: &str) -> Result<(), String> {
    let escaped_label = label.replace('(', "\\(").replace(')', "\\)");
    let content = format!("BT /F1 18 Tf 20 100 Td ({escaped_label}) Tj ET\n");
    let objects = vec![
        b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(),
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_vec(),
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 220] /Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R >>".to_vec(),
        format!(
            "<< /Length {} >>\nstream\n{}endstream",
            content.len(),
            content
        )
        .into_bytes(),
        format!("<< /Title (Zen Canvas Quick Look {escaped_label}) >>").into_bytes(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_vec(),
    ];
    let mut bytes = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize; objects.len() + 1];
    for (index, object) in objects.iter().enumerate() {
        let object_number = index + 1;
        offsets[object_number] = bytes.len();
        bytes.extend_from_slice(format!("{object_number} 0 obj\n").as_bytes());
        bytes.extend_from_slice(object);
        bytes.extend_from_slice(b"\nendobj\n");
    }
    let xref_offset = bytes.len();
    bytes.extend_from_slice(format!("xref\n0 {}\n", offsets.len()).as_bytes());
    bytes.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    bytes.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info 5 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
            offsets.len()
        )
        .as_bytes(),
    );
    fs::write(path, bytes).map_err(|error| format!("native_qa_pdf_{error}"))
}

#[cfg(feature = "native-qa")]
pub(crate) fn run_native_preview_lifecycle_harness() -> Result<(), String> {
    if !available() {
        return Err("native_qa_quick_look_unavailable".to_string());
    }
    let marker =
        MainThreadMarker::new().ok_or_else(|| "native_qa_main_thread_unavailable".to_string())?;
    let _application = NSApplication::sharedApplication(marker);
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "native_qa_worktree_unavailable".to_string())?
        .join(".tmp-tests")
        .join(format!(
            "macos-native-preview-lifecycle-{}",
            std::process::id()
        ));
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| format!("native_qa_root_reset_{error}"))?;
    }
    fs::create_dir_all(&root).map_err(|error| format!("native_qa_root_create_{error}"))?;
    let _cleanup = HarnessCleanup(root.clone());
    let pdf_a = root.join("fixture-a.pdf");
    let pdf_b = root.join("fixture-b.pdf");
    write_harness_pdf(&pdf_a, "fixture A")?;
    write_harness_pdf(&pdf_b, "fixture B")?;
    let access_a = HarnessAccess::new(pdf_a.clone(), root.join("staging-a"), "fixture-a")?;
    let access_b = HarnessAccess::new(pdf_b.clone(), root.join("staging-b"), "fixture-b")?;
    let parent = NSView::alloc(marker).initWithFrame(NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(800.0, 600.0),
    ));
    let parent_ptr = (&*parent as *const NSView) as usize;
    let host = MacQuickLookPreviewHost::new();
    let _host_guard = HarnessHostGuard(host.clone());
    reset_native_view_metrics();

    let handle_a = access_a.stage("request-a")?;
    let snapshot_a = harness_snapshot(&access_a, "request-a", &handle_a.token);
    let presentation_a = harness_presentation(
        &access_a,
        &handle_a.token,
        PreviewNativeBounds {
            x: 10,
            y: 20,
            width: 420,
            height: 320,
        },
    );
    let staged_a = handle_a.staged_path.clone();
    host.attach_for_harness(
        parent_ptr,
        Arc::clone(&access_a.registry),
        &snapshot_a,
        &presentation_a,
    )?;
    let view_a = host
        .current_view_id()
        .ok_or_else(|| "native_qa_view_a_missing".to_string())?;
    if !native_view_is_attached(view_a) {
        return Err("native_qa_view_a_not_attached".to_string());
    }
    let mut resized_a = presentation_a.clone();
    resized_a.bounds.width += 20;
    resized_a.bounds.height += 20;
    host.attach_for_harness(
        parent_ptr,
        Arc::clone(&access_a.registry),
        &snapshot_a,
        &resized_a,
    )?;
    if host.current_view_id() != Some(view_a) || !native_view_is_attached(view_a) {
        return Err("native_qa_geometry_replaced_view".to_string());
    }
    resized_a.bounds.x += 10;
    host.update_geometry_for_harness(
        parent_ptr,
        Arc::clone(&access_a.registry),
        &snapshot_a,
        &resized_a,
    )?;
    resized_a.bounds.y += 10;
    host.update_geometry_for_harness(
        parent_ptr,
        Arc::clone(&access_a.registry),
        &snapshot_a,
        &resized_a,
    )?;

    let handle_b = access_b.stage("request-b")?;
    let snapshot_b = harness_snapshot(&access_b, "request-b", &handle_b.token);
    let presentation_b = harness_presentation(
        &access_b,
        &handle_b.token,
        PreviewNativeBounds {
            x: 30,
            y: 40,
            width: 460,
            height: 340,
        },
    );
    let staged_b = handle_b.staged_path.clone();
    host.attach_for_harness(
        parent_ptr,
        Arc::clone(&access_b.registry),
        &snapshot_b,
        &presentation_b,
    )?;
    if native_view_is_attached(view_a) {
        return Err("native_qa_switch_left_old_view_attached".to_string());
    }
    if staged_a.exists() {
        return Err("native_qa_switch_left_old_stage".to_string());
    }
    let view_b = host
        .current_view_id()
        .ok_or_else(|| "native_qa_view_b_missing".to_string())?;
    if view_b == view_a || !native_view_is_attached(view_b) {
        return Err("native_qa_view_b_not_attached".to_string());
    }
    let mut resized_b = presentation_b.clone();
    resized_b.bounds.width += 12;
    host.update_geometry_for_harness(
        parent_ptr,
        Arc::clone(&access_b.registry),
        &snapshot_b,
        &resized_b,
    )?;
    resized_b.bounds.height += 12;
    host.update_geometry_for_harness(
        parent_ptr,
        Arc::clone(&access_b.registry),
        &snapshot_b,
        &resized_b,
    )?;
    host.detach("native-qa-preview", Some(&snapshot_b))?;
    if host.current_view_id().is_some() || native_view_is_attached(view_b) || staged_b.exists() {
        return Err("native_qa_detach_left_view_or_stage".to_string());
    }
    host.detach("native-qa-preview", Some(&snapshot_b))?;

    for cycle in 0..3 {
        let request_id = format!("steady-{cycle}");
        let handle = access_a.stage(&request_id)?;
        let snapshot = harness_snapshot(&access_a, &request_id, &handle.token);
        let presentation = harness_presentation(
            &access_a,
            &handle.token,
            PreviewNativeBounds {
                x: 5 + cycle * 3,
                y: 8 + cycle * 3,
                width: 300,
                height: 240,
            },
        );
        let staged = handle.staged_path.clone();
        host.attach_for_harness(
            parent_ptr,
            Arc::clone(&access_a.registry),
            &snapshot,
            &presentation,
        )?;
        let view = host
            .current_view_id()
            .ok_or_else(|| "native_qa_steady_view_missing".to_string())?;
        host.update_geometry_for_harness(
            parent_ptr,
            Arc::clone(&access_a.registry),
            &snapshot,
            &presentation,
        )?;
        if !native_view_is_attached(view) {
            return Err("native_qa_steady_view_not_attached".to_string());
        }
        host.detach("native-qa-preview", Some(&snapshot))?;
        if native_view_is_attached(view) || staged.exists() {
            return Err("native_qa_steady_cleanup_failed".to_string());
        }
    }

    let metrics = native_view_metrics();
    if metrics.creations != 5
        || metrics.binds != 5
        || metrics.refreshes != 5
        || metrics.frame_updates < 8
        || metrics.detachments != 5
    {
        return Err(format!("native_qa_metrics_invalid:{metrics:?}"));
    }
    access_a.registry.dispose();
    access_b.registry.dispose();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn frame_updates_change_geometry_without_changing_owner_identity() {
        let first = frame_for_parent(
            900.0,
            PreviewNativeBounds {
                x: 10,
                y: 20,
                width: 400,
                height: 300,
            },
        );
        let second = frame_for_parent(
            900.0,
            PreviewNativeBounds {
                x: 30,
                y: 40,
                width: 500,
                height: 350,
            },
        );
        assert_ne!(first, second);
    }
}
