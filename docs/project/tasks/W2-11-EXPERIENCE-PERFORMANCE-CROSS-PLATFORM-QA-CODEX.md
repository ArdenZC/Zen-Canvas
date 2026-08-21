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

The latest local remediation probe passed the complete integrated scene at
1600x900 and 980x680, plus DPR probes at 1.25 and 2. It ran against the
pre-remediation committed head with uncommitted gate changes, so all values
below are `OBSERVED` exploratory evidence and must be re-run at the final
committed head and in hosted CI.

Both integrated scenes completed the existing 100k Library/Browse, sparse and
late searches, stale-query rejection, List/Grid virtualization, far-jump
clamp, thumbnail cancellation, URL cleanup, overflow and history checks. The
settled repeated scene recorded the following exact per-cycle values. Listener
triples are `listenerAdds/listenerRemoves/listenerNet`; the durable signal is
the separate `durableListenerNet` field.

| Viewport | C0 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | Other per-cycle resources |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1600x900 | 1175/580/595; d=21 | 1379/680/699; d=21 | 1697/780/917; d=21 | 1901/880/1021; d=21 | 2217/980/1237; d=21 | 2415/1062/1353; d=21 | 2743/1162/1581; d=21 | 2941/1244/1697; d=21 | every cycle: DOM 534, RO/MO/IO 2/1/0, timers 0, thumbnails 0, live URLs 0 |
| 980x680 | 1009/574/435; d=21 | 1097/656/441; d=21 | 1185/738/447; d=21 | 1333/820/513; d=21 | 1481/902/579; d=21 | 1569/984/585; d=21 | 1717/1066/651; d=21 | 1805/1148/657; d=21 | every cycle: DOM 444, RO/MO/IO 2/1/0, timers 0, thumbnails 0, live URLs 0 |

The raw listener counter is retained as transparent observation data. Its
growth is dominated by React 19 non-delegated `load/error` registrations on
new thumbnail `img` nodes and virtualizer element registrations; it is not an
exact active-listener count. The predeclared growth signal is
`durableListenerNet`, scoped to `window`, `document` and `MediaQueryList`
without replacing native event behavior. In both viewports it stayed at 21
for all eight cycles; later deltas were `0,0,0,0,0`, spread `0` and increase
`0`.

DPR probes passed in the same exploratory run: 1600x900 @ 1.25 produced 8
columns/56 mounted cells; 980x680 @ 2 produced 5 columns/30 mounted cells;
both had no horizontal overflow and exercised the medium thumbnail variant.

## 6. Resource-growth method and predeclared tolerance

Each integrated scene first warms every relevant surface at least once:
Library, Browse, List, Grid, Search, compact Navigation, Context with a real
selection, Library and Browse context menus, and Back/Forward. Only after that
warm-up does it establish the resource baseline. The deterministic repeated
cycle is identical eight times:

```text
Library → List → Grid → Browse → clear query → slow-b query
→ List → Grid → Library → Back → Forward → Library List → settle 250 ms
```

After every settled cycle the gate records cycle index,
`listenerAdds/listenerRemoves/listenerNet`, `durableListenerAdds`,
`durableListenerRemoves`, `durableListenerNet`, DOM nodes, active
Resize/Mutation/IntersectionObservers, active timers, active thumbnails and
live object URLs. The cycle is a bounded post-warm-up lifecycle scene; it does
not duplicate the complete 100k scan eight times.

The listener-growth rule was declared before final exact-head evidence:

- ignore cycles 0 and 1 as initial settling cycles;
- compare later `durableListenerNet` deltas;
- allow at most 2 consecutive positive deltas;
- later-cycle durable-listener spread must be <= 48;
- later-cycle durable-listener final increase must be <= 32;
- raw listener counters remain visible observation data, not an exact active
  listener count and not an absolute-threshold pass;
- any sustained positive growth in the durable signal fails the gate;
- existing DOM/observer/timer/thumbnail/object-URL hard assertions remain in
  force.

The durable signal is limited to `window`, `document` and `MediaQueryList`.
This is a safe counting seam that calls the original native methods unchanged;
it deliberately avoids an exact active-listener shim with `once`,
`AbortSignal`, capture/options and duplicate-registration semantics. React 19
per-element image listeners and virtualizer element listeners remain in the
raw observation fields and are explained rather than silently discarded.

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

CI cost audit and architecture classification:

- nearest comparable pre-W2-11 Full Validation: `32442925524`, master head
  `d480b7eaec6372efa69dbb28a05e40d4337187bd`,
  `2026-08-21T03:18:38Z` → `03:31:17Z`, wall `759 s / 12m39s`;
