# W3 — Preview Platform Implementation Plan

Status: reviewed implementation plan — activation candidate

Activation baseline: `master@7d139bed18c54c892b6bbe7daf00e609ac23bdd1`

Initiative:
[`../../initiatives/W3-preview-platform.md`](../../initiatives/W3-preview-platform.md)

Experience freeze:
[`10-W3-PREVIEW-EXPERIENCE-FREEZE.md`](10-W3-PREVIEW-EXPERIENCE-FREEZE.md)

W3 consumes the completed W1 Preview Core/Read Gate/WorkScheduler and the completed W2 File Library workspace. It does not replace those authorities and does not include W4 Finder/Explorer system integration.

## 1. Starting architecture truth

The W3 starting point is deliberately asymmetric:

### Already implemented and authoritative

- Rust `PreviewSession` lifecycle and stale-publication protection;
- `PreviewSourceRef`, `PreviewSourceSnapshot`, `sourceVersion`;
- Provider Registry contracts, provider priority/probe/prepare/load/cleanup;
- provider-local versus source/session-terminal fallback taxonomy;
- host/provider/source capability intersection primitive;
- `PreviewRepresentation` families and completeness/warnings;
- opaque `ContentReadLeaseRef` consumer boundary;
- MaterializationReadGate integration;
- WorkScheduler-backed Preview execution;
- bounded process-local Preview session registry;
- main-window-only Tauri lifecycle commands;
- TypeScript lifecycle request/snapshot API;
- W2 Library/Browse presentation and source identity projections.

### Intentionally not yet W3-ready

- production Preview Provider Registry is empty;
- host/source capabilities are still metadata-fallback-clamped;
- TypeScript representation union models only Metadata;
- no user-facing frontend consumes `fileWorkspaceApi.preview*`;
- no shared Zen Floating/Pinned Preview host exists;
- W2 Library still uses preview-specific Vault compatibility UI;
- Browse has no Quick Preview host;
- progressive multi-publication semantics for Folder Preview are not proven;
- no renderer-callable user materialization action exists.

These are not W1/W2 defects. They are the exact consumer-readiness work W3 is authorized to complete.

## 2. Non-negotiable invariants

1. Preview Core remains backend-owned session/provider/publication authority.
2. Query V2 / `LibrarySelectionV1` remain managed Library authority.
3. BrowseService remains ephemeral Browse identity/lifetime authority.
4. WorkspaceSession remains File Library navigation/presentation context owner.
5. No renderer-authoritative raw filesystem path is added to Preview.
6. No general renderer byte-read command or reusable content lease is added.
7. Every byte-reading provider uses the existing authoritative read/materialization gate and revalidation boundary.
8. Materialization is never implicit.
9. WorkScheduler remains global resource admission authority.
10. Provider and Host stay separate concerns.
11. W3 provider failure cannot destroy the File Library workspace or Preview shell.
12. W3 cannot weaken Query V2/W2 scale/performance gates.
13. W3 cannot add third-party plugin loading.
14. W3 cannot pull Finder/Explorer native system-host integration from W4.
15. Legacy preview compatibility cannot become a second Preview authority.

## 3. Dependency graph

```text
W3-00  Activation + Architecture/Experience Freeze
  ↓
W3-01  Preview Core Consumer-Readiness
       - provider registry factory
       - truthful host/source capability matrices
       - exhaustive Rust/TS representation wire
       - progressive publication contract
       - lifecycle/error event/snapshot semantics as needed
  ↓
W3-02  Zen Floating Quick Preview Host
       - PreviewExperienceController
       - Space/Esc command context
       - shell-first UI
       - Library + Browse source mapping
       - Metadata fallback
       - representation renderers
  ↓
 ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ↓                           ↓                           ↓                           ↓
W3-03 Pinned Preview +       W3-04 Text/Code +           W3-05 Structured +          W3-06 Image
      sibling navigation           Markdown                    Table providers             provider
 └───────────────┬───────────┴───────────────┬───────────┴───────────────┬───────────┘
                 │                           │                           │
                 └───────────────────────────┴───────────────────────────┘
                                   ↓
                         ┌─────────┴─────────┐
                         ↓                   ↓
                    W3-07 Folder        W3-08 ZIP
                    Preview provider     Archive provider
                         └─────────┬─────────┘
                                   ↓
W3-09  Failure / Materialization / Security / Accessibility Integration
  ↓
W3-10  Preview Performance + Cross-platform QA
  ↓
W3-11  W3 Closeout
```

W3-03 through W3-08 may execute in parallel only after the contract/host seams they consume are merged and independently reviewed. Parallel provider Tracks must not each invent their own read, cache, asset, cancellation or representation infrastructure.

## 4. W3-00 — Activation and freeze

Docs/governance only.

Owns:

