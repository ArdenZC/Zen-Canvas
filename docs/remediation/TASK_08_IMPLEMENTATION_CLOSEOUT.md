# Task 08 Implementation Closeout

状态：第二轮人工 review `4832353459` 的剩余阻断项已在原分支修订；Draft PR #44 保持不合并，等待最终 full-validation CI 和第三轮人工验收。本文件不授权自动合并、tag、release、schema 35、Task 08A/08B 或 Task 09。

## 范围、分支与审查基线

- 任务：`TASK_08_LOCAL_CONTENT_ARTIFACTS_AND_UNDERSTANDING.md`。
- 分支：`remediation/08-local-content-understanding`；唯一交付仍为 Draft PR #44。
- 本轮代码提交：本地等价提交 `37e5f53`；通过 GitHub API 推送的代码提交为 `5f81ce724ba74f2d775c8cde8399d55d57466595`。最终文档提交后的 branch tip 以 GitHub 为准。
- 不创建新分支、新 PR、Task 08A/08B、schema 35 或 Task 09。

## 本轮剩余 finding 关闭映射

1. **PDF 真实资源边界**：移除 `pdf-extract`，改为纯 Rust bounded PDF text-layer parser。对象、Flate 解压字节、页数、输出字符、deadline、AtomicBool cancel 均在扫描/解压/文本流解析过程中检查；Encrypted、malformed、OCR-only、超限均 fail closed。恶意压缩 PDF、object bomb、超时、cancel、输出截断和 page limit 有行为测试；提交 `src-tauri/tests/fixtures/task08-real/task08-multipage.pdf` 是普通 LibreOffice 生成的真实 text-layer fixture，LibreOffice 只用于生成测试输入，产品运行时不调用任何外部 executable。
2. **Provider 原子发布**：run/item claim 返回 opaque owner 与 revision；`BEGIN IMMEDIATE` 内以 run/item/artifact CAS 同时提交 artifact、FTS 和 `provider_status='completed'`。所有 CAS UPDATE 检查 `changed == 1`；artifact 冲突在同一事务把 item 标为 stale；run phase 以 expected revision/status/owner CAS 结束。completed item 不会再次 claim/replay，仍复用既有 interactive provider，不创建第二通用 AI queue。
3. **Provider 最终 send 边界**：run 绑定 expected library revision，item 绑定 root/policy/source size/mtime/hash；provider 调用前再次读取真实文件 metadata 与 bounded bytes/hash，并复核 artifact、root、policy、library revisions。extraction 后修改文件的回归测试证明 fake provider request count 为 0。
4. **故障注入/并发回归**：覆盖 claim 后崩溃、provider 返回后未发布、artifact UPDATE 后 item completion 前事务 abort、item 完成后 run completion 前恢复、cancel/delete/purge 期间 provider、completed no-replay、multi-root scoped purge、delete/purge rollback、Content Search stale cursor、PDF timeout/decompression bomb。故障测试使用 SQLite trigger/真实状态转换，不使用源码 contains 代替行为断言。
5. **UI Remount / refresh**：`FileLibraryInspector` 的 Remount 按钮直接调用 `refreshContentRun()`；不再 clone `contentRun` 触发无效 remount，polling effect 继续按 run id refresh。
6. **性能稳定性**：保持产品阈值 `complex p95 <= 150 ms` 不变；anti-tag page 使用按文件排序索引的 correlated `NOT EXISTS` 并对相同 query warm-up 后计时。1M File Library complex p95 的最终本机重复值为 `112.980 ms`、`62.221 ms`，均通过；deferred exact count 单独观测，不与复杂首屏门槛混淆。

## 数据边界与安全不变量

Schema 仍为 `33 → 34` additive migration，没有 schema 35。Artifact 绑定 file/root/size/mtime/source hash/extractor/policy/provider provenance；raw text 默认不保留，retention 仍受 bounded policy 控制。Delete/Purge 只删除 artifact、FTS、run/item projection，不删除或移动源文件。Provider payload 只包含 bounded extracted content 和固定 JSON schema，不发送 path、filename、secret、tool/script、Rule/Plan/operation 内容。

## 最终本机验证（Windows，2026-08-01）

- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --features desktop-runtime --no-fail-fast -- --test-threads=1`：退出码 0；lib **562 passed, 0 failed, 9 ignored**，各 integration targets（AI provider 29、classification 1、dedupe 12、FTS 1、global 3、migration 5、settings 12、storage 61）均通过，性能/平台专用 ignored tests 未被伪造为本机通过。
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`：通过；`cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`：通过。
- `npm.cmd run typecheck`：通过；`npm.cmd test`：**79 files / 536 tests passed**；`npm.cmd run test:remediation`：**13 passed**。
- `npm.cmd run test:performance`：完整性能脚本通过，包含 FTS、100K/1M File Library、迁移/WAL、Task 02–07 基准和 architecture guards。1M query matrix 另重复执行两次，complex p95 `112.980 ms`、`62.221 ms`，没有修改 150 ms 门槛。
- `npm.cmd audit --audit-level=high`：**0 vulnerabilities**；`cargo audit --file src-tauri/Cargo.lock`：exit 0，**15 个既有 allowed unmaintained/unsound warnings**，无阻断漏洞。
- `npm.cmd run build`：Windows release + NSIS 成功。`F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`：**7,123,753 bytes**，SHA-256 `11A62994199C174A0BBE1B9D41BEAEA4D882FAC98CD72E3781C81FC80D08A8C4`；Task 08 历史基线 **7,039,064 bytes**，delta **+84,689 bytes (+1.20%)**。
- `git diff --check`：通过。GitHub macOS Rust/release/unsigned DMG 只接受 final-head CI，不在 Windows 上伪造。

## CI 证据与旧失败的准确解释

- 同一旧 HEAD `9d867f2aca7f860813201f16749255ec3c4b61cb` 的 PR workflow run [30662443445](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30662443445) 的 Performance job 失败原因是 **complex-query p95 `161.113 ms > 150 ms`**；不是 deferred probe，也不是可忽略的“deferred probe”失败。随后同 SHA 的 full run [30662447474](https://github.com/ArdenZC/Zen-Canvas/actions/runs/30662447474) 成功，但本轮仍以稳定 benchmark 和新 final-head full matrix 为准。
- 本轮代码 final-head full-validation CI：**待推送后记录**（应包含 Windows/macOS Rust、1M/full performance、Windows/macOS release compile、NSIS、unsigned DMG、dependency/RustSec、frontend 和 quality gates）。
- 文档最终提交后的 branch tip 和对应 CI run 会在本节补齐；不得把旧 HEAD run 当作本轮 final HEAD 证据。

## 交付状态

PR #44 保持 Draft、不开启 auto-merge、不发布；推送成功并记录 final-head CI 后停止，等待第三轮人工验收。
