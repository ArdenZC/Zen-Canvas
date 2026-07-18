# Zen Canvas Final Hardening v4.1 closeout

Branch: `codex/final-hardening-v4`
Base: `master`
Status: Draft PR; no merge, tag, release, or auto-merge

## Platform boundary

Windows and macOS are the only supported desktop platforms. Linux/Ubuntu is
outside product, build, release, and quality-gate scope. The repository has no
Linux CI runner, Linux keyring dependency, Linux installer, or Linux reveal
command. If a shared Unix build reaches a mutation boundary, it fails closed
with the stable `unsupported_platform_linux` code; it is not a Linux support
claim.

## Safety closure

| Area | v4.1 closure | Evidence |
| --- | --- | --- |
| Source Claim | UUID claim path is planned and journaled before mutation; expected identity stays bound to the open handle; claim/rollback/recovery states are explicit | `fs_safety::source_claim` tests and file-operation replacement tests |
| Journal | Schema 22 adds claim path, phase, claim timestamp, claim platform ID, and claim full hash for operations and Safe Trash | migration tests for 16→22, 20→22, and 21→22 |
| Directory binding | VerifiedDirectory holds platform identity and an open handle/fd through commit; identity is rechecked before destructive steps | `VerifiedDirectory`, path-chain, target-parent replacement tests |
| No-overwrite move | Windows handle-bound rename/disposition and macOS `renameatx_np(..., RENAME_EXCL)` fail closed when unavailable; no path-only final delete | atomic move, target race, cross-volume, and source-claim tests |
| Cross-volume | Directories are rejected before copy; Windows files use staged copy-commit with full BLAKE3 verification; macOS files return `cross_volume_file_move_unsupported_on_macos` | copy-commit and storage cleanup suites |
| Recovery | Restart reconciliation distinguishes source/target/claim identity combinations and marks ambiguity `manual_review` | operation and Safe Trash reconciliation tests |
| Cancellation | Background indexer and cleanup cancel flows retain job ownership until authoritative terminal state | frontend runtime/store suites and Rust cancellation tests |
| Stable errors | Claim, directory identity, cross-volume, Linux unsupported, and cleanup codes map through i18n | `stableErrors.test.ts`, remediation contract tests |

## Schema and migration evidence

Current schema is `22`. Existing quick hashes remain compatibility/sample data;
high-risk restore/recovery requires a complete BLAKE3 identity. Legacy rows that
cannot satisfy that requirement are marked `legacy_unverified` or
`manual_review`, never silently upgraded.

The migration suite verifies schema 16→22, 20→22, and 21→22, transactional
rollback, invalid historical rule normalization, required journal columns,
phase guards, and idempotent reopen.

## Local verification recorded during v4.1 hardening

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --tests --jobs 1`: 315
  library tests passed; integration suites passed with 26 AI-provider, 1
  classification, 5 dedupe, 1 FTS diagnostic, 4 migration, 12 settings, and
  55 storage-analyzer tests; the 100k FTS benchmark remained intentionally
  ignored.
- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
  --jobs 1`: 316 library tests and all integration/doc tests passed; the FTS
  benchmark remained intentionally ignored.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D
  warnings` and the equivalent `desktop-runtime` command: both passed.
- `cargo build --release --manifest-path src-tauri/Cargo.toml
  --features desktop-runtime --jobs 1`: passed.
- `npm run typecheck`: passed. `npm test`: 67 files / 469 tests passed.
- `npm run test:remediation`: 13 tests passed.
- `npm run test:performance`: architecture guard and 9 bounded-library tests
  passed; the 100k-row SQLite/FTS benchmark passed with search p95 `1.492 ms`
  and total p95 `3.347 ms`.
- `npm run security:audit`: 0 vulnerabilities. `npm run security:audit:rust`:
  exit 0 with 15 existing allowed GTK/glib/unmaintained warnings and no new
  ignore entries.
- `npm run build`: passed and produced the Windows x64 NSIS installer at
  `src-tauri/target/release/bundle/nsis/Zen Canvas_0.1.40_x64-setup.exe`.
  SHA-256: `B5377D97AB894DF09716B5980E8253EF30185A0213B8D0C38EA0991F6F9DFC28`.
  The installer is not digitally signed under the current repository release
  configuration.
- Isolated Windows QA build used identifier
  `com.startlan.zencanvas.finalhardening.qa` and did not touch the real app
  identifier or AppData. The build succeeded, but read-only UI inspection was
  blocked by the host Computer Use runtime (`GetCursorPos: access denied`);
  no move, delete, restore, or real-AppData UI action was attempted.

The final closeout still needs the final commit SHA, the Windows/macOS/Dependency
Audit CI run and job conclusions, and the final PR evidence comment after the
last commit is pushed. No release artifact is published by this task.