- there was no Full Validation between G0/W2-10 and W2-11, so an exact
  post-G0/pre-W2-11 baseline is unavailable and remains `UNVERIFIED`;
- blocked-head W2-11 Full reference: `32527585259`,
  `2026-08-21T21:14:55Z` → `21:38:25Z`, wall `1410 s / 23m30s`;
- the nearest-baseline versus blocked-head job execution comparison was:

| Job/workload | Pre-W2-11 | W2-11 Full | Attribution |
| --- | ---: | ---: | --- |
| Frontend + format quality | 144 s | 203 s | +59 s; W2-11 browser step itself was about 24 s and the frontend job ended at 21:18:42Z, well before Full completion |
| Performance Prepare | 60 s | 1130 s | dominant workload variance; not caused by W2-11 browser step |
| 1M Search / Scan & Schema / Library & Content / Intelligence / Workspace | 107 / 106 / 250 / 108 / 134 s | 86 / 125 / 232 / 113 / 133 s | mixed, not duplicated; no W2-11 routing change |
| Native macOS performance | 720 s | 959 s | +239 s native runner/workload variance |
| Rust macOS / Rust Windows | 719 / 345 s | 875 / 755 s | native/runner variance |
| Package NSIS / DMG | 308 / 211 s | 686 / 362 s | package workload variance |
| Release Windows / macOS | 108 / 56 s | 328 / 147 s | release/package dependency variance |

The Full wall increase was `651 s`; the W2-11 browser step was bounded and
did not extend the critical path. GitHub run/job evidence exposed workload
execution windows but did not provide a separately authoritative queue-versus
runner-startup attribution, so queue attribution is `UNVERIFIED` rather than
inferred. The actionable workload attribution is `OBSERVED`: Performance
Prepare and native/package lanes dominate the difference. This is Case B;
there is no CI routing optimization to make for W2-11.

CI-O remains intact: W2-11 is one integrated browser step reusing the existing
Node/Chromium setup; it adds no second 1M/10 GiB workload, Rust suite, package
build or performance shard, and does not loosen any timeout or threshold. The
final remediation Full run and exact-head job IDs remain pending below.

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
| Integrated 100k Library List/Grid and all-matching | OBSERVED | local remediation probe passed; final exact-head/hosted evidence pending |
| Integrated 100k Browse and sparse/late search | OBSERVED | local remediation probe passed with bounded pages, cursor, EOF knownCount and stale query checks |
| Resource plateau scene | OBSERVED | eight identical post-warm-up cycles recorded per-cycle raw and durable listener/resource snapshots; exact-head/hosted confirmation pending |
| Durable listener growth signal | OBSERVED | `durableListenerNet` stayed 21 with later deltas 0/0/0/0/0 locally; raw per-element framework listener churn remains observation data |
| React/DOM/Observer/timer/object-URL hard assertions | OBSERVED | local repeated scene passed; final exact-head/hosted evidence pending |
| CI cost attribution | OBSERVED / UNVERIFIED | nearest comparable Full and blocked-head Full show Case B workload variance; exact queue split and final remediation Full remain pending |
| Existing Query V2 100k/1M thresholds | UNVERIFIED | no W2-11 local native perf rerun yet; thresholds unchanged |
| Windows hosted evidence | UNVERIFIED | final exact-head CI not run yet |
| Apple Silicon hosted evidence | UNVERIFIED | final exact-head Full Validation not run yet |
| macOS native manual QA | UNVERIFIED | no genuine interactive native device |
| Windows native manual QA | UNVERIFIED | no genuine interactive native device |
| W2-12/W3/W4/W5 | BLOCKED / NOT AUTHORIZED | explicit stop boundary |

## 10. Draft PR and stop conditions

Maintain exactly one existing PR, #116, titled:

`W2-11: Experience Performance and Cross-platform QA`

The PR must remain `OPEN`, `DRAFT` and `UNMERGED`. Its body must include the
exact base/head/tree, evidence matrix, fixture definition, 100k Library and
Browse evidence, existing 1M Query evidence, first-useful-content methodology,
sparse/late and stale-query proof, thumbnail steady state, resource caps,
warm-up and eight-cycle plateau method, predeclared durable-listener rule,
per-cycle evidence, Windows and Apple Silicon hosted job IDs, pre-W2-11 and
final Full Validation cost comparison, critical-path/queue attribution,
CI-O classification, native-manual checklist/classifications and every TARGET
MISSED, OBSERVED, UNVERIFIED or BLOCKED item.

After the final Draft PR and required evidence are reported, stop. Do not mark
Ready, squash merge, update W2-11 to complete in `STATUS.md`/`ROADMAP.md`, or
start W2-12/W3/W4/W5.
