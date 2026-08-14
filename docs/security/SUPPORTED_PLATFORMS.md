# Supported desktop platforms

Zen Canvas formally supports:

- Windows
- macOS 13+, Apple Silicon (arm64) only

Intel Macs are unsupported. Releases and CI must not claim Intel, Universal
Binary, or Rosetta compatibility.

Platform support does not imply identical mutation capability. Windows file
mutation remains enabled through source-handle and verified target
directory-handle binding. macOS native read, identity, lifecycle, Finder, and
Quick Look adapters are supported, but destructive move, rename, Safe Trash,
and restore mutation currently fail closed with
`macos_file_mutation_source_binding_unsupported`. The available macOS
`renameatx_np`/`unlinkat` name-based APIs cannot bind the namespace mutation to
the already-validated source file descriptor. See
`MACOS_MUTATION_THREAT_MODEL.md` for the exact boundary and stable failure
policy.

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
