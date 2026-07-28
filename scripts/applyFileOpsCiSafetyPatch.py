from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
path = root / "src-tauri/src/file_ops.rs"
source = path.read_text(encoding="utf-8")

validator_pattern = re.compile(
    r"fn validate_cleanup_trash_source\(\n"
    r"    path: &Path,\n"
    r"    app_data_dir: Option<&Path>,\n"
    r"\) -> Result<PathBuf, String> \{.*?\n\}\n\n"
    r"fn ensure_cleanup_operation_allowed",
    re.DOTALL,
)
validator_replacement = r'''fn validate_cleanup_path_syntax(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty()
        || path.to_string_lossy().contains('\0')
        || path.to_string_lossy().contains('*')
        || path.to_string_lossy().contains('?')
        || path
            .components()
            .any(|component| component == Component::ParentDir)
        || path.parent().is_none()
        || path.file_name().is_none()
    {
        return Err(FileOpError::UnsafePathTraversal.to_string());
    }
    if !path.is_absolute() {
        return Err(FileOpError::RelativePath.to_string());
    }
    Ok(())
}

fn validate_cleanup_trash_source(
    path: &Path,
    app_data_dir: Option<&Path>,
) -> Result<PathBuf, String> {
    validate_cleanup_path_syntax(path)?;

    // Reject protected roots before any filesystem access. This keeps policy tests
    // deterministic and avoids touching real system trees such as System32.
    ensure_general_file_operation_allowed(path)?;

    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            FileOpError::SourceMissing.to_string()
        } else {
            FileOpError::Io(error).to_string()
        }
    })?;
    if metadata.file_type().is_symlink() {
        return Err(FileOpError::ProtectedPath(normalize_path(path)).to_string());
    }

    let source = path
        .canonicalize()
        .map_err(|error| FileOpError::Io(error).to_string())?;

    // Repeat protection after canonicalization so links and reparse aliases cannot
    // escape the lexical check.
    ensure_general_file_operation_allowed(&source)?;
    ensure_cleanup_operation_allowed(&source, app_data_dir)?;
    Ok(source)
}

fn ensure_cleanup_operation_allowed'''
source, count = validator_pattern.subn(validator_replacement, source, count=1)
if count != 1:
    raise SystemExit("cleanup source validator did not match exactly once")

test_pattern = re.compile(
    r"    #\[test\]\n"
    r"    fn execute_moves_core_refuses_dangerous_move_to_trash_paths\(\) \{.*?\n"
    r"    \}\n\n"
    r"    #\[test\]\n"
    r"    fn execute_moves_core_does_not_trash_when_operation_is_blocked",
    re.DOTALL,
)
test_replacement = r'''    #[test]
    fn cleanup_rejects_windows_system_directory_without_filesystem_access() {
        let error = ensure_general_file_operation_allowed_for_os(
            Path::new("C:/Windows/System32"),
            "windows",
        )
        .expect_err("Windows system directories must be rejected lexically");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn execute_moves_core_does_not_trash_when_operation_is_blocked'''
source, count = test_pattern.subn(test_replacement, source, count=1)
if count != 1:
    raise SystemExit("slow System32 test did not match exactly once")

path.write_text(source, encoding="utf-8")

for temporary in [
    root / ".github/workflows/apply-code-pr-fast-path.yml",
    root / ".github/workflows/apply-file-ops-ci-safety.yml",
    root / "scripts/applyFileOpsCiSafetyPatch.py",
]:
    if temporary.exists():
        temporary.unlink()
