# Zen Canvas Current Risk Register

This register summarizes currently open project-level risks. Historical remediation risk registers remain detailed evidence for their domains and are not rewritten here.

Severity guide:

- **P0** — can violate core data/safety/recovery boundaries or make a release unsafe.
- **P1** — can materially misrepresent project/product truth or create a serious authority/quality regression.
- **P2** — important maintainability, verification or operational risk with bounded current impact.

| ID | Severity | Risk | Current mitigation / gate | State |
| --- | --- | --- | --- | --- |
| R-GOV-001 | P1 | Current-stage/baseline/evidence drift across AGENTS, design execution and QA closeouts | `docs/project/STATUS.md` is the unique current-state source; governance consistency checks detect machine-checkable drift and the project supports a truthful between-initiatives state rather than forcing a fake active initiative | controlled / continuous |
| R-ARCH-001 | P1 | Compatibility adapters accidentally become permanent second authorities | Architecture map plus explicit debt exit conditions; authority contract tests | active |
| R-FS-001 | P0 | Filesystem mutation bypasses identity, preview, journal or recovery boundaries | Backend-owned platform safety, Operation Preview/revalidation, journals, Safe Trash/Restore, supported-platform quality gates | controlled / continuous |
| R-INDEX-001 | P1 | Partial, stale or unhealthy index coverage is presented as complete/current | durable scan/root/watcher revisions and explicit partial/reconciliation states; UI must not infer completion from loaded rows | controlled / continuous |
| R-OPS-001 | P0 | Restore or cleanup operates on stale identity or renderer-provided paths | ID-only intents, backend identity revalidation, cleanup/operation ledgers and recovery contracts | controlled / continuous |
| R-AI-001 | P1 | Provider output or cloud use silently becomes authority/consent | Managed AI/provider policy, explicit content/rule boundaries, no automatic mutation/enable/run/send | controlled / continuous |
| R-PERF-001 | P1 | Managed-library/global-search/File Workspace regressions appear only at 100k/1M scale or under background-resource pressure | Query V2 100k/1M gates plus W1 Workspace Foundation 100k Windows/macOS performance lanes and exact-head Full Validation; thresholds may not be silently weakened; the W1 Scheduler 2x-idle pressure comparison remains an explicit TARGET MISSED observation rather than being hidden or reclassified | controlled / continuous |
| R-PLAT-001 | P2 | macOS provider/external/network-volume and broader race behavior is less verified than core native mutation/local-filesystem paths | ADR-0003 Decision B uses coordinated user-visible URL plus physical identity, conservative bounded explicit-content proof, private retirement namespace and target-first `source_cleanup_pending` recovery; real iCloud/File Provider/external APFS/exFAT/SMB/network and other unavailable fixture claims remain **UNVERIFIED** until exact-head real-fixture evidence exists | active |
| R-REL-001 | P2 | Packaged artifacts, unsigned distribution behavior or deferred update capability are misrepresented as a published/reputation-accepted/auto-updating release | Four-state Implemented/Validated/Packaged/Released vocabulary; W5-02 exact-SHA release qualification; W5-03 manual-download/install first-release policy with updater `NOT IMPLEMENTED / DEFERRED`; W5-04 records native/manual SmartScreen/Gatekeeper/platform acceptance as `UNVERIFIED / EXPLICITLY DEFERRED`; W5-06 explicitly accepts that residual uncertainty and authorizes publication only for exact candidate `5f6dcc6...` under tag `v0.1.40`; the operational publication action remains fail-closed on tag/source/version equality and release workflow success | active / explicitly accepted for first publication |
| R-BRANCH-001 | P2 | Historical branches create false signals about unmerged work after squash/integration | Closeout requires ancestor/content-equivalence proof before deletion; merged historical branches are cleanup candidates only after preservation/equivalence proof, while branch deletion stays separate from product correctness | controlled / continuous |

## No open P0 implementation blocker recorded by G0

The G0 governance/authority audit did not identify a known current P0 defect requiring product-development shutdown. That statement is not a permanent safety guarantee; any new P0 finding immediately overrides roadmap sequencing until it is contained.

## W1 closeout risk note

W1 Foundation completion does not close platform/release risks that require later real product fixtures or release work. Scheduler pressure latency remains a measured optimization target miss, provider/network/external-volume fixture gaps remain open evidence obligations, and signing/notarization remains deliberately absent. None is converted into a correctness PASS claim.

## W5 final release-policy risk note

W5 is complete / closed. W5-06 selected **AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK** for the first public release.

The accepted release candidate is `5f6dcc643bec099e3b011af97c046ebc53d2772a` / tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`, with successful exact-SHA `CI Full Validation` and successful release-installer workflow evidence.

W5-04 native Windows/macOS manual acceptance remains `UNVERIFIED / EXPLICITLY DEFERRED`: SmartScreen/Unknown Publisher, Gatekeeper/quarantine, real native install/copy/first-launch, Narrator/VoiceOver, Explorer Preview Handler focus and native display observations were not executed in the available browser-only Computer Use environment. This is an accepted uncertainty for the first publication, not PASS.

The separately authorized `v0.1.40` publication action must bind the tag exactly to the accepted candidate and must pass the existing tag-triggered release qualification/final artifact checks. Current release/tag state remains none until that action actually succeeds. A failed publication attempt must remain visible and may not be rewritten as `Released`.

Any future updater must separately own its update-authenticity key, endpoint/manifest, artifact, version, privilege and rollback risks before implementation.

## Risk-update rule

Add or change a project-level risk when an initiative changes one of these facts:

- durable authority or persistence;
- filesystem mutation/recovery safety;
- privacy/provider consent;
- platform support;
- performance or release gates;
- project truth/governance.

Do not copy every implementation bug into this register. Keep detailed, temporary findings in the relevant initiative, task or PR unless they change project-level risk.
