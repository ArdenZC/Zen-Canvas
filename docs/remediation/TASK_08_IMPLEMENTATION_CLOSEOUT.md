# Task 08 Implementation Closeout

状态：第五轮最终人工代码级验收（Review ID `4834313114`）已通过，PR #44 已 squash 合并。生产代码 HEAD `80bfabd7ce1d11d7dfbadb4ef8df9d875935e437` 的 code-head full-validation run `30690147656` 与最终 PR tip `e6d81d369ece369c4b4092a2b4153165d7ec4532` 的 final-tip full-validation run `30690929857` 均成功。Task 08 已完成，schema 最终为 34；本文件不授权 schema 35、Task 08A/08B、Task 09 或任何自动扩展阶段。

## 范围、分支与审查基线

- 任务：`TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md`。
- 分支：`remediation/08-local-content-understanding`；PR #44 已于 `2026-08-01T08:47:49Z` squash 合并，merge commit 为 `30bc534db156cd1a287d8f727ba44efc224a6c4e`。
- 生产代码 HEAD：`80bfabd7ce1d11d7dfbadb4ef8df9d875935e437`；最终 PR tip：`e6d81d369ece369c4b4092a2b4153165d7ec4532`。对应 code-head CI `30690147656`、final-tip CI `30690929857` 均为完整矩阵成功。
- 本轮第五轮验收记录：Review ID `4834313114`，结论为通过，可合并，无需第六轮代码验收。
- 不创建 schema 35、Task 08A/08B、Task 09、OCR、RAG、Agent 或其他自动扩展阶段。

## 本轮剩余 finding 关闭映射

1. **PDF 真实资源边界**：移除 `pdf-extract`，改为纯 Rust bounded PDF text-layer parser。对象、Flate 解压字节、页数、输出字符、deadline、AtomicBool cancel、CMap entry/decoded-byte 和 literal/hex 临时 buffer 均在扫描/解压/文本流解析过程中检查；长 token/object scan 分块检查 deadline/cancel，计数器为 O(1)。Encrypted、malformed、OCR-only、超限均 fail closed。恶意压缩 PDF、object/decompression bomb、mid-flight timeout/cancel、输出截断、page limit 和真实 text-layer PDF fixture 均有行为测试；`src-tauri/tests/fixtures/task08-real/task08-multipage.pdf` 只是测试输入，产品运行时不调用 Python、LibreOffice、Tesseract、sidecar 或任何外部 executable。mid-flight timeout/cancel 断言有界耗时且不发布 artifact/FTS。
2. **Provider 原子发布**：run/item claim 返回 opaque owner 与 revision，claim 只接受 `provider_owner IS NULL`；`BEGIN IMMEDIATE` 内以 run/item/artifact CAS 同时提交 artifact、FTS 和 `provider_status='completed'`。所有 CAS UPDATE 检查 `changed == 1`；artifact CAS 冲突在同一事务把 item 标为 stale；run phase 以 expected revision/status/owner CAS 结束。completed item 不会再次 claim/replay，双连接竞争测试证明失败 claimant 不会发送 provider 请求或修改 item/run，仍复用既有 interactive provider，不创建第二通用 AI queue。
3. **Provider 最终 send 边界**：run 绑定 expected library revision，item 绑定 root/policy/source size/mtime/hash；完整 `understand_content_artifacts` orchestration 在 provider 调用前再次读取真实文件 metadata 与 bounded bytes/hash，并复核 artifact、root、policy、library revisions。extraction 后修改文件的回归测试通过 injectable fake provider seam，断言 provider request count 为 0，item/run 进入明确终态。
4. **故障注入/并发回归**：覆盖 claim 后崩溃、provider 返回后未发布、artifact UPDATE 后 item completion 前事务 abort、item 完成后 run completion 前恢复、cancel/delete/purge 期间 provider、completed no-replay、multi-root scoped purge、delete/purge rollback、Content Search stale cursor、PDF timeout/decompression bomb。故障测试使用 SQLite trigger/真实状态转换，不使用源码 contains 代替行为断言。
5. **UI Remount / refresh**：`FileLibraryInspector` 的 Remount 按钮直接调用 `refreshContentRun()`；不再 clone `contentRun` 触发无效 remount，polling effect 继续按 run id refresh。
6. **性能稳定性**：保持产品阈值 `complex p95 <= 150 ms` 不变；anti-tag page 使用按文件排序索引的 correlated `NOT EXISTS` 并对相同 query warm-up 后计时。本轮修复后 1M File Library complex p95 重复值为 `61.740 ms`、`61.610 ms`，均通过；deferred exact count 单独观测，不与复杂首屏门槛混淆。

