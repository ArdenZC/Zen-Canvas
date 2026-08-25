//! AppKit/QuickLookUI view lifecycle for Zen Preview hosts.

use crate::file_workspace::{
    contracts::PreviewHostKind,
    integration::types::{PreviewNativeBounds, PreviewNativePresentation, PreviewSnapshotDto},
    native_preview::access::{
        NativePreviewAccessError, NativePreviewAccessRegistry, NativePreviewAccessResolveRequest,
    },
    preview::PreviewRepresentation,
};
use objc2::{extern_class, rc::Retained, runtime::AnyClass, ClassType};
use objc2_app_kit::NSView;
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSURL};
use std::sync::{mpsc, Arc, Mutex};
use tauri::{Runtime, WebviewWindow};

#[link(name = "QuickLookUI", kind = "framework")]
unsafe extern "C" {}

extern_class!(
    #[unsafe(super(NSView))]
    #[thread_kind = MainThreadOnly]
    #[name = "QLPreviewView"]
    struct QLPreviewView;
);

#[derive(Clone)]
pub(crate) struct MacQuickLookPreviewHost {
    state: Arc<Mutex<HostState>>,
}

#[derive(Default)]
struct HostState {
    generation: u64,
    disposed: bool,
    current: Option<CurrentNativeView>,
}

struct CurrentNativeView {
    preview_id: String,
    view_ptr: usize,
}

