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
        let zone = libc::malloc_default_zone();
        if !zone.is_null() {
            // Pressure relief makes the settled RSS sample represent live
            // allocations instead of only the default zone's retained cache.
            let _ = malloc_zone_pressure_relief(zone, 0);
        }
    }
}

fn max_optional(left: Option<u64>, right: Option<u64>) -> Option<u64> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.max(right)),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

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
    std::fs::read_dir("/dev/fd")
        .ok()
        .map(|entries| entries.count() as u64)
}

#[cfg(not(target_os = "macos"))]
fn current_fd_count() -> Option<u64> {
    None
}
