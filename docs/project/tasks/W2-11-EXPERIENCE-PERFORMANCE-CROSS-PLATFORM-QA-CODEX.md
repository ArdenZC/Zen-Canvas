# W2-11 Experience Performance and Cross-platform QA — Binding Taskbook

Status: IN PROGRESS — one Draft PR planned; this taskbook does not authorize
Ready, merge, W2-12, W3, W4 or W5.

Base: `origin/master@58e466865cca1f0fa72522dd715c05bd6eb3a0a1`.

Worktree: `F:\Coding\Zen-Canvas-w2-11-experience-qa`.

Branch: `qa/w2-11-experience-performance-cross-platform`.

The source worktree is intentionally isolated from the dirty main checkout.
The final PR head/tree and hosted run identifiers are recorded in the PR body
and final evidence report after the implementation commit. Local browser runs
performed before that commit are exploratory evidence, not exact-head claims.

## 1. Objective and stop boundary

W2-11 composes existing File Library authorities into a deterministic,
integrated performance and cross-platform QA gate. It proves bounded behavior
at 100k logical Library and Browse scale, sparse/late Browse search behavior,
stale query rejection, history restoration, thumbnail steady state and browser
resource growth.

This Track does not add a Query V3, durable store, schema, filesystem
authority, renderer path authority, new scheduler, native provider, W3 Preview
host or platform support. W2-12 remains blocked on W2-11. W3/W4/W5 remain
unauthorized.

The only narrow production fixes allowed by the gate are bounded correctness
or performance defects found in these flows. The current implementation fixes
two such issues:

- Browse sparse-query auto-scanning batches eight backend pages before one
  React publication. Each backend page still uses the existing 1024 raw-entry
  scan budget, the UI still yields through the existing timer, and generation
  and target checks reject stale publication.
- Shared List/Grid demand effects depend on the fields they consume rather than
  the freshly rebuilt interaction projection object, preventing repeated
  clamp/load-more work during high-scale jumps.

## 2. Authority and maintainability review

| Area | Existing authority preserved | W2-11 change |
| --- | --- | --- |
| Managed Library query | File Library Query V2 plus `LibrarySelectionV1` | Browser-only lazy 100k mock pages and exact all-matching summary; no ID materialization |
| Browse navigation | `FileWorkspaceController`, Browse session/path/enumeration refs and source owner | Browser-only lazy deterministic fixture; stale generation/target checks remain source-owned |
| Presentation | `SharedFileList`, `SharedFileGrid`, existing interaction projections | Demand-effect dependency correction; no new selection or lifecycle store |
| Thumbnails | Existing thumbnail/controller authority | Browser mock records request/cancel/variant counters only |
| Persistence/schema | SQLite/Rust database layer | untouched |
| Filesystem/mutation | backend preview, identity checks, journals and Safe Trash | untouched |
| Resource observation | test-only Playwright init-script seam | DOM/listener/Observer/timer/object-URL counters; no production debug state |

The expanded files remain cohesive: the browser mock owns only deterministic
browser fixtures, the gate owns only test orchestration/observation, and the
Browse source owner owns the existing progressive enumeration lifecycle. No
independent durable or external I/O lifecycle was introduced.

## 3. Existing evidence audit

| Requirement | Existing test/evidence | Existing CI job | Platform | Scale | Cold/warm | Existing hard threshold | W2-11 gap/evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Query V2 common/complex performance | `src-tauri/tests/file_library_performance.rs`; performance manifest/suite | `Performance / Library & Content`, profile/aggregate jobs | Windows and Apple Silicon macOS lanes | 100k extended; 1M full | framework records workload phases; no new cold/warm claim | common p95 100 ms; complex p95 150 ms; upper common p95 150 ms; detail 50 ms | Reused, not duplicated or weakened; exact hosted run pending |
| Query V2 migration/schema | `src-tauri/tests/file_library_performance.rs` migration checks | Performance / Library & Content | Windows/macOS native lanes | 100k/1M fixture profiles as applicable | existing suite | migration <=5 s; size delta <=4 MiB | Reused; no schema change |
| Browse progressive/capacity | `src-tauri/src/file_workspace/integration/performance/browse.rs`; Browse service contracts | `Performance / Workspace Foundation`; Rust quality lanes | Windows and Apple Silicon macOS | 100k progressive/capacity and sparse cases | existing performance harness | existing raw scan/entry caps | Integrated UI demand and search gap closed by W2-11 fixture/gate |
| Library List/Grid virtualization | W2-05/W2-06 contracts and real gates | existing frontend browser lane | Chromium browser evidence | existing 100k logical fixture | browser settled scenes | bounded mounted rows/cells and page demand | W2-11 composes List -> Grid -> List with 100k and all-matching |
| Context/history/responsive behavior | W2-07/W2-08/W2-09/W2-10 tests and real gates | existing frontend browser lane | Chromium browser evidence | source/history and 980x680 | settled interaction scenes | no horizontal overflow; source-owned history | W2-11 repeats source/mode/history cycles at high scale |
| Native compile/performance | Rust quality, `Native macOS performance (arm64)`, release compile | existing full validation jobs | Windows and Apple Silicon hosted runners | existing native profiles | existing framework | current CI thresholds | Hosted exact-head evidence pending; not inferred locally |
| Native manual UX | no genuine interactive native device evidence in this worktree | none | macOS/Windows interactive | n/a | n/a | none | VoiceOver/Narrator/Retina/DPI/manual pointer checklist remains UNVERIFIED |

