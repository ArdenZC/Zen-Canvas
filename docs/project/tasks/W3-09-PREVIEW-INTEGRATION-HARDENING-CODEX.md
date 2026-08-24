# W3-09 — Failure / Materialization / Security / Accessibility Integration

Status: reviewer-authored taskbook — pre-integration freeze; production convergence is gated on W3-07 and W3-08 runtime merge

Baseline used for this freeze: `master@9950f32452d31699e5a2a70e66ab2c701d4601d1` (W3-06 current-truth closeout)

Branch: `feat/w3-09-preview-integration-hardening`

## Goal

Converge the W3 Preview Platform after the rich-provider Tracks into one truthful, secure, accessible failure/materialization/host behavior without adding another Preview engine, read authority, materialization authority, event bus, provider registry, scheduler or native W4 host.

W3-09 is integration hardening, not a new provider family.

It owns:

- one reviewed recoverable-vs-terminal Preview failure matrix across all W3 built-in providers;
- truthful Metadata fallback and terminal-state presentation;
- explicit `materialization_required` UX without fabricating an unavailable materialization action;
- cross-provider security convergence for inert/sanitized/bounded representations;
- keyboard/focus/IME/screen-reader semantics for Floating and Pinned Preview;
- deterministic integration tests proving sourceVersion/latest-wins/cancel/dispose behavior remains intact through all failure states;
- one real-browser W3-09 integration gate.

It does **not** authorize:

- a renderer-callable raw path;
- a general renderer byte-read API;
- a reusable filesystem/content lease in React;
- implicit materialization, cloud hydration or network fetch;
- a new materialization/download command merely to make a button work;
- a second Preview controller/session/provider registry;
- a generic event bus;
- third-party plugins;
- macro/code execution;
- archive extraction;
- W4 Finder/Explorer native host implementation;
- W3-10 performance acceptance or W3-11 closeout.

---

# 0. Dependency / parallel-execution contract

The reviewed W3 dependency graph places W3-09 after W3-07 Folder and W3-08 ZIP.

Therefore this task has two execution phases.

## Phase A — allowed before W3-07/W3-08 merge

The branch may contain only work that is independent of the unmerged provider implementations, such as:

- R0 audits;
- deterministic failure-matrix test harnesses for already-merged W3-04/W3-05/W3-06 providers;
- shared browser fixture/harness preparation that does not fake Folder/ZIP runtime truth;
- accessibility test scaffolding;
- contract tests around existing terminal/recoverable taxonomy;
- security assertions for already-merged representation families.

Do not change current-truth docs.
Do not create a final implementation PR from a baseline that lacks W3-07 or W3-08.

## Phase B — required before production completion

After W3-07 and W3-08 runtime PRs are independently reviewed and merged:

1. fetch latest `master`;
2. integrate/rebase/cherry-pick safely onto the post-W3-08 master without force-pushing shared reviewed work;
3. resolve shared Preview hotspots against the merged provider implementations;
4. add Folder- and ZIP-specific failure/security/accessibility convergence evidence;
5. run the complete W3-09 validation matrix on that exact head;
6. create exactly one Draft PR against the then-current master.

If either W3-07 or W3-08 remains unmerged, W3-09 may remain a pre-integration branch but MUST NOT claim production completion.

---

# 1. Mandatory read set

