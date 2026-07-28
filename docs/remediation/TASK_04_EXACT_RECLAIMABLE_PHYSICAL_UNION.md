# Task 04 — Exact Reclaimable Physical Union

## 1. Status and baseline

Task 03 was merged through PR #28 after the full frontend, Rust, security, remediation, performance, Windows packaging and macOS packaging gates passed.

Task 04 starts from the merged `master` baseline:

- Task 03 PR: `#28`
- Task 03 source HEAD: `bed37313930653ecbc43d420ccbc356650ca9e39`
- Task 03 squash merge commit: `70427ff648dd5b9fab66e247fbf0a5ddf8912f45`
- Last validated Task 03 CI run: `30362271784`

Task 03 is considered delivered. Task 04 is a focused correctness hardening task and must not reopen or redesign the rest of Task 03.

## 2. Objective

Make run-level `exact_reclaimable_bytes` represent a deterministic union of reclaimable physical storage subjects.

The current implementation separates duplicate-group exact claims from path-owned exact claims, which prevents a large-file finding with `exact = 0` from erasing duplicate exact bytes. However, it can still count the same physical storage twice when a duplicate-group member is also covered by an exact Safe cleanup finding.

Task 04 must guarantee:

> One physical storage subject contributes to run-level exact reclaimable bytes at most once.

This guarantee must hold regardless of detector, finding insertion order, path aliasing, hardlinks, map iteration order, process restart or AI aggregate refresh.

## 3. Required behaviour

### 3.1 Exact and potential remain different facts

`exact_reclaimable_bytes` and `potential_reclaimable_bytes` must remain independently aggregated.

- Exact is a lower-bound physical-storage fact backed by authoritative identity.
- Potential is an upper-bound review estimate and may continue to use path hierarchy suppression where appropriate.
- A potential-only finding must never erase exact bytes.
- Fixing exact aggregation must not silently redefine potential aggregation.

### 3.2 Canonical exact physical subject

Every exact claim included in a run aggregate must resolve to one or more canonical physical subject keys.

Preferred sources, in authority order:

1. durable platform physical identity, such as volume/file identity or the existing `physicalKey` representation;
2. validated managed-file physical/fingerprint identity already stored in the finding snapshot/evidence;
3. duplicate-group member identities resolved from the authoritative duplicate group state;
4. only where no durable physical identity exists, a conservative fallback that cannot merge unrelated physical files and cannot double-count known aliases.

Path alone is not a sufficient exact identity when a stronger physical identity is available.

### 3.3 Duplicate-group contribution

A duplicate group does not own one indivisible physical subject. Its reclaimable exact amount represents removable member subjects while retaining the required keeper semantics already defined by production dedupe authority.

The aggregate implementation must therefore derive duplicate exact contribution from authoritative member physical subjects, rather than treating `duplicate_group:<id>` as an unrelated bucket.

Requirements:

- the keeper is not counted as reclaimable;
- each reclaimable member physical subject is counted once;
- hardlink aliases of the same physical file do not create extra reclaimable bytes;
- a member already counted by an exact Safe cleanup finding is not counted again;
- unrelated Safe physical subjects still add normally;
- stale, inactive, superseded or non-authoritative duplicate membership contributes nothing.

Do not introduce automatic keeper selection, automatic duplicate cleanup or permanent deletion in this task.

### 3.4 Determinism

The result must not depend on:

- `HashMap` iteration order;
- finding insertion order;
- detector execution order;
- path string ordering where physical identity is available;
- process restart;
- repeated aggregate refresh.

Where an ordered winner is required, define an explicit stable ordering and document why it is semantically correct.

### 3.5 Aggregate refresh consistency

All paths that recompute a durable run aggregate must use the same exact-union implementation, including:

- terminal run publication;
- AI assessment aggregate refresh;
- any revalidation or stale transition that refreshes the run;
- restart/hydration-visible durable state.

No secondary implementation or approximate duplicate logic is allowed.

## 4. Implementation guidance

Primary expected implementation area:

- `src-tauri/src/db/queries/analysis.rs`

Related production code may be changed only where required to expose authoritative duplicate member physical identities safely, for example:

- `src-tauri/src/analysis.rs`
- existing dedupe query modules
- existing analysis finding evidence construction

Prefer a small internal representation similar to:

```rust
struct ExactPhysicalClaim {
    physical_key: String,
    reclaimable_bytes: i64,
    source_kind: ExactClaimSource,
}
```

The exact type is not prescribed. The required semantic model is a set/union keyed by physical storage identity, with a deterministic byte contribution per physical subject.

