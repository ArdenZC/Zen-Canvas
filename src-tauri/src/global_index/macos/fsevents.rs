use super::PendingUpdates;
use fsevent_sys::core_foundation::{
    kCFAllocatorDefault, kCFRunLoopDefaultMode, kCFStringEncodingUTF8, kCFTypeArrayCallBacks,
    CFArrayAppendValue, CFArrayCreateMutable, CFRelease, CFRunLoopGetCurrent, CFRunLoopRef,
    CFStringCreateWithCString,
};
use fsevent_sys::{
    kFSEventStreamCreateFlagFileEvents, kFSEventStreamCreateFlagNoDefer,
    kFSEventStreamCreateFlagUseCFTypes, kFSEventStreamCreateFlagWatchRoot,
    kFSEventStreamEventFlagEventIdsWrapped, kFSEventStreamEventFlagKernelDropped,
    kFSEventStreamEventFlagMount, kFSEventStreamEventFlagMustScanSubDirs,
    kFSEventStreamEventFlagRootChanged, kFSEventStreamEventFlagUnmount,
    kFSEventStreamEventFlagUserDropped, kFSEventStreamEventIdSinceNow, FSEventStreamContext,
    FSEventStreamCreate, FSEventStreamEventFlags, FSEventStreamInvalidate, FSEventStreamRef,
    FSEventStreamRelease, FSEventStreamScheduleWithRunLoop, FSEventStreamStart, FSEventStreamStop,
    FSEventStreamUnscheduleFromRunLoop,
};
use libc::c_void;
use std::ffi::CString;
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};