Before production edits, read at minimum:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
5. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
6. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
7. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
8. W3-01 through W3-08 taskbooks and final reviewer evidence available on merged master
9. `src-tauri/src/file_workspace/preview.rs`
10. `src-tauri/src/file_workspace/preview_policy.rs`
11. `src-tauri/src/file_workspace/preview_providers.rs`
12. `src-tauri/src/file_workspace/read_gate.rs`
13. all merged W3 provider modules
14. `src-tauri/src/file_workspace/integration/preview.rs`
15. Preview lifecycle/publication integration tests
16. `src/api/fileWorkspacePreviewWire.ts`
17. provider-specific strict payload decoders
18. `src/types/fileWorkspace.ts`
19. `src/fileWorkspace/fileWorkspaceController.ts`
20. `src/views/fileLibrary/preview/previewExperienceController.ts`
21. `src/views/fileLibrary/preview/PreviewContent.tsx`
22. `src/views/fileLibrary/preview/ZenFloatingQuickPreview.tsx`
23. `src/views/fileLibrary/preview/ZenPinnedPreview.tsx`
24. `src/views/fileLibrary/preview/PreviewNavigation.tsx`
25. Preview CSS and i18n dictionaries
26. W2 interaction/accessibility browser gates
27. Tauri command permission matrix and Preview command permission tests

Do not infer behavior from taskbooks if merged runtime differs. Runtime + merged reviewer evidence wins; taskbooks remain scope contracts.

---

# R0 — Fail closed

Before implementation, produce a concise evidence note in the implementation report proving each item below.

## R0.1 Failure taxonomy already exists

Confirm the exact merged Rust enums and mappings.

The intended matrix is:

### Provider-local / recoverable

- `Unsupported`
- `Failed`
- `Timeout`
- `CorruptSource`

These MAY try the next compatible provider and ultimately Metadata fallback.

### Source/session terminal

- `SourceUnavailable`
- `MaterializationRequired`
- `PermissionDenied`
- `IdentityChanged`
- `Cancelled`

These MUST NOT be bypassed by trying another byte-reading provider.

Prove the coordinator currently distinguishes the two classes.

If any merged provider maps an authoritative source/read-gate condition into generic `Failed`/`Timeout` incorrectly, W3-09 owns the smallest mapping correction and deterministic test.

Do not invent new terminal categories unless an existing merged runtime fact cannot be represented truthfully.

## R0.2 Warning/envelope wire

Confirm the strict Rust/TypeScript wire for:

- provider fallback warning;
- metadata fallback warning;
- terminal condition warning;
- completeness;
- effective capabilities.

Unknown warning/terminal kinds must fail closed in TypeScript.

React must not infer terminal state from filename, extension, displayed metadata text or provider ID.

## R0.3 Materialization authority

Search runtime/API/permission matrix for an authoritative renderer-callable, user-initiated Preview materialization action.

At this freeze baseline no such action is expected.

If still absent on the post-W3-08 master:

- show `materialization_required` truthfully;
- DO NOT render `Download to Preview`, `Fetch`, `Hydrate` or equivalent actionable UI;
- DO NOT add a new Tauri command in W3-09 merely to make the product mockup actionable;
- `canRequestMaterialization` must remain false unless an independently reviewed authority genuinely exists.

If another Track has independently added a reviewed materialization authority by then, STOP and re-review its exact capability/action contract before wiring UI.

## R0.4 Provider security inventory

For every merged provider prove its trust boundary and bounded representation:

- Text/source code: inert text, bounded reads/output;
- Markdown: backend parse/sanitize, no executable/resource-bearing output;
- JSON/YAML/XML: bounded parse/tree depth/node budgets; XML has no external entity/resource resolution;
- CSV/TSV: inert cell text; formula-looking values are never executed;
- Image: bounded source/header/decode/output and opaque asset transport; no `file:` renderer path;
- Folder: direct-child only, bounded aggregation, no raw path/recursive scan;
- ZIP: metadata/index only, bounded central-directory/index work, no extraction/path traversal/nested recursion.

If W3-07/08 have not yet merged, mark their R0 rows `PENDING MERGE`; do not fake evidence.

## R0.5 Host ownership / accessibility inventory

Confirm:

- one PreviewExperienceController;
- Floating and Pinned remain host modes over the same Preview Core;
- compact Pinned Context has only one modal/focus owner;
- Space command eligibility already rejects repeat/IME/input/edit/menu/dialog contexts;
- Esc precedence is deterministic;
- close/unpin focus restoration route exists;
- Previous/Next remains source-owner navigation, not provider-owned navigation.

