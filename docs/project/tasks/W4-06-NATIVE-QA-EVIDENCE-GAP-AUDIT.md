# W4-06 — Native Accessibility / DPI / Performance / Resource QA Evidence-Gap Audit

Status: **AUDIT COMPLETE — NO CURRENT PRODUCT DEFECT FOUND**

Last verified: 2026-09-02

## Audit baseline

This evidence audit is bound to:

- `master@9ea11809fa60732c110d60cce183f2f52c235194`;
- tree `d91e018a25796155660e294e8886976f2bb2dd3b`;
- W4-05 no-sign disposition / W4-06 activation merged through PR #168;
- W4-02 macOS native Quick Look current truth;
- W4-03 v2 Windows bounded-capture current truth;
- W4-04 Windows Explorer production current truth.

The audit is read-only with respect to product behavior. No source, workflow, package, schema or installer change is authorized merely because a manual or fixture-dependent row remains unverified.

## Classification

- **ALREADY SATISFIED** — accepted exact-head, controlled native, real-host or final production evidence already proves the row.
- **MANUAL EVIDENCE REQUIRED / UNVERIFIED** — the row requires genuine interactive native UI/display/accessibility evidence that has not been executed or preserved as W4 evidence.
- **FIXTURE-DEPENDENT / UNVERIFIED** — a genuine external/provider fixture was not supplied; this is an evidence boundary rather than a product failure.
- **NOT APPLICABLE** — outside the accepted supported W4 product matrix.
- **DEFECT** — a current accepted-platform observation demonstrates actual incorrect product behavior.

No row in this audit is classified **DEFECT**.

## Canonical evidence identities

| Area | Evidence authority | Result reused by W4-06 |
|---|---|---|
| Shared native access | W4-01 current truth; production merge `02e88db7cf4287e0d68792b3960da503b70d6c56` | bounded staging/access, cancellation, source-version revalidation, resource cleanup accepted |
| macOS Quick Look | W4-02 PR #145; reviewed head `809a2002067c315784b48a524a815be328d7c953`; tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`; CI `32962219486` SUCCESS | Apple Silicon native lifecycle, staging authority and native performance accepted |
| Windows Preview architecture | W4-03 v2 PR #151; head `19e51d5e2eed175a0eda18a02b47d82c97cc289b`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`; CI `33008914117` SUCCESS | capture-before-defer, COM/window lifecycle, source release and controlled/real Explorer viability accepted |
| Windows production | W4-04 PR #159; master merge `d526eb972f55de42df77946354b8ab79c05152dc`; accepted tree `2b9146eaff9696867c1ba1c5649aec3b8ce831d0`; CI `33532586198` SUCCESS | production associations, genuine Explorer/Low-IL `prevhost`, install/repair/uninstall and mapped-DLL servicing accepted |
| Windows final artifact | release `33515469458`; artifact `9804066036`; installer SHA-256 `5E92A0397F876754F8F3CD06D92BF038364D5D5145DDB04A9EF42A006D973A5D` | final genuine Explorer runtime acceptance authority |

## macOS evidence-gap matrix

