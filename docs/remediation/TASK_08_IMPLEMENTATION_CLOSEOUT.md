# Task 08 Implementation Closeout

状态：Task 08 的实现与本机验证已完成；Draft PR #44 保持等待第二轮人工代码审查。本文件不授权自动合并、tag、release、schema 35 或 Task 09。

## 范围、分支与审查基线

- 任务：`TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md`。
- 审查：GitHub PR #44 的顶层 review `4831031814`；该 review 没有可单独读取的 GraphQL inline thread，以下按 review 中的 10 个 finding 逐项关闭。
- 分支：`remediation/08-local-content-understanding`；交付仍是 Draft PR #44，标题 `feat: add consent-bound local content understanding`。
- 本轮提交：`4b9c406`（实现 review gap）、`9317f2b`（生命周期/边界回归）、`1a58690`（本机证据）；本 closeout 提交后以新的 branch tip 为准，不 amend/rebase/force-push。

## 10 个 finding 的关闭映射

1. **Preview 权威性**：`COUNT(*)` 给出 exact count；超过 10,000 时只返回 sample、完整有序候选流的 fingerprint 和 opaque deferred resolver，不把 `LIMIT 10001` 当总数。fingerprint 覆盖有序 file id、root/path、size、mtime、目录标记、content hash、extension、support classification/reason。Preview 与 materialization 在同一 immediate transaction 使用同一 snapshot；10,001+ 在 materialization 前原子拒绝。per-file 与 total byte/char budgets 均展示并执行。
2. **逐次边界复核**：每次 body open 和 provider send 前重新校验 root membership、enabled/health、reconciliation、watcher recovery/revision、library/root/policy revision 与 source identity；变化返回 stale/blocked，不读取旧内容、不发送旧 payload。
3. **真实授权 UI**：File Library Inspector 支持逐 root policy（enabled、local/cloud、byte/char limits）、Preview→Review→独立 `confirmed=true`、provider/delete/rebuild/purge/cancel 的独立确认；review 显示 exact/deferred、scope、formats、blocked、per-file/total budgets、retention 和 cloud payload；run list/progress/cancel/remount/recovery 状态可见。
4. **耐久 Provider 生命周期**：`content_runs`/`content_run_items` 保存 owner、revision、CAS、provider status、completion 和 cancellation；cloud consent 绑定每个 run，provider 并发为 1，completed item 不 replay，crash/restart 通过 recovery projection 收敛；复用既有 interactive provider，不创建第二 generic AI queue。
5. **纯 Rust extractor 与真实 fixture**：CSV、text-layer PDF、DOCX/XLSX/PPTX 在 Rust 内 bounded 解码；共享/inline strings、多个 worksheet/slide/page、entities/comments 均覆盖。真实应用生成 fixtures 位于 `src-tauri/tests/fixtures/task08-real/`（LibreOffice 只用于生成测试 fixture，产品运行时不调用）；encrypted、malformed、zip bomb、timeout/cancel、OCR-only/unsupported 均 fail closed。产品无 Python/Tesseract/Nexa/LibreOffice/executable 依赖。
6. **Schema 34/catalog/search authority**：33→34 additive migration 增加 content revision、artifact/provider/rebuild/delete/purge 的 revision advancement；cursor 绑定 revision、query/scope、updated_at/id，任何 stale cursor fail closed；Content Search 使用 keyset、latest-wins、remount/stale banner，未接入 Global Search。
7. **原子删除/清理**：artifact、FTS、run-item projection 在 immediate transaction 中一致删除/标 stale；多 root scope 受 root/policy/library CAS 约束，run projection 可保留并标记 `content_scope_purged`；fault/rollback 路径 fail closed，源文件从不修改。
8. **Browser mock 诚实**：浏览器 mock 的 native preview/start/run/list/query/rebuild/delete/purge/understand/catalog 操作明确返回 `browser_mock_content_unavailable`；mock 不冒充 native extraction/provider/persistence 成功，也不读本地文件。
9. **完整 CI 路径**：`.github/workflows/ci.yml` 对 PR #44 强制 `full_validation=true`，保留 Windows/macOS Rust、release compile、NSIS、unsigned DMG、完整性能、依赖/RustSec 和 package-delta jobs；fast path 不能替代 full matrix。最终头部 CI URL 在推送后补入本文件。
10. **行为/并发/fault 回归与交付**：新增 content lifecycle、boundary、cancellation、provider envelope、extractor/fixture、zip-bomb/timeout、browser-mock truthfulness、delete/purge 断言；本 closeout 记录实际测试、fixture、性能、平台、依赖/许可证、包大小与 worktree，随后推送并停止等待第二轮人工 review。

## Schema 34、数据边界与安全不变量

`33 → 34` 只新增 content scope policy/run/item/artifact/FTS/catalog 结构及迁移列，不 ALTER `files`、不迁移 `files.id`，不改变 operation/cleanup、dedupe、Analysis、Plan 或 Rule Proposal ledger；没有 schema 35。迁移有 `BEGIN IMMEDIATE`、exact-column/future-version/conflict guard、rollback/idempotence 覆盖，并在最后写 `user_version=34`。

