# 模块 1：重复检测（vs Czkawka `czkawka_core`）

> 依据 `BRIEF.md` 第 4/5/6 节与 `00-overview.md` 决策日志。
> 模块基线：master `0dfedf69de0c05895e0e88263208f93e1cae8505`（含 PR #15 合并提交，祖先校验通过）。
> 参考：czkawka @ `3c3523a8c00f2bf643db6f449542c1558b1db0d4`，对比目标 `czkawka_core`（**实测 MIT**，`czkawka_core/Cargo.toml:8`）。
> 本文档为方案，未实施。按 Brief 第 4 节，产出后停下呈报。
> 许可证说明：MIT 允许有限复用，但本方案**全部为自研设计**，仅借鉴思路与结构；未复制任何代码，`00-overview.md` 第 4 节登记表保持为空。

---

## 1. Zen Canvas 现状

### 1.1 调用链与文件

| 层 | 文件 | 角色 |
|---|---|---|
| Rust 核心 | `src-tauri/src/dedupe.rs`（701 行） | 全部检测逻辑 |
| 触发 | `src-tauri/src/scanner.rs:1059-1106` | 扫描 session 终态后按 `dedupe_pending` 派发 |
| 启动恢复 | `src-tauri/src/scanner.rs:492-543` + `src-tauri/src/main.rs:48-56` | 重放 pending/unknown/failed 派发意图 |
| 持久化 | `files.content_hash` 列 | 哈希缓存（见 1.4） |
| 派发账本 | `scan_sessions.dedupe_*` 列（schema 27） | at-least-once 派发意图 + CAS |
| 结果查询 | `src-tauri/src/db/queries/files.rs:639-684,748-762,797-842` | `is_duplicate` 相关子查询 |
| 前端 | `src/store/useScanManagerStore.ts:443-449`（事件）；`src/views/vault/components/FileLibraryFilterPopover.tsx:50`（duplicateOnly 过滤）；`src/views/organize/organizeModel.ts:88,136`（整理建议消费） |

调用链：`run_managed_session` 终态 → `dispatch_dedupe_if_pending`（`scanner.rs:900-902`）→ `claim_dedupe_dispatch`（CAS）→ `spawn_duplicate_detection`（`dedupe.rs:379-431`，`spawn_blocking`）→ `run_duplicate_detection_job`（`dedupe.rs:275-377`）。

### 1.2 当前流水线

1. **按 size 分组取候选**（`dedupe.rs:480-506`）：SQL `GROUP BY size HAVING COUNT(*) > 1 AND COUNT(*) FILTER (WHERE content_hash = '') > 0`，只关心含未哈希成员的碰撞组；`is_dir = 0 AND is_stale = 0 AND size > 0`。
2. **逐 size 取未哈希文件**（`dedupe.rs:508-533`）：`WHERE size = ? AND content_hash = ''`。
3. **哈希前身份校验**（`dedupe.rs:307-321`）：实测 size/mtime 与 DB 记录一致才继续，不一致计 error 跳过。
4. **BLAKE3 全量哈希**（`dedupe.rs:447-461`）：`update_reader` 流式，单线程顺序执行。
5. **哈希后身份复检**（`dedupe.rs:324-337`）：哈希期间文件变化则丢弃。
6. **批量写入**（`dedupe.rs:535-563`）：500 条一批，`UPDATE ... WHERE id = ? AND size = ? AND mtime = ? AND is_stale = 0` 的 CAS，0 行命中计 skipped。
7. **计数收尾**（`dedupe.rs:565-592`）：SQL `GROUP BY size, content_hash HAVING COUNT(*) > 1` 数出重复文件总数。

### 1.3 任务身份、取消与事件

- `DedupeJobManager`（`dedupe.rs:27-102`）：进程内 job 注册表，`scan_to_dedupe` 映射支持 `cancel_for_scan`；`AtomicBool` 取消旗标，逐文件检查（`dedupe.rs:302-305`）；取消后把剩余候选计入 skipped 并跳出。
- **durable 层（PR #18/#19 已建）**：`scan_sessions.dedupe_dispatch_state`（`not_requested/pending/dispatching/dispatched/unknown/failed/suppressed`）+ `dedupe_attempt_count/dedupe_job_id/dedupe_last_error`，claim 与 result 均 CAS；启动恢复重放（`scanner.rs:492-543`），at-least-once 语义。**注意：durable 的只是"派发意图"，dedupe run 本身不 durable**——崩溃后重放会从头再跑一次（缓存使重复代价有限）。
- 事件：`dedupe-progress`（200ms 节流，processed/total）与 `dedupe-complete`（`dedupe.rs:21-25,120-144`）。
- 命令：`cancel_dedupe`（`dedupe.rs:433-445`，`require_main_window`）。

