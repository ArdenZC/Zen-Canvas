# Supported desktop platforms

Zen Canvas formally supports:

- Windows
- macOS

Platform support does not imply identical mutation capability. In v4.1.1,
Windows file mutation is enabled only through source-handle and verified target
directory-handle binding. macOS remains a supported desktop platform for
launch, scan, search, indexing, suggestions, preview, history, settings, and AI
suggestions, but file mutation, cleanup execution, Safe Trash mutation, and
restore are fail-closed with
`macos_file_mutation_source_binding_unsupported`. Apple's public
`renameatx_np` contract binds the source directory fd plus a source name; it
does not accept the already-open source file descriptor required by this
hardening boundary.

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

The CI quality matrix is limited to Windows Quality, macOS Quality, and
Dependency Audit. No Linux runner or Linux Tauri dependency installation is
part of the supported-platform gate.
