# W1-05 — WorkScheduler — Codex Implementation Brief

Status: active implementation task

Baseline: `master@3f30f12fea23961e03b4021d0ffa63c80377167b` (W1-01 / F1 merge)

Branch: `feat/w1-05-work-scheduler`

## Goal

Implement a non-durable resource coordination layer for File Library 2.0 / Preview Platform work. WorkScheduler decides when/how much work may run; it never owns durable job lifecycle, retry/recovery state, or filesystem truth.

## Required behavior

- Reuse W1-01 `WorkClass`: `foreground`, `interactive`, `background`.
- Implement an RAII/resource-lease model suitable for CPU/IO/open-handle/decoder/native/provider capacity. Keep the first implementation small but extensible.
- Requests declare bounded resource hints; scheduler grants/releases leases and exposes instrumentation useful for W1-11.
- Foreground > Interactive > Background priority, while Background must have bounded fairness/aging so it cannot starve forever.
- Queueing/backpressure must be bounded; duplicate or superseded session-bound work should be cancellable by callers.
- Cancellation semantics: Scheduler may delay/throttle resource acquisition, but durable authorities retain ownership of job cancellation/state.
- Introduce a platform resource-policy interface. Adapt the existing macOS Activity/Thermal/Low Power policy rather than reimplementing it. Windows policy may start conservative/minimal if no equivalent authority exists yet.
- Add bounded resource-lease adapters to only the selected existing heavy paths necessary to make later scheduler-interference testing real (prefer scan/index/reconciliation paths already identified by W1). These adapters must not transfer lifecycle ownership to Scheduler.
- Keep observability explicit: queued/running counts and granted resource classes should be inspectable in tests/metrics without creating persistent state.

## Required tests

At minimum:

- foreground work is admitted before queued lower-priority work when resources contend;
- background makes eventual progress under sustained interactive load;
- resource lease drop/release returns capacity deterministically;
- cancelled waiter cannot consume/publish a later lease;
- queue/backpressure is bounded under overload;
- resource counters return to steady state after repeated acquire/release;
- macOS policy adapter respects existing critical thermal / low-power semantics without blocking essential foreground work;
- selected existing heavy-authority adapter demonstrates lifecycle remains owned by that authority while resource permission comes from Scheduler.

Avoid flaky wall-clock tests where a deterministic fake clock/policy can be used.

## Hard boundaries

Do NOT create `scheduler_jobs` tables, durable queues, generic retry/recovery runtime, or take ownership of Scan/Dedupe/Analysis/Content job state. Do not alter existing job IDs/state machines/cancellation contracts.

Do not tune/change existing CI performance thresholds in this PR. W1-11 owns formal performance gates.

Do not implement Preview, Thumbnail, Browse UI or W1-10 API wiring.

## Protected hotspots

Existing scan/reconciliation and macOS activity policy are authoritative. Prefer adapters/wrappers and minimal insertion points. Explain every change to an existing heavy authority in the PR report.

## Definition of Done

- Bounded, cancellable, observable resource-leasing scheduler exists.
- Priority + fairness + deterministic release are tested.
- At least the approved real-heavy-path adapter needed for future interference testing is present without stealing lifecycle authority.
- No durable authority/schema/dependency expansion unless already present and strictly required; stop for architecture review if that becomes necessary.
- Rust fmt/tests/clippy and relevant platform compile checks pass; report skipped checks honestly.
- Leave PR Draft for independent review.