Inventory missing ARIA/status/focus semantics before changing UI.

## R0.6 No W4 leakage

Confirm host kinds reserved for native/W4 remain inactive in production registry/host activation.

Do not add Finder, Quick Look extension, Explorer Preview Handler, COM shell registration, native host tokens or OS integration in this Track.

If W3-09 requires W4 native code to pass, STOP.

---

# 2. Failure matrix implementation

W3-09 must make the failure matrix observable and consistent without broadening authority.

## 2.1 Recoverable provider failure

For each recoverable provider-local error:

```text
Unsupported
Failed
Timeout
CorruptSource
```

required behavior:

1. current provider result is rejected;
2. provider cleanup runs;
3. next compatible provider may be attempted under existing registry order;
4. no source/session terminal warning is fabricated;
5. if no rich provider succeeds, Metadata fallback remains available;
6. Preview shell remains mounted;
7. host controls/capabilities reflect the actual final representation;
8. stale provider output cannot overwrite fallback/current source.

The UI should communicate unsupported/fallback truth without surfacing internal provider IDs or exception strings to users.

Do not create separate retry buttons for every provider.

## 2.2 Terminal source/session condition

For:

```text
SourceUnavailable
MaterializationRequired
PermissionDenied
IdentityChanged
Cancelled
```

required behavior:

- no subsequent byte-reading provider may bypass the condition;
- no stale previous rich representation remains visible as if current;
- no provider-local fallback message mislabels the source condition;
- effective capabilities are fail-closed;
- terminal state remains source/request/sourceVersion-bound;
- switch to a new valid source can recover through the normal existing lifecycle;
- close/dispose/cancel still cleans all provider/read/asset/scheduler resources.

`Cancelled` normally results from user/lifecycle action. Do not flash a scary error banner after an intentional close/switch if the shell is already gone or another source is current.

## 2.3 Terminal UI model

Prefer one shared host-neutral terminal-state presentation component/branch used by Floating and Pinned.

It may display:

- concise state title;
- safe explanatory text;
- current file/folder display identity already allowed by metadata;
- retry only where retry means re-run the existing current-source Preview lifecycle and cannot bypass an authority state.

Do not expose:

- raw paths;
- provider IDs;
- Rust/Tauri error strings;
- sourceVersion;
- lease/token IDs;
- backend command names.

---

# 3. Materialization behavior

`materialization_required` is an explicit terminal Preview state, not a generic error and not Metadata fallback.

## 3.1 No fabricated action

Unless an authoritative action exists after independent review:

- show a non-actionable explanation;
- no fake `Download to Preview` button;
- no button that merely retries the same impossible byte read;
- no implicit background download;
- no network request initiated by renderer;
- no capability claim for `canRequestMaterialization`.

## 3.2 If a reviewed action genuinely exists

Only if R0 proves an independently reviewed authority already exists may W3-09 connect it.

Then the flow MUST be:

```text
user explicit action
→ authoritative materialization request
→ wait for authoritative completion/result
→ re-resolve source
→ obtain NEW sourceVersion
→ re-check read eligibility
→ start normal provider selection/load again
```

Never reuse:

- old sourceVersion;
- old content lease;
- old read result;
- old provider prepared state.

This taskbook does not itself authorize creation of that materialization authority.

---

# 4. Security convergence

Security assertions apply to both provider implementation and host rendering.

## 4.1 Universal host rules

Preview renderers must treat every representation as data.

Forbidden:

- executing provider-supplied script/event handlers;
- arbitrary `dangerouslySetInnerHTML` outside the already-reviewed sanitized SafeHTML seam;
- navigating to provider-supplied arbitrary URLs;
- loading HTTP(S), `file:`, relative filesystem/resource URLs, `data:` or uncontrolled `blob:` resources from textual/structured/archive/folder payloads;
- exposing raw filesystem paths in DOM attributes, href/src/title/tooltips/test hooks;
- evaluating formula-like table cells;
- executing macros/code;
- dynamic third-party provider/plugin loading.

