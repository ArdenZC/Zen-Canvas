# Supported desktop platforms

Zen Canvas formally supports:

- Windows
- macOS 13+, Apple Silicon (arm64) only

Intel Macs are unsupported. Releases and CI must not claim Intel, Universal
Binary, or Rosetta compatibility.

Platform support does not imply identical mutation capability. Windows file
mutation remains enabled through source-handle and verified target
directory-handle binding. macOS now enables the first native mutation surface
through the same existing Operation Preview, journal, Safe Trash, and restore
authorities: local writable APFS, same-device/same-volume regular files and
ordinary directories only. iCloud, File Provider, packages, links, special
files, mount boundaries, cross-volume paths, non-APFS or unknown filesystems,
read-only volumes, and ambiguous races remain fail-closed. See
`MACOS_MUTATION_THREAT_MODEL.md` for the exact gate and stable failure policy.

Linux is not a supported product platform. Linux is outside the product
support, build, release, and quality-gate scope for this repository. Zen Canvas
does not promise Linux installation, runtime behavior, file mutation, cleanup,
restore, or recovery safety.

The absence of Linux support is intentional. A shared Unix implementation that
happens to compile is not a Linux product or security guarantee.

For supported platforms, any file mutation that cannot be proven to operate on
the confirmed object must fail closed with a stable error. Unsupported
platform behavior must not silently fall back to a path-only destructive
operation.

The Windows system Recycle Bin API is also path-based at this boundary, so the
legacy Move-to-system-trash action fails closed with
`system_trash_source_binding_unsupported`. Zen Canvas Safe Trash remains the
supported cleanup mutation path on Windows.

The CI quality matrix is limited to Windows Quality, macOS Apple Silicon
Quality, and Dependency Audit. No Linux runner or Linux Tauri dependency
installation is part of the supported-platform gate.
