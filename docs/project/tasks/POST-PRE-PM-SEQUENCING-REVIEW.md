# Post-Pre-PM Sequencing Review — Decision

Status: **DRAFT — READY FOR OWNER REVIEW after exact-head governance/CI**

Issue: #281

Baseline: `master@81cbfc37fe83b441be85047045fe79490323f7aa`

## Decision summary

1. **PM-01 is next on the production lane.**
2. **Do not resume production work on stale #274.** Close it as superseded after this review passes and create a fresh PM-01 activation branch/PR from current master.
3. **ZenDecisionBench may start in parallel as research-only** once this sequencing review closes.
4. **ZenDecisionBench is not a PM-01 merge gate.**
5. **Preference Memory Research belongs to the research lane for now.** No production Preference Memory authority/schema/service is authorized inside PM-01.
6. **System One/Laya/Jev production adoption remains later and evidence-gated.**
7. PM-01 must correct any current product copy that overstates Preference Memory, but must not implement Preference Memory opportunistically.
8. Existing deterministic Zen safety authorities remain unchanged.

## Why PM-01 should not wait for ZenDecisionBench

The owner feasibility report rates System One architecture fit highly but Laya zero-shot production readiness low, and explicitly forbids research from modifying PM-01 product behavior.

Therefore blocking PM-01 on ZenDecisionBench would incorrectly convert an exploratory research hypothesis into a production prerequisite.

PM-01's required semantic/safety foundations are already merged through #272, #276 and #279.

## Why research should not wait for PM-01

ZenDecisionBench and Preference Memory experiments can be isolated from production authority and can answer questions that matter to later intelligence architecture:

- Does Preference Memory produce measurable value?
- Can Laya provide useful fast typed decisions?
- Where does Generative fallback remain necessary?
- What calibration and drift controls are required?

Running this research in parallel avoids delaying evidence while keeping product architecture stable.

## Required next production action after owner acceptance

1. close/supersede Draft PR #274 without merging its stale current-truth documents;
2. keep issue #273 as product-direction authority;
3. create a fresh PM-01 activation branch from then-current master;
4. reconcile the PM-01 taskbook against merged #276/#279 authorities;
5. only then begin PM-01 production implementation.

## Required research action after owner acceptance

Create a separate bounded research issue/plan for ZenDecisionBench. Research artifacts must remain non-production and must not become an active production authority.

## Stop condition

This document itself authorizes no implementation.

Final pre-merge disposition may be only:

`READY FOR OWNER REVIEW`

until owner review passes.
