# Zen Canvas Final Hardening v4.1.4 — Restore Consistency Closeout

日期：2026-07-22
范围：Zen Canvas PR #10（Windows / macOS）

## 结论

v4.1.4 的最后一次 Restore / Safe Trash 一致性整改已完成。Safe Trash 三路径恢复矩阵、Claim 身份边界、成功终态事务、ordinary restore 索引缺失 upsert、Claim 保留和 preview 终态均已落地，并通过本轮限定的本地定向测试。

Ubuntu/Linux 不在产品、构建、测试或 CI 支持范围内；本轮不新增 Linux job、Linux build 或 Linux test。

版本仍为 `0.1.40`。未修改 `.github/workflows/release.yml`，未创建 tag、release 或发布安装包。

## 版本与提交边界

- PR：[ArdenZC/Zen-Canvas#10](https://github.com/ArdenZC/Zen-Canvas/pull/10)
- 分支：`codex/final-hardening-v4`
- 本轮基线 SHA：`5a467b21851b0404ab2180bb7f38c2381dcbaf67`
- 本轮产品提交：`885f0bc`（`fix(recovery): close restore consistency gaps`）
- 修改范围：
  - `src-tauri/src/storage_analyzer.rs`
  - `src-tauri/src/db/queries/files.rs`
  - `src-tauri/src/file_ops.rs`
  - 对应 DB / Safe Trash 定向测试

## 实现闭环

### Safe Trash Restore 矩阵

恢复 reconciliation 现在使用 source、Safe Trash target 和独立 Claim 的三路状态，并把 fingerprint 读取失败保留为 `Unreadable`，不再压成普通 Mismatch：

| 状态 | 收敛结果 | Claim | 自动动作 |
|---|---|---|---|
| A：original 匹配，trash/Claim 缺失 | `restored / completed / verified` | 清空 | 仅执行终态事务，不重试 |
| B：original 缺失，trash 匹配，Claim 缺失 | `moved / rolled_back / verified` | 清空 | 保留 Safe Trash，可再次预览恢复 |
| C：original/trash 缺失，Claim 匹配 | `manual_review / source_claimed / restore_pending_recovery` | 保留 | 禁止自动重试 |
| D：original 缺失，trash/Claim 匹配 | `manual_review / source_cleanup_pending / restore_pending_recovery` | 保留 | 禁止自动清理或重试 |
| E：Claim Mismatch / Unreadable | `manual_review` | 保留全部 Claim 字段 | `claim_identity_mismatch`，禁止重试 |
| F：target/source Mismatch / Unreadable | `manual_review` | 保留全部 Claim 字段 | `target_committed_identity_mismatch`，禁止重试 |
| G：三路均缺失 | `manual_review / manual_review / restore_pending_recovery` | 保留全部 Claim 字段 | `restore_pending_reconciliation`，禁止重试 |

成功 Safe Trash restore 现在通过同一 SQLite transaction 同时完成 item 终态、Claim 清理和 batch 状态同步；任一终态写入失败都会回到 `manual_review`，保留 `target_committed_durability_unknown` 与 Claim 证据。

### Ordinary Restore 与索引

- `finalize_successful_operation_restore` 改为 `Result<()>`，不再返回可被调用方忽略的 `Ok(false)`。
- indexed file 缺失时，在同一 transaction 中安全插入恢复后的 file row，并触发既有 FTS trigger。
- 已存在的 target row 必须与恢复文件 metadata 一致；冲突时 fail closed，不删除其他有效记录。
- file-index 更新与 operation journal finalization 同事务提交；journal 失败会回滚索引写入。
- ordinary restore 的 all-paths-missing 分支保留 Restore Claim，不再清掉手动复核证据。

### Preview 与安全边界

`status=restored` 始终显示为稳定的 `already restored`；active recovery journal 仍阻断恢复。保留预览 / 执行确认、allowlist、no-overwrite、no-auto-retry、no-auto-delete 与 Safe Trash 可恢复边界。

## 本轮本地定向验证

以下命令均 exit code `0`；本轮共执行 12 条定向命令，覆盖 14 个通过的测试用例：

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib cleanup_restore_reconciliation`（2/2）
- `cargo test --manifest-path src-tauri/Cargo.toml --lib ordinary_restore_finalization`（2/2）
- `cargo test --manifest-path src-tauri/Cargo.toml --lib restore_moves_updates_file_record`（2/2）
- `cargo test --manifest-path src-tauri/Cargo.toml --lib restore_moves_does_not_fail_when_file_record_missing`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer pending_safe_trash_restore_reconciliation_finalizes_committed_target_and_clears_claim`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer pending_safe_trash_restore_reconciliation_rolls_back_before_commit_and_remains_restorable`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer pending_safe_trash_restore_reconciliation_preserves_all_claim_fields_when_every_path_is_missing`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer safe_trash_restore_final_transaction_failure_preserves_claim_for_manual_review`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer move_cleanup_candidates_to_safe_trash_records_and_restores_items`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer pending_safe_trash_journal_reconciles_a_completed_move_after_restart`（1/1）
- `cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer schema_18_adds_safe_trash_identity_columns`（1/1）

## 明确未验证项

按用户要求，本轮未等待或验收远端 CI；合并依据为本地定向测试与代码复核。

本轮未运行 full verify、全量测试、Browser QA、macOS 真机 QA、NSIS 安装链、签名验证、发布流程、性能审计或安全审计；安装包保持未签名且未发布。

## 平台与产品边界

- 支持范围：Windows / macOS；本轮实际执行 Windows 本地定向验证。
- Ubuntu/Linux：明确 unsupported，不提供 Linux product/build/test/CI contract。
- 恢复失败或身份不可读时保持 fail closed；不 overwrite、不自动 retry、不永久删除、不绕过预览确认。
- 未改版本号、release workflow、tag、release 或 installer publish。
