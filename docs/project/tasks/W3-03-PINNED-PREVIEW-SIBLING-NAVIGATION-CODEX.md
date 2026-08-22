# W3-03 — Pinned Preview + bounded sibling navigation

Status: **COMPLETE — independently reviewed and squash merged through PR #123**

Baseline: `master@52cca2039070d26f7fabfd7f2ac53cfb315bb79a` (W3-02 current-truth closeout / PR #122)

Implementation branch: `feat/w3-03-pinned-preview-sibling-navigation`

Final reviewed head: `9bdc5f7c80d393bfefcf6ee7b5cdc89653c34fa6`

Final reviewed tree: `f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0`

Merge-integration checkout: `7c36076ab2bacb4d07d9241d63ee9769f4172ee1`

Exact-head hosted CI: `32593460617` — `success`

Squash merge / runtime baseline:
`master@ee841f230277ecb9c6e9d731ef90f66a34814510`

## Goal

Deliver the second Zen Preview host presentation by adding **Pinned Preview as the existing W2 Context Panel `Preview` state**, plus **bounded sibling navigation projected from the current source-owned File Library collection**.

W3-03 consumes the already-merged W3-01 Preview Core and W3-02 Floating Preview experience. It extends that architecture rather than introducing a second Preview engine, second query/selection model, second Context panel, raw-path transport, rich provider implementation or W4 native system host.

Production rich Preview providers remain intentionally deferred to W3-04+; Metadata fallback is therefore a valid and expected W3-03 representation.

## Authority invariants retained

- `PreviewSession` / W3 Preview Core remains lifecycle/provider/publication authority.
- `PreviewExperienceController` remains the single renderer-owned disposable Preview experience coordinator.
- `FileWorkspaceController` remains the frontend backend-handle/cache/transport owner and retains the single per-`previewId` latest-wins switch queue.
- Query V2 / `LibrarySelectionV1` remain managed Library truth.
- BrowseService/session/enumeration remain ephemeral Browse identity/lifetime truth.
- WorkspaceSession and source owners remain navigation/focus/presentation truth.
- MaterializationReadGate remains byte-read/materialization eligibility authority.
- No renderer-authoritative raw filesystem path, native handle, generic byte-read API, second Query/Browse engine or implicit cloud hydration was introduced.
- W3-03 did not implement rich providers or W4 native system integration.

## Implemented scope

1. Added Pinned Preview as the existing W2 Context Panel `Preview` state.
2. Reused the existing W3-02 `PreviewExperienceController` for Floating and Pinned presentation state.
3. Added a typed Floating→Pinned handoff with bounded staging rather than a second Preview lifecycle authority.
4. Created truthful `zen_pinned` backend Preview sessions before successful Context handoff commit.
5. Preserved the current Floating Preview on rejected/stale/failed staging and cleaned staged sessions.
6. Coalesced repeated Pin while handoff is pending into one bounded operation.
7. Ensured successful Pin removes the Floating presentation and disposes the superseded Floating backend session, leaving one visible/current host.
8. Added explicit Pinned `no_source` state that clears stale content.
9. Ensured Pinned source recovery creates `hostKind: zen_pinned` rather than regressing to Floating host identity.
10. Added bounded Previous/Next navigation projected from the current Library/Browse source owner.
11. Kept Library navigation inside existing Query V2 ownership and never expanded compact `all_matching`.
12. Reused the current Browse enumeration and bounded query-page scan for active-query sibling navigation.
13. Added generation/source/provenance invalidation so stale sibling windows fail closed.
14. Reused the existing W3-02 serialized latest-wins switch transport for Pinned rapid source changes.
15. Added deterministic focused and real-browser W3-03 coverage without Rust/Tauri, schema, rich-provider or W4 expansion.

## Accepted product behavior

### Floating → Pinned

The accepted handoff is a bounded staged lifecycle transition:

```text
current Floating source/session
        │ Pin
        ▼
create staged PreviewSession(hostKind = zen_pinned)
        │ validate source/epoch + Context handoff
        ├─ reject/stale/failure → dispose staging, keep Floating
        ▼ success
commit Pinned previewId/snapshot
invalidate superseded frontend epoch
remove Floating presentation
cancel/dispose old Floating backend session
start committed Pinned session
```

There is never more than one visible/current Preview host after commit. A staging session is transient, bounded and disposable; it is not another Preview authority.

### Pinned source truth

- Pinned follows the current Library/Browse source-owned focus.
- Pinned does not maintain a hidden Preview selection model.
- Invalid/no current source clears the snapshot and renders explicit `no_source` UI rather than retaining a stale file.
- When a valid source returns after `no_source`, the newly created backend session is `zen_pinned`.
- Renderer Pinned host state and backend `PreviewSnapshot.hostKind` remain truthful and aligned.

### Bounded sibling navigation

Sibling navigation remains a projection over the current source-owned collection.

Library:

- uses current Query V2-backed loaded presentation state;
- does not create a second query engine;
- does not materialize compact `all_matching` merely for navigation.

Browse:

- uses the current Browse session/enumeration/generation;
- navigates loaded entries first;
- at the loaded edge, uses the existing owner pagination seam;
- active-query Next reuses bounded `QUERY_SCAN_PAGE_BATCH = 8` progression so one user action can cross empty intermediary backend pages until a visible sibling is found, enumeration completes or the existing bound is reached;
- generation/target/session/enumeration drift fails closed with no stale focus movement.

Previous/Next updates focus through the source owner; Preview does not invent its own sibling selection authority.

### Latest-wins source switching

Pinned continues to use the W3-02 transport model:

```text
PreviewExperienceController
        │ current Pinned source intent + frontend epoch
        ▼
FileWorkspaceController
        │ per-previewId serialized switch mutation
        │ one latest-wins pending slot
        │ request/source publication guard
        ▼
W3 PreviewSession
        │ lifecycle / sourceVersion / publication authority
```

Deterministic deferred coverage proves that for Pinned A→B→C/D:

- B may be the only in-flight backend switch;
- C/D coalesce to the newest pending source;
- after B settles, D becomes the next backend mutation;
- superseded B/C do not become final UI/cache truth;
- final `PreviewExperience` source/snapshot is D;
- final `FileWorkspaceController` cache is D;
- final authoritative mock backend record is D;
- host identity remains `zen_pinned`;
- late old Floating/Pinned starts cannot overwrite D;
- no spurious duplicate cancel/dispose is introduced.

## Final reviewer remediation

Independent review found two correctness blockers and one required acceptance-evidence gap before merge.

### 1. Pinned frontend/backend host split truth

Initial Pin changed only renderer presentation state while the authoritative backend session remained `zen_floating`; Pinned no-source recovery also recreated a Floating session.

Final fix:

- Pin stages a new `zen_pinned` backend Preview session using the existing create/start/dispose lifecycle;
- commit occurs only after typed Context handoff acceptance and captured Floating source/epoch validation;
- rejected/stale/failed staging is disposed while Floating remains current;
- successful commit disposes the superseded Floating session;
- repeated Pin shares one pending operation;
- no-source recovery creates `zen_pinned`.

Status: **CLOSED / PASS**.

### 2. Browse active-query Next across empty pages

Initial W3-03 navigation called one ordinary next-page load. A valid later sibling could therefore remain unreachable in one user action when an intermediary backend page contained zero query matches.

Final fix:

- extracted a bounded owner-owned scan seam;
- reused the existing `QUERY_SCAN_PAGE_BATCH = 8` policy;
- reused the current Browse enumeration rather than creating another one;
- validated generation/target/session/enumeration before accepting pages/focus movement;
- deterministic tests cover empty intermediary page → later visible sibling and generation invalidation during scan;
- real-browser evidence covers the query-gap scenario.

Status: **CLOSED / PASS**.

### 3. Pinned latest-wins backend truth evidence

Initial W3-03 browser coverage counted switches/stale starts but did not independently assert final controller cache and authoritative backend truth.

Final fix:

- extended the deterministic fixture with truthful host/backend record inspection;
- deferred Pinned A→B→C/D test now asserts final UI source/snapshot, controller cache and backend record all converge on D;
- host truth is also asserted as `zen_pinned`;
- late old starts and no-spurious lifecycle cleanup remain covered.

Status: **CLOSED / PASS**.

## Final validation

Local final-head validation:

```text
npm run typecheck                           PASS
npm test                                    PASS — 122 files / 1281 tests
npm run test:remediation                    PASS — 14/14
npm run test:performance:architecture       PASS
npm run build:frontend                      PASS
npm run test:browser:w3-03:real             PASS — 1600×900 and 980×680
npm run test:governance                     PASS
git diff --check                            PASS
git diff --check origin/master...HEAD       PASS
```

Worktree was clean and task-owned temporary artifacts were removed before final push.

Hosted CI `32593460617` succeeded on the final reviewed head.

ADR-0004 / exact-checkout evidence:

```text
head checkout             9bdc5f7c80d393bfefcf6ee7b5cdc89653c34fa6
head tree                 f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0
integration checkout      7c36076ab2bacb4d07d9241d63ee9769f4172ee1
integration tree          f4325b7ab8ea099ab781ac48824f2ae3d7e92fb0
tree_equivalent           true
head_validation_required  false
validation lane           merge_integration
```

Frontend, release compile, native macOS performance, Windows/macOS quality, dependency audit and applicable Workspace Foundation performance lanes passed. Unrelated routed matrix lanes were skipped according to repository governance.

## Real-browser evidence

The W3-03 browser gate passed both required viewports (`1600×900`, `980×680`) and exercised:

- Library List/Grid and Browse List/Grid;
- Floating→Pinned handoff with one visible/current host;
- truthful active backend `zen_pinned` host identity;
- source-follow while Pinned;
- Previous/Next navigation;
- Browse active-query empty-page gap → later visible sibling;
- explicit no-source state and stale-content clearing;
- Unpin back to Inspector/no-selection Context behavior;
- rapid latest-wins source switching;
- compact SideSheet single Context/modal ownership;
- horizontal overflow and console/page-error checks.

Browser/hosted evidence is not classified as genuine native macOS manual visual/accessibility proof.

## Maintainability / architecture verdict

- one frontend Preview orchestration owner remains;
- one existing W2 Context Panel owns Pinned presentation;
- `FileWorkspaceController` retains the only Preview source-switch transport queue;
- source owners retain Library/Browse focus, query and enumeration authority;
- Pinned handoff adds no backend host-switch command and no second Preview session authority;
- no test-only global production authority or timer/sleep-based correctness mechanism was added;
- no new ADR was required because W3-03 did not move durable authority, persistence ownership, supported platforms, mutation/recovery ownership or cross-window permission architecture.

## Deferred / out of scope retained

W3-03 completion does **not** authorize or claim completion of:

- W3-04+ Text/Code/Markdown/structured/table/image/folder/ZIP rich providers;
- native Finder/Explorer host integration (W4);
- generic renderer byte-read/materialization APIs;
- implicit provider/cloud hydration;
- schema changes;
- second Query/Browse authority or `all_matching` materialization;
- broad legacy File Library/Vault compatibility retirement;
- closure of TD-015;
- genuine native macOS manual visual/accessibility/display/provider-fixture evidence when not actually executed.
