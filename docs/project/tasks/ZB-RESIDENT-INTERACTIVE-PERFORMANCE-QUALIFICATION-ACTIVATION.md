# Resident / Interactive Performance Qualification — Activation

## Identity

- Issue: [#268](https://github.com/ArdenZC/Zen-Canvas/issues/268)
- Branch: `perf/resident-interactive-qualification`
- Baseline: `master@6d38208741d186988468ec92b632dd3669a03aa5`
- Track type: **implementation — qualification evidence plus the specifically bounded managed-scan traversal/QoS repair below**
- Product tuning: **the repeated Windows miss is diagnosed at the scanner worker boundary; no broader tuning is authorized**

## Historical evidence that must not be overstated

ZB-01 recorded the existing test-process resource suite as PASS but explicitly classified native application process footprint as **INCONCLUSIVE / NOT ATTRIBUTABLE**. It also recorded a managed-scan foreground TARGET MISS: pressure first-page p95 `283 µs` versus idle `133 µs` (slightly above the existing 2x target), with `foreground_wait_ms=136`. The 136 ms value includes the test's intentional cancellation delay and is not itself the 2x target metric.

The current Track must re-measure the merged Zero-Burden runtime rather than inherit either a PASS or FAIL from that historical run.

## Phase 0 — baseline only

Before changing production behavior:

1. Build the exact branch candidate.
2. Add only the minimum native-QA/performance harness needed to obtain attributable evidence.
3. Run the resident and interactive qualification matrix.
4. Record every raw metric and classification.

If all authoritative HARD gates pass and all qualification-required TARGETS are met, do not optimize anything.

If a TARGET is missed, reproduce it before modifying product code. Keep all misses in the result.

## Phase 1 — true resident-process evidence

### Windows

Use a disposable hosted Windows environment or an equally isolated exact-candidate host.

- Build the exact candidate with the narrow QA seam already used for isolated profile evidence.
- Use a task-owned profile; do not touch the installed user's profile.
- Start Zen with `--background`.
- Prove startup mode is background and Main/Search/WebView count is zero.
- If Windows Global Index service is included, register the exact same candidate image as the disposable service and measure the app and service as distinct process roles. Preserve same-image validation.
- Wait for task-owned indexing/baseline activity to settle before resident sampling.
- Record actual process Working Set/RSS, PrivateUsage-equivalent private committed memory, handle count and CPU-time deltas over a bounded settled window.
- Record Global Index coordinator/wait deltas if the existing QA trace is available.
- Do not declare an absolute memory PASS based on a newly invented MB cap. Resource values are observational; HARD failure is process death, unexpected WebView creation, non-settlement, or a demonstrated unbounded monotonic growth/resource-leak pattern.
- Guaranteed cleanup must stop/delete the task service and remove only task-owned profile/fixture resources.

### macOS

On hosted Apple Silicon/macos runner:

- Build the exact candidate and use an isolated task-owned profile.
- Start `--background`; prove the resident process remains alive with no Main/Search WebView.
- Record resident RSS, fd count and CPU-time observations over the same bounded settled concept.
- Do not turn inability to launch a background app on the hosted environment into a fake PASS. Record the exact platform error and BLOCK/UNVERIFIED that row if the runner cannot provide the required process evidence.
- This is performance evidence, not macOS release qualification or GUI/Retina acceptance.

## Phase 2 — interactive qualification

Retain the existing performance authority in `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`.

At minimum collect exact-head evidence for:

- managed-library Search/query gates already enforced by the performance harness;
- Browse first useful/progressive behavior and existing latency targets;
- Preview shell/useful-representation targets;
- Workspace resource-settlement/no-leak HARD gates;
- the real managed-scan scheduler-pressure test.

### Managed-scan confidence rule

Run `managed_scan_pressure_preserves_foreground_browse_and_releases` as a dedicated qualification observation at least three independent times on the same exact head and runner class.

For every run record:

- idle first-page p95;
- pressure first-page p95;
- pressure/idle ratio;
- foreground wait diagnostic;
- structural HARD classification;
- target classification.

The existing product TARGET remains:

`pressure first-page p95 <= 2 × idle first-page p95`.

Do not change this threshold.

Do not discard or average away a TARGET MISS. If any qualification observation misses, the Track remains **PERFORMANCE REVIEW REQUIRED** until the miss is diagnosed and owner-reviewed. A later rerun may demonstrate non-reproducibility but must not erase the original evidence.

## Phase 3 — bounded remediation, only if required

Only after a reproducible miss, a production fix may address the confirmed cause while preserving WorkScheduler and managed-scanner authority. The current bounded repair is:

- A managed scan's admitted CPU grant is the only input to traversal parallelism.
- One admitted CPU uses `Parallelism::Serial`, keeping traversal on the scanner worker that already has background QoS.
- More than one admitted CPU uses a new Rayon pool bounded to that grant.
- Add deterministic tests for `lease.cpu == 1 -> Serial` and `lease.cpu > 1 -> RayonNewPool(lease.cpu)`.
- Preserve scanner cancellation/finalization tests and scheduler/resource-governor behavior.
- Do not change the 2x target, hard-code Windows capacity to 2, bypass WorkScheduler, add a scheduler, alter durable scan authority, or change the 15-second background-progress boundary.

After this repair, run the full Workspace Foundation managed-scan observation and three independent managed-scan observations on one exact Windows candidate/runner. Preserve every raw sample and classification. Every structural result must remain HARD PASS; the target remains pressure p95 <= 2x idle p95.

If any repaired Windows observation still misses, stop production changes. Add a test-only causal matrix at effective scan slots 1, 2, 3 and 4 on the same runner, exact candidate and fixture. Record idle/pressure p95, ratio, foreground wait/admission, background progress, scheduler queued/running/grants, scan progress and settlement. Use the result to distinguish slot-sensitive contention from a one-slot filesystem/database/Browse issue before proposing any further production work.

On macOS, add native-qa-only coarse startup checkpoints for process entry, Tauri setup, database readiness, core runtime owners, tray, autostart sync, hotkey, watcher, macOS lifecycle and setup completion. Checkpoint messages must be deterministic and contain no paths or user data. If the process enters main but never enters Tauri setup, record `abort before Zen user setup`; only the exact runtime versions and matching upstream evidence may support an upstream classification. Do not upgrade Tauri opportunistically, patch/vendor tao, catch foreign exceptions or claim resident PASS from a startup trace.

Attempt one bounded LLDB batch backtrace on hosted macOS for `objc_exception_throw` / `__rust_foreign_exception` when available. Record `DIAGNOSTIC AVAILABLE` only when a backtrace is actually captured; otherwise record `DIAGNOSTIC UNAVAILABLE`. Do not let LLDB absence/failure block the qualification itself and do not leave debugger/candidate processes running.

Repeat browser-only Preview qualification five independent times on Windows and macOS at the final repaired production candidate. Preserve scenario, viewport, raw shell/useful samples, p95 values and classifications. Do not modify Preview production code. Keep all four historical Preview TARGET MISSES. Repeated final-head passes may be presented to the owner as non-reproduction; they do not erase historical blockers.

When `background_progressed_after_release` fails, emit failure-only diagnostics for the extra scan durable status, cancelled original run status, scheduler running/queued/background grants, total grants before/after, replacement scan queued/running state and a scan progress marker. Preserve the 15-second boundary and existing cancellation/finalization requirements.

## CI / evidence

Prefer a routed/manual qualification job rather than permanently making every normal PR pay the full resident qualification cost.

Any new qualification script must:
- bind artifacts to source SHA/tree;
- emit machine-readable metrics plus human-readable summary;
- preserve raw TARGET MISS evidence;
- separate Windows app process from service process;
- guarantee task-owned cleanup;
- never modify owner production services or profiles.

Normal repository CI still must pass on the final head.

## Result

Create:

`docs/project/tasks/ZB-RESIDENT-INTERACTIVE-PERFORMANCE-QUALIFICATION-RESULT.md`

The result must include exact candidate identity, platform/runner, raw resident samples, raw interactive metrics, repeated managed-scan observations, classifications, any repair, final CI, residual limitations, and the final AI gate disposition.

Allowed disposition before owner review:

- `READY FOR OWNER PERFORMANCE RE-REVIEW` only when all actionable repairs/evidence are complete and no unresolved performance failure remains.
- `BLOCKED / PERFORMANCE REVIEW REQUIRED` while any required result remains failed, missing or unattributed.

Do not write `OWNER REVIEW PASSED` yourself. Keep PR #269 Draft and do not merge.

## Scope guard

Do not start:
- AI Semantic Authority;
- AI-only Organize/Cleanup;
- Rules migration;
- onboarding redesign;
- release publication;
- SmartScreen/UAC evidence;
- macOS release qualification;
- visual redesign.

Do not use Codex Review. Owner review is direct ChatGPT diff/evidence review.
