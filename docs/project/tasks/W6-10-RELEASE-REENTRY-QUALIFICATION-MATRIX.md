# W6-10 — Release Re-entry Qualification Matrix

Status: **PREPARED / NOT ACTIVE — OWNER MATRIX FREEZE CANDIDATE**

Prepared from:

- `master@1ee3e6930ee3a1c6f56d1f20932506357cc6deae`
- tree `b5f869a03d8fcdc6982cb02efde4755cbeeca4c2`
- W6-09: **COMPLETE / CLOSED / MERGED**
- public publication: **DEFERRED**
- W6-10: **INACTIVE / NOT YET STARTED**

This matrix defines the evidence required before Zen Canvas may re-enter a public
release decision. It does **not** activate W6-10, create a release candidate,
run installers, create a tag or authorize publication.

## 1. Purpose

W6-10 is not a product-development wave.

Its job is to answer one question:

> Can the already-built Zen Canvas product be truthfully released on its
> supported Windows and macOS targets from one exact release candidate?

The acceptance model is deliberately stricter than W5:

- automated compile/package evidence is necessary but not sufficient;
- browser evidence is not native GUI acceptance;
- Windows and macOS are independent first-class release lanes;
- real macOS GUI / Quick Look evidence is a release gate, not an optional
  residual;
- release-path evidence must come from release artifacts, not only dev builds;
- no new feature scope is authorized merely because release qualification finds
  a defect.

## 2. Frozen supported-platform truth

| Platform | Supported release target |
| --- | --- |
| Windows | x64 Windows package through the existing NSIS distribution path |
| macOS | Apple Silicon macOS 13+ through the existing DMG distribution path |

Current first-release policy remains historical authority unless separately
changed:

- canonical public distribution surface: GitHub Releases;
- no automatic/background updater;
- Windows Authenticode: not provided;
- Apple Developer ID/notarization/stapling: not provided;
- unsigned/unnotarized warning UX must therefore be tested and described
  truthfully rather than reclassified as signed acceptance.

## 3. Evidence vocabulary

Every matrix row must end in exactly one of:

- **PASS** — required evidence was executed on the exact candidate and met the
  acceptance contract;
- **FAIL** — required evidence was executed and demonstrated a release defect;
- **UNVERIFIED** — evidence was not executed or the required host/fixture was
  unavailable;
- **OWNER-ACCEPTED NON-BLOCKING RESIDUAL** — only permitted for rows explicitly
  marked non-blocking by this matrix or by a later Owner amendment.

For a **release-blocking** row, `UNVERIFIED` is not equivalent to PASS and
prevents a GO decision.

## 4. Candidate identity and invalidation rule

W6-10A must freeze one exact release candidate before platform acceptance begins.

Required identity record:

- exact source SHA;
- exact tree SHA;
- package version;
- exact successful `CI Full Validation` run;
- exact successful release-installer build run;
- Windows installer SHA-256;
- macOS DMG SHA-256;
- checksum manifests;
- exactly two valid CycloneDX SBOMs;
- publication tag state;
- GitHub Release state.

The candidate version must be chosen deliberately at activation. Do not assume
`v0.1.40` merely because W5 once qualified that historical version.

Any production source change after candidate freeze invalidates the candidate.
A remediation must create a new RC identity and rerun the evidence affected by
that change. Documentation-only successors do not replace the production RC.

## 5. Gate classification

### Hard release blockers

A GO decision is impossible while any of these are FAIL or UNVERIFIED:

- exact candidate provenance / release workflow;
- Windows install / launch / uninstall release path;
- macOS DMG / copy / first-launch release path;
- supported-platform core application launch and restart;
- Files / Library / Browse critical flows on both platforms;
- Zen Quick Preview core formats on both platforms;
- macOS native Quick Look PDF lifecycle;
- Windows required DPI matrix;
- Windows Forced Colors;
- macOS Retina visual smoke;
- required keyboard/focus smoke;
- release artifact checksum/SBOM integrity.

### Required qualification with severity-based defect disposition

These tests must execute. A discovered defect is release-blocking when it
creates a P0/P1 usability, safety or accessibility failure in a core path:

