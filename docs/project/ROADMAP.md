# Zen Canvas Roadmap

The roadmap records authorized sequencing, not a promise that every item will
ship unchanged. Production implementation still requires an active initiative
with explicit scope and acceptance gates.

Long-horizon product direction, architecture invariants and Wave boundaries are
owned by [`MASTER_DEVELOPMENT_PLAN.md`](MASTER_DEVELOPMENT_PLAN.md). This Roadmap
records current sequencing/progress and must not silently expand that plan.

## Completed

### G1 — Engineering OS

Goal: make project state, architecture ownership, technical debt, risk,
workflow and closeout rules explicit and durable.

- **G1A — Current Truth and workflow foundation:** complete; merged through PR #57.
- **G1B — Public docs and evidence convergence:** complete; merged through PR #60.

G1 does not change product runtime behavior.

### M1 — macOS Mutation Correctness Remediation V2

Status: complete — production implementation and exact-head validation landed
at `master@c802397930ce276de7902ee37d5927083f2912ed`.

### M1.1 — Provider and Portability Closeout

Status: complete — PR #63 merged as
`master@e09447dbf2da46e1b02e6da03bcb3345966f160b`.

### File Library 2.0 / Preview Platform — W0 Specification

Status: complete — PR #64 squash merged as
`master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3`.

The merged W0 architecture set starts at
[`specs/file-library-preview/00-MASTER-SPEC.md`](specs/file-library-preview/00-MASTER-SPEC.md).
It freezes Library/Browse product IA, Entry/Location/Browse identity contracts,
Preview Core/Host boundaries, Materialization/Read semantics, WorkScheduler /
Thumbnail / watcher ownership, performance gates and the W1 dependency plan.

### File Library 2.0 / Preview Platform — W1 Foundation

Status: complete — Foundation implementation, integration and F4 performance/QA
are closed through W1-12 current-truth closeout and post-closeout audit remediation.

Authority record:
[`initiatives/W1-file-library-foundation.md`](initiatives/W1-file-library-foundation.md).