### 1.4 哈希缓存（种子问题 2 的现状答案）

**已存在跨次运行的持久化缓存**，且失效链完整：

- 存储：`files.content_hash`，与索引行同生命周期，无独立缓存文件。
- **失效键 = (size, mtime, is_dir)**：scan upsert 时任一变化即清空 `content_hash`（`db/queries/scan.rs:1841-1847`；legacy 路径同款 `files.rs:99-104`）。
- 写入时二次防护：CAS `AND size = ? AND mtime = ? AND is_stale = 0`（`dedupe.rs:544`）。
- 读取时三次防护：哈希前后各一次实测身份比对（`dedupe.rs:307-337`）。
- 命中即零 IO：已哈希文件根本不进候选集（`content_hash = ''` 过滤），连缓存加载都不需要。

### 1.5 做得好的部分

- 缓存与索引一体化：无独立缓存文件、无加载/保存阶段、失效发生在数据变化的写入点而非检测时刻——这比 czkawka 的独立缓存文件模型更强（对比见第 3 节）。
- 哈希前后双重身份校验 + 写入 CAS，三层防"哈希绑错行"。
- 派发意图 durable + 启动恢复 + CAS，取消可按 scan session 关联。
- size>0、is_stale=0、目录排除等边界干净。

### 1.6 实际存在的问题

| # | 问题 | 证据 |
|---|---|---|
| P1 | **无预哈希**：首次遇到大体积 size 碰撞组时，即使内容在前几 KB 就已分歧，也要读完整个文件 | `dedupe.rs:322`（直接 `hash_file`） |
| P2 | **单线程哈希**：候选逐个顺序哈希，多核与 SSD 队列深度全部闲置 | `dedupe.rs:300-357`（单循环） |
| P3 | **无组模型**：结果只有 per-file 的 `is_duplicate` 布尔投影，组身份 (size, hash) 只存在于三处重复的 SQL 子查询里；前端没有"组"概念，无法呈现"这 3 个文件互为重复、共浪费 X 字节" | `files.rs:639-684,748-762,797-842`；前端仅 `duplicateOnly` 过滤（`FileLibraryFilterPopover.tsx:50`） |
| P4 | **run 不 durable**：进度、结果统计、错误清单都只在事件里，崩溃后无法查询"上次查重发生了什么"；与 scan ledger 的成熟度不对齐 | `dedupe.rs:120-154`（仅内存 payload）；closeout 已把此列为 Task 02 边界（`TASK_01A_IMPLEMENTATION_CLOSEOUT.md:69`） |
| P5 | **无字节级进度**：total 按文件数计，10 个 4GB 文件与 10 个 4KB 文件的进度条行为相同 | `dedupe.rs:122-128,285-288` |
| P6 | 取消后 `skipped` 把"未处理"与"CAS 未命中"混在同一个计数里，语义含糊 | `dedupe.rs:303,346,359` |
| P7 | 空文件（size=0）被整体排除——合理（避免海量空文件互配），但从未在 UI/文档中说明该边界 | `dedupe.rs:490` |

### 1.7 当前测试覆盖

- `src-tauri/tests/dedupe.rs`（5 个集成测试）与 `dedupe.rs:652-700`（job manager 3 个单测）。
- 已覆盖：任务管理/取消隔离、身份检查、批量写入、进度事件（closeout 与旧矩阵均确认）；派发恢复见 `scanner.rs` 测试 `startup_replays_pending_unknown_and_failed_dedupe_dispatches_after_restart`。
- 缺口：无 prehash（不存在故无测试）、无组查询测试、无字节进度测试。

---

## 2. 参考实现：czkawka `czkawka_core` duplicate 流水线

> 全部引用 `czkawka@3c3523a`。核心文件 `src/tools/duplicate/core.rs`（708 行）、`mod.rs`（536 行）、`src/common/cache.rs`（704 行）。

### 2.1 核心类型