- Narrator;
- VoiceOver;
- Reduced Motion;
- macOS Increase Contrast / Reduce Transparency smoke where available;
- Windows Explorer Preview Handler keyboard/focus;
- lifecycle/recovery smoke;
- representative mutation/restore disposable-fixture smoke.

### Genuine-fixture residuals

These may remain explicitly UNVERIFIED when a genuine fixture does not exist
and the product does not broaden a release claim beyond the evidence:

- iCloud / generic File Provider;
- external APFS;
- external exFAT;
- SMB/network volume;
- genuine multi-display when unavailable;
- older-public-release -> new-release upgrade before a real older public release
  exists.

They must remain visible in the final decision.

---

# Lane A — W6-10A Release Candidate Freeze

| ID | Qualification | Blocking | Acceptance |
| --- | --- | --- | --- |
| A01 | Freeze exact source + tree | Yes | One immutable production SHA/tree recorded |
| A02 | Freeze package version | Yes | Explicit Owner/version decision; no stale historical assumption |
| A03 | Full Validation | Yes | Exact-SHA release-qualified workflow SUCCESS |
| A04 | Windows NSIS build | Yes | Exact candidate installer produced |
| A05 | macOS Apple Silicon DMG build | Yes | Exact candidate DMG produced |
| A06 | Installer checksums | Yes | Manifests match exact artifacts |
| A07 | SBOM integrity | Yes | Exactly Node + Rust CycloneDX pair; valid |
| A08 | Publication state | Yes | No tag/release created before GO |
| A09 | Worktree / repository truth | Yes | clean; no unreviewed candidate drift |

Exit:

> **RC FROZEN**

Only after Lane A PASS may B/C/D/E evidence be accepted as release evidence.

---

# Lane B — W6-10B Windows Release Qualification

All native evidence must bind to the frozen RC or the exact installer produced
from it.

## B1. Install / launch / removal

| ID | Qualification | Blocking | Required evidence |
| --- | --- | --- | --- |
| B01 | Browser-acquired installer / MOTW path | Yes | Real download or equivalent Internet Zone provenance |
| B02 | SmartScreen / reputation presentation | Yes | Actual user-visible result recorded truthfully |
| B03 | Unknown Publisher / UAC path | Yes | Actual unsigned installer flow recorded |
| B04 | NSIS install UI | Yes | install completes on supported host |
| B05 | Installed first launch | Yes | installed app opens and reaches usable product |
| B06 | restart / relaunch | Yes | close and reopen preserves valid state |
| B07 | uninstall | Yes | app/registration cleanup completes without killing Explorer for PASS |
| B08 | reinstall sanity | Yes | clean reinstall works after uninstall |

Unsigned warning presence is not itself a failure under current policy.
Failure to complete the documented OS-approved installation/launch path is.

## B2. Core product smoke

Required release-artifact states:

- Overview;
- Files;
- Library;
- Browse folder first-entry;
- Settings;
- Global Search;
- one safe Organize/Operation Preview path;
- History / Restore using disposable fixtures;
- error/recovery navigation.

A demonstrated P0/P1 defect blocks release.

## B3. Zen Quick Preview

Required:

- floating Preview;
- pinned Preview;
- PDF >1 MiB;
- continuous PDF pages 1/2/3 and one later page;
- Markdown rendered document mode;
- image Preview;
- Loading;
- Failed/unsupported;
- Details closed/open;
- pinned source remains frozen while background Files selection changes;
- source switch/cancel/close smoke;
- Dark;
- Compact.

The W6-09 dev-build evidence remains historical support but does not replace RC
release-binary evidence.

## B4. Explorer Preview Handler

Required real Explorer smoke on the existing accepted extension ownership:

- at least one representative text/code extension;
- Preview Pane renders;
- focus/keyboard does not trap Explorer;
- source can be navigated away;
- unload/cleanup is bounded;
- Explorer remains responsive.

Do not expand the extension matrix during W6-10.

## B5. Display / accessibility

### DPI

**Release-blocking matrix:**

- 100%;
- 125%;
- 150%.

