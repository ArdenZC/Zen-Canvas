# W3-02 — Zen Floating Quick Preview Host

Status: implementation taskbook — code/review branch only

Baseline: `master@82734890887ccccf368bec1966b7d55bb7c89385` (W3-01 current-truth closeout / PR #120)

Branch: `feat/w3-02-zen-floating-quick-preview-host`

## Goal

Deliver the first real user-facing Zen Floating Quick Preview host by consuming the already-merged W3-01 Preview Core lifecycle, strict representation wire, asset transport and progressive publication contracts. This Track owns frontend Preview experience/session coordination and one floating host shell. It does not add rich providers, pinned Preview, sibling-navigation infrastructure, W4 native system integration, new filesystem/read/materialization authority or mutation capability.

## Required read set

Before production edits, read:

- `AGENTS.md`
- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/DEVELOPMENT_WORKFLOW.md`
- `docs/project/CODE_MAINTAINABILITY.md`
- `docs/project/STATUS.md`
- `docs/project/ROADMAP.md`
- `docs/project/ARCHITECTURE_MAP.md`
- `docs/project/TECH_DEBT.md`
- `docs/project/initiatives/W3-preview-platform.md`
- `docs/project/specs/file-library-preview/00-MASTER-SPEC.md`
- `docs/project/specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md`
- `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
- `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
- `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
- `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
- `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
- `docs/project/tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`

Also inspect the current production callers and tests around:

- `src/api/fileWorkspaceApi.ts`
- `src/api/fileWorkspaceMockApi.ts`
- `src/api/fileWorkspacePreviewWire.ts`
- `src/types/fileWorkspace.ts`
- `src/fileWorkspace/**`
- `src/views/fileLibrary/FileLibraryWorkspace.tsx`
- `src/views/fileLibrary/library/**`
- `src/views/fileLibrary/browse/**`
- `src/views/fileLibrary/list/**`
- `src/views/fileLibrary/context/**`
- `src/views/vault/**` preview compatibility callers
- existing ModalPortal/SideSheet/focus/keyboard ownership primitives
- current W2 real-browser gates and browser mock infrastructure.

## Authority invariants

- `PreviewSession` / W3-01 backend Preview Core remains lifecycle/provider/publication authority.
- The frontend host must never select backend providers or infer provider authority from extension/path.
- Query V2 / `LibrarySelectionV1` remain Library truth.
- BrowseService remains Browse identity/lifetime truth.
- WorkspaceSession and existing source owners remain File Library navigation/focus/presentation truth.
- MaterializationReadGate remains byte-read/materialization eligibility authority.
- WorkScheduler remains global expensive-work admission authority.
- No renderer-authoritative raw filesystem path, native handle, generic byte-read API or implicit cloud hydration is introduced.
- Floating Preview is disposable UI/session coordination only and owns no durable store.
- W3-02 does not retire broad Vault/File Library compatibility and does not close TD-015.

## Product contract

### 1. Open/toggle

Space toggles Floating Quick Preview only when command context permits.

When closed and a valid current loaded entry exists:

1. create/show the shell immediately;
2. move logical interaction ownership to the floating host;
3. project the current source into a typed Preview source request;
4. create/start backend Preview work after shell visibility;
5. render the current backend snapshot/publication only if it still matches the current frontend epoch/source.

When already open, Space closes the floating host through the same logical close path as the Close button.

Enter is not a Preview shortcut.

Space must be ignored when:

- a text input/editor owns the key;
- rename/editing is active;
- IME composition is active;
- menu/dialog/higher-priority modal command owner is active;
- no valid current Preview source exists;
- the keyboard event is platform/system-owned;
- on Windows, `Alt+Space` remains OS-owned.

### 2. Source projection

Library source:

- current focused/active loaded managed entry only;
- use existing managed `EntryRef` / Preview source projection;
- never expand `all_matching` into IDs;
- multi-selection still previews the current focused/active entry only.

Browse source:

- current loaded/current-generation ephemeral entry only;
- use the session-scoped opaque ref;
- no path reconstruction;
- no unloaded/unseen entry invention.

No valid current entry means no floating Preview open.

### 3. Shell-first behavior

The outer shell must become visible before source resolution/provider work completes. Shell visibility must not depend on provider probe/load, materialization, network/provider state, folder analytics, image decode, syntax highlighting or exact counts.

The shell may show truthful transient states such as resolving/preparing/loading. Close/Esc must stay responsive while backend work is slow.

Do not add a test-only fake delay to prove shell-first. Use a deterministic mock/deferred backend response so the browser test can assert shell visibility before the Preview start/snapshot resolves.

### 4. Live source switching

While Floating Preview remains open, changing the File Library focused/active entry must keep the outer shell mounted and switch the current backend Preview source/session through the authoritative W3-01 lifecycle surface.

Required ordering:

1. old frontend publication epoch becomes unacceptable immediately;
2. backend switch/cancel invalidates source A publication authority;
3. shell remains mounted and returns to a truthful loading/resolving state for B;
4. only current B request/sourceVersion may render.

A late A result must never flash in B.

Do not destroy/recreate the outer shell for every Arrow-key move.

### 5. Close / focus restoration

Esc closes Floating Preview before lower-priority File Library dismissals.

Close button and Space toggle-close use the same close controller path.

Close must:

- stop frontend acceptance of further publication immediately;
- cancel/dispose owned Preview session/work;
- remove the shell;
- restore focus once to the originating/current File Library entry when still mounted/valid;
- otherwise restore to the owning List/Grid collection surface.

No RAF chains, timeout focus retries or duplicate keyboard dismissal owners.

Outside-pointer behavior must not steal focus back after the user intentionally focuses another valid control.

### 6. Floating host visual anatomy

Implement one sparse floating shell with:

- accessible dialog/foreground-host identity;
- compact file identity/title header;
- one dominant content region;
- resolving/loading/ready/failure/terminal state projection in the same region;
- Close action;
- Pin affordance may be present only as a clearly unavailable/deferred control if the product freeze requires visual continuity, but W3-02 must not implement pinned-host behavior; prefer omitting/disabled-with-truth rather than fake handoff;
- Open/Reveal only if an existing authoritative capability/action already exists and effective capability permits it; do not fabricate actions;
- concise footer/state metadata where useful.

No toolbar-heavy editor/media controls, mutation controls, AI actions, diagnostics or raw path display as authority.

### 7. Representation rendering scope

W3-02 must provide host-side rendering scaffolding for the strict W3-01 representation union without inventing providers.

Because the production Provider Registry intentionally still contains no rich provider after W3-01, the normal production path may remain Metadata fallback.

The host must fail closed for unsupported/unimplemented rich representation renderers. It may add minimal safe host renderers only where required to prove the exhaustive wire can be consumed without crashing, but must not become W3-04/05/06 implementation by stealth.

Do not implement production Text/Markdown/JSON/Table/Image/Folder/ZIP providers here.

### 8. Preview state projection

Explicitly model at least:

- closed;
- resolving/creating;
- loading/starting;
- ready;
- provider-local fallback/metadata fallback;
- source unavailable;
- materialization required;
- permission denied;
- identity changed;
- cancelled/disposed/error.

Provider-local rich failure keeps the shell and may show Metadata fallback. Source/session terminal conditions must not be turned into generic retry loops or alternate byte reads.

No fake materialization/download button unless a separately reviewed authoritative action already exists.

### 9. Frontend ownership

Introduce one cohesive `PreviewExperienceController`-style owner (exact name may differ) for disposable frontend coordination:

- floating-host visibility;
- current frontend preview epoch;
- current source projection;
- Preview API create/start/switch/cancel/dispose calls;
- shell state projection;
- stale frontend result rejection;
- command-context eligibility;
- focus capture/restoration.

Do not put lifecycle orchestration independently into List, Grid, LibraryMode and BrowseMode.

Do not create a new Zustand/global durable Preview store unless existing application architecture demonstrably requires a small transient owner. Prefer a bounded provider/controller scoped to FileLibraryWorkspace. If a global store becomes necessary for a real cross-root reason, STOP for reviewer architecture approval before adding it.

### 10. Modal/focus integration

Reuse existing File Library modal/focus ownership primitives. Floating Preview must not coexist with another File Library modal focus trap unless the existing modal coordinator explicitly allows it.

At compact 980x680:

- opening Preview closes or is blocked by mutually exclusive Navigation/Context modal overlays according to existing command ownership;
- no dual focus trap;
- no horizontal overflow;
- Close/Esc remains reachable.

### 11. Legacy compatibility

Do not delete `FileLibraryPreviewDialog`, Inspector Quick Look or legacy macOS thumbnail compatibility merely because Floating Preview now exists.

W3-02 may redirect a preview-specific caller only if the replacement is actually active and focused behavioral/browser equivalence is proven in this Track. Broad retirement remains later and TD-015 stays open.

## Required implementation boundaries

### Allowed production changes

- frontend Preview experience/controller modules;
- Floating Preview host components/styles;
- FileLibraryWorkspace wiring;
- Library/Browse source-projection adapters if needed;
- command-context/keyboard integration through existing ownership seams;
- Preview API/mock adapters needed to exercise shell-first/switch/cancel/dispose;
- narrow representation host rendering projection;
- accessibility/i18n strings;
- tests/browser gate/package script for W3-02.

### Not allowed

- new Rust provider;
- new backend read/materialization engine;
- schema migration;
- raw path transport;
- W4 Finder/Explorer host integration;
- pinned Preview behavior;
- sibling-navigation engine;
- rich Text/Markdown/structured/table/image/folder/ZIP provider implementation;
- new file mutation actions;
- automatic provider/cloud hydration;
- second Preview lifecycle/publication authority.

If W3-02 cannot be implemented without one of these, STOP and report the exact architecture gap.

## Required tests

### Controller/source tests

- Library focused managed entry -> valid Preview source;
- Browse current ephemeral entry -> valid Preview source;
- no focus/current entry -> no Preview;
- `all_matching` is not materialized;
- switching Library/Browse source increments frontend epoch and rejects stale old results;
- no raw path is created or consumed;
- current source owner remains authoritative.

### Command-context tests

- Space opens from eligible List/Grid state;
- Space closes when floating host already open;
- Enter does not open Preview;
- Space ignored in input/editor;
- Space ignored during rename/editing;
- Space ignored during IME composition;
- Space ignored when higher-priority menu/modal owns keyboard;
- Windows Alt+Space ignored by Preview;
- Esc closes Preview before lower-priority workspace dismissals.

### Shell-first tests

Use a deterministic deferred mock:

- Preview shell is visible before backend start/provider completion;
- close works while start is pending;
- source switch works while old start is pending;
- late old result cannot replace new source.

### Lifecycle tests

- open -> start -> close => cancel/dispose exactly once;
- rapid A -> B -> C switching keeps one shell and only C renders;
- close during pending start suppresses later publication;
- backend terminal state remains explicit;
- repeated open/close cycles do not grow frontend controller/listener/timer state monotonically.

### Focus/accessibility tests

- dialog/host accessible name;
- deterministic initial focus target;
- Tab contained within actionable floating-host controls;
- one Escape owner;
- close restores originating row/cell when still mounted;
- if origin unmounted, restores List/Grid collection surface;
- no delayed focus theft after close and user focus change;
- reduced motion behavior preserved.

### Library/Browse parity

Real browser coverage for both sources:

- Library List;
- Library Grid;
- Browse List;
- Browse Grid;
- source switch while host remains open;
- metadata fallback;
- compact 980x680;
- no horizontal overflow;
- no console/page errors.

## Real browser gate

Add:

`npm run test:browser:w3-02:real`

Use the existing real-browser runner conventions and task-scoped browser artifacts.

Required viewports:

- 1600x900;
- 980x680.

Do not multiply every scenario by all DPR values unless a specific Preview geometry bug requires it. W3-02 is primarily host interaction/lifecycle QA; W3-10 owns final Preview performance/cross-platform matrix.

The gate must include a deterministic delayed Preview mock so shell-first and stale-source suppression are actually observed, not inferred from source-string tests.

## Performance/resource expectations

W3-02 should preserve the W0 shell-first target structurally. Record shell-open observation timing in the real-browser gate, but do not invent a new hard hosted timing threshold if the current browser harness cannot measure it reproducibly.

Hard requirements:

- shell visible before provider completion;
- one active Floating Preview host at a time;
- one frontend controller owner;
- rapid switching does not accumulate sessions/listeners/timers;
- close/dispose returns frontend resources to settled state;
- W2 File Library virtualization/query performance gates remain unchanged.

## Validation

Run focused W3-02 tests first, then the repository's current applicable gates. At minimum:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-02:real
npm run test:governance
git diff --check
```

Run `npm run verify:rust` / `npm run verify:security` only when current repository routing or actual changed scope requires them; hosted CI remains authoritative for platform lanes. Do not touch Rust merely to make W3-02 look more validated.

Preserve all existing W2 browser gates required by current CI/routing.

## Maintainability gate

Before finalizing:

- identify the single frontend Preview orchestration owner;
- report module responsibilities and line counts for newly created controller/host modules;
- ensure FileLibraryWorkspace does not become a giant Preview state machine;
- ensure List/Grid do not each duplicate Preview lifecycle logic;
- ensure legacy Preview compatibility remains isolated rather than imported into the new controller;
- no test-only production debug store/instrumentation.

## Security gate

W3-02 should not need a new Tauri command or permission. If implementation appears to require a new command, cross-window permission, new byte endpoint, new materialization action or raw-path transport, STOP for architecture review before implementing it.

## Definition of Done

- exact baseline and isolated worktree recorded;
- one frontend Preview experience/controller owner;
- Floating Quick Preview shell implemented;
- Space/Esc and command-context rules implemented;
- shell-first behavior deterministically tested;
- Library and Browse valid current entries map to typed Preview sources;
- no valid entry -> no Preview;
- live source switch keeps shell mounted and rejects stale old results;
- close/cancel/dispose/focus restoration deterministic;
- Metadata fallback and terminal states truthfully rendered;
- no rich provider or W3-03+ behavior enters the diff;
- no raw path/generic byte API/implicit hydration/schema/W4 work;
- focused tests pass;
- real-browser W3-02 gate passes at 1600x900 and 980x680;
- applicable repository validation passes;
- task-owned temp artifacts cleaned;
- one Draft PR created and left unmerged for independent review.

## Stop conditions

Stop and return to architecture review if W3-02 appears to require:

- a new durable/global Preview authority;
- a new Tauri permission model or cross-window capability change;
- a generic renderer byte-read/materialization API;
- raw filesystem paths;
- a schema migration;
- W4 native host implementation;
- provider selection in React;
- rich provider implementation merely to make the host look complete;
- a second Query/Browse/selection/navigation authority.

## Final report

Return:

1. preflight branch/base/head/worktree evidence;
2. changed production/test files;
3. controller ownership and lifecycle design;
4. Library/Browse source projection;
5. command-context behavior;
6. shell-first evidence;
7. rapid switch/stale-result evidence;
8. focus/accessibility behavior;
9. browser gate results;
10. local validation;
11. hosted exact-head CI and ADR-0004 lane evidence;
12. maintainability line-count/module review;
13. cleanup;
14. deferred/unverified items;
15. Draft PR URL/state.

Do not Ready, merge or start W3-03+.