Do not solve the problem by taking `max(duplicate_total, path_total)`. That undercounts unrelated claims and does not establish physical union semantics.

Do not solve it by adding duplicate totals after path totals. That is the current remaining defect.

Do not rely on representative paths to infer duplicate membership when authoritative member rows and physical identity are available.

## 5. Schema and dependency constraints

Default expectation: no new schema migration and no new dependency.

Schema 30 already contains durable finding identity/evidence and the production dedupe model contains authoritative membership. Reuse those facts when possible.

If safe physical union is genuinely impossible with the existing durable facts:

1. stop implementation;
2. document the exact missing fact and why it cannot be reconstructed safely;
3. propose the smallest forward-compatible schema addition;
4. do not create a migration without explicit human approval.

## 6. Required tests

Add focused Rust DB/integration tests for all of the following:

1. **Duplicate plus same member Safe claim**
   - duplicate group exact includes physical member A;
   - Safe heuristic exact also claims A;
   - aggregate counts A once.

2. **Duplicate plus unrelated Safe claim**
   - duplicate reclaimable member A;
   - Safe exact claim B with different physical identity;
   - aggregate equals A + B.

3. **Hardlink aliases**
   - two paths reference one physical file;
   - exact aggregate includes the physical bytes once.

4. **Duplicate aliases and keeper semantics**
   - group contains aliases and at least one distinct reclaimable physical copy;
   - keeper is excluded;
   - aliases do not inflate reclaimable bytes.

5. **Potential-only overlap**
   - large-file or large-directory finding overlaps a duplicate member but has no exact claim;
   - duplicate exact remains present;
   - potential remains independently correct.

6. **Insertion-order determinism**
   - insert equivalent findings in multiple orders;
   - exact and potential totals are identical.

7. **Repeated refresh determinism**
   - refresh the same run aggregate repeatedly;
   - totals remain identical and no cumulative addition occurs.

8. **AI assessment refresh**
   - trigger the existing AI assessment aggregate refresh path;
   - the same physical-union rule is preserved.

9. **Stale/inactive membership**
   - stale finding, inactive group or superseded membership contributes no exact bytes.

10. **Restart/hydration durability**
    - persist, reopen the database and load the run;
    - stored aggregate equals the pre-restart physical union.

Use real production query paths where practical. Avoid tests that merely call an isolated helper with synthetic values while bypassing finding and dedupe persistence.

## 7. Task 03 closeout correction

Update:

- `docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md`

The delivery record must distinguish:

- original Task 03 implementation/revision commits;
- source branch final HEAD: `bed37313930653ecbc43d420ccbc356650ca9e39`;
- squash merge commit on `master`: `70427ff648dd5b9fab66e247fbf0a5ddf8912f45`;
- validated CI run: `30362271784`;
- PR #28 merged status.

Do not rewrite historical implementation claims. Correct only the final delivery bookkeeping and explicitly note that the exact physical-union hardening was deferred to Task 04.

## 8. Scope boundaries

Task 04 must not:

- redesign the analysis UI;
- add new detectors;
- change large-file/large-directory Review + Reveal policy;
- change Review authorization or revision CAS semantics already implemented;
- restore the removed legacy system-trash command;
- change cleanup journal or Safe Trash schema;
- add automatic cleanup;
- add duplicate keeper automation;
- add permanent deletion;
- modify Global Index production behaviour;
- modify Managed AI provider/schema;
- migrate `files.id`;
- add dependencies;
- begin the next product feature task.

Only changes strictly necessary for exact physical-union correctness, its tests and the Task 03 closeout correction are allowed.

## 9. Validation gates

Run the focused tests first, then the full repository gates:

```text
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:remediation
npm run test:performance
npm run build
git diff --check
git status --short
```

The Task 04 PR must also obtain successful GitHub CI for:

- Windows Quality/package;
- macOS Quality/package;
- Dependency audit.

## 10. Delivery requirements

Work on a new branch based on current `master`, suggested name:

```text
remediation/04-exact-reclaimable-physical-union
```

Create one new Draft PR. Do not reuse or reopen PR #28.

Add a closeout document:

- `docs/remediation/TASK_04_IMPLEMENTATION_CLOSEOUT.md`

The closeout must include:

- physical-union design and canonical identity rules;
- production files changed;
- tests added;
- schema/dependency statement;
- full local validation results;
- GitHub CI run and job conclusions;
- final implementation commit and HEAD;
- any remaining risk.

After implementation and CI completion, stop and wait for human code-level review. Do not merge the Task 04 PR automatically.
