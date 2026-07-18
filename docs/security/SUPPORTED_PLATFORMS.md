# Supported desktop platforms

Zen Canvas formally supports:

- Windows
- macOS

Linux is not a supported product platform. Linux is outside the product
support, build, release, and quality-gate scope for this repository. Zen Canvas
does not promise Linux installation, runtime behavior, file mutation, cleanup,
restore, or recovery safety.

The absence of Linux support is intentional. A shared Unix implementation that
happens to compile is not a Linux product or security guarantee.

For Windows and macOS, any file mutation that cannot be proven to operate on
the confirmed object must fail closed with a stable error. Unsupported
platform behavior must not silently fall back to a path-only destructive
operation.

The CI quality matrix is limited to Windows Quality, macOS Quality, and
Dependency Audit. No Linux runner or Linux Tauri dependency installation is
part of the supported-platform gate.
