# PR #18 评审报告

> 评审依据：`docs/remediation/BRIEF.md` 第 2 节（阶段 A）。
> 事实来源：仓库代码实测。所有断言均附 `文件路径:行号`。
> 本报告未合并、未关闭、未 force-push PR #18，也未在其分支上新增提交。

---

## 0. 评审元数据

| 项 | 值 |
|---|---|
| PR | [#18 `feat: add durable File Library scan generations`](https://github.com/ArdenZC/Zen-Canvas/pull/18) |
| 状态 | OPEN / Draft / MERGEABLE |
| head | `remediation/01a-scan-generation-foundation` @ `c259fa7c1afbb3a69c1a00ed4affa01fcc507673` |
| base | `master` @ `3b3d7b8178368058b15eddf026bf0cdbf01e9b34` |
| 规模 | 30 文件，+6655 / −472 |
| 提交数 | 9（8 个原子提交 + 1 个 review blocker 修复） |
| 评审基线 SHA | master `3b3d7b8178368058b15eddf026bf0cdbf01e9b34` |

**结论：修正后继续。** 架构与并发安全性质量很高，但默认构建配置下把一次成功的扫描表达为失败终态，导致四条用户可见的功能回退，且这条默认路径无任何测试覆盖。详见第 4、5 节。

---

## 1. PR 意图（仅依据 PR 描述与 diff）

实现 `TASK_01A_FILE_LIBRARY_SCAN_GENERATION_FOUNDATION.md`：把 File Library 扫描从"进程内一次性作业"升级为 schema 27 的持久扫描账本。

PR 描述自述的交付项：durable root lease、generation/session/run revision、`scan_seen` coverage 安全、崩溃恢复、多 root 映射、stale gate、legacy command/event 兼容、renderer hydration、at-least-once dedupe dispatch intent。

自述的边界：不改 Global Index 生产代码、不改 Managed AI、不改 `files.id` 迁移、不持久化 watcher 原始事件、不改 dedupe 实现、不新增依赖。

**diff 核对结果：以上边界声明全部属实。** diff 未触及 `file_ops.rs`、`storage_analyzer.rs`、`dedupe.rs`、`global_index/`（生产代码）、`credentials`、`managed_ai`。

---

## 2. 与 master 既有不变量的核对

Brief 第 2.2 节要求逐项核对的不变量：

| 不变量 | 核对结论 | 证据 |
|---|---|---|
| 受保护路径与清理白名单 | **无回退**。`path_filter.rs` 仅把内联数组提取为 `const` 并新增两个只读 getter，名单内容逐项一致，行为等价 | `src-tauri/src/path_filter.rs:11-62` |
| 操作 / 恢复 / Safe Trash journal 及启动对账 | **未修改**。`main.rs` 仅在既有 journal 对账**之前**插入 `recover_scan_state`，两个既有对账调用顺序与实现不变 | `src-tauri/src/main.rs:34-38` |
| 任务身份、取消与重入 | **强化**。admission 在 `BEGIN IMMEDIATE` 内完成规范化→冲突检查→分配 generation→写 lease，全程 CAS；同 root 的 exact/ancestor/descendant 重叠一律拒绝，不做部分分配 | `scan.rs:250`、`scan.rs:275-305`、`scan.rs:388-409` |
| IPC 与规则运行时校验 | **合规**。8 个新命令中 3 个 mutation 命令均调用 `require_main_window`；5 个 read_only 命令按既有约定不校验窗口。`build.rs` allowlist、`main.rs` handler 注册、权限矩阵文档三方一致 | `scanner.rs:196,295,318`；`build.rs:55-62`；`main.rs:150-157`；`docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md:60-67` |
| 分页与虚拟化的数据源 | 不涉及，本 PR 未触及列表数据源 | — |
| 密钥的系统凭据库存储 | 不涉及，diff 无相关文件 | — |
| 扫描只建索引和建议、不执行删除 | **保持**。`reconcile_missing` 只写 `files.is_stale = 1`，不做任何文件系统写入 | `scan.rs:783-803` |
| 启动不自动扫描 | **保持**（扫描本身）。但见第 5.3 节：启动时会同步重放待处理的 dedupe 派发 | `main.rs:48-56` |

---

## 3. 做得好的部分（建议保留）

1. **admission 事务不变量完整**。`BEGIN IMMEDIATE` + request_key 幂等 + canonical hash 一致性校验 + 全 effective root 冲突检查 + lease CAS，任一失败整体回滚，不产生部分 generation。`scan.rs:236-427`
2. **stale 的多重护栏是正确的保守设计**。coverage 有错即禁止 stale（`scan.rs:752-756`）；UPDATE 同时要求 `last_seen_at < started_at` 并发护栏、root 边界、`NOT EXISTS scan_seen`、ignored subtree 排除（`scan.rs:783-803`）；run CAS 失败则整体回滚（`scan.rs:805-821`）。
3. **`scan_seen` 只记录成功的 metadata 观测**，metadata 错误只进 `scan_run_errors`，不会把"读不到"误判为"已删除"。`scan.rs:1793-1897`
4. **ignored subtree 的 SQL 合约从 `path_filter` 单一来源派生**，消除了 stale 专用的手写目录名单漂移风险。`scan.rs:1912-1946`、`path_filter.rs:11-62`
5. **迁移安全**。schema 26→27 只建新表，不 ALTER/重建 `files`；不为旧数据伪造成功 generation；backfill 以 `needs_reconciliation=1` 写入；重复迁移幂等。`db/schema.rs:683-687,702-990`
6. **权限矩阵三方一致**，新增命令全部登记。

---

## 4. Blocker：默认构建下成功扫描被表达为失败

### 4.1 根因

stale reconciliation 由环境变量 `ZEN_CANVAS_SCAN_STALE_RECONCILIATION` 控制，**默认关闭**，且仓库内没有任何位置设置该变量（全仓库仅一处引用，即定义处）：

- `src-tauri/src/scanner.rs:1454-1463` — `unwrap_or(false)`
- `src-tauri/src/scanner.rs:1477-1479` — `should_run_stale_cleanup`

gate 关闭时，扫描走这条分支并**直接 return**：

- `src-tauri/src/scanner.rs:817-844` — 终态写为 `requires_reconciliation`，error_code `stale_reconciliation_disabled`，error_message `"The scan completed discovery, but stale reconciliation is disabled by rollout policy."`

也就是说：**在任何未手工设置环境变量的构建里（含正式发布包），每一次正常、完整、无错误的扫描，最终状态都是 `requires_reconciliation`。** 这一点被 PR 自己的测试固化：`scanner.rs:1566-1568` 断言 gate 默认关闭，`scanner.rs:1640-1682` 断言默认路径的 error_code 就是 `stale_reconciliation_disabled`。

保守地不推进 `last_successful_generation`、不标记 stale，方向是对的。问题在于**它复用了"失败"语义的终态名，而上下游全部把该终态当失败处理**。

### 4.1b 补充核实（2026-07-26，裁决 1 前提核实时发现）：gate 关闭不是"保持现状"，而是移除了 master 已有的能力

> **状态注记**：本节的核实结论曾引发「M1–M6 暂停」。**该暂停已被裁决 5（`00-overview.md` 决策日志 D5）吸收并解除**，M1–M6 已实施完毕（PR #19）。阅读本节时请以 `00-overview.md` 第 8 节决策日志为准，不要据此再次暂停。

初次评审把 gate 关闭描述为"新能力未启用"。**这个描述不准确，实际情况更严重。**

master 上同名函数**没有环境变量条件**，只要扫描未被取消就一定执行 stale 清理：

```rust
// master:src-tauri/src/scanner.rs:634-636
fn should_run_stale_cleanup(cancelled: bool) -> bool {
    !cancelled
}
```

```rust
// master:src-tauri/src/scanner.rs:345-347
if should_run_stale_cleanup(cancelled) {
    db.mark_missing_files_stale_after_scan(&root_label, scan_started_at)?;
}
```

PR #18 保留了同名同签名的函数，但加上了默认 `false` 的开关（`scanner.rs:1477-1479`），并把执行体换成了新的 `reconcile_missing`。结果：

1. **master 每次扫描都执行的 stale 清理，在 PR #18 的默认构建中完全不再执行。**
2. `mark_missing_files_stale_after_scan` 在 PR 分支上**已无任何生产调用方**，只剩定义（`db/queries/files.rs:182`）与单元测试（`db/tests/part1.rs:1314,1356`）。因为它是 `pub` 方法，编译器与 clippy 都不会报 dead code——回退是静默的。

**数据正确性后果**：用户删除文件后，索引行仍保持 `is_stale = 0`，会继续被当作存在的文件参与文件库列表、AI 分类候选、重复检测候选与全局搜索（消费点见 `db/queries/files.rs:642,751,800,884,914,1050`、`ai/classification.rs:560`、`dedupe.rs:489,515,585`、`global_index/repository.rs:442,481`）。索引会单调累积"幽灵文件"，且没有任何其他路径回收它们（`remove_files_by_paths` 只处理 watcher 事件，`db/queries/files.rs:136-180`）。

**这项发现直接影响 M1 的实施方式**：若按"gate 关闭 → 终态 `completed` + `last_successful_generation` 正常推进"实施，等于在索引确实已经陈旧的情况下声明"扫描成功、索引是最新的"。这与裁决 1"不伪造证据"的原则同向冲突——只是伪造的方向从"恒为真的告警"变成了"恒为真的健康"。

**另一项发现**：新的 `reconcile_missing` 在安全性上**严格优于** master 版本，因此"默认开启"比"默认关闭"更安全：

| 维度 | master `mark_missing_files_stale_after_scan` | PR `reconcile_missing` |
|---|---|---|
| coverage 校验 | **无**——metadata 读取失败时照样把读不到的文件标为 stale | 要求 `coverage_error_count == 0`，否则直接拒绝（`scan.rs:752-756`） |
| 判定依据 | 仅 `last_seen_at < scan_started_at` + root 路径前缀（`files.rs:199-208`） | 上述条件 **加** `NOT EXISTS scan_seen` 的精确成功观测（`scan.rs:794-798`） |
| 忽略目录 | **无**——被 walker 跳过的目录下的文件会被误判为已删除 | 从 `path_filter` 单一来源派生 ignored subtree 排除（`scan.rs:764-773`） |
| 并发护栏 | **无** | run / root / session revision + lease token CAS（`scan.rs:744-751,805-821`） |

即 master 版存在"读不到 = 当作已删除"的误判风险，PR 版正好修掉了它。

### 4.2 后果 A：前台扫描 UI 显示为错误，且文件库不刷新（用户可见）

`src/store/useScanManagerStore.ts:135` 把 `requires_reconciliation` 映射为 `"error"`。前台扫描走 managed 路径（`useScanManagerStore.ts:528`），终态处理在 `useScanManagerStore.ts:546-568`：

- `:552,554` — `scanState.status` 置为 `"error"`；
- `:566-567` — 弹出错误提示，内容为上述英文 rollout 文案；
- `:547-550` — `completedScanRoots` 只接受 `completed / completed_with_warnings / covered / duplicate / nested`，`requires_reconciliation` 不在其中，因此 **`:558-561` 的 `setCurrentScanScope` 与 `useFileLibraryStore.refresh()` 完全不执行**。

净效果：扫描确实把文件写进了库，但界面停在错误状态、不切换扫描范围、不刷新列表。**从用户视角等价于"扫描失败"。**

### 4.3 后果 B：后台索引每个 root 都抛错

`src/store/useBackgroundIndexerStore.ts:157-162`：

```ts
if (!["completed", "completed_with_warnings"].includes(session.status)) {
  throw new Error(session.errorMessage ?? `Background scan ended in ${session.status}.`);
}
```

默认路径 `session.status === "requires_reconciliation"` → 每个后台索引 root 均抛错 → `markRecentlyIndexedRoot(root)`（`:165`）不执行，该 root 不会被记为已索引。

### 4.4 后果 C：扫描后的重复检测永不派发

`src-tauri/src/db/queries/scan.rs:1695-1702` 要求 session 终态为 `completed / completed_with_warnings` 才置 `dedupe_pending`；`scanner.rs:900-902` 只在 `dedupe_pending` 为真时派发。

master 的行为是：非取消扫描完成后，`run_dedupe`（legacy 默认 `true`，见 `scanner.rs:403`）为真即调度 `spawn_duplicate_detection`（master `scanner.rs:368-386`）。后台索引器也显式传 `dedupe: true`（`useBackgroundIndexerStore.ts:153`）。

净效果：**默认配置下扫描后自动查重能力静默失效。**

### 4.5 后果 D：FTS 索引 optimize 在默认路径不再执行

master 在扫描完成路径执行 `run_search_index_optimize("scan_complete", &db)`（master `scanner.rs:363-366`）。

新代码把这一步放在 gate 开启分支之后（`scanner.rs:845-855`），而 gate 关闭分支在 `scanner.rs:843` 直接 `return`。净效果：**默认配置下扫描后不再优化搜索索引**，长期影响全局搜索性能。

### 4.6 后果 E（影响有限）：legacy 命令返回错误

`scan_directory` 结尾用 `legacy_summary_or_error` 映射返回值（`scanner.rs:453`），该函数只接受 `completed / completed_with_warnings / cancelled`，否则返回 `Err`（`scanner.rs:1330-1340`）；`emit_terminal_events` 同理会发 `scan-error` 而非 `scan-complete`（`scanner.rs:1122-1143`）。

**实际影响有限**：`tauriApi.startScan`（`src/api/tauriApi.ts:382-389`）在本 PR 后已无生产调用方——后台索引器已改用 managed 命令。因此这是兼容适配层的潜在缺陷，不是当前用户可见回退。但它与 4.2–4.5 同源，修正根因即可一并消除。

### 4.7 为什么 478 个前端测试全绿却没发现

前端测试只 mock 了 `completed` 终态：`tests/backgroundIndexerRuntime.test.ts:72,100-101`（`managedStart(status: "running" | "completed")`）。

全仓库前端代码与测试中，`requires_reconciliation` 只出现 4 处，全部在生产代码的状态映射里，**没有任何测试断言这个默认终态下的行为**（`useScanManagerStore.ts:47,135,196`、`useBackgroundIndexerStore.ts:203`）。

即：**测试覆盖的是不会发生的路径（gate 开启），未覆盖唯一会发生的路径（gate 关闭）。**

---

## 5. 次要问题

### 5.1 后台索引用 mutation 命令做轮询

`src/store/useBackgroundIndexerStore.ts:199-208` 的 `waitForManagedBackgroundSession` 每 250ms 调用一次 `tauriApi.startManagedScan(request)` 来获取会话快照。

三个问题：
1. `start_managed_scan` 在权限矩阵中是 `main_state_mutation`（`docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md:60`），并且每次调用都开启 `BEGIN IMMEDIATE` 写事务（`scan.rs:250`），会与 scanner 的批量写入争抢 SQLite 写锁。正确做法是用只读的 `get_managed_scan_snapshot`（`scanner.rs:242-251`）。
2. 循环内不检查 `runGeneration !== backgroundGeneration`，取消语义只能依赖后端终态传播。
3. 固定 250ms 无退避、无超时上限。

### 5.2 stale 对账 SQL 的规模

`ignored_subtree_like_patterns` 为每个 root 生成 352 个 LIKE 模式（32 个目录名 × 8 + 4 个变体基名 × 3 标记 × 8，见 `scan.rs:1912-1946`），全部以 `LOWER(f.path) NOT LIKE LOWER(?) ESCAPE '~'` 拼进一条 `UPDATE files`（`scan.rs:765-773,783-803`），无法走索引。

PR 自测数据：100k 行 `missing_reconcile = 10.5s`（`TASK_01A_IMPLEMENTATION_CLOSEOUT.md:93`）。gate 开启后这会是每次扫描尾部的固定成本。当前 gate 关闭所以未暴露，但在启用 stale 之前需要有更优方案（例如按 root 前缀索引 + 目录名分量匹配，而非全表 LIKE 链）。

### 5.3 启动时同步重放 dedupe 派发

`src-tauri/src/main.rs:48-56` 在 Tauri `setup` 中同步调用 `resume_pending_dedupe_dispatches`，最多重放 1000 个 session（`scanner.rs:497`），每个都会 `spawn_duplicate_detection`。

Brief 安全边界第 1 条是"启动不自动扫描"。dedupe 不是扫描，且 PR 已在 closeout 第 7 节声明这是 at-least-once 语义，但这仍意味着：**应用启动时可能自动开始一批 BLAKE3 全量哈希计算**。建议明确该行为是否符合产品意图，并考虑延迟到主窗口就绪后异步执行，避免拖慢冷启动。

（当前 gate 关闭时 session 永远到不了 `completed`，`dedupe_dispatch_state` 也就永远不会变成 `pending`，所以此路径在默认配置下实际不会有候选——修正第 4 节问题后才会真正生效。）

### 5.4 Windows 大小写与 UNIQUE 约束

`scan_roots.normalized_path` 的 UNIQUE 约束是大小写敏感的（`db/schema.rs:704`），而 root 身份判定在 Windows 上按 `to_ascii_lowercase` 处理（`scan.rs:2359-2365`）。查找路径已经用 `lower()` 兜住了（`scan.rs:1966-1982`、`db/schema.rs:930-945`），当前实现自洽。但这是隐式约定：**任何未来绕过 `ensure_scan_root_tx` 直接 INSERT 的代码，都可能为同一物理目录建出两行 `scan_roots`，从而绕过"一个 root 一个 active run"的唯一索引**（`db/schema.rs:788-790`）。建议在 Windows 上直接对 `lower(normalized_path)` 建唯一索引，把约定变成约束。

### 5.5 `backfill_scan_roots_from_settings` 在每次打开数据库时都会执行

它不只是一次性迁移动作：`db/schema.rs:44-51` 的"版本已是最新"快速路径同样调用它，即**每次 `Database::open` 都会执行一次**。

三个后果：
1. **每次打开数据库都产生写事务**。对 settings 里已存在的每个 root 执行 `UPDATE scan_roots SET display_name = ?, enabled = ?, updated_at = ?`（`db/schema.rs:963-967`），并刷新 `updated_at`，进而扰动 `idx_scan_roots_enabled_health` 上 `updated_at DESC` 的排序含义。
2. **`scan_roots.enabled` 被 settings 单向覆盖**。当前 `enabled` 字段的唯一写入方就是这里（其余三处 `UPDATE scan_roots` 分别只改 lease/health/generation，见 `scan.rs:567,1083,1584`），所以暂无冲突；但这条隐式耦合意味着未来任何"在扫描根管理界面直接启停某个 root"的功能，都会在下次启动时被 settings 静默覆盖。
3. **只增不删**。从 settings 中移除的 root 不会被清理，`scan_roots` 会无限累积历史行。

建议：把 backfill 限制在真实的 26→27 迁移分支内，并为"settings 与 scan_roots 的同步方向"写出显式契约。

---

## 6. 测试影响

### 6.1 前端（在 PR head `c259fa7` 实测）

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过（exit 0） |
| `npm test` | **68 文件 / 478 测试全部通过**（exit 0） |

PR 新增/修改了 5 个前端测试文件（`tests/scanManager.test.ts` +78、`tests/listenerRegistration.test.ts` +154、`tests/libraryScope.test.ts` +100、`tests/backgroundIndexerRuntime.test.ts` +100、`tests/backgroundIndexer.test.ts` +3）。

**缺口**：见 4.7。默认 rollout 路径（`requires_reconciliation`）零覆盖。

### 6.2 Rust（在 PR head `c259fa7` 实测）

| 运行 | 结果 |
|---|---|
| PR head，`cargo test --lib` 第 1 次 | 419 passed / **1 failed** / 2 ignored |
| PR head，单独重跑失败用例 `-- --exact` | passed |
| PR head，`cargo test --lib` 第 2 次 | **420 passed / 0 failed** / 2 ignored |
| PR head，`cargo test`（完整，含集成测试） | **exit 0；lib 420 + 集成 121 全部通过** |
| master `3b3d7b8`（独立 worktree），`cargo test --lib` | **400 passed / 0 failed** / 1 ignored |

完整套件明细（PR head）：lib 420、`ai_provider` 29、`storage_analyzer` 63、`settings` 12、`dedupe` 5、`migrations` 5、`global_search_hardening` 3、`classification_status` 1、`fts_benchmark` 1（1 ignored）。

失败项：

```
file_ops::tests::target_committed_phase_persistence_failure_records_manual_review_without_rollback
  assertion failed: result.is_err()  (src-tauri/src/file_ops.rs:4365)
```

判定：**并行时序敏感的间歇性失败，非本 PR 的功能缺陷**。依据：
- PR diff 未触及 `src-tauri/src/file_ops.rs`；
- 同一提交上第 2 次完整 lib 运行全绿，单独重跑该用例也通过；
- PR closeout 记录了同一测试组的**另一个**用例出现同类现象（完整套件失败、定向重试通过，`TASK_01A_IMPLEMENTATION_CLOSEOUT.md:78,84`）。

需要注意的限制：master 侧只做了 1 次运行且未复现，因此**不能排除本 PR 新增的 20 个 lib 测试改变了并行调度时序、从而提高了既有竞态的暴露概率**。这属于 `file_ops` 测试组自身的健壮性问题，建议按第 7 节"待用户裁决"第 3 项单独立项，不阻塞本 PR。

### 6.3 未执行的门禁

本轮评审未执行：`npm run test:remediation`、`npm run test:performance`、`npm run build`、`cargo clippy`、`cargo fmt --check`、`npm run verify:security`。PR closeout 声明这些已由实施方执行并通过（`TASK_01A_IMPLEMENTATION_CLOSEOUT.md:73-88`），其中 security 一项 closeout 自述"本轮未重新执行"。

---

## 7. 结论与修正清单

### 结论：**修正后继续**

durable scan ledger 的数据模型、事务不变量、CAS/lease 设计、崩溃恢复和 stale 护栏质量都很高，值得保留并作为 Brief 第 4 节模块 3（扫描与索引）的既有进展。**唯一但致命的问题是默认 rollout 配置下的终态语义。**

### 合并前必须修正（M）

| # | 修正点 | 位置 |
|---|---|---|
| M1 | gate 关闭时的终态改为 `completed_with_warnings`（保留 warning 与 error_code 说明"未执行 stale 对账"），而不是 `requires_reconciliation`。同时保持不推进 `last_successful_generation`、`scan_roots.health_status` 仍标记为需要对账——把"扫描成功"与"索引可能含已删除文件"这两件事分开表达 | `scanner.rs:817-844` |
| M2 | 让 gate 关闭路径继续执行 `optimizing_search` 阶段，恢复 master 的 FTS optimize 行为 | `scanner.rs:817-855` |
| M3 | 确认 M1 后 `dedupe_pending` 恢复为真，扫描后自动查重与 master 一致 | `scan.rs:1695-1702` |
| M4 | 前端补充"成功但需对账"的呈现：不再映射为 `error`，`completedScanRoots` 需包含该终态，从而恢复 `setCurrentScanScope` + 文件库刷新 | `useScanManagerStore.ts:135,547-550,566-567` |
| M5 | 后台索引器接受该终态为成功 | `useBackgroundIndexerStore.ts:157-162` |
| M6 | 补充覆盖默认 gate 关闭路径的前端测试与 Rust 端到端测试：扫描完成 → UI 非 error、文件库刷新、dedupe 派发、optimize 执行 | `tests/scanManager.test.ts`、`tests/backgroundIndexerRuntime.test.ts`、`scanner.rs` 测试模块 |

> M1 的替代方案是保留 `requires_reconciliation` 终态名，改造全部 5 个下游消费点。不推荐：改动面更大、语义更绕，且任何未来新增的消费点都会再次踩同一个坑。

### 建议在本 PR 或紧随其后的 PR 修正（S）

| # | 修正点 | 位置 |
|---|---|---|
| S1 | 轮询改用 `get_managed_scan_snapshot`，并在循环内检查 generation、加超时与退避 | `useBackgroundIndexerStore.ts:199-208` |
| S2 | 明确启动时自动重放 dedupe 是否符合产品边界；建议改为主窗口就绪后异步执行 | `main.rs:48-56` |
| S3 | Windows 上对 `lower(normalized_path)` 建唯一索引，把大小写约定变成约束 | `db/schema.rs:704` |
| S4 | 启用 stale gate 之前重做 `ignored_subtree_like_patterns` 的匹配策略，避免 352 条 LIKE 的全表扫描 | `scan.rs:1912-1946` |
| S5 | 把 `backfill_scan_roots_from_settings` 限制在真实迁移分支，避免每次打开数据库都写库；并明确 settings ↔ `scan_roots` 的同步方向 | `db/schema.rs:44-51,930-990` |

### 待用户裁决

1. **是否接受 M1 的语义方案**（把 gate 关闭的成功扫描表达为 `completed_with_warnings`）。这是修正方向的分叉点。
2. **stale reconciliation 的 rollout 计划**：是继续用环境变量 gate，还是纳入应用设置项。当前形态下正式发布包永远无法启用该能力。
3. `file_ops` 测试组在并行下的不稳定性是否单独立项（不属于本 PR 范围）。

### 若裁决为"继续"

按 Brief 第 2.4 节，本 PR 应登记为 Brief 第 4 节**模块 3「扫描与索引」**的已有进展。该模块的方案文档（`docs/remediation/03-scan-index.md`）必须显式引用本 PR 已建立的 `scan_roots / scan_sessions / scan_runs / scan_session_roots / scan_seen / scan_run_errors` 数据模型与 phase 协议，不得另起炉灶；Brief 第 6 节模块 3 种子问题中的"遍历/入库/清 stale 拆成显式 phase"与"`ScanRoot` 领域对象 + 新表"两问，已由本 PR 部分回答，方案文档需据此收敛为差距分析（重点转向 watcher overflow → degraded → reconciliation 这条尚未实现的链路）。

---

## 8. 证据清单

### Zen Canvas（本仓库，PR head `c259fa7`）

**后端 — 扫描核心**
- `src-tauri/src/scanner.rs:196,295,318,389,469` — mutation 命令的 `require_main_window`
- `src-tauri/src/scanner.rs:242-251` — `get_managed_scan_snapshot` 只读命令
- `src-tauri/src/scanner.rs:375-459` — `scan_directory` legacy 适配器
- `src-tauri/src/scanner.rs:403` — legacy `run_dedupe` 默认 `true`
- `src-tauri/src/scanner.rs:453` — legacy 返回值经 `legacy_summary_or_error`
- `src-tauri/src/scanner.rs:486-490` — `recover_scan_state`
- `src-tauri/src/scanner.rs:492-543` — dedupe 派发恢复
- `src-tauri/src/scanner.rs:615-684` — run 认领与 root 校验
- `src-tauri/src/scanner.rs:788-806` — coverage 错误 → `requires_reconciliation`
- `src-tauri/src/scanner.rs:808-816` — stale gate 分支点
- `src-tauri/src/scanner.rs:817-844` — **gate 关闭分支：终态 `requires_reconciliation` 并直接 return**
- `src-tauri/src/scanner.rs:845-855` — `optimizing_search` 阶段（仅 gate 开启可达）
- `src-tauri/src/scanner.rs:900-902` — dedupe 派发条件
- `src-tauri/src/scanner.rs:992-1023` — `finish_scan_run`
- `src-tauri/src/scanner.rs:1059-1106` — dedupe 派发与 CAS 记录
- `src-tauri/src/scanner.rs:1108-1146` — **legacy 终态事件映射（非 completed → `scan-error`）**
- `src-tauri/src/scanner.rs:1313-1341` — **`legacy_summary_or_error`（非 completed → `Err`）**
- `src-tauri/src/scanner.rs:1454-1463` — **`stale_reconciliation_enabled`，默认 `false`**
- `src-tauri/src/scanner.rs:1465-1479` — 终态判定与 `should_run_stale_cleanup`
- `src-tauri/src/scanner.rs:1566-1568,1640-1682` — 固化默认 gate 行为的测试

**后端 — 数据层**
- `src-tauri/src/db/queries/scan.rs:236-427` — `admit_managed_scan` 全流程
- `src-tauri/src/db/queries/scan.rs:250` — `BEGIN IMMEDIATE`
- `src-tauri/src/db/queries/scan.rs:275-305` — root 重叠拒绝
- `src-tauri/src/db/queries/scan.rs:388-409` — lease CAS
- `src-tauri/src/db/queries/scan.rs:734-826` — `reconcile_missing`
- `src-tauri/src/db/queries/scan.rs:752-756` — coverage 有错即禁止 stale
- `src-tauri/src/db/queries/scan.rs:783-803` — stale UPDATE 的护栏
- `src-tauri/src/db/queries/scan.rs:1610-1741` — `update_session_projection_tx`
- `src-tauri/src/db/queries/scan.rs:1695-1702` — **`dedupe_pending` 要求 completed 终态**
- `src-tauri/src/db/queries/scan.rs:1793-1897` — 文件 upsert 与错误账本
- `src-tauri/src/db/queries/scan.rs:1899-1946` — root 与 ignored subtree 的 LIKE 模式
- `src-tauri/src/db/queries/scan.rs:1959-2022` — `ensure_scan_root_tx`
- `src-tauri/src/db/queries/scan.rs:2225-2338` — 请求 root 解析与 effective 映射
- `src-tauri/src/db/queries/scan.rs:2354-2382` — 路径规范化与重叠判定
- `src-tauri/src/db/queries/scan.rs:567,1083,1584` — 其余三处 `UPDATE scan_roots`（均不写 `enabled`）
- `src-tauri/src/db/schema.rs:7` — `CURRENT_SCHEMA_VERSION = 27`
- `src-tauri/src/db/schema.rs:44-51` — **版本已最新的快速路径同样执行 backfill**
- `src-tauri/src/db/schema.rs:683-687` — 26→27 迁移
- `src-tauri/src/db/schema.rs:702-928` — scan ledger 建表与索引
- `src-tauri/src/db/schema.rs:930-990` — `backfill_scan_roots_from_settings`
- `src-tauri/src/db/schema.rs:963-967` — **`enabled` / `display_name` 的单向覆盖**
- `src-tauri/src/db/schema.rs:788-790` — 每 root 单 active run 的部分唯一索引
- `src-tauri/src/path_filter.rs:11-62` — 忽略目录名单的常量化

**后端 — 装配**
- `src-tauri/src/main.rs:34` — 启动恢复
- `src-tauri/src/main.rs:48-56` — 启动时同步重放 dedupe 派发
- `src-tauri/src/main.rs:150-157` — 新命令注册
- `src-tauri/build.rs:55-62` — 命令 allowlist
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md:60-67` — 权限矩阵登记

**前端**
- `src/api/tauriApi.ts:382-389` — legacy `startScan`（本 PR 后无生产调用方）
- `src/api/tauriApi.ts:712-723` — legacy 扫描事件订阅
- `src/store/useScanManagerStore.ts:44-47` — 终态集合
- `src/store/useScanManagerStore.ts:132-137` — **`requires_reconciliation` → `error`**
- `src/store/useScanManagerStore.ts:185-208` — 会话状态投影
- `src/store/useScanManagerStore.ts:403-442` — legacy 事件处理
- `src/store/useScanManagerStore.ts:528-568` — **前台扫描终态处理与文件库刷新条件**
- `src/store/useBackgroundIndexerStore.ts:147-162` — **后台索引终态判定**
- `src/store/useBackgroundIndexerStore.ts:199-208` — **轮询实现**
- `tests/backgroundIndexerRuntime.test.ts:72,100-101` — **测试只 mock `completed`**

### master 基线（`3b3d7b8`，用于回退对照）

- `src-tauri/src/scanner.rs:358-361`（master）— 取消路径
- `src-tauri/src/scanner.rs:363-366`（master）— **扫描完成后执行 FTS optimize**
- `src-tauri/src/scanner.rs:368-387`（master）— **发 `scan-complete` 并调度 dedupe**

### 参考仓库

本阶段未引用任何参考仓库代码（阶段 A 不涉及外部对标）。
