# W4-04 — Windows Explorer Preview Handler Production Integration Current Truth

Status: **COMPLETE / CLOSED**

Last verified: 2026-09-02

## Canonical merged authority

- Production integration PR: **#159** — `feat(windows): productize Explorer Preview Handler`.
- Final feature-branch integration head before master merge: `cdf75094734f69e112271634df259136a1491a27`.
- Final accepted integration tree: `2b9146eaff9696867c1ba1c5649aec3b8ce831d0`.
- Final exact-head merge-integration CI: run `33532586198` — **SUCCESS**.
- Final squash merge to `master`: `d526eb972f55de42df77946354b8ab79c05152dc`.
- Final master tree: `2b9146eaff9696867c1ba1c5649aec3b8ce831d0`.
- Intermediate remediation PR **#164** merged into the W4-04 feature branch as merge commit `cdf75094734f69e112271634df259136a1491a27`; accepted remediation head `486c073e23e95f435c4dae6cea713d9872400f3c` remains a direct parent.

The squash-merged master tree is exactly the final accepted W4-04 integration tree. No different source tree was merged after acceptance.

## Final accepted Windows artifact authority

- Release-build run: `33515469458` — **SUCCESS**.
- Windows artifact: `Zen-Canvas-Windows`, artifact ID `9804066036`.
- Artifact ZIP size: `8,932,655` bytes.
- Artifact ZIP SHA-256: `DCA0BD7DCA81A669359EA2782F46218D7B6C98DB40CB7F87CA35BF9715064D1C`.
- Installer: `Zen Canvas_0.1.40_x64-setup.exe`.
- Installer size: `8,867,722` bytes.
- Installer SHA-256: `5E92A0397F876754F8F3CD06D92BF038364D5D5145DDB04A9EF42A006D973A5D`.
- Checksum manifest: exact match.

Earlier candidate installers, including the historical `E995...`, `546B...` and `8633...` lineages, remain provenance only and are superseded for final W4-04 acceptance authority.

## Final review disposition

Independent final review disposition:

- P1 blockers: **0**;
- P2 blockers: **0**;
- runtime blockers: **0**.

W4-04 is closed on the accepted master tree and does not require another installer-hardening pass before W4-05.

## Accepted production behavior

### Windows Explorer Preview Handler

The production handler preserves ADR-0006 capture-before-defer:

- `IInitializeWithStream` performs no content read;
- `DoPreview` performs the bounded ingress capture;
- handler-owned shell `IStream` references are released before deferred work;
- deferred rendering consumes only Zen-owned immutable bounded memory;
- normal x64 `prevhost.exe` hosting and Low Integrity isolation are preserved;
- no `DisableLowILProcessIsolation` bypass is used;
- the full Zen UI is not required to service shell preview requests.

### Production association matrix

The accepted production Preview Handler matrix remains the deliberately bounded 16-extension set:

`.md`, `.markdown`, `.rs`, `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.java`, `.c`, `.h`, `.cpp`, `.hpp`, `.ps1`, `.sh`, `.sql`.

Foreign/wrong-type ownership is preserved rather than overwritten. W4-04 does not claim universal format parity or seize unrelated stronger system handlers.

### Installer lifecycle

Final installed-product acceptance proved:

- fresh install;
- running-service repair;
- stopped-service repair;
- uninstall and reinstall sanity;
- foreign association preservation;
- foreign same-name service preservation;
- foreign `InprocServer32` preservation;
- exact Preview registration and association cleanup;
- product/service/manufacturer/ARP convergence.

The installer uses explicit typed registry/service authority and keeps foreign or unknown state fail-closed.

### Preview DLL runtime closure and servicing

The Preview Handler DLL is built with the isolated static CRT requirement needed for clean-host COM loading. The packaged DLL dependency gate proves no undeclared `VCRUNTIME140.dll` prerequisite remains for the Preview Handler.

Real Explorer acceptance also proved Windows in-use DLL servicing:

- the existing old Preview DLL may remain mapped by the original `prevhost.exe`;
- the old canonical DLL is retired to an installer-owned same-volume path outside `$INSTDIR`;
- the new canonical DLL is written and registered without killing Explorer or `prevhost.exe`;
- new Preview activations use the canonical replacement;
- uninstall can remove the product root while an inert retired image may remain temporarily mapped outside `$INSTDIR`;
- retired cleanup is best-effort and does not require reboot-for-PASS.

