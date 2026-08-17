use serde::Serialize;

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn malloc_zone_pressure_relief(
        zone: *mut libc::malloc_zone_t,
        goal: libc::size_t,
    ) -> libc::size_t;
}

#[derive(Debug, Clone, Copy, Default, Serialize)]
pub(super) struct ProcessResources {
    pub(super) rss_bytes: Option<u64>,
    pub(super) handle_count: Option<u64>,
    pub(super) fd_count: Option<u64>,
}

impl ProcessResources {
    pub(super) fn max(self, other: Self) -> Self {
        Self {
            rss_bytes: max_optional(self.rss_bytes, other.rss_bytes),
            handle_count: max_optional(self.handle_count, other.handle_count),
            fd_count: max_optional(self.fd_count, other.fd_count),
        }
    }
}

pub(super) fn snapshot() -> ProcessResources {
    ProcessResources {
        rss_bytes: current_rss_bytes(),
        handle_count: current_handle_count(),
        fd_count: current_fd_count(),
    }
}

pub(super) fn settle_allocator() {
    #[cfg(target_os = "macos")]
    unsafe {
        // A native test process can have more than the default malloc zone
        // (for example through SQLite/Tauri dependencies). Ask macOS to
        // scavenge every zone so the settled RSS sample is not only a
        // snapshot of a non-default allocator cache. This is test-only
        // pressure relief; live allocations remain valid.
        let _ = malloc_zone_pressure_relief(std::ptr::null_mut(), 0);
    }

    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, SetProcessWorkingSetSize};

        // Remove pages retained only by the process working set before the
        // settled RSS sample. Live allocations remain valid and will fault
        // back in if the workload needs them again.
        let _ = SetProcessWorkingSetSize(GetCurrentProcess(), usize::MAX, usize::MAX);
    }
}

fn max_optional(left: Option<u64>, right: Option<u64>) -> Option<u64> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.max(right)),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

#[cfg(target_os = "macos")]
fn current_rss_bytes() -> Option<u64> {
    // Avoid allocating a new sysinfo process table for every settled and
    // in-workload sample. The sampler must not manufacture allocator
    // retention that the repeated workload then reports as a leak.
    let mut info = std::mem::MaybeUninit::<libc::proc_taskinfo>::zeroed();
    let result = unsafe {
        libc::proc_pidinfo(
            libc::getpid(),
            libc::PROC_PIDTASKINFO,
            0,
            info.as_mut_ptr() as *mut libc::c_void,
            std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int,
        )
    };
    (result == std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int)
        .then(|| unsafe { info.assume_init().pti_resident_size })
}

#[cfg(not(target_os = "macos"))]
fn current_rss_bytes() -> Option<u64> {
    let pid = sysinfo::get_current_pid().ok()?;
    let mut system = sysinfo::System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);
    system.process(pid).map(sysinfo::Process::memory)
}

#[cfg(target_os = "windows")]
fn current_handle_count() -> Option<u64> {
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, GetProcessHandleCount};

    let mut count = 0u32;
    let result = unsafe { GetProcessHandleCount(GetCurrentProcess(), &mut count) };
    (result != 0).then_some(u64::from(count))
}

#[cfg(target_os = "macos")]
fn current_handle_count() -> Option<u64> {
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn current_handle_count() -> Option<u64> {
    None
}

#[cfg(target_os = "macos")]
fn current_fd_count() -> Option<u64> {
    // Count descriptors without opening `/dev/fd` for every sample. The
    // fixed stack buffer keeps the sampler from adding allocator retention to
    // the RSS trend; a full buffer is reported as unavailable rather than a
    // silently truncated count.
    let mut buffer = [0u8; 16 * 1024];
    let result = unsafe {
        libc::proc_pidinfo(
            libc::getpid(),
            libc::PROC_PIDLISTFDS,
            0,
            buffer.as_mut_ptr() as *mut libc::c_void,
            buffer.len() as libc::c_int,
        )
    };
    let bytes = usize::try_from(result).ok()?;
    (bytes < buffer.len() && bytes % std::mem::size_of::<libc::proc_fdinfo>() == 0)
        .then_some((bytes / std::mem::size_of::<libc::proc_fdinfo>()) as u64)
}

#[cfg(not(target_os = "macos"))]
fn current_fd_count() -> Option<u64> {
    None
}