| Requirement | Existing evidence | Classification | W4-06 action |
|---|---|---|---|
| Apple Silicon macOS 13+ baseline | W4-02 current truth and hosted Apple Silicon runner verification | **ALREADY SATISFIED** | none |
| Native Quick Look lifecycle for accepted PDF scope | W4-02 accepted native Quick Look view lifecycle and `macos-native-preview-lifecycle` PASS | **ALREADY SATISFIED** | none |
| Complete staged snapshot; no original managed/provider URL handoff | W4-01/W4-02 architecture and tests use one authoritative open and opaque staged access | **ALREADY SATISFIED** | none |
| Source mutation before native-access acquisition fails closed | ReadGate/native access source identity and source-version revalidation tests | **ALREADY SATISFIED** | none |
| Source mutation during staging cannot publish stale native representation | final source-version drift discards completed copy; stale/revoked publication tests | **ALREADY SATISFIED** | none |
| Per-file/total/deadline staging budgets | native access per-file/total capacity, deadline and oversized-source tests | **ALREADY SATISFIED** | none |
| Over-budget / unavailable / materialization-required truth | over-budget cleanup and terminal eligibility/fallback tests; no implicit hydration contract | **ALREADY SATISFIED** | none |
| Source switch / cancel / close / dispose cleanup | W4-01/W4-02 lifecycle tests restore staging/registry/scheduler baselines | **ALREADY SATISFIED** | none |
| Repeated preview/resource stability | repeated create/revoke and native lifecycle/resource baseline tests | **ALREADY SATISFIED** | none |
| Native performance/resource framework | W4-02 `Native macOS performance` PASS; 10k mixed package corpus and 1M bookkeeping profile; Preview Platform native performance lane | **ALREADY SATISFIED** | do not invent a new threshold |
| Corrupt/unsupported/permission/unavailable semantics | deterministic Preview/ReadGate/provider failure matrix remains truthful and fail-closed | **ALREADY SATISFIED** | none |
| No hidden network/materialization side effect | native access/Quick Look uses staged local snapshot; provider feasibility explicitly prevents implicit cloud materialization | **ALREADY SATISFIED** | none |
| Real iCloud / generic File Provider fixture | existing evidence explicitly records no genuine provider fixture | **FIXTURE-DEPENDENT / UNVERIFIED** | preserve boundary; no fake fixture |
| External/network-volume native fixture | existing native evidence explicitly records fixture unavailable where applicable | **FIXTURE-DEPENDENT / UNVERIFIED** | preserve boundary |
| Retina / real display-scale visual behavior | hosted lifecycle/compile is not interactive Retina proof | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only; no code change |
| Multi-display movement/resizing | no genuine multi-display W4 native evidence located | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| Native keyboard/focus behavior | no preserved genuine interactive Quick Look keyboard/focus run located | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| VoiceOver | no genuine W4 VoiceOver run | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| First useful native frame as a human-visible latency measurement | native performance/lifecycle is green, but no preserved interactive visual timing record is available | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | no arbitrary numeric gate |
| Office/iWork/media strong-native parity | not activated by W4-02; capability remains runtime/evidence driven | **NOT APPLICABLE** | do not expand scope |

## Windows evidence-gap matrix

| Requirement | Existing evidence | Classification | W4-06 action |
|---|---|---|---|
| Genuine Explorer Preview Pane | W4-04 final accepted production artifact | **ALREADY SATISFIED** | none |
| Normal x64 Low Integrity `prevhost.exe` | W4-04 final genuine Explorer acceptance | **ALREADY SATISFIED** | none |
| `Initialize → DoPreview → Unload` lifecycle | W4-03 v2 COM lifecycle tests/controlled harness plus real Explorer acceptance | **ALREADY SATISFIED** | none |
| Zero-read `Initialize` | W4-03 v2 controlled native evidence | **ALREADY SATISFIED** | none |
| Bounded `DoPreview` ingress | accepted 512 KiB capture-before-defer architecture | **ALREADY SATISFIED** | none |
| Shell `IStream` released before deferred work | W4-03 v2 controlled evidence and architecture review | **ALREADY SATISFIED** | none |
| Source write/rename/move/delete freedom | controlled harness and final W4-04 genuine Explorer source-release evidence | **ALREADY SATISFIED** | none |
| Repeated preview/unload/resource steady state | repeated lifecycle/resource baseline tests and genuine Explorer switching | **ALREADY SATISFIED** | none |
| Mapped Preview DLL repair/uninstall | W4-04 final genuine Explorer repair/uninstall while original `prevhost` stayed alive | **ALREADY SATISFIED** | none |
| Production 16-extension association matrix | W4-04 installed-product/foreign-state acceptance | **ALREADY SATISFIED** | none |
| Child-window `SetWindow` / `SetRect` contract | W4-03 v2 COM/window lifecycle evidence | **ALREADY SATISFIED** | none |
| Focus/accelerator HRESULT contract | W4-03 v2 controlled `GetWindow`, focus and frame accelerator behavior | **ALREADY SATISFIED** | none |
| Corrupt/unsupported/permission/unavailable semantics | bounded capture/provider/ReadGate failure matrices and truthful fallback/terminal-state tests | **ALREADY SATISFIED** | none |
| Useful-render/resource regression | Preview Platform performance routing + Windows native lane + genuine Explorer responsiveness/repeated switching show no current regression | **ALREADY SATISFIED** | no new arbitrary timing threshold |
| Real Explorer resize across DPI changes | no genuine W4 DPI-transition evidence located | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| Real multi-display behavior | no genuine W4 multi-display Preview Handler evidence located | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| Full keyboard traversal / host focus in real Explorer | controlled COM contract exists, but no preserved genuine keyboard traversal run | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| Narrator | no genuine W4 Narrator run | **MANUAL EVIDENCE REQUIRED / UNVERIFIED** | record only |
| PDF/Office/media shell-handler takeover | deliberately outside the accepted 16-extension production matrix | **NOT APPLICABLE** | do not seize stronger handlers |

