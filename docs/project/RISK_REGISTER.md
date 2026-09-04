# Zen Canvas Current Risk Register

This register summarizes currently open project-level risks. Historical remediation risk registers remain detailed evidence for their domains and are not rewritten here.

Severity guide:

- **P0** — can violate core data/safety/recovery boundaries or make a release unsafe.
- **P1** — can materially misrepresent project/product truth or create a serious authority/quality regression.
- **P2** — important maintainability, verification or operational risk with bounded current impact.

| ID | Severity | Risk | Current mitigation / gate | State |
| --- | --- | --- | --- | --- |
| R-GOV-001 | P1 | Current-stage/baseline/evidence drift across AGENTS, design execution and QA closeouts | `docs/project/STATUS.md` is the unique current-state source; governance consistency checks detect machine-checkable drift and W1-12 explicitly supports a truthful between-initiatives state rather than forcing a fake active initiative | controlled / continuous |
| R-ARCH-001 | P1 | Compatibility adapters accidentally become permanent second authorities | Architecture map plus explicit debt exit conditions; authority contract tests | active |
| R-FS-001 | P0 | Filesystem mutation bypasses identity, preview, journal or recovery boundaries | Backend-owned platform safety, Operation Preview/revalidation, journals, Safe Trash/Restore, supported-platform quality gates | controlled / continuous |
| R-INDEX-001 | P1 | Partial, stale or unhealthy index coverage is presented as complete/current | durable scan/root/watcher revisions and explicit partial/reconciliation states; UI must not infer completion from loaded rows | controlled / continuous |
| R-OPS-001 | P0 | Restore or cleanup operates on stale identity or renderer-provided paths | ID-only intents, backend identity revalidation, cleanup/operation ledgers and recovery contracts | controlled / continuous |
| R-AI-001 | P1 | Provider output or cloud use silently becomes authority/consent | Managed AI/provider policy, explicit content/rule boundaries, no automatic mutation/enable/run/send | controlled / continuous |
| R-PERF-001 | P1 | Managed-library/global-search/File Workspace regressions appear only at 100k/1M scale or under background-resource pressure | Query V2 100k/1M gates plus W1 Workspace Foundation 100k Windows/macOS performance lanes and exact-head Full Validation; thresholds may not be silently weakened; the W1 Scheduler 2x-idle pressure comparison remains an explicit TARGET MISSED observation rather than being hidden or reclassified | controlled / continuous |
| R-PLAT-001 | P2 | macOS provider/external/network-volume and broader race behavior is less verified than core native mutation/local-filesystem paths | ADR-0003 Decision B uses coordinated user-visible URL plus physical identity, conservative bounded explicit-content proof, private retirement namespace and target-first `source_cleanup_pending` recovery; W1 preserves real iCloud/File Provider/external APFS/exFAT/SMB/network and other unavailable fixture claims as **UNVERIFIED** until exact-head real-fixture evidence exists | active |
| R-REL-001 | P2 | Packaged artifacts, unsigned distribution behavior or deferred update capability are misrepresented as a published/reputation-accepted/auto-updating release | Four-state Implemented/Validated/Packaged/Released vocabulary; W5-02 exact-SHA release qualification; W5-03 manual-download/install first-release policy with updater `NOT IMPLEMENTED / DEFERRED`; W5-04 owns real SmartScreen/Gatekeeper/manual platform acceptance; `STATUS.md` records no published release/tag | active |
| R-BRANCH-001 | P2 | Historical branches create false signals about unmerged work after squash/integration | Closeout requires ancestor/content-equivalence proof before deletion; merged W1 branches are inventoried as post-W1 cleanup candidates, while branch deletion is kept separate from Foundation correctness | controlled / continuous |

## No open P0 implementation blocker recorded by G0

The G0 governance/authority audit did not identify a known current P0 defect requiring product-development shutdown. That statement is not a permanent safety guarantee; any new P0 finding immediately overrides roadmap sequencing until it is contained.

## W1 closeout risk note

W1 Foundation completion does not close platform/release risks that require later
real product fixtures or release work. In particular, Scheduler pressure latency
remains a measured optimization target miss, provider/network/external-volume
fixture gaps remain open evidence obligations, and signing/notarization remains
release work. None is converted into a W1 correctness PASS claim.

## W5 release-policy risk note

W5-03 selected manual download/install for the first public release. That decision does not imply unsigned Windows/macOS first-launch reputation acceptance, and it does not create an updater capability. W5-04 must record the real manual supported-platform warning/install/launch evidence that is material to publication. Any future updater must separately own its update-authenticity key, endpoint/manifest, artifact, version, privilege and rollback risks before implementation.

## Risk-update rule

Add or change a project-level risk when an initiative changes one of these facts:

- durable authority or persistence;
- filesystem mutation/recovery safety;
- privacy/provider consent;
- platform support;
- performance or release gates;
- project truth/governance.

Do not copy every implementation bug into this register. Keep detailed, temporary findings in the active initiative or PR review unless they change project-level risk.
