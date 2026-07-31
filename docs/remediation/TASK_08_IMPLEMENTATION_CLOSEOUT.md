# Task 08 Implementation Closeout

状态：实现与验证完成，等待人工代码级验收；本文件不授权自动合并、tag、release 或 Task 09。

## 范围与治理

- 任务：`TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md`。
- 基线：`master` 在 `1f0bac73e9bf477486d670d60c83ba1350f18abc`；Task 07 merge ancestor 为 `4e07de9c02198eb3352d9b2b1f289d61a3df128c`。
- 分支：`remediation/08-local-content-understanding`。
- 交付：一个 Draft PR，标题固定为 `feat: add consent-bound local content understanding`；合并、发布、tag 留给人工决定。
- 参考项目：`QiuYannnn/Local-File-Organizer` 固定 SHA `a19559942a35d98e9d2168fa58f288d9ea294bc6`，MIT；仅采用设计原则，未移植其源码、CLI、prompt、Python/外部 runtime 或数据模型。

## Task 07 第一组关闭证据

1. Rule Catalog revision 在 user CRUD/toggle/delete、learned insert/update/enable、分类确认/更正以及影响 effective ruleset 的 settings 变更上统一 CAS；规则目录 revision 不再复用为不同有效规则集。
2. `execute_rules_for_scope_v2` 在 backend 取得单一快照：catalog/settings/enabled persisted rules/classification version、durable scope、root health、watcher/reconciliation revision、library revision；执行前后以同一 process-local mutation gate 与 owned library-batch delta revalidate，拒绝 stale/TOCTOU。
3. Rule impact sample 复用真实 classification engine，返回 before/after action、purpose、target、reason、confirmation、winner/runner rule，并绑定 priority/weight、enabled source、legacy builtin 与 conflict/risk facts。
4. Proposal Workspace 展示 bounded before→after、risk、permission、scope health、broad match、conflict completeness、sample；支持 keyboard/focus/ARIA live、narrow/CJK/RTL/200% 的现有 UI 结构。
5. 手工 candidate edit 清空旧 AI summary/clarification，保持 provider/model provenance，写入 `candidateOrigin=manual` 元数据并使旧 preview fingerprint 失效；未新增 schema 35 或 Rule Proposal 表列。
6. backend 原始 prompt gate 对中英文、大小写、空格、连字符变体确定性拒绝 delete/trash/empty/permanent、shell/script/command/tool/MCP、auto-enable/run/execute-now、bypass preview/journal/restore 与 OCR/content/Rule AST V1 越界意图；良性模型输出不能绕过。

## Schema 34 与数据边界

`33 → 34` 是 additive migration，创建 `content_scope_policies`、`content_runs`、`content_run_items`、`content_artifacts` 与 managed-only `content_artifact_fts`，并建立 source identity 变化触发 stale 的 trigger。迁移使用 `BEGIN IMMEDIATE`、exact-column/future-version/conflict guard、rollback/idempotence fixtures，最后才写 `user_version=34`。未 ALTER `files`、未迁移 `files.id`，未修改 operation/cleanup journal、dedupe、Analysis、Plan 或 Rule Proposal ledger。

每个 durable File Library root 有默认 disabled policy，local/cloud 默认均为 false；policy 同时绑定 root revision 与 policy revision CAS，local/cloud/raw-retention/extractor/byte/char/page/row bounds 由 backend 校验。Preview 只接受 durable scope/selection IDs、library/root/policy revisions 与 provider mode，最多 20 条 metadata sample；Start 必须提交 matching fingerprint 与 `confirmed=true`，并重新 revalidate health/revisions。路径、renderer file list、raw content、provider secret 不进入请求 DTO。

固定纯 Rust extractor 支持 UTF-8/UTF-16 txt/md、bounded CSV、text-layer PDF、DOCX/XLSX/PPTX；legacy Office、encrypted/password document/archive、binary/media/ebook、OCR-only PDF、image/VLM、remote URL、symlink escape 均稳定返回 unsupported/blocked/failed。bytes/chars/pages/rows/archive entries/compression/decompressed bytes/wall-clock/regular-file identity 均有边界。Artifact 绑定 file/root/size/mtime/is_dir/source hash/extractor/policy/provider provenance；raw text 默认不保留，显式 bounded retention 受 7 天/4 MiB cap，Delete/Purge 只删除内容事实与 FTS，不删除源文件。

Provider understanding 复用已有 interactive provider，最多 20 个 current artifacts，串行、无自动 retry；每个 artifact 在发送前重新按 root policy 提取 bounded text 并校验 source hash，cloud 每次确认，Sensitive/System/blocked fail closed，payload 只有 bounded text/fixed schema，strict envelope 拒绝未知字段、路径/文件名/Rule/Plan/operation/script/tool 内容，raw response 不持久化。Watcher/scanner 仅能使 artifact stale；startup recovery 失败未完成 run、标 stale extractor version，不重放 completed item。Content Search 只在 File Library FTS 使用 keyset cursor，不进入 Global Search/Search window。

## Tauri/UI/Mock 交付

- main-only commands：policy get/set、preview/start/get/list/cancel run、query items、artifact get/query/rebuild/delete、scope purge、provider understand；命令均使用 durable IDs、revision/CAS、confirmed gate 与 stable error code。
- `build.rs`、`default.json`、Rust invoke handler、frontend API/types、browser mock、权限矩阵同步；search capability 没有 content command。
- File Library Inspector 提供 Preview Content、Analyze local、Understand with provider、Rebuild、Delete content data，并展示 status/policy/summary/keywords/language/provenance/truncated/retained disclosure。Rule Proposal Workspace 展示 manual provenance 与 differential impact。
- browser mock 是固定 fixture，不读取本地文件、不调用 provider、不访问 SQLite。