pub struct FseventsHandle {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl FseventsHandle {
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

pub fn start_reconcile_watcher(
    root: &Path,
    pending: Arc<Mutex<PendingUpdates>>,
    stopped: Arc<AtomicBool>,
    since_event_id: Option<u64>,
) -> Result<FseventsHandle, String> {
    let root = root
        .to_str()
        .ok_or_else(|| "macos_fsevents_root_not_utf8".to_string())?
        .to_string();
    let stop = Arc::new(AtomicBool::new(false));
    let stop_for_thread = stop.clone();
    let thread = thread::Builder::new()
        .name("zen-canvas-macos-fsevents".to_string())
        .spawn(move || run_fsevents(&root, pending, stopped, stop_for_thread, since_event_id))
        .map_err(|error| format!("macos_fsevents_thread_start_failed: {error}"))?;
    Ok(FseventsHandle {
        stop,
        thread: Some(thread),
    })
}

struct FseventInfo {
    pending: Arc<Mutex<PendingUpdates>>,
    stopped: Arc<AtomicBool>,
}

extern "C" fn fsevent_callback(
    _stream: FSEventStreamRef,
    client_info: *mut c_void,
    num_events: usize,
    _event_paths: *mut c_void,
    event_flags: *const FSEventStreamEventFlags,
    event_ids: *const u64,
) {
    if client_info.is_null() {
        return;
    }
    let info = unsafe { &*(client_info as *const FseventInfo) };
    if info.stopped.load(Ordering::Acquire) || num_events == 0 {
        return;
    }
    let needs_full_reconcile = if event_flags.is_null() {
        true
    } else {
        let flags = unsafe { std::slice::from_raw_parts(event_flags, num_events) };
        flags.iter().copied().any(fsevent_requires_full_reconcile)
    };
    if let Ok(mut pending) = info.pending.lock() {
        // Normal file events are delivered by NSMetadataQueryDidUpdate. Keep
        // FSEvents as the durable gap/overflow signal so a busy directory
        // does not cause a full local-computer Spotlight query every cycle.
        pending.full_reconcile |= needs_full_reconcile;
        if !event_ids.is_null() {
            let ids = unsafe { std::slice::from_raw_parts(event_ids, num_events) };
            pending.last_event_id = ids.iter().copied().max().or(pending.last_event_id);
        }
    }
}

fn fsevent_requires_full_reconcile(flags: FSEventStreamEventFlags) -> bool {
    flags
        & (kFSEventStreamEventFlagMustScanSubDirs
            | kFSEventStreamEventFlagUserDropped
            | kFSEventStreamEventFlagKernelDropped
            | kFSEventStreamEventFlagEventIdsWrapped
            | kFSEventStreamEventFlagRootChanged
            | kFSEventStreamEventFlagMount
            | kFSEventStreamEventFlagUnmount)
        != 0
}

fn run_fsevents(
    root: &str,
    pending: Arc<Mutex<PendingUpdates>>,
    stopped: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    since_event_id: Option<u64>,
) {
    let Ok(path) = CString::new(root) else {
        if let Ok(mut pending) = pending.lock() {
            pending.last_error = Some("macos_fsevents_root_not_utf8".to_string());
        }
        return;
    };
    unsafe {
        let path_ref =
            CFStringCreateWithCString(kCFAllocatorDefault, path.as_ptr(), kCFStringEncodingUTF8);
        if path_ref.is_null() {
            if let Ok(mut pending) = pending.lock() {
                pending.last_error = Some("macos_fsevents_stream_unavailable".to_string());
            }
            return;
        }
        let paths = CFArrayCreateMutable(kCFAllocatorDefault, 1, &kCFTypeArrayCallBacks);
        if paths.is_null() {
            CFRelease(path_ref);
            if let Ok(mut pending) = pending.lock() {
                pending.last_error = Some("macos_fsevents_stream_unavailable".to_string());
            }
            return;
        }
        CFArrayAppendValue(paths, path_ref);
        CFRelease(path_ref);
        let info = Box::new(FseventInfo { pending, stopped });
        let context = FSEventStreamContext {
            version: 0,
            info: Box::into_raw(info).cast(),
            retain: None,
            release: None,
            copy_description: None,
        };
        let stream = FSEventStreamCreate(
            kCFAllocatorDefault,
            fsevent_callback,
            &context,
            paths,
            since_event_id.unwrap_or(kFSEventStreamEventIdSinceNow),
            0.25,
            kFSEventStreamCreateFlagUseCFTypes
                | kFSEventStreamCreateFlagFileEvents
                | kFSEventStreamCreateFlagNoDefer
                | kFSEventStreamCreateFlagWatchRoot,
        );
        CFRelease(paths);
        if stream.is_null() {
            if let Ok(mut pending) = unsafe { &*context.info.cast::<FseventInfo>() }
                .pending
                .lock()
            {
                pending.last_error = Some("macos_fsevents_stream_unavailable".to_string());
            }
            drop(Box::from_raw(context.info.cast::<FseventInfo>()));
            return;
        }
        let run_loop = CFRunLoopGetCurrent();
        FSEventStreamScheduleWithRunLoop(stream, run_loop, kCFRunLoopDefaultMode);
        if FSEventStreamStart(stream) == 0 {
            if let Ok(mut pending) = unsafe { &*context.info.cast::<FseventInfo>() }
                .pending
                .lock()
            {
                pending.last_error = Some("macos_fsevents_stream_start_failed".to_string());
            }
            FSEventStreamUnscheduleFromRunLoop(stream, run_loop, kCFRunLoopDefaultMode);
            FSEventStreamInvalidate(stream);
            FSEventStreamRelease(stream);
            drop(Box::from_raw(context.info.cast::<FseventInfo>()));
            return;
        }
        while !stop.load(Ordering::Acquire) {
            run_loop_run_for(0.25);
        }
        FSEventStreamStop(stream);
        FSEventStreamUnscheduleFromRunLoop(stream, run_loop, kCFRunLoopDefaultMode);
        FSEventStreamInvalidate(stream);
        FSEventStreamRelease(stream);
        drop(Box::from_raw(context.info.cast::<FseventInfo>()));
    }
}

unsafe fn run_loop_run_for(seconds: f64) {
    // fsevent-sys exposes the run-loop handle but not the bounded runner. The
    // CoreFoundation ABI is stable and this keeps shutdown responsive.
    unsafe extern "C" {
        fn CFRunLoopRunInMode(
            mode: fsevent_sys::core_foundation::CFStringRef,
            seconds: f64,
            return_after_source_handled: u8,
        ) -> isize;
    }
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, seconds, 1);
}

#[allow(dead_code)]
fn _assert_run_loop_type(_: CFRunLoopRef) {}

#[cfg(test)]
mod tests {
    use super::{fsevent_callback, FseventInfo};
    use fsevent_sys::{
        kFSEventStreamEventFlagEventIdsWrapped, kFSEventStreamEventFlagKernelDropped,
        kFSEventStreamEventFlagMount, kFSEventStreamEventFlagMustScanSubDirs,
        kFSEventStreamEventFlagRootChanged, kFSEventStreamEventFlagUnmount,
        kFSEventStreamEventFlagUserDropped,
    };
    use std::sync::{atomic::AtomicBool, Arc, Mutex};

