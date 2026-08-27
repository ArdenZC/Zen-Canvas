# W4-04 — Execution Baseline Amendment after R-FL-01

Status: **AUTHORIZED GOVERNANCE AMENDMENT — W4-04 PRODUCTION IMPLEMENTATION REMAINS BLOCKED UNTIL THIS AMENDMENT MERGES**

Last verified: 2026-08-27

This document is a narrow binding addendum to [`W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md`](W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md).

It exists only because R-FL-01 was inserted and completed after the original W4-04 taskbook merged. It **supersedes only W4-04 implementation-baseline / R0-entry identity / current-entry sequencing statements** that would otherwise point to the pre-remediation taskbook merge. Every W4-04 product, architecture, native-host, registration, installer, supported-format, security and acceptance requirement in the original taskbook remains binding and unchanged.

If this addendum and the original W4-04 taskbook differ on anything other than execution-baseline identity or the fact that R-FL-01 is now COMPLETE/CLOSED, **STOP** rather than interpreting this amendment as broader authority.

## 1. Exact amendment input baseline

This amendment branch and PR must originate directly from the exact post-R-FL-01 current-truth master:

```text
post-R-FL-01 closeout master:
f74b6def4c8c728575102527e6c30923448c5208

post-R-FL-01 closeout tree:
feb6a100a2c6d9479dd9cc4da1c940b2bd1b3e6d
```

That commit is PR #157, `docs(file-library): close R-FL-01 current truth (#157)`.

Required ancestry:

```text
W4-03 v2 production merge
55571e6fc4fbd9a9eedc0f474dff28b113072b67
        ↓
W4-04 original taskbook merge
ed79b374fa058d078765cf6394b40e8348d2746c
        ↓
R-FL-01 PHASE A taskbook merge
f672dbbccc270b04d17f4b520c147e8d1b4ba00d
        ↓
R-FL-01 production merge
01978a6428c92b0587658f2c53d73c084afcf9f3
        ↓
R-FL-01 current-truth closeout merge
f74b6def4c8c728575102527e6c30923448c5208
        ↓
THIS W4-04 BASELINE AMENDMENT
```

If the amendment PR base is not exactly `f74b6def4c8c728575102527e6c30923448c5208` / `feb6a100a2c6d9479dd9cc4da1c940b2bd1b3e6d`, fail closed. Do not rebase an old W4-04 implementation branch, import the previously deleted feature branch, or repair the baseline with merge/cherry-pick/reset.

## 2. R-FL-01 final provenance

R-FL-01 is **COMPLETE / CLOSED**.

Canonical evidence:

- PHASE A taskbook merge: `f672dbbccc270b04d17f4b520c147e8d1b4ba00d`; tree `fbab1135bbf630558a440aa7efe972babc536cbc`;
- production PR: #156;
- final independently reviewed production head: `67ba1d6937327059063f563ad57196f6ae6ff0a7`;
- final reviewed tree: `ccf1556be0ff046445108ce5d73940e40aeb77c5`;
- final independent acceptance review: `5038363479`, blockers = 0;
- final exact-head hosted CI: `33048197786` / #1041 — SUCCESS;
- production squash merge: `01978a6428c92b0587658f2c53d73c084afcf9f3`; tree `ccf1556be0ff046445108ce5d73940e40aeb77c5`;
- current-truth closeout PR: #157;
- current-truth closeout merge: `f74b6def4c8c728575102527e6c30923448c5208`; tree `feb6a100a2c6d9479dd9cc4da1c940b2bd1b3e6d`;
- dedicated closeout: [`R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CURRENT-TRUTH.md`](R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CURRENT-TRUTH.md).

No Codex Review was used as R-FL-01 acceptance evidence.

R-FL-01 changed Operation Preview confirmation integrity and authoritative Permanent Delete preview acquisition. It did not change the W4-04 Windows Preview Handler architecture or product matrix.

## 3. Superseded W4-04 execution-baseline rule

The original W4-04 taskbook says the implementation branch is created directly from the exact original taskbook squash-merge commit. That rule is now **superseded only because the independently accepted R-FL-01 production/current-truth commits are mandatory ancestors of W4-04 implementation**.

Do **not** create or resurrect the implementation branch from:

- `ed79b374fa058d078765cf6394b40e8348d2746c`;
- any pre-R-FL W4-04 feature branch;
- the former deleted remote branch `feat/w4-windows-preview-handler-production-integration`;
- any local worktree that predates this amendment.

## 4. New authoritative W4-04 implementation baseline

This amendment intentionally cannot pre-state its own future squash-merge SHA.

After this amendment PR is independently accepted and squash-merges, the **exact amendment squash-merge commit and its tree become the sole W4-04 implementation baseline**.

Only then may the governance owner create a fresh branch named:

```text
feat/w4-windows-preview-handler-production-integration
```

directly from that exact amendment squash-merge commit.

At production task entry Codex must prove:

