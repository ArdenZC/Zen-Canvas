//! Narrow diagnostics for the disposable hosted Global Index qualification.
//! This is inert unless the binary was explicitly built with `native-qa` and
//! the runner supplies a task-owned trace path.

#[cfg(feature = "native-qa")]
pub(crate) fn record(event: &str) {
    use std::fs::OpenOptions;
    use std::io::Write;

    let Some(path) = std::env::var_os("ZC_GLOBAL_INDEX_QA_TRACE") else {
        return;
    };
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let _ = writeln!(file, "{event}");
}

#[cfg(not(feature = "native-qa"))]
pub(crate) fn record(_event: &str) {}
