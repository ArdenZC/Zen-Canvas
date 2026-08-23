# W3-04 — Text/Code + Markdown providers

Status: COMPLETE — merged through PR #125

Baseline: `master@763bff90aa62e73f3089f32a340dad3cbd497261` (W3-03 current-truth closeout / PR #124)

Branch: `feat/w3-04-text-code-markdown-providers`

## Closeout record

W3-04 is closed as the accepted first rich built-in Preview provider slice.

- PR: #125
- final reviewed head: `bb0fa0ac9a46fb5a4c17ddfa1c634c20d2f3bce7`
- final reviewed tree: `62049ff892d17ceb9c28255c97780f4613248b27`
- merge-integration checkout: `ba2f743138b718710d22aaeab66396c26304d400`
- integration tree: `62049ff892d17ceb9c28255c97780f4613248b27`
- exact-head hosted CI: `32617793286` — success
- squash merge: `master@48e8291f8d1f0367a24eca6329640641468b78ce`
- frontend suite: `123 files / 1284 tests`
- remediation: `14/14`
- performance architecture: `25/25`
- desktop-runtime Rust suite: `805 passed / 15 ignored`
- real-browser gate: `1600×900` and `980×680`
- npm audit: zero vulnerabilities
- Rust audit: success with the existing allowed advisory warnings retained

Accepted outcomes:

- the existing production registry owner composes `builtin.markdown` (priority 300), `builtin.source-code` (200) and `builtin.text` (100) deterministically;
- `MaterializationReadGate` remains the only source/lease/open/bounded-read authority; the provider seam is a backend-only Preview adapter, not a renderer lease/path API;
- one shared authoritative `read_bounded_with_mapping` path preserves post-lease resolve/open/identity/cancel checks while keeping Preview terminal semantics exact;
- provider input is bounded to a 512 KiB source prefix, truncation is truthfully `Partial`, malformed UTF-8/binary-looking content fails safely and huge-line rendering remains bounded;
- Text/Code stays read-only with presentation-only language hints and no execution/tool/language-server authority;
- Markdown uses `pulldown-cmark` + `ammonia` and emits sanitized `safe_html` with executable/resource-bearing constructs and remote/`file:`/relative resource loading removed;
- deterministic post-lease barriers prove MaterializationRequired, MetadataOnly and AvailabilityUnknown truth, stale/source-switch rejection and lease cleanup after a real lease issue;
- Floating and Pinned share the same typed representation renderer and hostile Markdown caused no unexpected external/resource request or navigation in the real-browser gate;
- no W3-05+ provider, W4 system host, raw path, renderer-visible byte lease, second read/query/Preview authority, implicit hydration or schema change was pulled forward.

Next authorized Track: **W3-05 — Structured + Table providers**.

This file remains the historical W3-04 implementation contract; closeout does not reopen its production scope.

## Goal

Deliver the first rich built-in Preview provider slice:

- bounded read-only plain text;
- bounded source-code text with a presentation-only language hint;
- Markdown rendered as sanitized `safe_html`.

W3-04 must consume the merged W3-01 Preview Core/provider registry/read-gate contracts and the merged W3-02/W3-03 Floating/Pinned host experience. It must not create another Preview lifecycle, another content-read/materialization authority, renderer-authoritative paths, code execution, arbitrary remote-resource loading, W3-05+ providers, or W4 native system-host integration.

The user-facing goal remains the W3 experience freeze: Preview answers “What is this file?” quickly, calmly, and read-only. Rich content may improve the dominant content region, but the shell/host architecture stays unchanged.

## Mandatory read set

Before production edits, read at minimum:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
5. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
6. `docs/project/tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`
7. `docs/project/tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md`
8. `docs/project/tasks/W3-03-PINNED-PREVIEW-SIBLING-NAVIGATION-CODEX.md`
9. `src-tauri/src/file_workspace/preview.rs`
10. `src-tauri/src/file_workspace/preview_policy.rs`
11. `src-tauri/src/file_workspace/read_gate.rs`
12. `src-tauri/src/file_workspace/integration/preview.rs`
13. `src/types/fileWorkspace.ts`
14. `src/api/fileWorkspacePreviewWire.ts`
15. `src/views/fileLibrary/preview/PreviewContent.tsx`
16. current Preview wire/provider/read-gate tests and W3-03 browser fixture/gate.

Do not begin provider implementation from extensions or React rendering alone. First trace the authoritative byte-read path end to end.

---

# R0 — Mandatory provider-read consumability preflight

W3-04 is the first production Track that actually needs provider byte reads. Prove the existing backend-only consumer path before adding a provider.

Current architecture already has:

- `MaterializationReadGate` as the authoritative source/lease/read authority;
- `ContentReadLeaseRef` as an opaque process-local capability;
- `ContentReadLeaseConsumer::read_bounded()` as the bounded provider-facing byte consumer;
- request/sourceVersion/cancellation revalidation on every bounded read;
- `PreviewProviderEnvironment` injected into provider `load()`;
- no renderer-callable general byte-read API.

However, do not assume a provider can already obtain a valid lease merely because `read_bounded()` is injected. Trace exactly where a Preview provider obtains an opaque lease bound to its current request/source/sourceVersion and where that lease is released.

## R0 PASS condition

There is one complete backend-only path:

```text
PreviewSession current request/sourceVersion
        ↓
existing MaterializationReadGate authority
        ↓
short-lived Preview-intent opaque lease
        ↓
bounded provider read(s)
        ↓
release/revoke lease on success/failure/cancel/stale/cleanup
```

The provider never receives a filesystem path.

## If the exact lease-acquisition seam is missing

Do **not** add a Tauri command, TypeScript lease API, raw path, generic renderer byte-read method, reusable file handle, or second lease registry.

Add only the smallest backend-only adapter necessary to let a current Preview provider consume the existing `MaterializationReadGate` safely. The adapter must remain owned by/injected from the existing read-gate/integration boundary and may issue/release only `ReadIntent::Preview` leases bound to the current opaque source + request + sourceVersion.

Acceptable shapes include a narrow Preview-only read adapter/guard that internally:

- asks the existing `MaterializationReadGate` to issue the current lease;
- exposes only bounded reads;
- releases the lease deterministically/RAII-style;
- maps read-gate terminal conditions into the existing Preview provider/session failure taxonomy.

The exact type name is not frozen. Authority ownership is frozen.

If solving byte access appears to require a renderer-visible lease issuer, new durable authority, new materialization engine, cross-window permission change, or generic byte-read command: **STOP and report instead of implementing it**.

R0 must have deterministic tests proving lease count returns to baseline after success, provider failure, cancellation/stale switch, and cleanup.

---

# 1. Provider composition

Register W3-04 built-in providers only through the existing production composition root:

`production_preview_provider_registry()` in `preview_policy.rs`.

Do not add providers inside `PreviewSession`, Tauri commands, React, or ad-hoc mode-specific code.

The registry remains static/bounded. No dynamic plugin discovery, DLL/dylib loading, remote grammars, runtime package downloads, or user-installed provider code.

Use stable provider IDs and deterministic priorities. Markdown must be selected ahead of generic text when both are compatible, while generic text/code remains the fallback rich text provider before Metadata fallback.

Provider descriptors must truthfully declare:

- supported Zen hosts (`zen_floating`, `zen_pinned`);
- `reads_content = true`;
- only capabilities the provider actually supplies.

Do not activate W4 host kinds.

---

# 2. Probe and source classification

Provider/host selection is backend-owned.

A filename extension or media hint may be used as a **bounded provider/language hint**, but never as byte-read eligibility or filesystem authority.

Read eligibility must still come from the backend source snapshot / `MaterializationReadGate`.

Required behavior:

- directories are unsupported by W3-04 providers;
- host-provided/W4 sources remain fail-closed unless already supported by existing authority;
- Markdown provider recognizes a deliberately bounded Markdown set (for example `.md`, `.markdown`, and other reviewed aliases if useful);
- generic Text/Code provider recognizes a bounded text/code extension/media-hint set and/or a bounded content probe where the current provider contract safely permits it;
- unknown/binary-looking content must not be forced through a text renderer merely because a name looks textual;
- probe stays cheap and bounded; no whole-file reads in `probe()`.

The source capability policy in `preview_policy.rs` must remain eligibility-based, not extension-authoritative.

---

# 3. Shared bounded text-read policy

Text, code and Markdown must share one small, reviewable bounded-read policy rather than inventing independent unlimited readers.

Define explicit provider constants in backend code and tests.

Constraints:

- a provider must never read an unbounded whole file;
- provider maximum read size must be <= the existing read-gate per-read maximum (currently 1 MiB) and should be materially below it for normal Text/Markdown Preview;
- read only a prefix unless a bounded second read is explicitly required and justified;
- use `BoundedContentRead.complete` to distinguish a complete source from a truncated prefix;
- truncated representation must publish `PreviewCompleteness::Partial` rather than pretending completeness;
- a complete bounded file publishes `PreviewCompleteness::Complete`;
- stale/cancelled/sourceVersion-mismatched reads must not publish;
- no implicit materialization/hydration.

A reasonable W3-04 ceiling is a 512 KiB source prefix. A lower per-provider limit is acceptable if tests and UX remain useful. Do not raise the existing read-gate limit to make the provider easier to implement.

## Huge-line protection

A malicious or generated file containing one enormous logical line must not cause unbounded tokenization, span creation, layout work, or memory amplification.

At minimum:

- provider work is bounded by the prefix cap;
- renderer uses a bounded DOM shape (do not emit one element per character/token for giant input);
- long lines wrap or scroll safely without page-level horizontal overflow;
- syntax highlighting, if present, is skipped/degraded for huge lines or oversized excerpts rather than performing pathological work.

Do not create an unbounded worker pool for highlighting.

---

# 4. UTF-8 and text fidelity

W3-04 v1 Text/Code/Markdown is UTF-8-oriented unless an already-reviewed encoding authority exists.

Required cases:

- valid UTF-8;
- UTF-8 BOM;
- empty file;
- CRLF/LF;
- non-ASCII Unicode;
- invalid UTF-8 / obvious binary bytes;
- oversized/truncated UTF-8 where the prefix may end in a partial code point.

Rules:

- never panic on malformed bytes;
- never silently fabricate a valid-looking string from arbitrary binary data;
- trim a truncated prefix back to the last valid UTF-8 boundary when appropriate;
- invalid UTF-8 that cannot be represented faithfully should fail provider-locally (for example `CorruptSource` / `Unsupported`) and fall through to safe Metadata fallback unless an explicit visible lossy-decoding contract is added and reviewed;
- do not add locale-dependent legacy encoding conversion in W3-04.

---

# 5. Plain Text / Code provider

Output family:

`PreviewRepresentation::Text { text, language }`

Required behavior:

- content is read-only;
- preserve useful whitespace/newlines;
- no code execution, evaluation, compilation, language-server invocation, shell/tool call, macro expansion, or embedded preview execution;
- `language` is a presentation hint only;
- a bounded static extension-to-language mapping is acceptable for syntax presentation, but it must not grant read eligibility or provider authority;
- unknown language => `language: None` rather than guessing aggressively;
- search/select-text controls are available only through final Host ∩ Provider ∩ Source capabilities.

Syntax highlighting is optional for W3-04 if the current renderer can present readable code safely without it. If a highlighting library is added:

- it must be a normal local dependency, not network-loaded;
- grammars/languages must be bounded;
- no code execution;
- no unbounded worker/thread pool;
- huge excerpts/lines must degrade to plain text;
- dependency/security audit must pass.

Do not let frontend highlighting become provider or filesystem authority.

---

# 6. Markdown provider

Output family:

`PreviewRepresentation::SafeHtml { html }`

Markdown conversion and sanitization must happen before the renderer treats the string as SafeHTML.

Do not call arbitrary unsanitized Markdown/HTML “safe_html”.

## Sanitization requirements

Use a mature local Markdown parser and mature HTML sanitizer where practical. Do not implement security-sensitive sanitization with regex substitutions alone.

Sanitized output must not permit:

- `<script>` or executable scripting;
- inline event handlers (`onerror`, `onclick`, etc.);
- `javascript:` / executable URL schemes;
- iframes/objects/embeds or equivalent active content;
- arbitrary external/network resource loads;
- renderer filesystem-relative asset resolution;
- `file:` URLs;
- source-path reconstruction;
- CSS/HTML constructs that can escape the Preview content region or load arbitrary resources.

For W3-04 Markdown images/resources, safe default behavior is **no resource fetch**. Remote and relative image/resource references may preserve alt/textual information but must not cause network or filesystem loading.

Links must not silently navigate the app WebView or fetch content. If an existing capability-backed external-open action is not already wired for Markdown links, render safe link text/inert anchors rather than inventing a navigation authority.

Raw HTML embedded in Markdown must be sanitized under the same policy; dropping unsupported raw HTML is acceptable.

## Output bounds

- parse only the bounded source prefix;
- bound generated/sanitized HTML size so Markdown expansion cannot amplify memory without limit;
- if the source was truncated, publish `Partial`;
- if safe output cannot be produced within the bound, fail provider-locally and preserve Metadata fallback.

Any new Rust dependency for Markdown parsing/sanitization must be narrowly scoped, lockfile-pinned by Cargo, compatible with supported platforms, and pass RustSec/audit. Do not add a frontend Markdown parser merely to avoid the backend read/sanitization boundary.

---

# 7. Preview Core failure/fallback semantics

Do not bypass existing registry semantics.

Provider-local conditions:

- unsupported;
- provider failure;
- timeout;
- corrupt input;

may fall through to another compatible provider / Metadata fallback according to the existing Preview Core rules.

Source/session terminal conditions:

- source unavailable;
- materialization required;
- permission denied;
- identity changed;
- cancelled/stale publication;

must remain terminal for byte-reading providers. Do not try another reader to bypass them.

Provider cleanup must run exactly once through the existing `PreparedPreviewGuard` lifecycle.

A failed Markdown provider may fall through to generic text where compatible only if doing so remains truthful and does not bypass a terminal read condition. Otherwise Metadata fallback is correct.

---

# 8. Capability truth

W3-04 must make provider capabilities truthful without weakening host/source policy.

Text/Code provider may grant only capabilities it actually supports, such as:

- `can_search` if the host renderer really offers bounded in-preview text search;
- `can_select_text` if the rendered text is selectable;
- existing safe Open/Reveal behavior only through the final intersection.

Markdown provider must likewise advertise only implemented renderer behavior.

Do not set a provider capability to true merely because the host/source layer can support it.

The final value remains:

`Host ∩ Provider ∩ Source`.

If W3-04 does not implement an in-preview search UI, keep provider `can_search = false` even though Zen host/source capabilities may be true.

---

# 9. Frontend representation rendering

Extend the existing Preview content renderer; do not create another host or provider selector in React.

Both Floating and Pinned must render the same current typed representation through shared components.

## Text

Render `family: "text"` with:

- read-only selectable text when effective capability permits;
- safe whitespace handling;
- bounded/truncated/Partial disclosure;
- optional language label/styling;
- no editing/execution controls;
- no DOM explosion for syntax tokens.

## SafeHTML

Render only `family: "safe_html"` emitted by the strict Preview wire.

Requirements:

- use one contained Preview content root;
- no scripts/event handlers/network/resource resolution;
- no direct filesystem URL conversion;
- no auto-navigation;
- styles remain scoped so untrusted Markdown cannot alter app chrome;
- truncated/Partial state remains visible.

Using React `dangerouslySetInnerHTML` is permissible only at this narrow renderer seam because the representation contract is explicitly `safe_html`; it must never be fed raw Markdown or unsanitized arbitrary HTML. Tests must prove the backend sanitizer contract and browser no-network behavior.

Do not duplicate the sanitizer in mode-specific components.

---

# 10. Strict wire / completeness / UI state

Reuse the existing exhaustive Rust/TypeScript wire:

- `text`;
- `safe_html`;
- `PreviewCompleteness::{Complete, Partial, Unknown}`;
- existing capability envelope;
- existing warnings/fallback taxonomy.

Do not add a second representation DTO.

Prefer existing `Partial` to express prefix truncation. Do not expand the warning enum solely for cosmetic convenience unless a genuinely required user-visible safety fact cannot otherwise be expressed; any wire change must remain exhaustive and strict on both Rust/TypeScript sides.

The renderer must not classify a valid `text` or `safe_html` representation as `unsupported_representation`.

Metadata fallback continues to work unchanged for unsupported/failed sources.

---

# 11. Cancellation, switching, cleanup

W3-04 providers must obey the existing request/sourceVersion publication authority.

Required race coverage:

- Text A read/provider work pending -> switch to B -> late A result cannot publish;
- Markdown A parsing/sanitizing pending -> switch to B -> late A result cannot publish;
- close/dispose during provider read -> no late publication;
- Pinned A→B→C/D still converges on latest source through the existing `FileWorkspaceController` queue;
- no provider-specific retry loop or sleep-based race correctness;
- read leases/resources return to baseline after completion/cancel/dispose/stale failure.

Do not add another frontend queue, provider-global mutable current source, or durable provider cache.

---

# 12. Deterministic backend tests

Add focused Rust tests for real production provider behavior, not only mock UI fixtures.

Cover at minimum:

## Registry / probe

- production registry contains the expected W3-04 providers exactly once and deterministically;
- provider priorities are deterministic;
- Zen Floating and Pinned supported;
- W4 host kinds remain inactive/fail-closed;
- non-text/directory/binary-looking sources do not become rich text merely from unsafe inference.

## Text

- small valid UTF-8 complete -> `text`, `Complete`;
- empty text -> valid complete representation;
- BOM handled deterministically;
- Unicode/CRLF preserved safely;
- bounded large file -> prefix `text`, `Partial`;
- prefix ending mid-codepoint is handled safely;
- invalid UTF-8/binary fixture never panics and falls back truthfully;
- huge-line fixture stays inside provider/representation bounds;
- code language hint is bounded/presentation-only.

## Markdown security

Use hostile fixtures containing combinations of:

- `<script>`;
- inline event handlers;
- `javascript:` URLs;
- `file:` URLs;
- remote `<img>`/Markdown image;
- relative image/resource paths;
- iframe/object/embed;
- raw HTML;
- malformed HTML/Markdown;
- oversized expansion patterns.

Assert the final `safe_html` output contains no executable/remote/filesystem-loading construct and remains inside output bounds.

## Read authority / lifecycle

- eligible current source reads through the existing gate;
- permission/materialization/unavailable/identity-change remain terminal;
- request/sourceVersion mismatch cannot read/publish;
- source identity change between lease issue and bounded read fails closed;
- success/failure/cancel/stale cleanup returns active Preview leases/resources to baseline;
- provider fallback does not bypass terminal conditions.

Do not weaken existing W1/W3 lifecycle tests.

---

# 13. Frontend focused tests

Add deterministic renderer/integration coverage for:

- Text representation in Floating;
- Text representation in Pinned;
- Markdown `safe_html` in Floating;
- Markdown `safe_html` in Pinned;
- Partial/truncated disclosure;
- selectable vs non-selectable behavior from effective capabilities;
- `text`/`safe_html` no longer treated as unsupported;
- stale representation replacement on rapid source switch;
- Metadata fallback retained;
- no second host/controller/query state.

For malicious SafeHTML test fixtures, do not construct a fake contract that would normalize unsafe HTML as legitimate production output. Keep sanitizer correctness in backend tests; frontend tests may use known-safe sanitized output and defense-in-depth assertions.

No sleeps for correctness.

---

# 14. Real-browser W3-04 gate

Add:

`npm run test:browser:w3-04:real`

Run at both:

- `1600×900`;
- `980×680`.

Exercise at least:

- Library Text -> Floating;
- Library Text -> Pinned;
- Browse Text -> Floating/Pinned;
- source-code language presentation;
- Markdown SafeHTML in Floating and Pinned;
- Partial/truncated disclosure;
- rapid switch from rich representation A to B with no stale flash;
- Metadata fallback for unsupported/failed content;
- existing Pin/Unpin, sibling navigation and no-source behavior remain intact;
- compact Context remains the single modal/SideSheet owner;
- no horizontal page overflow;
- no console/page errors.

## No-network assertion

The browser gate must fail if rendering the malicious/remote-resource Markdown fixture causes an unexpected external HTTP(S), `file:`, or equivalent resource request/navigation.

Do not count the local Vite/app fixture origin itself as a remote-resource violation.

Browser mocks prove renderer/host integration only. They do **not** replace real Rust provider/security/read-gate tests.

---

# 15. Performance / resource bounds

Preserve the W0/W3 targets:

- shell-first <= 100 ms p95 remains owned by the existing host architecture;
- normal local Text/Markdown useful representation target <= 300 ms p95 where applicable.

W3-04 must not weaken existing W2/Query performance thresholds.

Add focused bounded-performance evidence where practical for:

- near-limit text prefix;
- huge single-line text;
- near-limit Markdown + sanitization;
- repeated Preview cycles with lease/resource count returning to baseline.

Do not introduce a benchmark that relies on internet access or machine-specific filesystem locations.

---

# 16. Expected implementation areas

Likely production scope includes:

- `src-tauri/src/file_workspace/preview_policy.rs` — register built-in providers;
- one bounded provider module/folder under `src-tauri/src/file_workspace/`;
- existing Preview/read-gate integration only if R0 proves the narrow lease adapter is missing;
- `src/views/fileLibrary/preview/PreviewContent.tsx` and shared Preview styles/render helpers;
- strict tests/fixtures;
- `package.json` + W3-04 real-browser gate script;
- `Cargo.toml` / `Cargo.lock` only if a mature Markdown parser/sanitizer dependency is required.

This list is not permission to touch unrelated architecture.

Do not modify current-truth `STATUS.md`, `ROADMAP.md`, W3 initiative closeout records, or activate W3-05+ inside the implementation PR.

---

# 17. Stop / architecture-review conditions

STOP and report instead of improvising if implementation appears to require any of:

- renderer-visible raw filesystem path;
- new generic Tauri byte-read/materialization command;
- second content-read lease registry/authority;
- renderer-issued reusable byte lease;
- implicit cloud/provider hydration;
- new durable Preview/provider database or schema migration;
- dynamic/third-party provider/plugin loading;
- provider-owned unbounded worker/thread pool;
- code execution/tool invocation/language-server execution;
- remote Markdown resource fetching;
- W3-05+ structured/table/image/folder/archive provider implementation;
- W4 Finder/Explorer system host work;
- supported-platform policy change;
- mutation/recovery ownership change.

A narrow backend-only adapter that merely exposes the existing `MaterializationReadGate` safely to current Preview providers is not a new authority, but it must remain process-local, bounded, request/sourceVersion-bound and fully tested.

---

# 18. Validation

Run focused provider/read/sanitizer tests first.

Then run at minimum:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-04:real
npm run test:governance

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

npm run security:audit
npm run security:audit:rust

git diff --check
git diff --check origin/master...HEAD
```

If the repository’s current CI classifier routes additional applicable release/performance/platform lanes, they must pass on the final exact head.

Keep task-owned temporary artifacts cleaned and the worktree clean before final push.

---

# 19. PR / evidence contract

Implement directly on the existing branch:

`feat/w3-04-text-code-markdown-providers`

Do not create another branch for implementation.

When production work and local validation are complete:

1. commit normally;
2. no force push;
3. push the existing branch;
4. create exactly one **Draft PR** against `master`;
5. keep it `OPEN / DRAFT / UNMERGED`;
6. obtain a fresh exact-head hosted CI run;
7. report final HEAD/tree and source/integration checkout evidence;
8. report changed files;
9. report registry/provider IDs and priorities;
10. report exact provider input/output bounds;
11. report R0 read-lease ownership/cleanup evidence;
12. report Markdown sanitization policy and hostile-fixture results;
13. report Text/Code UTF-8/large-file/huge-line evidence;
14. report Floating/Pinned renderer/browser evidence;
15. report cancellation/stale/latest-wins evidence;
16. report dependency/audit changes;
17. report anything genuinely `DEFERRED` / `UNVERIFIED` without upgrading it to PASS.

Do not Ready.
Do not merge.
Do not start W3-05+.
Do not perform current-truth closeout inside the implementation PR.

Return implementation evidence only after the Draft PR exists.
