use super::*;
use crate::file_workspace::{
    preview::{PreviewCancellation, PreviewOperationContext},
    read_gate::{
        ReadGateConfig, ReadGateSourceResolver, ResolvedContentSource, SourceResolutionError,
    },
};
use std::{
    collections::HashMap,
    io::{self, Write},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

pub(super) struct TestResolver {
    pub(super) sources: Mutex<HashMap<String, PathBuf>>,
    pub(super) resolve_count: AtomicUsize,
    pub(super) replace_on_resolve: Mutex<Option<(usize, PathBuf)>>,
}

impl TestResolver {
    pub(super) fn resolve_count(&self) -> usize {
        self.resolve_count.load(Ordering::Acquire)
    }

    pub(super) fn replace_on_resolve(&self, resolve_number: usize, path: PathBuf) {
        *self.replace_on_resolve.lock().unwrap() = Some((resolve_number, path));
    }
}

impl ReadGateSourceResolver for TestResolver {
    fn resolve_source(
        &self,
        source: &PreviewSourceRef,
    ) -> Result<ResolvedContentSource, SourceResolutionError> {
        let resolve_number = self.resolve_count.fetch_add(1, Ordering::AcqRel) + 1;
        let PreviewSourceRef::Managed { file_id } = source else {
            return Err(SourceResolutionError::NotSupported);
        };
        let replacement = {
            let mut replacement = self.replace_on_resolve.lock().unwrap();
            replacement
                .as_ref()
                .is_some_and(|(expected_number, _)| *expected_number == resolve_number)
                .then(|| replacement.take())
                .flatten()
        };
        if let Some((_, path)) = replacement {
            self.sources.lock().unwrap().insert(file_id.clone(), path);
        }
        self.sources
            .lock()
            .unwrap()
            .get(file_id)
            .cloned()
            .map(ResolvedContentSource::from_backend_path)
            .ok_or(SourceResolutionError::Unavailable)
    }
}

pub(super) struct Fixture {
    pub(super) root: PathBuf,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".tmp-tests")
            .join(format!("native-preview-access-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self { root }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

pub(super) fn setup(
    bytes: &[u8],
) -> (
    Fixture,
    Arc<MaterializationReadGate>,
    Arc<NativePreviewAccessRegistry>,
    PreviewSourceRef,
    String,
    Arc<TestResolver>,
) {
    setup_with_config(
        bytes,
        NativePreviewAccessConfig {
            max_records: 2,
            max_file_bytes: 1024 * 1024,
            max_total_bytes: 2 * 1024 * 1024,
            ttl: Duration::from_secs(30),
            read_chunk_bytes: 64 * 1024,
            max_acquisition_duration: Duration::from_secs(30),
        },
    )
}

pub(super) fn setup_with_config(
    bytes: &[u8],
    native_config: NativePreviewAccessConfig,
) -> (
    Fixture,
    Arc<MaterializationReadGate>,
    Arc<NativePreviewAccessRegistry>,
    PreviewSourceRef,
    String,
    Arc<TestResolver>,
) {
    let fixture = Fixture::new();
    let source_path = fixture.root.join("document.pdf");
    fs::write(&source_path, bytes).unwrap();
    let resolver = Arc::new(TestResolver {
        sources: Mutex::new(HashMap::from([("file-1".to_string(), source_path)])),
        resolve_count: AtomicUsize::new(0),
        replace_on_resolve: Mutex::new(None),
    });
    let gate = Arc::new(
        MaterializationReadGate::new(Arc::clone(&resolver), ReadGateConfig::default()).unwrap(),
    );
    let source = PreviewSourceRef::Managed {
        file_id: "file-1".to_string(),
    };
    let source_version = gate.current_source_version(&source).unwrap();
    let registry = NativePreviewAccessRegistry::new(
        fixture.root.join("staging"),
        Arc::clone(&gate),
        native_config,
    )
    .unwrap();
    (fixture, gate, registry, source, source_version, resolver)
}

pub(super) fn context(source_version: &str) -> PreviewOperationContext {
    PreviewOperationContext::for_backend_content_read(
        "session-1",
        "request-1",
        source_version,
        PreviewCancellation::default(),
        Instant::now() + Duration::from_secs(2),
    )
}

pub(super) fn assert_no_stage_roots(registry: &NativePreviewAccessRegistry) {
    let roots = fs::read_dir(&registry.root)
        .unwrap()
        .flatten()
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with(STAGE_PREFIX)
        })
        .count();
    assert_eq!(roots, 0);
}

pub(super) struct CancelingWriter {
    pub(super) bytes: Vec<u8>,
    pub(super) cancellation: Option<PreviewCancellation>,
    pub(super) gate: Option<Arc<MaterializationReadGate>>,
    pub(super) lease_revoked: Option<Arc<AtomicBool>>,
}

impl Write for CancelingWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.bytes.extend_from_slice(bytes);
        if let Some(cancellation) = self.cancellation.take() {
            cancellation.cancel();
        }
        if let Some(gate) = self.gate.take() {
            gate.dispose();
        }
        if let Some(lease_revoked) = self.lease_revoked.take() {
            lease_revoked.store(true, Ordering::Release);
        }
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