- `DuplicateEntry { path, modified_date, size, hash }`（`mod.rs:41-46`）——路径为键的最小条目。
- `DuplicateFinder`（`mod.rs:115-127`）：按检测方法持有多张 `BTreeMap` 结果表；本模块只关注 hash 路径的 `files_with_identical_size: BTreeMap<u64, Vec<Entry>>` 与 `files_with_identical_hashes: BTreeMap<u64, Vec<Vec<Entry>>>`（size → 组列表 → 组成员）。
- `DuplicateFinderParameters`（`mod.rs:86-93`）：检测方法（Name/SizeName/Size/Hash）、哈希算法、缓存开关与最小缓存体积阈值。

### 2.2 流水线（Hash 方法）与状态机

```
遍历 → 按 size 分组(仅组>1)
  → [阶段] LoadingPreHashCache → PreHashing → SavingPreHashCache
  → 按 (size, prehash) 分组(仅组>1)
  → [阶段] LoadingHashCache → FullHashing → SavingHashCache
  → 按 (size, full_hash) 分组(仅组>1) = 结果
```

阶段以 `ToolStage::Duplicate(DuplicateStage::…)` 显式建模并驱动进度 UI（`core.rs:373,383,434,551,562,609`）。

### 2.3 预哈希设计（种子问题 1 的参考答案）

- **读头 4KB + 尾 4KB**：`PREHASHING_BUFFER_SIZE = 4 * 1024`（`mod.rs:33`）；`hash_calculation_limit` 从头尾各读至多 limit 字节喂同一个 hasher，size ≤ 2×limit 时整读（`mod.rs:222-247`）。头+尾的设计能同时打掉"同头不同尾"（日志、增长中的文件）与"同尾不同头"的碰撞。
- **只淘汰不确认**：prehash 相同只说明需要全量哈希，组>1 才进入下一阶段（`core.rs:458-464`）。
- 每文件成本 ≤ 8KB 读；对 GB 级碰撞组，一对非重复文件从"读 2×N GB"降为"读 16KB"。

### 2.4 并发与缓冲

- rayon `into_par_iter().with_max_len(3)` 按 size 组并行，粒度控制留尾部任务给主线程（`core.rs:399-401,574-576`）。
- 线程局部 2MB 缓冲 `THREAD_BUFFER_SIZE = 2MB`（`mod.rs:34`），全量哈希手动 `read` 循环喂 hasher，同时累加字节计数（`mod.rs:297-322`）。
- **双维进度**：条目数 + 字节数（`size_counter`），prehash 阶段的预算按 `min(size, 2×limit)` 估算（`core.rs:384-391,563-564`）。

### 2.5 缓存

- 预哈希与全量哈希**各一个**缓存文件，按哈希算法区分（`core.rs:702`）。
- 键 = 路径，失效 = `modified_date` 不一致（`cache.rs:122,172`）+ 按 size 划分的桶。
- 体积阈值：低于 `minimal_(prehash_)cache_file_size` 的文件不入缓存，防缓存膨胀（`core.rs:334,342,535`）。
- 加载时三分：`loaded / already_cached / non_cached`（`cache.rs:291`），缓存条目与新算条目**合并后再分组**，避免"各自不足 2 个但合起来是一组"的漏检（`core.rs:436-454`）。

### 2.6 取消

- `stop_flag` 逐文件检查，rayon 侧用 `while_some()` 短路（`core.rs:408-410,583-585`）。
- **停止后仍保存已算出的缓存**（`core.rs:606` 注释 "Even if clicked stop, save items to cache"）——已付出的 IO 不作废，下次直接命中。

### 2.7 它为什么这样设计

czkawka 是**无索引的 ad-hoc 扫描器**：每次运行都从文件系统遍历开始，没有持久索引可依赖。因此它必须：用独立缓存文件弥补没有索引（键只能是路径+mtime）；在单次运行内把过滤做到极致（size → prehash → full 三级漏斗）；用 rayon 榨满吞吐。它解决的规模问题是"对任意目录反复做全量查重"，可靠性问题是"缓存永不影响正确性（只淘汰不确认 + mtime 失效）"。

Zen Canvas 的前提不同：**有持久索引与内嵌哈希缓存**，增量运行天然只处理新文件。因此 czkawka 的价值集中在两点：**prehash 漏斗**（我们缺的 P1）与**双维进度 + 显式阶段**（P5）；其缓存架构反而不如我们现有方案（见第 3 节）。

