# W3-07 — Folder Preview provider

Status: implementation taskbook — code/review branch only

Baseline: `master@9950f32452d31699e5a2a70e66ab2c701d4601d1` (W3-06 current-truth closeout / PR #130)

Branch: `feat/w3-07-folder-preview`

## Goal

Deliver the bounded, progressive built-in Folder Preview provider while preserving the existing W3 Preview Core, source identity, Browse/Library, WorkScheduler, publication and host authorities.

W3-07 must:

- render a useful direct-child Folder Preview summary through the existing `folder_summary { encodedSummary }` representation family;
- show shell/useful initial facts before any 1k/10k/100k traversal completes;
- reuse the existing W3-01 progressive publication sink rather than adding another event/update channel;
- enumerate direct children only through a backend-owned adapter over existing source resolution and `BrowseService` authority;
- remain request/sourceVersion-bound, latest-wins, cancellable, disposable and bounded;
- preserve Library Query V2 / BrowseService ownership rather than creating a hidden second directory/query engine;
- preserve the no-implicit-materialization rule;
- never expose a source filesystem path or directory handle to React.

W3-07 does **not** authorize W3-08 ZIP/archive work, W3-09 integration work, W4 Finder/Explorer system integration, recursive disk analytics, a second BrowseService, a second query engine, a new durable folder index/cache, renderer raw paths or a second scheduler/read/materialization authority.

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
15. `src-tauri/src/file_workspace/preview_publication.rs`
16. `src-tauri/src/file_workspace/preview_policy.rs`
17. `src-tauri/src/file_workspace/preview_providers.rs`
18. `src-tauri/src/file_workspace/browse/mod.rs`
19. `src-tauri/src/file_workspace/integration/browse.rs`
20. `src-tauri/src/file_workspace/integration/preview.rs`
21. `src-tauri/src/file_workspace/integration/runtime.rs`
22. `src-tauri/src/scheduler.rs`
23. `src/api/fileWorkspacePreviewWire.ts`
24. `src/types/fileWorkspace.ts`
25. `src/views/fileLibrary/preview/PreviewContent.tsx`
26. W1 Browse 100k/performance tests and W3-01 progressive-publication lifecycle tests.

Do not begin by calling `std::fs::read_dir` from a Preview provider, exposing a resolved path to React, creating a second directory index, or materializing a managed Library selection.

---

# R0 — Consumer / authority preflight

Before implementation, prove all of the following on the merged baseline.

## R0.1 Existing representation / progressive publication

Confirm:

- Rust and TypeScript already carry `FolderSummary { encoded_summary/encodedSummary }` in the exhaustive Preview representation wire;
- W3-01 already provides `PreviewPublicationSink` / `PreviewPublicationUpdate` with strict monotonic sequencing;
- every progressive publication is current session/request/sourceVersion-bound;
- cancellation/switch/dispose revokes publication rights immediately;
- progressive publication updates one current session representation and is not an app-wide event bus;
- publication queueing is bounded by the existing callback model rather than an unbounded provider queue.

W3-07 MUST reuse this mechanism.

Do not add:

- a second Preview event bus;
- a Folder-specific frontend polling protocol;
- a provider-global progress registry;
- an unbounded update channel.

If the existing publication sink cannot truthfully deliver Folder Partial -> newer Partial -> final state, **STOP and report** rather than inventing parallel publication authority.

## R0.2 Folder source / enumeration authority

Confirm the exact backend seams for both source kinds:

- managed source identity resolves through the existing File Library detail/source-resolution authority;
- ephemeral source identity resolves only through the `BrowseService` that issued the opaque entry ref;
- `BrowseService` is already the backend-owned, non-durable paged directory enumeration authority;
- its current page size is bounded (`<= 256`);
- each page has a raw directory inspection budget (`RAW_DIRECTORY_SCAN_BUDGET = 1024`);
- enumeration is cancellable/stale-aware and page-owned refs can be released;
- Browse sessions/path/entry refs are process/session bounded and have 100k evidence.

The Folder provider itself MUST NOT own or receive a raw path.

If there is no provider-consumable enumeration seam, W3-07 MAY add only the smallest backend-only `PreviewFolderEnumerationAccess`-style adapter at the existing integration/runtime boundary.

That adapter must:

1. resolve the current `PreviewSourceRef` through the same authoritative source-resolution facts used by Preview;
2. require the source to still be the same directory/sourceVersion;
3. delegate direct-child enumeration to the existing `BrowseService` rather than implementing another `read_dir` loop;
4. create a **temporary Preview-owned BrowseService session** for the resolved directory so Folder Preview never supersedes or mutates the user's visible Browse session active enumeration;
5. expose only bounded child facts needed by the provider, not `PathBuf`, raw paths, `DirEntry`, `ReadDir`, filesystem handles or navigation refs;
6. release every published Browse page as soon as the provider has consumed its facts;
7. dispose the temporary Browse session on success, failure, cancellation, stale switch, deadline and provider cleanup;
8. preserve `BrowseService` capacity/resource accounting;
9. perform no implicit hydration/download;
10. create no second enumeration/cache/query authority.

A narrow shared backend helper may be extracted from `WorkspacePreviewResolver` if necessary so the resolver and Folder adapter reuse one source-to-resolved-directory truth instead of duplicating managed/ephemeral resolution logic.

If correct enumeration requires a new durable source/path authority or a second filesystem scanner: **STOP and report**.

## R0.3 Visible Browse isolation

Prove with deterministic tests that a Folder Preview of a Browse directory does **not**:

- cancel/supersede the current visible Browse enumeration;
- invalidate the visible page's entry/path refs;
- change the visible Browse request/enumeration ID;
- advance the user's Browse cursor;
- mutate WorkspaceSession navigation/history.

The Preview adapter may share the existing `BrowseService` instance but must use its own temporary session/enumeration lifecycle.

## R0.4 WorkScheduler admission

Folder enumeration owns potentially expensive filesystem traversal and one live directory handle.

W3-07 must use the existing runtime `WorkScheduler` for this capacity. If the exact provider-consumable seam is missing, W3-07 MAY add only a small backend-only scheduler adapter owned by the existing scheduler/integration boundary.

Recommended resource declaration for one active Folder enumeration:

```text
WorkClass        = Interactive
io               = 1
open_handles     = 1
cpu              = 0 or 1 only if aggregation work proves it is needed
network          = 0
decoder          = 0
native_preview   = 0
```

The scheduler lease must cover the lifetime during which the temporary Browse enumeration owns its live `ReadDir`/directory handle and release by RAII on every exit path.

Do not create:

- a Folder semaphore;
- a second scheduler;
- a detached scan thread pool;
- an unbounded worker pool.

If correct accounting cannot be represented by the existing `WorkScheduler`: **STOP and report**.

## R0.5 Preview deadline interaction

The current Preview provider load budget is bounded. W3-07 must not simply scan until the outer load timeout fires, because Preview Core currently treats a provider load timeout as recoverable fallback and may replace the last progressive representation.

Therefore the provider MUST own a conservative deadline guard:

- inspect `PreviewOperationContext::remaining()` before every page and publication;
- stop enrichment before the outer deadline is exhausted;
- return the latest truthful FolderSummary as the provider's final result with `Partial` when the full directory was not completed;
- never increase the global Preview load timeout merely to force a 100k folder to finish.

Recommended deadline reserve:

```text
FOLDER_DEADLINE_RETURN_GUARD >= 100 ms
```

A lower/higher value may be used only with deterministic evidence that the provider returns before the outer load timeout under the reviewed fixtures.

---

# 1. Provider composition / probe

Register Folder Preview only through the existing production Preview Provider Registry owner.

Stable provider identity:

```text
builtin.folder
```

Recommended deterministic priority:

```text
290
```

This is below Markdown `300`, above Image `280`, and should remain semantically disjoint because Folder probe requires a backend-truthful directory source.

Provider contract:

- supports `zen_floating` and `zen_pinned` only;
- `reads_content = false` because directory enumeration is not a byte-content lease and directories are intentionally not `MaterializationReadGate` file-content sources;
- probe uses backend source kind/capability truth, never an extension or display path;
- file sources are unsupported;
- host-provided/W4 host kinds fail closed;
- no native shell host is used to generate Folder Preview.

Provider capabilities v1:

- `canSearch = false` unless a real bounded in-summary search UI is implemented in this Track;
- `canZoom = false`;
- `canPlayback = false`;
- `canSelectText = false` unless the actual renderer exposes meaningful selectable summary text;
- `canNavigateInternal = false` by default unless W3-07 implements a reviewed child-activation UI that routes through the existing workspace/source owner;
- sibling navigation remains the existing W3-03 host/source-owned behavior and is not reimplemented by Folder provider.

Do not claim a capability merely because the host supports it.

---

# 2. Direct-child scope — no recursion

W3-07 v1 scans **direct children only**.

It must not recursively descend into subdirectories for:

- counts;
- total size;
- type distribution;
- largest-item candidates;
- project detection;
- any hidden enrichment.

A directory child contributes only its direct entry facts; its subtree size/count is unknown in W3-07 v1.

No symlink traversal.
No package traversal.
No archive traversal.
No Git object traversal.
No network/provider hydration.

If a future product requirement needs recursive disk analytics, it requires a separately reviewed authority/Track.

---

# 3. Strict `FolderSummaryPayloadV1`

Keep the existing outer representation exactly:

```text
FolderSummary { encodedSummary }
```

Do not add ad-hoc fields to the outer Preview wire.

Inside `encodedSummary`, define one strict, versioned JSON payload owned by Rust and validated by one shared TypeScript decoder before rendering.

Recommended v1 shape:

```text
FolderSummaryPayloadV1 {
  version: 1,
  folderName: string,
  progress: {
    inspectedEntries: integer,
    acceptedChildren: integer,
    state: "partial" | "complete",
    limitReason: null | "entry_limit" | "deadline"
  },
  sample: FolderChildSampleV1[],
  kindCounts: {
    files: integer,
    directories: integer,
    other: integer
  },
  extensionCounts: FolderExtensionCountV1[],
  sizeProgress: {
    observedBytes: integer,
    knownSizeEntries: integer
  },
  largestObserved: FolderLargestItemV1[],
  projectHints: FolderProjectHintV1[]
}
```

Child/sample/largest values may contain only presentation facts such as:

```text
name
kind = file | directory | other
extension = normalized optional display extension
sizeBytes = optional direct-entry size
```

No payload field may contain:

- absolute/relative filesystem path;
- BrowsePathRef/EntryRef intended for navigation unless separately reviewed;
- inode/device/file handle;
- raw provider URL;
- materialization token;
- executable markup.

The TypeScript decoder must fail closed on:

- unknown version;
- unknown fields;
- invalid enum values;
- negative/non-finite counts/sizes;
- array/count/string limits;
- payloads larger than the reviewed encoded ceiling.

Do not let React parse arbitrary original directory data. React parses only this strict summary payload.

---

# 4. Reviewed resource / representation bounds

Freeze named constants and tests. Higher values require reviewer justification.

Recommended W3-07 v1 ceilings:

```text
MAX_FOLDER_CHILDREN_INSPECTED      = 100_000 direct entries
BROWSE_PAGE_SIZE                    <= existing 256
RAW_SCAN_BUDGET_PER_PAGE            = existing BrowseService 1024
MAX_FOLDER_SAMPLE_ITEMS             = 32
MAX_FOLDER_EXTENSION_BUCKETS        = 16
MAX_FOLDER_LARGEST_ITEMS            = 10
MAX_FOLDER_PROJECT_HINTS            = 8
MAX_FOLDER_NAME_CHARS               = 512
MAX_FOLDER_EXTENSION_CHARS          = 64
MAX_FOLDER_ENCODED_SUMMARY_BYTES    = 256 KiB
MAX_FOLDER_PROGRESS_PUBLICATIONS    <= 8
MAX_TEMP_BROWSE_SESSIONS_PER_PREVIEW_REQUEST = 1
MAX_ACTIVE_FOLDER_ENUMERATIONS_PER_REQUEST    = 1
```

`100_000` is a hard direct-child inspection ceiling, not a target that permits unbounded memory.

If a directory contains more than 100,000 direct entries:

- stop at the ceiling;
- publish/return `Partial`;
- `limitReason = "entry_limit"`;
- never claim total count/size for the whole directory.

Aggregation memory must stay O(1) / O(reviewed small bounds) relative to directory size:

- sample <= 32;
- extension buckets <= 16;
- largest candidates <= 10;
- project hints <= 8;
- no 100k-name vector;
- no sort of all entries;
- no materialized child ID list.

Use bounded top-K/streaming aggregation.

---

# 5. Progress and truth semantics

The shell is host-owned and already shell-first. Folder provider must add useful content progressively.

Required first useful publication:

- after the first consumed Browse page (including an empty complete page), or earlier if the adapter can truthfully establish an empty folder;
- it must not wait for 1k/10k/100k completion.

Use deterministic count milestones rather than high-frequency/time-based publication.

Recommended publication milestones:

```text
first page
1,000 inspected
10,000 inspected
50,000 inspected
100,000 inspected / entry limit
final complete or deadline-bounded return
```

Total progressive updates plus final result must remain within the reviewed publication ceiling.

Every update must use the next monotonic `PreviewPublicationUpdate.sequence` and the existing session sink.

### Completeness

`Complete` is allowed only when:

- the direct-child enumeration reached authoritative end-of-directory;
- no W3-07 inspection/representation limit discarded direct children;
- no deadline stopped enrichment early.

`Partial` is required when:

- entry ceiling was reached;
- deadline guard stopped enumeration;
- cancellation/stale state prevents completion (if a representation can still truthfully remain current under existing lifecycle semantics);
- any reviewed representation bound omitted facts needed for a claimed total.

Sample/extension/largest arrays are intentionally bounded views. Their own bounded presentation does not make the whole representation Partial **if** the provider has inspected the complete direct-child directory and all aggregate totals remain truthful. The UI must label them as samples/top observed values rather than implying they list every child.

`sizeProgress.observedBytes` is the sum of sizes known for inspected direct file entries only. It is a full direct-child total only when the directory enumeration is Complete and every relevant direct file size was available.

Do not recursively estimate folder subtree size.

---

# 6. Child sample policy

The first child sample is presentation only.

Requirements:

- bounded to 32;
- deterministic in enumeration order;
- name escaped/rendered as text;
- no click/navigation authority by default;
- no hidden child refs/paths in DOM attributes;
- directory and file kinds are visually distinguishable;
- extension/size facts are optional and truthfully absent when unavailable.

Do not sort the entire folder merely to present a sample.

---

# 7. Type / extension distribution

W3-07 must not invent a second semantic file-classification authority.

The v1 summary may report:

- file/directories/other counts from observed direct children;
- bounded normalized extension frequency buckets as presentation facts.

Extension buckets:

- maximum 16 retained buckets;
- normalize case consistently;
- empty/no-extension may use a fixed presentation bucket;
- counts refer to inspected accepted direct children;
- when the overall summary is Partial, UI must not label them as whole-folder final distribution.

Do not reuse extension heuristics to claim product `fileType` classification unless the existing managed authority supplies that exact fact through a reviewed seam.

---

# 8. Largest-item candidates

Optional but allowed in W3-07 v1.

If implemented:

- direct children only;
- max 10 candidates;
- bounded streaming top-K, no full sort;
- only entries with truthful direct size values participate;
- name/kind/size only;
- when summary is Partial, label as `largest observed`, not `largest in folder`.

Do not recurse to compute directory subtree sizes.

---

# 9. Project hints

Project hints are advisory presentation metadata, never a shell prerequisite and never a recursive project scanner.

Allowed v1 evidence is direct-child name presence only, for a small reviewed fixed vocabulary such as:

```text
.git
package.json
Cargo.toml
pyproject.toml
requirements.txt
go.mod
pom.xml
build.gradle / build.gradle.kts
```

Rules:

- max 8 hints;
- no file content reads merely to infer a project;
- no Git commands;
- no `.git` traversal;
- no package-manager/network lookup;
- no language server;
- no mutation.

If the direct-child sample/enumeration never observed a hint before a Partial stop, absence means `not observed`, never `not a project`.

Project hints MAY be omitted entirely in the first implementation if keeping them would complicate authority/bounds.

---

# 10. Temporary Browse lifecycle

A Preview-owned temporary Browse session is infrastructure, not user navigation state.

Required lifecycle:

1. authoritative source resolution proves a current directory/sourceVersion;
2. create at most one temporary BrowseService session for that directory;
3. start one unfiltered direct-child enumeration;
4. consume one bounded page at a time;
5. aggregate only reviewed small state;
6. release each page immediately after consumption;
7. continue via existing cursor while active/current/budget permits;
8. cancel/invalidate and dispose the temporary session on all exits.

The provider must not retain Browse EntryRefs/PathRefs after a page is released.

Deterministic tests must assert resource counts return to baseline after:

- empty folder;
- normal completion;
- 100k completion/limit;
- provider failure;
- cancellation while waiting for scheduler;
- cancellation mid-enumeration;
- source switch/stale publication;
- deadline Partial return;
- Preview close/dispose.

No sleeps for correctness.

---

# 11. SourceVersion / TOCTOU truth

Folder Preview is namespace/enumeration-sensitive even though it is not a byte-reading provider.

The backend adapter must verify the source remains the same authoritative directory before starting enumeration and fail closed on source identity/availability change.

At minimum:

- request source ref must equal the prepared snapshot source;
- request sourceVersion must equal the current Preview sourceVersion;
- resolver/source identity must be revalidated at enumeration admission;
- cancellation/stale context checked before every page and publication;
- source switch revokes publication before old enumeration cleanup completes.

If the underlying directory changes while a long enumeration is running and the current sourceVersion contract cannot detect that change at a meaningful boundary, do not fabricate a stronger guarantee. Keep the summary truth scoped to the observed enumeration and classify any remaining change-detection gap honestly for W3-09/W3-10 if it cannot be closed without moving authority.

Do not add a persistent directory watcher to W3-07 solely for Preview freshness.

---

# 12. Failure / terminal semantics

Provider-local recoverable failures include:

- unsupported non-directory source;
- temporary Browse session capacity exceeded;
- enumeration/page failure that does not represent a terminal source condition;
- malformed internal payload construction;
- provider deadline before any useful FolderSummary can be published.

These may fall through according to the existing Preview provider/fallback matrix.

Terminal source/session states remain terminal:

- source unavailable;
- permission denied;
- identity changed;
- cancelled/stale publication.

Directory `ContentReadEligibility::SourceNotSupported`, `PackageUnsupported` or `MetadataOnly` must not by itself block Folder enumeration because W3-07 does not read file content. Folder enumeration eligibility comes from the authoritative directory/source adapter, not the file-content read gate.

No implicit materialization/download action is introduced.

---

# 13. Frontend `FolderSummary` renderer

Use one shared Floating/Pinned renderer path through existing `PreviewContent`.

Add one strict TypeScript `FolderSummaryPayloadV1` decoder shared by both hosts.

Required presentation:

- folder display name;
- clear Partial / Complete status;
- inspected/direct-child progress;
- bounded child sample;
- file/directory counts for observed entries;
- bounded extension distribution;
- observed size progress where available;
- largest-observed section only if backend supplies it;
- project hints only if backend supplies them.

Required semantics:

- all names/extensions/hints rendered as inert text;
- no `dangerouslySetInnerHTML`;
- no raw path display;
- no arbitrary resource URLs;
- no page-level horizontal overflow;
- bounded DOM independent of 1k/10k/100k directory size;
- Floating and Pinned use exactly the same FolderSummary content component/decoder.

Do not render one row per inspected child.

### Internal navigation

Default W3-07 v1 should keep sample rows non-interactive and provider `canNavigateInternal=false`.

If child activation is implemented, it must:

- be separately proven through existing source-owned navigation/focus authority;
- use opaque current entry/location identities, never a filesystem path;
- not create a Folder-provider navigation stack;
- preserve Back/Forward/WorkspaceSession semantics;
- have keyboard/focus behavior covered in real browser tests.

If that seam is not already safely consumable, defer child activation rather than inventing it.

---

# 14. Deterministic backend tests

At minimum add Rust coverage for:

## Registry / probe

- `builtin.folder` appears exactly once at reviewed priority;
- directory source compatible;
- file source unsupported;
- Zen Floating/Pinned supported;
- W4 hosts fail closed;
- `reads_content=false`.

## Payload bounds

- strict FolderSummaryPayloadV1 version/shape;
- empty folder;
- small mixed folder;
- long/unicode/special-character names;
- extension bucket bound;
- sample bound;
- largest bound;
- project-hint bound;
- encoded summary <= 256 KiB;
- counts/sizes cannot overflow serialized integer contract.

## Scale

Real generated fixtures where feasible:

- 1k direct children;
- 10k direct children;
- 100k direct children;
- >100k or a deterministic adapter fixture that proves entry-limit Partial without allocating an unbounded vector.

Prove:

- first Partial publication occurs before final enumeration;
- progressive update count <= reviewed max;
- publication sequence strictly increases;
- 100k path keeps aggregation/representation bounded;
- no child-name/ID vector grows with directory size.

## Browse isolation

Using deterministic barriers/channels:

- visible Browse enumeration remains current while Folder Preview uses a separate temporary Browse session;
- visible page refs remain valid;
- Preview cleanup does not dispose visible Browse session;
- temporary session/page refs return to baseline.

## Scheduler

With a test-owned scheduler capacity:

- one Folder enumeration owns the reviewed io/open-handle resources;
- waiting acquisition is cancellable;
- capacity is respected;
- success/failure/cancel/stale/deadline releases the lease;
- no second queue/semaphore exists.

## Lifecycle

- Folder A publishes Partial -> switch B -> late A page/update rejected;
- cancel after first Partial stops further publications;
- dispose after first Partial stops and cleans temporary Browse state;
- deadline guard returns a truthful final `Partial` before the outer Preview load timeout;
- Complete only after authoritative end-of-directory;
- provider fallback does not leave temporary Browse sessions or scheduler leases.

No sleep-based correctness tests.

---

# 15. Frontend tests

Add focused tests proving:

- `folder_summary` enters normal content phase;
- strict payload decoder accepts valid v1 and rejects unknown version/fields/oversized arrays/strings;
- Partial status/progress is visibly disclosed;
- newer progressive snapshot replaces older same-source sequence content;
- stale source A summary cannot replace source B;
- 100k backend counts do not create a 100k-node DOM;
- all child names are inert text;
- no raw path is rendered;
- Floating/Pinned share one renderer;
- ordinary re-render does not create duplicate provider/source requests;
- compact Context remains one focus/modal owner.

---

# 16. Real-browser W3-07 gate

Add:

```text
npm run test:browser:w3-07:real
```

Run exact-head at:

- `1600×900`;
- `980×680`.

Cover at minimum:

- Library folder Floating;
- Library folder Floating -> Pinned;
- Browse folder Floating/Pinned;
- empty folder;
- mixed folder child sample;
- progressive first Partial -> later update/final;
- 1k summary fixture;
- 10k summary fixture;
- 100k bounded summary fixture (browser fixture may use backend-truth mock counts; real enumeration scale remains Rust/performance-test owned);
- source-follow;
- bounded Previous/Next sibling navigation remains W3-03-owned;
- rapid Folder A -> B latest-wins with no stale summary flash;
- no-source;
- Unpin;
- compact single Context/focus owner;
- one Preview host;
- no page-level horizontal overflow;
- no console/page errors.

Monitor navigation/resource access:

- no HTTP(S) request caused by Folder data;
- no `file:` navigation;
- no data/blob/resource URL needed for Folder summary;
- no hidden path in link targets or DOM navigation attributes.

Browser mocks validate renderer/host/progressive integration; real 1k/10k/100k enumeration/resource guarantees remain Rust/performance-test-owned.

---

# 17. Performance evidence

Preserve all W0/W2/W3 thresholds.

Required Folder evidence:

- 1k direct-child fixture;
- 10k direct-child fixture;
- 100k direct-child fixture;
- shell remains host-first;
- first useful FolderSummary appears before full 100k traversal;
- bounded progressive update count;
- bounded temporary Browse refs/pages;
- WorkScheduler lease returns to baseline;
- repeated Folder Preview cycles reach resource steady state;
- 100-entry rapid switching remains bounded and latest-wins.

Do not claim a latency TARGET PASS without the reviewed performance harness/fixture.

Do not weaken:

- Query V2 100k/1M thresholds;
- W2 100k Library/Browse thresholds;
- BrowseService existing page/raw-scan/session/ref limits;
- Preview shell target;
- existing scheduler/thumbnail/read-gate gates.

If 100k full direct-child completion does not fit the current Preview provider deadline, the accepted v1 behavior is a useful bounded progressive representation that returns an honest deadline-limited `Partial` before timeout. Do not widen global deadlines merely to turn that fixture Complete.

---

# 18. Expected implementation areas

Likely production scope:

- one Folder provider module under `src-tauri/src/file_workspace/`;
- one strict FolderSummary payload module/codec if useful;
- existing `preview_providers.rs` / `preview_policy.rs` composition;
- existing `PreviewProviderEnvironment` only for a narrow Folder enumeration dependency;
- existing integration Preview/source-resolution boundary for the smallest backend-only Folder enumeration adapter;
- existing `BrowseService` only — no replacement enumerator;
- existing `scheduler.rs` only for a minimal Folder resource adapter if needed;
- `src/api/previewPayloadWire.ts` or an equivalent shared strict payload decoder;
- shared `PreviewContent.tsx` FolderSummary renderer;
- shared preview styles/i18n;
- deterministic Rust/frontend/browser/performance tests;
- `package.json` + W3-07 real-browser gate.

Do not modify current-truth `STATUS.md`, `ROADMAP.md`, W3 initiative closeout records or frozen W3 specs inside the implementation PR.

---

# 19. Stop / architecture-review conditions

STOP and report instead of implementing if W3-07 appears to require:

- renderer-visible filesystem paths;
- provider-owned `std::fs::read_dir` / walkdir traversal independent of BrowseService;
- recursive subtree scan as a product requirement;
- a second BrowseService or Query engine;
- a durable Folder Preview index/cache/database/schema migration;
- materializing `all_matching` or the full Library selection;
- reusing/superseding the user's visible Browse active enumeration;
- a new generic Tauri directory-listing command;
- renderer-issued directory/read leases;
- a second WorkScheduler/semaphore/thread pool;
- implicit cloud/provider hydration;
- Git CLI/process execution or project dependency lookup;
- W3-08 archive parsing;
- W3-09 integration scope;
- W4 Finder/Explorer system host work;
- supported-platform or mutation/recovery ownership change.

If the existing `FolderSummary` outer representation or progressive publication contract is fundamentally insufficient for truthful behavior, stop for contract/ADR review rather than silently widening authority.

---

# 20. Validation

Run focused Folder provider/payload/Browse-isolation/scheduler/progressive tests first.

Then at minimum:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-07:real
npm run test:governance

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

npm run security:audit
npm run security:audit:rust

git diff --check
git diff --check origin/master...HEAD
```

Run all additional CI-selected Windows/macOS release, native, dependency, package and performance lanes applicable to the final scope.

Clean task-owned temporary artifacts and leave the worktree clean.

---

# 21. PR / evidence contract

Implement directly on the existing branch:

```text
feat/w3-07-folder-preview
```

Do not create another implementation branch.

When implementation/local validation is complete:

1. commit normally;
2. no force push;
3. push this existing branch;
4. create exactly one **Draft PR** against `master`;
5. keep it `OPEN / DRAFT / UNMERGED`;
6. obtain fresh exact-head hosted CI;
7. report final HEAD/tree and source/integration checkout evidence;
8. report exact changed files;
9. report provider ID/priority/capability truth;
10. report the exact `FolderSummaryPayloadV1` schema and decoder limits;
11. report direct-child/sample/extension/largest/project/payload/publication bounds;
12. report first-useful and progressive publication evidence;
13. report existing `PreviewPublicationSink` reuse and monotonic/stale rejection evidence;
14. report the exact Folder enumeration adapter and prove the provider never receives a raw path;
15. prove the adapter reuses the existing `BrowseService` rather than a second `read_dir`/query engine;
16. prove visible Browse enumeration isolation;
17. report temporary Browse session/page/ref resource cleanup;
18. report WorkScheduler io/open-handle admission and release evidence;
19. report 1k/10k/100k scale evidence;
20. report deadline guard / Partial truth evidence;
21. report stale switch/cancel/close/dispose cleanup;
22. report Floating/Pinned/browser evidence;
23. report audits;
24. classify native/manual/provider fixture evidence honestly as PASS / DEFERRED / UNVERIFIED.

Do not Ready.
Do not merge.
Do not start W3-08+.
Do not perform current-truth closeout inside the implementation PR.

Return implementation evidence only after the Draft PR exists.
