# W4-03 Windows Preview Handler spike

This package is a dedicated Windows-only COM `cdylib`. It is deliberately not
the `zen_canvas_tauri` crate and does not own Tauri runtime state, file
associations, installer registration, or production packaging.

The shell-owned `IStream` is captured by `IInitializeWithStream` without
reading and remains an `Rc<IStream>` owned by the handler's caller STA. The
incoming interface is never marked `Send` or `Sync`. `DoPreview` creates one
standard COM marshal packet, registers one opaque generation-scoped capability
with the shared `zen-canvas-native-host` `HostProvidedRegistry`, and schedules
one bounded read on a detached MTA worker. The worker owns only the
unmarshaled interface and request state; completion is returned to the owner
STA, which revalidates the generation before rendering a plain inert text
summary into the one child `STATIC` window. No path is reconstructed and no
renderer-supplied source is accepted.

`Unload` ends only the current generation: it revokes the HostProvided
capability first, then destroys the child surface and releases the
site/stream/completion references. A blocked worker may finish after that
revocation, but the shared registry's cancellation and post-read validation
prevent late bytes from publishing. The shared crate is the single
HostProvided implementation; the DLL has no second durable registry.

The deterministic `test_registration` module is an in-process register /
unregister seam only. It deliberately avoids machine registry writes. The
separate `zen-canvas-windows-preview-handler-harness` executable loads the
built DLL, creates a real host HWND and file-backed `IStream`, exercises three
generations on one handler in an STA, checks the child HWND/record count and
verifies that the fixture can be reopened, renamed, moved and deleted after
`Unload` while the handler interfaces remain alive. It also uses a
controllably blocked marshaled source to prove revoke-before-completion
cancellation. The harness pumps the owner STA while waiting for an MTA worker
to complete COM calls. Real Explorer association, `prevhost.exe` loading, and
packaged installer behavior remain separate evidence levels and are not
claimed by the harness, Rust unit tests or DLL compilation.

For W4-04, the proven reusable seam is the bounded host source plus the
request lifecycle. The current production W3 provider tree remains coupled to
the main runtime's read gate, scheduler, and provider registry. A future
provider extraction must be narrow and separately reviewed; this spike does
not clone that tree or make the inert text renderer a production provider.