---

## 3. 逐项差异表

| 对比点 | Zen Canvas | czkawka | 结论 |
|---|---|---|---|
| 候选来源 | 持久索引 SQL（size 碰撞 + 未哈希） | 每次全量遍历文件系统 | **我们已更优**：增量天然成立 |
| 预哈希 | **无**（`dedupe.rs:322`） | 头+尾各 4KB，组>1 才全量（`mod.rs:222-247`，`core.rs:458-464`） | **需引入**（P1，见 5.2） |
| 全量哈希 IO | `update_reader` 流式，缓冲不可控 | 2MB 线程缓冲手动循环，同时驱动字节进度（`mod.rs:34,297-322`） | 简化后采用：可控缓冲 + 字节计数 |
| 并发 | 单线程（`dedupe.rs:300-357`） | rayon 按 size 组并行（`core.rs:399-401`） | 采用思想，不引 rayon（见 5.3） |
| 缓存存储 | `files.content_hash` 列，与索引同事务 | 独立缓存文件 ×2，运行时整载整存 | **我们已更优**：无加载阶段、行级失效、事务一致 |
| 缓存失效键 | (size, mtime, is_dir) 于 upsert 时清空 + 写入 CAS + 哈希前后实测复检 | path + modified_date，检测时比对（`cache.rs:122,172`） | **我们已更优**：失效发生在数据变化点且有三层防护 |
| 缓存与新算结果合并 | 不需要——已哈希文件直接参与 SQL 分组 | 显式合并再分组防漏检（`core.rs:436-454`） | 等价能力，我们由 SQL 天然保证 |
| 组模型 | 仅 per-file `is_duplicate` 布尔（`files.rs:672`） | (size → 组 → 成员) 结构化结果（`mod.rs:125`） | **需引入**组查询与 DTO（P3，见 5.4） |
| 进度 | 文件数单维，200ms 节流 | 文件数 + 字节双维，显式阶段（`core.rs:384-391`） | 采用：字节维 + 阶段字段（P5） |
| 取消 | AtomicBool 逐文件 + durable 派发意图 | stop_flag + 停止后仍保存缓存（`core.rs:606`） | 各有所长：我们的批量写入已保留部分进度，补齐"取消前 flush 已算哈希" |
| run 持久化 | 无（P4） | 无（GUI 内存态） | 双方皆无；按我们的 ledger 模式自研（见 5.5） |
| 检测方法族 | 仅内容哈希 | Name/SizeName/Size/Hash 四种（`mod.rs:86-93`） | 不采用：名字类方法与我们"内容重复"定义不符 |
| 参考文件夹（originals） | 无 | reference folders 概念（`core.rs:305-315,627+`） | 暂不采用，记为后续候选概念 |
| 空文件 | size>0 排除（`dedupe.rs:490`） | 单独工具 empty_files | 保持排除，UI 说明边界（P7） |

---

## 4. 借鉴与拒绝清单

**直接采用（思想）**
1. 预哈希漏斗：头+尾采样、"只淘汰不确认"、组>1 才晋级。
2. 双维进度（文件数 + 字节数）与显式阶段枚举。
3. 取消时不浪费已付出的 IO（我们对应物：取消路径上 flush 已算出的哈希批）。

**简化后采用**
4. 并发哈希：不引 rayon（`Cargo.toml` 无此直接依赖，README §3.4 默认禁新增依赖），用 `std::thread::scope` 固定小工作池（见 5.3）。
5. 字节缓冲哈希循环：用固定缓冲的 `read` 循环替代 `update_reader`，顺带获得字节进度与逐块取消检查。

**Zen Canvas 已更优（保持不动）**
6. 缓存架构：索引内嵌列 + 写入点失效 + 三层身份防护，全面优于独立缓存文件模型。
7. 候选收敛：SQL 增量候选集（含"已哈希文件不再读"）。
8. durable 派发意图 + 启动恢复 + per-scan 取消映射。

**不适合的设计（拒绝清单）**
9. Name/SizeName/Size 检测方法：与产品对"重复=内容相同"的定义冲突，且名字匹配易产生误导性建议，违背"敏感项默认待确认"的精神。
10. 独立缓存文件与整载整存：退步。
11. `BTreeMap` 全内存结果模型：我们的结果在 SQL，分页与过滤由查询承担。
12. GUI 专用基建（DelayedSender、ToolStage 全家桶、reference folders 的完整实现）：超出需要。

