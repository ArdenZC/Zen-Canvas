# Issue #366：macOS Hosted managed-scan admission 超时调查

**调查结论：SQLite 等待机制和时间线已有直接证据；5 秒设置与约 9 秒墙钟差值的精确 OS 级分解仍未验证；没有证据支持测试层修复。**

- 起始 `origin/master`：`58062c5c356969f332f19c7458028bf2e097595e`
- 诊断代码头：`3c96555aa9046665451985f14e3e9df9ce6096be`
- 分支：`investigate/issue-366-macos-managed-scan-busy-timeout`
- Draft PR：[ #367 ](https://github.com/ArdenZC/Zen-Canvas/pull/367)
- Issue：[ #366 ](https://github.com/ArdenZC/Zen-Canvas/issues/366)
- Owner 授权：[Issue comment 6100291859](https://github.com/ArdenZC/Zen-Canvas/issues/366#issuecomment-6100291859)

PR #367 和 Issue #366 保持 OPEN；PR 保持 Draft。本调查没有修改生产 SQLite 行为、timeout、scan admission、scheduler、Schema、IPC、Global Search 或其他 track，也没有运行 Codex Review、500k/1m benchmark 或 Full Validation。

## 1. 范围与证据等级

目标测试是：

`db::queries::scan::tests::managed_scan_admission_fails_closed_after_busy_timeout_without_partial_authority`

本报告区分三类证据：

1. **历史失败记录**：原始 macOS job 在无阶段日志时超出 10 秒 channel receive deadline；这些失败保持原样，没有被后续成功覆盖。
2. **本轮 Hosted 实测**：精确头 `3c96555…` 在 macOS arm64 Hosted 上执行了目标测试，获得 method、SQLite transaction、线程 CPU、send/receive 的共同时间线。
3. **源码可证实机制**：仓库锁定的 rusqlite 和 bundled SQLite 源码说明 timeout 是按累计请求 sleep 时长工作，而不是严格的 monotonic 墙钟截止时间。该源码机制不能单独证明 Hosted 内核每次 sleep 的实际时长。

## 2. 实际代码路径

在基线 master `58062c5c356969f332f19c7458028bf2e097595e` 中：

- [`src-tauri/src/db/connection.rs`](../../../src-tauri/src/db/connection.rs) 的 `configure_connection` 对每个 SQLite 连接调用 `conn.busy_timeout(Duration::from_secs(5))`；连接池是 r2d2 SQLite pool。
- [`src-tauri/src/db/queries/scan.rs`](../../../src-tauri/src/db/queries/scan.rs) 的 `Database::admit_managed_scan` 先解析 roots、计算 canonical request hash、取得池连接，再开始立即事务。该同步 admission 路径不调用 `WorkScheduler`。
- `begin_managed_scan_write_transaction!` 调用 `transaction_with_behavior(TransactionBehavior::Immediate)`。
- 锁定的 `rusqlite 0.39.0` 在 `Transaction::new_unchecked` 中把 `Immediate` 映射为一条 `BEGIN IMMEDIATE`，经 `conn.execute_batch(query)` 执行。此 admission 路径没有应用层循环或重试。
- 测试中的 `HeldManagedScanWriter` 使用一个池连接持有真实 `BEGIN IMMEDIATE`，正常通过路径在读出 root/session/run authority 计数后释放并 join writer，再 join contender。holder 另有 20 秒安全释放。
- 测试对 contender 结果 channel 保持原有 10 秒 receive deadline；检测到 timeout 时仍失败，先释放 writer，再仅额外等待 3 秒以记录 contender 后续结果，不把超时转换为成功。
- `scripts/performanceManifest.mjs` 将该 ignored 测试列为 `workspace_foundation_sqlite_admission_timeout`；macOS Native Performance job 使用精确测试名执行它。

## 3. 历史 Hosted 时间线

| CI run / job | 真实结果 | 证据边界 |
|---|---|---|
| [38026682784](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38026682784)，job [114138992324](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38026682784/job/114138992324) | D2 在约 10.16 秒以 `timed out waiting on channel` 失败。 | 未记录 pool、BEGIN、SQLite 错误码或发送阶段。日志 SHA-256：`c8ee58d00da4d3a8c34910210b65d322322c65f42075c68163b9c0cbef9823e9`。 |
| [38056013797](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38056013797)，job [114224702884](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38056013797/job/114224702884) | D2 返回 plain `SQLITE_BUSY 5/5`，耗时 9,219ms，无部分 authority，测试通过。 | 证明受控 writer contention 可以返回真实 BUSY；不能解释两个失败。日志 SHA-256：`105a4d825a294620db1916dfba58a18c8e52a584527d31867b8e55756f242180`。 |
| [38064775222](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38064775222)，master job [114250183816](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38064775222/job/114250183816) | D2 在约 10.21 秒以相同 channel timeout 失败；master run 失败。 | 无阶段标记，不能反推 timeout 瞬间 contender 在哪一段。日志 SHA-256：`bee0ca31c6d550e7e913282e60b06e97b3f29910d1ec7115cbc51c06a27014b4`。 |
| [38068879734](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734)，Native job [114262149859](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734/job/114262149859)，attempt 1 | pool 0ms、busy timeout 5000ms；D2 返回 `BUSY 5/5`，8,807ms，无部分 authority。 | 首个阶段化 Hosted 样本；仍未测线程 CPU。日志 SHA-256：`bfba60e956ef8b6ecd29cb98c8a8e6690356dd177f9aea6b31ca83800a80f910`。 |
| 同一 run attempt 2，job [114264864189](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38068879734/job/114264864189) | pool 0ms；D2 `BUSY 5/5`，9,751ms，无部分 authority，距 10 秒 deadline 仅 249ms。 | 真实成功记录，不是失败，也不覆盖历史失败。日志 SHA-256：`9f06e5e51e34800ccf7a56b9e9268c274f54e39d4e5f402844dd14b8651c3bd1`。 |
| [38070488344](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38070488344)，Native job [114266812181](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38070488344/job/114266812181) | 精确当时 PR 头 `e7b8b4c…`：pool 0ms，`BUSY 5/5`，9,050ms，无部分 authority。 | 成功没有解释原失败的完整根因。日志 SHA-256：`159db331121e9b16f333fcb1472900a8f3da0cb292b52eb82c8e74ac4fdb0852`。 |

## 4. 本轮精确阶段观测

首个诊断构建 CI [38073102567](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38073102567) 在 Native job 启动前失败：`wait_until_held() -> Instant` 的表达式仍以分号结尾，Rust 报 `expected Instant, found ()`。这是本次诊断代码的编译错误，不是 SQLite 失败。删除该分号后，Windows 与 macOS release compile 均通过。这个失败已保留，未 rerun 掩盖。

修正后的 exact-head CI [38073369114](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38073369114)，macOS Native job [114275927570](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38073369114/job/114275927570)，使用 synthetic request key `issue366-admission-timeout-01a12701-1b4c-7f92-97b9-47842e77b83a`，原始日志 SHA-256：`98dc2e7cb341c24d2b3d41b28c047781ca75e137c7451ac0e40eaad2b10b5dcf`。

所有时间来自同一 monotonic test origin；微秒数据按原始日志记录：

| 阶段 | elapsed / wall | 说明 |
|---|---:|---|
| writer 的 `BEGIN IMMEDIATE` 成功，barrier 可用 | test origin +73,398µs | 写锁已真实持有。 |
| contender 发 start signal | +73,671µs | `send_ok=true`。 |
| admission call 开始 | +73,764µs | signal 后 93µs。 |
| `admit_managed_scan` 方法进入 | +73,782µs | call 后 18µs。 |
| root 解析 / request hash | 118µs / 98µs | 不是主要耗时。 |
| pool connection | 40µs wall、40,917ns thread CPU | `PRAGMA busy_timeout=5000`；排除池等待消耗数秒。 |
| `BEGIN IMMEDIATE` 调用边界 | +74,196µs | admission method 总计约 403µs 后进入。 |
| 10 秒 channel receive 开始 | +74,267µs | 本次样本比事务调用边界晚约 71µs；总比 method call 晚约 503µs。 |
| `transaction_with_behavior` 返回 | +9,222,331µs | `begin_wall_us=9,148,114`；线程 CPU `2,318,417ns`；plain `SQLITE_BUSY` primary/extended `5/5`。 |
| `admit_managed_scan` 返回 | +9,222,781µs | 整个 admission call wall `9,149,017µs`，thread CPU `3,212,208ns`。 |
| result send 返回 | +9,223,055µs | send 自身 wall `120µs`。 |
| 主线程收到结果 | +9,223,094µs | channel wait `9,148,826µs`；send-start 至 receive `159µs`。 |
| 测试最终结果 | `elapsed_ms=9149`，通过 | `partial_authority=false`；plain `BUSY 5/5`；writer 与 contender 均按正常路径清理/join。 |

本次 BEGIN 的线程 CPU 约占 BEGIN 墙钟的 **0.025%**。这证明时间主要消耗在 SQLite 调用内部的非 CPU 等待；它不区分线程处于 `nanosleep`、内核 sleep overshoot 还是 runner 未及时调度。SQLite 返回到 admission return 约 450µs；result send/receive 又不到 0.3ms。因此结果 channel 交付没有吞掉数秒，也没有在 SQLite 返回后等待调度的证据。

本样本在 10 秒 channel deadline 前约 851ms 返回；先前 9,751ms 样本仅余 249ms。历史失败日志没有这些 marker，不能证明其失败时也已经进入 SQLite 或已经返回 BUSY。

## 5. SQLite busy timeout 源码核对

依赖锁定为 `rusqlite 0.39.0` 与 `libsqlite3-sys 0.37.0`，项目启用 bundled SQLite。代码证据在 Cargo registry 对应锁定源码：

- `rusqlite-0.39.0/src/transaction.rs::Transaction::new_unchecked`：`Immediate => "BEGIN IMMEDIATE"`，随后执行单条 SQL。
- `libsqlite3-sys-0.37.0/sqlite3/sqlite3.c::sqliteDefaultBusyCallback`（约 186623 行）：按 `delays[]`/`totals[]` 累积请求 sleep 时长，达到 `busyTimeout` 后停止继续重试。
- 同一 amalgamation 的 `sqlite3_busy_timeout` 文档说明 handler 会多次 sleep，直到**累计睡眠至少达到给定毫秒数**。这个描述不是严格墙钟截止时间。
- `unixSleep`（约 46348 行）在 `nanosleep` 分支调用 `nanosleep(&sp, NULL)`，随后返回请求的 `microseconds`；它不测量并返回实际经过的 monotonic 墙钟时间。`libsqlite3-sys` build 脚本设置 `HAVE_USLEEP`，没有设置 `HAVE_NANOSLEEP=0`；macOS 构建走默认 nanosleep 分支。
- 代码里没有证据显示 application 在这次 admission 周围重启多个独立 5 秒 timeout；观察到的延迟位于单条 `BEGIN IMMEDIATE` 调用本身。

源码能解释“5,000ms 是 SQLite 请求 sleep 的累计目标，而不是承诺 5,000ms 后按墙钟返回”。实测的 9.148s BEGIN 中，CPU 只有约 2.3ms，支持额外墙钟时间来自 sleep/wakeup 或调度等待，而不是计算、池等待或 channel handoff。

**仍未实测的部分：**本次没有逐次量取 SQLite 每个 `nanosleep` 的请求时长与实际返回时长，也没有 macOS scheduler trace。因而约 `9.148s - 5.000s = 4.148s` 的额外墙钟，尚不能在内核 sleep overshoot 和 Hosted runner 调度延迟之间精确分摊。将全部差额直接归因于某个 macOS bug 或 GitHub runner 缺陷都超出证据。

## 6. 假设判定

| 候选原因 | 本轮证据 | 结论 |
|---|---|---|
| 连接池等待 | 40µs wall。 | 排除为本次 9 秒延迟来源。 |
| admission 前的 root/hash 工作 | 合计为亚毫秒级；call 到 BEGIN 边界约 0.4ms。 | 排除为主要延迟来源。 |
| WorkScheduler / channel deadlock | admission 路径不调用 WorkScheduler；SQLite 返回后 send/receive 少于 0.3ms。 | 本次成功样本不支持；原始失败无法回溯到具体阶段。 |
| SQLite 内部锁等待 | `BEGIN IMMEDIATE` wall 9.148s，返回真实 `BUSY 5/5`。 | 本次近 10 秒耗时直接位于 SQLite transaction call 内。 |
| 5 秒配置被多次 application retry | 源码路径只有一次 Immediate transaction call，没有应用层重试。 | 未发现多次独立 5 秒预算；SQLite 内部会重复调用 busy callback。 |
| OS sleep / 调度 | BEGIN CPU 2.318ms 对比 9.148s wall。 | 强烈支持非 CPU 等待，但尚未区分实际 sleep 超时和 runner 调度。 |
| send/receive 竞态 | send wall 120µs、send-start 至 receive 159µs；receiver deadline 本样本在 BEGIN 边界之后启动。 | 本次没有交付延迟或提前启动 watchdog 的证据。历史失败无法回溯。 |
| 部分 authority / 生产 fail-closed 错误 | D2 返回 plain BUSY，root/session/run 计数均为 0。 | 本次无部分授权证据；不是所有可能生产时序的证明。 |

## 7. 是否存在可以证明的测试层缺陷

本轮唯一重现的失败是诊断补丁自身的编译错误，已通过一行返回类型修正解决。它不是原始 10 秒 timeout 的原因。

诊断样本显示，实际 BEGIN 已运行约 9.148 秒后成功返回 BUSY，结果 send/receive 延迟仅微秒级。没有发现测试把 pool 等待、hash、或结果交付时间误算成数秒。当前测试在达到 10 秒 watchdog 时仍会 fail，保留真实超时信号；将 watchdog 增至 10 秒以上、忽略失败或放宽门槛都会掩盖该边界，不符合 Owner 合同。

因此没有实施测试语义修复，也没有新增 forced-slow regression：只有在确认 harness 缺陷并改变 harness 后，forced scenario 才能验证该修复；当前证据没有支持此类改动。生产 busy timeout 仍为 5 秒，result channel deadline 仍为 10 秒，writer safety release 仍为 20 秒。没有更换 busy handler、重试、skip 或取消 Gate。

## 8. 改动范围

本 PR 现有修改仅包括：

- `scan.rs` 的 `#[cfg(all(test, feature = "performance-test-tauri"))]`、synthetic `issue366-` 限定阶段日志：method/root/hash/pool/BEGIN entry-return、SQLite primary/extended error、macOS thread CPU。
- D2 测试的 writer barrier、start signal、channel wait、admission call、send/receive 与 timeout cleanup 诊断时间戳；保留测试的 5s/10s/20s 语义和所有 fail-closed assertions。
- Native macOS performance 源文件路由与合同测试，确保 `scan.rs` 变更会选中已存在 Native job。
- 本中文调查报告。

未改 release-mode SQLite/scheduler/admission 行为、Schema、IPC、搜索或 AI。

## 9. 本地检查与 exact-head CI

本地 Codex Cloud 执行：

- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`：通过。
- `npm run test:governance`：通过。
- `node scripts/checkPerformanceArchitecture.mjs`：通过，3 个文件、30 个测试。
- 本机 Linux 不能执行目标 Tauri test：`glib-2.0 >= 2.70` 开发包缺失，且环境此前拒绝 apt 索引写入。这个结果不作为 macOS/Windows 性能证据；Hosted macOS 实测和 Windows/macOS release compile 提供跨平台编译覆盖。

CI：

- [38073102567](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38073102567)：诊断补丁编译错误；Native macOS 被取消/未执行。保留失败。
- [38073369114](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38073369114)：Native macOS job `114275927570` 成功运行 D2；Windows/macOS release compile、Windows Global Index service qualification、Frontend/format、六个 scoped 100k shards、Performance profile 均通过。
- 同一 run 的 Windows Rust Quality job `114275286600` 有一个无关测试失败：`file_workspace::change::tests::change_arriving_during_refresh_supersedes_page_and_is_not_lost` 在 `src/file_workspace/change.rs:590` 创建 fixture root 时返回 Windows `Access is denied`。本调查未修改或重跑该用例；run 的 Windows Quality aggregate 因此失败。
- 报告编写时，该 run 的 `Rust quality (macos-latest) (merge_integration)` job `114275927656` 仍为 queued，终态 **NOT VERIFIED**；不据此声称完整 CI aggregate 成功。
- 该 CI 使用 `extended` profile，未启用 Full Validation；Native job 中 10k mixed-filesystem classifier、100k macOS bookkeeping 以及 Workspace Foundation suite（含 D2）均通过。没有执行 500k 或 1m。
- Codex Review：未运行。PR 仍 Draft。

## 10. 未验证事项与 Owner 验收

- 历史失败 `38026682784` 与 `38064775222` 没有原始阶段数据；无法判定其 timeout 瞬间是尚在 BEGIN、刚从 SQLite 返回还是 contender 尚未调度。
- 本次 9.148s 样本确认主要墙钟时间在 SQLite 调用中，不能给出每次 nanosleep 的实际返回时间，也没有 macOS scheduler trace；额外约 4.148s 的来源仍是 OS sleep/wakeup 与 runner 调度之间的未验证差额。
- 新的原始超时没有在本轮重现，单次通过不覆盖历史失败。Owner 授权最多两次 targeted macOS 观测；当前进行了一次有效阶段化观测。由于尚无可以证明的 harness 修复，没有为追求额外通过率重复跑第二次。
- Windows 本机验收、实际用户负载和 production SQLite 行为没有在本任务范围内修改或声称已验证。

**建议 Owner 决策：**保留该 test 和 10 秒失败边界；如需继续精确分解额外墙钟，另行授权 macOS Hosted syscall/scheduler 级采样。当前证据不足以安全地作测试层修复，也未证明 production SQLite policy 应变更。

## 当前状态

**#366 NOT QUALIFIED — OS sleep/wakeup 与 Hosted 调度导致的约 4.15 秒额外墙钟尚未被逐次测量；未证明可安全修复的测试层缺陷。** 失败记录保留；PR #367 OPEN/Draft，Issue #366 OPEN，不合并、不标记 Ready。
