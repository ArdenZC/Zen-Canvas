from pathlib import Path

root = Path(__file__).resolve().parents[1]
workflow = root / ".github/workflows/ci.yml"
source = workflow.read_text(encoding="utf-8")
old = "cargo install cargo-audit --version 0.21.2 --locked"
new = "cargo install cargo-audit --locked"
if source.count(old) != 1:
    raise SystemExit("pinned cargo-audit installation line was not found exactly once")
workflow.write_text(source.replace(old, new, 1), encoding="utf-8")

for temporary in [
    root / ".github/workflows/fix-cargo-audit-install.yml",
    root / "scripts/fixCargoAuditInstall.py",
]:
    if temporary.exists():
        temporary.unlink()
