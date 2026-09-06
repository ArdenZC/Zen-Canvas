#!/usr/bin/env python3
"""Rebuild and verify the frozen W6-06 V26 design targets from repo-retained text assets."""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN_STEM = "zen-canvas-full-product-showcase-v26.html.gz.b64.part"
DESKTOP_SOURCE = ROOT / "zen-canvas-desktop-quick-search-v26.html.gz.b64"

EXPECTED = {
    "zen-canvas-full-product-showcase-v26.html": "302905d8eea95bf08873588810983e505e732031e100992171b97c421ea81f52",
    "zen-canvas-full-product-showcase-v26-windows.html": "0d789d2dfbf2508c8f0307b8925eb98df27e2401f1ef9dd66c1713c7790fa656",
    "zen-canvas-full-product-showcase-v26-mac.html": "85097a21597fbea32475445a1af4f1bd146ac0d72a1cb72633da8d3c696d3b9c",
    "zen-canvas-desktop-quick-search-v26.html": "7c604c86bee2b24f164bebc8f4d8f8bcf3480d34f976e2362e1a99c9ffb07558",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode_gzip_b64(text: str) -> bytes:
    packed = base64.b64decode("".join(text.split()), validate=True)
    return gzip.decompress(packed)


def load_main() -> bytes:
    parts = sorted(ROOT.glob(MAIN_STEM + "*"))
    if not parts:
        raise SystemExit("No retained V26 main target chunks found")
    expected_names = [f"{MAIN_STEM}{i:02d}" for i in range(len(parts))]
    actual_names = [p.name for p in parts]
    if actual_names != expected_names:
        raise SystemExit(f"Non-contiguous V26 main chunks: {actual_names}")
    return decode_gzip_b64("".join(p.read_text(encoding="utf-8") for p in parts))


def derive_platform(main: bytes, platform: bytes) -> bytes:
    marker = b'data-platform="neutral"'
    if main.count(marker) != 1:
        raise SystemExit(f"Expected exactly one neutral platform marker; found {main.count(marker)}")
    return main.replace(marker, b'data-platform="' + platform + b'"', 1)


def build() -> dict[str, bytes]:
    main = load_main()
    desktop = decode_gzip_b64(DESKTOP_SOURCE.read_text(encoding="utf-8"))
    return {
        "zen-canvas-full-product-showcase-v26.html": main,
        "zen-canvas-full-product-showcase-v26-windows.html": derive_platform(main, b"windows"),
        "zen-canvas-full-product-showcase-v26-mac.html": derive_platform(main, b"mac"),
        "zen-canvas-desktop-quick-search-v26.html": desktop,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, help="Optional directory to write rebuilt HTML targets")
    parser.add_argument("--verify-only", action="store_true", help="Verify hashes without writing files")
    args = parser.parse_args()

    targets = build()
    failures = []
    for name, data in targets.items():
        actual = sha256(data)
        expected = EXPECTED[name]
        status = "PASS" if actual == expected else "FAIL"
        print(f"{status} {name} {actual}")
        if actual != expected:
            failures.append((name, expected, actual))

    if failures:
        for name, expected, actual in failures:
            print(f"Mismatch {name}: expected {expected}, got {actual}")
        return 1

    if args.out and not args.verify_only:
        args.out.mkdir(parents=True, exist_ok=True)
        for name, data in targets.items():
            (args.out / name).write_bytes(data)
        print(f"Wrote {len(targets)} V26 targets to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