Opaque image asset Blob URLs are allowed only through the already-reviewed bounded Preview asset lifecycle and must be revoked correctly.

## 4.2 SafeHTML/Markdown

Re-prove hostile Markdown cannot create executable or resource-bearing DOM.

Include at minimum fixtures containing:

- `<script>`;
- event attributes;
- iframe/object/embed;
- `<img src=http...>`;
- `file:`;
- relative resource path;
- SVG/script combinations;
- CSS/url-like payloads if the sanitizer permits style-bearing input;
- malformed nested HTML.

No external request/navigation.

## 4.3 XML/YAML/structured input

Re-prove:

- XML external entities/DTDs/resources do not resolve;
- hostile deep YAML remains bounded;
- malformed/oversized structured input cannot fabricate valid Complete output;
- renderer displays escaped inert text only.

## 4.4 Tables

Formula-like text beginning with `=`, `+`, `-`, `@` remains plain text.
No spreadsheet formula evaluation or linkification.

## 4.5 Image

Re-prove:

- no raw source path reaches renderer;
- only exact current asset tuple can retrieve bytes;
- stale asset cannot render after source switch;
- object URLs revoke on source change/close/unmount;
- hostile/oversized/corrupt image fails without leaking decoder capacity.

## 4.6 Folder

After W3-07 merge, prove:

- direct children only;
- no recursion/symlink/package/archive traversal;
- no raw path/navigation ref in summary payload;
- bounded DOM independent of 1k/10k/100k source size;
- progressive snapshots remain stale-safe;
- visible Browse authority remains isolated.

## 4.7 ZIP

After W3-08 merge, prove:

- archive names are inert strings, never extraction targets;
- `../`, absolute paths, drive-letter, UNC-like names do not escape into filesystem actions;
- no extraction;
- no nested unbounded recursion;
- no decompression of entry bodies solely for metadata Preview;
- central-directory/index and wire output stay bounded;
- renderer has no archive-entry navigation authority unless separately reviewed.

---

# 5. Accessibility / keyboard integration

W3-09 must test behavior, not only presence of ARIA attributes.

## 5.1 Space

Space must NOT open/toggle Preview when:

- default already prevented;
- repeated keydown;
- IME composition;
- text input/textarea/select;
- contenteditable;
- textbox/edit/rename context;
- menu/menu interaction context;
- active modal/dialog ownership prevents workspace shortcut;
- no valid focused/active source.

Space on a valid focused file/folder uses the one existing Preview experience.

## 5.2 Esc

Required precedence:

1. Floating Preview close when Floating owns Esc;
2. compact Pinned/Context modal ownership follows existing Context/SideSheet rules;
3. lower-priority workspace dismissals only after Preview/Context ownership declines.

One keypress must not trigger multiple dismissals.

## 5.3 Focus restoration

Prove with real focus assertions:

- Floating open records/restores originating valid focus owner;
- close restores focus to the same entry when still mounted;
- if original entry is gone, use the existing safe workspace focus fallback rather than focusing `body` unpredictably;
- source switching while host remains open does not continuously steal focus;
- Pin handoff does not create a second focus trap;
- Unpin returns to Inspector/no-selection state according to existing Context ownership.

## 5.4 Controls

Close, Pin, Unpin, Previous and Next must have:

- semantic button roles;
- accessible names in both supported UI languages;
- disabled state where unavailable;
- visible keyboard focus;
- no pointer-only interaction requirement.

## 5.5 Screen-reader status

Provide bounded semantic status for meaningful Preview state changes:

- loading/resolving;
- content ready;
- Metadata fallback;
- terminal materialization/permission/unavailable/identity state.

Do not create a noisy live region that announces every Folder progressive counter update or every table/tree row.

Prefer one concise host status announcement per meaningful state transition.

