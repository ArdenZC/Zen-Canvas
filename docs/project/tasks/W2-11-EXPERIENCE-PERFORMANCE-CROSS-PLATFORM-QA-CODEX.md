# W2-11 Experience Performance and Cross-platform QA — Binding Taskbook

Status: **COMPLETE — independently reviewed and squash merged through PR #116**

Date closed: 2026-08-22

Original base:
`origin/master@58e466865cca1f0fa72522dd715c05bd6eb3a0a1`

Validated production head:
`a194580ce5be1985edb6bc99317e9a8ff54ddb32`

Validated production tree:
`9ec64970ae8b8198c5f2efb9d53753f6421eff3a`

Docs-only successor before merge:
`8b0415e123b22b968d2a02c9ae915a90b456f33f`

Docs-only successor tree:
`c3c2159fed9bc500896cb2c6888a5c3cbb622e11`

PR CI: `32534065400` — success

Final current-head PR CI: `32535644576` — success

Full Validation: `32534452585` — success

Squash merge / W2 runtime baseline:
`master@1898c290859be204e1778b4b72fc58d22dc08b71`

## 1. Objective

W2-11 was the integrated performance and cross-platform QA gate for File Library
2.0 after W2-10. It did not add a new product feature or authority. It composed
existing Library/Browse/Search/Navigation/List/Grid/Context/Thumbnail lifecycles
into deterministic scale, stale-publication, resource and hosted-platform
evidence.

The original execution boundary required one Draft PR, exact-head CI, a final
Full Validation run and an independent reviewer stop before merge. That boundary
was satisfied. It is historical execution context, not current state.

## 2. Authority preserved

W2-11 did not replace or duplicate:

- Query V2;
- `LibrarySelectionV1`;
- WorkspaceSession;
- BrowseService/session/enumeration lifetime;
- ThumbnailService / ReadGate;
- Location admission;
- source-owned List/Grid/Context interaction state.

QA fixtures and browser instrumentation were test-only evidence. No persistent
QA store, filesystem authority, schema or Preview Host was introduced.

## 3. Accepted scale evidence

### Library 100k

**HARD PASS**

- 100,000 logical rows/items;
- List and Grid mounted work remained bounded;
- List/Grid switching did not materialize 100k IDs;
- compact `LibrarySelectionV1::all_matching` remained authoritative;
- query/snapshot invalidation semantics remained intact.

### Query V2 100k / 1M

**HARD PASS**

Existing accepted thresholds remained unchanged and passing. W2-11 did not relax
absolute performance gates or substitute weaker relative-only criteria.

### Browse 100k

**HARD PASS**

- progressive paging/cursor behavior remained bounded;
- session/request/enumeration identity remained live authority;
- List/Grid rendering remained bounded;
- loaded-only selection remained truthful;
- 100k logical scale did not imply 100k DOM nodes, thumbnail requests or live
  entry refs.

## 4. Browse query stress

The W2-08 bounded current-folder query contract remained intact.

`RAW_DIRECTORY_SCAN_BUDGET = 1024` was not weakened.

Accepted cases:

- 100k impossible-match query: bounded turns, partial empty/short pages allowed,
  live cursor retained;
- late sentinel: progressive turns, sentinel eventually published, complete only
  at EOF, exact `knownCount` only at completion;
- query A → query B: late A publication rejected.

Classification: **HARD PASS**.

## 5. Rapid-switch and history evidence

Repeated Library/Browse/child/query/List/Grid/Back/Forward cycles preserved:

- stale Browse enumeration rejection;
- stale query generation rejection;
- current-entry Thumbnail ownership;
- source-owned focus and selection;
- WorkspaceSession chronology and presentation restoration.

Classification: **HARD PASS**.

## 6. Thumbnail and resource steady state

Accepted assertions include:

- outstanding thumbnail work returns to steady state;
- object URLs return to expected settled state;
- timers return to expected settled state;
- active Resize/Mutation/Intersection observer counts do not grow without bound;
- DOM mounted work remains bounded.

### Listener-growth remediation

The initial `listenerAdds - listenerRemoves` value was retained only as an
observation proxy and was not misrepresented as an exact active-listener count.

Final reviewer remediation added:

1. complete interaction-surface warm-up;
2. eight identical settled lifecycle cycles;
3. a predeclared bounded-growth/plateau rule;
4. per-cycle durable listener-growth signal plus DOM/observer/timer/thumbnail/
   object-URL evidence.

Final durable listener signal remained `19` through the settled cycles. Later
cycle deltas were:

`0,0,0,0,0`

Classification: **TARGET MET / HARD PASS for no monotonic unbounded growth**.

Raw listener churn remains an observation, not an exact active listener census.

## 7. CI cost audit

W2-11 was required not to undo CI-O.

Nearest comparable pre-W2-11 Full Validation:

- run: `32442925524`;
- wall: `759 s` / `12m39s`.

Final W2-11 Full Validation:

- run: `32534452585`;
- wall: `786 s` / `13m06s`.

Difference:

- `+27 s`;
- about `+3.6%`.

The W2-11 real-browser step was about `57 s` and was not the final critical path.
No duplicate full Rust suite, 1M workload, package build or native workload
family was introduced. CI-O architecture therefore remains intact.

Queue-versus-runner-startup attribution could not be authoritatively separated
from GitHub evidence and remains `UNVERIFIED / OBSERVED`.

## 8. Hosted platform evidence

Final hosted validation included:

- Windows quality/performance lanes;
- macOS Rust/release lanes;
- Apple Silicon native performance;
- existing 1M performance shards;
- package/release/security checks;
- exact-head PR CI and Full Validation.

Hosted CLI/build/performance evidence is not equivalent to native manual UX.

## 9. Residual unverified evidence

The following remain intentionally `UNVERIFIED`:

- VoiceOver manual interaction;
- Narrator manual interaction;
- real Retina/HiDPI and Windows scaling manual UI inspection;
- complete native keyboard/trackpad/pointer QA;
- unavailable genuine provider/filesystem fixtures.

These gaps were carried to W2-12 honestly rather than renamed PASS.

## 10. Final acceptance

W2-11 acceptance result:

| Gate | Verdict |
| --- | --- |
| 100k Library bounded | HARD PASS |
| 100k Browse bounded | HARD PASS |
| Query V2 100k/1M thresholds | HARD PASS |
| sparse / late Browse search | HARD PASS |
| stale publication rejection | HARD PASS |
| thumbnail/resource steady state | HARD PASS |
| repeated-cycle listener plateau | TARGET MET / HARD PASS |
| Windows hosted evidence | PASS |
| Apple Silicon hosted evidence | PASS |
| CI cost / CI-O preservation | PASS |
| native-manual accessibility/display evidence | UNVERIFIED |
| exact-head PR CI | PASS |
| Full Validation | PASS |
| independent review | PASS |
| PR #116 merge | COMPLETE |

No W2-12, W3, W4 or W5 implementation was started inside W2-11.

## 11. Handoff

W2-11 handed the merged product/runtime baseline
`master@1898c290859be204e1778b4b72fc58d22dc08b71` to W2-12.

W2-12 is documentation/governance/cleanup only. It must preserve all W2-11
`UNVERIFIED`/`OBSERVED` classifications and may not introduce new product code.