- initiative activation;
- current-truth transition from between-initiatives to W3 active;
- architecture consumer-readiness audit;
- dependency graph;
- Quick Preview experience freeze;
- explicit W3/W4 boundary;
- initial risk/deferred ledger.

No production code is changed in W3-00.

## 5. W3-01 — Preview Core Consumer-Readiness

This is the mandatory first production Track.

### 5.1 Provider Registry production composition

Replace the W1 integration's intentionally empty registry with one bounded composition owner/factory suitable for later built-in providers.

At W3-01 closeout, the registry may still contain only Metadata/no rich provider if that keeps the Track focused. The important requirement is that later provider Tracks register through one reviewed composition seam rather than modifying session orchestration independently.

No runtime plugin discovery or arbitrary dynamic loading.

### 5.2 Host capability matrices

W1 currently creates Zen Preview hosts with metadata-fallback capabilities. W3-01 defines explicit host capability matrices for at least:

- `zen_floating`;
- `zen_pinned`.

Capabilities must reflect what the host can actually render/control, not what a filename suggests.

W4 native host kinds remain architecture-ready but are not activated here.

### 5.3 Source capabilities

The current resolver publishes metadata-fallback source capabilities. W3-01 replaces that clamp with a truthful source capability projection derived from source kind, entry kind, read/materialization state and backend-known facts.

Do not infer byte eligibility merely from extension.

Source capabilities must still intersect with Provider and Host capabilities.

### 5.4 Exhaustive representation wire

Rust supports:

- Metadata;
- Text;
- SafeHTML;
- StructuredTree;
- Table;
- Image;
- Media;
- FolderSummary;
- ArchiveTree;
- NativeOpaque.

TypeScript currently accepts only Metadata. W3-01 makes the serialized representation contract exhaustive/discriminated and adds strict round-trip/unknown-field tests.

Host-neutral representations must not carry raw filesystem paths.

Asset-bearing representation families use bounded opaque asset/content tokens or another reviewed safe transport; they do not call `convertFileSrc` on backend-private source paths.

### 5.5 Progressive publication

`PreviewCompleteness::Partial` alone is not sufficient evidence of progressive Folder Preview if a session can only publish one final provider result.

W3-01 must explicitly choose and test one bounded mechanism, for example:

- provider-to-session publication callback/channel bound to current request/source version; or
- a provider-owned bounded update stream consumed by PreviewSession.

Requirements:

- session/request/sourceVersion checks on every publication;
- monotonic or explicitly versioned representation updates;
- cancellation removes publication rights immediately;
- late partial/final updates from source A cannot publish after switch to B;
- provider cleanup closes the update source;
- no unbounded queue;
- Metadata fallback remains available if progressive provider fails.

Do not implement progressive Folder analytics by polling the filesystem directly from React.

### 5.6 Lifecycle transport

The existing `previewStart()` may continue to use a blocking worker behind Tauri `spawn_blocking` if cancellation remains independently callable and shell-first UI does not await the result. If richer progressive publication requires events or snapshot polling, W3-01 must choose one explicit bounded transport and prove stale/cancel/dispose semantics.

Do not add a generic event bus.

## 6. W3-02 — Zen Floating Quick Preview Host

### Goal

Deliver the first real user-facing Quick Preview experience while still relying only on Metadata fallback if no rich provider is merged yet.

### Required behavior

- Space opens/toggles Floating Quick Preview only when command context permits.
- Shell is created/shown immediately; provider/source work starts afterward.
- Esc closes Floating Preview before lower-priority workspace dismissals.
- Close restores focus to the originating File Library entry/focus owner.
- While Floating Preview remains open, changing focused/active entry switches the existing Preview experience to the new source without destroying/recreating the outer shell.
- source A is cancelled/revoked before source B may publish.
- Library sources map from managed entry refs; Browse sources map from session-scoped ephemeral refs.
- multi-selection does not materialize the entire selection; Preview uses the current focused/active loaded entry.
- `all_matching` Library selection never becomes an ID list for Preview.
- unsupported/corrupt/failure states keep the shell and present Metadata fallback.
- materialization/permission/identity states are explicit and not bypassed.

### Frontend ownership

Introduce one bounded `PreviewExperienceController`/provider module rather than putting lifecycle orchestration into List/Grid/LibraryMode/BrowseMode individually.

The controller coordinates:

- current host visibility;
- current frontend request epoch;
- current source projection;
- preview lifecycle API calls;
- focus restoration;
- command-context eligibility;
- stale frontend result rejection.

It does not select backend providers or read files.

### Host UI

Floating Preview uses one stable shell with:

- compact title/identity area;
- content region;
- loading/failure/metadata state;
- close;
- Pin Preview;
- Open/Reveal only where effective capabilities permit;
- minimal metadata/footer disclosure.

