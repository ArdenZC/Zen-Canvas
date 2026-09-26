# Resident / Interactive Performance Qualification — Activation

## Identity

- Issue: [#268](https://github.com/ArdenZC/Zen-Canvas/issues/268)
- Branch: `perf/resident-interactive-qualification`
- Baseline: `master@6d38208741d186988468ec92b632dd3669a03aa5`
- Track type: **implementation — qualification harness/evidence only**
- Product tuning: **NOT AUTHORIZED until baseline evidence shows a reproducible miss**

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

Only after a reproducible miss:

- diagnose whether the cause is scheduler policy, scanner work shape, foreground admission/resource budgeting, fixture/test distortion, or host noise;
- if the test is wrong, repair the test without weakening the product target;
- if production behavior is wrong, make the smallest product fix preserving WorkScheduler and managed-scanner authority;
- do not introduce a second scheduler, direct bypass, priority hack, schema change or durable authority;
- rerun the full qualification matrix on the repaired exact head.

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

Allowed closeout before owner review:

`IMPLEMENTATION / QUALIFICATION COMPLETE — READY FOR OWNER REVIEW`

Do not write `OWNER REVIEW PASSED` yourself.

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
