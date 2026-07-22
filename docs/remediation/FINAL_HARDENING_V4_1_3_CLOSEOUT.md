# Zen Canvas Final Hardening v4.1.3 — Restore Journal & Reconciliation Closeout

日期：2026-07-22  
范围：Zen Canvas PR #10（Windows / macOS）

## 结论

本轮 v4.1.3 最终整改已完成。普通 Restore、Safe Trash recovery、恢复 Claim、启动 reconciliation、取消路径、最终 DB 落库与原生文件 smoke 均已落地并通过本地验证及远程 CI。

Ubuntu/Linux 不在产品、构建、测试或 CI 支持范围内，本轮不新增 Linux job、Linux build 或 Linux test。macOS 对无法证明安全文件身份的 mutation 场景保持 fail closed。

版本仍为 `0.1.40`；未修改 `.github/workflows/release.yml`，未创建 tag、release 或发布安装包。

## 版本与提交边界

- PR：[ArdenZC/Zen-Canvas#10](https://github.com/ArdenZC/Zen-Canvas/pull/10)
- 分支：`codex/final-hardening-v4`
- 基线 SHA：`3c4a3600be04bd414c384a9451c997d0f130806f`
- 最终验证的产品代码 SHA：`2ce4d84ece1d9979424a139606fe82eb5d66a00e`
- 本轮产品提交：
  - `ec9acf29769d9bea7a0c790b2ee6fd28bbccf8df` — journal ordinary restore claims
  - `dee4d95f40d256523d8de81957b93b383ad23769` — reconcile Safe Trash pending states
  - `2ce4d84ece1d9979424a139606fe82eb5d66a00e` — native restore crash-boundary tests

本文件是产品代码验证完成后的 evidence-only closeout；新增文档提交不改变上述产品代码 SHA。

## 实现闭环

### Restore Claim 与 schema 23

`operation_logs` 在 schema 23 增加独立于 forward operation 的 Restore Claim 字段：

- `restore_claim_path`
- `restore_phase`（默认 `idle`）
- `restore_claim_created_at`
- `restore_claim_platform_file_id`
- `restore_claim_full_hash`

旧 pending restore journal 会迁移到 `restore_phase='prepared'`，普通完成记录保持 `idle`。迁移、当前 schema repair、索引与 journal-state triggers 均可重复执行；trigger 同时约束 `operation_phase` 和独立的 `restore_phase`，避免恢复阶段覆盖 forward phase。

### 启动 reconciliation 与 Safe Trash

- 启动时读取 `manual_review` / `pending_recovery`，对 Safe Trash recovery 做一次批量状态重算。
- 终态历史不会被重新排队；未完成的恢复证据保留为 `pending_recovery` 或 `manual_review`。
- Safe Trash 在 active restore journal、claim 身份不明或 post-commit 身份校验失败时 fail closed，不自动重试、覆盖、删除或绕过预览确认。
- Safe Trash post-commit identity failure 保留 `target_committed` 或 `source_cleanup_pending`，不降级为可自动重试的 failed 状态。

### 普通 Restore 状态矩阵

reconciliation 依据 target、source 和独立 Claim 的存在性、身份匹配性及可读性收敛状态：

| 状态 | 证据 | 收敛结果 | 自动动作 |
|---|---|---|---|
| A | target 匹配；source 与 Claim 缺失 | `restored` / `completed` | 仅事务性终结 journal，不重试 |
| B | target 缺失；source 匹配；Claim 缺失 | `not_restored` / `rolled_back` / `can_restore` | 保留可恢复性，不自动重试 |
| C | Claim 匹配；target 与 source 缺失 | `manual_review` / `source_claimed` | 保留 Claim，禁止重试 |
| D | target 与 Claim 匹配；source 缺失 | `manual_review` / `source_cleanup_pending` | 保留已提交证据，禁止清理或重试 |
| E | Claim 身份不匹配或不可读 | `manual_review` | 稳定错误 `claim_identity_mismatch` |
| F | target/source 身份不匹配或不可读 | `manual_review` | 稳定错误 `target_committed_identity_mismatch` |
| G | target、source、Claim 均缺失 | `manual_review` | 稳定错误 `restore_pending_reconciliation` |

普通 Restore 不自动 overwrite、delete、retry，也不把恢复阶段写回 `operation_phase`。恢复成功的 file-index 更新、operation journal finalization、Claim 清理在一个 SQLite transaction 中完成；事务失败时保留 `manual_review` 与 `target_committed_durability_unknown` 证据。

### 取消与 UI

- Claim 创建前取消：清理未提交 Claim 并回滚到可恢复状态。
- Claim 创建后取消：保留 Claim 与 manual-review 证据，不伪造 rollback，也不触发自动重试。
- History / Cleanup Inspector 显示稳定错误、manual-review 状态与 Claim 路径；Reveal 仅执行安全 reveal，不提供在 manual-review 状态下绕过确认的清理按钮。

## 测试与证据

### 本地验证

以下命令均以 exit code 0 完成：

- `npm install`
- `npm run typecheck`
- `npm test`（67 files / 470 tests）
- `npm run test:remediation`（13 tests）
- `npm run test:performance`（9 tests；SQLite/FTS 100k benchmark 通过）
- `npm run security:audit`（0 vulnerabilities）
- `npm run security:audit:rust`（通过；15 条既有 allow-listed RustSec warnings，未增加）
- `npm run verify`
- `npm run verify:rust`（331 Rust library tests、integration tests、clippy `-D warnings`）
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --test migrations -- --test-threads=1`（5/5）
- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --test storage_analyzer -- --test-threads=1`（56/56）
- `cargo build --release --manifest-path src-tauri/Cargo.toml --features desktop-runtime --jobs 1`
- `npm run build`（本地 NSIS package）

### Windows native smoke

命令：

```text
cargo test --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --test native_file_hardening_smoke -- --ignored --nocapture --test-threads=1
```

结果：1/1 通过。测试覆盖真实 Claim path、ordinary restore 的 prepared/source-claimed/target-committed/final-transaction fault boundaries、target replacement、Claim replacement、target+Claim hard-link identity、all-paths-missing、pre/post-Claim cancellation、Safe Trash recovery 与 reentry fail closed。

Manifest：`C:\Users\77588\AppData\Local\Temp\zen-canvas-native-qa-artifacts\native-file-hardening-smoke.json`

Manifest v2 关键结果：

- `cross_volume_exercised=true`（C: → D:）
- `sqlite_integrity=ok`
- `fixture_cleaned=true`
- `real_app_data_accessed=false`
- `canary_unchanged=true`
- source / target / Claim replacement、all-paths-missing、Safe Trash recovery 与 reentry 项均为 `passed`

### 远程 CI

代码验证 run：[29918845261](https://github.com/ArdenZC/Zen-Canvas/actions/runs/29918845261)（head `2ce4d84ece1d9979424a139606fe82eb5d66a00e`）整体 success：

- Windows Quality `88919018847`：success；native smoke、100k search、NSIS package 均通过。
- macOS Quality `88919018945`：success；macOS path/temp policy regression 通过；Linux 不参与。
- Dependency audit `88919018961`：success。

CI 仅保留 Windows、macOS 与依赖审计三类 job。Node.js 20 deprecation annotation 是上游 action 提示，不是本轮失败项。

## 安装包与已知边界

- 本地安装包：`F:\Coding\Zen-Canvas-final-hardening-v4\src-tauri\target\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`
- 大小：`5,653,569` bytes
- SHA-256：`59329106D39BF074E345D6721B9773430042C0AF44BA5E7638E0266A40C8B13F`
- Authenticode：`NotSigned`；仅本地构建，未发布。
- Ubuntu/Linux：明确 unsupported，不提供 Linux build/test/CI/product contract。
- macOS：无法建立安全 native file identity binding 的 mutation 场景保持 fail closed，错误为 `macos_file_mutation_source_binding_unsupported`。
- 跨卷测试需要可用的第二卷；本次 Windows smoke 已使用 D: 作为 target volume。

本轮 v4.1.3 目标 findings：Critical 0 / Important 0 / Minor 0。上述平台与发布限制是明确边界，不作为未关闭 finding。
