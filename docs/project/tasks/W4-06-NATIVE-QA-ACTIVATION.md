# W4-06 — Native Accessibility / DPI / Performance / Resource QA Activation

Status: **ACTIVE / NEXT — EVIDENCE GAP AUDIT FIRST**

Last verified: 2026-09-02

## Entry baseline

W4-06 activates after the W4-05 no-sign disposition closes.

Pre-transition baseline:

- `master@bfddfddae5798543adeccde3f6a56bcd8ff87337`;
- tree `121b262cef3e43fe00209d379c741aa3d740ea76`.

W4-06 implementation/audit work must start from the exact post-merge master produced by the W4-05 closeout / W4-06 activation PR.

## Objective

W4-06 is an **integration evidence gate**, not a new native feature track.

Its purpose is to collect, reconcile and close the remaining native QA facts across the already accepted W4 implementation:

- macOS native Quick Look path from W4-02;
- Windows Explorer Preview Handler from W4-04;
- packaging/runtime evidence already accepted by W4-04;
- shared failure/resource/security behavior inherited from W3/W4.

The first action is a read-only evidence gap audit. Do not change product code merely because an evidence row has not yet been summarized in one W4-06 record.

## Signing boundary

Production signing/notarization is not a W4-06 requirement.

Current project truth is:

- Windows Authenticode: deferred / not planned in the current horizon;
- Apple Developer ID: deferred / not planned in the current horizon;
- Apple notarization/stapling: deferred / not planned in the current horizon.

W4-06 must evaluate native behavior on the accepted unsigned engineering artifacts and must not block on unavailable signing credentials.

No signing workflow or credential integration is authorized by W4-06.

## Evidence classification

Every W4-06 requirement should be classified as one of:

- **ALREADY SATISFIED** — accepted exact-head or real-host evidence already exists;
- **RUN / VERIFY** — a bounded QA run is still needed;
- **MANUAL EVIDENCE REQUIRED** — requires genuine interactive OS behavior;
- **FIXTURE-DEPENDENT / UNVERIFIED** — a real fixture is unavailable; preserve that truth;
- **NOT APPLICABLE** — outside the accepted supported product matrix;
- **DEFECT** — current evidence demonstrates an actual product failure requiring remediation.

Do not convert missing evidence into a product defect without a failing observation.

## macOS audit matrix

Review existing W4-02 and native-QA evidence for:

1. Apple Silicon macOS 13+ supported baseline;
2. real native Quick Look presentation for the accepted PDF scope;
3. complete staged snapshot / no original managed-source URL handoff;
4. source mutation between eligibility and native-access acquisition fails closed;
5. source mutation during staging does not publish stale native representation;
6. over-budget/unavailable/materialization-required fallback truth;
7. source switch / cancel / close cleanup;
8. repeated preview resource stability;
9. Retina / display-scale behavior where genuinely tested;
10. multi-display behavior where genuinely tested;
11. keyboard/focus behavior where applicable;
12. VoiceOver evidence only if genuinely executed;
13. File Provider/materialization behavior only where genuine fixtures exist;
14. corrupt/unsupported/permission/unavailable cases;
15. useful-render performance under accepted fixtures.

Do not expand Office/iWork/media activation merely to increase QA coverage.

## Windows audit matrix

Review existing W4-03 v2 / W4-04 evidence for:

1. genuine Explorer Preview Pane behavior;
2. normal x64 Low Integrity `prevhost.exe` hosting;
3. `Initialize → DoPreview → Unload` lifecycle;
4. zero-read `Initialize`;
5. bounded `DoPreview` ingress capture;
6. shell stream release before deferred work;
7. source write/rename/move/delete freedom after successful capture/navigation-away;
8. repeated preview/unload steady state;
9. mapped Preview DLL repair/uninstall behavior already accepted in W4-04;
10. supported 16-extension production association matrix;
11. resize behavior;
12. DPI / display-scale behavior;
13. multi-display behavior where genuinely tested;
14. focus/accelerator/keyboard behavior;
15. Narrator evidence only if genuinely executed;
16. corrupt/unsupported/permission/unavailable cases;
17. useful-render latency/resource behavior under accepted fixtures.

Do not rerun the full W4-04 installer ownership matrix unless the audit identifies a current contradictory result.

## Shared audit matrix

Confirm or classify:

- no macro/script execution;
- no hidden network resource fetch;
- no broad hydration/materialization side effect;
- bounded handles/streams/assets/staging/captured-memory resources;
- stale publication rejection;
- unsupported state remains truthful;
- exact source/evidence identity for cited CI/native runs;
- no second Provider Registry / ReadGate / source authority;
- no feature spillover into W5.

## Expected first deliverable

Create a W4-06 evidence-gap table containing:

| Requirement | Existing evidence | Classification | Action |
|---|---|---|---|

The audit should prefer reuse of already accepted evidence over rerunning expensive native lanes.

Only rows classified `RUN / VERIFY`, `MANUAL EVIDENCE REQUIRED`, or `DEFECT` should create follow-up work.

## Code-change rule

W4-06 does not authorize product changes merely to make a checklist green.

Code changes are allowed only if a reproducible current defect is demonstrated against an accepted supported platform/fixture.

If a defect is found:

1. record exact evidence;
2. classify severity;
3. open a narrowly scoped remediation track;
4. preserve current architecture authority;
5. independently review the remediation before changing W4-06 acceptance truth.

## Performance/resource rule

Reuse accepted W4-02/W4-04 timing and lifecycle evidence where still representative.

Do not introduce arbitrary new hard thresholds solely because one historical run happened to be faster.

W4-06 should verify that native preview remains responsive and resource-stable under supported fixtures, while keeping staging/capture/resource bounds truthful.

## Accessibility truth

Hosted compile/test is not manual accessibility proof.

VoiceOver/Narrator/manual keyboard/display facts may only be marked PASS when genuinely executed.

If no such run is available, record **UNVERIFIED**, not PASS and not automatic FAIL.

## Non-goals

W4-06 must not:

- implement signing/notarization;
- redesign NSIS;
- change Preview associations;
- add Finder Quick Look extensions;
- expand macOS supported native formats;
- change Windows capture architecture;
- change Preview providers;
- change schema;
- bump package version;
- publish a release;
- activate W5.

## Exit gate

W4-06 may close when:

1. every applicable native QA row has an explicit evidence disposition;
2. all actual supported-platform defects discovered by the gate are resolved or explicitly accepted/deferred with justification;
3. fixture-dependent/manual facts are truthfully marked rather than fabricated;
4. resource/performance behavior is bounded and no current regression is demonstrated;
5. the final evidence table identifies exact source/run/artifact identities where available;
6. W4-07 closeout is the only remaining W4 track.

## Sequencing

```text
W4-00 ✅
  ↓
W4-01 ✅
  ↓
W4-02 ✅            W4-03 v1 STOPPED
                       ↓
                    ADR-0006 ✅
                       ↓
                    W4-03 v2 ✅
                       ↓
                    W4-04 ✅
                       ↓
                    W4-05 ✅ CLOSED — SIGNING DEFERRED
                       ↓
                    W4-06 ACTIVE / EVIDENCE GAP AUDIT FIRST
                       ↓
                    W4-07 downstream
                       ↓
                    W5 NOT AUTHORIZED / NOT ACTIVE
```