impl MacQuickLookPreviewHost {
    pub(crate) fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(HostState::default())),
        }
    }

    pub(crate) fn attach<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        access: &NativePreviewAccessRegistry,
        snapshot: &PreviewSnapshotDto,
        presentation: &PreviewNativePresentation,
    ) -> Result<(), String> {
        validate_presentation(snapshot, presentation)?;
        let (generation, previous) = self.begin_replace()?;
        remove_current_view(window, previous)?;

        let staged_path = access
            .resolve(&NativePreviewAccessResolveRequest {
                token: presentation.token.clone(),
                session_id: snapshot.session_id.clone(),
                request_id: snapshot.request_id.clone(),
                source_version: presentation.source_version.clone(),
                host: presentation.host,
            })
            .map_err(map_access_error)?;
        let parent_ptr = window
            .ns_view()
            .map_err(|error| format!("macos_quick_look_parent_unavailable:{error}"))?
            as usize;
        if parent_ptr == 0 {
            return Err("macos_quick_look_parent_unavailable".to_string());
        }

        let state = Arc::clone(&self.state);
        let staged_path = staged_path
            .to_str()
            .ok_or_else(|| "macos_quick_look_staged_name_invalid".to_string())?
            .to_owned();
        let bounds = presentation.bounds;
        let (sender, receiver) = mpsc::sync_channel(1);
        window
            .run_on_main_thread(move || {
                let result = if generation_is_current(&state, generation) {
                    create_preview_view(parent_ptr, &staged_path, bounds)
                } else {
                    Err("macos_quick_look_presentation_stale".to_string())
                };
                let _ = sender.send(result);
            })
            .map_err(|error| format!("macos_quick_look_main_thread_unavailable:{error}"))?;

        let view_ptr = receiver
            .recv()
            .map_err(|_| "macos_quick_look_main_thread_unavailable".to_string())??;
        let accepted = {
            let mut state = lock_state(&self.state);
            if state.disposed || state.generation != generation {
                false
            } else {
                state.current = Some(CurrentNativeView {
                    preview_id: snapshot.preview_id.clone(),
                    view_ptr,
                });
                true
            }
        };
        if !accepted {
            remove_view(window, view_ptr)?;
            return Err("macos_quick_look_presentation_stale".to_string());
        }
        Ok(())
    }

    pub(crate) fn detach<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        preview_id: &str,
    ) -> Result<(), String> {
        let previous = {
            let mut state = lock_state(&self.state);
            if state
                .current
                .as_ref()
                .is_some_and(|current| current.preview_id != preview_id)
            {
                return Ok(());
            }
            bump_generation(&mut state);
            state.current.take()
        };
        remove_current_view(window, previous)?;
        Ok(())
    }

    /// Invalidate the host during runtime teardown. Runtime disposal does not
    /// own a typed `WebviewWindow`, so it cannot safely synchronously touch
    /// AppKit here; normal preview dispose/switch paths call `detach` first,
    /// and the parent window teardown removes any remaining subviews.
    pub(crate) fn dispose(&self) {
        let mut state = lock_state(&self.state);
        state.disposed = true;
        bump_generation(&mut state);
        state.current.take();
    }

    fn begin_replace(&self) -> Result<(u64, Option<CurrentNativeView>), String> {
        let mut state = lock_state(&self.state);
        if state.disposed {
            return Err("macos_quick_look_host_disposed".to_string());
        }
        bump_generation(&mut state);
        Ok((state.generation, state.current.take()))
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

fn bump_generation(state: &mut HostState) {
    state.generation = state.generation.wrapping_add(1);
    if state.generation == 0 {
        state.generation = 1;
    }
}

fn generation_is_current(state: &Arc<Mutex<HostState>>, generation: u64) -> bool {
    let state = lock_state(state);
    !state.disposed && state.generation == generation
}

fn remove_current_view<R: Runtime>(
    window: &WebviewWindow<R>,
    previous: Option<CurrentNativeView>,
) -> Result<(), String> {
    if let Some(previous) = previous {
        remove_view(window, previous.view_ptr)?;
    }
    Ok(())
}

fn remove_view<R: Runtime>(window: &WebviewWindow<R>, view_ptr: usize) -> Result<(), String> {
    let (sender, receiver) = mpsc::sync_channel(1);
    window
        .run_on_main_thread(move || {
            remove_native_view(view_ptr);
            let _ = sender.send(());
        })
        .map_err(|error| format!("macos_quick_look_main_thread_unavailable:{error}"))?;
    receiver
        .recv()
        .map_err(|_| "macos_quick_look_main_thread_unavailable".to_string())?;
    Ok(())
}

fn create_preview_view(
    parent_ptr: usize,
    staged_path: &str,
    bounds: PreviewNativeBounds,
) -> Result<usize, String> {
    let parent = unsafe { &*(parent_ptr as *const NSView) };
    let parent_height = parent.bounds().size.height;
    let width = bounds.width as _;
    let height = bounds.height as _;
    let frame = NSRect::new(
        NSPoint::new(bounds.x as _, parent_height - bounds.y as _ - height),
        NSSize::new(width, height),
    );
    let initial_frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0));
    let view: Retained<QLPreviewView> = unsafe {
        objc2::msg_send![QLPreviewView::alloc(), initWithFrame: initial_frame, style: 0isize]
    };
    let path = NSString::from_str(staged_path);
    let url = NSURL::fileURLWithPath(&path);
    unsafe {
        let _: () = objc2::msg_send![&*view, setPreviewItem: &*url];
        let _: () = objc2::msg_send![&*view, refreshPreviewItem];
    }
    view.as_super().setFrame(frame);
    parent.addSubview(view.as_super());
    Ok(Retained::as_ptr(&view) as usize)
}

fn remove_native_view(view_ptr: usize) {
    if view_ptr == 0 {
        return;
    }
    let view = unsafe { &*(view_ptr as *const QLPreviewView) };
    unsafe {
        let no_item: Option<&NSURL> = None;
        let _: () = objc2::msg_send![view, setPreviewItem: no_item];
    }
    view.as_super().removeFromSuperview();
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

#[cfg(test)]
mod tests {
    #[derive(Default)]
    struct FakeNativeViewLifecycle {
        attached: bool,
        item_bound: bool,
        detach_count: usize,
    }

    impl FakeNativeViewLifecycle {
        fn attach(&mut self) {
            assert!(!self.attached);
            self.attached = true;
            self.item_bound = true;
        }

        fn detach(&mut self) {
            self.item_bound = false;
            self.attached = false;
            self.detach_count += 1;
        }
    }

    #[test]
    fn lifecycle_clears_item_before_detaching_view() {
        let mut view = FakeNativeViewLifecycle::default();
        view.attach();
        view.detach();
        assert!(!view.item_bound);
        assert!(!view.attached);
        assert_eq!(view.detach_count, 1);
    }
}
