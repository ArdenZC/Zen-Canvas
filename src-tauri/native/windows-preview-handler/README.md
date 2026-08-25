# W4-03 Windows Preview Handler spike

This package is a dedicated Windows-only COM `cdylib`. It is deliberately not
the `zen_canvas_tauri` crate and does not own Tauri runtime state, file
associations, installer registration, or production packaging.

The shell-owned `IStream` is captured by `IInitializeWithStream` without
reading. `DoPreview` adapts that stream behind the shared
`zen-canvas-native-host` `HostProvidedReadSource`, registers one opaque
generation-scoped capability, performs one bounded read, and renders only a
plain inert text summary into a child `STATIC` window. No path is reconstructed
and no renderer-supplied source is accepted.

`Unload` marks the request stale, revokes the HostProvided capability first,
then destroys the child surface and releases the site/stream references. The
registry's post-read validation prevents late bytes from publishing after a
revoke or expiry. The shared crate is the single HostProvided implementation;
the DLL has no second durable registry.

The deterministic `test_registration` module is an in-process register /
unregister seam only. It deliberately avoids machine registry writes. Real
Explorer association, `prevhost.exe` loading, and packaged installer behavior
remain separate evidence levels and are not claimed by Rust unit tests or DLL
compilation.

For W4-04, the proven reusable seam is the bounded host source plus the
request lifecycle. The current production W3 provider tree remains coupled to
the main runtime's read gate, scheduler, and provider registry. A future
provider extraction must be narrow and separately reviewed; this spike does
not clone that tree or make the inert text renderer a production provider.
