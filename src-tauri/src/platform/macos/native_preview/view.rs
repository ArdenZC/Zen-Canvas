//! Main-thread Quick Look view ownership.
//!
//! This module is the only place that retains `QLPreviewView` values. The
//! coordination layer stores only opaque view IDs and dispatchers; AppKit
//! objects stay on the thread that created them.

use objc2::{
    extern_class, rc::Retained, runtime::AnyClass, ClassType, MainThreadMarker, MainThreadOnly,
};
use objc2_app_kit::NSView;
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSURL};
use std::{
    cell::RefCell,
    collections::HashMap,
    path::Path,
    sync::{mpsc, Arc},
};
use tauri::{Runtime, WebviewWindow};

#[link(name = "QuickLookUI", kind = "framework")]
unsafe extern "C" {}

extern_class!(
    #[unsafe(super(NSView))]
    #[thread_kind = MainThreadOnly]
    #[name = "QLPreviewView"]
    struct QLPreviewView;
);

pub(super) type NativeViewId = u64;
pub(super) type MainThreadTask = Box<dyn FnOnce() + Send + 'static>;
pub(super) type MainThreadDispatcher =
    Arc<dyn Fn(MainThreadTask) -> Result<(), String> + Send + Sync>;

#[cfg(feature = "native-qa")]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) struct NativeViewMetrics {
    pub(super) creations: usize,
    pub(super) binds: usize,
    pub(super) refreshes: usize,
    pub(super) frame_updates: usize,
    pub(super) detachments: usize,
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

pub(super) fn available() -> bool {
    AnyClass::get(c"QLPreviewView").is_some()
}

pub(super) fn parent_ptr<R: Runtime>(window: &WebviewWindow<R>) -> Result<usize, String> {
    let parent_ptr = window
        .ns_view()
        .map_err(|error| format!("macos_quick_look_parent_unavailable:{error}"))?
        as usize;
    if parent_ptr == 0 {
        return Err("macos_quick_look_parent_unavailable".to_string());
    }
    Ok(parent_ptr)
}

pub(super) fn dispatcher_for_window<R: Runtime + 'static>(
    window: &WebviewWindow<R>,
) -> MainThreadDispatcher {
    let window = window.clone();
    Arc::new(move |task| {
        window
            .run_on_main_thread(task)
            .map_err(|error| format!("macos_quick_look_main_thread_unavailable:{error}"))
    })
}

pub(super) fn dispatch_sync<T, F>(dispatcher: MainThreadDispatcher, task: F) -> Result<T, String>
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

pub(super) fn create_native_view(
    parent_ptr: usize,
    staged_path: &Path,
    bounds: crate::file_workspace::integration::types::PreviewNativeBounds,
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

pub(super) fn update_native_view(
    parent_ptr: usize,
    view_id: NativeViewId,
    bounds: crate::file_workspace::integration::types::PreviewNativeBounds,
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

pub(super) fn frame_for_parent(
    parent_height: f64,
    bounds: crate::file_workspace::integration::types::PreviewNativeBounds,
) -> NSRect {
    NSRect::new(
        NSPoint::new(
            bounds.x as f64,
            parent_height - bounds.y as f64 - bounds.height as f64,
        ),
        NSSize::new(bounds.width as f64, bounds.height as f64),
    )
}

pub(super) fn remove_native_view(view_id: NativeViewId) {
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
pub(super) fn native_view_is_attached(view_id: NativeViewId) -> bool {
    NATIVE_VIEW_STORE.with(|store| {
        let store = store.borrow();
        store
            .views
            .get(&view_id)
            .is_some_and(|view| unsafe { view.as_super().superview().is_some() })
    })
}

#[cfg(feature = "native-qa")]
pub(super) fn reset_native_view_metrics() {
    NATIVE_VIEW_STORE.with(|store| {
        store.borrow_mut().metrics = NativeViewMetrics::default();
    });
}

#[cfg(feature = "native-qa")]
pub(super) fn native_view_metrics() -> NativeViewMetrics {
    NATIVE_VIEW_STORE.with(|store| store.borrow().metrics)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_updates_change_geometry_without_changing_owner_identity() {
        let first = frame_for_parent(
            900.0,
            crate::file_workspace::integration::types::PreviewNativeBounds {
                x: 10,
                y: 20,
                width: 400,
                height: 300,
            },
        );
        let second = frame_for_parent(
            900.0,
            crate::file_workspace::integration::types::PreviewNativeBounds {
                x: 30,
                y: 40,
                width: 500,
                height: 350,
            },
        );
        assert_ne!(first, second);
    }
}
