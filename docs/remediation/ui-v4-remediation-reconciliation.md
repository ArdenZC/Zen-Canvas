# UI v4 remediation reconciliation

Baseline: `origin/master` at `1caf775c26006cb95f9a338a853adada79b2199f`.

Reference branch: `origin/codex/cleanup-job-scoped-candidates` at `f484f19e8e0e6a88a150b0a185a0192fddcc500b` (PR #7).

Common ancestor: `904e90515bc0e04eda67d9e6aefaf748822352b8`.

This document is a living reconciliation record. The initial status is based on source inspection of the UI v4 baseline; validation and new commit columns are updated as each remediation is re-integrated.

| Remediation | PR #7 commit(s) | UI v4 baseline evidence | Reapply? | Current implementation target | Regression target | Validation | New commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dependency / quick-xml advisories | `f484f19`, `01f4791` | `package.json` still ignores RUSTSEC-2026-0194/0195 | Yes | `package.json`, Cargo lockfile | audit script guard | Pending | Pending |
| CredentialStore and key lifecycle | `cf47fb6`, `a9e9ddc` | production debug path still uses `OnceLock<Mutex<String>>`; no store abstraction | Yes, adapt to UI v4 settings | Rust AI settings/debug plus Settings UI model | Rust credential transaction tests and React behavior | Pending | Pending |
| Runtime AI capabilities | none (new UI v4 integration) | no `aiDebugAvailable` capability; UI can expose commands unavailable in release | Yes | Tauri capability command, API/model, Settings UI | production/debug capability rendering tests | Pending | Pending |
| Cleanup candidates scoped by job | `2816e15`, `ad83779` | `StorageCleanupState.latest_candidates` and unscoped candidate resolution remain | Yes | analyzer commands, API, cleanup store and UI v4 view | cross-job/atomic/stale-view tests | Pending | Pending |
| Cleanup root canonicalization | `fc7735e`, `5db8761`, `a9e9ddc` | pre-canonical root checks remain | Yes | shared path safety and storage analyzer | aliases, parent traversal, symlink/junction tests | Pending | Pending |
| macOS protected paths and temp policy | `b8473e0`, `f25f75c`, `4a980ed` | strict platform/temp policy is absent from current implementation | Yes | shared path safety, file ops, analyzer | macOS aliases and temp-root tests | Pending | Pending |
| Settings revision / CAS | `05e74e2`, `a9e9ddc` | no revision or `expected_revision`; whole-object saves remain | Yes, preserve UI v4 settings components | schema/settings command, API, save queue | stale write, conflict refresh, rapid save tests | Pending | Pending |
| Operation Journal identity | `f8596d1`, `a9e9ddc` | no persisted source fingerprint or recovery identity verification | Yes | filesystem identity, operation queries/recovery | replacement/manual-review tests | Pending | Pending |
| Safe Trash identity and recovery | `a9e9ddc` | cleanup trash records have no trustworthy identity fields | Yes, preserve History Inspector | schema/analyzer/restore UI contract | preview-to-execute replacement and legacy tests | Pending | Pending |
| Dedupe job isolation | `b5c8ea3`, `ad83779` | `DEDUPE_RUNNING` and `DEDUPE_CANCEL_REQUESTED` are global | Yes | job manager, scanner, API/store event filtering | concurrent cancellation/stale event tests | Pending | Pending |
| Collision-resistant IDs | `38ec5cf` | authoritative IDs are not uniformly UUID-based | Yes | shared Rust ID module and backend ID creation | UUID/static guard tests | Pending | Pending |
| Typed rule domain enums | `b93084f` | core rule fields still admit scattered strings | Yes, adapt to UI v4 automation models | Rust domain/repositories plus TS contract | invalid/legacy/round-trip tests | Pending | Pending |
| AI provider validation | `b76534a`, `ad83779`, `a9e9ddc` | validation is incomplete and reserved request fields can cross boundaries | Yes | Rust settings/openai-compatible layer | URL/bounds/extra-body/preset tests | Pending | Pending |
| Schema revision and identity migrations | `05e74e2`, `f8596d1`, `a9e9ddc` | `CURRENT_SCHEMA_VERSION` is 16 | Yes | schema versions 17-19 or later | 16-to-latest, rollback, legacy data tests | Pending | Pending |
| UI v4 remediation contracts and CI | `ad83779` plus new UI v4 guards | present CI is broad but allows the known regressions | Yes | tests and Windows/macOS workflows | static contract plus full quality gates | Pending | Pending |

## Integration rule

PR #7 is reference evidence only. Changes are replayed as narrow semantic patches and adapted to the current UI v4 contracts. UI v4 pages, component structure, accessibility behavior, preview confirmation, Safe Trash, and restore interactions must not be replaced by pre-v4 files.