Avoid turning Preview into a full document editor or toolbar-heavy media suite.

## 7. W3-03 — Pinned Preview + bounded sibling navigation

Pinned Preview is a **host presentation mode**, not a second Preview engine.

- It occupies the W2 Context Panel Preview state.
- Pinning from Floating Preview hands the current source to a `zen_pinned` host through a bounded lifecycle handoff; no raw path is transferred.
- The floating shell closes after successful handoff unless product review explicitly permits both hosts simultaneously.
- Pinned Preview follows current File Library focus/active entry while the host is open; no valid entry shows an explicit select-an-item state rather than reading an old path.
- Unpin/close returns Context Panel to Inspector behavior where selection exists.

Sibling navigation:

- receives a bounded window from the originating W2 collection/focus owner;
- never builds a second Query engine;
- never fetches/materializes all IDs for `all_matching`;
- Browse navigation is limited to loaded/currently authoritative entries and may request the owning Browse surface to advance normally;
- Next/Previous updates workspace focus/selection where W0 requires it.

## 8. W3-04 — Text/Code + Markdown providers

Provider families:

- plain text;
- source code with bounded language hinting;
- Markdown -> sanitized SafeHTML/RichText representation.

Requirements:

- bounded prefix/size strategy for large files;
- invalid UTF-8 handling;
- huge-line protection;
- no execution;
- no remote resource loading;
- Markdown HTML sanitization;
- no filesystem-relative asset fetching by the renderer;
- search/text-selection capabilities only when Host ∩ Provider ∩ Source allows them.

A syntax-highlighting library is an implementation detail and must not become file authority or an unbounded worker pool.

## 9. W3-05 — Structured + Table providers

Structured providers:

- JSON;
- YAML;
- XML.

Table providers:

- CSV;
- TSV.

Requirements:

- bounded parse/input sizes;
- hostile/malformed fixtures;
- no XML external entity/network fetch;
- no formula execution;
- representation stays read-only;
- large tables use bounded rows/columns or progressive windowing rather than returning an unbounded giant serialized string;
- structured tree/table representation contracts carry explicit truncation/completeness facts.

## 10. W3-06 — Image provider

The Image provider must not turn a source path into a WebView URL.

Use a bounded backend-owned asset transport compatible with the representation contract. Reuse Thumbnail infrastructure for placeholder/warm display where appropriate, but do not pretend a thumbnail is the full image representation.

Requirements:

- sourceVersion-bound asset identity;
- bounded decode/resource slots through WorkScheduler;
- zoom capability only when host/provider/source all support it;
- corrupt/oversized/decode-timeout fallback;
- cancel/close releases decoder/file/native resources;
- no implicit hydration.

## 11. W3-07 — Folder Preview provider

Folder Preview is a bounded summary, not an implicit recursive scan.

Immediate useful representation should include only cheap bounded facts such as:

- folder identity/name;
- first bounded child sample/count progress;
- visible type distribution sample;
- known/partial completeness state.

Optional progressive enrichment may add:

- total child count where obtainable safely;
- bounded total-size progress;
- largest-item candidates;
- project hints.

Requirements:

- 1k/10k/100k fixtures;
- shell never waits for full traversal;
- every enrichment turn is cancellable/budgeted;
- no hidden cloud hydration;
- Git/project detection is advisory and not a shell prerequisite;
- truthfully Partial until complete.

## 12. W3-08 — ZIP Archive provider

ZIP preview indexes archive metadata; it does not silently extract.

Requirements:

- bounded central-directory/index parsing;
- corrupt/truncated/bomb-like hostile fixtures;
- limits on entry count/name/metadata serialization;
- no automatic extraction;
- no nested unbounded archive recursion;
- no arbitrary path traversal from archive names;
- cancel/timeout/cleanup;
- ArchiveTree representation with explicit completeness/truncation.

Other archive formats are not automatically in scope.

## 13. W3-09 — Failure, materialization, security and accessibility integration

This Track converges behavior after the host/provider Tracks.

### Failure matrix

Provider-local recoverable:

- unsupported;
- provider_failed;
- timeout;
- corrupt_source.

These may try the next compatible provider and eventually Metadata fallback.

Terminal source/session:

- source_unavailable;
- materialization_required;
- permission_denied;
- identity_changed;
- cancelled.

These cannot be bypassed by another byte-reading provider.

### Materialization

`materialization_required` is an explicit Preview state.

A user action such as `Download to Preview` is shown only if:

1. effective capability says request materialization is supported; and
2. an authoritative user-initiated materialization action exists and has been separately reviewed.

If that authority is absent, W3 shows the state and does not fabricate an action.

After any authorized materialization:

- re-resolve source;
- get a new sourceVersion;
- reacquire read eligibility/content access;
- then retry provider load.