Native VoiceOver/Narrator manual validation is evidence-classified separately. Hosted build/test does not equal native assistive-technology PASS.

## 5.6 Reduced motion

Preview open/close/pin transitions must respect existing reduced-motion behavior. Do not add mandatory animation for correctness or focus timing.

---

# 6. Capability truth

Effective capabilities remain:

```text
Host ∩ Provider ∩ Source
```

W3-09 must not widen capability truth based on fallback UI convenience.

In particular:

- Metadata fallback cannot inherit rich-provider search/zoom/playback;
- terminal states fail closed;
- `canRequestMaterialization` is false without real action authority;
- Folder/Archive child navigation remains false unless the merged provider Track explicitly delivered a reviewed source-owned navigation seam;
- W4 native capabilities remain inactive.

Add regression tests over representative host/provider/source combinations.

---

# 7. Deterministic lifecycle scenarios

Use barriers, deferred promises, fake timers or test-owned channels. No correctness sleeps.

Required backend/frontend integration scenarios include:

## Recoverable fallback

```text
Provider A compatible
→ load fails CorruptSource/Failed/Timeout
→ cleanup A
→ next provider / Metadata fallback
→ shell remains current
→ no terminal warning
```

## Terminal after eligibility drift

```text
eligible snapshot
→ read/resolve drifts to MaterializationRequired
→ terminal condition
→ no later provider bypass
→ no stale rich representation
→ all leases baseline
```

Repeat for PermissionDenied, IdentityChanged and SourceUnavailable where deterministic seams exist.

## Stale A / current B

```text
A provider in flight
→ switch to B
→ A later failure/success/terminal completion
→ A cannot alter B UI/cache/session truth
```

## Intentional cancel

```text
Preview current
→ close/cancel/dispose
→ late provider completion
→ no visible error flash
→ all resources return baseline
```

## Pinned handoff

Ensure terminal/fallback states survive Floating→Pinned staging truthfully without a second Preview host or duplicated provider session.

---

# 8. Test matrix

## 8.1 Rust

At minimum:

- exact recoverable error classification;
- exact terminal classification;
- terminal blocks next byte provider;
- recoverable errors permit fallback;
- fallback warning ordering and no fabricated terminal warning;
- terminal warning exact condition;
- post-lease drift taxonomy for existing byte providers;
- cleanup on success/failure/timeout/cancel/stale;
- provider registry still contains each built-in exactly once;
- W4 host kinds remain fail-closed;
- Folder/ZIP security/lifecycle tests after their merge.

## 8.2 TypeScript contract

At minimum:

- strict warning/terminal decode;
- unknown warning/condition fails closed;
- terminal state rendering never consumes raw backend error text;
- effective capability fail-closed cases;
- materialization action absent when no authority;
- keyboard eligibility matrix;
- focus restoration unit/integration scenarios;
- screen-reader status does not announce unbounded progressive row/count churn.

## 8.3 Existing provider regression

Preserve focused tests for W3-04 through W3-08.

W3-09 may add integration assertions but must not silently rewrite provider hard bounds.

---

# 9. Real-browser W3-09 gate

Add:

```text
npm run test:browser:w3-09:real
```

Run exact head at:

- 1600×900
- 980×680

Required scenarios:

### Failure/fallback

- unsupported rich source → Metadata fallback;
- corrupt/provider failure → shell remains + fallback;
- terminal `materialization_required`;
- terminal permission denied;
- terminal source unavailable/identity changed where fixtureable;
- no fake materialization action when authority absent.

### Hosts

- Library Floating;
- Browse Floating;
- Floating→Pinned;
- Pinned source-follow;
- no-source;
- Unpin;
- compact Context single modal/focus owner;
- exactly one Preview shell/host.

### Keyboard/accessibility

- Space opens valid source;
- repeated Space ignored;
- Space ignored from input/textbox/edit/IME fixture;
- Esc closes correct owner once;
- Close/Pin/Unpin/Previous/Next keyboard operable;
- accessible names present;
- focus restores to originating entry;
- no unexpected focus trap duplication.