## 数据边界与安全不变量

Schema 仍为 `33 → 34` additive migration，没有 schema 35。Artifact 绑定 file/root/size/mtime/source hash/extractor/policy/provider provenance；raw text 默认不保留，retention 仍受 bounded policy 控制。Delete/Purge 只删除 artifact、FTS、run/item projection，不删除或移动源文件。Provider payload 只包含 bounded extracted content 和固定 JSON schema，不发送 path、filename、secret、tool/script、Rule/Plan/operation 内容。

## 最终本机验证（Windows，2026-08-01）

- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --features desktop-runtime --no-fail-fast -- --test-threads=1`：退出码 0；lib **571 passed, 0 failed, 9 ignored**，各 integration targets（AI provider 29、classification 1、dedupe 12、FTS 1、global 3、migration 5、settings 12、storage 61）均通过，性能/平台专用 ignored tests 未被伪造为本机通过。新增 provider pre-claim 配置行为、PDF mid-flight timeout-through-run/cancel-through-run、CMap/temporary-buffer limits、双连接 owner contention 和完整 provider mutation-boundary 测试均通过。
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`：通过；`cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`：通过。
- `npm.cmd run typecheck`：通过；`npm.cmd test`：**79 files / 536 tests passed**；`npm.cmd run test:remediation`：**13 passed**。
- `npm.cmd run test:performance`：完整性能脚本通过，包含 FTS、100K/1M File Library、迁移/WAL、Task 02–07 基准和 architecture guards。1M query matrix 另重复执行两次，complex p95 `61.740 ms`、`61.610 ms`，没有修改 150 ms 门槛。
- `npm.cmd audit --audit-level=high`：**0 vulnerabilities**；`cargo audit --file src-tauri/Cargo.lock`：exit 0，**15 个既有 allowed unmaintained/unsound warnings**，无阻断漏洞。
- `npm.cmd run build`：Windows release + NSIS 成功。`F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`：**7,136,126 bytes**，SHA-256 `5D5D1E9AA58F1A9A1DBD39D9580AFAEDE4C91FE1FFAC8EC613E4D8761D574C30`；Task 08 历史基线 **7,039,064 bytes**，delta **+97,062 bytes (+1.38%)**。
- `git diff --check`：通过。GitHub macOS Rust/release/unsigned DMG 只接受 final-head CI，不在 Windows 上伪造。

## CI 证据与旧失败的准确解释

- 同一旧 HEAD `9d867f2aca7f860813201f16749255ec3c4b61cb` 的 PR workflow run [30662443445](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30662443445) 的 Performance job 失败原因是 **complex-query p95 `161.113 ms > 150 ms`**；不是 deferred probe，也不是可忽略的“deferred probe”失败。随后同 SHA 的 full run [30662447474](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30662447474) 成功，但本轮仍以稳定 benchmark 和新 final-head full matrix 为准。
- 本轮 code-head full-validation CI [30690147656](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30690147656)：head `80bfabd7ce1d11d7dfbadb4ef8df9d875935e437`，**全部成功**。包含 Windows/macOS Rust、完整 Performance、Windows/macOS release compile、NSIS、unsigned DMG、dependency/RustSec、frontend/format 和两个 quality gates。
- 最终 branch tip `e6d81d369ece369c4b4092a2b4153165d7ec4532` 的 final-tip full-validation CI [30690929857](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30690929857) **全部成功**；该 tip 为文档-only follow-up，不改变已验证的生产代码。

## 交付状态

PR #44 已 Open → Ready → squash merged；merge commit 为 `30bc534db156cd1a287d8f727ba44efc224a6c4e`。Task 08 已完成并进入持续回归；不发布、不创建 tag/release，不创建 schema 35、Task 09 或其他产品阶段。

## 最终治理收口

- Architecture Remediation V1 固定八模块主线全部完成、通过阶段验收并合并；Task 08 是固定主线最后一项。
- R-162、R-172 已更新为“已关闭，持续回归”。
- 保留 no OCR/image VLM、no vector database/RAG、no Agent/shell/MCP/tool runtime、no second durable AI queue、no Rule AST V2 content conditions、no arbitrary renderer paths、no operation/cleanup journal schema changes、no `files.id` migration、no schema 35、no Task 09 等边界。
- 没有修改生产代码、依赖或 lockfile；后续任何产品阶段必须由人工另行设计、审查并批准，Codex 不得自行授权或创建。
