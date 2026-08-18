# W2-02 — Shared Presentation Entry / Collection Contracts

Status: current pre-code architecture handoff — production implementation blocked
until R1, R2, R3 and the final W1-to-W2 consumer-contract verification are
complete.

Current master baseline for this handoff:
master@b787642ee98d46a229fd3624a2aaed1b66f4d4ab (post-W2-01 current-truth
closeout, PR #91). This document is a documentation/governance contract. It
does not authorize production edits on its own.

Current project progress is owned by STATUS.md and ROADMAP.md. This file is the
single current W2-02 taskbook; the obsolete W2-02 pre-code release addendum was
removed rather than retained as a second override layer.

## 1. Current decision

W2-01 Workspace Shell + Experience Controller is merged. A pre-code review found
three bounded consumer-boundary gaps in the W1-to-W2 handoff:

1. the production frontend has no truthful producer for the Browse thumbnail
   source generation required by the current W1 request validator;
2. the public LocationDescriptor projection is not itself an actionable Browse
   admission/navigation input;
3. CI records the pull-request head for diff classification and evidence labels,
   but checkout steps do not explicitly pin the pull-request head.

Therefore W2 production is temporarily blocked for the following bounded
remediation sequence:

~~~text
W2-01 merged
  -> R1 CI evidence / governance hardening
  -> R2 thumbnail consumability remediation
  -> R3 location consumability remediation
  -> final W1-to-W2 consumer-contract verification
  -> W2-02 shared presentation entry / collection contracts
~~~

R2 and R3 may be investigated in parallel only if their review proves that
parallel work cannot alter a shared authority or obscure the final consumer
verification. The production gate remains sequential.

W2-02 production must not begin while any preceding item is BLOCKED,
UNVERIFIED at a required seam, or missing exact-head evidence.

## 2. Narrow W2-02 scope

W2-02 defines the smallest source-discriminated presentation and collection
contract that later List, Grid and Context work can consume.

In scope:

- source-discriminated Library and Browse presentation-entry projections;
- injective render identity that is not an authority;
- truthful metadata, capability and materialization projection;
- a separate collection/source context for query or enumeration completeness;
- source-specific operation, navigation and thumbnail references as opaque
  handles;
- pure or nearly pure adapters and contract-level facades;
- structural 100k/all-matching evidence without a second 100k model;
- explicit handoff conditions for W2-03 and W2-04.

Out of scope:

- W2-03 Library migration or mode UI;
- W2-04 Browse navigation, source owner or content implementation;
- shared List, Grid or Context UI;
- a new Zustand store, context-owned selection database or singleton registry;
- a generic cross-source selection authority;
- Query V3 or a second Query V2 authority;
- persistence, schema, Rust, Tauri commands, permissions or events;
- thumbnail scheduling/cache changes;
- location admission changes;
- filesystem path resolution or mutation;
- W3 Preview providers/hosts;
- any visual redesign or W2-01 shell/virtualizer rewrite.

If any out-of-scope item is required to make the contract compile, stop and
report the architecture mismatch.

## 3. Authority and compatibility rules

The durable and runtime authorities remain unchanged:

- managed Library query truth is File Library Query V2;
- cross-page managed selection is LibrarySelectionV1 plus backend resolution;
- Browse session, enumeration, entry and path lifetime are W1 Browse authority;
- Read Gate owns byte-read eligibility;
- thumbnail/cache authority remains W1;
- location admission and platform evidence remain backend-owned;
- WorkspaceSession owns navigation history and live presentation state;
- W2-01 compatibility code may translate into these authorities but is not a
  new authority.

The W2-01 embedded Vault/legacy controls are accepted compatibility debt. They
must not be removed opportunistically in W2-02. The exit conditions are
recorded in TECH_DEBT.md: W2-03/W2-08 migration and convergence, no production
caller, behavior coverage, and real browser/layout proof with Query V2 intact.

## 4. Required shared contract shape

Use a discriminated union, not one flat object with optional Library and Browse
authority fields. The semantic shape is:

~~~text
PresentationEntry =
  LibraryPresentationEntry
  | BrowsePresentationEntry
~~~

The Library branch may carry:

- FileLibrarySummary-derived display metadata;
- managed file ID / managed EntryRef;
- the exact Query V2 collection context required for truthful selection
  membership.

The Browse branch may carry:

- ephemeral Browse EntryRef;
- the complete Browse enumeration reference;
- an optional source-specific BrowsePathRef paired with its Browse session;
- displayPath only as presentation metadata;
- unknown-safe metadata/materialization/capability values.

FileLibrarySummary is the primary managed adapter input. FileRecord and
displayDirectory remain legacy/presentation compatibility data; displayDirectory
is never filesystem resolution truth.

Presentation keys must be injective for arbitrary opaque IDs. They are render
identity only and must not be accepted as raw paths, resolver inputs, operation
identity, history identity, thumbnail cache identity or durable identity.
Adversarial separator-containing IDs are required in the eventual contract
tests.

## 5. Collection and selection contract

Entry truth and collection truth are separate.

Library collection context must preserve the Query V2 identity needed by later
owners, including queryFingerprint and snapshotRevision or an equivalent proven
source context. It must not copy the full query/selection model into every row.

Browse collection context must preserve:

- sessionId;
- requestId;
- enumerationId;
- partial or complete state;
- knownCount only when the source supplies it.

Rendering one page never proves that the Browse collection is complete.

Library all_matching membership is valid only for an entry from the exact active
Query V2 collection. A context-free isSelected(fileId), selectionContainsFileId
or equivalent helper is not a cross-source contract. Fingerprint or snapshot
mismatch must fail closed. Membership must not enumerate unseen Query V2 rows.

W2-02 may describe component-facing selection intents, but source owners retain
membership, ordering, anchor, range and select-all semantics. Browse must not
claim unseen/all-matching selection before W2-04. No shared runtime selection
store is allowed.

Virtualization and mounted rows are projections. They never redefine collection
membership or selection truth.

## 6. Thumbnail and location boundaries

W2-02 must not manufacture ThumbnailRequest.sourceGeneration. BrowsePage
enumerationId is an enumeration publication identity; it is not
automatically the W1 thumbnail sourceGeneration. If a proven generation is not
available, preserve the opaque ephemeral EntryRef and session identity and leave
generation absent/unknown. R2 owns the safe producer/consumer decision.

W2-02 must not treat LocationDescriptor as an actionable Browse target. The
current descriptor is a non-authoritative projection with an opaque LocationRef
and capability state; browseOpen separately requires backend-owned routingHint.
No renderer path recovery, display-name resolution, scan-root-to-path mapping,
or generic resolve-any-path seam is permitted. R3 owns the safe admission and
navigation decision.

WorkspaceRestoreLocator remains non-authoritative restore metadata. Restore must
obtain fresh backend references; it is not a durable LocationRef or BrowsePathRef.

## 7. Pre-code audit record

The following audit is evidence for the gate, not permission to fix production
code in W2-02.

### A. Thumbnail source-generation audit

Relevant surfaces:

- src/types/fileWorkspace.ts: ThumbnailRequest has optional sourceGeneration;
- src/api/fileWorkspaceApi.ts and src/fileWorkspace/fileWorkspaceController.ts:
  the API boundary exists, but no production UI source constructs a truthful
  Browse thumbnail request;
- src-tauri/src/file_workspace/thumbnail/service.rs: an ephemeral request is
  rejected when sourceGeneration is absent, and Read Gate/source-version checks
  remain authoritative;
- integration/tests.rs and performance/steady_state.rs copy a page
  enumerationId into source_generation for test/performance coverage.

Finding: no production frontend producer currently proves the required
sourceGeneration contract. The Rust/test copy is not evidence that enumerationId
and sourceGeneration are equivalent. This is BLOCKED for W2 consumers and is
the R2 input. Do not copy, guess or fabricate the value in W2-02.

### B. Location actionability audit

Relevant surfaces:

- src/types/fileWorkspace.ts: LocationDescriptor contains opaque ref, display
  and capability projection; BrowseOpenRequest separately requires routingHint;
- src-tauri/src/file_workspace/location.rs: projection is fail-closed and does
  not probe or mutate paths;
- src-tauri/src/file_workspace/integration/browse.rs: open/restore resolves
  routingHint through backend authority and deliberately does not infer
  capability evidence from directory admission;
- location_list returns descriptors but no generic descriptor-to-admission
  action.

Finding: a future W2 navigation component cannot act on the current
LocationDescriptor alone. It must not recover a path from displayPath/displayName,
map a LocationRef to a renderer path, or invent a generic resolver. This is
BLOCKED for W2 consumers and is the R3 input.

### C. Query V2 selection audit

Relevant surfaces:

- useFileLibraryV2Store owns LibrarySelectionV1-shaped state;
- its generic isSelected(fileId), selectedLoadedIds and
  selectionContainsFileId helpers do not accept exact queryFingerprint and
  snapshotRevision context;
- no production caller of the store isSelected(fileId) method was found;
- VaultView uses context-free helpers over current rendered Query V2 rows, while
  the query controller normally clears selection on query changes;
- OrganizeSuggestionsView carries explicit query fingerprint/snapshot context.

Finding: the current direct isSelected method has no production caller, but the
context-free helpers are unsafe as a future cross-source contract: an arbitrary
non-excluded ID can appear selected under all_matching without proof that it is
in the exact active collection. This is a R0 review finding only. Do not modify
selection runtime in R0; the eventual contract must fail closed on context
mismatch and preserve compact all_matching semantics.

### D. Browse identity and lifetime audit

Relevant surfaces:

- TypeScript and Rust BrowsePage carry sessionId, requestId and enumerationId;
- BrowseEntry carries a source-tagged EntryRef and optional BrowsePathRef;
- BrowseService rejects stale pages/entries after re-enumeration and invalidates
  old enumeration-owned entries;
- FileWorkspaceController retains page batches until enumeration supersede,
  target teardown or session disposal, and pairs history path retention by
  browse session;
- WorkspaceSession compares Browse targets by session/location/path identity and
  serializes only non-authoritative restore metadata.

Finding: current W1 lifetime handling is session-scoped and stale-safe. The risk
is at the future shared boundary: BrowsePathRef is only an opaque ID and a broad
EntryRef can be accidentally narrowed or retained without its session and full
enumeration context. W2 consumers must preserve the full triple, keep path refs
source-specific and session-paired, and discard page/entry projections when a
new enumeration supersedes them. Do not use a presentation key as a ref.

### E. CI evidence audit

Relevant surfaces:

- .github/workflows/ci.yml and ci-full.yml use actions/checkout with no explicit
  ref in pull-request jobs, so the default pull-request merge ref is checked
  out;
- change-scope passes PR_BASE and PR_HEAD to classifyCiChanges.mjs, which
  calculates diff_base and diff_head from those values;
- W201_SOURCE_HEAD is populated from pull_request.head.sha or github.sha and is
  written into browser artifacts, but it does not change the checked-out tree;
- existing CI contract tests cover routing, action pins, W2-01 gate labels and
  performance sharding, but do not prove every consumer runs on the exact PR
  head.

Finding: diff/evidence metadata and checked-out source are not one proven exact
head contract. R1 must define and test the safe checkout/diff/evidence policy,
including PR and push behavior, without weakening full-validation or routing
coverage.

## 8. Required follow-on gates

### R1 before W2-02

R1 must close the CI evidence/governance contract, add focused contract coverage,
and bind any final evidence to the exact validated commit. It must not treat
metadata labels as source checkout proof.

### R2 before W2-02

R2 must establish a truthful, backend-authorized Browse thumbnail consumability
seam or explicitly simplify the contract if a review proves that safe. It must
cover success, stale enumeration, cross-session mismatch, missing/unknown
generation and Read Gate/source-version revalidation. It must not alter
thumbnail authority or fabricate generation from enumeration identity.

### R3 before W2-02

R3 must establish a backend-authorized LocationDescriptor-to-navigation/admission
seam, or explicitly document why the public contract must remain non-actionable
until a later source owner. It must preserve fail-closed capability evidence,
fresh Browse refs, supported Windows/macOS behavior and restore separation. It
must not expose raw paths or create a second filesystem authority.

### Final W1-to-W2 verification

After R1/R2/R3, review the actual public producers and consumers again:

- ThumbnailRequest source identity and generation;
- LocationDescriptor/admission/navigation;
- Query V2 exact collection-bound selection membership;
- full Browse enumeration/path lifetime;
- CI checkout, diff head, W201_SOURCE_HEAD and exact-head evidence.

This verification must be tied to the current master descendant and must report
HARD PASS, OBSERVED, UNVERIFIED, DEFERRED or BLOCKED honestly.

## 9. Implementation and test boundary after the gates

Only after all gates pass may W2-02 production work begin, and then only as
pure/near-pure types, adapters and contract facades. The implementation must:

- preserve W2-01 behavior and its real Chromium regression gate;
- add focused identity, metadata, collection, selection-context and source
  separation tests;
- keep 100k evidence structural and compact;
- avoid new runtime state or filesystem/provider probing;
- run the applicable frontend, remediation, performance-architecture,
  documentation/governance and build checks;
- report exact commit evidence and clean task-owned artifacts.

W2-03 and W2-04 remain separately gated. W2-05, W2-06 and W2-07 remain behind
both source-owner work and the stabilized shared contract.

## 10. Closeout classification

This R0 handoff is complete only when the documentation graph and current truth
are consistent, the obsolete addendum is deleted, R1/R2/R3 taskbooks exist,
the W2-01 debt item has explicit exit conditions, governance/docs checks pass,
PR #92 remains Draft, and the docs-only commit is pushed to the existing branch.

No W2-02 production implementation, thumbnail remediation, location remediation,
R1 execution or W2-03/W2-04 work is part of this handoff.
