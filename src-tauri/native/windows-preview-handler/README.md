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
unmarshaled interface and request state. Completion is posted with a
generation-scoped notification id to the handler's owner-STA message-only
window; its window procedure consumes only the matching result after
revalidating the generation, HostProvided token and child HWND. No COM method
polls for completion. The handler itself is apartment-bound, and no path is
reconstructed or renderer-supplied source accepted.

`Unload` ends only the current generation: it invalidates the owner state,
requests COM cancellation for the worker's current synchronous call, revokes
the HostProvided capability, then destroys the child surface and releases the
site/stream/completion references. The worker remains DLL-owned until its COM
apartment and call have quiesced; the shared registry's cancellation and
post-read validation prevent late bytes from publishing. This is sufficient
for publication revocation and cooperative sources, but it is not a hard
source-release boundary for an arbitrary non-cooperative `IStream`. The shared
crate is the single HostProvided implementation; the DLL has no second durable
registry.

The deterministic `test_registration` module is an in-process register /
unregister seam only. It deliberately avoids machine registry writes. The
separate `zen-canvas-windows-preview-handler-harness` executable loads the
built DLL, creates a real host HWND and file-backed `IStream`, exercises three
generations on one handler in an STA, checks the child HWND/record count and
verifies that the fixture can be reopened, renamed, moved and deleted after
the completed-read `Unload` path while the handler interfaces remain alive.
The harness also contains a positive cooperative cancellation fixture and a
Phase 1 cancellation-limit experiment. The latter uses deterministic gates
before `Seek` and between `Seek`/`Read`, plus a standard-marshaled non-agile
`IStream` whose `Read` blocks on a teardown event and never calls
`CoTestCancel`. It records that `CoCancelCall` returns `S_OK` while the
server-side read remains active and the real file handle remains locked; the
teardown signal is sent only after that observation. The diagnostic watchdog
also records `Unload` at phase 6, immediately before releasing the
handler-side marshaled stream; its two-second wait is diagnostic only and is
not used as a correctness timeout. This is evidence for W4-03 Stop Condition
#5, not a production cancellation guarantee. The harness pumps the owner STA
while waiting for an MTA worker to complete COM calls. Real Explorer
association, `prevhost.exe` loading, and
packaged installer behavior remain separate evidence levels and are not
claimed by the harness, Rust unit tests or DLL compilation.

## Cancellation architecture finding

Windows COM cancellation is a request against a currently pending outbound
synchronous call. Standard marshaling supplies a cancellation object, but the
server decides whether to observe it; `CoCancelCall` returning `S_OK` means
only that the request was made. It does not attach cancellation to a future
call, and it does not guarantee that a non-cooperative server stops executing
or releases its resources. See Microsoft's [method-call cancellation
semantics](https://learn.microsoft.com/en-us/windows/win32/com/canceling-method-calls),
[`CoCancelCall`](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cocancelcall),
and [`CoTestCancel`](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cotestcancel).

The Phase 1 harness reproduced both admission races: cancellation before the
actual COM call and cancellation after `Seek` but before `Read` still allowed
the later stream operation in the current implementation. The
non-cooperative file-lock fixture then showed that publication and the worker
client can be quiescent while the server-side `Read` and its file handle remain
active. Therefore this spike cannot claim the frozen `Unload` hard-cleanup
contract for the actual `IInitializeWithStream` model. W4-04 must remain
architecture-gated until a reviewed source/read model can provide that
guarantee.

For W4-04, the proven reusable seam is the bounded host source plus the
request lifecycle. The current production W3 provider tree remains coupled to
the main runtime's read gate, scheduler, and provider registry. A future
provider extraction must be narrow and separately reviewed; this spike does
not clone that tree or make the inert text renderer a production provider.