At each scale inspect at minimum:

- shell/titlebar;
- Files list/grid;
- Settings;
- dialogs/popovers;
- Quick Preview;
- text clipping;
- hit targets;
- focus indication.

### Forced Colors

**Release-blocking.**

Real Windows Forced Colors / High Contrast must be enabled and inspected for:

- navigation selected state;
- keyboard focus;
- buttons;
- Files selection;
- Settings;
- Quick Preview;
- destructive/recovery actions.

### Narrator

Required bounded smoke:

- navigation landmarks/controls;
- Files selection;
- Settings controls;
- Preview controls;
- modal/dialog exit.

A P0/P1 core-flow accessibility failure blocks release.

---

# Lane C — W6-10C macOS Release Qualification

A real supported Apple Silicon macOS 13+ GUI host is mandatory.

> If a real Mac GUI host is unavailable, W6-10 cannot produce a GO decision.

Hosted macOS compile/test evidence does not substitute for this lane.

## C1. DMG / first-launch path

| ID | Qualification | Blocking | Required evidence |
| --- | --- | --- | --- |
| C01 | Browser-acquired DMG quarantine path | Yes | real quarantine/extended-attribute state where available |
| C02 | Finder DMG mount | Yes | real Finder mount |
| C03 | drag/copy to Applications | Yes | real copy/install flow |
| C04 | Gatekeeper first launch | Yes | actual unsigned/unnotarized behavior recorded |
| C05 | documented OS-approved override/open | Yes | app can be opened under current unsigned policy |
| C06 | installed first launch | Yes | usable Zen window |
| C07 | restart / relaunch | Yes | state remains valid |
| C08 | remove app + detach DMG | Yes | cleanup completes |

Unsigned/not-notarized warning presence is expected under current policy.
A path that cannot be completed by a normal documented OS-approved override is
release-blocking.

## C2. Whole-product GUI smoke

Required on the release `.app`:

- Overview;
- Files;
- Library;
- Browse;
- Settings;
- Organize;
- Cleanup/Operation Preview using safe disposable fixtures;
- History / Restore;
- Automation;
- Global Search;
- Dark;
- Compact;
- restored window;
- resize;
- fullscreen;
- traffic-light controls.

Look specifically for WKWebView-vs-WebView2 differences in:

- font metrics;
- line height;
- borders;
- shadows;
- popovers;
- focus;
- scroll behavior.

## C3. Zen Quick Preview — shared product path

Required on the real Mac release app:

- Floating Preview;
- Pinned Preview;
- Markdown document mode;
- image Preview;
- PDF >1 MiB;
- PDF continuous pages 1/2/3;
- late-page rendering;
- fast/trackpad continuous scrolling;
- resize while Preview is open;
- close while rendering;
- source switch while loading;
- pinned source freeze;
- Loading / Failed;
- Details closed/open.

This specifically verifies that the Windows-focused W6-09 improvements remain
correct under WKWebView/macOS input and display behavior.

## C4. Native Quick Look representation

The W4-02 architecture remains authoritative.

W6-10 must requalify the **current RC** on a real Mac.

Blocking minimum scope:

- native Quick Look PDF representation opens from Zen Preview;
- source is the bounded staged snapshot, not an escaped original path;
- open/close lifecycle;
- source switch;
- cancellation;
- rapid A -> B switching;
- close/dispose cleanup;
- native failure produces truthful fallback/unavailable behavior;
- no stuck native view after Preview close;
- no stale representation publishes over a newer source.

Office/iWork/media are **not** unconditional release blockers because W4 did not
freeze them as unconditional strong-native support. They may be recorded only
when real runtime capability/fixtures exist.

## C5. macOS display / input / accessibility

### Retina

**Release-blocking visual smoke.**

Inspect:

- text;
- icons;
- 1px borders/dividers;
- Preview PDF/image;
- titlebar/traffic lights;
- popovers;
- resize/fullscreen.

### Input

Required:

- Space Preview;
- Escape;
- Command shortcuts relevant to current product;
- Tab/Shift+Tab;
- trackpad two-finger scroll;
- momentum/inertial PDF scrolling;
- focus restoration after Preview / native Quick Look closes.

