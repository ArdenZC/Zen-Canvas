# Final Hardening v4 historical test evidence

> The rows below belong to the earlier v4 baseline and are retained for
> provenance. v4.1 is Windows/macOS-only, removes Linux build/release paths,
> and uses schema 22; current evidence is maintained in
> [FINAL_HARDENING_V4_1_CLOSEOUT.md](FINAL_HARDENING_V4_1_CLOSEOUT.md).

> v4.1.1 current evidence, including the Native filesystem smoke manifest and
> final Head CI, is maintained in
> [FINAL_HARDENING_V4_1_1_CLOSEOUT.md](FINAL_HARDENING_V4_1_1_CLOSEOUT.md).

This is the final local evidence log for branch `codex/final-hardening-v4`.
All timestamps are Asia/Shanghai. The task did not publish a release or push an
installer artifact.

## Local command log

| Start | End | Exit | Command | Tests/files/counts | Notes |
| --- | --- | ---: | --- | --- | --- |
| 2026-07-18 21:28:57.998 | 2026-07-18 21:29:04.222 | 0 | `npm ci` | 307 packages added; 308 audited | npm reported 0 vulnerabilities; deprecated-package warnings only |
| 2026-07-18 21:29:10.978 | 2026-07-18 21:31:52.322 | 0 | `npm run verify` | frontend 67 files/465 tests; remediation 1 file/11 tests; Rust desktop lib 307 tests; integration suites 26+1+5+1 pass/1 ignored+3+12+55 | Aggregate `verify:frontend`, `verify:rust`, and `verify:security` gate |
| 2026-07-18 21:39:03.642 | 2026-07-18 21:39:08.078 | 0 | `npm run typecheck` | TypeScript project check | Also executed by `verify:frontend` |
| 2026-07-18 21:39:08.083 | 2026-07-18 21:39:12.488 | 0 | `npm test` | 67 files; 465 passed | Also executed by `verify:frontend` |
| 2026-07-18 21:39:12.489 | 2026-07-18 21:39:13.429 | 0 | `npm run test:remediation` | 1 file; 11 passed | Also executed by `verify:frontend` |
| 2026-07-18 21:39:13.429 | 2026-07-18 21:39:46.570 | 0 | `npm run test:performance` | 100,000 SQLite rows; 8 query samples; 9 performance/architecture checks | Search p50 1.229 ms; p95 1.680 ms; max 1.680 ms; count p95 1.893 ms; total p95 3.574 ms; search threshold 1,000 ms |
| 2026-07-18 21:39:46.570 | 2026-07-18 21:40:28.984 | 0 | `npm run build` | Vite 2,066 modules; Windows NSIS bundle created | Chunk-size warning only; no publication |
| 2026-07-18 21:32:31.511 | 2026-07-18 21:32:31.901 | 0 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Formatting clean | |
| 2026-07-18 21:32:31.907 | 2026-07-18 21:33:09.145 | 0 | `cargo test --manifest-path src-tauri/Cargo.toml --jobs 1` | 306 passed; integration 26+1+5+1 pass/1 ignored+3+12+55 | No desktop feature |
| 2026-07-18 21:41:53.214 | 2026-07-18 21:42:09.221 | 0 | `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --jobs 1` | 307 passed; integration 26+1+5+1 pass/1 ignored+3+12+55 | Also executed by `verify:rust` |
| 2026-07-18 21:33:09.146 | 2026-07-18 21:33:13.477 | 0 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Clean | No desktop feature |
| 2026-07-18 21:42:09.228 | 2026-07-18 21:42:09.995 | 0 | `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets -- -D warnings` | Clean | Also executed by `verify:rust` |
| 2026-07-18 21:33:13.477 | 2026-07-18 21:36:28.874 | 0 | `cargo build --release --manifest-path src-tauri/Cargo.toml --features desktop-runtime --jobs 1` | Release binary compiled | |
| 2026-07-18 21:40:28.985 | 2026-07-18 21:40:31.326 | 0 | `npm run security:audit` | npm audit: 0 vulnerabilities | Also executed by `verify:security` |
| 2026-07-18 21:40:31.326 | 2026-07-18 21:40:34.344 | 0 | `npm run security:audit:rust` | Cargo.lock scanned; 15 allowed warnings | Existing GTK/glib unmaintained/unsound advisories; command exited 0 |
| final check | final check | 0 | `git diff --check` | No whitespace errors | Git emitted only expected LF-to-CRLF normalization warnings |