### Security

Hostile Markdown/XML/table/archive/folder/image fixture coverage according to merged providers:

- no HTTP(S) resource request;
- no `file:` request/navigation;
- no relative arbitrary resource request;
- no unauthorized `data:`/`blob:` from textual/structured/folder/archive payloads;
- no raw path in link/resource attributes;
- no script execution;
- no console/page errors;
- no horizontal page overflow.

Opaque image Blob URL usage is allowed only in the reviewed Image representation path and must be separately asserted/revoked.

### Evidence classification

If this browser gate is run locally only, report `exact-head local real-browser`.
Do not call it hosted browser evidence unless CI explicitly executes this command on the same exact source/integration tree.

---

# 10. Validation

During Phase A, run all tests touched by pre-integration work plus normal governance/diff checks.

After W3-07 and W3-08 merge and Phase B integration, run the full exact-head suite:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-09:real
npm run test:governance
npm run security:audit
npm run security:audit:rust

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

git diff --check
git diff --check origin/master...HEAD
```

Also run all CI-routed release/platform/native/performance lanes selected for the final implementation diff.

No acceptance claim based only on focused tests.

---

# 11. Hosted CI / exact-head contract

The final W3-09 implementation PR requires a fresh hosted CI run for the exact final head after both W3-07 and W3-08 are merged into its base.

Report:

- final branch HEAD;
- final head tree;
- final base SHA/tree;
- source checkout SHA/tree;
- merge-integration SHA/tree;
- whether source and integration trees are equivalent;
- every executed lane conclusion;
- every intentionally skipped lane classification.

A CI run from the Phase-A pre-integration baseline is not final W3-09 evidence.

---

# 12. PR contract

Use the existing branch:

`feat/w3-09-preview-integration-hardening`

Do not create a second W3-09 branch unless the branch is irrecoverably corrupted and reviewer explicitly authorizes replacement.

Before final PR creation:

- W3-07 runtime PR merged;
- W3-08 runtime PR merged;
- branch integrated onto the resulting master;
- no unresolved shared-preview conflicts;
- full validation complete.

Then:

- push normally;
- create exactly ONE Draft PR against master;
- obtain fresh exact-head hosted CI;
- keep OPEN / DRAFT / UNMERGED;
- do not Ready;
- do not merge;
- do not modify current-truth `STATUS.md`, `ROADMAP.md` or initiative closeout state;
- do not start W3-10 production acceptance from this branch;
- do not start W4 production integration.

Implementation report must include:

- exact failure matrix and mappings;
- materialization authority audit and whether action is absent/present;
- terminal UI evidence;
- fallback evidence;
- capability truth evidence;
- security matrix by provider family;
- no raw-path/network/code/extraction evidence;
- keyboard/IME/Esc/focus evidence;
- screen-reader semantics evidence;
- Folder/ZIP convergence evidence after merge;
- stale/cancel/dispose cleanup evidence;
- real-browser evidence classification;
- exact-head hosted CI evidence;
- honest `UNVERIFIED` native VoiceOver/Narrator/manual evidence.

---

# 13. Reviewer stop conditions

STOP and request architecture review if implementation would require any of the following:

- new durable Preview authority;
- renderer raw path;
- renderer general byte read;
- new materialization/download authority;
- implicit network/cloud hydration;
- second Preview lifecycle/controller/provider registry;
- second scheduler/read gate;
- generic app-wide Preview event bus;
- recursive Folder analytics;
- archive extraction;
- dynamic third-party provider loading;
- W4 Finder/Explorer native host code;
- weakening existing provider hard bounds/security limits;
- claiming native accessibility/manual evidence that was not actually executed.

W3-09 succeeds when the already-built W3 platform fails safely, tells the truth, remains keyboard/screen-reader coherent, and preserves one authority model across every merged provider.