Runtime baseline: `master@b4001d7c5d09686b15f74125a828b61b0e913b7f`
(PR #82 W1-11 squash merge).

Closeout/governance baseline: `master@ecde9f146e1e4e4933f6294358fe4a6523c7c0bd`
(PR #83 W1-12 squash merge).

Post-closeout evidence baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`
(PR #85).

Final independently reviewed W1-11 production head:
`70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`.

Full Validation: run `32064210757` / #678 — success.

#### F1 — Contract Spine — complete

- W1-00 — W1 governance/authorization activation.
- W1-01 — shared implementation contracts and serialization boundaries.

#### F2 — Parallel Core — complete

- W1-02 — Workspace Navigation / WorkspaceSession.
- W1-03 — Ephemeral Browse Core.
- W1-04 — Location Core / fail-closed projections.
- W1-05 — WorkScheduler and selected real heavy-authority adapters.
- W1-06 — Preview Contract Core.

#### F3 — Infrastructure — complete

- W1-07 — Materialization / Read Gate.
- W1-08 — Thumbnail Infrastructure.
- W1-09 — Ephemeral Change / Refresh.
- W1-10 — Integration Surface.

#### F4 — Foundation Release — complete

- W1-11 — scale/performance/cancellation/resource/platform evidence.
- W1-12 — closeout/current-truth convergence.

W1 completion means the **Foundation is complete**. It does not mean the File
Library 2.0 user experience, rich Preview Platform, native Finder/Explorer
integration or release program is complete.

W1-11 retained two scheduler interference observations as **TARGET MISSED**, not
HARD failures: Windows ~`2.30x` idle and Apple Silicon macOS ~`4.19x` idle versus
the 2x target. Structural Scheduler HARD gates passed. Real iCloud/File Provider,
external APFS/exFAT, SMB/network and other unavailable native/product fixtures
remain explicitly `UNVERIFIED`.

## Current

### W2 — File Library 2.0 Experience

Status: active — implementation

Authority record:
[`initiatives/W2-file-library-experience.md`](initiatives/W2-file-library-experience.md).

Planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`.

Reviewed implementation-plan baseline:
`master@e91416c83082b61a0d3042c9438d77c7b8586297` (PR #86).

Reviewed visual/interaction freeze baseline:
`master@251bab36797cde4129656f57667ed203f20415e6` (PR #87).

R0 consumer-boundary architecture/governance baseline:
`master@36ebe6fcde3174876cb2b5dcf1cf33215005e5d9` (PR #92).

R1 CI evidence/governance hardening baseline:
`master@9224d8d6ccdbc61a36b59c6f6d0c13c57a75ef66` (PR #94), with ADR-0004 accepted.

R2 Browse Identity + Thumbnail Consumability baseline:
`master@c3ee881c2580b1bfe2268e0c0e907e10b1949eb8` (PR #96).

R3 Location Consumability product baseline:
`master@ee7d31813eff3fa4adae6d71470f21ecea5e7214` (PR #98).

R4 Final Consumability Verification closeout baseline:
`master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7` (PR #99; docs/governance-only).

CI-O implementation validation and final reliability closeout are **PASS** in PR
#97 without changing the W2 product/runtime authority graph; its final gate is
**HARD PASS**. Implementation head:
`ca0a489dfdd865b00d07653d792e9bd40eacc94f`. Final validation/docs-only
successor:
`cda5329589b708167ce7a4ec2061e58be9d21e97`. PR CI `32237925011` and Full
Validation `32238526490` both concluded `success` on `run_attempt=1`; Full
Validation checked out tree `88ab527001689a7ae1beb13218d60b24aa284b94`.
The preceding implementation-head PR CI `32236844339` recorded hosted macOS
resource-trend variance and is historical, not the accepted closeout result.
No product/runtime code changed.
The accepted performance reduction evidence remains about 31.5% against the
22m30s R2 baseline, while the `<=14 min` target remains **NOT YET MET**.

R3 Location Consumability bounded implementation and architecture review are
**PASS** and squash merged through PR #98 as
`master@ee7d31813eff3fa4adae6d71470f21ecea5e7214`. The reviewed implementation
head was `1231b1ba509c2925863b799af5e9ac52c7b528e8`; hosted PR CI
`32257747035` / #758 concluded `success`. Final closeout-head CI
`32322986793` / #760 concluded `success` on `run_attempt=2` at exact head
`0954890dbe33bfbce4a0294376f87d5516562e19`. That exact closeout tree and the
R3 squash-merged product tree are both
`87a6f180dd70e4da685e82148c385c57249316fb`, preserving truthful ADR-0004
content evidence without collapsing commit identities. Real iCloud/File
Provider, external APFS/exFAT, SMB/network and other unavailable provider/platform
fixtures remain explicitly `UNVERIFIED`.

R4 W1-to-W2 Final Consumability Verification is **PASS** on exact merged R3
product baseline `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214`. The
verification is docs/governance-only and found no `BLOCKED` consumer seam across
Browse, Thumbnail, Location, Read Gate, Preview Core, Query V2 selection
provenance and CI evidence. Exact R4 closeout head
`39a70c4f549634d327da7f441ddafce9fc371d3b` passed PR CI `32325019015` / #762
on `run_attempt=1` and squash merged through PR #99 as
`master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`. The durable matrix is recorded
in [`tasks/W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-RESULT.md`](tasks/W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-RESULT.md).
No W2-02 production work was started in R4.

W2-00 authorizes production implementation of the bounded dependency graph in
[`specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`](specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md),
with visual/interaction behavior constrained by
[`specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md`](specs/file-library-preview/08-W2-VISUAL-INTERACTION-FREEZE.md).

W2-01 Workspace Shell + Experience Controller completed and squash merged through
PR #90 as `master@2c22c90f67826b255cdce2f82313aa352d61a9f3`. Its reviewed
production head was `48ce853cce5989749ddf19a3b880bc02446625ff`; the final
real-browser/CI closeout head was `08595005669d5346b974d11007f2d300e7b801fa`,
with CI #717 / `32137181033` successful. Packaged Windows/macOS visual parity
remains unverified.

R0 architecture/governance remediation completed and squash merged through PR
#92. Its reviewed docs/governance head was
`8c4568def12876a0e0c164ce77581d6a6622403e`; docs-only CI #728 /
`32158724636` succeeded. R0 changed the dependency graph/governance only and did
not change the product/runtime baseline.

R1 CI Evidence / Governance Hardening completed and squash merged through PR #94.
The independently reviewed implementation head
`cc37e7077af67039c131f219d4bd36b640d0ff76` passed CI #736 /
`32175677532`; the final ADR-accepted PR head
`7483c63f7a13598fb712e0399ed2188d02041be2` passed CI #738 /
`32177642141` before merge. ADR-0004 now owns the accepted Head Validation /
Merge Integration, tree-equivalence and fail-closed aggregate policy. R1 changed
CI/tooling/governance, not the W2 product/runtime baseline.

R2 Browse Identity + Thumbnail Consumability completed and squash merged through
PR #96 as `master@c3ee881c2580b1bfe2268e0c0e907e10b1949eb8`. Its independently
reviewed implementation head was
`07db9c298e2006a5a5fce86a3249e25b29c8d9dd`, with exact-head PR CI
`32183587403` / #742 successful. R2 made Browse page identity explicitly
session/entry-scoped and removed renderer ownership of Thumbnail
`sourceGeneration` while preserving BrowseService, ReadGate and ThumbnailService
as their existing authorities.

CI-O followed R2 as a bounded infrastructure remediation before R3. It removed
verified duplicate macOS race execution, aligned reusable performance caches to
semantic identity, added native macOS prepared-binary reuse, cached pinned
`cargo-audit 0.22.2`, and made workflow-contract assertions EOL-portable without
reducing validation. The final Full run preserved 100k/1M/10 GiB/native /
package/security gates and existing thresholds. Package/release consolidation
was retained as `DEFERRED` because strict equivalence was not proven. External
APFS fixture evidence remains `UNVERIFIED` rather than fabricated.

#### Pre-W2-02 consumer-boundary gate

The mandatory remediation/verification sequence has completed:

```text
R3 Location Consumability                 ✅ merged / PASS
  -> R4 W1-to-W2 Final Consumability Verification  ✅ PASS / merged closeout
  -> W2-02 Shared Presentation Entry / Collection Contracts  ✅ COMPLETE / PR #101
```

R3 is merged through PR #98. R4 independently verified the current public
producer/consumer seams without repairing production code and found no required
`BLOCKED` item, then merged its docs/governance closeout through PR #99. Browse
identity/lifetime, Thumbnail consumability, Location admission, Read Gate, W1
Preview Core, Query V2 selection provenance and CI evidence are all **HARD PASS**
for the W2-02 prerequisite. Real provider, external-volume and later-Wave fixture
gaps remain explicitly `UNVERIFIED` or `DEFERRED` rather than fabricated.

W2-02 was therefore dependency-eligible and subsequently completed through PR
#101 at `master@f1fd3591977142f08eac139814fecebe2e0e6d96`. All subsequent
evidence must follow accepted ADR-0004.

#### Current W2 production sequence

- **W2-01 — Workspace Shell + Experience Controller:** complete; merged through PR #90.
- **R0 — W1-to-W2 consumer-boundary architecture/governance remediation:** complete; merged through PR #92.
- **R1 — CI Evidence / Governance Hardening:** complete; merged through PR #94; ADR-0004 accepted.
- **R2 — Browse Identity + Thumbnail Consumability:** complete; merged through PR #96.
- **CI-O — Full & PR CI Latency / Redundancy Remediation:** final reliability closeout **HARD PASS** in PR #97; no product/runtime authority change. The accepted performance reduction evidence remains about 31.5% against the 22m30s R2 baseline, the hard `>=15%` gate remains PASS, and the `<=14 min` target remains NOT YET MET.
- **R3 — Location Consumability:** complete; squash merged through PR #98 as `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214` after hosted implementation CI #758 and closeout CI #760 succeeded.
- **R4 — W1-to-W2 Final Consumability Verification:** **PASS**; verification-only; docs/governance closeout merged through PR #99 as `master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`; no production repair and no `BLOCKED` seam.
- **W2-02 — Shared Presentation Entry / Collection Contracts:** **complete; squash merged through PR #101** at `master@f1fd3591977142f08eac139814fecebe2e0e6d96`.
- **W2-03 — Library Mode Adapter / Migration:** **complete; squash merged through PR #103**.
- **W2-04 — Browse Mode Navigation + Content:** **complete; squash merged through PR #104**.
- **W2-05 — Interaction Convergence + Virtualized List:** **complete; squash merged through PR #106** at `master@d480b7eaec6372efa69dbb28a05e40d4337187bd`. Final reviewed PR head `162bc0ae12f19f06db61ec3f9d7e86d466c73717` and final tree `80632c79959854b6fdba0a47f883ebd9e29377e2`; production remediation head `059a4cb12b06cdab8bb66370e5e4eab9058295d5` passed CI `32402544692`, and final-head CI `32403536086` concluded `success`.
- **W2-06 — Virtualized Grid + Thumbnail Integration:** **complete; squash merged through PR #108** as `master@3f745b9b894e161d7b1bdff95c16143c7de58124`.
- **W2-07 — Context Panel / Inspector:** **complete; squash merged through PR #109** as `master@b5e2db658ca4e32814e84150d7ee28d8054c2f9f`.
- **W2-08 / W2-09 — Search, Filter, Sort, Preferences / Platform Navigation:** **NEXT / parallel dependency-eligible** from the post-W2-07 master.
- **W2-10 — Integration, QA and Responsive Accessibility:** **blocked until W2-08 and W2-09 complete**; W2-11/W2-12 remain later gates.

Dependency graph:

```text
W2-02 ✅
   │
 ┌─┴─┐
 ↓   ↓
W2-03 ✅
W2-04 ✅
 └─┬─┘
   ↓
W2-05  ✅ COMPLETE / PR #106
   │
 ┌─┴─┐
 ↓   ↓
W2-06  ✅ COMPLETE / PR #108
W2-07  ✅ COMPLETE / PR #109
 └──────┬──────┘
        ↓
 ┌──────┴──────┐
 ↓             ↓
W2-08         W2-09
NEXT          NEXT
 └──────┬──────┘
        ↓
      W2-10
```

Authorized W2 implementation scope:

- Library / Browse workspace shell;
- migration of the existing Query V2 Library surface into the shared workspace;
- W1-backed familiar Browse experience;
- shared virtualized List / Grid presentation;
- Context Panel / Inspector integration with explicit user-controlled visibility;
- per-target presentation preferences without replacing WorkspaceSession live history;
- managed Library search/filter plus bounded current-folder Browse filtering;
- truthful, spatially stable Browse sort completeness behavior;
- platform-adaptive navigation and managed/unmanaged affordances;
- 100k virtualized Library/Browse presentation and accessibility/focus/keyboard/DPI QA.

W2 explicitly does not authorize W3 rich Preview UI/providers, W4 native system
integration, Query V3, a new watcher/Scheduler/Read Gate/mutation authority,
arbitrary recursive unmanaged filesystem search or schema changes solely for UI
convenience.

## Planned after W2

### W3 — Preview Platform

Planned scope, not yet authorized:

- Quick Preview UI;
- rich built-in providers such as Text/Code, Markdown, structured data,
  CSV/TSV, Folder, ZIP and Images;
- rapid-switch, cleanup, corrupt-source and 100k Folder Preview gates.

### W4 — Native Integration

Planned scope after core Preview is stable:

- macOS Apple Silicon Quick Look extension/host integration;
- Windows Quick Preview/system integration, with Preview Handler support
  evaluated separately;
- native lifecycle, DPI/display/provider failure QA.

### W5 — Release Gate

No feature expansion. Full performance, stability, security, accessibility,
real platform/provider fixture and polish closeout, including signing,
notarization and publication state.

## Architecture hardening lane

These are not independent product modules. They are executed only when a
product initiative naturally reaches the relevant boundary or an explicit
hardening initiative is approved.

- split `AppRuntimeProviders` ownership without creating duplicate runtime
  authorities;
- converge Windows platform boundaries toward the explicit macOS
  platform-adapter shape where useful;
- reduce oversized Rust domain modules without changing behavior or persistence
  authority;
- converge Tauri command/permission registries where it can be proven safe;
- reduce browser mock concentration while preserving deterministic mock honesty;
- investigate the W1 scheduler pressure-latency target miss without weakening
  the existing target or structural fairness/cancellation gates.

## Technical-debt retirement lane

Retire only when the deletion condition in `TECH_DEBT.md` is satisfied. Priority
candidates include:

- legacy File Library compatibility store;
- legacy watcher adapter;
- legacy operation preview callback paths;
- `useOrganizeDecisionStore` compatibility bridge;
- `global_index/legacy_queue.rs`;
- legacy design-token aliases;
- dead Tauri command/permission surface confirmed to have no caller;
- obsolete packaging/build assets after real package verification;
- merged/superseded remote branches after equivalence proof.

## Not authorized by this roadmap

This roadmap does not authorize OCR, RAG/vector database, AI Preview, a generic
Agent runtime, shell/MCP/tool execution, Rule AST V2, a second AI queue, a new
operation/recovery system, Query V3, a managed-watcher rewrite, a second
content-read eligibility engine, arbitrary unmanaged recursive/global filesystem
search, third-party Preview plugin SDK, Linux support, Intel macOS support or
schema changes.

Any such expansion requires a separate product/architecture decision.
