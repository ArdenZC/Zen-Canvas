# CLAUDE.md

Claude Code follows the repository-wide rules in `AGENTS.md`.

Do not use this file as a second source for the current project stage or baseline. Read current truth from:

1. `docs/project/README.md`;
2. `docs/project/STATUS.md`;
3. the active initiative under `docs/project/initiatives/`;
4. `docs/project/ARCHITECTURE_MAP.md` and the relevant domain contracts.

## Project summary

Zen Canvas is a local-first desktop file lifecycle assistant built with Tauri 2/Rust and React 19/TypeScript/Tailwind/Zustand. SQLite WAL + FTS5 backs durable managed state and search/index contracts.

Technical-stack facts come from `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and actual source code.

## Common commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run test:performance:architecture
npm run build:check
npm run verify:rust
npm run verify:security
```

Use the current scripts in `package.json`; do not rely on command lists copied from historical taskbooks.

Focused frontend test example:

```bash
npx vitest run tests/scanManager.test.ts
npx vitest run tests/scanManager.test.ts -t "keyword"
```

Focused Rust commands from the repository root:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

## Repository shape

- `src/views/` — product workspaces and view models.
- `src/components/` — cross-workspace UI components.
- `src/store/` — Zustand interaction/projection stores, not a replacement for durable backend authority.
- `src/api/` — domain API facades and Tauri event/invoke boundary.
- `src/types/domain.ts` — frontend domain DTO types.
- `src-tauri/src/` — Rust domain engines, database, platform/file safety and Tauri commands.
- `docs/project/` — current project truth/governance.
- `docs/security/` — platform, command-permission and mutation security contracts.
- `docs/remediation/` — historical architecture taskbooks, accepted safety contracts and detailed legacy retirement evidence.
- `docs/design/` — design specifications and historical execution evidence.

## Important implementation notes

### Durable state

Persisted product truth is backend/SQLite-owned. Frontend stores may cache/project it but must not invent a second durable authority. Use `docs/project/ARCHITECTURE_MAP.md` for the current domain table.

### Tauri command changes

Command changes require synchronized inspection of handler registration, `src-tauri/build.rs`, capabilities, security permission matrix, frontend facade/browser mock and contract tests. Search Window permission separation must remain fail-closed.

### Schema changes

Schema changes are not ordinary refactors. They require an authorized initiative, migration/future-schema coverage and applicable performance/safety gates.

### Browser mock

The browser mock is for deterministic UI development. It must not claim native filesystem, persistence, provider or security behavior.

### User-file mutation

Current supported builds may execute approved filesystem operations, including recoverable and explicitly reviewed destructive paths. Never reintroduce an obsolete “MVP never deletes” assumption. All mutation remains behind the authoritative preview, identity/revalidation, journal/Safe Trash and History/Restore chain defined by `AGENTS.md` and the security contracts.

## Verification

Run focused checks first, then the applicable project gates. For a broad production change, `npm run verify` remains the umbrella local verification entry when appropriate, while CI supplies supported-platform/package/performance evidence according to the current workflow.

Never claim a check passed unless it actually ran on the stated commit/environment.

## Current work

Do not maintain a “current work” section here. `docs/project/STATUS.md` and the active initiative record own that information.
