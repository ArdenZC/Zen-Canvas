# Issue：`file_ops` 测试组的并行不稳定性

> 来源：`docs/remediation/BRIEF.md` 裁决 4（PR #18 评审的衍生立项）。
> 状态：**根因已确认；F1/F2 已实施**（分支 `remediation/f1-f2-file-ops-test-resilience`）。F3 未实施；F4 视 CI 环境另行处理。
> 优先级：高。理由见第 1 节。
>
> **F1 实施位置**：`src-tauri/src/file_ops.rs` 测试模块——`with_environmental_retry`（有界 3 次、逐次 `[env-retry]` 留痕、超限显式 panic 不得静默）、`environmental_failure_signature`（仅匹配 `os error 32` 与 `target_committed_identity_mismatch`）、`record_environmental_event`（`ZEN_CANVAS_ENV_RETRY_LOG` 单行原子落盘供 CI 计数）；**7 个**受影响用例（原 6 个 + 实施期间新命中的 `source_claimed_...` 同族用例）已改为每次尝试重建夹具。辅助函数自身有 2 个行为测试（恢复路径与超限路径）。
> **实施期间的实战验证**：首轮本地验证运行即捕获一次真实 `os error 32`（`execute_moves_core_marks_remaining_operations_skipped_when_cancelled` 第 1 次尝试失败、第 2 次通过），重试与留痕机制在真实环境性失败下工作正常。
> **F2 实施位置**：`.github/workflows/ci.yml` "Rust tests" 步——仅当全部失败用例属 `file_ops::tests::` 且日志含环境性特征时才判 inconclusive 并重跑**一次**；inconclusive 计数落 `GITHUB_STEP_SUMMARY` 与 `flaky-inconclusive-*` 产物；其他失败或重跑再败直接失败。
> **生产层重试未做**（既有"不自动重试"成文约定，开例外须独立立项，见决策日志 D7）。
> 本文件所有断言附 `路径:行号`。

---

## 1. 为什么这是高优先级

`file_ops` 测试组守护的是 Zen Canvas 最不能失守的一层不变量：执行层二次校验、operation journal、pending 对账、restore 语义。这类测试一旦间歇性失败，团队会习得"重跑一次就好"，等于自愿放弃这层防护。

它还直接侵蚀 Brief 第 1 节"不低于基线"的验收线——**基线本身抖动时，无法区分某次失败是回归还是 flake**。

---

## 2. 结论摘要

**根因：Windows 文件共享冲突（`os error 32` / `ERROR_SHARING_VIOLATION`）。**

在系统资源压力下，外部进程（实时反病毒扫描、搜索索引服务等）会短暂持有测试刚创建的临时文件句柄，导致 `file_ops` 的真实文件系统操作失败。受影响的至少有 5 个用例，失败表现各不相同，因此长期被当成 5 个孤立的偶发问题。

**产品代码没有缺陷。** 被观测到的 `target_committed_identity_mismatch → manual_review` 恰恰是执行层安全校验的**正确响应**。有缺陷的是测试假设——它们默认"临时目录中的文件操作必然成功"，而这个假设在带实时扫描的 Windows 上不成立。

---

## 3. 复现方式与命中率

**未使用 `--test-threads=1`，也未使用重试来掩盖。** 所有实验都朝"加剧竞争"方向做。

| # | 实验 | 次数 | 命中 |
|---|---|---|---|
| 1 | `cargo test --lib`（默认线程数，热状态） | 8 | 0 |
| 2 | `cargo test --lib -- --test-threads=48`（放大线程并发） | 10 | 0 |
| 3 | `cargo test`（完整套件，多测试二进制并行） | 5 | 0 |
| 4 | **4 个 lib 测试进程并行 × `--test-threads=16` × 多轮** | 32 | **5** |
| — | 定向单跑失败用例 `-- --exact` | 1 | 0（通过） |

### 3.1 可靠的复现方法

```bash
EXE=$(ls -t src-tauri/target/debug/deps/zen_canvas_tauri-*.exe | head -1)
for round in 1 2 3 4 5; do
  for j in 1 2 3 4; do "$EXE" --test-threads=16 > "/tmp/r${round}_$j.log" 2>&1 & done
  wait
  grep -l "test result: FAILED" /tmp/r${round}_*.log
done
```

**关键特征：命中总是出现在第 3–4 轮，前两轮 0/4。** 触发条件是**累积的系统资源压力**，不是单次并发峰值——这解释了为什么提高测试线程数到 48（实验 2）反而复现不出来，而 4 个进程连续跑几轮就能稳定命中。

这也解释了首次观测：那次是 `desktop-runtime` feature **冷编译刚结束**后的首次完整运行，磁盘与内存压力都处于峰值。

---

## 4. 直接证据

