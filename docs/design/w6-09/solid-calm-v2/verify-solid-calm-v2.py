#!/usr/bin/env python3
"""Verify owner-frozen W6-09 Solid / Calm Demo V2 Git-blob identities."""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parents[3]

EXPECTED = {
    "zen-canvas-solid-calm-demo-windows-v2.html": "b7da4b4e02e2a5f174824a16f5263211185092c03d2e85f6bca471b17dbda1d7",
    "zen-canvas-solid-calm-preview-demo-v2.html": "06e9deb7b08ea433b27c946e2eb57184388029bea00f322b8d48ef45f761c84e",
}

def git_blob_bytes(name: str) -> bytes:
    rel = (ROOT / name).relative_to(REPO_ROOT).as_posix()
    proc = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "show", f"HEAD:{rel}"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        message = proc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"git show failed for {rel}: {message}")
    return proc.stdout

def tracked_worktree_dirty(name: str) -> bool:
    rel = (ROOT / name).relative_to(REPO_ROOT).as_posix()
    proc = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "status", "--porcelain=v1", "--untracked-files=no", "--", rel],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        message = proc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"git status failed for {rel}: {message}")
    return bool(proc.stdout.strip())

def main() -> int:
    failures: list[str] = []
    for name, expected in EXPECTED.items():
        path = ROOT / name
        if not path.is_file():
            print(f"FAIL {name} missing from worktree")
            failures.append(name)
            continue
        try:
            if tracked_worktree_dirty(name):
                print(f"FAIL {name} tracked worktree content differs from HEAD")
                failures.append(name)
                continue
            actual = hashlib.sha256(git_blob_bytes(name)).hexdigest()
        except RuntimeError as exc:
            print(f"FAIL {name} {exc}")
            failures.append(name)
            continue
        status = "PASS" if actual == expected else "FAIL"
        print(f"{status} {name} {actual}")
        if actual != expected:
            failures.append(name)
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