### Security

- sanitized HTML/Markdown;
- no macro/code execution;
- no implicit network resources;
- no third-party plugin loading;
- no arbitrary raw paths;
- no implicit AI/content-understanding artifacts;
- no silent archive extraction;
- host output treats provider representation as data, not trusted executable markup.

### Accessibility / keyboard

- Space respects text input, rename/edit, IME composition, menus/dialogs and invalid selection;
- Esc ownership is deterministic;
- open/close/pin/navigation controls are keyboard accessible;
- close restores focus to originating workspace entry;
- screen-reader naming/status semantics are provided;
- native VoiceOver/Narrator manual evidence remains separately classified when not executed.

## 14. W3-10 — Performance / cross-platform QA

Required W0 gates:

### Timing

- Preview shell <= 100 ms p95 TARGET;
- local built-in text/JSON/Markdown/image useful representation <= 300 ms p95 TARGET;
- native/system first useful representation <= 1 s TARGET where applicable.

### Rapid switching

At least 100 entries:

- HARD no crash;
- HARD no stale/wrong-file publication;
- HARD bounded provider/request growth;
- HARD final stopped item is the only current representation.

### Cleanup

For each byte-reading provider:

`Open -> Ready -> Close -> immediately Rename / Move / Delete / Open`

Mutation/open must not be blocked by retained Preview resources.

Run repeated Preview cycles and prove resource/handle/task/observer/object-URL/native asset steady state where applicable.

### Folder

1k/10k/100k Folder Preview fixtures; 100k remains shell-first and bounded/progressive.

### Provider fixtures

Each provider needs:

- normal;
- large;
- corrupt;
- permission/unavailable;
- cancel during load;
- rapid switch away.

### Regression

Preserve:

- Query V2 accepted 100k/1M thresholds;
- W2 100k Library/Browse bounded UI behavior;
- existing thumbnail/read-gate/scheduler cancellation/resource gates;
- main/search-window permission separation.

### Platform evidence

- Windows 11 x64 hosted/runtime evidence;
- macOS 13+ Apple Silicon hosted/runtime evidence;
- real native manual/provider fixtures reported separately as PASS/UNVERIFIED, never inferred from hosted build success.

## 15. W3-11 — Closeout

Docs/governance/cleanup only unless independent review finds a production blocker, in which case closeout stops and a bounded remediation Track is created.

W3-11 records:

- final product/runtime baseline;
- final Preview release-gate matrix;
- provider/host coverage;
- residual unsupported/native/manual/provider fixture evidence;
- technical-debt status;
- branch/task artifact cleanup;
- transition to between-initiatives.

W3 closeout must not automatically activate W4.

## 16. Legacy compatibility strategy

W3 must not combine feature delivery with broad Vault retirement.

Allowed retirement is narrow:

- when Floating/Pinned Preview fully replaces one preview-specific legacy caller and focused equivalence passes, that caller may be removed in the owning W3 Track;
- broader Vault/Library compatibility remains under TD-015 and its independent exit condition.

The existing macOS Quick Look thumbnail compatibility path may remain as a Thumbnail/Inspector fallback until the owning Thumbnail/Preview replacement has proven equivalent behavior. Do not delete it merely because a new Preview Host exists.

## 17. W3 release criteria

| Criterion | Required verdict |
| --- | --- |
| W1 Preview Core remains sole lifecycle/provider publication authority | HARD PASS |
| Rust/TS representation contract is exhaustive and strict | HARD PASS |
| Host/source/provider capability intersection is truthful | HARD PASS |
| No renderer raw-path/read-lease authority | HARD PASS |
| Floating host works for Library and Browse | HARD PASS |
| Pinned host/Context integration works without second Preview engine | HARD PASS |
| Space/Esc/focus/IME ownership deterministic | HARD PASS |
| Text/Code/Markdown provider family | HARD PASS |
| JSON/YAML/XML + CSV/TSV provider families | HARD PASS |
| Image provider | HARD PASS |
| Folder provider progressive/bounded at 100k | HARD PASS |
| ZIP provider bounded/no extraction | HARD PASS |
| Fallback terminal/recoverable matrix preserved | HARD PASS |
| No implicit materialization/network/code/macro execution | HARD PASS |
| 100-entry rapid switching | HARD PASS |
| close-then-mutate resource release | HARD PASS |
| resource steady state | HARD PASS |
| W0 Preview timing targets measured | TARGET / explicit review if missed |
| W2/Query performance gates preserved | HARD PASS |
| W4 system integration not pulled forward | HARD PASS |
| native manual/provider gaps honestly classified | HARD PASS for evidence honesty |

W3-00 authorizes this dependency graph only. Any Track that requires a new durable authority, schema, supported platform or W4 native-host subsystem must stop and return to architecture review.
