# Zen Canvas Project Status

Last verified: 2026-08-22

## Current baseline

- Default branch: `master`.
- File Library 2.0 W2 product/runtime baseline:
  `master@1898c290859be204e1778b4b72fc58d22dc08b71`
  (PR #116 W2-11 squash merge).
- W2-12 governance closeout: PR #117 (`docs/w2-12-closeout`), docs/governance-only.
- W2-11 validated production head:
  `a194580ce5be1985edb6bc99317e9a8ff54ddb32`; tree:
  `9ec64970ae8b8198c5f2efb9d53753f6421eff3a`.
- W2-11 docs-only successor before merge:
  `8b0415e123b22b968d2a02c9ae915a90b456f33f`; tree:
  `c3c2159fed9bc500896cb2c6888a5c3cbb622e11`.
- W2-11 PR CI `32534065400`: `success`.
- W2-11 final current-head PR CI `32535644576`: `success`.
- W2-11 Full Validation `32534452585`: `success`.
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

## Current initiative

**No active initiative**

Status: between initiatives — no active implementation

W2 File Library 2.0 Experience is complete when this W2-12 closeout is present
on `master` through PR #117. W3 Preview Platform is not active and requires a
separate activation/review sequence before any W3 production work begins.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.

## Wave status

### W0 — File Library / Preview specification

**COMPLETE.** W0 froze the Library/Browse product model, authority boundaries,
Entry/Location/Browse identity, Preview Core/Host boundary, Read/Materialization,
Thumbnail/WorkScheduler ownership, performance contracts and Wave sequencing.

### W1 — File Library / Preview Foundation

**COMPLETE.** W1 remains the backend/runtime authority foundation used by the
completed W2 experience. W1 closeout and residual evidence remain binding.

### W2 — File Library 2.0 Experience

**COMPLETE through W2-12 closeout PR #117.**

W2-01 through W2-11 are complete and merged. W2-12 is the final
documentation/governance closeout represented by this branch/PR. Its release-gate
audit found no unresolved W2 HARD correctness, accessibility, authority, scale,
lifecycle, cancellation, resource or CI blocker.

Final W2 sequence:

```text
W2-01  Workspace Shell + Experience Controller                ✅
R0     Consumer-boundary architecture/governance remediation  ✅
R1     CI Evidence / Governance Hardening                      ✅
R2     Browse Identity + Thumbnail Consumability               ✅
CI-O   CI Latency / Redundancy Remediation                     ✅
R3     Location Consumability                                  ✅
R4     W1→W2 Final Consumability Verification                  ✅
W2-02  Shared Presentation Entry / Collection Contracts       ✅
W2-03  Library Mode Adapter / Migration                        ✅
W2-04  Browse Mode Navigation + Content                        ✅
W2-05  Interaction Convergence + Virtualized List              ✅
W2-06  Virtualized Grid + Thumbnail Integration                ✅
W2-07  Context Panel / Inspector                               ✅
W2-08  Search / Filter / Sort                                  ✅
W2-09  Platform Navigation + Managed/Unmanaged UX              ✅
W2-10  Interaction / Accessibility / Responsive Integration    ✅
W2-11  Experience Performance / Cross-platform QA              ✅
W2-12  File Library 2.0 Experience Closeout                    ✅ PR #117
```

W2-12 binding taskbook:
[`tasks/W2-12-CLOSEOUT-CODEX.md`](tasks/W2-12-CLOSEOUT-CODEX.md).

W2-12 release-gate result:
[`tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md`](tasks/W2-12-FILE-LIBRARY-EXPERIENCE-CLOSEOUT-RESULT.md).

## W2 accepted product/runtime truth

- The File Library route is the shared `FileLibraryWorkspace` for Library and
  Browse organization modes.
- Library remains Query V2 / `LibrarySelectionV1` authoritative. Compact
  `all_matching` selection remains non-materialized.
- Browse remains W1 `BrowseService` / session / enumeration / opaque-ref
  authoritative. Unmanaged Browse never implicitly becomes managed Library
  content.
- Shared List/Grid/Context presentation does not replace source-owned selection,
  query, navigation or filesystem authority.
- `WorkspaceSession` remains the navigation/history/presentation owner.
- Browse current-folder search remains backend-owned, non-recursive, progressive
  and bounded by the accepted raw-directory scan budget.
- Thumbnail generation identity remains backend-derived.
- Library managed-location activation stays Query V2 roots-scope based; Browse
  location activation stays `LocationRef` → backend Browse admission.
- Platform adaptation changes presentation only and does not infer provider,
  capability or identity from raw paths.
- W2-10 established integrated keyboard/focus/context-menu/responsive ownership.
- W2-11 proved integrated 100k Library/Browse bounded behavior, existing Query V2
  100k/1M thresholds, sparse/late Browse search, stale-publication rejection and
  resource steady state.

## W2-11 final performance / resource evidence

- 100k Library List/Grid bounded rendering: **HARD PASS**.
- 100k Browse progressive List/Grid: **HARD PASS**.
- Query V2 accepted 100k/1M thresholds: **HARD PASS**.
- Sparse impossible-query and late-sentinel Browse search: **HARD PASS**.
- Query replacement / stale publication rejection: **HARD PASS**.
- Thumbnail cancellation and steady-state cleanup: **HARD PASS**.
- DOM/observer/timer/thumbnail/object-URL cleanup: **HARD PASS**.
- Post-warm-up eight-cycle durable-listener plateau: **TARGET MET**; durable
  signal remained `19`, with later deltas `0,0,0,0,0`.
- Comparable Full Validation: `759 s` before W2-11 versus `786 s` final;
  `+27 s` / about `+3.6%`. The W2-11 browser step was `57 s` and was not the
  final critical path. CI-O architecture remains intact.

## Residual evidence ledger

These items remain explicit after W2; none is silently converted to PASS.

### `DEFERRED` — Recent

`RECENT_AUTHORITY_MISSING` remains the reviewed product decision. No
source-owned recent-activity authority exists, so W2 does not redefine Recent as
modified-time/created-time ordering or add persistence merely to satisfy a label.

### `UNVERIFIED` — native manual accessibility / display QA

No genuine interactive VoiceOver/Narrator, real Retina/Windows DPI, native
trackpad/pointer or complete platform-keyboard manual QA was executed during W2.
Browser DPR tests, deterministic platform fixtures and hosted Apple Silicon /
Windows jobs are not native-manual UX proof.

### `UNVERIFIED` — real provider/filesystem fixtures

Real iCloud/File Provider, external APFS/exFAT, SMB/network and other unavailable
provider/platform fixtures remain unverified where no genuine fixture existed.

### `OBSERVED / UNVERIFIED` — queue attribution

W2-11 measured workload and overall run timing, but GitHub did not expose an
authoritative queue-versus-runner-startup split.

### Historical CI-O target

CI-O historically closed with its separate `<=14 min` Full target not yet met.
Later W2-11 Full Validation measured `786 s` / `13m06s`; that later observation
does not rewrite the historical CI-O closeout record.

### Inherited W1 observations

W1 scheduler-interference `TARGET MISSED` observations and native provider
fixture gaps remain part of the program evidence record.

## Technical debt

`TD-015` remains **open**. The real File Library route is the new workspace and
replacement behavior/evidence is strong, but production Library Mode still
consumes bounded Vault compatibility components and
`useLibraryContentCompatibility`. The deletion exit condition is not yet proven.
See [`TECH_DEBT.md`](TECH_DEBT.md).

No unrelated technical-debt item is closed merely because W2 is complete.

## Future Waves

- **W3 — Preview Platform:** `NOT STARTED / NOT AUTHORIZED`. A separate
  initiative activation/review is required.
- **W4 — Native Finder/Explorer integration:** future Wave; not authorized.
- **W5 — Release / signing / notarization / update:** future Wave; not authorized.

W2 completion does not automatically activate W3.

## Governance rule

The post-W2 project state is intentionally **between initiatives**. The W2-12
closeout result is the final evidence matrix for the completed File Library 2.0
Experience Wave. Any future production work must be authorized through the next
initiative rather than being appended to W2 after closeout.
