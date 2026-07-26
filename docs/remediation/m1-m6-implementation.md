# M1–M6 实施记录：扫描终态的三轴分离

> 承接 `docs/remediation/pr-18-review.md` 第 7 节与 BRIEF 裁决 1、2、3（修正）、5。
> 分支：`remediation/01a-scan-generation-fixes`，基线 `c259fa7`（PR #18 head）。
> 本文件的分类表即 PR 描述所需的内容。

---

## 1. 净变化方向（必须写明）

**本 PR 相对 master 的净变化是「用更安全的新实现替换原有的无条件实现」，不是「新增一项能力」。**

master 在每次非取消扫描后**无条件**执行 stale 清理（`master:scanner.rs:345-347`，`should_run_stale_cleanup(cancelled) = !cancelled`，`master:scanner.rs:634-636`）。PR #18 保留了同名同签名的函数，但加了一个默认 `false` 的开关，并把执行体换成新的 `reconcile_missing`——**这在默认构建中静默移除了既有能力**。

新实现在每一个维度上都比被替换的实现更安全：

| 维度 | master `mark_missing_files_stale_after_scan` | 新 `reconcile_missing` |
|---|---|---|
| coverage 校验 | 无——metadata 读不到时照样标为已删除 | 要求 `coverage_error_count == 0` 否则拒绝（`scan.rs:752-756`） |
| 判定依据 | 仅 `last_seen_at <` + 路径前缀 | 加 `NOT EXISTS scan_seen` 精确成功观测（`scan.rs:794-798`） |
| 忽略目录 | 无——被跳过目录下的文件会被误判为已删除 | 从 `path_filter` 派生 ignored subtree 排除（`scan.rs:764-773`） |
| 并发护栏 | 无 | run/root/session revision + lease CAS（`scan.rs:744-751,805-821`） |

**因此默认值必须是 `true`。** 任何把它改回 `false` 的改动都会重新引入静默回退，请勿"顺手"调整。

---

## 2. 三轴正交

改动的核心是把三件互相独立的事实解耦，任何一个都不再编码另一个的含义：

| 轴 | 含义 | 载体 |
|---|---|---|
| **1. 作业终态** | 这次扫描有没有跑完 | `scan_runs.status` / `scan_sessions.status`；UI 的 `ScanStatus` |
| **2. 索引健康** | 索引现在可不可信 | `scan_roots.health_status` / `needs_reconciliation`；UI 的 `indexIsIncompleteForStatus` |
| **3. generation 指针** | 上一次可信的完整扫描是哪一代 | `scan_roots.last_successful_generation` |

`requires_reconciliation` 表示"作业跑完了，但覆盖不完整"——它是**轴 2 的信号**。此前它被放在轴 1 的位置上，导致 5 个下游消费点集体把成功当失败。

---

## 3. 消费点分类表（裁决 2.2）

| # | 消费点 | 当前行为 | 判定 | 处置 |
|---|---|---|---|---|
| 1 | `useScanManagerStore.ts:132-137` `scanStatusForBackendStatus` | `requires_reconciliation → "error"` | **错的**——把轴 2 的信号编码进轴 1，数据已成功入库却报错 | 映射为 `"completed"`；新增 `indexIsIncompleteForStatus` 承载轴 2，信号未丢失 |
| 2 | `useScanManagerStore.ts:559-562` `completedScanRoots` | 排除该终态 → 不调 `setCurrentScanScope`、不刷新文件库 | **错的**——该 root 已持久化其观测到的全部文件，作用域有效 | 纳入成功集合，恢复扫描后的作用域切换与刷新 |
| 3 | `useScanManagerStore.ts:574-580` 终态提示 | `showError(errorMessage)` | **对的一半**——覆盖不完整值得告知用户，但不该表达为失败 | 改为 `showSuccess` + 专用文案 `scanIndexIncomplete`，明确说明索引可能不完整并建议重扫 |
| 4 | `useBackgroundIndexerStore.ts:161-167` | 非 completed 即 `throw` → 不 `markRecentlyIndexedRoot` | **错的**——导致该 root 永不被记为已索引，队列反复重试 | 接受该终态为完成 |
| 5 | `db/queries/scan.rs:1695-1717` `dedupe_pending` | 要求 completed 才派发 | **错的**——dedupe 在已入库行上运行，其正确性不依赖索引*完整性* | 允许该终态派发；新增 `dedupe_eligible_root_count`，仅"什么都没索引到"时才不派发 |
| 6 | `scanner.rs:817-844` FTS optimize | kill-switch 路径提前 `return`，跳过 `optimizing_search` | **错的**——master 每次扫描后都 optimize，跳过会持续劣化全局搜索 | 两条路径都继续走 optimize 与 finalize |
| 7 | `scanner.rs:1122-1146` `emit_terminal_events` + `:1330-1341` `legacy_summary_or_error` | 非 completed → 发 `scan-error` / 返回 `Err` | **错的**——legacy 协议无健康通道，不应把"完成但不完整"表达为失败 | 按轴 1 映射：发 `scan-complete` / 返回 `Ok`，覆盖缺口通过 summary 的 error 计数体现 |

第 3 项是唯一判定为"部分正确"的消费点：它确实在响应一个真实信号，因此按裁决 2.2 的要求**重新指向了轴 2**，而不是随改名一起删掉。

