# Post-V1 Verification Closeout

这是一份 Architecture Remediation V1 完成后的维护修复记录，不是 Task 09，也不授权新的产品模块或架构阶段。

## 基线与交付范围

- 仓库：`ArdenZC/Zen-Canvas`；
- 实际 master 基线：`11a3d615b84a76cfa4bc964fd906871836dd3fe8`，包含 Task 08 最终治理合并；
- 维护分支：`fix/post-v1-verification-gaps`；
- 代码修复提交：`912058b`（完整 SHA 以 PR 最终 tip 为准）；
- 单一 Draft PR：`fix: close post-v1 verification gaps`；
- schema 仍为 34；`files.id`、operation/cleanup journal、Managed AI schema/provider 均未修改；
- `Cargo.lock`、`package-lock.json` 和依赖声明未发生非必要变化；没有新增依赖或外部 runtime。

本轮只处理独立验收发现的 Global Search、IME、索引来源状态、Watcher 文案、旧 Rule command surface、CI 门禁和过期 Draft PR；没有开始 Task 09、schema 35、OCR、RAG、Agent、第二套搜索索引或 UI/文件操作架构重写。

## Finding → 根因 → 修改 → 行为证据

1. **Global Search extension 排序**：extension tier 以 SQLite `rowid` 作为 tie-breaker，删除/重插入会改变顺序。`src-tauri/src/global_index/search.rs` 改为 bounded SQL `ORDER BY ge.modified_at_fs DESC, ge.id ASC`；`src-tauri/src/global_index/tests.rs` 覆盖反向插入、相同时间、重复查询、删除重插、exact/prefix、分页和最终 durable ID 顺序。
2. **标点查询语义**：旧 fallback 在查询前剥离首尾标点，导致 `.gitignore`、`C++`、`report!` 等查询扩大。现在使用原始查询构造 escaped literal GLOB prefix，`*`、`?`、`[` 均按字面处理且仍受候选上限约束；Rust 行为测试覆盖 `.gitignore`、`C++`、`report!`、`[name]`、`file*`、`what?`、标点-only、稳定重复结果。
3. **IME mounted interaction**：原有测试只覆盖 helper。新增 `tests/commandModalIme.test.tsx`，真实挂载 `CommandModal`，使用 fake timers 验证 `compositionstart`、`z/zh/zhong`、debounce 期间零 backend 调用、composition 期间 Enter/方向/Home/End/PageUp/PageDown 不执行或移动，`compositionend` 后最终 query 严格为 `中` 且只调用一次。
4. **无启用索引来源**：Rust `result_state` 把无 source + 无结果误报为 `empty`。新增稳定 wire value `no_source`，同步 Rust/TypeScript/browser mock/UI；UI 显示需要配置来源并保留到 Global Index 设置的安全入口，普通 empty、partial、pending、failed 和 complete 语义不变。`tests/searchSpotlight.test.ts` 和 Rust command 状态测试覆盖 wire/文案区分。
5. **Watcher reconciliation 文案**：`watcherReconciliationMessage()` 错误复用 `watcherRetryExhausted`。新增独立 `watcherReconciliationRequired` 中英文文案，`tests/watcherMessages.test.ts` 验证 retry、reconciliation、permission、partial 四类状态互不混淆。
6. **旧 Rule Tauri 命令**：`save_user_rule`、`delete_user_rule`、`get_user_rules` 的 command wrapper 仍留在 `db/commands.rs`，虽未注册仍扩大未来 surface。已移除 wrapper；V2 list/create/update/enable/delete/apply 与 backend canonical execution 保留，内部 DB helper 仅供迁移/单测。`tests/tauriCommandPermissions.test.ts` 验证 main handler/manifest/capability 不暴露旧 whole-object mutation，Search window 仍无 Rule mutation 权限。
7. **CI 历史特例**：workflow 曾按 PR #44 强制 full validation。已删除特定 PR 号，改为 push/schedule/dispatch/full-validation label/high-risk path 触发 full；docs-only 保持文档 fast path；所有生产代码 PR 固定执行 frontend、Windows/macOS Rust、Clippy 和 Windows/macOS release compile；NSIS、unsigned DMG、1M performance 只在 full path 执行；diff base 缺失 fail-safe 为 full。高风险目录包含 file ops、fs safety、schema、content、global index、capabilities、tauri/package/installer/workflow。契约测试同步更新并明确无 PR #44 字符串特例。

## 过期 Draft PR

- PR #13：已添加 `Superseded by Architecture Remediation V1.`、`The authoritative implementation has been merged through Tasks 01–08.`、`Do not resume or merge this branch.` 评论后关闭；分支未删除。
- PR #24：已添加同样的 superseded 评论后关闭；分支未删除。

## 验证记录

本地已执行聚焦 Rust search/no-source tests、frontend Vitest（含真实 IME mount、Watcher、CI、command permission）和 `npm run typecheck`。完整 `npm test`、`npm run build`、Rust full/clippy/release、remediation、security、Windows/macOS 与 installer/package 检查由本 PR GitHub Actions 提供；最终 run URL、结果和最终 branch HEAD 在 PR checks 完成后补录到本文件与最终报告。

## 已知剩余问题

本轮未发现范围内必须后移的生产缺口。任何与上述范围无关的 audit、依赖、平台或性能问题只记录，不在本 PR 顺手修改；继续保持 schema 34、Preview/Safe Trash/History/Restore、不自动移动/删除文件、AI 仅建议、无 cloud 静默发送和无 Task 09 的边界。