### VoiceOver

Required bounded smoke:

- sidebar/navigation;
- Files selection;
- Settings controls;
- Preview controls;
- modal/dialog exit.

A P0/P1 core-flow accessibility failure blocks release.

### Reduce Motion / Increase Contrast / Reduce Transparency

Execute a bounded native smoke where the OS setting is available.

Do not demand pixel identity with Windows; require semantic clarity, readable
focus/selection and no unusable animation/material behavior.

---

# Lane D — W6-10D Cross-platform Safety / Recovery Qualification

Use disposable fixtures only.

Required:

- Operation Preview remains before mutation;
- stale identity/revalidation stays fail-closed;
- Safe Trash / Restore representative smoke;
- cancel/restart recovery;
- first-launch/restart state recovery;
- Browse first-scan/restart recovery;
- Organization Plan fail-closed behavior under supported environment;
- Global Index truthfulness when no usable source exists.

No personal-file destructive sweep is required.

A demonstrated filesystem safety or recovery P0 blocks release immediately.

---

# Lane E — W6-10E Release Path / Artifact Qualification

Required for the same frozen RC:

- release workflow provenance is exact-SHA;
- Windows installer hash matches recorded artifact;
- macOS DMG hash matches recorded artifact;
- checksum manifests verify;
- exactly two valid CycloneDX SBOM documents;
- package architecture/version is correct;
- no stale installer from historical W5 candidate is reused;
- tag remains absent before final GO;
- GitHub Release remains absent before final GO;
- release copy truthfully says unsigned/not notarized and no updater.

Cross-version update from an older **public** release remains non-blocking until
such a real older public fixture exists.

---

# Lane F — W6-10F Final Release Decision

Only two product outcomes are allowed.

## GO — RELEASE ACCEPTED

GO requires:

1. Lane A PASS;
2. all release-blocking Windows rows PASS;
3. all release-blocking macOS rows PASS;
4. Windows DPI 100/125/150 PASS;
5. Windows Forced Colors PASS;
6. macOS Retina PASS;
7. required Narrator/VoiceOver/Reduced Motion smoke executed with no unresolved
   P0/P1 core-flow issue;
8. release-path artifact integrity PASS;
9. no unresolved P0/P1 release blocker;
10. all remaining genuine-fixture residuals explicitly listed;
11. Owner explicitly approves publication;
12. publication still occurs as a separate action after this decision.

GO does not itself create a tag or GitHub Release.

## NO-GO — RELEASE NOT ACCEPTED

Any hard blocking FAIL or UNVERIFIED row yields NO-GO.

The result must name concrete blockers.

Remediation after NO-GO must be bounded to demonstrated release defects.
W6-10 must not become another product redesign wave.

---

# 6. Platform parity rule

Zen Canvas does not require pixel-identical Windows and macOS implementations.

Required parity:

- same product model;
- same safety/identity truth;
- same Solid / Calm visual language;
- same core Preview lifecycle;
- same release quality bar.

Allowed/native differences:

- Windows caption controls / Explorer Preview Handler;
- macOS traffic lights / fullscreen / Quick Look / trackpad conventions;
- platform-native focus and installer behavior.

Principle:

> **Same Zen product; native where it matters.**

## 7. Evidence package rule

Each platform lane must produce a bounded manifest-bound evidence package.

Every evidence package records:

- RC source SHA/tree;
- package/artifact SHA-256;
- OS version;
- hardware architecture;
- display scale;
- tested settings/state;
- screenshot/log/checklist paths;
- PASS/FAIL/UNVERIFIED per matrix row.

Do not produce dozens of redundant screenshots. Evidence must be sufficient to
prove the acceptance row.

## 8. W6-10 activation boundary

This matrix being merged does **not** activate W6-10.

Separate activation is required.

That activation must:

1. start from the exact then-current `master`;
2. confirm no tag/release already exists for the chosen version;
3. freeze RC1;
4. bind all later evidence to RC1;
5. authorize only release qualification and bounded evidence-derived
   remediation;
6. preserve publication as a separate final action.
