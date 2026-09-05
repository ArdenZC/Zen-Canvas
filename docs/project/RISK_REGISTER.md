# Zen Canvas Current Risk Register

This register summarizes currently open project-level risks. Historical remediation risk registers remain detailed evidence for their domains and are not rewritten here.

Severity guide:

- **P0** — can violate core data/safety/recovery boundaries or make a release unsafe.
- **P1** — can materially misrepresent project/product truth or create a serious authority/quality regression.
- **P2** — important maintainability, verification or operational risk with bounded current impact.

| ID | Severity | Risk | Current mitigation / gate | State |
| --- | --- | --- | --- | --- |
| R-GOV-001 | P1 | Current-stage/baseline/evidence drift across AGENTS, design execution and QA closeouts | `docs/project/STATUS.md` is the unique current-state source; governance consistency checks detect machine-checkable drift | controlled / continuous |
| R-ARCH-001 | P1 | Compatibility adapters accidentally become permanent second authorities | Architecture map plus explicit debt exit conditions; authority contract tests | active |
| R-FS-001 | P0 | Filesystem mutation bypasses identity, preview, journal or recovery boundaries | Backend-owned platform safety, Operation Preview/revalidation, journals, Safe Trash/Restore, supported-platform quality gates | controlled / continuous |
| R-INDEX-001 | P1 | Partial, stale or unhealthy index coverage is presented as complete/current | durable scan/root/watcher revisions and explicit partial/reconciliation states; UI must not infer completion from loaded rows | controlled / continuous |
| R-OPS-001 | P0 | Restore or cleanup operates on stale identity or renderer-provided paths | ID-only intents, backend identity revalidation, cleanup/operation ledgers and recovery contracts | controlled / continuous |
| R-AI-001 | P1 | Provider output or cloud use silently becomes authority/consent | Managed AI/provider policy, explicit content/rule boundaries, no automatic mutation/enable/run/send; onboarding cloud choice remains fail-closed until credentials are configured | controlled / continuous |
| R-PERF-001 | P1 | Managed-library/global-search/File Workspace regressions appear only at 100k/1M scale or under background-resource pressure | Query V2 100k/1M gates plus W1 Workspace Foundation 100k Windows/macOS performance lanes and exact-head Full Validation; thresholds may not be silently weakened; W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED` | controlled / continuous |
| R-PLAT-001 | P2 | macOS provider/external/network-volume and broader race behavior is less verified than core native mutation/local-filesystem paths | Real iCloud/File Provider/external APFS/exFAT/SMB/network and other unavailable fixture claims remain **UNVERIFIED** until genuine evidence exists | active |
| R-REL-001 | P2 | Packaged artifacts, unsigned distribution behavior or deferred update capability are misrepresented as a published/reputation-accepted/auto-updating release | Implemented/Validated/Packaged/Released vocabulary; exact-SHA release gate; current `v0.1.40` action is explicitly deferred and no tag/release may be created while W6 maturity deferral is active | active / publication deferred |
| R-PROD-001 | P1 | Technical release readiness is mistaken for product maturity, causing Zen Canvas to be publicly released before core workflows, coherence and polish meet the product-owner bar | W6-01 is complete and records five active M1 release-reentry blockers plus M2 polish/evidence debt; publication remains deferred; implementation must proceed through separately activated audit-derived Tracks, starting with First Value & Recovery Maturity | active / audit findings established |
| R-BRANCH-001 | P2 | Historical branches create false signals about unmerged work after squash/integration | Closeout requires ancestor/content-equivalence proof before deletion; branch cleanup remains separate from product correctness | controlled / continuous |

## No open P0 implementation blocker recorded by G0/W6-01

The earlier G0 governance/authority audit and W6-01 maturity audit did not identify a known current P0 filesystem/data-loss/security defect requiring product-development shutdown. That statement is not a permanent safety guarantee; any new P0 finding immediately overrides roadmap sequencing until contained.

## W5 release-engineering evidence note

W5 is complete / closed. Its historical exact release-qualified candidate is `8b573772d842b4996bc1c34161236fa47025cc83` / tree `67cf3da35d7556bb868746a9ae0a56725558a163`.

`CI Full Validation` `33942690517` and `Build Release Installers` `33943755887` completed successfully on that exact SHA. The accepted workflow includes the #189 duplicate-SBOM fix and the evidence set contains verified Windows/macOS installer checksums plus exactly two valid CycloneDX 1.6 SBOMs.

W5-04 native Windows/macOS manual acceptance remains `UNVERIFIED / EXPLICITLY DEFERRED`: SmartScreen/Unknown Publisher, Gatekeeper/quarantine, native install/copy/first-launch, Narrator/VoiceOver, Explorer Preview Handler focus and native display observations were not executed in the available browser-only Computer Use environment.

These engineering facts remain historical evidence, but publication is not currently authorized.

## W6 product-maturity risk note

After W5 closeout, the product owner explicitly decided that Zen Canvas is not mature enough for public release. W6-01 now provides the evidence-backed reason rather than leaving that judgment vague.

W6-01 result: [`tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

The five active M1 release-reentry blockers are:

- first-run/first-value and restartable setup;
- root startup/view recovery UX;
- Settings progressive disclosure of implementation architecture;
- AI prominence relative to the core file-lifecycle story;
- global shell hierarchy / workspace fragmentation.

The initially suspected Cloud AI persistence bug was retracted. Current source, onboarding copy and tests agree that cloud selection is recorded pending setup while AI remains disabled until credentials exist. That fail-closed behavior is part of R-AI-001 and must not be weakened by maturity work.

The audit explicitly finds that product maturity should come from simplification, first-value quality and recovery quality, not from another broad feature wave.

Follow-up implementation is not implicit. Each Track must be separately activated and must preserve existing filesystem/recovery, authority, AI consent, performance and release gates.

## Publication rule while W6 is active

- do not create `v0.1.40`;
- do not create a GitHub Release;
- do not treat prior W5 release evidence as current product authorization;
- do not rerun release qualification merely to pressure the project toward publication;
- if production code changes later, require a fresh future candidate and exact-SHA evidence;
- do not solve R-PROD-001 by indiscriminately adding updater/signing/OCR/RAG/plugins/AI breadth;
- do not weaken cloud-AI consent/credential enablement to simplify first-run.

## Risk-update rule

Add or change a project-level risk when an initiative changes one of these facts:

- durable authority or persistence;
- filesystem mutation/recovery safety;
- privacy/provider consent;
- platform support;
- performance or release gates;
- product maturity/publication disposition;
- project truth/governance.

Do not copy every implementation bug into this register. Keep detailed temporary findings in the relevant initiative/task unless they change project-level risk.