诊断探针在第 4 轮捕获到两类失败，出自同一个用例的不同实例：

**实例 A —— 文件被外部进程占用：**

```
FLAKY DIAG cancel-test: success_count=9 (expected 10), logs=11
    [0] status=failed phase=completed err=Some("io: 另一个程序正在使用此文件，进程无法访问。 (os error 32)")
    [1..9] status=success phase=completed err=None
    [10] status=skipped phase=completed err=None
```

**实例 B —— 由占用衍生的身份校验失败：**

```
FLAKY DIAG cancel-test: success_count=9 (expected 10), logs=11
    [0..5] status=success phase=completed err=None
    [6] status=manual_review phase=target_committed err=Some("target_committed_identity_mismatch")
    [7..9] status=success phase=completed err=None
    [10] status=skipped phase=completed err=None
```

`os error 32` 是 Windows 的 `ERROR_SHARING_VIOLATION`。实例 B 中，移动已经提交到目标，但随后的身份校验读到了不一致的状态（`atomic_move.rs:235,242-249`），执行层按设计判定为 `manual_review` 且**不回滚**——这是正确的安全行为。

### 4.1 受影响的用例（同一次实验中观测到）

| 用例 | 断言失败形式 |
|---|---|
| `execute_moves_core_marks_remaining_operations_skipped_when_cancelled` | `left: 9, right: 10` |
| `execute_moves_core_moves_files_and_returns_success_log` | — |
| `execute_moves_core_creates_safe_missing_target_parent` | — |
| `restore_blocks_legacy_operation_logs_without_identity` | `file_ops.rs:4050` |
| `target_committed_phase_persistence_failure_records_manual_review_without_rollback` | `assertion failed: result.is_err()`（首次观测，见 5.2） |
| `source_claimed_phase_persistence_failure_rolls_back_before_target_commit` | F1 实施期间在自致负载下命中（同为触发器注入模式，与 target_committed 同族同机制）；同轮留痕文件捕获到真实 `os error 32` |

单个实例最多同时失败 3 个用例；另外 2 个实例全绿。**这是测试组级别的系统性问题，不是某个用例的偶然。**

---

## 5. 失败机制

### 5.1 计数型断言（`..._skipped_when_cancelled`）

该用例注入 11 个操作，在进度回调的 `processed >= 10` 时设置取消标志（`file_ops.rs:4914-4921`），断言"前 10 个成功、第 11 个被跳过"。

**已排除的怀疑：取消时机竞态。** 进度节流的发出条件是四选一（`file_ops.rs:2246-2250`），其中 `processed.is_multiple_of(OPERATION_PROGRESS_BATCH_SIZE)` 且 `OPERATION_PROGRESS_BATCH_SIZE = 10`（`file_ops.rs:25`）**保证 `processed == 10` 时必然发出事件**；`record` 在操作完成后调用（`file_ops.rs:717-719`），取消检查在下轮循环开头（`file_ops.rs:657`）。因此取消一定发生在第 10 个完成之后、第 11 个开始之前，**与负载无关**。

真实原因就是第 4 节的证据：**前 10 个中有一个真的没成功**。

### 5.2 `target_committed_phase_persistence_failure_...` 的失败机制

这个用例注入一个 SQL 触发器，期望 `execute_moves_with_persistence` 因触发器 ABORT 而返回 `Err`。

关键在于：**单个操作失败并不会让 `execute_moves_with_persistence` 返回 `Err`。** 它把每个操作的失败记录进 `result.logs[i].status`，只要最终的 `save_operation_logs` 成功，函数就返回 `Ok(result)`（`file_ops.rs:583-594`）。

因此当文件操作在到达 `target_committed` **之前**就因 `os error 32` 失败时：

- `phase_observer` 从未以 `"target_committed"` 被回调（`atomic_move.rs:214` / `copy_commit.rs:232` 都未到达）；
- 注入的触发器因此从未触发；
- 函数返回 `Ok(result)`（其中 `logs[0].status == "failed"`）；
- `assert!(result.is_err())` 失败。

**与第 4 节的证据完全一致，两个用例同源。**

### 5.3 该用例的附加结构性脆弱点

即便修好共享冲突，这个用例仍比同组其他用例脆弱：它是 `file_ops` / `fs_safety` 测试组中**唯一**用数据库级 SQL 触发器（跨连接、跨线程的全局副作用）做故障注入的用例（`file_ops.rs:4341-4350`）。同组其余故障注入都是 thread_local、天然隔离的：

- `OperationTestFaultPoint` + `set_operation_test_fault`（`file_ops.rs:30-59`）
- `AtomicFaultPoint` + `set_fault` / `take_fault`（`fs_safety/atomic_move.rs:325-339`）

