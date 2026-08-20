# W2-R4 — W1-to-W2 Final Consumability Verification Result

Status: **PASS** — verification-only closeout; no production code changed.

Date: 2026-08-20

Verification baseline: `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214` (PR #98 squash merge).

Verification branch: `verify/w2-r4-final-consumability`.

Binding taskbook: [`W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-CODEX.md`](W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-CODEX.md).

## 1. Scope and preflight

R4 was executed as a verification-only gate after R1, R2 and R3 were merged.
No production code, schema, Tauri command, permission, package/release logic or
W2-02 implementation was changed. The only R4 changes are this result record and
current-truth documentation (`STATUS.md` and `ROADMAP.md`).

Merged prerequisite ancestry was verified from the R4 baseline:

- R1: `master@9224d8d6ccdbc61a36b59c6f6d0c13c57a75ef66` (PR #94) is an ancestor;
- R2: `master@c3ee881c2580b1bfe2268e0c0e907e10b1949eb8` (PR #96) is an ancestor;
- R3: `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214` (PR #98) is the verification baseline.

The verification question was applied literally: given only public producer
output and a public consumer request, can a real W2 caller construct a
backend-accepted request while preserving the owning authority, source lifetime
and fail-closed semantics? A type existing in isolation, mock-only behavior or a
renderer-fabricated hidden field was not accepted as evidence.

## 2. Consumer seam matrix

| Seam | Public producer | Public consumer/request | Owning authority | Lifetime identity | Native/browser evidence | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| Browse identity/lifetime | `BrowseOpenResponse`, `BrowsePage` | enumerate/next/cancel/release/retain/dispose using opaque session/path/page refs | `BrowseService` | session + request + enumeration; page-owned entry/path refs | R2 focused coverage; R3 CI #758; closeout CI #760; browser integration coverage | **HARD PASS** |
| Thumbnail | managed file id or `BrowseEntry.ref` | `ThumbnailRequest` with `EntryRef`; no renderer generation field | DB / `BrowseService` resolve source identity; `ThumbnailService` owns generation/cache/scheduler/publication | managed source revision or backend-resolved ephemeral enumeration generation | native Rust + browser/frontend lanes in CI #758/#760 | **HARD PASS** |
| Location admission/navigation | `LocationDescriptor.ref` | `LocationBrowseRequest { location }` only | managed scan-root/database authority or live `BrowseService`; fresh Browse admission | exact `LocationRef` -> fresh session/location/path refs | R3 focused native/mock tests; CI #758/#760 real-browser regression | **HARD PASS** |
| Read Gate | managed file id or live Browse entry ref projected as `PreviewSourceRef` | `ReadEligibilityRequest` and backend read-lease consumers | `MaterializationReadGate` + DB / `BrowseService` source resolver | source identity + backend source version + bounded lease | native integration coverage in accepted R2/R3 tree | **HARD PASS** |
| Preview Core | managed file id or live Browse entry ref as `PreviewSourceRef` | create/start/switch/cancel/dispose Preview requests | Preview session/resolver + Read Gate; provider registry remains W1 Core | preview session/request/source + backend source version | native/frontend integration coverage in accepted tree | **HARD PASS** for W1 Preview Core |
| Query V2 selection provenance | `FileQueryResponseV2.queryFingerprint` + `snapshotRevision` + Query V2 spec | `LibrarySelectionV1`, including compact `all_matching` | File Library Query V2 / DB selection resolution | canonical query fingerprint + snapshot revision + exclusions | Query V2 correctness/performance coverage; accepted Windows/macOS validation | **HARD PASS** |
| CI evidence | immutable PR head/integration identities and actual checkout trees | ADR-0004 required routing/aggregate checks | CI governance in ADR-0004 + repository ruleset | commit/ref identity and independently observed tree SHA | R3 CI #758 and final closeout CI #760; merged tree equivalence proved | **HARD PASS** |

No required seam is `BLOCKED`.

## 3. Browse identity and lifetime

The public Browse contract publishes opaque `sessionId`, `BrowsePathRef`,
`BrowseEntryRef`, `requestId` and `enumerationId`; a `BrowsePage` preserves the
publication triple and truthful partial/complete state. `displayPath` remains
presentation-only.

`BrowseService` remains the only ephemeral path/entry lifetime authority. Starting
a new enumeration supersedes the previous publication, cancellation and page
release revoke owned refs, retained paths are explicitly pinned, and session
disposal tears down the live authority. Stale/cancelled/superseded publication
fails closed. No renderer path or second registry is required.

Result: **HARD PASS**.

## 4. Thumbnail consumability

The public request carries an `EntryRef`, variant, work class and optional
session consistency field. It does not accept renderer-owned
`sourceGeneration`.

For managed sources the backend resolves the current source identity through the
existing File Library/database authority. For ephemeral sources it asks the live
`BrowseService` registry for the entry's owning enumeration generation. The
existing `ThumbnailService` continues to own scheduling, deduplication, cache and
publication. Browser mock behavior validates the same opaque request/lifetime
shape and does not fabricate a generation.

Result: **HARD PASS**.

## 5. Location admission/navigation

`LocationBrowseRequest` contains only an opaque `LocationRef` and rejects unknown
fields. Managed admission reuses existing scan-root/database truth and validates
identity/source/enabled/health state; ephemeral admission reuses the exact live
Browse session/location state. Successful admission creates fresh Browse refs.

Display names, provider labels, `scanRootId` and renderer-visible paths do not
become filesystem authority. Classification is not fabricated: Browse admission
can publish `kind=unknown`, `availability=available`, `canBrowse=true` while
unsupported capabilities remain false. Restore stays separate and
non-authoritative.

Result: **HARD PASS**.

## 6. Read Gate

`PreviewSourceRef` is sufficient public producer output for a consumer request.
The renderer never supplies a filesystem path or source version. Backend-only
resolution maps managed ids through the existing database authority and
ephemeral refs through `BrowseService`.

Eligibility and lease issuance re-resolve the source, compare the current
backend source version and fail closed on identity changes, unavailable content
or unsupported host-provided sources. The private resolved path never crosses
the public contract.

Result: **HARD PASS**.

## 7. Preview Core

The public Preview Core request surface consumes `PreviewSourceRef` and explicit
preview session/request identities. Managed metadata resolves through existing
File Library authority; ephemeral metadata resolves through the live
`BrowseService`; byte eligibility/source version stays behind Read Gate.

The current empty rich-provider registry and metadata fallback are W1 Preview
Core behavior, not evidence that W3 rich Preview providers exist. Identity or
availability failures are not converted into successful metadata fallback.

Result: **HARD PASS** for the W1 Core seam required by W2-02. W3 rich provider/UI
work remains deferred.

## 8. Query V2 selection provenance

`LibrarySelectionV1::all_matching` retains the exact Query V2 spec,
`queryFingerprint`, `snapshotRevision` and compact `excludedFileIds`. The backend
re-canonicalizes the query, recomputes and compares the fingerprint, requires the
selection snapshot revision to equal the current library revision, validates
scope/tag references, and fails closed on mismatch or expiry. It does not
materialize the complete all-matching result set.

The existing Library-only store has a source-local `isSelected(fileId)` helper
whose `all_matching` fast path is exclusion-based. That helper is **not** a
source-neutral/public W2 interaction contract. The reviewed W2 plan and W2-02
taskbook explicitly forbid promoting a context-free `isSelected(fileId)` facade
or shared selection runtime before the concrete Library/Browse source owners are
available. W2-02 must preserve collection provenance separately and must not
promote this helper into a cross-source contract.

This is therefore a later-track guardrail, not an R4 production blocker.

Result: **HARD PASS**.

## 9. CI evidence

ADR-0004 is accepted and continues to distinguish exact Head Validation from
Merge Integration, record actual checkout commit/tree identity, use tree equality
rather than commit equality for content-equivalence optimization, and fail closed
when required routed evidence is missing.

R3 implementation-head CI `32257747035` / #758 succeeded. Final R3 closeout CI
`32322986793` / #760 succeeded at exact head
`0954890dbe33bfbce4a0294376f87d5516562e19` on `run_attempt=2`. The exact
closeout-head tree is `87a6f180dd70e4da685e82148c385c57249316fb`.
The squash-merged R4 verification baseline
`master@ee7d31813eff3fa4adae6d71470f21ecea5e7214` has the same tree
`87a6f180dd70e4da685e82148c385c57249316fb`.

Thus the current production tree is exactly the content tree validated by #760;
commit/ref identities remain distinct and no claim is made that the squash commit
itself was the exact PR head.

Attempt 1 of #760 recorded one pre-existing Thumbnail lifecycle timing flake at
`repeated_request_cancel_cycles_return_to_steady_state`; the test blob was
unchanged from the post-PR #97 base, all R3 Location tests passed, and the same
exact-head macOS Rust/race lane passed on attempt 2. It remains historical
observed flake evidence, not an R3/R4 product regression.

Result: **HARD PASS**.

## 10. Native/browser/provider fixture matrix

| Evidence | Result |
| --- | --- |
| Windows Rust quality | **PASS** via accepted R3 hosted CI |
| Apple Silicon macOS Rust quality/race | **PASS** via accepted R3 hosted CI |
| Frontend/type/build | **PASS** via accepted R3 hosted CI |
| W2-01 real Chromium regression gate | **PASS** via CI #758 and #760 |
| Native Apple Silicon macOS performance | **PASS** via accepted hosted CI |
| Workspace Foundation performance | **PASS** via accepted hosted CI |
| Supported Windows/macOS release compile | **PASS** via accepted hosted CI |
| Real iCloud / generic File Provider | **UNVERIFIED** — fixture unavailable |
| External APFS / exFAT | **UNVERIFIED** — fixture unavailable |
| SMB / network volumes | **UNVERIFIED** — fixture unavailable |
| OneDrive / removable-drive cases without exercised real fixture | **UNVERIFIED** |
| Packaged/native W2 visual, accessibility, focus, keyboard and DPI parity beyond browser gate | **UNVERIFIED** |
| W3 rich Preview provider/UI matrix | **DEFERRED / UNVERIFIED** — outside W2-02 prerequisite scope |
| Signing, notarization and release publication | **DEFERRED / UNVERIFIED** — W5 scope |

The unavailable provider/external-volume cases remain honest evidence gaps. No
mock, compile success or ordinary local filesystem case is substituted for them.
They do not block W2-02 because the shared presentation contract is required to
preserve unknown/unavailable capability states rather than assert unsupported
provider behavior.

## 11. Maintainability and authority review

R4 found no new registry, query authority, content-read authority, scheduler,
filesystem resolver or mutation/recovery path. Existing owners remain:

- Query V2 / `LibrarySelectionV1` for managed Library truth;
- `BrowseService` for ephemeral Browse identity/path/lifetime;
- Read Gate for content eligibility/source version;
- `ThumbnailService` for thumbnail scheduler/cache/publication;
- backend Location integration over existing scan-root/Browse authority;
- Preview Core sessions/resolver over those source owners;
- `WorkspaceSession` for live navigation/history presentation state.

No maintainability blocker was found for W2-02's planned pure presentation
contract.

## 12. R4 decision

**R4 PASS.**

- Browse identity/lifetime: **HARD PASS**.
- Thumbnail consumability: **HARD PASS**.
- Location admission/navigation: **HARD PASS**.
- Read Gate: **HARD PASS**.
- Preview Core: **HARD PASS** for the W1 Core seam.
- Query V2 selection provenance: **HARD PASS**.
- CI evidence: **HARD PASS**.
- Required `BLOCKED` items: **none**.

The explicit `UNVERIFIED` and `DEFERRED` items above remain bounded to unavailable
external/native fixtures or later Waves and do not fabricate evidence.

With this verification result recorded in current-truth documentation,
**W2-02 — Shared Presentation Entry / Collection Contracts becomes
dependency-eligible. W2-02 has not started.**

R4 stops here. No W2-02, W2-03, W2-04 or other production work is included in
this verification change.
