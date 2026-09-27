# Post-Pre-PM Sequencing Review

Status: **COMPLETE / MERGED — owner sequencing review passed; PR #282 squash-merged; merge-after CI SUCCESS**

Owner: Zen Canvas

Baseline: `master@81cbfc37fe83b441be85047045fe79490323f7aa`

Branch: `spec/post-pre-pm-sequencing`

Issue: [#281 — Post-Pre-PM Sequencing Review](https://github.com/ArdenZC/Zen-Canvas/issues/281)

This specification is the temporary sequencing authority. `STATUS.md` remains the current project-state source.

## Inputs

### Completed production foundations

- AI Semantic Authority Foundation / #272 — merged.
- Pre-PM Cleanup AI Gate Hardening / #276 — merged.
- Pre-PM AI Readiness + Consent Contract / #279 — merged.

Together they close the owner deep-audit gaps around semantic authority, Cleanup assessment currentness/provider coverage, and backend readiness/consent truth.

### PM-01 design authority

Issue #273 and Draft PR #274 define the AI-only Core Experience direction, but #274 remains docs-only and is based on the old #272-era baseline. Current master has advanced through the Pre-PM foundations.

### Owner System One / Preference Memory feasibility report

The report recommends continuing:

- ZenDecisionBench;
- Preference Memory Research;
- Laya System-One Feasibility;
- Jev Reference Evaluation.

It does not approve:

- Laya production integration;
- Jev production dependency;
- System One replacing Generative AI;
- per-user online model fine-tuning.

The report explicitly keeps current Zen semantic/mutation authorities and PM-01 product behavior unchanged during research.

## Sequencing decision

### Production lane

```text
Sequencing Review
→ fresh PM-01 activation from current master
→ PM-01 implementation / owner review / merge
→ PM-02 and PM-03 through their own gates
```

PM-01 is the next production implementation Track after this specification closes.

Do not resume production implementation directly on Draft PR #274. Preserve #274 as historical design/audit evidence and supersede it with a fresh activation branch/PR from then-current master.

### Research lane

```text
ZenDecisionBench
→ Preference Memory experiments
→ Laya/Jev evaluation
→ calibration / drift / distractor-memory work
→ final hybrid comparison
→ separate production-adoption decision
```

Research may run in parallel with PM-01 after this sequencing review closes.

ZenDecisionBench is not a PM-01 merge gate.

## PM-01 boundaries after reactivation

PM-01 must:

- consume the merged backend readiness/currentness authorities instead of recreating them;
- preserve SemanticAssessmentV1, Organization Plan, Operation Preview, Cleanup Finding, Safe Trash, journal and Restore authority;
- correct product truth so Preference Memory is not presented as an active semantic input;
- preserve existing correction/feedback capture where already present, without promoting it into a new Preference Memory authority;
- exclude Laya, Jev and System One production integration;
- exclude new Preference Memory persistence/schema/service;
- remain AI-only for new Organize/Cleanup semantics using the existing generative/provider architecture plus deterministic Zen safety.

## Research boundaries

Research-only work may live under bounded non-production surfaces such as:

- `research/`;
- `benchmarks/`;
- `experiments/`;
- offline tools.

It must not modify:

- PM-01 product behavior;
- SemanticAssessmentV1 authority;
- Organization Plan / Operation Preview;
- Cleanup Finding / Safe Trash / Restore;
- production database schema;
- Global Index Service responsibility;
- installer/release authority.

The key preference distinction remains:

```text
Explicit User Truth != Preference != Rule
```

User corrections can be preference evidence, but not automatic filesystem or deterministic policy authority.

## Production-adoption gates for future intelligence work

A production Preference Memory Foundation requires evidence for:

- measurable personalization value;
- calibration and confidence;
- negative evidence;
- recency/scope semantics;
- drift behavior;
- safe composition with generic semantics;
- bounded persistence/authority.

System One production adoption requires final benchmark evidence that the hybrid architecture materially improves:

- accuracy;
- calibration/safety;
- cost;
- runtime / zero-burden behavior.

The final comparison remains:

- Generative only;
- Generative + Preference;
- Zen-Laya + Preference;
- Zen-Laya + Preference + Generative fallback.

Only then may a separate production architecture initiative be proposed.

## #274 disposition

#274 is docs-only historical design/audit evidence and is diverged from current master.

After owner acceptance of this specification:

- do not force-rebase production work into #274;
- close #274 as superseded by the post-Pre-PM activation plan;
- retain #273 as the product-direction issue;
- create a fresh PM-01 activation branch/PR from current master.

## Non-goals

- no production code;
- no PM-01 activation in this Track;
- no benchmark implementation;
- no Preference Memory schema;
- no Laya/Jev dependency;
- no fine-tuning;
- no PM-02 implementation;
- no #270/release work.

## Closeout

- Owner review: **PASSED** in PR #282 comment `5857424717`.
- Merge: PR #282 squash-merged to `master@2aaeb7599a6f4e8520c92dd8b3726138b0395d9a`.
- Merge-after CI: `36331334461` — **SUCCESS**.
- Issue #281: **CLOSED / completed**.
- Old Draft PR #274: **CLOSED / superseded** without merge.
- Research lane: issue #283 opened under research-only boundaries.
- Late hold-release audit found one narrower prerequisite not covered by #279: distinct Cleanup local/cloud data-sharing consent. Issue #284 owns that blocker before fresh PM-01 activation. This does not change the accepted separation of production and research lanes.