---

## 4. kill switch 的语义（裁决 3 修正）

- 默认 `true`；env var `ZEN_CANVAS_SCAN_STALE_RECONCILIATION` 仅作**紧急回退开关**，取值 `0/false/off` 时关闭（`scanner.rs:1454-1472`）。
- 关闭时**不伪造对账证据**：作业终态仍为 `completed`，root health 不降级，`last_successful_generation` 正常推进。唯一后果是未观测到的行保持原有 stale 标志——因为我们没有去查。
- 关闭这一事实通过两处可见：进程日志（`scanner.rs:826-831`）与 run 的 `result_json.staleReconciliation = false`（`scan.rs:1020-1025`）。

---

## 5. 验收测试（裁决 2.3，钉行为不钉名字）

| 轴 | 测试 | 位置 |
|---|---|---|
| 默认值 | `stale_cleanup_runs_by_default_and_never_after_a_cancelled_scan` | `scanner.rs` 测试模块 |
| 1 + 2 + 3 | `kill_switch_path_completes_normally_without_fabricating_a_reconciliation_signal`——同时断言终态为 `completed`、`needs_reconciliation == false`、`health_status != "reconciliation_required"`、`last_successful_generation == Some(2)` | `scanner.rs` 测试模块 |
| UI 呈现 | `presents a finished scan as completed regardless of index health, without losing the health signal` | `tests/scanManager.test.ts` |
| UI 作用域 | `refreshes the library scope for roots that finished with incomplete coverage` | `tests/scanManager.test.ts` |
| 后台索引 | `records the root as indexed when the scan finished with incomplete coverage` | `tests/backgroundIndexerRuntime.test.ts` |

这些测试断言的是**行为**（指针是否推进、健康字段取什么值、UI 呈现为哪一类），而不是状态名字符串本身，因此后人改回旧语义时会失败。

---

## 6. 裁决 2.4 的回答：索引健康信号目前**没有闭环**

**问题**：如果 root health 长期停在"需对账"，谁、在什么时机真正执行对账？

**答案：没有人。这个字段目前是只写不读的。**

证据：

- **写入端**：`scan.rs:1089`（finalize 时 `needs_reconciliation = CASE WHEN success THEN 0 ELSE 1 END`）、`scan.rs:1586`（崩溃恢复时置 `health_status = 'reconciliation_required'`）。
- **读取端**：只有 DTO 行映射（`scan.rs:2179`）与测试断言。**没有任何生产代码根据它做决策。**
- **前端**：`tauriApi.ts:106` 定义了 `needsReconciliation` 字段，`tauriApi.ts:416-424` 暴露了 `listScanRoots` / `getScanRootHealth`，但全仓库**没有任何 UI 或逻辑调用这两个命令**。
- **恢复路径**：`retry_interrupted_scan`（`tauriApi.ts:427-429`）同样没有前端调用方，且它只针对 `interrupted` 的 run，不消费 root health。

因此按裁决 2.4，**该字段尚未闭环**，这一结论作为模块 3「扫描与索引」方案的输入。模块 3 必须回答：

1. **谁消费**：是启动时自动检查、空闲时后台对账，还是仅在 UI 上呈现并由用户触发？
2. **对账动作是什么**：全量重扫该 root，还是仅重扫上次出错的子树（需要 `scan_run_errors` 的路径信息，`scan.rs` 已持久化）？
3. **如何避免退化**：若答案是"每次启动都做"，等于回到全量重扫，与 Brief 安全边界第 1 条"启动不自动扫描"冲突；必须给出触发条件与频率上限。
4. **如何退出**：对账成功后如何清除标志，以及对账本身失败时是否会导致标志永久置位。

在模块 3 给出答案之前，本 PR 不为该字段新增任何自动触发逻辑——**保持它只写不读，好过给它一个未经设计的消费者。**

---

## 7. 变更文件

| 文件 | 改动 |
|---|---|
| `src-tauri/src/scanner.rs` | gate 默认值反转为 kill switch；kill-switch 路径不再提前 return、不再伪造终态；legacy 事件与返回值按轴 1 映射；两个验收测试 |
| `src-tauri/src/db/queries/scan.rs` | `dedupe_pending` 改用 `dedupe_eligible_root_count` |
| `src/store/useScanManagerStore.ts` | 轴 1/轴 2 拆分并导出；`completedScanRoots` 纳入该终态；终态提示改用专用文案 |
| `src/store/useBackgroundIndexerStore.ts` | 接受该终态为完成 |
| `src/i18n.ts` | 新增 `scanIndexIncomplete`（中/英） |
| `tests/scanManager.test.ts` | 两条 UI 验收测试 |
| `tests/backgroundIndexerRuntime.test.ts` | 后台索引验收测试；`managedStart` 支持自定义 root 与该终态 |

---

## 8. 不在本 PR 范围内

- `pr-18-review.md` 的 S1–S5（轮询改用只读快照、启动 dedupe 重放时机、Windows 大小写唯一索引、stale SQL 的 352 条 LIKE、每次 open 都 backfill）——未获批准，未改动。
- `issue-file-ops-flaky.md` 的 F1–F4——独立立项。
- 索引健康的消费闭环——按第 6 节交由模块 3。
