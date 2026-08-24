# W3-11 — Preview Platform Closeout

Status: **COMPLETE** — final W3 closeout recorded by PR #137

Final runtime baseline: `master@a825f5414af274ee02712b53b60d72fe59306fea`; tree `79f1ca9a9ff97b695b1fca38090d007a1723559e` (W3-10 PR #136)

Branch: `docs/w3-11-preview-platform-closeout`

## Goal

Close W3 only after every authorized Preview Platform production Track has independently passed review and merged, then update current truth so the repository records the final W3 runtime baseline, evidence matrix, residual gaps and transition to a between-initiatives state.

W3-11 is docs/governance/cleanup only unless the closeout audit discovers a production blocker. If a blocker exists, W3-11 must STOP and create/authorize a bounded remediation Track instead of hiding the issue in documentation.

W3-11 does **not** activate W4 automatically.

---

# 0. Activation gate

Do not execute final closeout until all of the following are true on `master`:

- W3-07 Folder Preview runtime PR merged and its reviewer remediation closed;
- W3-08 ZIP Archive Preview runtime PR merged and independently reviewed;
- W3-09 Failure / Materialization / Security / Accessibility Integration merged;
- W3-10 Preview Performance / Cross-platform QA merged;
- no open merge-blocking W3 reviewer thread remains;
- final hosted CI evidence exists for the exact merged runtime trees;
- W3-10 records final performance/resource/cross-platform verdicts;
- no current-truth document falsely claims an unmerged runtime feature.

If any of these are missing, STOP.

**Final activation-gate result: PASS.** W3-07/#131, W3-08/#132, W3-09/#134 and W3-10/#136 are merged; W3-10 reviewer `#5007633103` recorded blockers = 0 and exact-head hosted CI `32706899339` succeeded. PR #137 therefore owns only final docs/governance closeout.

---

# 1. Mandatory read set

Before editing current truth, read completely:

1. `docs/project/README.md`
2. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
3. `docs/project/DEVELOPMENT_WORKFLOW.md`
4. `docs/project/STATUS.md`
5. `docs/project/ROADMAP.md`
6. `docs/project/initiatives/W3-preview-platform.md`
7. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
8. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
9. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
10. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
11. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
12. W3-00 through W3-10 taskbooks
13. every merged W3 implementation PR description/reviewer verdict needed to reconstruct final evidence
14. final W3-10 performance/cross-platform report
15. current `master` runtime provider registry/host/failure/capability contracts.

Runtime + executable tests + exact merged evidence describe what exists. Normative security/architecture documents still define what is allowed.

---

# 2. R0 — exact runtime identity

Before any docs edit, record:

```text
master SHA
master tree
W3-10 merge commit
W3-10 reviewed head/tree
source checkout evidence
merge-integration checkout evidence
latest required CI conclusions
working tree / branch state
```

The closeout branch must start from the exact post-W3-10 `master` runtime baseline.

Do not reuse this preflight branch's old baseline as the final closeout base. Create/update the actual closeout worktree/branch from the then-current exact master according to repository workflow.

If local `master` is not the exact remote baseline, fail closed instead of silently carrying old commits.

---

# 3. Final W3 runtime inventory

Closeout must record the final merged product truth, not just a list of PRs.

## 3.1 Hosts

Record final verdicts for:

- Zen Floating Quick Preview;
- Zen Pinned Preview / Context integration;
- Floating → Pinned typed handoff;
- source-follow;
- bounded sibling navigation;
- no-source behavior;
- Space/Esc/focus ownership;
- compact single modal/focus owner.

W4 host kinds must remain inactive/not authorized unless current master explicitly says otherwise.

## 3.2 Provider matrix

Record every final built-in provider family and exact provider IDs/priorities/capability truth where meaningful:

- Metadata fallback;
- Text/source code;
- Markdown SafeHTML;
- JSON/YAML/XML;
- CSV/TSV;
- Image PNG/JPEG;
- Folder;
- ZIP Archive.

For each family record:

- representation family;
- supported Zen hosts;
- whether it reads content;
- key hard bounds;
- fallback/terminal behavior;
- important security restrictions;
- known unsupported formats.

Do not claim PDF/Office/iWork/audio/video Zen renderers if W3 did not implement them.

## 3.3 Authority matrix

Reconfirm one-owner truth:

- PreviewSession = lifecycle/provider/publication authority;
- production Provider Registry = one composition owner;
- MaterializationReadGate = byte-read/materialization authority;
- WorkScheduler = main-process resource admission authority;
- BrowseService = ephemeral Browse/directory enumeration authority;
- Query V2 = managed Library query/selection authority;
- WorkspaceSession/source owners = navigation/presentation source ownership;
- frontend PreviewExperienceController = presentation/lifecycle consumer, not backend authority.

No raw renderer path or second query/read/scheduler/Preview engine may be introduced at closeout.

---

# 4. Final provider bounds ledger

Capture the final reviewed constants from merged runtime rather than copying stale taskbook proposals.

At minimum include:

## Text / Markdown / structured/table

- maximum source/read budgets;
- maximum decoded/output bytes;
- structured depth/node/table bounds;
- sanitization/resource-loading restrictions.

## Image

- source byte ceiling;
- source pixel ceiling;
- output pixel/asset ceiling;
- decoder admission/resource accounting;
- opaque asset lifecycle.

## Folder

- direct-child inspection ceiling;
- page size / Browse raw scan budget;
- sample/extensions/largest/hints bounds;
- encoded summary bound;
- progressive publication count/cadence;
- temporary Browse session/resource bound;
- exact Complete/Partial semantics;
- no recursion.

## ZIP

- entry/index/tree/depth/name/wire limits;
- total/per-read source byte bounds;
- reader/cache bound;
- no extraction/body decompression for metadata Preview;
- traversal/nested recursion restrictions.

If merged runtime differs from taskbook proposal, record the reviewed final runtime value and rationale/evidence.

---

# 5. Failure/materialization truth

Record the final W3-09 matrix.

## Recoverable/provider-local

Expected categories include:

- unsupported;
- failed/provider_failed;
- timeout;
- corrupt source.

These may fall through to another compatible provider and ultimately Metadata fallback according to merged coordinator behavior.

## Terminal source/session

Expected categories include:

- source unavailable;
- materialization required;
- permission denied;
- identity changed;
- cancelled.

These cannot be bypassed by another byte-reading provider.

## Materialization action

Explicitly state whether a real authoritative renderer-callable user action exists at W3 closeout.

If absent:

- `materialization_required` remains an explicit state;
- `canRequestMaterialization=false` where appropriate;
- no fabricated `Download to Preview` action.

Do not imply future W4/W5 work already exists.

---

# 6. Security closeout matrix

Record final hard evidence for:

- no renderer raw filesystem path authority;
- no general renderer byte-read command;
- no reusable content lease in React;
- no implicit materialization/cloud hydration;
- no provider network/resource loading unless separately reviewed;
- sanitized Markdown/SafeHTML;
- XML external resource/entity safety;
- YAML depth/amplification bounds;
- table formula-looking values remain inert text;
- Image decode/source/output bounds;
- opaque image asset tuple and object URL cleanup;
- Folder direct-child/no recursion/no path payload;
- ZIP no extraction/path traversal/nested recursion;
- no macro/code execution;
- no third-party dynamic provider plugins;
- W4 native integration not pulled forward.

Any security item without evidence is not silently PASS.

---

# 7. Performance / scale closeout

Consume W3-10 final evidence.

Record exact verdicts for:

## Timing TARGETS

- Preview shell <=100 ms p95 target;
- local useful Text/JSON/Markdown/Image <=300 ms p95 target;
- other provider first-useful/final timings as measured.

If a TARGET misses, record the exact measured result and reviewer disposition. Do not rewrite the target during closeout.

## Hard gates

- 100-entry rapid switch no stale/wrong final source;
- bounded request/provider/resource growth;
- final source only current;
- repeated open/close resource steady state;
- close-then-mutate not blocked by retained Preview resources;
- Folder 1k/10k/100k progressive/bounded behavior;
- ZIP large/hostile bounded behavior;
- W1 Workspace Foundation performance preserved;
- Query V2 100k/1M thresholds preserved;
- W2 100k bounded UI behavior preserved.

---

# 8. Cross-platform evidence classification

Maintain strict evidence labels.

At minimum distinguish:

```text
HOSTED / exact-head CI
LOCAL exact-head real-browser
NATIVE runtime/manual
UNVERIFIED
```

Do not collapse these.

Required final platform summary:

## Windows

- x64 Rust/release/quality evidence;
- browser/frontend evidence;
- filesystem/resource behavior where tested;
- manual/native gaps.

## macOS

- Apple Silicon/arm64 hosted/runtime compile/performance evidence;
- browser/frontend evidence;
- filesystem/resource behavior where tested;
- native visual/VoiceOver/manual gaps.

A hosted macOS compile is not native visual PASS.

If VoiceOver/Narrator/manual tests were not run, record `UNVERIFIED`.

---

# 9. Browser evidence ledger

For every W3 browser gate used in final evidence, state whether CI actually executes it.

If W3-02..10 real-browser gates were only run locally at exact head, say:

`exact-head local real-browser PASS`

Do not write `hosted browser PASS` merely because another hosted frontend job succeeded.

Record supported viewport evidence at minimum where executed:

- 1600×900;
- 980×680.

---

# 10. Residual/deferred ledger

Closeout must explicitly list anything intentionally not completed in W3.

Likely categories to verify include:

- native Finder/Quick Look extension integration → W4;
- Windows Explorer Preview Handler/native integration → W4;
- PDF/Office/iWork/audio/video native strategy → W4/future reviewed scope;
- authoritative user materialization action if still absent;
- native VoiceOver/Narrator/manual evidence not run;
- Intel macOS/Linux unsupported by current product plan;
- OCR/AI/RAG/plugin SDK not authorized.

A deferred item must not read like a hidden defect that should have blocked W3. If it actually violates a W3 release criterion, STOP closeout and remediate.

---

# 11. Technical-debt review

Review existing technical-debt ledger for W3-relevant items.

For each:

- remains valid;
- resolved by W3 with evidence;
- superseded/reworded;
- new debt discovered.

Do not delete debt merely because the new Preview path exists unless replacement/equivalence has been proven.

Legacy Vault/preview compatibility retirement remains governed by its own accepted exit condition.

---

# 12. Artifact / branch hygiene

Before closeout merge:

- implementation worktrees clean or intentionally retained with exact reason;
- task-owned `.tmp-tests`/fixtures removed;
- temporary junctions/symlinks removed;
- no untracked production artifacts;
- no accidental screenshots/benchmark files committed;
- no stale task-owned release/preview assets left in repository tree.

Do not delete shared compiler/npm/cargo caches simply to claim cleanup.

Remote implementation branches may remain according to project branch policy; closeout should not force-delete evidence branches unless that is established workflow.

---

# 13. Current-truth update scope

W3-11 final closeout should be a tightly bounded docs-only PR.

Expected primary current-truth files:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/tasks/W3-11-PREVIEW-PLATFORM-CLOSEOUT-CODEX.md`

If another file truly must change, justify it explicitly before editing. Do not casually update stable architecture/master-plan docs with routine progress numbers.

The taskbook itself may be updated from preflight/implementation status to COMPLETE with final evidence.

No production/config/package/schema/CI code belongs in the closeout PR.

If a production change is necessary, STOP and create a bounded remediation PR first.

---

# 14. STATUS.md final truth

STATUS must clearly record:

- W3 Preview Platform COMPLETE/CLOSED;
- final runtime baseline SHA/tree;
- final implementation/QA merge commits;
- provider/host coverage summary;
- final important hard bounds/evidence summary;
- security/failure/materialization truth;
- platform evidence classification;
- residual deferred/UNVERIFIED items;
- repository is now between initiatives.

Do not set W4 ACTIVE merely because it is next conceptually.

---

# 15. ROADMAP.md final truth

ROADMAP must:

- mark W3 complete;
- record W3-07 through W3-11 complete with final merge evidence;
- remove stale `NEXT = W3-xx` pointers;
- state W4 is the next planned Wave but **NOT YET AUTHORIZED/ACTIVE** unless a separate reviewed activation PR has already done so;
- retain W5 as future Release/Hardening.

Avoid rewriting long historical roadmap sections unnecessarily.

---

# 16. W3 initiative final truth

`docs/project/initiatives/W3-preview-platform.md` should become a durable closeout record.

Include:

- final status COMPLETE/CLOSED;
- activation and final runtime baselines;
- final track table W3-00..W3-11;
- provider/host matrix;
- release-criterion verdict table;
- performance/cross-platform evidence summary;
- residual/deferred ledger;
- no automatic W4 activation.

Preserve historical rationale and accepted scope; do not replace the initiative with only a short summary.

---

# 17. Release-criterion audit

Before closeout, evaluate every W3 implementation-plan release criterion individually.

Required rows include:

- Preview Core remains sole lifecycle/provider publication authority;
- strict Rust/TS representation contract;
- truthful Host ∩ Provider ∩ Source capabilities;
- no renderer raw path/read-lease authority;
- Floating Library/Browse;
- Pinned integration without second engine;
- Space/Esc/focus/IME;
- Text/Code/Markdown;
- JSON/YAML/XML + CSV/TSV;
- Image;
- Folder progressive/bounded 100k;
- ZIP bounded/no extraction;
- recoverable/terminal fallback matrix;
- no implicit materialization/network/code/macro execution;
- 100-entry rapid switching;
- close-then-mutate resource release;
- resource steady state;
- W0 timing targets measured;
- W2/Query gates preserved;
- W4 not pulled forward;
- evidence honesty for native/manual gaps.

Every HARD criterion must be PASS before closeout.

TARGET rows may record measured miss + accepted reviewer disposition, but cannot be omitted.

---

# 18. Closeout validation

Because final W3-11 is docs-only, use the repository's docs-only validation path plus explicit diff/governance checks.

At minimum:

```text
npm run test:docs
npm run test:governance
git diff --check
git diff --check origin/master...HEAD
```

Hosted CI must classify the PR as documentation-only and run the expected docs/governance/evidence lanes.

Production frontend/Rust/package/performance lanes may be correctly skipped by routing. Do not trigger expensive production lanes merely to manufacture evidence already owned by merged runtime PRs.

The closeout PR's job is to verify documentation/current-truth integrity, not rerun W3-10 through a docs branch.

---

# 19. Reviewer contract

Before merge, independent reviewer checks:

- exact base is post-W3-10 runtime master;
- diff is docs-only and tightly scoped;
- no release criterion falsely marked PASS;
- merge/runtime SHAs/trees/PR numbers are correct;
- local vs hosted vs native evidence is classified honestly;
- residual `UNVERIFIED` items remain explicit;
- no W4 production/activation sneaks into closeout;
- no historical current-truth content is accidentally truncated;
- no stale NEXT pointer still says W3-07/08/09/10/11.

Reviewer blockers must be remediated on the existing closeout PR/branch according to workflow.

---

# 20. Merge contract

When reviewer blockers = 0 and fresh docs-only CI is success:

- mark the closeout PR Ready only if project workflow requires it;
- lock the reviewed expected head;
- squash merge according to established project convention;
- verify post-merge master SHA/tree;
- verify final current truth on master;
- do not create/activate W4 in the same merge unless explicitly authorized by a separate reviewed governance action.

The final W3 status should be:

```text
W3 Preview Platform ✅ COMPLETE / CLOSED
Repository          BETWEEN INITIATIVES
W4 Native Integration PLANNED / NOT ACTIVE
```

---

# 21. Stop conditions

STOP closeout if any of the following is discovered:

- unmerged W3 production work;
- unresolved W3 reviewer blocker;
- final runtime lacks a HARD release criterion;
- current W3-10 performance/resource evidence is incomplete for a HARD gate;
- security/materialization/failure truth is inconsistent across providers;
- production change is required to make documentation true;
- raw-path/read-authority regression exists;
- W4 native code was accidentally pulled into W3;
- native/manual evidence is being claimed without execution;
- closeout would require truncating/reconstructing long current-truth files without complete source content.

In these cases fail closed and remediate first.

---

# 22. Preflight conclusion

W3-11 should be mechanically simple because the substantive work belongs in W3-07 through W3-10.

Its purpose is to make the repository's written truth exactly match the final merged Preview Platform:

- what hosts/providers exist;
- what authority boundaries remain;
- what hard limits protect scale/security;
- how failure/materialization behave;
- what performance was measured;
- what Windows/macOS evidence exists;
- what is genuinely deferred;
- and that W4 has **not** been silently activated.

If W3-11 becomes a large production-fix PR, the process has failed: stop and split remediation from closeout.

---

# 23. Final closeout result

W3 Preview Platform is **COMPLETE / CLOSED** on merge of PR #137. No production/config/package/schema/CI code is part of the closeout delta.

Final runtime identity:

- W3-10 runtime merge: `a825f5414af274ee02712b53b60d72fe59306fea`;
- runtime tree: `79f1ca9a9ff97b695b1fca38090d007a1723559e`;
- W3-10 reviewed head: `601f689741fc0084a50853ba26b856e251421c5b`;
- source/merge-integration tree equivalence: true; integration commit `219eb38fea6693bcf7826e48241492e5f7c961f2`;
- exact-head hosted CI: `32706899339` — success;
- reviewer PASS: `#5007633103`; acceptance blockers = 0.

Release-criterion audit: all W3 HARD criteria are PASS. Final W3-10 exact-head local browser shell/useful p95 TARGETS were measured and met at 1600×900 and 980×680. Historical inherited W1 timing misses remain historical evidence, not reclassified.

Evidence honesty:

- W3 real-browser gates used for final Preview UI evidence are exact-head **LOCAL** unless a hosted job explicitly ran that exact gate;
- hosted Windows/macOS Rust/release/performance evidence is not native manual accessibility/visual evidence;
- native VoiceOver/Narrator/manual interactive macOS UI remain `UNVERIFIED`;
- permanent-delete and Windows Folder-directory mutation paths remain `UNVERIFIED` where the existing mutation seam is unavailable;
- unavailable genuine cloud/provider/network volume fixtures remain `UNVERIFIED`.

Residual future scope is not a hidden W3 defect: Finder Quick Look / Windows Explorer Preview Handler and native PDF/Office/iWork/audio/video strategy belong to W4/future reviewed scope; OCR/AI/RAG/plugin SDK and release/signing work remain unauthorized here. TD-015 remains open under its own exit condition.

Final repository state: **BETWEEN INITIATIVES**. W4 is the next planned Wave but is **NOT AUTHORIZED / NOT ACTIVE** by this closeout.