No `taskkill`, `Stop-Process`, Explorer termination, `prevhost.exe` termination or Low-IL bypass is part of the product lifecycle.

## Final genuine Explorer acceptance

The final accepted artifact passed genuine interactive Windows Explorer Preview Pane evidence for representative supported fixtures including normal Markdown/source files, empty/mixed-line-ending cases and bounded large input.

Accepted real-host evidence includes:

- genuine Explorer Preview Pane renders Zen Preview content;
- real x64 Low Integrity `prevhost.exe` loads the production DLL;
- repeated Preview switching remains responsive;
- source rename, move and delete succeed after navigating away from a Preview;
- same-version repair succeeds while the original `prevhost.exe` remains alive and holds the old DLL mapping;
- Preview still works after that repair;
- uninstall succeeds while Explorer/`prevhost.exe` remain untouched;
- Explorer remains responsive after uninstall;
- final active product/service/Preview registration converges to absent.

## Historical blocker resolution

The major historical W4-04 failures remain useful provenance but are closed:

1. stale/partial installer metadata and service ownership compensation defects — remediated;
2. generated installer lifecycle ownership/stage defects — remediated;
3. hosted Windows CRLF portability — remediated;
4. hosted macOS missing `native-qa` test feature — remediated;
5. installer registry enumeration non-termination — remediated;
6. Global Index runtime parsing via localized `sc.exe` text — replaced by direct SCM authority;
7. optional ARP URL repair/uninstall admission mismatch — remediated without making optional values mandatory;
8. uninstall manufacturer marker cleanup — remediated with exact ownership;
9. Preview Handler `VCRUNTIME140.dll` dependency — remediated with isolated static CRT;
10. mapped in-use Preview DLL repair/uninstall — remediated by retirement/replacement servicing without host termination;
11. NSIS Preview resource forward-slash path rewrite — remediated and covered by fresh/mapped executable smoke.

These historical candidates are not reopened by W4-05.

## Release-build boundary

W4-04 also reduced the release workflow to artifact issuance/verification rather than repeating full source correctness already owned by exact-SHA ordinary CI. The final W4-04 release workflow keeps:

- exact-SHA ordinary-CI prerequisite;
- source/version/provenance checks;
- Windows NSIS and macOS DMG packaging;
- Preview dependency and Windows registry/service/mapped-DLL servicing semantics;
- SBOM/checksum/artifact upload;
- tag-only final artifact verification.

This is packaging infrastructure inherited by W4-05. W4-05 must not restore redundant source-correctness work merely to create another gate.

## Residual truth handed to W4-05/W4-06

W4-04 closes Windows production productization, but it does not claim work owned by later tracks:

- final signing credentials/Authenticode evidence remain W4-05 when credentials are available;
- macOS Developer ID/notarization/signing integration remains W4-05;
- tag-only release publication remains W5, not W4-05;
- native accessibility/DPI/display/manual cross-platform QA remains W4-06 where not already proven;
- broader native/manual fixture gaps remain honestly UNVERIFIED where no real fixture was executed.

## Completion decision

W4-04 is **COMPLETE / CLOSED**.

The completion gate is satisfied because:

1. W4-03 v2 architecture was independently accepted before productization;
2. R-FL-01 was COMPLETE / CLOSED before the final W4-04 execution baseline;
3. production integration merged through PR #159;
4. final accepted source tree passed exact-head CI;
5. final hosted installer identity was frozen and independently verified;
6. installed-product lifecycle and foreign-state preservation passed;
7. genuine Explorer/Low-IL `prevhost.exe` acceptance passed;
8. repair/uninstall with an in-use mapped Preview DLL passed without host termination or reboot-for-PASS;
9. final review recorded no P1/P2/runtime blockers;
10. the accepted tree is the exact tree now on `master`.

## Sequencing

W4-05 — **Signing / Packaging / Registration Integration** is now the next active W4 track.

W4-05 inherits the already-proven Windows NSIS lifecycle and macOS DMG issuance infrastructure. Its job is a bounded signing/packaging/registration gap closure, not a redesign of W4-04 or a new installer-hardening program.

W4-06 and W4-07 remain downstream. W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.
