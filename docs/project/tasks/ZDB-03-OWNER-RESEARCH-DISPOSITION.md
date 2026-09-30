# ZDB-03 Owner Research Disposition

Last verified: 2026-09-30

Status: **RESEARCH CHECKPOINT COMPLETE — PAUSED / NO FURTHER COMPARATIVE EXECUTION AUTHORIZED**

Issue: #283

Authoritative baseline: `master@867b67bed9476b788d2a0d2ee04e5c5b73070aa7`

## Accepted research record

ZDB-03A is complete and accepted for conformance only.

ZDB-03B is complete through B1/B2/B3/B4. The final bounded screen is frozen as:

- disposition: **INCONCLUSIVE_LOW_DELTA**
- 120 synthetic cases
- 55 cold-start / 65 non-cold
- 116 real Generative baseline decisions / 4 frozen provider failures
- 104 baseline-eligible primary folder/action cases
- 7 Preference-caused changed decisions
- 6 beneficial
- 0 harmful
- 1 other
- raw Net Benefit: +6
- all hard safety / authority / attribution gates passed
- no real conflicting Preference case occurred in the signal corpus

The result must not be upgraded to `DIRECTIONAL_SIGNAL_PRESENT`. The pre-registered minimum requires at least 10 Preference-caused changed decisions.

## Owner interpretation

The screen is low-delta primarily because actionable Preference exposure is structurally small.

Across Arms B/C/D, frozen support inventory is:

- none: 55
- weak: 55
- supported: 6
- correction_backed: 4

Therefore only 10 / 120 cases have support at or above the accepted actionable threshold.

The frozen agreement inventory is:

- no Preference recommendation: 106
- baseline differs from Preference recommendation: 10
- baseline unavailable: 4

All 10 actionable recommendations differ from the frozen Generative baseline, but higher current authority prevents three of those differences from becoming Preference-caused final-decision changes. The resulting observed Preference-caused change count is exactly 7.

This means the screen does not establish that Preference signal is absent. It also does not provide enough intervention exposure to establish a positive directional result.

The observed support-stratum outcomes are descriptive only:

- correction_backed: 4 cases, adjusted 4/4
- supported: 6 cases, adjusted 5/6

These tiny strata are not superiority evidence and must not be used to tune thresholds, profiles, History, finite choices, or target construction.

## Research gate disposition

Gate A — Signal: **INCONCLUSIVE**.

Gate B — Harm: no observed harmful Preference-caused transition and no cold/control regression.

Gate C — Authority safety: **PASS**.

Gate D — Ambiguity / conflict handling: **NOT ESTABLISHED BY THIS SIGNAL SCREEN** because no conflicting Preference case was present.

Gate E — Attribution: **PASS**.

The original ZDB-03 activation allows broader comparative work to be considered only after the research gates are satisfied. This checkpoint does not satisfy that condition.

## Owner decision

The current ZDB-03 research lane is **PAUSED**.

Do not activate the >=300 Stage-B comparative corpus now.

Do not create a replacement signal corpus merely to increase Preference exposure.

Do not:

- weaken or change support thresholds;
- alter scope matching;
- modify correction/conflict semantics;
- rebalance the frozen 120 cases;
- add History to frozen targets;
- change finite choices;
- rerun or repair the frozen Generative baseline;
- turn the +6 raw count into a directional or superiority claim.

Any future Preference study requires a new, separately pre-registered Owner activation with independently authored construction and explicit exposure/conflict-coverage design fixed before adjudication or provider results.

## Product-track consequence

Issue #283 is research only and is not a production merge gate.

The AI-only Product Migration may return to its next product stage.

The next eligible product-planning subject is PM-02, which owns:

- Automation Intent;
- Trigger;
- Policy architecture.

PM-02 is **not activated by this document**.

A separate PM-02 Owner activation/audit is required before production implementation.

PM-02 must not introduce:

- Preference Memory persistence or production authority;
- System One runtime;
- Laya/Jev production integration;
- autonomous shell/tool execution;
- RAG/vector-store authority;
- hidden personalization;
- autonomous mutation that bypasses Preview/confirmation/journal/Restore safety authority.

Production adoption of Preference Memory remains blocked on later benchmark evidence and separate architecture review.

## Current authorization

- ZDB-03A — COMPLETE / CONFORMANCE ONLY
- ZDB-03B — COMPLETE / MERGED / INCONCLUSIVE_LOW_DELTA
- ZDB-03 Stage-B >=300 comparative corpus — **NOT ACTIVE**
- ZDB-04+ — **NOT ACTIVE**
- PM-02 — **NOT ACTIVE / ELIGIBLE FOR SEPARATE OWNER PLANNING + ACTIVATION REVIEW**
- Preference Memory production — **NOT AUTHORIZED**

This document is an Owner research disposition, not a production implementation activation.
