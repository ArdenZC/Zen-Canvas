# Zero-Burden Cross-Track Audit Remediation

Status: **ACTIVE — implementation complete; CHANGES REQUESTED / OWNER REVIEW PENDING; hosted Windows/macOS CI SUCCESS on Production HEAD `06531c55f04cbe6a4b47d66305fcf262f74a223a`; Draft PR #267 remains open for owner re-review**

Baseline: `master@316db9a09261dd3f6d3935aae68d261c45485cf9` (tree `5091a6899b5570aeb776eea503b0f1ea62dbacb9`).

Branch: `remediation/zero-burden-cross-track-audit`.

Initial production commit: `6306d6ecb82b475c1495f7ac6b25ec7d255cff29`.

Production HEAD: `06531c55f04cbe6a4b47d66305fcf262f74a223a`.

## Purpose

Close the runtime, privacy, test-truth and documentation-truth findings left by the Zero-Burden Foundation audit. This is a bounded remediation Track, not a feature Track.

## Authorized scope

- Distinguish intentional last-WebView resident teardown from explicit or native process exit with process-local, one-shot intent.
- Replace raw single-instance argument and working-directory logging with classified, sanitized diagnostics.
- Remove idle polling from the macOS lifecycle observer and FileWorkspace ephemeral change worker.
- Separate PDF timeout/cancellation correctness from CI wall-clock latency expectations.
- Make Thumbnail cancellation/disposal tests deterministic and close any confirmed late cache-publication window.
- Reconcile `STATUS.md`, `ROADMAP.md` and `ARCHITECTURE_MAP.md` with the merged Zero-Burden foundation and actual runtime ownership.

Durable authorities remain unchanged: Global Index, Browse, managed Content, Thumbnail Read Gate, WorkScheduler and filesystem mutation/recovery contracts remain authoritative. Native notifications and Browse change events are hints; they do not become durable row truth.

## Non-goals

This Track does not include resident/interactive performance qualification, AI semantic authority or AI-only Organize/Cleanup, Rules migration, onboarding redesign, schema changes, Search V3, a new Preview engine, worker/scheduler architecture, release publication, SmartScreen/UAC evidence collection, macOS release qualification or owner native visual acceptance.

Resident / Interactive Performance Qualification is the next stage after this PR merges. AI Semantic Authority remains gated after foundation and performance work.

## Validation and closeout

Focused Rust and Browse integration checks, formatter, narrow Clippy and diff checks precede the final hosted Windows/macOS integration pass, run `36217885372` on Production HEAD `06531c55f04cbe6a4b47d66305fcf262f74a223a`. A later docs-only successor must identify that source-head distinction.

The pull request remains Draft until owner review. Do not request Codex Review, mark Ready, merge or publish a release. Closeout evidence is recorded in [the remediation result](../tasks/ZB-CROSS-TRACK-AUDIT-REMEDIATION-RESULT.md).

The completed foundation sequence remains recorded in the [ZB-01](../tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md), [ZB-02](../tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md), [ZB-03](../tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md), [ZB-04](../tasks/ZB-04-ON-DEMAND-UI-RUNTIME-RESULT.md) and [ZB-05](../tasks/ZB-05-NATIVE-GLOBAL-SEARCH-RUNTIME-RESULT.md) results.
