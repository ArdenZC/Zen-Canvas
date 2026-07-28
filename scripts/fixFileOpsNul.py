from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "src-tauri/src/file_ops.rs"
source = path.read_text(encoding="utf-8")
needle = "contains('\x00')"
if needle not in source:
    raise SystemExit("embedded NUL literal was not found")
source = source.replace(needle, "contains('\\0')", 1)
path.write_text(source, encoding="utf-8")

for temporary in [
    root / ".github/workflows/fix-file-ops-nul.yml",
    root / "scripts/fixFileOpsNul.py",
]:
    if temporary.exists():
        temporary.unlink()