## 4. W2-11 deterministic fixture

The real gate is `npm run test:browser:w2-11:real` and uses the query
`w2-11-browser-fixture=integrated`.

- Seed: `w2-11-fixed-index-v1`.
- Library logical size: 100,000.
- Browse logical size: 100,000.
- Browse raw scan budget: 1,024 per backend page/turn.
- Browse page request bound: 32 projected entries.
- Late sentinel: raw index 99,000, with exactly one matching entry.
- Impossible query: zero matches, partial empty pages until EOF.
- Query replacement: delayed `slow-a` followed by current `slow-b`.
- Library filter: `late` returns 256; `slow-a`/`slow-b` return one each.
- Child folder: eight complete boundary-readable files.
- Ordinary Browse root: one directory plus deterministic file entries; no
  100k `EntryRef` array is allocated.
- Library pages are generated lazily from the requested offset; all-matching
  selection uses count/fingerprint/snapshot metadata and no ID array.

Failure artifacts, when a scene fails, are bounded JSON/PNG files under the
task-owned `.tmp-tests/w2-11-browser-gate` root. Successful runs remove that
root and `.tmp-tests/w2-11-browser-runtime`.

## 5. Integrated browser evidence

The local full-instrumentation gate passed on the isolated worktree before the
implementation commit. Its reported checkout identity was the pre-change
committed base, so these values are `OBSERVED` exploratory evidence and must be
re-run at the final committed head and in hosted CI.

Observed 1600x900 @ DPR 1:

- first useful Library row: 1,553 ms;
- first useful Browse page/entry state: 890 ms;
- initial List rows: 20; initial Grid cells: 56; initial Grid rows: 7;
- final DOM nodes: 240 versus settled baseline 533;
- active ResizeObservers: 2 versus baseline 2;
- active MutationObservers: 1 versus baseline 1;
- active timers: 0 versus baseline 0;
- object URLs: 36 created / 36 revoked;
- active thumbnail requests: 0; 298 requests and 435 cancellations;
- 206 Browse page calls, maximum projected page length 32, scan reached EOF;
- one current Browse session retained and zero disposed sessions, which is the
  expected state while the current page remains mounted.

Observed 980x680 @ DPR 1:

- first useful Library row: 1,102 ms;
- first useful Browse page/entry state: 886 ms;
- initial List rows: 14; initial Grid cells: 30; initial Grid rows: 6;
- final DOM nodes: 240 versus settled baseline 443;
- active ResizeObservers: 2 versus baseline 2;
- active MutationObservers: 1 versus baseline 1;
- active timers: 0 versus baseline 0;
- object URLs: 25 created / 25 revoked;
- active thumbnail requests: 0; 1,662 requests and 213 cancellations;
- 206 Browse page calls, maximum projected page length 32, scan reached EOF.

DPR probes passed in the same local run: 1600x900 @ 1.25 produced 8
columns/56 mounted cells; 980x680 @ 2 produced 5 columns/30 mounted cells;
both had no horizontal overflow and exercised the medium thumbnail variant.

The listener counters are recorded but not treated as exact-zero framework
proof: the 1600x900 net listener count was 250 after baseline 167, and the
980x680 count was 228 after baseline 167. This is `OBSERVED`, not a hidden
pass; hosted/repeated evidence must confirm no monotonic unbounded growth.

## 6. Resource-growth method and predeclared tolerance

Each integrated scene settles a Library baseline, runs the high-scale source,
mode, query, history and thumbnail sequence, then settles three additional
Library/Browse presentation cycles before measurement. The gate compares the
same page's baseline and final state. It does not require framework internals
to reach exact zero.

Predeclared fixed tolerances:

- DOM nodes: final <= baseline + 400;
- active Resize/Mutation/IntersectionObservers: each final <= baseline + 6;
- active timers: final <= baseline + 20;
- live object URLs: fewer than 40 after created/revoked accounting;
- active thumbnail requests: exactly 0 after quiescence;
- mounted List/Grid cells: fewer than 240 in the representative scenes;
- far Grid jump: at most one additional Library page request.

Observer instrumentation tracks actual observed targets through native
`observe`, `unobserve` and `disconnect` prototype methods; it does not replace
the native constructors. This avoids changing virtualizer behavior and avoids
counting an unobserved but garbage-collectable observer as active.

## 7. Native manual QA checklist

