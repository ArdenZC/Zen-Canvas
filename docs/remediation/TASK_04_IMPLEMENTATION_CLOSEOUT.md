# Task 04 Implementation Closeout

## 1. Delivery state

- Baseline `master` HEAD: `d32f4a77928365d8cf6280bb952263fc032038b8`.
- Task 03 merge prerequisite: `70427ff648dd5b9fab66e247fbf0a5ddf8912f45`.
- Implementation branch: `remediation/04-global-shortcut-search`.
- Exact physical-union commit: `ccae24c85f82f640eb99cabecc7a4aea43529b39`.
- Global shortcut search implementation commit: `d898fd7`.
- Final delivery HEAD, Draft PR URL, and GitHub CI run are recorded in section 13 after publication.
- Database remains schema 30. No dependency or lockfile was changed.
- Task 05 was not started.

Task 04 production implementation is complete and remains pending Draft PR CI and human code-level acceptance.

## 2. Tolaria reference and license boundary

- Reference repository: `refactoringhq/tolaria`.
- Reviewed `main` commit: `43e3b32322b1f1eb1d0c1fc156c2db340af79d90`.
- License: AGPL-3.0.
- Borrowed only independent product principles: keyboard-first interaction, stable command identity, one metadata source, context-specific availability/execution, and predictable bounded navigation.
- No Tolaria source, command IDs, manifest, component structure, CSS, directory layout, or implementation skeleton was copied or translated.

## 3. Task 03 exact physical-union debt

Run aggregates now resolve active authoritative duplicate-group members to physical subjects, exclude the keeper, collapse hardlink aliases, and union those subjects with eligible Safe exact findings. Unrelated physical subjects add normally; potential estimates remain separate; stale/inactive inputs fail closed. Terminal publication, repeated refresh, AI aggregate refresh, and reopen hydration use the same deterministic aggregate path.

Targeted tests cover duplicate/Safe overlap, unrelated Safe findings, keeper exclusion, hardlink aliases, potential-only overlap, insertion-order independence, repeated and AI refresh, stale groups, and database reopen. R-055/R-061 are closed.

## 4. Versioned search contract and deterministic ranking

The public V2 request carries `sessionId`, `requestId`, normalized query, and bounded limit. The response echoes request identity and includes result state, completeness, source revision, source health, and results. The renderer uses a session/request controller so identical repeated queries remain distinct, only the latest response is accepted, and hide/reopen invalidates prior work.

Ranking is deterministic: exact name, name prefix, extension, FTS/fallback rank, modified time, then stable entry ID. Exact/prefix/extension use existing partial indexes; punctuation-heavy fallback remains bounded. Disabled sources and stale entries are excluded, and a source disabled during collection causes the response to fail closed.

## 5. Health and result activation

Search responses project current collection state and source health rather than relying on a mount-only status snapshot. The UI distinguishes pending, complete, partial, empty, and failed states, exposes degraded/indexing/provider conditions, and links to the existing Global Index settings surface without enabling or rebuilding sources automatically.

Open and reveal still accept only entry IDs. Rust revalidates entry existence, stale state, source enabled/trusted state, provider, path containment, live existence, symlink/object-kind changes, and available native identity before activation. Renderer-submitted arbitrary paths remain impossible.

## 6. Rust-owned window and hotkey lifecycle

Rust owns the one fixed-label search window and the lifecycle:

```text
hidden -> showing -> visible_collapsed/visible_expanded -> hiding -> hidden
```

Every renderer mutation carries session/revision CAS. Old blur, resize, hide, and reopened-session requests are rejected. Hiding is retryable after a native hide failure. Main-window navigation uses readiness plus a nonce acknowledgement; late navigation is rejected if the main view/selection changed.

Global hotkey status now records requested/effective accelerator, registration state, error, and revision. Same-value healthy registration is idempotent. New registration failure restores the previous shortcut; restore failure reports no active shortcut. Settings persist only a successfully effective requested value.

## 7. Command surface, keyboard, and accessibility