Artifact 绑定 file/root、size/mtime/is_dir/source hash、extractor、policy/provider provenance 与 catalog revision。raw text 默认不保留；显式 retention 受 7 天/4 MiB cap。Delete/Purge 只回收内容事实/FTS/run projection，不删除或移动源文件。Provider payload 只含 bounded extracted content 与固定 JSON schema，路径、secret、tool/script/Rule/Plan/operation 内容不会进入请求或 trace。

## UI/API/mock 交付

- Rust/Tauri、`tauriApi.ts`、domain types、`build.rs`、capability/default permission 与 security matrix 同步 `get_content_catalog_revision`、preview/start/run/item/artifact/search/rebuild/delete/purge/provider commands。
- Content Search 只位于 File Library Inspector，使用 catalog revision/keyset cursor；任何 query/scope/revision 不一致显示 stale 并要求 remount。
- Policy、provider/cloud、delete/rebuild/purge/cancel 都有独立确认，不使用 `window.confirm`；source file 不在 UI 请求 DTO 中。

## 本机验证（Windows，2026-08-01）

- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib --no-fail-fast -- --test-threads=1`：**555 passed, 0 failed, 9 ignored**，129.10 s。
- Task 08 定向 Rust content：**9 passed**；DB schema/query 定向回归：**128 passed, 2 ignored**。
- `cargo check --manifest-path src-tauri/Cargo.toml --lib --features desktop-runtime`、`cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets --jobs 1 -- -D warnings`、`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：通过。
- `npm.cmd run typecheck`：通过；`npm.cmd test -- --run`：**79 files / 536 tests**；`npm.cmd run test:remediation`：**13 passed**。
- `npm.cmd run test:performance`（`1a58690`）：exit 0，架构 guard、FTS 100K、global-search/scan 100K、schema/WAL、Task 02/03/05/06、Task 07 impact 与 **1M File Library query/migration** 全部通过；FTS post-optimize search p95 为 2.969 ms（阈值 1,000 ms）。随后针对 CI 暴露的 Task 07 deferred 1M probe 做了 bounded `threshold+1` 优化；本机 release benchmark 为 `deferred_1m_ms=48.527`、`exact_1m_ms=478.687`，原 200 ms 门槛保持不变。
- `npm.cmd run security:audit`：0 vulnerabilities；`npm.cmd run security:audit:rust`：exit 0，16 个既有 allowed unmaintained/unsound warnings，无阻断漏洞。
- `npm.cmd run build`：Windows release + NSIS 成功。当前包 `F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`：**7,565,223 bytes**，SHA-256 `61B9B5EF57416D13F336B5920A85CAB79EE6ED04419D0B0D564ECF4323336EB4`。Task 08 前历史基线为 **7,039,064 bytes** / `BA0335A79DCC2EAEAD3C4DE3B6038A80DCA28B6E04413E80CD0AF1C74AB1943F`，delta **+526,159 bytes (+7.47%)**。
- `git diff --check`：通过；本机工作区在 closeout 编辑前干净，提交后再次检查。

## Fixtures、依赖与许可证

真实应用 fixture：`task08-multipage.docx`（2 pages/entities）、`task08-multisheet.xlsx`（2 sheets，shared/inline）、`task08-multislide.pptx`（2 slides/entities），以及对应的 flat OpenDocument source/README。source 只用于生成并提交测试 fixture，产品不执行 LibreOffice。

新增直接 crate 及 metadata license：`csv 1.4.0`（Unlicense/MIT）、`pdf-extract 0.12.0`（MIT）、`quick-xml 0.41.0`（MIT）、`zip 2.4.2`（MIT，`deflate`，default features disabled）。未捆绑 Python、Conda、Tesseract、Nexa、模型或外部 executable。

## CI、平台与交付状态

- Windows 本机证据如上；macOS Rust、release compile、unsigned DMG、macOS smoke 只接受 GitHub macOS runner 结果，不伪造本机证据。
- PR #44 的第一次 full-validation run [30658768769](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30658768769) 在 HEAD `1a586905dfc6bbeb4553ad7e2f93476e31652545` 仅因 Task 07 deferred 1M probe 测得 `210.042 ms > 200 ms` 失败；其余 Windows/macOS Rust、release、NSIS、unsigned DMG、依赖与 frontend jobs 成功。修复为 bounded `threshold+1` probe，未降低阈值；新的 final HEAD full run 必须全部成功。
- PR #44 的 final full-validation run [30660805560](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30660805560) 在 HEAD `0cbb74cdff8a9d7cca3c6c20a7655ca94292b3d` **全部成功**（Performance 24m59s；Windows/macOS Rust quality；Windows/macOS release compile；NSIS；unsigned DMG；Dependency audit；Frontend/format；Windows/macOS quality gates）。该 run 是 bounded `threshold+1` probe 修复后的完整矩阵。
- 本 closeout 的下一次文档提交会改变 HEAD；推送后必须再执行 full-validation，并把新的 final run URL/head SHA 保留为最终证据。
- 交付保持 Draft PR、不开启 auto-merge；full CI 成功后停止，等待第二轮人工代码审查。
