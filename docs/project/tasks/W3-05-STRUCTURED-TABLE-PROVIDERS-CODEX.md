# W3-05 — Structured + Table providers

Status: COMPLETE — merged through PR #127

Baseline: `master@a3f5d3d3bb467d845762462e1567f6687e40206d` (W3-04 current-truth closeout / PR #126)

Branch: `feat/w3-05-structured-table-providers`

## Closeout record

W3-05 is closed as the accepted Structured + Table rich-provider slice.

- PR: #127
- final reviewed head: `3d94c5e1399230bff0aa8ffbae5b01bd8d775a2a`
- final reviewed tree: `2c708e3ec83c6cd27efd91de89c41c9685a48735`
- merge-integration checkout: `1da89e6cd942b9e415fe7c718441f73a433d4bee`
- integration tree: `2c708e3ec83c6cd27efd91de89c41c9685a48735`
- exact-head hosted CI: `32624221341` — success
- squash merge: `master@dde7ecb29e30a0b660fd8123b9203f5f97944a20`
- frontend suite: `123 files / 1288 tests`
- Rust library suite: `822 passed`
- real-browser gate: `1600×900` and `980×680`
- npm audit: zero vulnerabilities
- Rust audit: success with the existing 15 allowed advisory warnings retained

Accepted outcomes:

- the single production registry adds `builtin.structured-json` (260), `builtin.structured-yaml` (250), `builtin.structured-xml` (240), `builtin.table-csv` (230) and `builtin.table-tsv` (220) without creating another provider/read authority;
- Rust freezes strict versioned `StructuredTreePayloadV1` / `TablePayloadV1` payloads inside the existing `structured_tree` / `table` outer wire, while one shared TypeScript decoder validates schema/count/string bounds before rendering;
- all source bytes continue through the W3-04 Preview adapter and `MaterializationReadGate`, with a 512 KiB source prefix and truthful pre/post-lease terminal semantics;
- structured/table parser-to-representation work is bounded by reviewed depth/node/string/XML-attribute/row/column/cell/encoded-output ceilings and limit hits publish truthful `Partial` or provider-local fallback rather than fabricated source content;
- JSON uses bounded visitor construction; YAML consumes events iteratively via `yaml-rust2::Parser::next_token()` with inert non-expanded aliases; XML is event-parsed in memory with DTD/unknown entities rejected and no external resolver;
- CSV/TSV formula-looking values remain inert strings and no spreadsheet/macro execution semantics are introduced;
- incomplete structured prefixes never fabricate object/element roots; a genuinely parsed prefix may remain Partial, otherwise Metadata fallback is preserved;
- deterministic real `PreviewReadGateAdapter → MaterializationReadGate` tests prove an actually issued lease returns to baseline after success, parser failure, stale switch, cancel and post-lease terminal drift with no stale publication;
- Floating/Pinned share the same escaped/inert renderer and exact-head browser coverage observed no external/resource navigation or page-level horizontal overflow;
- no W3-06+ provider, W4 system host, raw path, renderer-visible byte lease, second Preview/read/query/materialization authority, implicit hydration or schema change was pulled forward.

Native macOS manual visual verification was not executed and remains `UNVERIFIED`.

Next authorized Track: **W3-06 — Image provider**.

This file remains the historical W3-05 implementation contract; closeout does not reopen its production scope.

## Goal

Deliver the second rich built-in Preview provider slice:

- JSON structured Preview;
- YAML structured Preview;
- XML structured Preview;
- CSV table Preview;
- TSV table Preview.

W3-05 must extend the already-merged W3 Preview provider platform. It must reuse the single production Provider Registry, the W3-04 backend-only Preview read seam over `MaterializationReadGate`, the existing strict `structured_tree` / `table` representation families, and the existing Floating/Pinned hosts.

The Track must not create another read/materialization authority, another Preview lifecycle, another query engine, renderer-authoritative paths, parser-side network/filesystem access, formula execution, W3-06+ providers, or W4 system-host integration.

---

# 0. Mandatory read set

Before production edits, read at minimum:

1. `docs/project/STATUS.md`
2. `docs/project/ROADMAP.md`
3. `docs/project/initiatives/W3-preview-platform.md`
4. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
5. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
6. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
7. `docs/project/tasks/W3-01-PREVIEW-CORE-CONSUMER-READINESS-CODEX.md`
8. `docs/project/tasks/W3-02-ZEN-FLOATING-QUICK-PREVIEW-HOST-CODEX.md`
9. `docs/project/tasks/W3-03-PINNED-PREVIEW-SIBLING-NAVIGATION-CODEX.md`
10. `docs/project/tasks/W3-04-TEXT-CODE-MARKDOWN-PROVIDERS-CODEX.md`
11. `src-tauri/src/file_workspace/preview.rs`
12. `src-tauri/src/file_workspace/preview_policy.rs`
13. `src-tauri/src/file_workspace/preview_providers.rs`
14. `src-tauri/src/file_workspace/read_gate.rs`
15. `src-tauri/src/file_workspace/integration/preview.rs`
16. `src/types/fileWorkspace.ts`
17. `src/api/fileWorkspacePreviewWire.ts`
18. `src/views/fileLibrary/preview/PreviewContent.tsx`
19. W3-04 provider/read-gate/security/browser tests.

Do not begin by adding React parsers or extension-specific UI. Trace the existing provider/read/fallback path first.

---

# R0 — Consumer / contract preflight

Before implementation, prove all of the following on the merged baseline:

- `production_preview_provider_registry()` remains the single production composition owner;
- `PreviewContentReadAccess` / `PreviewReadGateAdapter` remains the only provider byte-read seam needed by W3-05;
- `MaterializationReadGate` still owns authoritative source resolution, eligibility, lease issue, second revalidation, open, identity checking and bounded read;
- `PreviewRepresentation::StructuredTree { encoded_tree }` and `PreviewRepresentation::Table { encoded_table }` already cross the strict Rust/TypeScript wire;
- the frontend currently treats these families as unsupported and therefore needs only renderer support, not another provider selector;
- provider-local versus terminal read failure semantics from W3-04 remain reusable without a new error taxonomy;
- W3-02/W3-03 latest-wins / Pin / sibling-navigation behavior is provider-neutral and must not be rewritten.

If any required solution appears to need a new generic Tauri byte-read command, renderer-visible read lease, filesystem path, second lease registry/read authority, durable Preview cache/schema, second parser service, or W4 native host: **STOP and report** rather than improvising.

---

# 1. Provider composition

Register W3-05 providers only through the existing production registry owner.

Use stable provider IDs and deterministic priorities. They must outrank generic `builtin.text` for their exact structured/table hints without disturbing the W3-04 Markdown/source-code precedence.

A reasonable deterministic order is:

```text
builtin.markdown         300   (existing)
builtin.structured-json  260
builtin.structured-yaml  250
builtin.structured-xml   240
builtin.table-csv        230
builtin.table-tsv        220
builtin.source-code      200   (existing)
builtin.text             100   (existing)
```

Equivalent nearby priorities are acceptable only if deterministic tests prove the intended precedence.

All W3-05 providers:

- support `zen_floating` and `zen_pinned` only;
- declare `reads_content = true`;
- advertise only capabilities the renderer truly supports;
- remain static built-ins; no runtime plugin discovery or downloaded grammars/parsers.

Do not activate W4 host kinds.

---

# 2. Source classification / probe

Extensions and media types are provider-selection hints only. They never grant byte-read authority.

Required bounded recognition:

- JSON: `.json`, reviewed JSON media types;
- YAML: `.yaml`, `.yml`, reviewed YAML media types;
- XML: `.xml`, reviewed XML media types;
- CSV: `.csv`, reviewed CSV media types;
- TSV: `.tsv`, reviewed tab-separated media types.

Rules:

- provider probe stays cheap and does not read the whole file;
- directory / unsupported host / ineligible source stays unsupported or terminal through existing policy;
- unknown content is not forced into a structured/table provider just because generic text could read it;
- generic W3-04 Text remains a fallback only according to existing registry/failure semantics; no provider may bypass terminal read state to reach Text.

---

# 3. Shared bounded input policy

W3-05 must reuse the W3-04 backend Preview read seam and the existing read-gate maximum. Do not raise the read-gate ceiling.

Use explicit constants and tests. Recommended maximum source prefix:

```text
STRUCTURED_TABLE_READ_BYTES <= 512 KiB
```

A lower limit is acceptable. A larger limit requires reviewer justification and must still remain below the authoritative read-gate bound.

Every provider must:

- read only a bounded prefix;
- use `BoundedContentRead.complete` as source truth;
- publish `PreviewCompleteness::Partial` when source bytes are truncated or representation limits discard data;
- publish `Complete` only when both source and representation are complete;
- never silently call a second unbounded whole-file reader;
- preserve W3-04 terminal truth at lease issue **and** post-lease revalidation;
- release Preview leases/resources on success/failure/cancel/stale switch.

A syntactically incomplete prefix from a larger source must not be mislabeled corrupt if incompleteness is plausibly caused by the configured prefix limit. The provider may emit a bounded partial representation when safe, or fail provider-locally to Metadata fallback; it must not fabricate completeness.

---

# 4. Freeze the encoded representation payloads

The outer strict wire is already frozen:

```text
structured_tree { encodedTree: string }
table           { encodedTable: string }
```

W3-05 must **not** add another top-level representation family merely to avoid defining these strings.

However, `encodedTree` / `encodedTable` must not become arbitrary undocumented strings. W3-05 freezes each as a versioned, strict JSON payload generated by Rust and decoded by one shared frontend helper.

The renderer must not parse the original source JSON/YAML/XML/CSV/TSV. It parses only these bounded backend-produced payloads.

## 4.1 StructuredTree payload v1

Use a schema equivalent to:

```ts
type StructuredTreePayloadV1 = {
  schemaVersion: 1;
  format: "json" | "yaml" | "xml";
  root: StructuredNodeV1;
  truncation: {
    depth: boolean;
    nodes: boolean;
    strings: boolean;
  };
};

type StructuredNodeV1 =
  | { kind: "object"; entries: Array<{ key: string; value: StructuredNodeV1 }> }
  | { kind: "array"; items: StructuredNodeV1[] }
  | { kind: "scalar"; scalarType: "string" | "number" | "boolean" | "null"; value: string }
  | { kind: "element"; name: string; attributes: Array<{ name: string; value: string }>; children: StructuredNodeV1[] }
  | { kind: "text"; value: string };
```

Minor field-name changes are acceptable only if Rust + TypeScript tests freeze one exact schema.

Do not put raw filesystem paths, source URLs, parser objects, executable tags, or unbounded source fragments in the payload.

## 4.2 Table payload v1

Use a schema equivalent to:

```ts
type TablePayloadV1 = {
  schemaVersion: 1;
  format: "csv" | "tsv";
  columns: string[];
  rows: string[][];
  truncation: {
    rows: boolean;
    columns: boolean;
    cells: boolean;
  };
};
```

If a source has no header, generate safe presentation column labels locally in the provider (`Column 1`, etc.) rather than inventing data authority.

Cells are inert text. Do not encode spreadsheet formula execution semantics.

## 4.3 Strict decoding

Frontend decoder requirements:

- exact `schemaVersion` support;
- reject unknown/invalid root shapes rather than guessing;
- validate arrays/strings/numbers before rendering;
- cap decoded counts/lengths again as defense in depth;
- invalid encoded payload => existing `unsupported_representation` / safe fallback state; never execute/evaluate payload content.

Do not add mode-specific decoders for Floating and Pinned; both hosts use the same renderer path.

---

# 5. Hard resource limits

Define named constants in backend code and freeze them with tests.

Recommended W3-05 v1 ceilings:

## Structured

- input prefix: <= 512 KiB;
- maximum logical depth: 64;
- maximum emitted nodes: 10,000;
- maximum object key / XML name: 1 KiB;
- maximum scalar/text value retained per node: 16 KiB;
- maximum XML attributes per element: 128;
- maximum encoded `structured_tree` payload: 1 MiB.

## Table

- input prefix: <= 512 KiB;
- maximum displayed rows: 500;
- maximum displayed columns: 64;
- maximum retained cell text: 16 KiB;
- maximum encoded `table` payload: 1 MiB.

Smaller limits are acceptable. Larger limits require explicit reviewer justification.

When a limit is reached:

- do not allocate unboundedly before applying it;
- set the corresponding payload truncation flag;
- set outer `PreviewCompleteness::Partial`;
- preserve enough structure/table context to remain useful;
- never present truncated output as complete.

The provider must not build an enormous full in-memory mirror and only truncate during final serialization. Bounds must constrain parser-to-representation construction itself.

---

# 6. JSON provider

Output: `structured_tree` payload v1 with `format: "json"`.

Requirements:

- valid JSON objects, arrays and scalars;
- empty/whitespace-only input fails provider-locally;
- malformed JSON fails provider-locally;
- depth/node/string limits are enforced before representation amplification;
- no duplicate-key policy may silently fabricate a different semantic structure; choose a deterministic parser policy and test/document it;
- numbers are presentation data only; no arbitrary precision execution or numeric coercion in React;
- truncated source prefix must not be labeled Complete.

If the chosen JSON parser inherently constructs an unbounded tree before W3-05 limits are enforced, use a bounded/streaming visitor or reject oversized input early enough that the configured source prefix itself remains the hard memory ceiling. Do not add an unbounded secondary copy.

---

# 7. YAML provider

Output: `structured_tree` payload v1 with `format: "yaml"`.

YAML is a hostile-input surface. Use a mature local parser; do not implement YAML parsing manually.

Requirements:

- no arbitrary custom object construction or executable tags;
- aliases/anchors must be bounded so alias expansion cannot amplify output without limit;
- depth, node, scalar and encoded-output limits apply after alias/reference handling;
- multi-document YAML is either explicitly bounded and represented or deterministically limited to a reviewed policy; do not silently merge documents;
- malformed YAML fails provider-locally;
- unknown/custom tags are data or unsupported, never code;
- no filesystem/network inclusion semantics;
- truncated prefix never claims Complete.

Any new YAML dependency must be local, pinned through Cargo.lock, cross-platform and pass RustSec/audit.

---

# 8. XML provider — fail closed on entities/resources

Output: `structured_tree` payload v1 with `format: "xml"`.

The XML provider must be safe against XXE/entity/resource attacks and expansion bombs.

Hard requirements:

- **no external entity resolution**;
- **no network fetch**;
- **no `file:` resolution**;
- **no filesystem-relative DTD/entity resolution**;
- no XInclude or stylesheet fetch;
- no unbounded internal entity expansion / “billion laughs” behavior;
- DTD/DOCTYPE may be rejected or treated as unsupported text, but must never cause resource resolution;
- comments/processing instructions may be dropped unless explicitly needed for presentation;
- element depth, node count, attribute count/name/value sizes and text sizes are bounded;
- namespace/prefix presentation is inert text only;
- malformed/truncated XML fails safely or publishes a truthful bounded Partial representation if the parser can do so without fabricating closure.

Prefer an event/streaming XML parser configured so entity/network resolution is impossible by construction. Do not use an XML stack that implicitly resolves external resources.

Add hostile fixtures for:

- external SYSTEM/PUBLIC entity;
- `file:///...` entity;
- HTTP(S) entity;
- relative DTD/entity path;
- internal recursive/entity-expansion bomb;
- extreme depth;
- extreme attributes/text;
- malformed/truncated input.

Tests must prove no network/filesystem resource is opened by parser behavior, not merely that the final renderer omits a URL.

---

# 9. CSV / TSV providers

Output: `table` payload v1.

Reuse a mature bounded CSV parser; the repository already has a Rust `csv` dependency, so do not add another parser without a concrete need.

Required behavior:

- CSV delimiter = comma;
- TSV delimiter = tab;
- quoted fields / escaped quotes / CRLF / LF handled safely;
- UTF-8 policy follows W3-04 unless a separately reviewed encoding authority exists;
- rows, columns, cell length and output size are bounded during parsing;
- ragged rows remain representable without allocating to an attacker-controlled width;
- malformed input fails provider-locally or emits truthful Partial only when safe;
- no spreadsheet formula evaluation;
- no macro execution;
- no hyperlink/navigation side effect from cell text;
- cells beginning with `=`, `+`, `-`, `@` remain inert strings;
- CSV/TSV Preview does not export/open a spreadsheet merely to render the table.

Header policy must be deterministic:

- if parser/provider chooses the first row as headers, freeze that behavior in tests;
- otherwise generate presentation-only `Column N` headers and keep all source rows as data.

Do not infer types aggressively in v1. Cell contents may remain strings.

---

# 10. Provider failure / terminal semantics

W3-04 terminal truth is binding.

Provider-local recoverable conditions may fall through:

- unsupported;
- parser/provider failed;
- timeout;
- corrupt/malformed source.

Terminal conditions do **not** fall through to another byte reader:

- source unavailable / availability unknown;
- materialization required / downloading;
- permission denied;
- identity changed;
- cancelled / stale publication.

`MetadataOnly` remains non-terminal provider fallback to Metadata, as closed in W3-04.

Do not map parser errors into source-terminal errors merely to simplify UI.

Do not let generic Text read a source after a terminal W3-05 read condition.

---

# 11. Cancellation, stale publication and cleanup

Every W3-05 provider must preserve current `PreviewSession` request/sourceVersion publication authority.

Deterministic race coverage must include:

- structured A pending -> source switch B -> late A cannot publish;
- table A pending -> source switch B -> late A cannot publish;
- close/dispose during provider work -> no late publication;
- Pinned A→B→C/D continues to converge on latest source through the existing W3-02 queue;
- provider-local parser failure returns Preview read leases/resources to baseline;
- post-lease terminal drift retains W3-04 exact terminal semantics;
- no provider-global mutable “current source” or retry queue.

No sleep-based correctness tests. Use barriers/channels/test-owned coordination.

If a parser API cannot be interrupted mid-call, keep the input hard-bounded, check cancellation immediately before/after parse and before publication, and ensure stale publication rights are revoked by the existing session authority. Do not create an unbounded parser thread pool.

---

# 12. Capability truth

Final capabilities remain:

`Host ∩ Provider ∩ Source`.

W3-05 may advertise only what the renderer actually implements.

Reasonable defaults:

- `can_select_text = true` only if rendered keys/values/cells are selectable;
- `can_search = false` unless W3-05 genuinely adds bounded in-preview structured/table search;
- no edit/sort/filter/export capability is invented through the Preview capability wire;
- no Open/Reveal behavior is inferred from cell/node values.

Sibling navigation remains a host/workspace capability, not provider-owned structured navigation.

---

# 13. Frontend StructuredTree renderer

Extend the existing shared `PreviewContent` representation renderer. Do not create separate Floating/Pinned renderers.

Requirements:

- decode only the strict backend-generated `StructuredTreePayloadV1`;
- read-only tree presentation;
- bounded DOM proportional to the already-bounded emitted node count;
- indentation/depth is visually legible without page-level horizontal overflow;
- long keys/scalars wrap safely;
- no editing, execution or raw HTML insertion;
- XML names/attributes/text render as text nodes, never as live DOM markup;
- source strings such as `<script>`, URLs or formula-like text remain escaped inert text;
- explicit visible Partial/truncation disclosure when outer completeness or payload flags indicate truncation.

Expandable/collapsible nodes are optional. If implemented:

- expansion state is renderer-local disposable UI only;
- it does not fetch/read more bytes;
- it must not create another source/navigation authority;
- keyboard accessibility must be tested.

A simple bounded static tree is acceptable for W3-05 v1.

---

# 14. Frontend Table renderer

Render `TablePayloadV1` through the same shared Preview content path.

Requirements:

- semantic read-only table where practical;
- bounded rows/columns only; no virtualization framework is required for the frozen limits unless measured necessary;
- cell text is escaped/inert;
- formula-looking values render literally;
- long cells wrap/clip within Preview without page-level overflow;
- column count/row count truncation is explicitly disclosed;
- no spreadsheet formula execution, sorting engine, editing, copy-to-execute action, hyperlink auto-navigation or embedded HTML rendering;
- selectable text only when effective capability permits.

Do not parse original CSV/TSV in React.

---

# 15. Strict codec tests

Add Rust and TypeScript tests that freeze `StructuredTreePayloadV1` and `TablePayloadV1`.

At minimum prove:

- exact schemaVersion and format tags;
- correct round-trip for representative payloads;
- unknown schemaVersion rejected;
- missing/incorrect field types rejected;
- frontend refuses hostile oversized counts/strings even if a fake fixture bypasses backend bounds;
- encoded payload remains under configured maximum;
- no filesystem path fields are part of either schema.

Do not loosen the outer strict Preview wire to `any` or arbitrary objects.

---

# 16. Deterministic backend fixtures

## Registry/probe

- each W3-05 provider appears exactly once;
- intended priority order is deterministic;
- Markdown remains ahead of generic Text and structured/table providers beat generic Text for their own hints;
- Zen Floating/Pinned supported;
- W4 hosts fail closed.

## JSON

- nested object/array/scalars;
- root scalar;
- malformed JSON;
- extreme depth;
- > node limit;
- giant scalar;
- bounded source prefix/truncation;
- duplicate-key policy.

## YAML

- maps/sequences/scalars;
- anchors/aliases within safe limits;
- alias amplification hostile fixture;
- custom tags inert/unsupported;
- multi-document policy;
- malformed/deep/large scalar fixtures.

## XML

- normal nested elements/attributes/text;
- malformed XML;
- deep nesting;
- attribute/text limits;
- external HTTP entity;
- external `file:` entity;
- relative external entity/DTD;
- internal entity expansion bomb;
- prove zero external resource resolution.

## CSV/TSV

- header/no-header policy;
- quoted delimiters;
- escaped quotes;
- CRLF/LF;
- ragged rows;
- too many rows;
- too many columns;
- huge cell;
- malformed quoted input;
- formula-like cells (`=`, `+`, `-`, `@`) remain literal strings.

## Lifecycle/read authority

- real provider read through W3-04 Preview adapter;
- active lease count returns to baseline;
- post-lease terminal drift remains truthful;
- stale/source-switch/cancel blocks publication;
- provider fallback cannot bypass terminal conditions.

---

# 17. Real-browser W3-05 gate

Add:

`npm run test:browser:w3-05:real`

Run at:

- `1600×900`;
- `980×680`.

Cover at minimum:

- Library JSON -> Floating and Pinned;
- Browse JSON -> Floating/Pinned;
- YAML structured tree;
- XML structured tree with hostile markup/entity-looking text rendered inert;
- CSV table;
- TSV table;
- formula-looking cells rendered literally;
- large/deep/truncated structured payload with visible Partial disclosure;
- row/column/cell-truncated table with visible disclosure;
- Metadata fallback for malformed/unsupported fixture;
- rapid rich source switching with no stale representation flash;
- existing Pin/Unpin, sibling navigation, no-source and compact Context ownership remain intact;
- one Preview host only;
- no horizontal page overflow;
- no console/page errors.

Browser mocks test renderer/host integration only. Real parser/security guarantees remain Rust-test-owned.

Add a browser request/navigation guard and ensure hostile XML/cell strings cannot trigger external HTTP(S), `file:`, data/blob, relative-resource or equivalent loads/navigation.

---

# 18. Performance / resource evidence

Preserve all W0/W2/W3 existing thresholds.

Add focused bounded evidence where practical for:

- near-limit JSON/YAML/XML input;
- depth/node cap behavior;
- hostile YAML alias/XML entity fixtures;
- near-limit CSV/TSV rows/columns/cells;
- repeated structured/table Preview cycles with lease/resource count returning to baseline.

Do not use internet access or machine-specific paths in benchmarks.

W3-05 must not make the Preview shell wait for parser completion; shell-first behavior remains host-owned.

---

# 19. Dependency / parser policy

Prefer existing dependencies where they satisfy the safety contract.

- JSON: existing Serde/`serde_json` is preferred where suitable.
- CSV/TSV: existing Rust `csv` dependency is preferred.
- YAML/XML: adding a mature local parser dependency is allowed if necessary.

Any new dependency must:

- be narrowly scoped;
- be pinned through Cargo.lock;
- work on Windows and macOS Apple Silicon;
- perform no runtime network download;
- pass RustSec/audit;
- not pull an execution/template/object-construction subsystem merely for parsing.

Do not add frontend JSON/YAML/XML/CSV parser packages to bypass the backend provider boundary.

---

# 20. Expected implementation areas

Likely production scope:

- `src-tauri/src/file_workspace/preview_providers.rs` or a bounded provider submodule split if file size warrants it;
- `src-tauri/src/file_workspace/preview_policy.rs` registry composition;
- shared backend codec structs/helpers for `encoded_tree` / `encoded_table`;
- existing read-gate integration only if needed for tests, without moving authority;
- `src/types/fileWorkspace.ts` only if local typed payload helper types belong there; do not change outer representation families unnecessarily;
- one shared frontend payload decoder;
- `src/views/fileLibrary/preview/PreviewContent.tsx` and shared Preview styles/components;
- provider/codec/security/lifecycle tests;
- `package.json` + W3-05 browser gate;
- `Cargo.toml` / `Cargo.lock` only for reviewed parser dependencies.

Do not modify current-truth `STATUS.md`, `ROADMAP.md`, W3 initiative closeout records or frozen W3 specs inside the implementation PR.

---

# 21. Stop / architecture-review conditions

STOP and report instead of implementing if W3-05 appears to require:

- renderer-visible raw filesystem path;
- new generic Tauri byte-read/materialization command;
- renderer-issued reusable lease;
- second `MaterializationReadGate` / lease registry / content-read authority;
- durable structured/table Preview database or schema migration;
- parser service/process with independent filesystem/network access;
- automatic cloud/provider hydration;
- XML network/entity resolver;
- YAML arbitrary object/tag execution;
- formula/macro execution;
- unbounded parser/worker pool;
- W3-06 Image provider;
- W3-07 Folder provider;
- W3-08 Archive provider;
- W4 Finder/Explorer system-host work;
- supported-platform or mutation/recovery ownership change.

If the existing `encodedTree` / `encodedTable` outer wire itself proves fundamentally insufficient, STOP and return for contract review instead of silently replacing it with an unrelated DTO.

---

# 22. Validation

Run focused provider/codec/security tests first.

Then at minimum:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend
npm run test:browser:w3-05:real
npm run test:governance

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings

npm run security:audit
npm run security:audit:rust

git diff --check
git diff --check origin/master...HEAD
```

If CI routing marks additional release/platform/performance lanes applicable, they must pass on the final exact head.

Clean all task-owned temporary artifacts and leave the worktree clean.

---

# 23. PR / evidence contract

Implement directly on the existing branch:

`feat/w3-05-structured-table-providers`

Do not create another implementation branch.

When implementation and local validation are complete:

1. commit normally;
2. no force push;
3. push the existing branch;
4. create exactly one **Draft PR** against `master`;
5. keep it `OPEN / DRAFT / UNMERGED`;
6. obtain a fresh exact-head hosted CI run;
7. report final HEAD/tree and source/integration checkout evidence;
8. report exact changed files;
9. report provider IDs/priorities;
10. report exact byte/depth/node/row/column/cell/output limits;
11. report the frozen StructuredTree/Table payload schemas and strict frontend decoding evidence;
12. report JSON/YAML/XML hostile parser evidence, especially YAML alias and XML entity/resource behavior;
13. report CSV/TSV formula-inert and row/column/cell bound evidence;
14. report lease/terminal/stale/latest-wins cleanup evidence;
15. report Floating/Pinned/browser evidence;
16. report dependency/audit changes;
17. classify any genuine deferred/unverified evidence honestly.

Do not Ready.
Do not merge.
Do not start W3-06+.
Do not perform current-truth closeout inside the implementation PR.

Return implementation evidence only after the Draft PR exists.