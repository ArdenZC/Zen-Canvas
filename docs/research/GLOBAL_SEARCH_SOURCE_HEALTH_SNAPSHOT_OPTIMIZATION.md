# #359 Global Search Source-health Snapshot 优化审计

> 状态：production SQL 的受控 500k Windows Hosted 诊断（run `38030877088`）和 production source SHA `cd02f47ac4994413106d0ddfeabc6cfa9caf1530` 的 Exact-HEAD CI（run `38030877064`）均 SUCCESS；完整等价、revision hash 与 12/12 correctness 均通过。最终 PR 仍 OPEN / Draft，Issue #359 仍 OPEN。性能结论只在 Windows Hosted 合成 SQLite fixture 上成立，不能代表 Windows/macOS 实机文件系统或完整 Tauri IPC/UI 延迟。

## 1. 基线与审计范围

| 项目 | 证据 |
|---|---|
| Repository | `ArdenZC/Zen-Canvas` |
| 起始 `origin/master` | `d3f6bb9da163a3fcf236ecba61827d99f084af61`，开始前 fetch 后核验 |
| 分支 | `fix/issue-359-global-search-source-health-snapshot` |
| Draft PR | [#361](https://github.com/ArdenZC/Zen-Canvas/pull/361)，OPEN / Draft |
| Issue | [#359](https://github.com/ArdenZC/Zen-Canvas/issues/359)，OPEN |
| #358 post-merge CI | run `38024962557`，SUCCESS |
| #352 500k 根因诊断 | run `38020014723`，artifact `11658812266`；source SHA `da23bd2f501e39d843ccd99af6b832ef140028cb`；ZIP SHA-256 `c52096acda9f9484ab453cb5f753b275988d66d913b7d0d607941553590eda6c` |
| 变更边界 | repository source-health SQL、隔离测试/诊断、benchmark workflow 触发路径与报告；不改 Schema、IPC、prefix/FTS 搜索语义、性能门槛、写路径或 AI 逻辑 |

其他同时打开的 PR 已检查：#335、#356，与此次 source-health 聚合无关。审计未合并 PR、未更改 Issue 状态、未运行 Codex Review、未运行 1m/更大 benchmark，也未启动 #360。

原 #352 报告 `docs/research/GLOBAL_SEARCH_500K_QUERY_COST_INVESTIGATION.md` 记录了 500k Hosted Windows source-health SQL p95 `789.753ms`，完整 no-result `search_global_entries_snapshot()` p95 `864.608ms`，FTS invoice snapshot p95 `897.621ms`。该 fixture 是合成 SQLite 行，不是 500k 实际文件。旧诊断 SQL 执行约 `18,500,060` VM steps，并有 GROUP BY 与 ORDER BY 临时 B-tree；index-status p95 `18.646ms`，不是主要热点。

## 2. Zen Canvas 当前生产架构与合同

### 搜索调用路径

`src-tauri/src/global_index/commands.rs::search_global_entries` 校验请求后调用 `Database::search_global_entries_snapshot()`，然后在事务提交后读取 coordinator/provider 状态，计算 coordinator conflict、`collection_complete` 与 `result_state`，最终构造 `GlobalSearchResponse`。本次只审计 Repository snapshot 内 source-health 聚合。

`src-tauri/src/global_index/repository.rs::Database::search_global_entries_snapshot` 的执行顺序是：

1. 从连接池借连接并 `BEGIN` SQLite 读事务；
2. 在该事务内读取搜索结果；
3. 读取 source-health 与 `source_revision`；
4. 在同一事务内读取 `GlobalIndexStatus`；
5. 提交事务，再返回完整 snapshot。

因此搜索结果、每个 volume 的健康状态、revision facts 与 index status 共享同一数据库快照。本次候选没有把这些读取拆出事务。

### 原始 source-health SQL

```sql
SELECT gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at,
       COUNT(ge.id), MAX(ge.last_seen_at)
FROM global_volumes gv
LEFT JOIN global_entries ge
  ON ge.volume_id = gv.id AND ge.is_stale = 0
GROUP BY gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at
ORDER BY gv.id ASC
```

`repository.rs::load_global_search_sources_from_connection` 将每行映射为完整 `GlobalSearchSourceHealth` 和有序 `GlobalSearchRevisionFact`；后者以 serde JSON 字节序列化，再经 BLAKE3 输出十六进制 `source_revision`。source-health 覆盖 disabled volume。查询必须实际计数并求最大 `last_seen_at`；`global_volumes.entry_count` 是维护字段，不能替代真实 active row count。

### 原热点

#352 的 Windows Server 2025 synthetic 500k 诊断将热点定位到这条 source-health 聚合：原 SQL 的 p50/p95/p99、完整计划及 counters 会在本次 artifact 的 baseline record 中复核。旧报告的计划显示按 volume 索引访问 entries，再对宽 volume 字段 GROUP BY，并为 GROUP BY、ORDER BY 各创建临时 B-tree。它每次 Global Search snapshot 都运行，即使搜索返回 0 条结果也照样运行。

## 3. 候选查询与预期机制

候选在本次受控诊断之前仅以 `#[cfg(test)]` 暴露，不改变发布版 SQL。每个候选通过 production `search_global_entries_snapshot()` 的 test-only 查询覆盖点运行，因此搜索、连接池、读事务、index-status、结果排序/分页与错误传播均走完整入口。

### Candidate A：逐 volume 相关子查询

```sql
SELECT gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at,
       (SELECT COUNT(ge.id)
        FROM global_entries ge
        WHERE ge.volume_id = gv.id AND ge.is_stale = 0),
       (SELECT MAX(ge.last_seen_at)
        FROM global_entries ge
        WHERE ge.volume_id = gv.id AND ge.is_stale = 0)
FROM global_volumes gv
ORDER BY gv.id ASC
```

预期可避免宽 GROUP BY，但 COUNT 与 MAX 是两次相关扫描，且按 volume 数量重复。该候选不是默认更快；以本次同 fixture 配对测量及执行计划决定是否拒绝。

### Candidate B：按窄 volume key 预聚合后连接

```sql
WITH active_volume_facts AS (
    SELECT volume_id,
           COUNT(id) AS active_entry_count,
           MAX(last_seen_at) AS max_last_seen_at
    FROM global_entries
    WHERE is_stale = 0
    GROUP BY volume_id
)
SELECT gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at,
       COALESCE(active_volume_facts.active_entry_count, 0),
       active_volume_facts.max_last_seen_at
FROM global_volumes gv
LEFT JOIN active_volume_facts ON active_volume_facts.volume_id = gv.id
ORDER BY gv.id ASC
```

该形状只按 `volume_id` 聚合 entries，再将一行聚合事实左连接给每个 volume。外层 `LEFT JOIN` 保留空卷/全部 stale 卷以及 disabled volume；外层 `ORDER BY gv.id ASC` 维持稳定次序。这里使用 `COUNT(id)` 而非 `COUNT(*)`，保持原 `COUNT(ge.id)` 在 nullable row-id fixture 上的精确语义。没有使用方便计数列、缓存、Schema、索引或持久化数据。

### Candidate C：按唯一 volume ID 分组的原式 JOIN

复核 Candidate B 的执行计划后，另做一次非正式 Python SQLite 小规模预检，检查能否只对唯一的 `gv.id` 分组，同时选择由该 volume 行决定的字段：

```sql
SELECT gv.id, gv.enabled, gv.provider, gv.index_status, gv.last_error, gv.updated_at,
       COUNT(ge.id), MAX(ge.last_seen_at)
FROM global_volumes gv
LEFT JOIN global_entries ge
  ON ge.volume_id = gv.id AND ge.is_stale = 0
GROUP BY gv.id
ORDER BY gv.id ASC
```

50k / 10-volume Python SQLite `3.53.1` 预检的 plan 仍按 `(volume_id,is_stale)` 对每个 volume seek，没有宽字段 GROUP BY / ORDER BY temp B-tree。在全 active 数据上 p95 `14.270ms`（原始 `35.967ms`，B `11.064ms`）；90% stale 数据上 p95 `1.303ms`（原始 `3.642ms`，B `2.717ms`）。四个 SQL 的有序 source facts 在这个简化 fixture 中相同。Candidate C 有希望在 stale-heavy 情形减少 B 的全索引扫描；但没有同 Rust fixture、Windows SQLite `3.51.3`、500k 数据或实际 Repository snapshot 的 paired evidence，所以本次不把 C 作为生产实现，也不把该短样本作为正式基准。

## 4. 语义与同一快照验证

新增隔离测试位于 `src-tauri/src/global_index/tests/global_search_source_health.rs`，两候选均与原始查询逐行比较：

- 0 volume、空 volume、多个 enabled/disabled volume、volume ID 排序；
- 有 active/stale 混合、全部 stale、NULL `last_seen_at`、相同最大时间；
- 一个临时 shadow table 注入 `id IS NULL` 行，验证 `COUNT(id)` 与 `COUNT(ge.id)` 一样排除 NULL，而 `MAX` 保留 NULL 语义；
- 故意使 `global_volumes.entry_count` 与真实行数不一致，确认查询采用 active entries 实数；
- 修改非最大/并列最大/新最大时间，检查 revision 对应变化；插入、删除、stale、恢复 entry；
- 切换 volume enabled、provider、index status、last_error、updated_at；
- 比较完整有序 revision fact JSON bytes 与 BLAKE3 `source_revision`，而不只比较公开 source-health；
- 比较完整 snapshot 中 search results、source-health、revision、index status；
- 32 轮 barrier 控制 reader/writer 交错：先由 reader 建立事务快照，再让 writer 完成 volume 状态与 stale/restore 更新，然后在 reader 原事务中依次比较原 SQL 与候选。这样比较的是同一逻辑 SQLite snapshot，不把事务间正常变化误判成查询不等价。

Hosted 500k 诊断也在每轮 SQL/function/snapshot 配对中检查 row/facts/revision 与完整返回值相等。具体测试数、Hosted correctness record 与结果以最终 artifact 记录为准。

## 5. 500k Hosted 配对诊断设计

### 小数据预检（仅方向性）

在执行受控 Hosted run 前，以 Python SQLite `3.53.1` 做过两次 50k / 10-volume 短样本预检。全 active 的 5-sample 查询预检：原 SQL p50/p95 `37.077/37.184ms`，Candidate A `36.404/37.329ms`，Candidate B `22.887/26.093ms`。随后追加 Candidate C 与 90% stale 场景，5 warmups / 30 samples，数值见上节。它们都不是 Rust production path 或 Windows Hosted `3.51.3`，只作方向性/风险证据；生产选择以 500k 同 runner artifact 为主，stale-heavy 与多-volume外推仍是 residual risk。

| 项目 | 设置 |
|---|---|
| Workflow | `Global Search synthetic benchmark`，固定 `source_health_diagnostic`、500,000 行 |
| 初次受控 run | `38026682828`，attempt 1，Windows Hosted；源码 SHA `b7ff5bda49bf45a13f526bb6e241502adbad1091` |
| fixture | 单个 synthetic SQLite fixture；原 SQL 与 A/B 交替复用，不为候选重复生成 DB |
| 样本 | 每候选 5 次 warmup、30 次交替 paired warm samples；报告 p50/p95/p99 |
| 测量范围 | SQL-only；source-health 完整函数（行映射、JSON revision facts 序列化、BLAKE3）；完整 repository snapshot；actual `Database::search_global_entries_snapshot()` 对 test-only candidate snapshot |
| snapshot query class | no-result `zzznomatchtoken`、prefix `quarterly`、high-fanout FTS `report`；样本包含 search/source/revision/index-status 同事务工作 |
| Query counters | SQLite VM steps、SORT、Fullscan steps；完整 EXPLAIN QUERY PLAN、SQL、参数、行数和数据库文件大小写入 JSONL |
| 正确性 | 官方既有 12 类 query correctness 复核；source-health candidate SQL 与 full snapshots equality |
| 写入/Schema | 不加持久索引或 migration；临时诊断数据使用 rollback；保留原正式 100ms gate |

单个 workflow 运行耗时较长，是因为 Windows Hosted 需要准备/生成 500k 合成数据并运行现有查询阶段诊断。此 run 不重跑官方 500k 性能门槛矩阵，不运行 1m。两次 diagnostic 都是 attempt 1；首轮用于 A/B 与实际入口预验证，第二轮在 production SQL 源 SHA 上验证最终实现。两次均记录 artifact、哈希、SQLite 与 runner/OS 版本。

### Hosted 配对测量结果

下面各 cell 为同 runner、同 fixture 配对样本。`SQL / fn` 分别是 SQL-only / 完整 source-health 函数，单位 ms。`Snapshot` 为整个 repository snapshot，单位 ms。无结果、prefix、FTS 分列，不将不同入口阶段的延迟相减作为严格因果归因。

| 测量 | 原 p50 / p95 / p99 | Candidate B p50 / p95 / p99 | 样本 |
|---|---:|---:|---:|
| Source-health SQL | 1153.417 / 1171.716 / 1227.177 | 267.036 / 287.758 / 298.672 | 每组 30，5 warmup |
| 完整 source-health 函数 | 1250.215 / 1269.309 / 1277.997 | 363.257 / 384.596 / 388.372 | 每组 30，5 warmup |
| Repository snapshot：no result | 1296.740 / 1311.050 / 1316.009 | 409.981 / 419.680 / 422.463 | 每组 30，5 warmup；0 results |
| Repository snapshot：prefix `quarterly` | 1515.496 / 1552.570 / 1562.026 | 630.061 / 643.555 / 647.589 | 每组 30，5 warmup；80 results |
| Repository snapshot：FTS `report` | 1663.265 / 1735.612 / 1744.893 | 748.901 / 874.966 / 935.985 | 每组 30，5 warmup；80 results |

Candidate A 的相同配对 p95：SQL `1187.856 → 384.049ms`，source-health 函数 `1280.653 → 591.125ms`，完整 snapshots no-result `1373.824 → 632.109ms`、prefix `1523.914 → 841.669ms`、FTS report `1746.382 → 1003.868ms`。A 比原 SQL 快，但 B 的每项 p95 都更低；全 active 的 50k/10-volume 预检中 A p95 `37.329ms`，接近原 SQL `37.184ms`，也慢于 B 的 `26.093ms`。因此在现有 500k evidence 下选择 B，拒绝 A 作为默认生产形状。Candidate C 的 stale-heavy 小样本有优势，但缺少正式大 fixture 与 Rust production snapshot 证据，不足以替换本次 B 的选择。

在独立的 actual-entrypoint validation record 中，真实 `Database::search_global_entries_snapshot()` 的旧生产路径与 test-only Candidate B snapshot helper 同 runner 交替比较：

| Query | 原 production entrypoint p50 / p95 / p99 | Candidate B snapshot helper p50 / p95 / p99 | source-health / revision / index / results |
|---|---:|---:|---|
| no result | 1319.028 / 1612.042 / 1649.837 | 412.139 / 438.133 / 440.900 | 全部相等 |
| prefix `quarterly` | 1541.306 / 1816.608 / 1845.158 | 642.931 / 732.066 / 761.885 | 全部相等 |
| FTS `report` | 1668.188 / 1787.972 / 1881.240 | 742.567 / 796.836 / 800.304 | 全部相等 |

该 record 在真实 Repository snapshot method 与候选之间只通过 `#[cfg(test)]` thread-local 覆盖 source-health SQL；候选仍在同一个 method、同一个读事务中运行，search、index-status、pool checkout、事务边界和完整返回结构没有改写。`repository_snapshot_paired` 表与 actual-entrypoint validation 的样本顺序/计时环节略有不同，应分别引用，不能彼此替换。

### 最终 production-source Hosted 验证

生产改动提交 `cd02f47ac4994413106d0ddfeabc6cfa9caf1530` 的 500k run `38030877088` / attempt 1 / job `114151377167` 于 Windows Hosted SUCCESS（44m52s）。Artifact ID `11662358132`，ZIP SHA-256 `393ad4571eb5eb3fd3570d91873c4c8065aa28955ad5173c1b0e144af9b7eb6d`，JSONL SHA-256 `baba395fc424378234805f62fbd51453012489fd01286c7b25587b37f47f421f`。文件缓存于 `/workspace/.cache/zen-canvas/issue359/evidence/38030877088/`。原始记录确认 source SHA、run ID、attempt、Windows x86_64、`win25-vs2026` / `20260925.250.1`、SQLite `3.51.3`。500k fixture population `1,272,175.311ms`；主库 `655,818,752 bytes`、WAL `23,768,312 bytes`、合计 `679,587,064 bytes`；`temp_store=MEMORY`。无进程 CPU/RSS 样本。

最终 run 同一 fixture、同一 Windows runner 上每组 5 warmups / 30 交替 warm samples：

| 测量 | 原 SQL p50 / p95 / p99 | Candidate B p50 / p95 / p99 | 样本 |
|---|---:|---:|---:|
| Source-health SQL | 1152.043 / 1191.642 / 1196.385 ms | 260.159 / 269.662 / 283.143 ms | 每组 30，5 warmup |
| 完整 source-health 函数 | 1223.958 / 1257.650 / 1295.087 ms | 344.817 / 351.322 / 354.601 ms | 每组 30，5 warmup |
| Repository snapshot：no result | 1281.237 / 1328.452 / 1333.700 ms | 396.232 / 417.145 / 429.331 ms | 每组 30；0 results |
| Repository snapshot：prefix `quarterly` | 1524.593 / 1709.584 / 1822.783 ms | 640.892 / 753.081 / 766.486 ms | 每组 30；80 results |
| Repository snapshot：FTS `report` | 1668.645 / 1764.120 / 1789.730 ms | 745.455 / 825.244 / 839.858 ms | 每组 30；80 results |

这里的 `repository_snapshot_paired` 两侧均通过同一个 repository snapshot method 与同一读事务运行，原 SQL 通过 test-only override 注入；三类 query 的 search results、source-health、source_revision、index status 全部相等。实际未覆盖 override 的 production `Database::search_global_entries_snapshot()` 也在该 run 上测得：no-result `410.832 / 432.649 / 454.832ms`、prefix `625.274 / 658.827 / 663.086ms`、FTS `733.098 / 770.355 / 784.847ms`（p50/p95/p99，n=30），并逐项与 Candidate B helper 返回值相等。旧 production entrypoint 的配对基线来自首轮 run `38026682828`；不要把跨 run 原始 p95 当成配对因果值，本节采用同 run 的 `repository_snapshot_paired` 作为 before/after。

Candidate A 最终 run p95 仍慢于 B：SQL `1195.447 → 380.071ms`、完整 source-health function `1301.811 → 598.934ms`、snapshot no-result `1316.512 → 608.040ms`、prefix `1572.107 → 863.834ms`、FTS `1718.325 → 1001.857ms`（每组 n=30）。最终 Candidate B 事实/完整 snapshot equality 均为 true；`revision_facts_bytes_and_blake3_equal=true`，12/12 official query correctness PASS，`diagnostic_complete` PASS，rollback 后保留 500,000 base rows；没有 Schema/index 变化、正式 performance gate 改动、官方完整 gate matrix 重跑或 1m run。

Candidate A 最终 run 的完整分位数也保留在 artifact；以下原 SQL/A 数值各自来自同一个交替配对（n=30，5 warmups），单位 ms：

| 测量 | 原 SQL p50 / p95 / p99 | Candidate A p50 / p95 / p99 |
|---|---:|---:|
| Source-health SQL | 1156.934 / 1195.447 / 1241.779 | 372.618 / 380.071 / 387.124 |
| 完整 source-health 函数 | 1241.456 / 1301.811 / 1329.336 | 546.852 / 598.934 / 650.454 |
| Snapshot：no result | 1277.130 / 1316.512 / 1341.586 | 592.966 / 608.040 / 615.931 |
| Snapshot：prefix `quarterly` | 1522.773 / 1572.107 / 1578.766 | 840.961 / 863.834 / 870.220 |
| Snapshot：FTS `report` | 1621.430 / 1718.325 / 1737.837 | 948.301 / 1001.857 / 1021.488 |

最终 run 的 SQL plan 和 StatementStatus 与首轮一致：原 SQL 18,500,060 VM / 2 SORT / 0 Fullscan，A 5,500,045 / 0 / 0，B 7,500,077 / 0 / 499,999。最终 source-health SQL p95 为 `1191.642 → 269.662ms`（降低 77.4%）；同 run no-result/prefix/FTS snapshot p95 分别为 `1328.452 → 417.145ms`（68.6%）、`1709.584 → 753.081ms`（55.9%）、`1764.120 → 825.244ms`（53.2%）。Candidate B 仍然全扫 entries 索引，CPU/RSS、memory peak 和 stale-heavy 500k 多卷拓扑没有测；这是明确的剩余风险。

### 执行计划与 SQLite counters

```text
Original:
SCAN gv USING INDEX sqlite_autoindex_global_volumes_1
SEARCH ge USING INDEX idx_global_entries_volume (volume_id=? AND is_stale=?) LEFT-JOIN
USE TEMP B-TREE FOR GROUP BY
USE TEMP B-TREE FOR ORDER BY

Candidate A:
SCAN gv USING INDEX sqlite_autoindex_global_volumes_1
CORRELATED SCALAR SUBQUERY 1
SEARCH ge USING INDEX idx_global_entries_volume (volume_id=? AND is_stale=?)
CORRELATED SCALAR SUBQUERY 2
SEARCH ge USING INDEX idx_global_entries_volume (volume_id=? AND is_stale=?)

Candidate B:
MATERIALIZE active_volume_facts
SCAN global_entries USING INDEX idx_global_entries_volume
SCAN gv USING INDEX sqlite_autoindex_global_volumes_1
SEARCH active_volume_facts USING AUTOMATIC COVERING INDEX (volume_id=?) LEFT-JOIN
```

每次 SQL 查询产生 1 个 source-health 行，SQL 无绑定参数；schema/index changes=false。SQLite StatementStatus 为最后一次查询的 counters：

| SQL | VM steps | SORT operations | Fullscan steps |
|---|---:|---:|---:|
| Original | 18,500,060 | 2 | 0 |
| Candidate A | 5,500,045 | 0 | 0 |
| Candidate B | 7,500,077 | 0 | 499,999 |

B 消除了两项临时排序，VM steps 比原 SQL 少 59.5%，SQL p95 少 75.4%；代价是扫描 `idx_global_entries_volume` 上 500k rows（SQLite Fullscan counter 499,999），并 materialize 聚合 CTE / 创建自动 covering index。它不是“避免扫描”：它以一次全索引聚合扫描替代 volume 查询及宽 GROUP BY/ORDER BY。A 无 fullscan/sort，p95 仍慢于 B。VM steps、SORT 与 Fullscan 是工作量计数，不代表 CPU 时间、临时存储字节或内存峰值。

首轮 run artifact：run `38026682828` / attempt 1 / job `114138897338`，结论 SUCCESS；source SHA `b7ff5bda49bf45a13f526bb6e241502adbad1091`。artifact ID `11661506696`，ZIP SHA-256 `27dff119839559c825b59a05d20d6a295d9894dfc1883f369b8fc16f7a217091`，JSONL SHA-256 `ff2e3626b6ee16d281f3b48165f00c046745bc4a0641aa549882abbd6136d4a5`。最终 production-source run 的 run/source/artifact/digests 见上一节。Hosted environment 两次均为 Windows x86_64 image `win25-vs2026` / `20260925.250.1`、SQLite `3.51.3`；单个合成 DB、同一 fixture 重复配对，没有为候选分别建库。

该 run 的 process CPU 与 working set/RSS **NOT CAPTURED**。候选不新增持久表、持久索引、migration 或 writer 工作；source-health SQL 本身只读，临时物化发生在 SQLite memory temp-store。fixture 只含一个 source row，50k/10-volume quick precheck 为 10 volumes；500k 多 volume 严格性能曲线/峰值 memory 未测。

上面的 plan 块列出每个 SQL 的完整 operator 输出，不是摘要。生产替换门槛是：事实/哈希/事务等价、候选有稳定且显著的 SQL 和完整 snapshot 收益、没有新增持久写入/索引或额外磁盘数据；SQLite 临时内存的峰值、进程 CPU 与 RSS 没有从首轮 artifact 采集，仍作为残余风险报告，不能据此宣称资源成本为零。

## 6. 100k / 500k 与现有正式门槛

历史 #350 500k 正式 fixture 的既有 correctness/page assertions 是 12/12 PASS，而原 100ms warm p95 只通过 5/12（7 项失败，主要是高命中 prefix/FTS）；本 issue 不修改这些正式门槛，也不宣称全局搜索已经达标。历史 #352 100k 对照仅为独立 run，FTS report/invoice 命中 5,000 条，warm p95 为 47.373/45.921ms；它与 500k 不是同源 runner 配对数据。

PR CI run `38026682784`（attempt 1，SHA `b7ff5bda49bf45a13f526bb6e241502adbad1091`）已完成，overall FAILURE。Source checkout/change-scope/validation plan、Windows Global Index service qualification、Windows/macOS Rust quality、Windows/macOS release compile、Windows quality、六个 performance shards（包括 Search、Workspace Foundation）和 Performance profile aggregate 均 SUCCESS。macOS Quality aggregate FAILURE 是 native performance 依赖失败传递，不是 Rust quality 编译/测试失败。

唯一失败的 native performance job `114138992324`（`Native macOS performance (arm64) (merge_integration)`）在 Workspace Foundation 的 `managed_scan_admission_fails_closed_after_busy_timeout_without_partial_authority` 用例中失败：

```text
admission did not fail boundedly at the busy timeout: timed out waiting on channel
test ...managed_scan_admission_fails_closed_after_busy_timeout_without_partial_authority ... FAILED
Prepared performance binary failed with exit code 101.
```

失败日志定位到 `src/db/queries/scan.rs:3626:27`，是 #345 managed-scan SQLite busy-timeout 用例，不属于本 PR 修改范围。run `38026682784` 保留，未手工 rerun 或改写其失败结果，也没有把 Performance profile aggregate PASS 混称为 native job 通过。

production source SHA `cd02f47ac4994413106d0ddfeabc6cfa9caf1530` 的 exact-code CI run `38030877064` 已总体 SUCCESS。Source checkout / evidence contract、change-scope / routing contract、Windows Global Index service qualification、validation plan、Windows/macOS Rust quality、Windows/macOS Release compile、Native macOS performance、六个 100k performance shards（Search、Workspace Foundation、Preview Platform、Library & Content、Scan & Schema、Intelligence）及 Performance profile 均 SUCCESS。这个新 CI run 包含正常 PR 验证，不是对旧 run 的手工重跑；#345 忙锁用例没有再次失败。另有 final report-only commit 的 PR-head CI 在提交后单独记录于最终回复；生产代码 SHA 与本节 production-source 500k run 一致。

本 issue 的 500k source-health diagnostic 与历史官方 12 类性能 gate 分开。最终 source-health diagnostic 的 12 类既有 query correctness 检查为 12/12 PASS；没有重跑官方 gate performance matrix，没有改 100ms 门槛，也没有跑 1m/更大数据。Hosted 合成 SQLite 结果只证实对应数据库场景，不解释为 NTFS/APFS、真实文件系统枚举、实机资源占用或 macOS 体验。

**平台边界：**source-health SQL 性能诊断仅在 Windows GitHub Hosted runner 上执行。Windows/macOS Hosted Release compile、Rust quality 和 native performance suite 通过，但这些结果不是 macOS source-health 500k SQLite 性能测量。macOS 原生 Global Search source-health SQL 性能为 NOT VERIFIED；Owner 的 Windows/macOS 实机 Tauri/UI/IPC/文件系统 latency 也为 NOT VERIFIED。

## 7. 性能、资源与正确性风险

候选 B 把原先按 volume 索引 seek + 宽字段 GROUP BY/ORDER BY 改成 active entries 索引全扫、窄键聚合 CTE 及临时 materialization。最终 plan 的 Fullscan counter 是 499,999，虽 VM step 从 18.5m 降至 7.5m 且同-run SQL/snapshot p95 显著改善，但 stale-heavy/多卷 500k 和 CPU/RSS/临时内存峰值未测；不能把本次 one-volume 结果推广到所有拓扑。该只读查询未变更持久 DB schema/index、没有新增持久写放大或磁盘数据，`temp_store=MEMORY`；内存峰值仍是残余风险。

语义风险集中在 LEFT JOIN 对空卷的保留、stale 过滤位置、NULL 与 `COUNT(id)`、volume 稳定排序、revision fact 字段顺序/序列化和事务快照边界。新增 fixtures 对这些点均设有显式比较。500k artifact 标记 12/12 既有 search correctness classes 通过、`diagnostic_complete` 成功、rollback 后仍为 500,000 rows、无 schema/index change、未改正式 100ms gate。连接池、search tier、pagination/window、FTS/prefix SQL、source_revision 算法及错误传播没有计划改动。

## 8. 本地验证记录

在 production SQL 补丁 `cd02f47ac4994413106d0ddfeabc6cfa9caf1530` 上完成：

| 检查 | 结果 |
|---|---|
| `cargo test --manifest-path src-tauri/Cargo.toml --lib global_index::tests:: -- --nocapture --test-threads=1` | 22 passed、0 failed、3 个现有 100k/500k benchmark ignored；包含 4 个 source-health semantic cases、并发 writer/read snapshot、source revision consistency |
| Linux Cargo 环境 | 因仓库仅在 Windows/macOS target 引入 keyring，为本地 test build 临时追加 `keyring` `linux-native` dev dependency；退出 trap 恢复 `Cargo.toml`/`Cargo.lock`，两者没有 diff。构建只有既有 `atomic_move.rs` unused-variable warnings |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `actionlint .github/workflows/global-search-benchmark.yml` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:performance:architecture` | 3 files / 30 tests PASS |
| `npm run test:governance` | PASS |
| `npm test -- --reporter=dot` | 重跑 PASS：175 files / 1,860 tests；182.77s。首次同样 1,860 个测试通过，但 Vitest 在结束时收到 `fileLibraryW205Interaction.test.ts` teardown 后的异步 `window is not defined`，所以首次命令 exit 1；单独重跑该文件 11/11 PASS。重跑结果用于判定整套测试通过，首次异步异常作为一次时序波动保留记录 |
| `DOCS_DIFF_BASE=origin/master DOCS_DIFF_HEAD=HEAD npm run test:docs` | PASS：最终报告内容在 diff 中由 checker 检查（1 个 Markdown 文件）；governance PASS |

除报告外，本地 test 所需的临时 Cargo 依赖不在提交中。上述测试未执行 ignored 100k/500k benchmark；正式 500k Hosted 证据由本报告单列的 diagnostic runs 提供。

## 9. 结论与实施建议

性能根因由真实 SQL/plan 和同 runner、同 fixture 的配对测试确认：source-health 每次 snapshot 都计数全部 active entries 并求 `MAX(last_seen_at)`，原宽 GROUP BY/ORDER BY 在 500k 上产生 2 个临时排序。最终 production-source 500k run 上 SQL p95 `1191.642 → 269.662ms`（下降 77.4%），完整 source-health function `1257.650 → 351.322ms`（下降 72.1%）；完整 Repository snapshot 的 no-result/prefix/FTS p95 分别 `1328.452 → 417.145ms`（下降 68.6%）、`1709.584 → 753.081ms`（下降 55.9%）、`1764.120 → 825.244ms`（下降 53.2%）。实际 production `search_global_entries_snapshot()` 当前 p95 是 no-result `432.649ms`、prefix `658.827ms`、FTS `770.355ms`；结果与 Candidate B helper 完整相等。仍都高于 100ms；本任务没有宣称 Global Search 全面达标，也没有改原始 100ms 门槛。

Candidate B 在生产 SQL 源 SHA `cd02f47ac4994413106d0ddfeabc6cfa9caf1530` 的最终 Hosted run `38030877088` 上通过：12/12 correctness、完整 source-health facts、revision JSON/BLAKE3 与三类完整 snapshot facts/results 相等；SQLite 计划/counters 方向与首轮一致。Local source-health/adversarial/concurrency tests 为 22 passed、3 个既有 benchmark ignored；生产源 Exact-HEAD CI `38030877064` SUCCESS。生产改动只替换 `repository.rs` 的 source-health SQL 查询字符串，保留 `GlobalSearchRevisionFact` 字段/序列化、BLAKE3、同一个 SQLite read transaction、row mapping、错误处理和所有搜索语义。

建议 Owner 接受这个限范围 SQL 优化进入审查：Windows Hosted one-volume 500k 上收益大且重复测得，Candidate A 更慢，Candidate C 只有小规模 exploratory evidence。剩余风险要在审查中明确：B 对所有 entries 的索引全扫；CPU/RSS/temporary memory 峰值和 stale-heavy、多卷 500k 未测。SQLite query 只读，不新增 Schema/索引/写入或持久磁盘数据；这些事实不能替代未测资源峰值。macOS source-health SQL 性能和真实 Windows/macOS Tauri/IPC/文件系统体验仍 NOT VERIFIED。

本次没有实现索引 schema 重构、缓存或事务外快照。Owner 决定前不合并、不关闭 Issue、不启动 #360。

### 建议任务拆分

1. Owner 复核最终 run `38030877088` 的 JSONL artifact、原始/Candidate B 计划与所有分位数；
2. Owner 审阅 `repository.rs` 中的最小查询替换以及 adversarial/concurrency tests；
3. Owner 在真实 Windows/macOS 设备上做 Global Search 端到端 smoke/延迟验收；Hosted 结果不能代替；
4. 只有另行授权后再讨论 prefix/FTS 或其他瓶颈，避免在 #359 里扩展范围。

**最终状态：`#359 SOURCE-HEALTH OPTIMIZATION QUALIFIED — READY FOR OWNER REVIEW`**