## Shared evidence-gap matrix

| Requirement | Existing evidence | Classification | Action |
|---|---|---|---|
| No macro/script execution | shared representation/provider contracts keep content inert; Markdown sanitization and shell capture do not execute source content | **ALREADY SATISFIED** | none |
| No hidden network fetch | native hosts consume bounded staged/captured local bytes; no renderer/network resource expansion path is introduced | **ALREADY SATISFIED** | none |
| No broad implicit hydration/materialization | MaterializationReadGate/provider state remains authoritative and fail-closed | **ALREADY SATISFIED** | none |
| Bounded handles/streams/assets/staging/captured memory | W4-01/W4-02/W4-03 tests and performance/resource baselines | **ALREADY SATISFIED** | none |
| Stale publication rejection | W4-02 generation reservation/current identity and W4-03/W4-04 stale publication/capture logic | **ALREADY SATISFIED** | none |
| Truthful unsupported/fallback state | provider/native matrices preserve unsupported, partial, unavailable and terminal distinctions | **ALREADY SATISFIED** | none |
| Exact evidence identity | current-truth records bind reviewed heads/trees/runs/artifacts | **ALREADY SATISFIED** | none |
| No second Provider Registry / ReadGate / durable source authority | W4-01/W4-02/W4-03 architecture closeouts explicitly preserve existing authorities | **ALREADY SATISFIED** | none |
| No W5 feature spillover | W5 remains inactive; W4-06 is evidence-only | **ALREADY SATISFIED** | none |
| Production signing/notarization | explicitly deferred by W4-05 no-sign product decision | **NOT APPLICABLE TO W4-06** | do not reopen |

## Manual / fixture evidence disposition

The remaining unverified rows are not silently promoted to PASS:

- macOS Retina/display-scale;
- macOS multi-display;
- macOS native keyboard/focus;
- macOS VoiceOver;
- human-visible native first-frame timing;
- genuine iCloud/File Provider/external/network-volume fixtures;
- Windows real DPI transition behavior;
- Windows multi-display behavior;
- Windows full genuine Explorer keyboard/focus traversal;
- Windows Narrator.

They are also not classified as failures because no failing observation exists.

This follows the W4-06 activation rule: hosted compile/test is not manual accessibility/display proof, and missing manual/fixture evidence remains `UNVERIFIED` unless a real supported-platform defect is observed.

## Defect review

No current accepted-platform evidence reviewed in this audit demonstrates:

- broken native Preview rendering;
- persistent source locks after accepted capture/lifecycle points;
- unbounded native staging/captured memory;
- stale publication;
- implicit provider hydration;
- installer/registration regression;
- current performance/resource regression;
- accessibility/DPI failure observed on a genuine supported host.

Therefore:

**W4-06 DEFECT COUNT = 0.**

No product/code remediation track is authorized by this audit.

## Exit-gate evaluation

The W4-06 activation exit gate permits closure when every applicable row has an explicit evidence disposition, actual defects are resolved/accepted, manual and fixture-dependent facts remain truthful, resource/performance behavior is bounded with no demonstrated regression, and exact evidence identities are recorded.

This audit satisfies that governance requirement:

1. all audit rows have explicit classifications;
2. no current product defect is demonstrated;
3. manual/fixture gaps remain explicitly `UNVERIFIED`;
4. accepted performance/resource evidence is reused without inventing new thresholds;
5. canonical W4-01/W4-02/W4-03/W4-04 identities are recorded;
6. W4-04 installer/runtime and W4-05 signing decisions are not reopened.

## Recommended disposition

W4-06 may close **without product code changes and without rerunning the W4-04 installer matrix**.

Closure must preserve the manual/fixture evidence boundaries above rather than relabeling them PASS.

After W4-06 closeout, W4-07 docs/governance closeout is the only remaining W4 track. W5 remains inactive until W4-07 separately completes and authorizes a later transition.