**许可证边界**：`czkawka_core` 为 MIT，允许复制，但本方案未复制任何代码；如实施中出现逐段复用，必须先登记 `00-overview.md` 第 4 节。

---

## 5. 目标设计

### 5.1 种子问题的正面回答

**Q1：是否需要预哈希？收益如何量化？**
需要，但**只对大文件启用**。我们的持久缓存已把"重复运行"的成本降为零，prehash 的价值集中在**首次哈希大体积 size 碰撞组**。设 `PREHASH_MIN_SIZE = 1 MiB`：低于它的文件直接全量哈希（8KB 采样对小文件无意义，czkawka 对 ≤8KB 也是整读，`mod.rs:240-247`）；高于它的文件先做头+尾各 4KB 的 BLAKE3 采样，按 (size, prehash) 再分组，仅组>1 的成员进入全量哈希。
**量化方式**：不承诺固定数字（收益取决于盘上"同 size 非重复大文件"的多寡），改为两条实测手段——
(a) 实施前用索引估算上限：`SELECT SUM(size * n) FROM (SELECT size, COUNT(*) AS n FROM files WHERE is_dir=0 AND is_stale=0 AND size >= 1048576 AND content_hash='' GROUP BY size HAVING COUNT(*) > 1)` = 不做 prehash 的最坏读取量；prehash 后的读取量 ≈ `8KB × 成员数 + 真重复候选的全量`。两者之差即该盘的实际收益，作为 Task 7 的验收指标之一。
(b) run 结果里记录 `bytes_saved_by_prehash`，长期可观测。
**典型个人盘定性判断**：小文件 size 碰撞占组数大头但字节量小（prehash 不启用，零开销）；大文件碰撞组少但单组字节量巨大（等码率视频、安装镜像、备份包），一对 4GB 非重复文件即省 ~8GB 读——收益下限为 0（盘上恰好全是真重复），上限接近全部大文件碰撞字节量，都不会为负（8KB 采样成本相对全量读可忽略）。

**Q2：哈希缓存？**
已存在且优于参考（第 1.4、3 节）。本模块**不改缓存架构**。唯一增量：prehash 结果**不持久化**——它只在单次 run 内用于淘汰；持久化需加列（schema 变更）且收益仅限"跨 run 的大文件反复进入候选"这一罕见场景（缓存命中的文件根本不进候选）。若未来观测到该场景成立，再由独立任务书加列。

**Q3：组模型与取消语义？**
见 5.4/5.5。取消沿用既有体系：进程内 `AtomicBool` 逐文件（prehash/全量循环内逐块）检查 + durable run 状态机 + `cancel_for_scan` 映射；新增"取消路径先 flush 已算出的哈希批"（对齐 czkawka 的不浪费原则——现状已部分成立，因为批量写入按 500 条滚动，仅需在取消分支补一次 flush）。

### 5.2 Rust 模块结构（`dedupe.rs` 内部重组，不拆文件）

```
dedupe.rs
├── DedupeJobManager（不变）
├── 阶段枚举 DedupePhase { Collecting, Prehashing, Hashing, Finalizing }
├── run_duplicate_detection_job
│   ├── collect: candidate_sizes / candidate_files_for_size（现有 SQL，不变）
│   ├── prehash: size >= PREHASH_MIN_SIZE 的组 → 头尾采样 → (size, prehash) 分组淘汰
│   │           组内含已哈希成员时：对已哈希成员同样做 8KB 采样参与分组
│   │           （给未哈希成员淘汰机会；prehash 相同则未哈希成员仍需全量以与
│   │             已存 content_hash 比对——只淘汰不确认）
│   ├── hash: 工作池并行全量哈希（5.3），身份前后校验与 CAS 批写不变
│   └── finalize: 计数 + complete 事件（新增字节与 prehash 统计字段）
└── 组查询（5.4）
```

### 5.3 并发模型

`std::thread::scope` + `crossbeam` 式手写任务队列（仅用 std 的 `Mutex<VecDeque>`，不新增依赖）：工作线程数 `min(4, available_parallelism)`；任务粒度 = 单文件；每线程复用一块 1MiB 读缓冲（较 czkawka 的 2MB 保守，避免多线程 × 大缓冲的常驻内存）。写入仍由主线程独占（收集各线程结果经 channel——std `mpsc`——统一 CAS 批写），避免 SQLite 写锁竞争，与 scan ledger "commit 后发事件"的既有纪律一致。

