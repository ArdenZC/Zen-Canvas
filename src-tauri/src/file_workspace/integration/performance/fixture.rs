use std::{
    fs::{self, File},
    io,
    path::{Path, PathBuf},
};

pub(crate) struct WorkspaceFixture {
    root: PathBuf,
    state_root: PathBuf,
    cleanup_root: PathBuf,
}

impl WorkspaceFixture {
    pub(crate) fn smoke() -> Self {
        Self::new("smoke", 1, 1)
    }

    pub(crate) fn large(label: &str, file_count: usize, directory_count: usize) -> Self {
        Self::new(label, file_count, directory_count)
    }

    #[cfg(feature = "performance-test-tauri")]
    pub(crate) fn split(
        label: &str,
        root_count: usize,
        files_per_root: usize,
        directories_per_root: usize,
    ) -> Self {
        let cleanup_root = performance_root();
        let identity = uuid::Uuid::new_v4();
        let root = cleanup_root.join(format!("{label}-{identity}"));
        let state_root = cleanup_root.join(format!("state-{identity}"));
        let result = (|| -> io::Result<()> {
            fs::create_dir_all(&root)?;
            for index in 0..root_count {
                Self::try_create(
                    &root.join(format!("scan-root-{index:03}")),
                    files_per_root,
                    directories_per_root,
                )?;
            }
            fs::create_dir_all(&state_root)
        })();
        if let Err(error) = result {
            remove_task_path(&root);
            remove_task_path(&state_root);
            panic!("create split workspace performance fixture {label}: {error}");
        }
        Self {
            root,
            state_root,
            cleanup_root,
        }
    }

    fn new(label: &str, file_count: usize, directory_count: usize) -> Self {
        let cleanup_root = performance_root();
        let identity = uuid::Uuid::new_v4();
        let root = cleanup_root.join(format!("{label}-{identity}"));
        let state_root = cleanup_root.join(format!("state-{identity}"));
        if let Err(error) = Self::try_create(&root, file_count, directory_count) {
            remove_task_path(&root);
            panic!("create workspace performance fixture {label}: {error}");
        }
        if let Err(error) = fs::create_dir_all(&state_root) {
            remove_task_path(&root);
            remove_task_path(&state_root);
            panic!("create workspace performance state root {label}: {error}");
        }
        Self {
            root,
            state_root,
            cleanup_root,
        }
    }

    fn try_create(root: &Path, file_count: usize, directory_count: usize) -> io::Result<()> {
        fs::create_dir_all(root)?;
        for index in 0..file_count {
            File::create(root.join(format!("file-{index:06}.bin")))?;
        }
        for index in 0..directory_count {
            fs::create_dir(root.join(format!("directory-{index:06}")))?;
        }
        Ok(())
    }

    pub(crate) fn path(&self) -> &Path {
        &self.root
    }

    pub(crate) fn state_path(&self) -> &Path {
        &self.state_root
    }

    #[cfg(feature = "performance-test-tauri")]
    pub(crate) fn child_path(&self, index: usize) -> PathBuf {
        self.root.join(format!("scan-root-{index:03}"))
    }
}

impl Drop for WorkspaceFixture {
    fn drop(&mut self) {
        remove_task_path(&self.root);
        remove_task_path(&self.state_root);
        remove_if_empty(&self.cleanup_root);
        if let Some(parent) = self.cleanup_root.parent() {
            remove_if_empty(parent);
        }
    }
}

fn performance_root() -> PathBuf {
    let repository_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root")
        .to_path_buf();
    let task_root = repository_root.join(".tmp-performance-fixtures");
    let shared_cache_root = task_root.join("cache");
    let configured = std::env::var_os("ZC_PERF_WORKSPACE_FIXTURE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| task_root.join("workspace-foundation"));
    let configured = if configured.is_absolute() {
        configured
    } else {
        repository_root.join(configured)
    };
    let normalized = lexical_normalize(&configured);
    let normalized_task_root = lexical_normalize(&task_root);
    let normalized_cache_root = lexical_normalize(&shared_cache_root);
    assert!(
        normalized.starts_with(&normalized_task_root)
            && normalized != normalized_task_root
            && !normalized.starts_with(&normalized_cache_root),
        "ZC_PERF_WORKSPACE_FIXTURE_ROOT must be a task-owned repository-local root under {} and outside the shared fixture cache; got {}",
        normalized_task_root.display(),
        normalized.display()
    );
    let canonical_repository_root = fs::canonicalize(&repository_root)
        .expect("repository root must be canonicalizable for performance fixtures");
    fs::create_dir_all(&normalized_task_root)
        .expect("create repository-local performance fixture parent");
    let canonical_task_root = fs::canonicalize(&normalized_task_root)
        .expect("performance fixture parent must be canonicalizable");
    assert!(
        canonical_task_root.starts_with(&canonical_repository_root),
        "repository-local performance fixture parent must not resolve outside the repository; got {}",
        canonical_task_root.display()
    );
    let mut existing_ancestor = normalized.clone();
    while !existing_ancestor.exists() {
        existing_ancestor = existing_ancestor
            .parent()
            .expect("performance fixture root must have an existing ancestor")
            .to_path_buf();
    }
    let canonical_ancestor = fs::canonicalize(&existing_ancestor)
        .expect("performance fixture root ancestor must be canonicalizable");
    let canonical_cache_root = fs::canonicalize(&shared_cache_root).ok();
    assert!(
        canonical_ancestor.starts_with(&canonical_task_root)
            && !canonical_cache_root
                .as_ref()
                .is_some_and(|cache| canonical_ancestor.starts_with(cache)),
        "performance fixture root must resolve to a task-owned repository-local directory outside the shared cache; got {}",
        canonical_ancestor.display()
    );
    normalized
}

fn remove_if_empty(path: &Path) {
    match fs::read_dir(path) {
        Ok(mut entries) => {
            if entries.next().is_none() {
                if let Err(error) = fs::remove_dir(path) {
                    if error.kind() != io::ErrorKind::NotFound {
                        eprintln!(
                            "[zc-perf] cleanup_failed path={} error={error}",
                            path.display()
                        );
                    }
                }
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => eprintln!(
            "[zc-perf] cleanup_inspection_failed path={} error={error}",
            path.display()
        ),
    }
}

fn remove_task_path(path: &Path) {
    if let Err(error) = fs::remove_dir_all(path) {
        if error.kind() != io::ErrorKind::NotFound {
            eprintln!(
                "[zc-perf] cleanup_failed path={} error={error}",
                path.display()
            );
        }
    }
    if path.exists() {
        eprintln!("[zc-perf] cleanup_leftover path={}", path.display());
    }
}

fn lexical_normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            _ => normalized.push(component.as_os_str()),
        }
    }
    normalized
}
