# W3-02 — Zen Floating Quick Preview Host

Status: **COMPLETE — independently reviewed and squash merged through PR #121**

Baseline: `master@82734890887ccccf368bec1966b7d55bb7c89385` (W3-01 current-truth closeout / PR #120)

Implementation branch: `feat/w3-02-zen-floating-quick-preview-host`

Final reviewed head: `3adc8ef015cf772933dc5d966289b330d40cc71c`

Final reviewed tree: `37eb86d4993616024ca4101955304722a27e16a1`

Merge-integration checkout: `aa9469b21ce9486a7f9cf2d819c948ec682d69fe`

Exact-head hosted CI: `32585239510` — `success`

Squash merge / runtime baseline:
`master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`

## Goal

Deliver the first real user-facing Zen Floating Quick Preview host by consuming the already-merged W3-01 Preview Core lifecycle, strict representation wire, asset transport and progressive publication contracts. This Track owns frontend Preview experience/session coordination and one floating host shell. It does not add rich providers, pinned Preview, sibling-navigation infrastructure, W4 native system integration, new filesystem/read/materialization authority or mutation capability.

## Authority invariants retained

- `PreviewSession` / W3-01 backend Preview Core remains lifecycle/provider/publication authority.
- The frontend host never selects backend providers or infers provider authority from extension/path.
- Query V2 / `LibrarySelectionV1` remain Library truth.
- BrowseService remains Browse identity/lifetime truth.
- WorkspaceSession and source owners remain File Library navigation/focus/presentation truth.
- MaterializationReadGate remains byte-read/materialization eligibility authority.
- WorkScheduler remains global expensive-work admission authority.
- No renderer-authoritative raw filesystem path, native handle, generic byte-read API or implicit cloud hydration was introduced.
- Floating Preview is disposable UI/session coordination only and owns no durable store.
- W3-02 did not retire broad Vault/File Library compatibility and did not close TD-015.

## Implemented scope

1. Added one renderer-owned `PreviewExperienceController` scoped to the File Library Preview experience.
2. Added one Zen Floating Quick Preview shell through the existing modal/portal ownership boundary.
3. Wired Space/Esc with existing List/Grid, modal, focus, input, IME and platform command ownership.
4. Projected Library managed and Browse ephemeral entries into opaque Preview sources without raw-path reconstruction.
5. Preserved shell-first behavior: shell visibility does not wait for Preview start/provider completion.
6. Kept one shell mounted while the current source changes and rejected stale frontend results by request epoch/source.
7. Rendered truthful Metadata fallback while the production rich-provider registry remains intentionally empty.
8. Centralized Preview lifecycle/cache integration in `FileWorkspaceController` rather than duplicating orchestration across List/Grid/Library/Browse components.
9. Added request/source-bound Preview cache publication guards for create/start/snapshot/switch flows.
10. Added per-`previewId` serialized source-switch transport with one latest-wins pending slot so backend Preview session truth cannot regress behind newer frontend intent.
11. Preserved deterministic cancel/dispose/focus restoration and did not add retry/sleep-based lifecycle behavior.
12. Added focused and real-browser W3-02 coverage without Rust/Tauri, schema, rich-provider, pinned-preview or W4 expansion.

## Accepted product behavior

### Open / toggle

- Space opens Floating Quick Preview only when a valid source-owned logical focus/current Preview source exists.
- No-focus Space is a true no-op: it does not preview row 0, prevent default, move focus or change selection.
- Repeated Space keyboard events are ignored.
- Enter remains outside Preview shortcut ownership.
- Input/editor ownership, IME composition, higher-priority menu/modal ownership and Windows `Alt+Space` remain respected.
- When Floating Preview is already open, Space closes through the same controller close path.

### Source projection

- Library previews the current loaded managed entry through existing managed identity.
- Browse previews the current loaded/current-generation ephemeral entry through its opaque session-scoped identity.
- Compact `all_matching` selection is never materialized merely for Preview.
- No raw filesystem path is constructed or treated as renderer authority.

### Shell-first lifecycle

- The outer floating shell is visible before slow Preview start/provider work finishes.
- Close remains responsive while old start work is pending.
- Changing source while old start work is pending does not wait for the old start to finish.
- Late old start results cannot overwrite current Preview UI/cache truth.

### Live source switching

The final transport model is:

```text
PreviewExperienceController
        │ current UI/source intent + frontend epoch
        ▼
FileWorkspaceController
        │ per-previewId serialized switch mutation
        │ one latest-wins pending slot
        │ request/source publication guard
        ▼
W3-01 PreviewSession
        │ lifecycle / sourceVersion / publication authority
        ▼
Provider / representation publication
```

At most one backend `previewSwitchSource` mutation is in flight for a given `previewId`.

If B is in flight and C/D are requested, only the newest pending source is retained. After B settles, the newest pending source is sent. Superseded B/C responses do not become current frontend cache/UI truth and do not dispose the live session.

This closes the reviewed split-truth failure mode where frontend state/cache could remain C while a later-executing stale backend mutation left the authoritative Preview session on B.

### Close / focus restoration

- Esc, Close button and Space toggle-close share the same close controller path.
- Frontend publication acceptance stops immediately on close.
- Owned Preview work is cancelled/disposed idempotently.
- Focus returns once to the originating/current entry when still valid, otherwise to the owning collection surface.
- No timeout/RAF focus retry chain or duplicate Escape owner was introduced.

### Representation scope

W3-02 consumes the strict W3-01 representation wire at the host boundary but does not implement rich production providers. Metadata fallback remains the normal truthful production representation until W3-04+ provider Tracks merge.

## Final reviewer remediation

Independent review found two correctness blockers before merge.

### 1. No-focus Space row-0 fallback

Initial List/Grid Space handling could fall back to index 0 when `focusedIndex < 0`, manufacturing a Preview target without source-owned logical focus.

Final fix:

- List and Grid require `focusedIndex >= 0` for Space Preview;
- no-focus Space does not call Preview, prevent default or mutate focus/selection;
- Enter retained its separate existing behavior;
- repeated Space is ignored;
- deterministic Library/Browse × List/Grid tests cover the contract.

Status: **CLOSED / PASS**.

### 2. Rapid switch backend/frontend latest-wins

The first remediation prevented stale A/B snapshots from overwriting `FileWorkspaceController.previewsValue`, but overlapping backend source-switch mutations could still execute out of order and leave backend session truth behind current frontend intent.

Final fix:

- per-`previewId` switch mutations are serialized;
- one pending slot coalesces to the newest requested source;
- source switching is not serialized behind slow `previewStart` work;
- superseded responses do not publish or dispose the live session;
- deterministic fixture exposes mock backend truth through `getBackendPreview()`;
- A→B→C/D and rapid B/C tests assert final PreviewExperience state, controller cache and backend record all converge on the newest source;
- late A start and no-spurious-cancel/dispose cases remain covered.

Status: **CLOSED / PASS**.

## Final validation

Local final-head validation:

```text
Focused W3-02 tests                         PASS — 11/11
npm test                                    PASS — 121 files / 1272 tests
npm run typecheck                           PASS
npm run test:remediation                    PASS — 14/14
npm run test:performance:architecture       PASS — 25/25
npm run build:frontend                      PASS
npm run test:governance                     PASS
npm run test:browser:w3-02:real             PASS — 1600×900 and 980×680
git diff --check                            PASS
```

Worktree was clean and task-owned temporary artifacts were removed before final push.

Hosted CI `32585239510` succeeded on the final reviewed head.

ADR-0004 / exact-checkout evidence:

```text
head checkout             3adc8ef015cf772933dc5d966289b330d40cc71c
head tree                 37eb86d4993616024ca4101955304722a27e16a1
integration checkout      aa9469b21ce9486a7f9cf2d819c948ec682d69fe
integration tree          37eb86d4993616024ca4101955304722a27e16a1
tree_equivalent           true
head_validation_required  false
validation lane           merge_integration
```

Packaging/docs-only/unrelated Rust or performance lanes that did not match the final changed scope were skipped by the repository routing contract; all executed lanes passed.

## Real-browser evidence

The W3-02 gate passed at both required viewports (`1600×900`, `980×680`) and exercised the integrated Floating Preview path across Library List/Grid and Browse List/Grid, including:

- shell-first visibility before deferred Preview completion;
- rapid source switching with stale-result suppression;
- Space/Escape close behavior;
- Search and modal/Navigation/Context/Context-menu ownership handoff;
- Metadata fallback;
- focus restoration;
- compact-layout overflow checks;
- console/page-error checks.

Browser evidence is not classified as genuine native VoiceOver/Narrator, Retina/DPI or real provider/filesystem manual QA.

## Maintainability / architecture verdict

- one frontend Preview orchestration owner exists;
- List/Grid do not own independent Preview lifecycle state machines;
- `FileLibraryWorkspace` remains composition/wiring rather than the lifecycle authority;
- `FileWorkspaceController` switch queue is transport ordering only, not a second Preview lifecycle/publication authority;
- legacy Preview compatibility remains isolated;
- no test-only production debug store or timer/sleep-based correctness mechanism was added.

No new ADR was required because W3-02 did not move durable authority, persistence ownership, supported platforms, mutation/recovery ownership or cross-window permission architecture.

## Deferred / out of scope retained

W3-02 completion does **not** authorize or claim completion of:

- W3-03 Pinned Preview or sibling navigation;
- W3-04+ Text/Markdown/structured/table/image/folder/ZIP rich providers;
- native Finder/Explorer host integration (W4);
- generic renderer byte-read/materialization APIs;
- implicit provider/cloud hydration;
- schema changes;
- broad legacy File Library/Vault compatibility retirement;
- closure of TD-015;
- genuine native manual accessibility/display/provider-fixture evidence when not actually executed.

## Closeout verdict

**HARD PASS / MERGED.**

W3-02 is accepted as the first production Zen Floating Quick Preview host and is now part of the W3 runtime baseline at
`master@fe4cb4a7d16976f5dcc9a9dbbc4b2b47937a850e`.

After this current-truth closeout merges, **W3-03 — Pinned Preview + sibling navigation** becomes the unique next authorized production Track.

W3-03 must preserve the W3-01/W3-02 authority and latest-wins lifecycle contracts and must not pull W3-04+ rich providers, W4 native system hosts or new read/materialization authority forward.
