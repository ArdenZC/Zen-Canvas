# W1-02 — Workspace Navigation — Codex Implementation Brief

Status: active implementation task

Baseline: `master@3f30f12fea23961e03b4021d0ffa63c80377167b` (W1-01 / F1 merge)

Branch: `feat/w1-02-workspace-navigation`

## Goal

Implement the pure WorkspaceSession/navigation state machine required by File Library 2.0. This Track owns session/navigation lifecycle only; it does not own filesystem enumeration, Tauri integration, polished UI, Query V2, Preview runtime or durable filesystem truth.

## Required behavior

- Use the merged W1-01 contracts from `src/types/fileWorkspace.ts` / Rust contract spine; do not invent alternate Entry/Location/Navigation types.
- Implement a pure/testable WorkspaceSession/navigation core, preferably in a dedicated `src/fileWorkspace/` or equivalent module rather than the existing Query V2 store.
- Track current `NavigationTarget`, ordered history and current index.
- Mixed Library/Browse targets share one Back/Forward history.
- Track `lastLibraryTarget` and `lastBrowseTarget` independently for direct mode switching.
- Maintain a monotonically advancing request epoch/generation. Navigation/dispose invalidates prior publication rights; helpers must make stale-result checks explicit and testable.
- Define deterministic dispose semantics; disposed sessions cannot publish or navigate as live sessions.
- Define presentation state only where needed by W0 (e.g. view mode / scroll anchor as bounded optional session data). Do not persist authoritative file facts.
- Cross-process restore must use `WorkspaceRestoreLocator` / stable presentation keys only. Never persist or revive `BrowsePathRef`, ephemeral `LocationRef`, ephemeral `EntryRef`, browseSessionId, or other previous-process authority tokens.
- Keep persistence logic pure/adaptable (serialize/derive restore metadata); W1-10 will wire actual storage/API integration.

## Required tests

At minimum cover:

- Library -> Browse -> Library mixed history and Back/Forward correctness;
- direct mode switching uses last target without corrupting chronological history;
- truncating forward history after navigating from an older history position;
- request epoch invalidates stale publication after navigation;
- dispose invalidates all outstanding publication rights;
- restore serialization contains no ephemeral session/path/entry authority refs;
- safe restore locator preserves structured Library `source + key`;
- failure/invalid restore data fails closed to an explicit caller-handled result, not a guessed target.

## Protected authorities / hotspots

Do not modify or contaminate:

- `useFileLibraryV2Store.ts` / Query V2 authority;
- Tauri command registration / `src-tauri/src/lib.rs` unless a truly unavoidable compile-only module export is justified (prefer none);
- filesystem, watcher, DB/schema, content eligibility/open authority;
- Preview runtime;
- UI shell / polished Library-Browse visual design.

## Non-goals

No W1-03 Browse enumeration, W1-04 Location probing, W1-05 Scheduler, W1-06 Preview core, W1-07 materialization gate, W1-08 thumbnails, W1-09 watcher refresh, W1-10 integration wiring, W2 UI.

## Definition of Done

- Pure deterministic navigation/session module with focused tests.
- No second durable authority and no Query V3.
- No raw path treated as authorization.
- Stale publication and disposal behavior are explicit, not implicit UI convention.
- Typecheck, focused/full frontend tests as appropriate, frontend build, governance/docs checks, and `git diff --check` pass.
- Report any skipped checks honestly and leave the PR Draft for independent review.