The aggregate command also ran the production Tauri build successfully. The
local unsigned installer was:

`F:\Coding\Zen-Canvas-final-hardening-v4\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`

- Size: `5,634,662` bytes
- SHA-256: `56F3903554F87D8F5D5AD17B3C6982FC5D4F98406E5641A8214A78D479E5DEB5`
- Authenticode: `NotSigned` (no signer certificate)
- Publication: none

## Desktop QA

The manual QA fixture was isolated under:

`C:\Users\77588\AppData\Local\Temp\zen-canvas-final-hardening-30526ee7e43240658e585c9803c54e72`

The QA build used a temporary Tauri product identifier and an explicit app-data
junction into that fixture. The source configuration was restored afterward;
the junction, fixture root, QA build target, and helper binaries were removed.
No Zen Canvas process remained.

The fixture manifest canaries were checked before and after the UI flow:

| Fixture | SHA-256 |
| --- | --- |
| `move-source.txt` | `EE2ACBBB47FEA37AA8928FAF335DF8F13F7501AF420D116CBE79FA775BE4A70E` |
| `conflict-source.txt` | `1EA1B5265344CF94ACA2D57F7FAA781059599A4CA7AB26FA01CF07451B0771C1` |
| `safe-trash-target.txt` | `1DA072138506D5FA24247A783ED6A1340242B532762CC11685DC1A7C4966F5BB` |
| `nested/nested.txt` | `7FD3D9D90FBD40D6BBEAD58EF90B07A5EC0720FEF92CEB35A593E8681EED9AA9` |

Observed manual flows:

- Custom-root scan indexed only the fixture: 4 files, 78 B, 0 warnings, and 0 skipped.
- Settings save changed the isolated close behavior to direct exit; no real-user setting was changed.
- Organize Suggestions showed six pending-review items and required preview confirmation; no move was executed.
- Storage Cleanup scanned only the selected fixture root: 0 B safe, 0 B review, 5 caution, 0 restricted. Caution items remained unselected and Safe Trash stayed disabled.
- Spotlight/global shortcut opened a standalone Search Window, searched `cleanup`, and returned `空间清理` without an ACL error.

The first isolated Spotlight attempt exposed `init_db` being called from the
search window even though search intentionally has no `allow-init-db` command
permission. The fix makes search mode reuse Tauri startup initialization and
keeps the search capability read-only; the rebuilt QA binary then passed the
same flow. The automated suites cover ordinary move/rename, target conflict,
Safe Trash/restore, source replacement, cancellation, watcher retry,
settings concurrency, credential replacement, and restart journal
reconciliation.

During the initial non-isolated smoke attempt, six uniquely prefixed fixture
rows were inserted into the production index. This was detected by the QA
cleanup check and recovered immediately without touching files: an exact
transaction marked only those six rows `is_stale=1`, leaving 0 active fixture
rows, 0 matching operation logs, and 0 matching Safe Trash items. The
temporary recovery copy was verified and removed.

## Remote CI

Remote CI run `29648128157` completed successfully for final code head
`74cda0cd7a4613bc88435a812227319f0f7b0449`.

| Gate | Workflow/job | Run ID | Final head included | Result |
| --- | --- | --- | --- | --- |
| Windows Quality | [`CI / Quality (windows-latest)`](https://github.com/ArdenZC/Zen-Canvas/actions/runs/29648128157/job/88089729343) | `29648128157` | `74cda0c` | passed; frontend, Rust, performance, audits, and NSIS package |
| macOS Quality | [`CI / Quality (macos-latest)`](https://github.com/ArdenZC/Zen-Canvas/actions/runs/29648128157/job/88089729316) | `29648128157` | `74cda0c` | passed; frontend, Rust, macOS path/temp regression, and audits |
| Dependency Audit | [`CI / Dependency audit`](https://github.com/ArdenZC/Zen-Canvas/actions/runs/29648128157/job/88089729337) | `29648128157` | `74cda0c` | passed; npm and RustSec |

## Release boundary

No installer was published. The local NSIS file is unsigned and is retained
only as a build-verification artifact; no signing, SmartScreen, macOS signing,
notarization, or public release claim is implied.