No genuine interactive macOS or Windows native environment was available for
this task. All items below are `UNVERIFIED`, not browser passes.

macOS / Apple Silicon:

- VoiceOver reads workspace title, Library/Browse tabs, List/Grid controls,
  result status, selection state and partial/complete Browse state.
- Keyboard-only navigation, Escape hierarchy, focus restoration and
  active-descendant behavior.
- Retina display at native scale and a non-default display scale.
- Trackpad secondary click and context-menu dismissal/restoration.
- Finder-familiar labels and platform wording remain understandable.

Windows:

- Narrator reads the same source, selection, loading, partial and complete
  states.
- Keyboard-only navigation, Ctrl+A semantics, Escape hierarchy and focus
  restoration.
- 125% and 150% display scaling with no clipped primary controls or overflow.
- Mouse right-click, Shift+F10 and context-menu focus restoration.
- Explorer-familiar labels and platform wording remain understandable.

Hosted Windows/Apple Silicon CLI, Rust, browser or compile success must not be
substituted for this manual evidence.

## 8. CI and validation plan

Focused checks:

```text
npm run typecheck
npm test -- tests/fileLibraryW211Experience.test.ts tests/fileLibraryW204Browse.test.ts tests/fileLibraryW208SearchPreferences.test.ts
npm run test:browser:w2-11:real
```

Applicable local checks:

```text
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:governance
npm run test:docs
git diff --check
```

All existing real browser gates through W2-10 are required green in this
worktree: W2-01, W2-04, W2-05, W2-06, W2-07, W2-08, W2-09 and W2-10. No
existing expensive 1M/native performance workload is duplicated by the W2-11
gate.

Hosted exact-head evidence is required before any recommendation:

- interactive CI frontend validation lanes must run W2-11 with
  `W211_EXPECTED_CHECKOUT_SHA` and report actual head/tree evidence;
- Full Validation must run after the PR head exists, even if interactive PR CI
  is green;
- Windows Rust/compile/performance lanes and the Apple Silicon native lanes
  must be recorded by exact job ID;
- the existing `Native macOS performance (arm64)` lane remains the authority
  for native performance evidence.

CI cost control: W2-11 is one integrated browser step appended to the existing
frontend lanes and reuses their Node/Chromium setup. It does not add a second
1M/10 GiB workload, a second Rust test suite, a second package build or a new
performance shard. Hosted wall-time impact remains `UNVERIFIED` until the
exact Full Validation run.

## 9. Classification ledger

- `HARD PASS`: only for an exact-head required gate with directly recorded
  evidence; not yet assigned to the final PR.
- `TARGET MET`: a measured W2-11 target met by the exact committed gate after
  hosted confirmation.
- `TARGET MISSED`: an actual target miss; thresholds must not be silently
  raised.
- `OBSERVED`: local or browser evidence that is useful but not sufficient for
  native/hosted acceptance.
- `UNVERIFIED`: required native manual/platform evidence not exercised.
- `BLOCKED`: evidence cannot be obtained without unavailable infrastructure or
  an authorized scope change.

Current pre-hosted ledger:

| Item | Classification | Reason |
| --- | --- | --- |
| Integrated 100k Library List/Grid and all-matching | OBSERVED | local full-instrumentation gate passed; final exact-head/hosted evidence pending |
| Integrated 100k Browse and sparse/late search | OBSERVED | local gate passed with bounded pages, cursor, EOF knownCount and stale query checks |
| React/DOM/Observer/timer/object-URL steady state | OBSERVED | local baseline/final tolerance checks passed; listener trend needs hosted/repeated confirmation |
| Existing Query V2 100k/1M thresholds | UNVERIFIED | no W2-11 local native perf rerun yet; thresholds unchanged |
| Windows hosted evidence | UNVERIFIED | final exact-head CI not run yet |
| Apple Silicon hosted evidence | UNVERIFIED | final exact-head Full Validation not run yet |
| macOS native manual QA | UNVERIFIED | no genuine interactive native device |
| Windows native manual QA | UNVERIFIED | no genuine interactive native device |
| W2-12/W3/W4/W5 | BLOCKED / NOT AUTHORIZED | explicit stop boundary |

## 10. Draft PR and stop conditions

Create exactly one PR titled:

`W2-11: Experience Performance and Cross-platform QA`

The PR must remain `OPEN`, `DRAFT` and `UNMERGED`. Its body must include the
exact base/head/tree, evidence matrix, fixture definition, 100k Library and
Browse evidence, existing 1M Query evidence, first-useful-content methodology,
sparse/late and stale-query proof, thumbnail steady state, resource caps,
React/Observer growth, Windows and Apple Silicon hosted job IDs, CI cost
comparison, native-manual checklist/classifications and every TARGET MISSED,
UNVERIFIED or BLOCKED item.

After the final Draft PR and required evidence are reported, stop. Do not mark
Ready, squash merge, update W2-11 to complete in `STATUS.md`/`ROADMAP.md`, or
start W2-12/W3/W4/W5.