而且触发器的生效还依赖一条无断言保护的链：pending 行必须已 INSERT（`file_ops.rs:1149`）→ observer 必须被回调（`:665-687`）→ `UPDATE … WHERE id = ?1` 必须匹配到行（`db/queries/operations.rs:397-425`）→ 触发器才 ABORT。链上任何一环断裂都会静默地变成 `Ok`。注意 `update_operation_phase` 丢弃了 affected rows（`operations.rs:423`），0 行更新不会报错。

---

## 6. 预设假设的证伪记录

### 6.1 假设 (a)：源于另一种共享资源 —— **部分成立，但不是预想的那些**

预设的具体候选**全部证伪**：

| 候选 | 结论 | 证据 |
|---|---|---|
| 全局故障注入开关 `OPERATION_TEST_FAULT` | 不成立。`thread_local!`，且每个测试独立线程 | `file_ops.rs:38-42,44-59` |
| `fs_safety` 的 `AtomicFaultPoint` | 不成立。同样 thread_local | `fs_safety/atomic_move.rs:325-339` |
| 测试临时目录冲突 | 不成立。`pid + 全局原子计数器 + 纳秒` | `file_ops.rs:4767-4779`、`:2766` |
| 测试数据库路径冲突 | 不成立。同上机制 | `file_ops.rs:4781-4791` |
| journal 触发器被 migrate 重建时误删 | 不成立。只 DROP 自己的 6 个具名触发器 | `db/schema.rs:1249-1295` |
| 集成测试污染共享 temp 目录 | 不成立。各自 nonce 目录，无批量清理 | `src-tauri/tests/*.rs` |

**实际的共享资源是进程外的**：Windows 文件系统本身，以及与测试竞争文件句柄的系统级服务（实时扫描 / 索引器）。这不在仓库代码的控制范围内，也是预设假设没有覆盖到的方向。

### 6.2 假设 (b)：是 v0.1.38「并行测试数据库唯一」修复的回归 —— **已证伪**

该修复建立的唯一性机制完好：`test_db_path()` 与 `test_dir()` 都从同一个 `AtomicU64` 取序号，叠加进程 ID 与纳秒时间戳（`file_ops.rs:4767-4791`、`:2766`）。即使 Windows 时钟粒度粗糙导致纳秒值重复，原子序号仍保证唯一。

本次失败与数据库文件唯一性无关——失败模式是"真实文件操作被外部进程阻塞"，不是"数据被别的测试污染"。

---

## 7. 修复方案

### 7.1 F1（必做）：让文件操作对瞬时共享冲突具备韧性

`os error 32` 在 Windows 上是**可重试的瞬时错误**，不是逻辑错误。两个层次可选：

- **仅测试层**：在测试的文件准备与断言路径上，对 `ERROR_SHARING_VIOLATION` 做有界短重试（例如 3 次 × 50ms）。改动小、不触碰生产代码。
- **生产层（需单独评估）**：在 `fs_safety` 的移动/重命名路径上对该错误码做有界重试。这会让真实用户在杀毒软件占用文件时也更稳，但属于产品行为变更，**必须由独立任务书承接**，不在本 issue 范围内。

**建议先做测试层**，并把生产层作为模块 3 之后的候选项记录。

### 7.2 F2（必做）：把环境性失败与逻辑性失败区分开

当前测试把两者都表达为断言失败，导致无法区分回归与环境噪声。建议：

- 断言前检查各 log 的 `error_message`，若匹配已知的环境性错误（`os error 32`、`target_committed_identity_mismatch`），则以明确的诊断信息 `panic!`，文案上标注"环境性失败"；
- 更进一步，可让 CI 把这类失败归类为 inconclusive 并自动重跑**一次**（仅限该错误码），其余失败一律视为真实回归。

这样"重跑一次就好"从团队的坏习惯变成有明确边界的机制。

### 7.3 F3（建议）：把触发器故障注入迁移到 thread_local

针对 5.3 的结构性脆弱点：

- 在 `OperationTestFaultPoint`（`file_ops.rs:30-36`）增加 `BeforeTargetCommittedPhasePersist`；
- 在 `db.update_operation_phase` 调用前（`file_ops.rs:674`）检查该故障点，命中则返回与触发器等价的错误路径；
- 测试改用 `set_operation_test_fault(...)`，删除 SQL 触发器。

收益：故障注入确定生效，不再依赖"UPDATE 必须匹配到行"这条隐式链，与同组其余用例的机制统一。

### 7.4 F4（建议）：CI 层面为测试临时目录申请实时扫描排除

若 CI 运行在可配置的 Windows 机器上，将 `%TEMP%\zen-canvas-*` 加入实时扫描排除项，可从源头消除该竞争。这是环境配置，不是代码修复，应与 F1/F2 并行而非替代。

