# W3-07 / W3-08 — Current-Truth Catch-up Closeout Result

Status: **COMPLETE**

Closeout type: docs-only governance catch-up after dependency-aware parallel development and ordered runtime integration.

Runtime baseline entering this closeout:

`master@7078706992d129e47ba49b65ff3fec5eff0f40ec`

This closeout records two already-reviewed and already-merged production Tracks. It does not change production code, Preview architecture, provider behavior, CI policy, schema, supported platforms or Wave authorization.

## W3-07 — Folder Preview

PR: #131 — merged

Runtime squash merge:

`ced5478abfa7ac42fa9295ad5ec7b87c5e7dbee3`

Final reviewed head:

`cf8a9edce9a07f518f443f09835047c93040030e`

Fresh exact-head hosted CI:

`32652108996` — success

Accepted result:

- `builtin.folder` delivers bounded direct-child Folder Preview through the existing Preview Core and Provider Registry;
- directory enumeration reuses the existing `BrowseService` through a backend-only Preview adapter and never gives the provider or renderer a raw filesystem path;
- each Preview request uses a separate temporary Preview-owned Browse session in the same BrowseService, so visible Browse request/enumeration/cursor/history authority remains unchanged;
- Folder Preview is direct-children-only and does not recursively compute subtree size/counts, traverse symlinks/packages/archives/`.git`, run Git, hydrate cloud content or create a second directory/query engine;
- aggregation remains bounded with the reviewed 100,000 direct-child ceiling and bounded samples/extension buckets/largest-observed/project hints;
- existing `PreviewPublicationSink` remains the only progressive-publication authority;
- first useful Folder facts can reach the shared Floating/Pinned renderer while `previewStart()` remains pending through the bounded, single-in-flight, epoch/source/previewId-bound snapshot observation path;
- ordinary in-progress Folder summaries are truthfully `Partial` with a nullable limit reason, exact end-of-directory may be `Complete`, and entry/deadline limits remain explicit Partial outcomes;
- exact 100,000 + authoritative EOF is Complete; work beyond the reviewed ceiling is Partial rather than silently continuing unbounded;
- the provider returns a truthful Partial before the outer Preview deadline rather than allowing outer timeout fallback to erase useful progressive content;
- source switch/cancel/dispose reject stale publication and release temporary Browse/page/scheduler resources;
- final W3-07 CI remediation changed only deterministic W3-06 ReadGate test ordering; it did not change accepted Folder production behavior.

Evidence classification:

- exact-head hosted CI `32652108996`: PASS;
- exact-head local real-browser coverage at 1600×900 and 980×680: PASS;
- native interactive macOS visual/accessibility verification: `UNVERIFIED` unless separately recorded elsewhere.

## W3-08 — ZIP Archive Preview

PR: #132 — merged

Runtime squash merge:

`7078706992d129e47ba49b65ff3fec5eff0f40ec`

Final reviewed head:

`50920b46bd118ed6f25219fb66cbe687cc9ba280`

Final reviewed tree:

`5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`

Fresh exact-head hosted CI:

`32659742797` — success

Synthetic merge-integration checkout:

`219b167478812bfa3a2396dc7c9369e7d4b8fe24`

Integration tree:

`5ec7dd1e694b03f7752b7fa8e1a80743cd680bab`

Final reviewer pass:

review `#5003079985`; code blockers = 0.

Accepted result:

- the single production Provider Registry adds `builtin.archive-zip` at priority 270 for Zen Floating/Pinned hosts;
- ZIP Preview is central-directory/archive metadata only: it never extracts entries, reads/decompresses entry payloads, recursively opens nested archives or turns archive names into filesystem authority;
- source access is a bounded backend `Read + Seek` adapter over `PreviewReadGateAdapter → MaterializationReadGate`, never `File::open`, `ZipArchive<File>`, a raw path or a renderer byte API;
- every underlying read is capped to the existing 1 MiB ReadGate ceiling and the whole ZIP operation is capped to 12 MiB of charged source reads, so many small seeks cannot bypass the request budget;
- reviewed archive ceilings include 20,000 inspected entries, 2,000 tree nodes, depth 64, 4 KiB / 2,048-char names, 16 KiB entry extra metadata, 16 KiB archive comment, 8 MiB central-directory bytes, 1 MiB encoded tree, 32 warnings and 512 children/node;
- `PreviewArchiveResourceLeaseAdapter` delegates CPU/I/O admission to the existing runtime `WorkScheduler`; no ZIP semaphore, parser pool, queue or second scheduler exists;
- real lifecycle tests exercise the archive provider through `PreviewReadGateAdapter → MaterializationReadGate` after an actual lease issue and preserve terminal truth for MaterializationRequired/Downloading, PermissionDenied, IdentityChanged, SourceUnavailable/AvailabilityUnknown and MetadataOnly fallback;
- cancel/source switch/dispose reject stale ArchiveTree publication and restore ReadGate and scheduler resource baselines;
- safe nested logical entries such as `a/b/` remain in the virtual archive tree, while absolute/traversal/dot/drive/UNC/control/normalization-sensitive names fail closed as inert unsafe presentation data;
- `ZIP_DEADLINE_RETURN_GUARD = 100 ms` reserves time to return before the outer Preview timeout;
- before EOCD/central-directory structure has been validated, a deadline remains provider-local Timeout and therefore Metadata fallback; the `.zip` hint alone can never authorize ArchiveTree publication;
- after an empty bounded central directory or first structurally valid central record establishes ZIP structure, later deadline pressure may truthfully return `ArchiveTree` with `Partial / deadline`;
- corrupt ZIP hints near deadline cannot fabricate an ArchiveTree representation;
- strict `ArchiveTreePayloadV1` is produced by Rust and fail-closed decoded by the shared frontend renderer with bounded tree depth/nodes/strings and inert entry names.

Evidence classification:

- exact-head hosted CI `32659742797`: PASS;
- source/integration tree equivalence: PASS;
- exact-head local W3-07 and W3-08 real-browser gates at 1600×900 and 980×680: PASS;
- native interactive macOS visual/accessibility verification: `UNVERIFIED` unless separately recorded elsewhere.

## Architecture / governance conclusion

The parallel W3-07/W3-08 implementation did not create a second Preview lifecycle/controller, Provider Registry, MaterializationReadGate, WorkScheduler, Browse/query engine, filesystem-path authority or renderer byte authority.

Ordered integration preserved the W3-07 progressive Folder path while adding W3-08 ArchiveTree support in the shared Preview runtime and renderer.

W3-07 and W3-08 are therefore **COMPLETE**.

## Next authorized Track

The only authorized production Track after this closeout is:

**W3-09 — Failure / Materialization / Security / Accessibility Integration.**

W3-09 Phase A preparation may be reused, but final W3-09 production integration must synchronize to the post-W3-08 current-truth baseline and converge Folder + ZIP with the already-merged providers/hosts.

W3-10 final acceptance, W3-11 closeout, W4 native integration and W5 Release are not activated by this document.
