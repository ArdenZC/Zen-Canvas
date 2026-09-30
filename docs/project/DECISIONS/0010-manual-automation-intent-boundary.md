# ADR-0010 — Manual Automation Intent boundary

Status: Accepted scope from Owner-reviewed PM-02A activation PR #312 and its explicit implementation authorization.

PM-02A adds SQLite Automation Intent and Run records in Schema 36. Intents retain canonical FileQuerySpecV2 semantics; a manual Run resolves a fresh backend snapshot and references the existing Organization Plan ledger. Only organize_plan/manual/review-required/auto-execute-false is supported.

Run admission and Organization materialization share one transaction, binding a globally unique request key to one Intent revision and one Plan. Existing Organization proposal semantics are reused without alteration. Missing semantic work uses the existing bounded Managed AI analysis enqueue owner after materialization. Already-current assessments do not require fresh provider readiness.

Automation is not a filesystem executor. It cannot accept decisions, request Dry Run, execute plans or invoke Cleanup, shell or operation mutation. There is no new worker, scheduler, polling loop or AI queue. Rule Repository V2 and watcher Rule behavior remain unchanged. PM-02B and PM-03 require separate activation.

Authority: [PM-02A activation](../tasks/AI-ONLY-PM-02A-AUTOMATION-INTENT-FOUNDATION-ACTIVATION.md). This records the accepted bounded contract; it introduces no authority beyond that activation.