### 7.5 明确不采用的做法

- **不**用 `--test-threads=1` 串行化该测试组；
- **不**加无条件的自动重试（F2 中受限于特定错误码的单次重跑除外）。

两者都会掩盖真实回归。

### 7.6 诊断探针的处置

排查期间在两个用例中植入了诊断探针（输出各 log 的 status / phase / error_message、触发器存在性、journal_mode）。**这些是临时修改，已全部还原，未提交。**

实施 F2 时建议把等价的诊断输出**转为正式代码**——本次排查的决定性证据正是它提供的，没有它只能看到 `left: 9, right: 10`。

---

## 8. 对 M1–M6 的影响评估

该 flaky 属于 `file_ops` 测试组，**与 PR #18 及 M1–M6 涉及的测试组无交集**：

- PR #18 的 diff 未触及 `src-tauri/src/file_ops.rs`；
- M1–M6 的改动面是 `scanner.rs`、`db/queries/scan.rs`、`useScanManagerStore.ts`、`useBackgroundIndexerStore.ts` 及其对应测试；
- 根因是真实文件系统的共享冲突，只影响执行真实文件移动的用例；scan 相关测试不做文件移动。

因此按裁决 4「不阻塞 PR #18」与执行顺序第 2 条的替代条件（"或确认其不影响 M1 相关测试组后"），**M1–M6 可以放行**。

**但在 M1–M6 的验收中**：若出现 `file_ops` 组失败，必须先按第 4 节的特征（`os error 32` / `identity_mismatch`）确认是否属于本 issue；属于则不计入 M1–M6 验收结果，不属于则视为真实回归。**任何情况下都不得以"重跑一次"了结。**

---

## 9. 证据清单

**根因证据（实验捕获）**
- 实例 A：`err=Some("io: 另一个程序正在使用此文件，进程无法访问。 (os error 32)")`
- 实例 B：`err=Some("target_committed_identity_mismatch")`, `phase=target_committed`, `status=manual_review`

**测试与故障注入机制**
- `src-tauri/src/file_ops.rs:25-26` — `OPERATION_PROGRESS_BATCH_SIZE = 10`、`OPERATION_PROGRESS_EMIT_INTERVAL = 200ms`
- `src-tauri/src/file_ops.rs:30-36` — `OperationTestFaultPoint` 定义
- `src-tauri/src/file_ops.rs:38-59` — thread_local 故障开关
- `src-tauri/src/file_ops.rs:2766` — `TEST_FIXTURE_COUNTER`
- `src-tauri/src/file_ops.rs:3636-3670` — `..._skipped_when_cancelled` 用例
- `src-tauri/src/file_ops.rs:4337-4383` — `target_committed_phase_persistence_failure_...` 用例
- `src-tauri/src/file_ops.rs:4341-4350` — 注入的 SQL 触发器
- `src-tauri/src/file_ops.rs:4767-4791` — `test_dir()` / `test_db_path()`
- `src-tauri/src/file_ops.rs:4894-4921` — `RecordingOperationProgressEmitter` 与 `cancel_after`
- `src-tauri/src/fs_safety/atomic_move.rs:325-339` — `AtomicFaultPoint` 的 thread_local 实现

**执行链路**
- `src-tauri/src/file_ops.rs:539,1095-1161` — pending journal 预写入
- `src-tauri/src/file_ops.rs:656-720` — 操作循环、取消检查、`phase_observer`、进度 `record`
- `src-tauri/src/file_ops.rs:583-594` — **最终 `save_operation_logs` 并返回 `Ok(result)`（单操作失败不改变返回值）**
- `src-tauri/src/file_ops.rs:2238-2261` — `ProgressThrottle::record` 的四条发出条件
- `src-tauri/src/fs_safety/atomic_move.rs:210-258` — 同卷提交路径（`:214` 发出 `target_committed`；`:235,242-249` 身份校验）
- `src-tauri/src/fs_safety/copy_commit.rs:214-282` — 跨卷提交路径（`:232` 发出 `target_committed`）

**数据层**
- `src-tauri/src/db/queries/operations.rs:397-425` — `update_operation_phase`（`WHERE id = ?1`，丢弃 affected rows）
- `src-tauri/src/db/queries/operations.rs:259-302` — `save_operation_logs` 的 `INSERT … ON CONFLICT(id) DO UPDATE`
- `src-tauri/src/db/schema.rs:1249-1295` — `ensure_journal_state_triggers`
- `src-tauri/src/db/connection.rs:25,53` — 连接池 `max_size = 8`、`mmap_size = 3GB`

**外部记录**
- `docs/remediation/TASK_01A_IMPLEMENTATION_CLOSEOUT.md:78,84` — 实施方记录的同组另一用例的同类现象与「页面文件不足（os error 1455）」
