# Zen Canvas Project Status

Last verified: 2026-08-20

## Current baseline

- R4 closeout governance baseline:
  `master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7` (PR #99 R4 Final Consumability Verification squash merge).
- Latest W2 product/runtime baseline:
  `master@19b24e80be0c64896dea016678ff2b44c7afb9bc` (PR #104 W2-04 Browse Mode Navigation + Content integration/squash merge).
- W2-03 merge baseline:
  `master@eab586a0e009f0b8a167848f7465d66217df1122` (PR #103 W2-03 Library Mode Adapter / Migration squash merge).
- R3 reviewed product/runtime implementation head:
  `1231b1ba509c2925863b799af5e9ac52c7b528e8`.
- R3 hosted implementation-head PR CI `32257747035` / #758 concluded `success`.
  It passed source/evidence and merge-integration contracts, Windows and Apple
  Silicon macOS Rust quality, frontend/build validation, the W2-01 real-browser
  regression gate, supported release-compile lanes, native Apple Silicon macOS
  performance and Workspace Foundation performance.
- R3 final closeout-head PR CI `32322986793` / #760 concluded `success` on
  `run_attempt=2` at exact head
  `0954890dbe33bfbce4a0294376f87d5516562e19`. The exact closeout-head tree and
  the R3 squash-merged product tree are both
  `87a6f180dd70e4da685e82148c385c57249316fb`.
- R4 W1-to-W2 Final Consumability Verification was executed verification-only on
  exact merged R3 baseline `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214`.
  Browse identity/lifetime, Thumbnail, Location, Read Gate, W1 Preview Core,
  Query V2 selection provenance and CI evidence are all **HARD PASS**; no
  required seam is `BLOCKED`. The durable result is
  `docs/project/tasks/W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-RESULT.md`.
- R4 exact docs/governance closeout head
  `39a70c4f549634d327da7f441ddafce9fc371d3b` passed PR CI
  `32325019015` / #762 on `run_attempt=1` and squash merged through PR #99 as
  `master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`. The closeout head and squash
  merge share tree `4eb292b2819e32b1f918ffa094c53954218208c0` while retaining
  distinct commit identities.
- R4 changes documentation/governance only. No production code, schema, package,
  release or W2-02 implementation was included in the R4 closeout baseline;
  W2-02 subsequently completed through PR #101.
- W2-02 reviewed implementation head:
  `0b745798ac8fc4a123aa659387080cd4104adca4`.
- W2-02 exact-head/ADR-0004 evidence: hosted CI `32332094245` / #767
  concluded `success`; source checkout was the implementation head with tree
  `95299339a322061bcac0e2dce8c847fc0a2b9dee`, merge integration was
  `5bf33eb86d0e9ee9698e814af664861cc00cf29f` with the same tree,
  `tree_equivalent=true`, `head_validation_required=false`, and
  `validation_lanes=["merge_integration"]`.
- W2-03 independently reviewed implementation head:
  `951b57af029390bcba48f3b88c912c5d25c0332a`; hosted CI `32355727066` / #771
  concluded `success`; it was squash merged through PR #103 as
  `master@eab586a0e009f0b8a167848f7465d66217df1122`.
- W2-04 independently reviewed implementation head:
  `29c102a9cf4c0e8873b58572ebea320485cf5fd9`; hosted CI `32375571414` / #773
  concluded `success`. Its integrated head was
  `6bde3103c15dcb9f129a3e2981477bb88d2d3c68`; integration CI `32377606136` /
  #775 concluded `success`, and the result was squash merged through PR #104
  as `master@19b24e80be0c64896dea016678ff2b44c7afb9bc`.
- Real iCloud/File Provider, external APFS/exFAT, SMB/network and other
  unavailable provider/platform fixtures remain explicitly `UNVERIFIED`.
- Default branch: `master`.
- R2 independently reviewed implementation head:
  `07db9c298e2006a5a5fce86a3249e25b29c8d9dd`; exact-head PR CI run `32183587403` / #742, conclusion `success` before PR #96 squash merge.
- CI-O final reliability closeout: **HARD PASS** in PR #97. The implementation
  changed CI/test orchestration only and did not change product/runtime behavior.
- CI-O implementation head:
  `ca0a489dfdd865b00d07653d792e9bd40eacc94f`.
- CI-O final validation/docs-only successor:
  `cda5329589b708167ce7a4ec2061e58be9d21e97`, a docs-only successor of the
  implementation head. PR CI `32237925011`, `run_attempt=1`, and Full Validation
  `32238526490`, `run_attempt=1`, both concluded `success`; Full Validation
  checked out `cda5329589b708167ce7a4ec2061e58be9d21e97` with tree
  `88ab527001689a7ae1beb13218d60b24aa284b94`.
- The preceding PR CI attempt `32236844339` at the implementation head is
  historical non-accepting hosted macOS resource-trend variance. It did not
  change the product/runtime baseline and was superseded by the successful
  docs-only successor evidence above.
- CI-O prior ADR-0004 PR evidence at the implementation head:
  PR head `3e75a0c9781b9cdecc1fee0a9716415d08d1fc23`, head tree `c1935cde7cef08a5e81fcecc47631f048052f1bc`, merge-integration commit `94e7d9f6e72706106dd7df627efceb4c9fe0eddb`, integration tree `c1935cde7cef08a5e81fcecc47631f048052f1bc`, `tree_equivalent=true`, `head_validation_required=false`, `validation_lanes=["merge_integration"]`.
- W1 closeout/governance baseline:
  `master@ecde9f146e1e4e4933f6294358fe4a6523c7c0bd` (PR #83 W1-12 squash merge).
- Post-closeout governance hardening baseline:
  `master@84fc784c2e1a3058fb7a18fa778c0b632e0b5fed` (PR #84).
- Post-closeout evidence remediation / W2 planning baseline:
  `master@08fa22ea8a850ad4b56f3705621dda17de08af80` (PR #85).
- W2 reviewed implementation-plan baseline:
  `master@e91416c83082b61a0d3042c9438d77c7b8586297` (PR #86).
- W2 reviewed visual/interaction freeze baseline:
  `master@251bab36797cde4129656f57667ed203f20415e6` (PR #87).
- W2-01 reviewed production head:
  `48ce853cce5989749ddf19a3b880bc02446625ff`.
- W2-01 final test-infrastructure head:
  `08595005669d5346b974d11007f2d300e7b801fa`.
- W2-01 exact-head CI: run `32137181033` / #717, conclusion `success`.
- R0 reviewed docs/governance head:
  `8c4568def12876a0e0c164ce77581d6a6622403e`; PR #92 docs-only CI run `32158724636` / #728, conclusion `success`.
- R1 independently reviewed implementation head:
  `cc37e7077af67039c131f219d4bd36b640d0ff76`; CI run `32175677532` / #736, conclusion `success`.
- R1 final architecture-closeout head:
  `7483c63f7a13598fb712e0399ed2188d02041be2`; CI run `32177642141` / #738, conclusion `success` before PR #94 squash merge.
- R1 accepted architecture record:
  `docs/project/DECISIONS/0004-ci-source-and-merge-evidence.md`.
- W1-11 final independently reviewed production head:
  `70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`.
- W1-11 exact-head Full Validation: run `32064210757` / #678, conclusion `success`.
- W1-12 merge-push governance CI: run `32068976837` / #686, conclusion `success`.
- W1 post-closeout docs/governance validation: PR #85 / CI `32070576682` (#689) and master push CI `32070721616` (#690), success.
- W2-00 visual/interaction design exact-head docs/governance validation: CI `32098392854` (#698), success before PR #87 squash merge.
- W0 File Library / Preview specification baseline:
  `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (PR #64 squash merge).
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

The File Library 2.0 / Preview Platform **W1 Foundation** is complete. W2 has a
reviewed implementation plan and reviewed visual/interaction freeze and is
`active — implementation` through the W2-00 governance activation. **W2-01 —
Workspace Shell + Experience Controller** merged through PR #90. R0
consumer-boundary architecture/governance remediation merged through PR #92.
**R1 — CI Evidence / Governance Hardening** is complete and merged through PR
#94, with ADR-0004 accepted. **R2 — Browse Identity + Thumbnail Consumability**
is complete and merged through PR #96. **CI-O — Full & PR CI Latency / Redundancy
Remediation** passed its final reliability closeout in PR #97 without changing
product/runtime behavior. The separate `<=14 min` performance target remains
**NOT YET MET**. **R3 — Location Consumability** is complete and merged through
PR #98 as `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214`. **R4 — W1-to-W2
Final Consumability Verification** is **PASS** and its docs/governance closeout is
merged through PR #99 as `master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`, with no
required blocked seam and no production repair. **W2-02 — Shared Presentation
Entry / Collection Contracts** is complete and squash merged through PR #101 as
`master@f1fd3591977142f08eac139814fecebe2e0e6d96`. **W2-03 — Library Mode
Adapter / Migration** is complete and squash merged through PR #103, and
**W2-04 — Browse Mode Navigation + Content** is complete and squash merged
through PR #104. **W2-05 — Interaction Convergence + Virtualized List** is now
the next dependency-eligible Track. W2-06/W2-07 remain blocked on W2-05. W3
Preview Platform, W4 Native Integration and W5 Release remain separate
unauthorized future Waves.

## Delivery-state snapshot

- **Implemented** — File Library 2.0 / Preview Platform W1 Foundation F1-F4 is
  complete through W1-11 runtime/performance work and W1-12 current-truth closeout.
  W2-01 merged through PR #90. R2 merged through PR #96 and hardened public Browse
  identity/lifetime plus Thumbnail source-generation ownership without adding a
  new durable authority. CI-O changed CI/test orchestration only, not product
  runtime behavior. R3 merged through PR #98 and adds the backend-owned opaque
  LocationRef-to-Browse consumability seam without a second filesystem/path
  authority or schema change. R4 changed no production behavior. W2-02 added
  the source-discriminated Library/Browse presentation contracts and pure
  adapters without adding a runtime authority, and merged through PR #101.
- **Validated** — W1-11 reviewed production head
  `70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb` passed exact-head Full Validation
  `32064210757`; existing Query V2 100k/1M thresholds remained unchanged and
  green, and Workspace Foundation scale/resource evidence ran on Windows and
  Apple Silicon macOS. W2-01 additionally passed exact-head frontend, lifecycle,
  authority, real-browser layout/virtualization and CI regression gating at run
  `32137181033` / #717. R0 PR #92 was docs/governance-only and passed CI #728.
  R1 established separate exact-head and merge-integration evidence, deterministic
  tree-equivalence planning and fail-closed required aggregates. R2 implementation
  head `07db9c298e2006a5a5fce86a3249e25b29c8d9dd` passed exact-head PR CI
  `32183587403`. CI-O implementation validation and final reliability closeout
  are **PASS**. Implementation head
  `ca0a489dfdd865b00d07653d792e9bd40eacc94f` was validated by the successful
  docs-only successor `cda5329589b708167ce7a4ec2061e58be9d21e97`: PR CI
  `32237925011` and Full Validation `32238526490`, both first attempt. The
  preceding implementation-head PR CI `32236844339` recorded hosted macOS
  resource-trend variance and is historical, not the accepted closeout result.
  R3 implementation head `1231b1ba509c2925863b799af5e9ac52c7b528e8` passed hosted
  PR CI #758; its final docs-only closeout head `0954890dbe33bfbce4a0294376f87d5516562e19`
  passed hosted PR CI #760 on attempt 2. The #760 exact tree and the R3
  squash-merged product tree are both `87a6f180dd70e4da685e82148c385c57249316fb`.
  R4 independently re-verified public producer/consumer seams against that
  merged product tree and found Browse, Thumbnail, Location, Read Gate, W1 Preview
  Core, Query V2 selection provenance and CI evidence all **HARD PASS**. R4
  closeout head `39a70c4f549634d327da7f441ddafce9fc371d3b` then passed docs/governance
  PR CI #762 and merged through PR #99 as
  `master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`. This does not claim unavailable
  real provider/external-volume fixtures or packaged native visual parity.
- **Packaged** — repository validation includes supported-platform package/build
  paths where applicable; this does not claim signing, notarization or release.
- **Released** — none; no published GitHub release or tag exists.
- **Current implementation work** — W2 remains active for bounded implementation.
  W2-01, R0, R1, R2 and R3 are complete and merged; CI-O final reliability
  closeout passed; R4 verification and its PR #99 current-truth closeout are
  **PASS** and change documentation only. W2-02 Shared Presentation Entry /
  Collection Contracts is complete through PR #101. W2-03 is complete through
  PR #103 and W2-04 is complete through PR #104; W2-05 is the next
  dependency-eligible Track.

## Current W2 remediation gate

R0 architecture/governance remediation is complete through PR #92. R1 CI
evidence/governance hardening is complete through PR #94, and ADR-0004 is
accepted. R2 Browse Identity + Thumbnail Consumability is complete through PR
#96. CI-O removed verified CI duplication/cache waste without changing the W2
product authority graph. R3 Location Consumability is complete and merged
through PR #98.

The pre-W2-02 verification sequence is now complete:

```text
R3 Location Consumability                         ✅ PASS / merged
  -> R4 W1-to-W2 Final Consumability Verification ✅ PASS / merged closeout
  -> W2-02 Shared Presentation Entry / Collection Contracts  ✅ COMPLETE / PR #101
  -> W2-03 Library Mode Adapter / Migration  ✅ COMPLETE / PR #103
  -> W2-04 Browse Mode Navigation + Content  ✅ COMPLETE / PR #104
  -> W2-05 Interaction Convergence + Virtualized List  ← NEXT / dependency-eligible
```

R4 was executed verification-only on
`master@ee7d31813eff3fa4adae6d71470f21ecea5e7214`; its docs/governance closeout
was squash merged through PR #99 as
`master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`. It found no required `BLOCKED`
seam and made no production repair. Browse identity/lifetime, Thumbnail, Location,
Read Gate, W1 Preview Core, Query V2 selection provenance and ADR-0004 CI evidence
are all **HARD PASS** for this dependency gate. The full matrix is recorded in
`docs/project/tasks/W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-RESULT.md`.

**W2-02 is complete and squash merged through PR #101. W2-03 is complete and
squash merged through PR #103; W2-04 is complete and squash merged through PR
#104. W2-05 is the next dependency-eligible Track.** W2-06/W2-07 remain
blocked on W2-05. W3 Preview Platform, W4 Native Integration and W5 Release
remain unauthorized.

### CI-O reliability remediation evidence

Current CI-O status is:

- **CI-O implementation validation: PASS** — the existing CI-O architecture and
  validation lanes remain intact.
- **CI-O reliability closeout: HARD PASS** — the `install-deps` bounded retry,
  browser-install timeout, frontend 20-minute job boundary and first-attempt
  hosted evidence all passed. Implementation head:
  `ca0a489dfdd865b00d07653d792e9bd40eacc94f`. Final validation/docs-only
  successor: `cda5329589b708167ce7a4ec2061e58be9d21e97`.
- PR CI `32237925011` and Full Validation `32238526490` both concluded `success`
  on `run_attempt=1`; Full Validation exact checkout/tree were
  `cda5329589b708167ce7a4ec2061e58be9d21e97` /
  `88ab527001689a7ae1beb13218d60b24aa284b94`.
- The preceding implementation-head PR CI `32236844339` recorded hosted macOS
  resource-trend variance and remains historical; the successful docs-only
  successor evidence above is the accepted closeout result.
- The accepted performance reference remains about 22m30s versus the prior
  implementation evidence of 15m25s (about 31.5% reduction); the hard `>=15%`
  reduction gate remains **PASS** without redefining the baseline.
- **PERFORMANCE — <=14 min target: NOT YET MET** — no broad optimization is
  started in this reliability closeout.

CI-O retains explicit non-blocking classifications from its own closeout:

- **OBSERVED** — GitHub Actions Node 20 deprecation warnings remain external
  runner/action noise and did not change the acceptance result;
- **UNVERIFIED** — the external APFS cross-volume fixture was not provided, and
  platform-inapplicable Windows-only detector evidence is not fabricated on macOS;
- **DEFERRED** — package/release consolidation remained deferred because strict
  equivalence was not proven; R3/R4/W2-02 had not started at CI-O closeout;
- **BLOCKED** — none; the required hosted closeout gates passed.

R1's historical acceptance gaps remain recorded as R1 history; CI-O does not
retroactively rewrite what R1 itself exercised. The preceding CI-O hosted
evidence remains available as historical context, while the successful
docs-only successor evidence above closes this reliability remediation.

## Supported product platforms

- Windows.
- macOS 13 or later on Apple Silicon (`aarch64-apple-darwin`).

Intel Macs, Universal binaries, Rosetta and Linux are not product targets.
Platform detail and mutation guarantees live in
`docs/security/SUPPORTED_PLATFORMS.md` and the related security contracts.

## Completed major programs

- Architecture Remediation V1 through Task 08 and schema 34.
- UI/UX V4.3 product-integration program.
- Apple Silicon macOS native mutation/lifecycle/Quick Look parity baseline.
- M1.1 provider/materialization/portability correctness closeout through PR #63.
- W0 File Library 2.0 / Preview Platform specification through PR #64.
- W1 File Library 2.0 / Preview Platform Foundation through W1-12 closeout and post-closeout audit remediation.
- W2 planning and W2-00 visual/interaction freeze through PRs #86/#87, followed by W2-01 Workspace Shell + Experience Controller through PR #90; this is not W2 product completion.
- W2 pre-W2-02 consumer-boundary remediation R0/R1/R2/R3 through PRs
  #92/#94/#96/#98, followed by R4 verification-only **PASS** and PR #99
  docs/governance closeout. W2-02 then completed through PR #101 as
  `master@f1fd3591977142f08eac139814fecebe2e0e6d96`.
- CI-O Full & PR CI Latency / Redundancy Remediation in PR #97; infrastructure/
  test orchestration only, with no product/runtime authority change. Its final
  reliability closeout passed on the docs-only successor
  `cda5329589b708167ce7a4ec2061e58be9d21e97`, with PR CI
  `32237925011` and Full Validation `32238526490` successful on first attempt.

These are completion records for their bounded scopes, not claims that later
File Library / Preview product Waves or release work are complete.

## W1 Foundation closeout evidence

### Merge ledger

| Track | PR | master merge/squash commit |
| --- | ---: | --- |
| W1-00 Foundation activation | #65 | `3f6f8a72cbca78812ee257431bfa89a8e357f30f` |
| W1-01 Contract Spine | #66 | `3f30f12fea23961e03b4021d0ffa63c80377167b` |
| W1-02 Workspace Navigation | #67 | `68b74580a22fa8853b886185734c5b19478ce52a` |
| W1-03 Ephemeral Browse Core | #68 | `fc97dc17de098efe9d4e9ce1f29698a9e91659ca` |
| W1-04 Location Core | #69 | `0e9a73e886bffaeb660789b06dc80a74f3eb67aa` |
| W1-05 WorkScheduler | #70 | `2955bb67e3e90eef09aa69cd6b0278a8e1245b99` |
| W1-06 Preview Contract Core | #71 | `b6a2608f84c40c9609ad9ec014bb6196fbfb559c` |
| W1-07 Materialization / Read Gate | #73 | `bce4c0f5792ee9cb18b0475351de3303fa73639e` |
| W1-08 Thumbnail Infrastructure | #75 | `172e09dff51f1e9fe5367d5e886d263848c4031c` |
| W1-09 Ephemeral Change / Refresh | #74 | `272093150ffeceef044a0036954a3bfe274f3717` |
| W1-10 Integration Surface | #81 | `1920c3c254992f90335e7c57df4fab819fd6062b` |
| W1-11 Foundation Performance / QA | #82 | `b4001d7c5d09686b15f74125a828b61b0e913b7f` |
| W1-12 Foundation Closeout / Current Truth | #83 | `ecde9f146e1e4e4933f6294358fe4a6523c7c0bd` |

W1-12 records closeout/current truth only and therefore does not create a new
product/runtime baseline. Its merge commit is the durable W1 closeout/governance
record. PRs #84/#85 are post-closeout governance/evidence remediation and do not
change the W1 runtime baseline.

### Final W1-11 HARD evidence

- Real progressive 100k Ephemeral Browse completed on Windows and local Apple
  Silicon macOS filesystem fixtures.
- Per-session caps remain `100,000 EntryRefs / 16,384 PathRefs`; process aggregate
  caps remain `200,000 EntryRefs / 32,768 PathRefs`; capacity fails closed and
  teardown returns registries to zero.
- Real `100,002`-entry managed-scan Scheduler pressure exercised
  `scanner::run_managed_session` through `ManagedScanResourceLeaseAdapter`.
- Windows hard leak detection uses `PROCESS_MEMORY_COUNTERS_EX::PrivateUsage`;
  working-set RSS is diagnostic after trim, and an intentional-retention self-test
  proved the hard detector catches sustained committed-memory growth.
- Apple Silicon macOS Workspace Foundation scale/resource evidence included RSS,
  FD and registry steady-state measurements.
- Existing Query V2 100k/1M performance thresholds were not lowered and remained
  green.
- No final W1-11 `BLOCKED` result remained.

### Known performance TARGET MISSED

The W0 scheduler interference 2x-idle comparison is a **TARGET**, not a HARD
correctness gate. W1-11 preserved these misses rather than weakening the target:

- Windows: idle first-page p95 `166 us`, pressure `382 us` (~`2.30x`) —
  **TARGET MISSED**.
- Apple Silicon macOS: idle `54 us`, pressure `226 us` (~`4.19x`) —
  **TARGET MISSED**.

Scheduler HARD gates still passed: foreground work remained bounded/not
indefinitely blocked, a real heavy authority and Scheduler lease adapter were
exercised, Background work eventually progressed, cancellation released leases,
and scheduler/runtime state returned to zero. The target miss remains a future
optimization/measurement item.

### Explicitly UNVERIFIED after W1 / W2-01 / R2 / R3 / R4

The following remain **UNVERIFIED** where applicable:

- real iCloud and generic File Provider fixtures;
- external APFS and exFAT fixtures;
- SMB/network-volume fixtures;
- OneDrive/removable-drive scenarios without a real exercised fixture;
- true product-level Tauri IPC cancellation/UI interaction beyond the tested
  runtime/command boundary;
- native Quick Look user-visible lifecycle/visual QA not actually exercised;
- packaged/native W2 UI parity, accessibility/focus/keyboard/DPI product QA beyond the W2-01 browser/WebView regression gate;
- W3 rich Preview provider/UI matrices;
- signing, notarization and release publication.

R3 CI #758 and #760 verify hosted W2-01 real-browser regression and hosted Apple
Silicon macOS/Windows validation lanes for the accepted R3 content tree. R4
preserves those results and does not broaden them into missing fixture claims.
Compile success, ordinary local filesystem tests, mocks or capability projection
must not be substituted for unavailable provider/external-volume evidence.

## Preserved authorities

W1 completed without replacing the repository's existing durable authorities,
and W2 implementation does not transfer or replace them:

- File Library Query V2 / `LibrarySelectionV1` for managed-library truth;
- Global Index for system-wide search;
- managed scan-root/watcher revisions and reconciliation;
- authoritative content eligibility/open/revalidation adapted by W1-07 Read Gate;
- filesystem-safety identity/backend revalidation;
- Operation Preview, operation journals, Safe Trash, cleanup and Restore;
- PR #63 provider/materialization/capability semantics.

R2 preserves `BrowseService` as ephemeral lifecycle/path authority, `ReadGate` as
source/version/read-eligibility authority and `ThumbnailService` as scheduler /
cache / deduplication / publication authority. R3 reuses those authorities:
managed Location admission resolves through existing scan-root/database truth,
while ephemeral Location admission resolves through the existing live
`BrowseService` session/root state. Location display names, provider labels,
`scanRootId` and renderer-visible paths do not become filesystem authority. R4
independently re-verified these ownership boundaries and added no authority.

W2 introduces no Query V3, second managed watcher, second content-read authority,
second Scheduler, second mutation/recovery path or new durable job/session database.
Any later Track that discovers a need to alter those boundaries must stop for
explicit architecture/security review.

## Current initiative

**W2 — File Library 2.0 Experience**

Status: active — implementation

Authority record: [`initiatives/W2-file-library-experience.md`](initiatives/W2-file-library-experience.md)

Planning/review history:

- initial W2 planning baseline: `master@08fa22ea8a850ad4b56f3705621dda17de08af80`;
- reviewed W2 implementation plan: `master@e91416c83082b61a0d3042c9438d77c7b8586297` (PR #86);
- reviewed W2-00 visual/interaction freeze: `master@251bab36797cde4129656f57667ed203f20415e6` (PR #87);
- W2-01 Workspace Shell + Experience Controller: `master@2c22c90f67826b255cdce2f82313aa352d61a9f3` (PR #90);
- R0 W1-to-W2 consumer-boundary architecture/governance remediation:
  `master@36ebe6fcde3174876cb2b5dcf1cf33215005e5d9` (PR #92);
- R1 CI Evidence / Governance Hardening:
  `master@9224d8d6ccdbc61a36b59c6f6d0c13c57a75ef66` (PR #94), ADR-0004 accepted;
- R2 Browse Identity + Thumbnail Consumability:
  `master@c3ee881c2580b1bfe2268e0c0e907e10b1949eb8` (PR #96);
- CI-O Full & PR CI Latency / Redundancy Remediation: prior implementation
  evidence remains recorded at `18aee2eb560c82fc03956aa9947fddc3b8b73039`;
  final reliability closeout passed on successor
  `cda5329589b708167ce7a4ec2061e58be9d21e97`, with hosted evidence in PR CI
  `32237925011` and Full Validation `32238526490`;
- R3 Location Consumability:
  reviewed implementation head `1231b1ba509c2925863b799af5e9ac52c7b528e8`,
  squash merged through PR #98 as
  `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214`, with implementation PR CI
  `32257747035` / #758 and final closeout PR CI `32322986793` / #760 successful;
- R4 W1-to-W2 Final Consumability Verification: **PASS** on exact merged R3
  product baseline above; exact docs/governance closeout head
  `39a70c4f549634d327da7f441ddafce9fc371d3b` passed PR CI `32325019015` / #762
  and squash merged through PR #99 as
  `master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7`; durable result in
  `tasks/W2-R4-W1-W2-FINAL-CONSUMABILITY-VERIFICATION-RESULT.md`; no production
  changes.

The initiative authorizes implementation of the reviewed W2 dependency graph.
W2-01 Workspace Shell + Experience Controller has merged through PR #90. R0
consumer-boundary architecture/governance remediation has merged through PR #92.
R1 CI Evidence / Governance Hardening has merged through PR #94. R2 Browse
Identity + Thumbnail Consumability has merged through PR #96. CI-O remains a
bounded infrastructure/test-orchestration scope and does not add a W2 product
Track; its reliability closeout passed. R3 Location Consumability has merged
through PR #98. R4 Final Consumability Verification is **PASS** and its closeout
has merged through PR #99 with no production repair. W2-02 Shared Presentation
Entry / Collection Contracts is complete through PR #101. W2-03 is complete
through PR #103 and W2-04 is complete through PR #104; W2-05 is the next
dependency-eligible Track. W2-06/W2-07 remain blocked on W2-05. W3/W4/W5 and
out-of-plan authority expansion remain unauthorized.

Current implementation truth: W2-01 merged as
`master@2c22c90f67826b255cdce2f82313aa352d61a9f3` (PR #90), R0 merged as
`master@36ebe6fcde3174876cb2b5dcf1cf33215005e5d9` (PR #92), R1 merged as
`master@9224d8d6ccdbc61a36b59c6f6d0c13c57a75ef66` (PR #94), R2 merged as
`master@c3ee881c2580b1bfe2268e0c0e907e10b1949eb8` (PR #96), and R3 product
baseline merged as `master@ee7d31813eff3fa4adae6d71470f21ecea5e7214` (PR #98).
The R4 docs/governance closeout baseline is
`master@81e6b9a4233e5a2a0a79097231cc61afbaff55f7` (PR #99). CI-O reliability
closeout is **HARD PASS**. R4 is **PASS** and production-neutral. W2-02 is
complete through PR #101 at
`master@f1fd3591977142f08eac139814fecebe2e0e6d96`; W2-03 is complete through
PR #103 at `master@eab586a0e009f0b8a167848f7465d66217df1122`, and W2-04 is
complete through PR #104 at
`master@19b24e80be0c64896dea016678ff2b44c7afb9bc`. W2-05 is the next
dependency-eligible Track.

## Open governance priorities

- Proceed with W2-05 within its reviewed taskbook and authority boundaries;
  W2-06 and W2-07 remain blocked until W2-05 stabilizes the interaction seam.
- Preserve the R4 guardrail that the Library-only context-free
  `isSelected(fileId)` helper must not become a shared/cross-source selection
  contract; shared selection/focus remains deferred to W2-05.
- Keep `STATUS.md` as the only current project-stage/baseline/release-state source.
- Keep one durable authority per product domain.
- Keep validation evidence bound to the actual checked-out/executed tree according
  to accepted ADR-0004, including separate head/integration identity and the
  tree-equivalence/non-equivalence rules.
- Preserve Query V2, watcher/reconciliation, content-read and mutation/recovery
  authorities in W2 unless a separately reviewed architecture decision explicitly
  changes them.
- Keep W2 implementation aligned with the reviewed visual/interaction matrix;
  production code may refine polish but may not silently reopen shell ownership,
  responsive pane ownership, selection authority, Browse completeness semantics
  or the W3 boundary.
- Carry the Scheduler 2x-idle target miss forward without silently weakening or
  reclassifying it.
- Keep provider/network/external-volume fixture gaps explicit until real evidence
  exists.
- Continue repository maintainability and test-artifact hygiene rules.

## Status update rule

Every initiative that changes production behavior must update this file before
its final merge. At minimum record the applicable product/runtime baseline,
validation evidence, initiative state, schema/package changes and release state.
A documentation-only activation/closeout records the governance baseline it
creates without pretending that the latest product/runtime baseline changed.
