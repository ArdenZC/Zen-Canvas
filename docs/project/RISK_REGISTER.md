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
| R-AI-001 | P1 | Provider output or cloud use silently becomes authority/consent | Managed AI/provider policy, explicit content/rule boundaries, no automatic mutation/enable/run/send; onboarding no longer configures AI and existing cloud credential activation remains fail-closed | controlled / continuous |
| R-PERF-001 | P1 | Managed-library/global-search/File Workspace regressions appear only at 100k/1M scale or under background-resource pressure | Query V2 100k/1M gates plus W1 Workspace Foundation 100k Windows/macOS performance lanes and exact-head Full Validation; thresholds may not be silently weakened; W1 Scheduler 2x-idle pressure comparison remains `TARGET MISSED` | controlled / continuous |
| R-PLAT-001 | P2 | macOS provider/external/network-volume and broader race behavior is less verified than core native mutation/local-filesystem paths | Real iCloud/File Provider/external APFS/exFAT/SMB/network and other unavailable fixture claims remain **UNVERIFIED** until genuine evidence exists | active |
| R-REL-001 | P2 | Packaged artifacts, unsigned distribution behavior or deferred update capability are misrepresented as a published/reputation-accepted/auto-updating release | Implemented/Validated/Packaged/Released vocabulary; exact-SHA release gate; current `v0.1.40` action is explicitly deferred and no tag/release may be created while W6 maturity deferral is active | active / publication deferred |
| R-PROD-001 | P1 | Technical release readiness is mistaken for product maturity, causing Zen Canvas to be publicly released before core workflows, coherence and polish meet the product-owner bar | W6-01 established the maturity gate; W6-02 closed first-value/root-recovery blockers at validated production head `b01bc30f...`; remaining M1 Settings/AI-persistent-chrome/shell-hierarchy work must close through separately activated Tracks before release re-entry | active / remediation in progress |
| R-BRANCH-001 | P2 | Historical branches create false signals about unmerged work after squash/integration | Closeout requires ancestor/content-equivalence proof before deletion; branch cleanup remains separate from product correctness | controlled / continuous |

## No open P0 implementation blocker recorded by G0/W6

The earlier G0 governance/authority audit and W6 maturity work have not identified a known current P0 filesystem/data-loss/security defect requiring product-development shutdown. That statement is not a permanent safety guarantee; any new P0 finding immediately overrides roadmap sequencing until contained.

## W5 release-engineering evidence note

W5 is complete / closed. Its historical exact release-qualified candidate is `8b573772d842b4996bc1c34161236fa47025cc83` / tree `67cf3da35d7556bb868746a9ae0a56725558a163`.

`CI Full Validation` `33942690517` and `Build Release Installers` `33943755887` completed successfully on that exact SHA. The accepted workflow includes the #189 duplicate-SBOM fix and the evidence set contains verified Windows/macOS installer checksums plus exactly two valid CycloneDX 1.6 SBOMs.

W5-04 native Windows/macOS manual acceptance remains `UNVERIFIED / EXPLICITLY DEFERRED`: SmartScreen/Unknown Publisher, Gatekeeper/quarantine, native install/copy/first-launch, Narrator/VoiceOver, Explorer Preview Handler focus and native display observations were not executed in the available browser-only environment.

These engineering facts remain historical evidence, but publication is not currently authorized.

## W6 product-maturity risk note

After W5 closeout, the product owner explicitly decided that Zen Canvas is not mature enough for public release. W6-01 supplied the evidence-backed reason and W6-02 has now closed the first implementation subset.

Audit: [`tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

W6-02 result: [`tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

W6-02 validated production head `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5` passed hosted CI `33948034597` and closes:

- first-run/first-value and restartable setup;
- root startup/database/view recovery;
- blank-startup feedback debt;
- mandatory-onboarding AI over-prominence.

It preserves the intentional fail-closed cloud AI credential boundary by removing AI configuration from mandatory onboarding rather than auto-enabling cloud behavior.

Remaining active M1 release-reentry blockers are now:

- Settings progressive disclosure of implementation architecture;
- persistent AI prominence in sidebar/Settings outside first-run;
- global shell/workspace hierarchy fragmentation.

Important M2 work remains around File Library control hierarchy, About/developer content and fresh native visual/accessibility evidence.

The maturity program must continue to favor simplification and progressive disclosure over feature expansion.

## Publication rule while W6 is active

- do not create `v0.1.40`;
- do not create a GitHub Release;
- do not treat prior W5 release evidence as current product authorization;
- do not treat W6-02 completion as product-maturity acceptance;
- do not rerun release qualification merely to pressure the project toward publication;
- because W6-02 changed production code, require a fresh future exact-SHA candidate and release evidence before any later publication;
- do not solve R-PROD-001 by indiscriminately adding updater/signing/OCR/RAG/plugins/AI breadth;
- do not weaken cloud-AI consent/credential enablement to simplify product hierarchy.

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