    #[test]
    fn dropped_history_flags_are_reconcile_signals() {
        let flags = kFSEventStreamEventFlagMustScanSubDirs
            | kFSEventStreamEventFlagUserDropped
            | kFSEventStreamEventFlagKernelDropped
            | kFSEventStreamEventFlagEventIdsWrapped;
        assert!(fsevent_requires_full_reconcile(flags));
    }

    #[test]
    fn root_and_mount_lifecycle_flags_require_reconcile() {
        assert!(fsevent_requires_full_reconcile(
            kFSEventStreamEventFlagRootChanged
        ));
        assert!(fsevent_requires_full_reconcile(
            kFSEventStreamEventFlagMount
        ));
        assert!(fsevent_requires_full_reconcile(
            kFSEventStreamEventFlagUnmount
        ));
    }

    #[test]
    fn normal_file_events_are_left_to_spotlight_incremental_updates() {
        assert!(!fsevent_requires_full_reconcile(0));
    }

    #[test]
    fn fsevents_callback_records_checkpoint_and_reconcile_signal() {
        let pending = Arc::new(Mutex::new(super::super::PendingUpdates::default()));
        let stopped = Arc::new(AtomicBool::new(false));
        let info = FseventInfo {
            pending: pending.clone(),
            stopped,
        };
        let flags = [kFSEventStreamEventFlagMustScanSubDirs];
        let event_ids = [42_u64];
        fsevent_callback(
            std::ptr::null_mut(),
            (&info as *const FseventInfo).cast_mut().cast(),
            1,
            std::ptr::null_mut(),
            flags.as_ptr(),
            event_ids.as_ptr(),
        );
        let pending = pending.lock().expect("pending updates");
        assert!(pending.full_reconcile);
        assert_eq!(pending.last_event_id, Some(42));
    }

    #[test]
    fn fsevents_callback_keeps_normal_file_event_incremental() {
        let pending = Arc::new(Mutex::new(super::super::PendingUpdates::default()));
        let stopped = Arc::new(AtomicBool::new(false));
        let info = FseventInfo {
            pending: pending.clone(),
            stopped,
        };
        let flags = [0];
        let event_ids = [7_u64];
        fsevent_callback(
            std::ptr::null_mut(),
            (&info as *const FseventInfo).cast_mut().cast(),
            1,
            std::ptr::null_mut(),
            flags.as_ptr(),
            event_ids.as_ptr(),
        );
        let pending = pending.lock().expect("pending updates");
        assert!(!pending.full_reconcile);
        assert_eq!(pending.last_event_id, Some(7));
    }

    #[test]
    fn fsevents_callback_stops_mutating_after_shutdown() {
        let pending = Arc::new(Mutex::new(super::super::PendingUpdates::default()));
        let stopped = Arc::new(AtomicBool::new(true));
        let info = FseventInfo {
            pending: pending.clone(),
            stopped,
        };
        let flags = [kFSEventStreamEventFlagMustScanSubDirs];
        let event_ids = [99_u64];
        fsevent_callback(
            std::ptr::null_mut(),
            (&info as *const FseventInfo).cast_mut().cast(),
            1,
            std::ptr::null_mut(),
            flags.as_ptr(),
            event_ids.as_ptr(),
        );
        let pending = pending.lock().expect("pending updates");
        assert!(!pending.full_reconcile);
        assert_eq!(pending.last_event_id, None);
    }
}
