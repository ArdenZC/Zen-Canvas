# W4-05 — No-Sign Disposition / Current Truth

Status: **COMPLETE / CLOSED — SIGNING / NOTARIZATION DEFERRED BY PRODUCT DECISION**

Last verified: 2026-09-02

## Canonical baseline

This disposition starts from:

- `master@bfddfddae5798543adeccde3f6a56bcd8ff87337`;
- tree `121b262cef3e43fe00209d379c741aa3d740ea76`;
- W4-05 activation PR #166;
- W4-05 gap-audit PR #167.

The W4-05 gap audit remains valid evidence of what the repository can support technically, but its later `IMPLEMENT` authorization for production signing integration is superseded by this newer product decision.

## Product decision

As of 2026-09-02 the project has **no production signing credentials and does not plan to obtain or operate production signing/notarization credentials for the foreseeable future**.

This includes:

- Windows Authenticode certificate / managed signing identity;
- Apple Developer ID Application identity;
- Apple notarization credentials;
- production timestamp/signature operations dependent on those identities.

Therefore W4-05 must not add dormant production-signing workflow complexity merely to prepare for credentials that are not planned.

## W4-05 final disposition

W4-05 closes with the following truth:

### Packaging / registration

Already complete through accepted W4-04 production evidence:

- Windows x64 NSIS packaging;
- per-machine Preview Handler registration;
- service / registry ownership;
- 16-extension Preview association matrix;
- repair / uninstall / reinstall lifecycle;
- foreign-state preservation;
- mapped Preview DLL servicing;
- genuine Explorer / Low Integrity `prevhost.exe` acceptance;
- artifact checksum / SBOM / exact-SHA provenance;
- macOS Apple-Silicon DMG engineering packaging;
- macOS hardened runtime configuration.

No additional installer or registration implementation is required by W4-05.

### Signing / notarization

Final W4-05 classification:

- Windows Authenticode: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**;
- Preview Handler DLL signing: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**;
- Windows installer signing: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**;
- macOS Developer ID signing: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**;
- Apple notarization / stapling: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**.

No repository/configuration implementation is required for those deferred items now.

## Unsigned package truth

The existing unsigned engineering package behavior remains intentional current product truth:

- Windows artifacts may be unsigned;
- macOS engineering DMG continues to use the current unsigned path;
- no Authenticode, Developer ID, notarization or stapling PASS may be claimed;
- platform warnings such as Unknown Publisher / Gatekeeper limitations must remain truthful wherever release documentation is later authored;
- checksum, SBOM, version/architecture and exact-SHA provenance checks remain required.

This W4-05 closeout does **not** itself authorize public release publication. W5 owns final release/publication policy and must evaluate the consequences of unsigned distribution from the actual future release context.

W5 must not assume that signing credentials will become available.

## Superseded W4-05 implementation authorization

The following items from `W4-05-SIGNING-PACKAGING-REGISTRATION-GAP-AUDIT.md` are no longer authorized for implementation in W4:

- engineering-vs-production signing workflow mode;
- Windows certificate secret interfaces;
- Authenticode signing helpers;
- Preview Handler DLL signing hooks;
- macOS Developer ID credential wiring;
- Apple notarization credential wiring;
- signature / notarization verification jobs that exist only for unavailable production identities;
- focused tests whose sole purpose is to enforce those dormant signing paths.

They may be reconsidered only after an explicit future product decision to adopt signing/notarization.

## No-code closeout

No production source, workflow, package config, installer file, test or schema change is required to close W4-05 under this disposition.

The accepted current unsigned package pipeline is intentionally preserved.

This avoids adding:

- unused secret interfaces;
- unreachable signing branches;
- CA/provider-specific assumptions;
- release complexity with no current user value;
- false acceptance evidence.

## Scope preserved

This disposition does not reopen:

- W4-02 native Quick Look architecture;
- W4-03 v2 / ADR-0006;
- W4-04 Windows Preview Handler runtime;
- NSIS lifecycle authority;
- association ownership;
- service authority;
- Preview renderer/provider authority;
- package version;
- GitHub Release publication;
- update channels;
- W5.

## Completion decision

W4-05 is **COMPLETE / CLOSED** because:

1. all currently required packaging/registration product behavior is already accepted;
2. the only remaining gap identified by the audit is production signing/notarization;
3. production signing/notarization is explicitly not planned for the foreseeable product horizon;
4. adding dormant signing infrastructure is therefore not required for current W4 acceptance;
5. unsigned artifact truth remains explicit rather than being misclassified as signed/release-ready;
6. no W4-05 runtime or installer blocker remains.

## Sequencing

W4-06 — **Native Accessibility / DPI / Performance / Resource QA** is authorized next after this disposition merges.

W4-07 remains downstream.

W5 remains **NOT AUTHORIZED / NOT ACTIVE**.