### 5.4 组模型：数据、命令与 DTO

**不建新表**——组身份 (size, content_hash) 已在 `files` 表内，缺的只是查询与投影：

- 新查询 `list_duplicate_groups(limit, offset_group)`（keyset 分页，按 `wasted_bytes DESC`）：
  ```sql
  SELECT size, content_hash, COUNT(*) AS member_count,
         (COUNT(*) - 1) * size AS wasted_bytes
  FROM files
  WHERE is_dir=0 AND is_stale=0 AND size>0 AND content_hash<>''
  GROUP BY size, content_hash HAVING COUNT(*) > 1
  ```
- 新查询 `list_duplicate_group_members(size, content_hash)` → 成员 id/path/mtime/last_seen_at。
- Tauri command：`list_duplicate_groups` / `list_duplicate_group_members`，均 `read_only`（无窗口校验，与 `get_scan_run` 同级），登记 `build.rs` allowlist 与权限矩阵。
- TS DTO：`DuplicateGroupDto { size, contentHash, memberCount, wastedBytes }`、`DuplicateGroupMemberDto { id, path, name, mtime, lastSeenAt }`。
- **组 key 即 `(size, contentHash)`**，跨刷新稳定（内容不变则 key 不变），满足选择状态锚定需求。

### 5.5 durable dedupe run（承接 closeout 划给 Task 02 的边界）

沿用 scan ledger 的成熟模式，新表 `dedupe_runs`（schema 27 → 28，含 up/down 与迁移测试）：

```sql
CREATE TABLE dedupe_runs (
  id TEXT PRIMARY KEY,                -- 复用现有 dedupe job id
  parent_session_id TEXT REFERENCES scan_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN
    ('running','completed','cancelled','failed','interrupted')),
  phase TEXT NOT NULL CHECK (phase IN
    ('collecting','prehashing','hashing','finalizing','completed')),
  candidate_files INTEGER NOT NULL DEFAULT 0,
  prehash_pruned_files INTEGER NOT NULL DEFAULT 0,
  bytes_saved_by_prehash INTEGER NOT NULL DEFAULT 0,
  hashed_files INTEGER NOT NULL DEFAULT 0,
  hashed_bytes INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  duplicate_files INTEGER NOT NULL DEFAULT 0,
  skipped_files INTEGER NOT NULL DEFAULT 0,
  error_files INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  started_at INTEGER NOT NULL, finished_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
```

- 状态与阶段更新走 revision CAS（照抄 ledger 纪律，不照抄代码）；进度事件仍高频走内存，**checkpoint 低频落库**（每批 flush 时更新 counters），崩溃后可查"上次跑到哪"。
- 启动恢复：`running` → `interrupted`（对齐 `recover_scan_state` 的模式）；既有派发重放机制会按 at-least-once 重新派发，新 run 借助缓存快速追平。
- **三轴纪律（决策日志 D2）预先适用**：`interrupted/failed` 是作业终态，不得推导为"索引不健康"；重复检测结果（`content_hash`）的可信度只由缓存失效链保证。
- 取消：`cancel_dedupe`/`cancel_for_scan` 置旗标 → run 以 `cancelled` 终态落库；取消分支先 flush 在途哈希批。

### 5.6 事件 payload 与错误码

`dedupe-progress` 增量字段（向后兼容，只增不改）：`phase`、`hashedBytes`、`totalBytes`、`runRevision`。
`dedupe-complete` 增量字段：`prehashPrunedFiles`、`bytesSavedByPrehash`、`hashedBytes`。
错误码（`dedupe_runs.error_message` 前缀）：`io_error` / `identity_mismatch` / `db_error`，沿用现有 `DedupeError` 分类（`dedupe.rs:104-118`）。

### 5.7 前端

- 新 store 切片 `useDuplicateGroupsStore`：组分页加载、成员懒加载、按 `(size, contentHash)` 锚定选择。
- 页面：Vault 内新增"重复文件"视图段（非新路由），组卡片（成员数 / 浪费字节 / 成员列表），操作仅两种——跳转到文件、送入既有清理建议流。**不提供默认勾选，不直接删除**（安全边界 2/3 条）。
- 现 `duplicateOnly` 过滤保留不动。
- 空文件排除边界在该视图加一行说明文案（P7）。

