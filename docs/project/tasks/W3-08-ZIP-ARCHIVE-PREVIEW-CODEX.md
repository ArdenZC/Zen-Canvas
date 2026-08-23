# W3-08 — ZIP Archive Preview provider

Status: implementation taskbook — code/review branch only

Baseline: `master@9950f32452d31699e5a2a70e66ab2c701d4601d1` (W3-06 current-truth closeout / PR #130)

Branch: `feat/w3-08-zip-archive-preview`

## Goal

Deliver a bounded, read-only ZIP Archive Preview provider through the existing W3 Preview Platform while preserving the existing PreviewSession, MaterializationReadGate, WorkScheduler, Provider Registry, representation wire, host, cancellation and fallback authorities.

W3-08 must:

- preview ZIP archive metadata only; it must never silently extract archive contents;
- use the existing `ArchiveTree { encoded_tree/encodedTree }` representation family;
- parse/index archive metadata through the existing Preview read boundary rather than raw filesystem paths;
- remain request/sourceVersion-bound, latest-wins, cancellable, disposable and bounded;
- reject or truncate hostile archive metadata without path traversal, nested recursion, decompression bomb behavior or renderer resource access;
- keep all archive entry names inert presentation data;
- preserve Metadata fallback for unsupported/corrupt/provider-local failures and preserve terminal source/read truth;
- work identically in the shared Floating and Pinned Zen hosts.

W3-08 does **not** authorize other archive formats, archive extraction, nested archive recursion, file mutation, W3-09 integration work, W4 Finder/Explorer native system-host integration or renderer filesystem access.

---

# 0. Mandatory read set

Before production edits, read at minimum:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
5. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
6. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
7. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
8. `docs/project/tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`
9. `docs/project/tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md`
10. `docs/project/tasks/W3-03-PINNED-PREVIEW-SIBLING-NAVIGATION-CODEX.md`
11. `docs/project/tasks/W3-04-TEXT-CODE-MARKDOWN-PROVIDERS-CODEX.md`
12. `docs/project/tasks/W3-05-STRUCTURED-TABLE-PROVIDERS-CODEX.md`
13. `docs/project/tasks/W3-06-IMAGE-PROVIDER-CODEX.md`
14. `src-tauri/src/file_workspace/preview.rs`
15. `src-tauri/src/file_workspace/preview_policy.rs`
16. `src-tauri/src/file_workspace/preview_providers.rs`
17. `src-tauri/src/file_workspace/read_gate.rs`
18. `src-tauri/src/file_workspace/integration/preview.rs`
19. `src-tauri/src/scheduler.rs`
20. `src-tauri/Cargo.toml` / `Cargo.lock`
21. `src/api/fileWorkspacePreviewWire.ts`
22. `src/types/fileWorkspace.ts`
23. `src/views/fileLibrary/preview/PreviewContent.tsx`
24. W3-04/W3-05 real PreviewReadGateAdapter lifecycle tests.

Do not begin by opening `File`/`PathBuf` directly from the provider, extracting ZIP entries, exposing archive paths to React, or adding a generic renderer byte-read command.

---

# R0 — Consumer / authority preflight

Before production edits, prove all of the following on the merged baseline.

## R0.1 Existing representation / registry

Confirm:

- Rust already carries `PreviewRepresentation::ArchiveTree { encoded_tree }`;
- TypeScript already carries `family: "archive_tree", encodedTree`;
- strict outer Preview wire already fails closed on unknown family/fields;
- production providers are composed only through the existing single registry owner;
- Floating and Pinned share one Preview renderer path.

Do not add another representation family.

## R0.2 Existing ZIP dependency

The baseline already contains:

```toml
zip = { version = "2", default-features = false, features = ["deflate"] }
```

Prefer using this reviewed dependency for central-directory/archive metadata parsing.

Do not add another ZIP/archive parser unless there is a demonstrated blocker and reviewer approval.

No runtime network access is permitted.

## R0.3 Read authority / random access

ZIP central-directory parsing needs seek/random access, but W3-08 MUST preserve the existing Preview byte-read authority.

The provider MUST NOT receive or open a raw source path.

If the existing provider read seam is insufficient for `Read + Seek` parsing, W3-08 MAY add the smallest backend-only bounded random-access adapter over:

`PreviewReadGateAdapter -> MaterializationReadGate`

A recommended shape is a `PreviewArchiveReader`/equivalent that:

- holds only the current `PreviewSourceRef`, exact sourceVersion and PreviewOperationContext;
- never holds or exposes a filesystem path;
- implements bounded logical seek/read by translating reads into `read_source_bounded(offset, max_bytes, ...)` calls;
- keeps every individual read <= the existing 1 MiB ReadGate cap;
- performs fresh authoritative sourceVersion/eligibility/identity/cancel/deadline checks on every underlying read;
- enforces one explicit W3-08 total-source-bytes-read budget across the whole archive parse;
- never materializes the whole archive merely to satisfy `Read + Seek`;
- may use only a small bounded cache if necessary, with a named hard byte limit;
- returns provider-local/terminal Preview errors using the existing W3-04 terminal taxonomy.

Do NOT:

- call `std::fs::File::open` from the provider;
- use `ZipArchive<File>` on a resolved raw path;
- add a Tauri generic byte-read command;
- expose a lease/handle/path to React;
- add a second read/materialization authority.

If a correct bounded `Read + Seek` adapter cannot be expressed over the existing read gate: **STOP and report**.

## R0.4 WorkScheduler admission

ZIP central-directory/index parsing is bounded CPU + I/O work.

Reuse the existing runtime WorkScheduler. If no archive-provider seam exists, add only the smallest backend-only scheduler adapter owned by the existing scheduler/integration boundary.

Recommended request resources:

```text
WorkClass        = Interactive
cpu              = 1
io               = 1
open_handles     = 0
network          = 0
decoder          = 0
native_preview   = 0
```

The lease must release by RAII on success, failure, cancellation, stale switch, timeout and provider cleanup.

Do not create a ZIP semaphore, second queue, detached parser pool or second scheduler.

## R0.5 No extraction authority

Prove the provider can build the required metadata index without calling APIs that extract/decompress entry payloads.

W3-08 may inspect central-directory metadata and archive-level structures only.

It MUST NOT:

- call entry-content `Read` APIs as part of Preview;
- inflate compressed file payloads;
- create output files/directories;
- test archive validity by extracting entries;
- recurse into nested ZIPs.

The `deflate` feature being present in Cargo does not authorize decompression in W3-08.

---

# 1. Provider composition / probe

Register only through the existing production Preview Provider Registry owner.

Stable provider identity:

```text
builtin.archive-zip
```

Recommended deterministic priority:

```text
270
```

Provider contract:

- supports `zen_floating` and `zen_pinned` only;
- `reads_content = true`;
- probe may use `.zip` / backend media-type only as a cheap routing hint;
- load MUST validate actual ZIP structure/signatures before publishing ArchiveTree;
- non-ZIP or extension/media mismatch becomes provider-local `Unsupported`/`CorruptSource` as appropriate and eventually Metadata fallback;
- host-provided/W4 hosts fail closed;
- no other archive format is in scope.

Provider capabilities v1:

- `canSearch = false` unless a real bounded in-archive metadata search UI is implemented in this Track;
- `canZoom = false`;
- `canPlayback = false`;
- `canSelectText = false` unless the actual renderer exposes meaningful selectable archive metadata;
- `canNavigateInternal = false` by default: archive-tree rows are read-only and do not extract/open children;
- sibling navigation remains W3-03 host/source-owned behavior.

Do not advertise extraction/open-entry capability.

---

# 2. ZIP scope — metadata index only

W3-08 v1 supports ZIP central-directory/archive metadata preview only.

Supported:

- ordinary ZIP central directory;
- stored/deflated method metadata as inert metadata;
- files/directories as logical archive entries;
- encrypted entries as inert metadata if safely exposed.

Not supported/authorized:

- RAR/7z/TAR/etc.;
- nested archive traversal;
- reading/decompressing entry payloads;
- password cracking/decryption;
- archive repair;
- extraction;
- modification;
- executing archive-contained content;
- rendering archive-contained HTML/images/scripts;
- following symlinks/links encoded in archive metadata.

---

# 3. Strict `ArchiveTreePayloadV1`

Keep outer wire unchanged:

```text
ArchiveTree { encodedTree }
```

Inside `encodedTree`, define one strict versioned JSON schema owned by Rust and validated by one shared TypeScript decoder.

Recommended v1 shape:

```text
ArchiveTreePayloadV1 {
  version: 1,
  format: "zip",
  progress: {
    inspectedEntries: integer,
    state: "complete" | "partial",
    limitReason: null | "entry_limit" | "tree_limit" | "metadata_limit" | "source_read_limit" | "deadline"
  },
  totals: {
    entriesObserved: integer,
    filesObserved: integer,
    directoriesObserved: integer,
    compressedBytesObserved: integer,
    uncompressedBytesDeclaredObserved: integer
  },
  root: ArchiveNodeV1,
  warnings: ArchiveWarningV1[]
}
```

Recommended node shape:

```text
ArchiveNodeV1 = {
  kind: "directory" | "file",
  name: string,
  children?: ArchiveNodeV1[],
  compressedSize?: integer,
  uncompressedSizeDeclared?: integer,
  compressionMethod?: string,
  encrypted?: boolean,
  unsafeName?: boolean
}
```

The exact final internal shape may vary if tests prove a simpler bounded representation, but it MUST remain versioned, strict and bounded.

No field may contain a host filesystem path, extraction target, raw source path, renderer-resolvable URL or executable markup.

The TypeScript decoder must fail closed on unknown version/fields, invalid enums, invalid sizes/counts, depth/array/string limits and encoded payload over the reviewed ceiling.

React parses only backend-produced ArchiveTreePayloadV1. It must never parse raw ZIP bytes.

---

# 4. Archive-name / path-traversal safety

Archive entry names are untrusted strings and MUST NEVER become filesystem authority.

The provider may build a virtual in-memory hierarchy only.

It must never resolve archive entry names against a host filesystem path.

Treat at minimum these as suspicious/unsafe names:

- absolute paths;
- UNC-like forms;
- Windows drive prefixes;
- parent traversal segments (`..`);
- embedded NUL/control characters;
- path forms whose normalization would escape a logical archive root.

Recommended behavior:

- keep a bounded inert display form;
- mark the entry `unsafeName=true`;
- do not interpret unsafe parent/absolute components as navigation outside the virtual root;
- if hierarchical placement cannot be proven safe, place the entry under a bounded logical unsafe bucket or render it flat;
- never silently rewrite an unsafe archive name into an extraction path.

Backslash may be treated as a logical separator for conservative visualization, but never as an OS path.

Hostile fixtures must include traversal, absolute, drive/UNC-like, control and huge-name cases.

No test may write these archive entries to disk during Preview.

---

# 5. Reviewed hard bounds

Freeze named constants and tests. Higher limits require reviewer justification.

Start from:

```text
MAX_ZIP_ENTRIES_INSPECTED              = 20_000
MAX_ZIP_TREE_NODES                     = 2_000
MAX_ZIP_TREE_DEPTH                     = 64
MAX_ZIP_ENTRY_NAME_BYTES               = 4 KiB
MAX_ZIP_ENTRY_NAME_CHARS               = 2_048
MAX_ZIP_EXTRA_METADATA_BYTES/entry     = 16 KiB
MAX_ZIP_ARCHIVE_COMMENT_BYTES          = 16 KiB
MAX_ZIP_CENTRAL_DIRECTORY_BYTES        = 8 MiB
MAX_ZIP_TOTAL_SOURCE_BYTES_READ        = 12 MiB
MAX_ZIP_SINGLE_READ                    <= existing ReadGate 1 MiB
MAX_ZIP_READER_CACHE_BYTES             <= 1 MiB if cache needed
MAX_ARCHIVE_ENCODED_TREE_BYTES         = 1 MiB
MAX_ARCHIVE_WARNINGS                   = 32
MAX_ARCHIVE_TREE_CHILDREN_PER_NODE     = 512
MAX_ARCHIVE_RENDERED_NODES             <= 2_000
```

W3-08 does not require progressive publication. Shell-first is already host-owned. Prefer one bounded final provider result.

If entry/tree/metadata/source-read/deadline ceilings prevent a complete index:

- stop bounded work;
- return `PreviewCompleteness::Partial` where a truthful partial index exists;
- set a truthful `limitReason`;
- never claim the tree contains the whole archive.

Do not allocate attacker-declared entry count, filename length or central-directory size before validating bounds.

Do not build an unbounded tree and truncate only during JSON serialization.

---

# 6. Central-directory / parser execution safety

The provider must remain metadata-only.

Use the ZIP crate only through the bounded ReadGate-backed reader.

Before/while creating the archive index:

- validate source size from authoritative metadata where required for seek-from-end;
- enforce total underlying source bytes read;
- enforce central-directory/index metadata bounds;
- enforce entry-count bounds before tree growth;
- enforce name/extra/comment bounds before copying into representation state;
- check PreviewOperationContext cancellation/deadline throughout iteration;
- stop before the outer Preview load timeout and return Partial where possible;
- do not increase global PreviewWorkBudget merely for large ZIPs.

Recommended deadline reserve:

```text
ZIP_DEADLINE_RETURN_GUARD >= 100 ms
```

Corrupt/truncated structural failures are provider-local and fall through to Metadata fallback.

Fresh authoritative source/read terminal conditions remain terminal exactly as W3-04 proved:

- MaterializationRequired / Downloading -> MaterializationRequired;
- Permission -> PermissionDenied;
- IdentityChanged -> IdentityChanged;
- SourceUnavailable / AvailabilityUnknown -> SourceUnavailable;
- MetadataOnly -> provider-local fallback -> Metadata.

Preserve this before lease issue and during post-lease read revalidation.

---

# 7. ZIP bomb policy

W3-08 MUST NOT decompress entry contents, therefore ordinary compressed-data expansion must never occur in Preview.

Still treat suspicious declared metadata conservatively.

Use overflow-safe aggregate arithmetic.

Do not allocate based on declared uncompressed size, compressed size, entry count, offsets, filename/extra/comment lengths until validated against reviewed ceilings and source bounds.

No nested ZIP recursion.

A ZIP containing a tiny compressed payload with a huge declared/uncompressed size may be listed as suspicious metadata or Partial, but Preview must never inflate it merely to test the declaration.

Hostile fixtures must include huge declared sizes, extreme compression-ratio metadata, integer-overflow-adjacent aggregates, too many entries, huge names/metadata, corrupt/truncated central directory, malformed offsets, encrypted entries and nested ZIP entries treated only as inert file metadata.

---

# 8. Tree construction semantics

Build the virtual archive tree incrementally with bounded memory.

Do not collect all entry names first and sort globally, materialize all paths/IDs, recurse attacker-controlled depth without guards, or render beyond the reviewed node limit.

If more entries are inspected than can be represented:

- continue only if needed for bounded truthful observed totals and still within entry/deadline limits;
- representation stays Partial with `tree_limit`;
- omit names without retaining them.

Deterministic central-directory order is acceptable and preferable to an unbounded sort buffer if documented/tested.

Empty archives may publish Complete.

Synthetic parent nodes are allowed only as virtual representation structure, never as claims that an explicit archive directory entry existed.

---

# 9. Completeness / fallback truth

`PreviewCompleteness::Complete` only when authoritative end of the archive index is reached, all entries in W3-08 scope were inspected, no W3-08 limit omitted archive content from the representation and no structural corruption prevented full indexing.

`Partial` when a reviewed limit intentionally truncates a valid archive index.

Provider-local fallback when the archive cannot be structurally parsed well enough to publish truthful bounded metadata.

Do not fabricate archive entries/closure for truncated input.

Do not present Metadata fallback as ArchiveTree.

---

# 10. Lifecycle / stale semantics

Use the existing PreviewSession lifecycle and latest-wins transport.

No second queue.

Deterministically cover:

- ZIP A parsing blocked -> switch to B -> A cannot publish;
- cancel while bounded archive read is active;
- dispose while archive index work is active;
- scheduler/resource lease release on success/failure/cancel/stale/deadline;
- Preview read lease count returns to baseline on every exit;
- post-lease terminal drift remains truthful;
- reader total-byte budget is not bypassed by many seeks/small reads;
- no stale ArchiveTree after sourceVersion changes.

Use barriers/channels/test-owned coordination. No correctness sleeps.

---

# 11. Frontend renderer

Extend the shared PreviewContent path with one ArchiveTree renderer used by both Floating and Pinned hosts.

Requirements:

- strict `ArchiveTreePayloadV1` decoder;
- inert escaped text only;
- no `dangerouslySetInnerHTML`;
- no archive-entry URL/resource loading;
- no raw/source/archive path in href/src;
- explicit Complete/Partial disclosure;
- visible inspected/observed counts;
- bounded DOM <= reviewed node limit;
- unsafe archive names visibly inert and never clickable extraction/navigation targets;
- long names wrap safely;
- no horizontal page overflow.

Expandable/collapsible tree UI is optional and renderer-local only. It cannot read more bytes, extract/open entries or become navigation authority.

Do not implement open-entry/extract buttons in W3-08.

---

# 12. Required tests

Rust coverage must include:

- provider registry/probe/priority/host/reads_content truth;
- bounded ReadGate-backed seek/read adapter;
- every underlying read <= 1 MiB;
- total read budget cannot be bypassed by many tiny seeks;
- sourceVersion/terminal drift truth;
- lease baseline restoration;
- empty ZIP;
- stored file metadata;
- deflated-file metadata without content extraction;
- nested logical directories;
- Unicode names;
- corrupt/truncated EOCD/central directory;
- malformed offsets;
- > entry limit;
- > tree-node/depth limits;
- huge name/extra/comment;
- aggregate size overflow safety;
- huge declared uncompressed size;
- traversal/absolute/drive/UNC/control names;
- nested ZIP inert;
- encrypted entry metadata-only;
- no extraction/decompression side effects;
- scheduler lease success/failure/cancel/stale release;
- A stale cannot publish after B;
- cancel/dispose during read/index;
- deadline Partial before outer timeout where truthful partial index exists.

Frontend coverage must include strict payload decoding, limits, Complete/Partial, inert hostile names, no href/src, no HTML execution, bounded DOM, shared Floating/Pinned renderer and stale source rejection.

No correctness sleeps.

---

# 13. Real browser gate

Add:

```text
npm run test:browser:w3-08:real
```

Run exact-head at 1600x900 and 980x680.

Cover Library/Browse ZIP Floating/Pinned, empty ZIP, nested logical tree, Partial limits, corrupt fallback, hostile names inert, rapid A->B latest-wins, source-follow, sibling navigation ownership, no-source, Unpin, compact single Context/focus owner, one Preview host, no horizontal overflow and no console/page errors.

Monitor browser requests/navigation. Archive content must cause no HTTP(S), file:, data/blob resource navigation, relative resource load or extraction/open-entry action.

Browser fixtures may model large metadata counts; hostile parser/index evidence remains Rust-owned.

---

# 14. Performance / scale evidence

Add bounded backend evidence for representative:

- 1k entries;
- 10k entries;
- 20k entry ceiling;
- >20k entry-limit Partial;
- deep names/hierarchy;
- hostile metadata-size fixtures.

Record elapsed time, source bytes read, bounded-read count, representation nodes, encoded payload size, scheduler/read lease baseline restoration.

No entry payload extraction is allowed in performance fixtures.

---

# 15. Validation

Run focused ZIP provider/reader/security tests first, then:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-08:real
npm run test:governance

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

npm run security:audit
npm run security:audit:rust

git diff --check
git diff --check origin/master...HEAD
```

Run all additional CI-selected Windows/macOS/release/native/performance lanes.

---

# 16. PR / review contract

Implement directly on `feat/w3-08-zip-archive-preview`.

No second implementation branch. No force push.

When implementation is complete:

- push normally;
- create exactly ONE Draft PR against `master`;
- obtain fresh exact-head hosted CI;
- keep OPEN / DRAFT / UNMERGED;
- do not Ready/merge;
- do not start W3-09 production changes in this branch;
- do not modify current-truth closeout docs.

Return final HEAD/tree, source/integration tree evidence, exact changed files, provider ID/priority/capabilities, strict ArchiveTreePayloadV1 schema, hard bounds, bounded ReadGate-backed seek/read evidence, no raw path/File evidence, no extraction/decompression evidence, WorkScheduler evidence, path-traversal/unsafe-name evidence, ZIP bomb/hostile metadata evidence, 1k/10k/20k/>20k scale evidence, Complete/Partial/fallback truth, stale/cancel/dispose/read-lease cleanup, browser evidence, audits and honest DEFERRED/UNVERIFIED native/manual evidence.

Do NOT Ready. Do NOT merge. Do NOT perform current-truth closeout.

---

# Reviewer focus

Independent review will specifically inspect:

- any raw path/File/`ZipArchive<File>` shortcut;
- whether `Read + Seek` can bypass total source-read budget through many small seeks;
- whether ZIP APIs are used only for metadata/indexing and never entry extraction;
- declared-size/offset integer overflow;
- path traversal names accidentally becoming host paths or links;
- allocations before hard-limit validation;
- nested archive recursion;
- completeness truth under entry/tree/source-read/deadline limits;
- stale sourceVersion publication;
- scheduler/read lease cleanup;
- frontend DOM limits and inert entry names;
- browser resource/navigation side effects.
