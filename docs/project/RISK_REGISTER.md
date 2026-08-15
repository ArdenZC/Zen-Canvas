# Zen Canvas Current Risk Register

This register summarizes currently open project-level risks. Historical remediation risk registers remain detailed evidence for their domains and are not rewritten here.

Severity guide:

- **P0** — can violate core data/safety/recovery boundaries or make a release unsafe.
- **P1** — can materially misrepresent project/product truth or create a serious authority/quality regression.
- **P2** — important maintainability, verification or operational risk with bounded current impact.

| ID | Severity | Risk | Current mitigation / gate | State |
| --- | --- | --- | --- | --- |
| R-GOV-001 | P1 | Current-stage/baseline/evidence drift across AGENTS, design execution and QA closeouts | `docs/project/STATUS.md` is the unique current-state source; G1B converged public/evidence pointers; governance consistency checks detect machine-checkable drift | controlled / continuous |
| R-ARCH-001 | P1 | Compatibility adapters accidentally become permanent second authorities | Architecture map plus explicit debt exit conditions; authority contract tests | active |
| R-FS-001 | P0 | Filesystem mutation bypasses identity, preview, journal or recovery boundaries | Backend-owned platform safety, Operation Preview/revalidation, journals, Safe Trash/Restore, supported-platform quality gates | controlled / continuous |
| R-INDEX-001 | P1 | Partial, stale or unhealthy index coverage is presented as complete/current | durable scan/root/watcher revisions and explicit partial/reconciliation states; UI must not infer completion from loaded rows | controlled / continuous |
| R-OPS-001 | P0 | Restore or cleanup operates on stale identity or renderer-provided paths | ID-only intents, backend identity revalidation, cleanup/operation ledgers and recovery contracts | controlled / continuous |
| R-AI-001 | P1 | Provider output or cloud use silently becomes authority/consent | Managed AI/provider policy, explicit content/rule boundaries, no automatic mutation/enable/run/send | controlled / continuous |
| R-PERF-001 | P1 | Managed-library/global-search regressions appear only at 100k/1M scale | Existing architecture/performance profiles and exact-head CI; thresholds may not be silently weakened | controlled / continuous |
| R-PLAT-001 | P2 | macOS provider/external/network-volume and broader race behavior is less verified than core native mutation path | Keep unsupported/unknown states fail-closed; expand exact-head native fixtures before claiming broader verification | active |
| R-REL-001 | P2 | Packaged builds are mistaken for a published release; signing/notarization remains incomplete | Four-state Implemented/Validated/Packaged/Released vocabulary; `STATUS.md` records no published release/tag | active |
| R-BRANCH-001 | P2 | Historical branches create false signals about unmerged work after squash/integration | Closeout requires ancestor/content-equivalence proof and branch deletion; the known historical branch set was audited and removed | controlled / continuous |

## No open P0 implementation blocker recorded by G0

The G0 governance/authority audit did not identify a known current P0 defect requiring product-development shutdown. That statement is not a permanent safety guarantee; any new P0 finding immediately overrides roadmap sequencing until it is contained.

## Risk-update rule

Add or change a project-level risk when an initiative changes one of these facts:

- durable authority or persistence;
- filesystem mutation/recovery safety;
- privacy/provider consent;
- platform support;
- performance or release gates;
- project truth/governance.

Do not copy every implementation bug into this register. Keep detailed, temporary findings in the active initiative or PR review unless they change project-level risk.