---

## 6. 文件级修改清单

| 文件 | 改什么 | 为什么 |
|---|---|---|
| `src-tauri/src/db/schema.rs` | schema 28：`dedupe_runs` 建表 + 索引；迁移幂等 + 失败回滚测试 | 5.5 |
| `src-tauri/src/db/queries/mod.rs` | 挂新查询模块 | 组查询归位 |
| `src-tauri/src/db/queries/dedupe.rs`（新） | `dedupe_runs` CRUD（CAS）、`list_duplicate_groups`、`list_duplicate_group_members` | 5.4/5.5 |
| `src-tauri/src/dedupe.rs` | 阶段枚举；prehash 采样（头尾 4KB，`PREHASH_MIN_SIZE=1MiB`）；工作池 + mpsc 收集；字节进度；取消 flush；run 落库 checkpoint；事件新字段 | 5.1-5.3/5.6 |
| `src-tauri/src/scanner.rs` | `record_dedupe_dispatch` 时写入 run 行的关联（现有派发链不变） | 5.5 |
| `src-tauri/src/main.rs` | 启动恢复调用 dedupe run 的 interrupted 标记；注册新命令 | 5.5 |
| `src-tauri/build.rs` + `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md` | 新增 2 个 read_only 命令登记 | 权限三方一致 |
| `src/api/tauriApi.ts` / `browserMockApi.ts` | 新命令绑定 + DTO + mock | 5.4 |
| `src/store/useDuplicateGroupsStore.ts`（新） | 组分页/成员/选择状态 | 5.7 |
| `src/views/vault/…` | 重复文件视图段 | 5.7 |
| `src/i18n.ts` | 新文案（中/英） | 5.7 |
| `src-tauri/tests/dedupe.rs` + `dedupe.rs` 单测 | 见 Task 6/7 | — |

---

## 7. 实施拆分

| Task | 内容 | 优先级 | 依赖 | 风险 | 迁移 | 破坏性 | 验收标准 |
|---|---|---|---|---|---|---|---|
| 1 | schema 28 `dedupe_runs` + up/down + 迁移测试 | 高 | — | 低 | **是** | 否（只增表） | 迁移幂等；26/27 fixture 升级通过；失败回滚保持 27 |
| 2 | Rust 核心：prehash + 工作池 + 字节进度 + 取消 flush + run checkpoint | 高 | T1 | 中（并发与 SQLite 写锁） | 否 | 否 | 现有 5 集成测试全绿；新增测试见 T6；`cargo clippy -D warnings` |
| 3 | Tauri 命令：组查询 ×2 + run 查询；allowlist + 权限矩阵 | 高 | T1 | 低 | 否 | 否 | 三方登记一致；read_only 不校验窗口与既有约定一致 |
| 4 | 前端状态：store + API 绑定 + mock | 中 | T3 | 低 | 否 | 否 | typecheck + 单测 |
| 5 | 页面：重复文件视图段 | 中 | T4 | 低 | 否 | 否 | 不出现默认勾选；仅跳转/送建议流两种操作 |
| 6 | 单元测试：prehash 淘汰正确性（同头不同尾/同尾不同头/整读小文件）、并发写 CAS、取消 flush、run 状态机 CAS、interrupted 恢复 | 高 | T2 | 低 | 否 | 否 | 全绿且不削弱既有断言 |
| 7 | 集成与性能：10k 文件夹具含大文件碰撞组，验证 `bytes_saved_by_prehash` 与 5.1(a) 估算一致（±10%）；哈希吞吐 ≥ 单线程基线 ×2（4 核机） | 中 | T2/T6 | 中（机器差异） | 否 | 否 | 性能夹具入 `test:performance` 或 cargo ignored 基准 |

每 Task 独立提交；T1 完成前 T2 不动 schema 相关路径。全程遵守：一个模块一条分支 + PR 系列；`file_ops` 组若在验收中失败，按 `issue-file-ops-flaky.md` §8 协议判定，不得重跑了事。

---

## 8. 证据清单

### Zen Canvas（master `0dfedf6`）

