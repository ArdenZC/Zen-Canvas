#!/usr/bin/env python3
"""Verify the owner-frozen W6-09 Solid / Calm Demo V2 artifacts."""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED = {
    "zen-canvas-solid-calm-demo-windows-v2.html": "b7da4b4e02e2a5f174824a16f5263211185092c03d2e85f6bca471b17dbda1d7",
    "zen-canvas-solid-calm-preview-demo-v2.html": "06e9deb7b08ea433b27c946e2eb57184388029bea00f322b8d48ef45f761c84e",
}

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    failures = []
    for name, expected in EXPECTED.items():
        path = ROOT / name
        if not path.is_file():
            print(f"FAIL {name} missing")
            failures.append(name)
            continue
        actual = sha256(path)
        status = "PASS" if actual == expected else "FAIL"
        print(f"{status} {name} {actual}")
        if actual != expected:
            failures.append(name)
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