```text
current branch == feat/w4-windows-preview-handler-production-integration
starting HEAD == exact W4-04 baseline-amendment squash-merge commit
starting tree == exact W4-04 baseline-amendment merge tree
origin/master == that same commit at task entry
working tree == clean
f74b6def4c8c728575102527e6c30923448c5208 is an ancestor
01978a6428c92b0587658f2c53d73c084afcf9f3 is an ancestor
f672dbbccc270b04d17f4b520c147e8d1b4ba00d is an ancestor
ed79b374fa058d078765cf6394b40e8348d2746c is an ancestor
55571e6fc4fbd9a9eedc0f474dff28b113072b67 is an ancestor
PR #146 stopped feature-branch history has NOT been imported
```

Use a fresh clean clone or isolated worktree. If any identity, ancestry or cleanliness condition fails, **STOP / FAIL CLOSED**. Do not reset, rebase, merge, cherry-pick, clean away unrelated state, or reuse the quarantined W2 worktree to force the task forward.

## 5. Binding read order at W4-04 implementation entry

Before editing production code, read in this order:

1. this amendment;
2. the original [`W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md`](W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md);
3. [`R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CURRENT-TRUTH.md`](R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CURRENT-TRUTH.md);
4. the rest of the original W4-04 required read set.

For execution-baseline identity and current entry sequencing, this amendment controls. For all product/architecture/implementation/acceptance requirements, the original W4-04 taskbook controls.

## 6. W4-04 entry truth after amendment merge

After this amendment merges, and not before:

- W4 remains the sole active initiative;
- W4-00, W4-01, W4-02 and W4-03 v2 remain COMPLETE/CLOSED;
- W4-03 v1 remains STOPPED / CLOSED WITHOUT MERGE;
- R-FL-01 is COMPLETE/CLOSED;
- W4-04 becomes **AUTHORIZED / NEXT for production implementation from the exact amended baseline**;
- W4-05+ remain downstream-gated;
- W5 remains NOT AUTHORIZED / NOT ACTIVE.

This status change authorizes only the already-frozen W4-04 production-integration task. It does not activate W4-05 or W5.

## 7. Frozen W4-04 decisions — NO CHANGE

This amendment makes **zero** change to the following binding W4-04 facts:

- ADR-0006 capture-before-defer architecture;
- production CLSID `{3D1A446C-162E-4313-A026-8ADC792C4862}`;
- COM `ThreadingModel`;
- Preview Handler Prevhost AppID / isolation contract;
- 512 KiB total ingress ceiling;
- immutable Zen-owned memory after capture;
- no request-long shell `IStream` ownership after capture;
- no raw-source-path reconstruction;
- 16-extension production association matrix;
- `SystemFileAssociations` registration strategy;
- foreign-handler conflict / non-clobber rule;
- Low IL / normal Preview Handler isolation;
- installer / registration ownership and rollback expectations;
- W4-03 v2 accepted source/lifecycle architecture;
- real Explorer / `prevhost.exe` acceptance requirements;
- W4-05/W4-06/W4-07 boundaries;
- W5 release boundary.

Any implementation request that attempts to change one of these because the baseline moved must STOP for a separate architecture/product decision.

## 8. R-FL-01 compatibility constraints carried into W4-04

W4-04 must preserve the newly accepted current product mutation truth while implementing Windows native preview registration:

- Operation Preview remains backend-authoritative;
- executable mutation confirmation remains bound to backend `operationFingerprint` / revision;
- stale confirmation remains whole-batch fail-closed before journal/filesystem mutation;
- renderer does not gain source-path/target-path/operation-type mutation authority;
- Windows Permanent Delete capability remains false unless a separate later product decision changes it;
- W4-04 Preview Handler work must not introduce a second file mutation, journal, recovery, provider or filesystem authority.

W4-04 is a native **read/presentation system-host integration** task; R-FL-01 does not convert it into mutation work.

## 9. Amendment validation / delivery

This PR is docs/governance-only.

Required validation:

```text
npm run test:docs
npm run test:governance
git diff --check
git diff --check origin/master...HEAD
```

The PR must prove:

- exact base is `f74b6def4c8c728575102527e6c30923448c5208` / `feb6a100a2c6d9479dd9cc4da1c940b2bd1b3e6d`;
- R-FL-01 is COMPLETE/CLOSED;
- only W4-04 baseline/entry sequencing is amended;
- no production code/config/package/installer/schema/CI file changed;
- every frozen W4-04 product/architecture decision remains unchanged;
- W4-05+ and W5 remain gated.

Open the amendment PR as Draft. Do not create the implementation branch before the amendment merges.

The amendment requires independent governance review with blockers = 0 and successful docs/governance CI before expected-head squash merge.

After merge, record the exact amendment merge SHA/tree, create a **fresh** `feat/w4-windows-preview-handler-production-integration` branch from that exact commit, and only then hand the production implementation task to Codex.