- `src-tauri/src/dedupe.rs:21-25` — 事件名与批量/节流常量
- `src-tauri/src/dedupe.rs:27-102` — `DedupeJobManager`（注册/取消/scan 映射）
- `src-tauri/src/dedupe.rs:104-118` — `DedupeError` 分类
- `src-tauri/src/dedupe.rs:120-154` — progress/complete payload 与 summary
- `src-tauri/src/dedupe.rs:257-377` — 主流水线（含取消、身份校验、批写）
- `src-tauri/src/dedupe.rs:302-305,346,359` — 取消与 skipped 语义
- `src-tauri/src/dedupe.rs:307-337` — 哈希前后身份校验
- `src-tauri/src/dedupe.rs:379-431` — `spawn_duplicate_detection` 与失败事件
- `src-tauri/src/dedupe.rs:433-445` — `cancel_dedupe` 命令
- `src-tauri/src/dedupe.rs:447-461` — BLAKE3 `update_reader`
- `src-tauri/src/dedupe.rs:463-478` — `file_identity`
- `src-tauri/src/dedupe.rs:480-533` — 候选 SQL（size 碰撞 + 未哈希）
- `src-tauri/src/dedupe.rs:535-563` — CAS 批写
- `src-tauri/src/dedupe.rs:565-592` — 重复计数 SQL
- `src-tauri/src/dedupe.rs:594-646` — 进度节流
- `src-tauri/src/dedupe.rs:652-700` — job manager 单测
- `src-tauri/src/db/queries/scan.rs:1841-1847` — **content_hash 失效键 (size,mtime,is_dir)**
- `src-tauri/src/db/queries/files.rs:99-104` — legacy upsert 同款失效
- `src-tauri/src/db/queries/files.rs:639-684,748-762,797-842` — `is_duplicate` 投影 SQL ×3
- `src-tauri/src/scanner.rs:492-543` — 派发恢复（at-least-once）
- `src-tauri/src/scanner.rs:900-902,1059-1106` — 终态派发链
- `src-tauri/src/main.rs:48-56` — 启动重放
- `src-tauri/Cargo.toml:29,31` — blake3 直接依赖；rayon 非直接依赖
- `src/views/vault/components/FileLibraryFilterPopover.tsx:50,83` — duplicateOnly 过滤
- `src/views/organize/organizeModel.ts:88,136` — 整理建议消费 `is_duplicate`
- `src/store/useScanManagerStore.ts:443-449` — dedupe 事件订阅
- `docs/remediation/TASK_01A_IMPLEMENTATION_CLOSEOUT.md:69` — durable dedupe/prehash/组划入 Task 02 的既有边界

### czkawka @ `3c3523a`（`czkawka_core`，MIT）

- `czkawka_core/Cargo.toml:8` — license = "MIT"
- `src/tools/duplicate/mod.rs:33-34` — `PREHASHING_BUFFER_SIZE = 4KiB`、`THREAD_BUFFER_SIZE = 2MiB`
- `src/tools/duplicate/mod.rs:41-46` — `DuplicateEntry`
- `src/tools/duplicate/mod.rs:86-93` — `DuplicateFinderParameters`
- `src/tools/duplicate/mod.rs:115-127` — `DuplicateFinder` 结果表结构
- `src/tools/duplicate/mod.rs:222-247` — `hash_calculation_limit`（头+尾采样，小文件整读）
- `src/tools/duplicate/mod.rs:297-322` — `hash_calculation`（缓冲循环 + 字节计数 + 逐块取消）
- `src/tools/duplicate/core.rs:288-302` — size 阶段统计
- `src/tools/duplicate/core.rs:317-359` — prehash 缓存加载/保存与体积阈值
- `src/tools/duplicate/core.rs:362-473` — prehash 阶段（rayon、合并再分组、组>1 晋级）
- `src/tools/duplicate/core.rs:399-401,574-576` — `with_max_len(3)` 并行粒度
- `src/tools/duplicate/core.rs:436-454` — 缓存与新算合并防漏检
- `src/tools/duplicate/core.rs:476-538` — 全量哈希缓存
- `src/tools/duplicate/core.rs:541-625` — 全量哈希阶段
- `src/tools/duplicate/core.rs:606` — 停止后仍保存缓存
- `src/tools/duplicate/core.rs:702` — 缓存文件命名（按算法/阶段分文件）
- `src/common/cache.rs:122,172` — modified_date 失效比对
- `src/common/cache.rs:291` — `load_and_split_cache_generalized_by_size` 三分