Zen Canvas now has one stable command catalog for IDs, i18n keys, keywords, groups, shortcut hints, and main/standalone/browser availability. Metadata is separate from fixed execution adapters. The catalog contains no arbitrary Rust command, path, SQL, shell, script, file mutation, or model-generated execution route.

Spotlight keeps commands, folders, and files in deterministic sections. False “recent” results derived from the current library page were removed. Keyboard coverage includes arrows, Home/End, PageUp/PageDown, Tab/Shift+Tab, Enter, Escape, mouse parity, active-index clamp, and active-item scrolling. IME composition suppresses execution. Listbox/option/combobox semantics, focus restoration, high contrast, and reduced motion are preserved for main, standalone, and browser QA modes.

## 8. API, permissions, and browser mock

Tauri command registration, TypeScript DTOs, native invocation adapters, event listeners, and browser mock use the same public contract. The search-window capability is a minimal explicit allowlist for search/read/navigation lifecycle commands. Source management, settings mutation, rebuild, direct file enumeration, and generic window mutation remain unavailable to the search window and main-window authorization is unchanged.

`docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md` records the final command ownership and capability boundary.

## 9. Test and performance evidence

Local completion evidence:

| Validation | Result |
|---|---|
| Focused frontend contract tests | pass; four updated legacy suites 35/35, query/session burst and lifecycle coverage included |
| `npm run verify:frontend` | pass; TypeScript, 72 frontend files / 503 tests, remediation 13/13, performance, Vite build, and Windows NSIS package |
| `npm run verify:rust` | pass; fmt, 493 Rust unit tests with 7 performance tests ignored in normal mode, all integration/doc tests, and Clippy `-D warnings` |
| `npm run verify:security` | pass; npm audit 0 vulnerabilities; cargo audit 0 vulnerabilities and 15 existing allowed warnings |
| `npm run test:remediation` | pass; 13/13 |
| `npm run test:performance` | pass; full historical matrix plus Task 04 100k benchmark |
| `npm run build` | pass through `verify:frontend`; NSIS produced `Zen Canvas_0.1.40_x64-setup.exe` |
| `git diff --check` | pass |

Task 04 focused performance:

- 100,000 entries, 15 short/exact/prefix/extension/punctuation samples: p95 `63.104 ms`, threshold `100 ms`.
- 1,000,000 entries, 15 indexed prefix samples: p95 `0.329 ms`, threshold `100 ms`.
- The 1M query plan uses `idx_global_entries_active_name`; no per-result status query, renderer full-library sort, or search-time write transaction was added.
- Rapid-query coverage includes 30 requests and latest-response acceptance.

Warm show-to-focus and platform window memory deltas require the real Windows/macOS GitHub runners or human runtime review; no synthetic result is claimed.

## 10. Compatibility and non-goals

- Global Index remains the only global search authority.
- File Library `files`, Managed AI scope, `files.id`, operation/cleanup journal, Safe Trash, and restore boundaries were not changed.
- Native Windows MFT/USN service and macOS Spotlight/FSEvents provider were not modified.
- No schema 31, database table, dependency, lockfile, version, installer configuration, tag, or release was added.
- No File Library Query V2, cross-page selection, tag, Saved View, Inspector, Organization Plan, or Task 05 work was started.

## 11. Known risks and human review

- Windows/macOS shortcut registration, focus ordering, transparent-window behavior, open/reveal integration, and packaging remain subject to platform CI and human runtime acceptance.
- Rust release builds without `desktop-runtime` report existing cfg-dependent dead-code warnings; the authoritative desktop Clippy gate passes with warnings denied.
- Existing RustSec allowed warnings remain dependency-owner debt; Task 04 introduced no dependency change.

## 12. Acceptance state

```text
Task 04 implementation is complete on one implementation branch and one Draft PR.
Task 03 exact physical-union debt is closed.
Schema remains 30 and no dependency or lockfile changed.
Task 05 was not started.
Waiting for Windows, macOS, Dependency audit, and human code-level acceptance.
```

## 13. Delivery record

- Final delivery HEAD: pending publication.
- Draft PR: pending publication.
- GitHub CI: pending publication.
- Merge: prohibited; human acceptance required.