## 测试与验证记录

基线（Task 08 修改前，master）：npm typecheck/test/remediation/performance/build、Rust 551 tests/clippy、frontend/security 与 Rust audit 均已通过；Windows NSIS bundle 基线为 `F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`。性能脚本必须在无并发资源干扰下重跑。

本分支已通过的定向回归：

- `cargo test --manifest-path src-tauri/Cargo.toml --lib content::tests`：5 passed；
- `cargo test --manifest-path src-tauri/Cargo.toml --lib schema_33_to_34`：2 passed；
- `npm.cmd run typecheck`；
- `npm.cmd test`：78 files / 535 tests；
- `npm.cmd run test:remediation`：13 tests；
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`；
- `git diff --check`（提交前再次执行）。

最终工作树验证（Windows，2026-07-31）：

- `cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --jobs 1 --no-fail-fast -- --test-threads=1`：560 个 lib 测试、所有集成目标与 doc-tests，0 failed；
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime --all-targets --jobs 1 -- -D warnings`：通过；
- `npm.cmd run typecheck`、`npm.cmd test`（78 files / 535 tests）、`npm.cmd run test:remediation`（13 tests）：通过；
- `npm.cmd run security:audit`：0 vulnerabilities；`npm.cmd run security:audit:rust`：exit 0，15 个既有 GTK/Unicode/glib allowed warnings；
- `npm.cmd run test:performance`：单独运行 exit 0；架构检查、100k/1M no-rewrite/WAL 与 Content FTS/keyset checks 通过；
- `npm.cmd run build`（`CARGO_BUILD_JOBS=1`）：Windows release/NSIS 成功。安装包 `F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`，7,039,064 bytes，SHA-256 `BA0335A79DCC2EAEAD3C4DE3B6038A80DCA28B6E04413E80CD0AF1C74AB1943F`；
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` 与 `git diff --check`：通过。

平台边界：

- Windows evidence 已在上方记录；macOS unsigned DMG/平台 smoke 由 CI 或人工平台 runner 补充，不伪造本机证据。

## CI 验证路径（2026-07-31）

为避免每次 PR 把完整性能与打包矩阵重复跑数小时，`.github/workflows/ci.yml` 现在分为两条明确路径：

- 普通 PR：保留 frontend/typecheck/tests/remediation、Windows Rust quality、Dependency audit，以及 `test:performance:pr` 的 100k complexity sentinel；不运行 1M/full performance、macOS Rust、release compile 或 NSIS/DMG 打包。
- Full validation：保留原有全部断言与阈值，不修改性能门槛；由 `master` push、nightly schedule、PR 加 `full-validation` label，或手工 `workflow_dispatch` 勾选 `full_validation=true` 触发。

PR 的快速路径只改变调度范围，不把跳过的 full job 当作通过；Windows/macOS gate 会明确校验 full job 在快速路径为 skipped、在 full 路径为 success。此前完整矩阵 [CI run 30642490279](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30642490279) 已全部通过；后续 full profile 若出现既有基准的资源争用超时，仍须保留原始输出并单独修复，不能放宽阈值。

## 依赖与许可证

新增直接依赖：`zip = 2.4.2`（`deflate`、default features disabled；MIT，锁文件同时记录 `zopfli = 0.8.3` 传递项，Apache-2.0）。`quick-xml` 未作为本模块直接依赖，现有传递依赖仍由既有 plist 链路提供。`cargo tree`/metadata 与 RustSec audit 已执行：npm 0 vulnerabilities，RustSec exit 0 且仅保留既有 15 个 allowed warnings。当前 Windows NSIS 包为 7,039,064 bytes；本机没有可复原的 Task07 安装包副本，因此不伪造 size delta。未捆绑 Python/Conda/Tesseract/Nexa/模型或外部 executable。

## 已知限制与明确非目标

- 本机 Windows 不能声称 macOS Spotlight/FSEvents、unsigned DMG 或 macOS native mutation 已验证；由 CI/人工 runner 提供证据。
- Content understanding 不是 OCR、RAG、vector store、chat/Agent、通用 Job Runtime、第二 AI queue，也不产生 Rule/Plan/operation/filesystem mutation 权威。
- Raw retained text 是显式 per-root opt-in 的 bounded exception；默认 none，purge/delete 可回收内容事实但不触碰源文件。
- 性能结论以单独、资源不争用的 full run 为准；任何 threshold failure 必须保留原始输出并修复或明确登记，不能放宽门槛。

## 交付引用

- implementation commit：`8ab143e25d07ae93d18627e7d9eb0e0fdaef98b2`（不 amend/rebase）；
- Draft PR：[#44](https://github.com/ArdenZC/Zen-Canvas/pull/44)，标题 `feat: add consent-bound local content understanding`；
- CI workflow/checks：完整矩阵 [CI run 30642490279](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30642490279) 已全部通过；优化后的 PR 快速路径 [CI run 30651577214](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30651577214) 也已通过，墙钟约 6 分 22 秒（Windows Rust 4 分 42 秒、PR performance 5 分 56 秒），macOS Rust/release compile/NSIS/DMG full-only jobs 均明确 skipped；
- final branch HEAD：`854398ef565695e2683e1963a80d1d21248d882c`，保持 Draft PR 等待人工代码级验收。
