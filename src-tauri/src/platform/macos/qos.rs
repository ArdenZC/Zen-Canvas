//! Best-effort thread-local macOS QoS hint for dedicated background work.

pub fn set_current_thread_background_qos() -> bool {
    #[cfg(target_os = "macos")]
    {
        unsafe { libc::pthread_set_qos_class_self_np(libc::QOS_CLASS_BACKGROUND, 0) == 0 }
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

pub fn reset_current_thread_qos() {
    #[cfg(target_os = "macos")]
    unsafe {
        let _ = libc::pthread_set_qos_class_self_np(libc::QOS_CLASS_DEFAULT, 0);
    }
}
