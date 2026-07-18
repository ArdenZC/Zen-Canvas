# UI v4 remediation reconciliation

Baseline: `origin/master` at `1caf775c26006cb95f9a338a853adada79b2199f`.

Reference branch: `origin/codex/cleanup-job-scoped-candidates` at `f484f19e8e0e6a88a150b0a185a0192fddcc500b` (PR #7).

Common ancestor: `904e90515bc0e04eda67d9e6aefaf748822352b8`.

This document is a living reconciliation record. The baseline evidence was captured before re-integration; the validation and new commit columns below record the completed source and automated-test reconciliation. Desktop smoke, installer-upgrade, and CI evidence is recorded separately after those gates run.

| Remediation | PR #7 commit(s) | UI v4 baseline evidence | Reapply? | Current implementation target | Regression target | Validation | New commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dependency / quick-xml advisories | `f484f19`, `01f4791` | `package.json` still ignores RUSTSEC-2026-0194/0195 | Yes | `package.json`, Cargo lockfile | audit script guard | `npm run security:audit` and `cargo audit`: no vulnerability advisories; no RustSec ignores | `2bb3469` |
| CredentialStore and key lifecycle | `cf47fb6`, `a9e9ddc` | production debug path still uses `OnceLock<Mutex<String>>`; no store abstraction | Yes, adapt to UI v4 settings | Rust AI settings/debug plus Settings UI model | Rust credential transaction tests and React behavior | Transaction, readback, clear, and no-plaintext contract tests pass | `aafe00e` |
| Runtime AI capabilities | none (new UI v4 integration) | no `aiDebugAvailable` capability; UI can expose commands unavailable in release | Yes | Tauri capability command, API/model, Settings UI | production/debug capability rendering tests | Production capability and UI rendering contracts pass | `fb4b31f` |
| Cleanup candidates scoped by job | `2816e15`, `ad83779` | `StorageCleanupState.latest_candidates` and unscoped candidate resolution remain | Yes | analyzer commands, API, cleanup store and UI v4 view | cross-job/atomic/stale-view tests | Cross-job, stale-view, and atomic job-scope tests pass | `142c856` |
| Cleanup root canonicalization | `fc7735e`, `5db8761`, `a9e9ddc` | pre-canonical root checks remain | Yes | shared path safety and storage analyzer | aliases, parent traversal, symlink/junction tests | Alias, traversal, symlink, and junction safety tests pass | `c135cb8` |
| macOS protected paths and temp policy | `b8473e0`, `f25f75c`, `4a980ed` | strict platform/temp policy is absent from current implementation | Yes | shared path safety, file ops, analyzer | macOS aliases and temp-root tests | macOS protected-path and narrow temp-policy tests pass | `85e1ab9` |
| Settings revision / CAS | `05e74e2`, `a9e9ddc` | no revision or `expected_revision`; whole-object saves remain | Yes, preserve UI v4 settings components | schema/settings command, API, save queue | stale write, conflict refresh, rapid save tests | Stale-write, conflict-refresh, rapid-save, and side-effect reconciliation tests pass | `35ea0ca` |
| Operation Journal identity | `f8596d1`, `a9e9ddc` | no persisted source fingerprint or recovery identity verification | Yes | filesystem identity, operation queries/recovery | replacement/manual-review tests | Replacement, identity mismatch, recovery, and manual-review tests pass | `e74d37f` |
| Safe Trash identity and recovery | `a9e9ddc` | cleanup trash records have no trustworthy identity fields | Yes, preserve History Inspector | schema/analyzer/restore UI contract | preview-to-execute replacement and legacy tests | Preview-to-execute replacement, legacy identity, and restore tests pass | `582c33d` |
| Dedupe job isolation | `b5c8ea3`, `ad83779` | `DEDUPE_RUNNING` and `DEDUPE_CANCEL_REQUESTED` are global | Yes | job manager, scanner, API/store event filtering | concurrent cancellation/stale event tests | Concurrent job cancellation and stale-event isolation tests pass | `85ee637` |
| Collision-resistant IDs | `38ec5cf` | authoritative IDs are not uniformly UUID-based | Yes | shared Rust ID module and backend ID creation | UUID/static guard tests | UUID v7 generation and static authoritative-ID guards pass | `e15c702` |
| Typed rule domain enums | `b93084f` | core rule fields still admit scattered strings | Yes, adapt to UI v4 automation models | Rust domain/repositories plus TS contract | invalid/legacy/round-trip tests | Invalid, legacy, unknown-UI, and round-trip tests pass | `b592570` |
| AI provider validation | `b76534a`, `ad83779`, `a9e9ddc` | validation is incomplete and reserved request fields can cross boundaries | Yes | Rust settings/openai-compatible layer | URL/bounds/extra-body/preset tests | URL, bounds, reserved-field, extra-body, and preset tests pass | `11f6063` |
| Schema revision and identity migrations | `05e74e2`, `f8596d1`, `a9e9ddc` | `CURRENT_SCHEMA_VERSION` is 16 | Yes | schema versions 17-19 or later | 16-to-latest, rollback, legacy data tests | 16-to-20, legacy integrity, idempotence, and rollback tests pass | `1a69956` |
| UI v4 remediation contracts and CI | `ad83779` plus new UI v4 guards | present CI is broad but allows the known regressions | Yes | tests and Windows/macOS workflows | static contract plus full quality gates | 11 remediation contracts plus full frontend/Rust/audit/build gates pass locally | `5d03f46` |

## Integration rule

PR #7 is reference evidence only. Changes are replayed as narrow semantic patches and adapted to the current UI v4 contracts. UI v4 pages, component structure, accessibility behavior, preview confirmation, Safe Trash, and restore interactions must not be replaced by pre-v4 files.

## Local validation evidence

- `npm run verify` passes: typecheck, 63 frontend test files / 446 tests, the 100k-file FTS benchmark, production build, NSIS packaging, npm audit, and cargo audit.
- `cargo fmt -- --check` passes.
- Desktop-runtime and default Rust test suites pass, including 297 library tests plus integration suites; the desktop-runtime suite adds the production-only capability coverage.
- All-target clippy passes with warnings denied.
- Cargo audit reports no vulnerability advisories. The remaining 15 allowed warnings are transitive maintenance or unmaintained warnings; the former `quick-xml` vulnerability ignores are absent.
- The release-candidate installer is `src-tauri/target/release/bundle/nsis/Zen Canvas_0.1.40_x64-setup.exe` (5,602,406 bytes), SHA-256 `B280537E549437D89639E487899D6B2C986F1285CE0EA78A385F917F72C523A1`.
- GitHub Actions run `29633487804` passed Windows Quality, macOS Quality, and Dependency Audit on replacement PR #9. The macOS gate covers the current-user temp exception without relaxing other `/private` paths; Unix symlink fixtures now use platform-correct cleanup.

## Windows desktop smoke evidence

- Production About reports `v0.1.40`; developer-only AI debug controls are absent while the normal credential and connection controls remain available.
- A real DeepSeek connection test succeeded with `deepseek-v4-flash`. Real classification parsed and persisted four disposable fixture results without moving any source file or bypassing Preview.
- The full secret value was byte-scanned across 463 relevant repository and application files in UTF-8 and UTF-16 forms with zero matches.
- Credential clear is fail-closed: clearing while cloud AI remained enabled was rejected and rolled back. After switching AI off, explicit clear succeeded and Windows Credential Manager returned not found. Replacement/readback evidence remains pending until the operator personally enters the secret again; the secret is never copied into this repository or test log.
- Storage Cleanup scanned an isolated 45-byte, 45-day-old disposable candidate, required final confirmation, moved it to Zen Canvas Safe Trash, and restored it with zero conflicts, missing files, failures, cancellations, or exclusions.
- A broad `%TEMP%` cleanup scan was cancelled through the production UI and reported cancellation.
- The Windows System Trash success path was exercised with a process-unique disposable fixture by `cargo test --features desktop-runtime execute_moves_core_supports_move_to_trash_success_path -- --nocapture`; the test verified a successful `move_to_trash` log, source disappearance, and no false in-app restore claim.

## Installer and migration evidence

- The official `0.1.39` installer used for the baseline has SHA-256 `BB32DB9209B887680551D3F6229230C5C86D4380C66FBC0B7B5DA81F83301A80`.
- In the installed `0.1.39` UI, a disposable directory was scanned (2 files / 117 bytes), the Deep Sea theme was selected, and an enabled user automation rule was created.
- The `0.1.40` installer detected the older installation. Its first uninstall-before-install attempt exposed an old-uninstaller busy loop; after the child was terminated, the installer reported the failure and the test explicitly selected the supported `Do not uninstall` in-place path targeting the same install directory. Installation then completed successfully. This anomaly is retained as evidence and is not described as a clean uninstall-first upgrade.
- First `0.1.40` startup preserved the 2-file scan, Deep Sea theme, enabled user rule, current scope, and pending review state. About reported `v0.1.40`, and the copied Schema 16 database migrated to Schema 20.
- A subsequent silent `0.1.40` uninstall removed the registered application and executable while leaving AppData intact. Reinstall completed successfully, and first startup again retained the scan, theme, and pending state.
- API-key retention across the cross-version and reinstall boundary is pending operator-only secret re-entry. Operation-history retention from `0.1.39` could not be demonstrated because the prepared old-version baseline contained no executable operation; automated migration tests cover legacy identity-less records and manual-review mapping, but that distinction remains explicit in the final report.

## Remaining external gates

- Operator-only API-key replacement/readback/restart verification.
- Restore the user's original ordinary and Codex-virtualized AppData snapshots after smoke completion.
- Keep replacement PR #9 as a Draft, verify the final documentation-only head in CI, and close PR #7 as superseded. Do not tag, publish a Release, or merge.
