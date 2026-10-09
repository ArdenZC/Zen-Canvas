# Zen Canvas #346：Global Search FTS Join Order 与无结果延迟调查

> 状态：根因已确认，局部生产 SQL 修复已通过 100k benchmark 和相关 PR CI。Draft PR 保持 OPEN，等待 Owner 审阅；Issue #346 保持 OPEN。

## 1. 基线与范围

- 仓库：`ArdenZC/Zen-Canvas`
- Issue：[#346](https://github.com/ArdenZC/Zen-Canvas/issues/346)，保持 OPEN。
- 本地开始时给定基线：`0c449912af4b2790df118ff35d5ee9a8e27cb0c9`。
- 重新 fetch 后最新 `origin/master`：`4e04038b9ff6dccabfb8314bbdb830e9a2a79224`（#344 CI aggregate evidence）。新增提交只改 CI 聚合 workflow/contract，没有触及 Global Search、SQLite 或 Global Index；本分支已 rebase 到此 SHA。
- #343 post-merge CI run `37911655350`，source `0c449912af4b2790df118ff35d5ee9a8e27cb0c9`：`SUCCESS`。
- 为解释修复后普通查询相对 #342 的 p95 抬升，曾在未改搜索实现的起始 master `4e04038b9ff6dccabfb8314bbdb830e9a2a79224` 启动 Windows Hosted 100k 对照 run `37920457777`。它在 11 分钟后仍停留于旧版完整 benchmark step；因该已知慢路径可能令整套矩阵耗时很长，已主动取消。没有使用可能产生的部分 artifact，也没有从该 run 得出对照分位数。
- 开始审计时检查了 Open/Draft PR：#344 已由上述 `4e04038` 合并；唯一仍 open 的既有 Draft PR #335 是 onboarding 工作，与 Global Search/SQLite 无交集。未发现 #346 冲突分支。
- 分支：`fix/issue-346-global-search-fts-latency`。
- Draft PR：[#347](https://github.com/ArdenZC/Zen-Canvas/pull/347)，保持 OPEN / Draft。生产 SQL SHA：`9a251eda1327bd0e397b6f393dfbf625dada52ba`；最后一个代码/测试提交 `af74ec3fb6a727c28ddae6dca46dd9624dbe8c23` 只修改 test-only clippy 辅助代码。报告通过其后的纯文档提交加入。
- 审计范围：SQLite FTS 查询计划、各搜索 tier 延迟、候选窗口/过滤的语义等价。没有修改 Schema、IPC、rank 权重、tier 顺序、候选上限、索引生命周期、AI 或文件发现实现。

## 2. #342 正式基线

#342 合入的 benchmark source SHA 为 `16a2c18e87ab220ec3ddaf4ab11eaf70dcc12f70`；Windows Hosted run `37872989762`，artifact `global-search-baseline-100000-rows-37872989762`，artifact ID `11593946907`，服务端 SHA-256 `ae6cc04c449909d7a0f657c7c052d8a9cf494bba107b1d26b9038e4c990b1f9d`。数据为 100,000 条合成 SQLite Global Index row。历史门槛为 warm p95 ≤100ms；本任务未修改阈值或豁免 FTS/no-result。

| 查询 | #342 warm p95 |
|---|---:|
| Exact basename | 0.782ms |
| Name prefix | 33.669ms |
| Common prefix | 36.002ms |
| Extension exact / prefix | 0.816ms / 7.435ms |
| Chinese / punctuation / accented Unicode prefix | 18.227ms / 18.499ms / 17.634ms |
| FTS `report` | 28,648.790ms |
| FTS `invoice` | 36,765.041ms |
| Duplicate basename | 0.529ms |
| No-result `zzznomatchtoken` | 2,386.873ms |

## 3. Zen Canvas 查询链路和诊断方法

生产查询位于 [`src-tauri/src/global_index/search.rs`](../../src-tauri/src/global_index/search.rs)。普通查询按 exact name → name prefix → extension exact → extension prefix → FTS 顺序补足候选；结果再做 tier 去重与分页。FTS 使用 `bm25(global_entries_fts, 8.0, 2.0, 1.0)`，最终排序键为 BM25 rank、`modified_at_fs DESC`、`id ASC`。普通文件名搜索不调用模型。

诊断测试位于 [`src-tauri/src/global_index/tests/global_search_fts_diagnostic.rs`](../../src-tauri/src/global_index/tests/global_search_fts_diagnostic.rs)，嵌入现有 benchmark module。它复用 #342 的 100k generator、Global Index schema 和生产 FTS triggers，再增加 262 条 adversarial row；未创建第二套 fixture authority。Windows Hosted run `37917085530`，source `263f2146bc9cb2b8829f12d162694d3ae6ea8cc2`，artifact ID `11610488219`，文件 `global-search-fts_diagnostic-100000-rows-37917085530`。100,000 基础 row 加 262 条 adversarial row。artifact ZIP SHA-256：`7c4180f72aa176b6f93c5bc3ee687c67c710302d690ffc6909e7065b2ac4e883`；提取出的 JSONL SHA-256：`e2f77dc143412aa33e1185a8b89647be5016e1b04696eb09f3035b5706faacbb`。

测试阶段 A–C 各有 10 个观测；没有独立 warm-up，因此只用于阶段定位。若首个测量已超过 1 秒，诊断按约定只采单样本，阶段 D–F 和 no-result FTS/total 的 p95/p99 数值因此等于一个样本，不应视为稳定分位数。正式 #342 benchmark 则使用 5 次 warm-up 与 30 次 warm sample。

诊断的首次 hosted 编译 run `37916532090`（source `7d8e97fe0ef1405a19281dcc774e327020809082`）失败于 test-only 断言类型不匹配：`Vec<GlobalSearchResult>` 与 `&Vec<GlobalSearchResult>` 比较；未生成 fixture 或 timing artifact。修正为比较 slices 后，run `37917085530` 成功并生成上述 artifact。此次失败没有被计为搜索性能失败，也未被隐藏。

首个修复候选 CI (`37919097892`, source `9a251ed`) 中，macOS `clippy -D warnings` 发现两处诊断序列化 helper 参数较多及一处多余借用；Rust tests（1,083 项）和两平台 release compile 已通过。已在纯测试辅助文件中添加局部 lint 说明并去掉多余借用，提交 `af74ec3fb6a727c28ddae6dca46dd9624dbe8c23`。旧 CI 在该修正推送后被 GitHub 取消。最新代码 HEAD 的 CI [37920520554](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37920520554) 状态 `SUCCESS`：Windows Rust tests 1,142 passed / 24 ignored，macOS Rust tests 1,083 passed / 24 ignored；两平台 clippy、release compile、Windows Global Index service qualification、Windows/macOS Quality、Performance profile、Search/Workspace/Preview 及其它适用性能 lanes 均通过。source/evidence 与 change-scope/governance contracts 通过。Documentation-only validation、包装及 Windows Preview Handler lanes 由 validation lane plan 标为 skipped（本 PR 是混合代码/测试变更；未生成 installer）。

## 4. 根因：过滤条件令 SQLite 反转了 FTS 驱动顺序

修改前的查询形状为 FTS → 普通 `JOIN global_entries` → `JOIN global_volumes`，并带 enabled-volume、非 stale 过滤、managed EXISTS、BM25 排序与 LIMIT。100k fixture 的 `EXPLAIN QUERY PLAN` 为：

```text
SEARCH gv USING INDEX idx_global_volumes_enabled (enabled=?)
SEARCH ge USING INDEX idx_global_entries_volume (volume_id=? AND is_stale=?)
SCAN global_entries_fts VIRTUAL TABLE INDEX 0:=M3
CORRELATED SCALAR SUBQUERY 1
SEARCH me USING INDEX idx_managed_entries_global_entry (global_entry_id=? AND enabled=?)
SEARCH ms USING INDEX sqlite_autoindex_managed_scopes_1 (id=?)
USE TEMP B-TREE FOR ORDER BY
```

SQLite 选择从很少的 enabled volume 开始扫描 entries，再把 FTS MATCH 当成逐 row 的过滤。瓶颈不是 FTS MATCH 本身，也不是 managed EXISTS；转为 FTS-first 计划后这些步骤回到几十毫秒。

### 4.1 阶段测量（修复前）

下表来自 `37917085530` 的扩展 fixture（100,262 rows）。毫秒；p95/p99 对单样本阶段仅是该样本值。

| 阶段 | `report` p50 / p95 / p99，n | `invoice` p50 / p95 / p99，n | 观察 |
|---|---:|---:|---|
| A：FTS MATCH only | 0.223 / 0.515 / 0.670，10 | 0.260 / 0.406 / 0.471，10 | FTS virtual table 用 `VIRTUAL TABLE INDEX 0:M3` |
| B：MATCH + BM25 排序 | 10.443 / 11.740 / 12.252，10 | 10.825 / 12.808 / 13.807，10 | 增加 temp B-tree 排序，仍是毫秒级 |
| C：再 join entries | 18.104 / 19.033 / 19.189，10 | 18.172 / 19.300 / 19.448，10 | FTS 先驱动，再按 rowid 查 ge |
| D：增加 enabled volume + 非 stale | 32,531.965 / 同值 / 同值，1 | 39,331.870 / 同值 / 同值，1 | 计划变成 gv → ge → FTS，进入秒级 |
| E：再加 managed EXISTS | 32,327.125 / 同值 / 同值，1 | 41,189.932 / 同值 / 同值，1 | 计划与 D 相同；单样本有噪声，未显示 EXISTS 是主因 |
| F：完整生产 FTS query | 32,457.395 / 同值 / 同值，1 | 39,801.128 / 同值 / 同值，1 | 与 #342 的数量级一致 |

### 4.2 无结果按 tier 计时

`zzznomatchtoken` 的 exact name、name prefix、extension exact、extension prefix 分别只有 0.211ms、0.190ms、0.175ms、0.188ms p95（各 10 次）；FTS 为 7,573.766ms（单次），完整生产搜索为 7,495.938ms（单次）。因此最早四个 tier 不是无结果秒级延迟来源。该扩展 fixture 和 #342 100k 正式矩阵样本数不同，不能把两个数当作同一分布比较；二者共同确认 FTS join-order 路径会拖慢无结果查询。

## 5. 实验 SQL 与语义门

诊断逐一对比当前生产 JOIN、含全部 active/stale 过滤的 MATERIALIZED CTE、FTS-first `CROSS JOIN`，以及将 FTS 候选 LIMIT 提前到过滤前的反例。

| 形状 | 结果/计划 | 结论 |
|---|---|---|
| 普通 JOIN control | volume → entries → FTS；完整查询约 32.5s / 39.8s（单样本） | 证实问题计划 |
| MATERIALIZED CTE（过滤仍在候选 LIMIT 前） | 仍以 gv → ge → FTS 执行；`report` 32,255.288ms，`invoice` 39,987.479ms（各单样本） | 语义安全但未改变驱动顺序，拒绝 |
| 先 FTS 做 bounded LIMIT，再过滤 enabled/stale | adversarial 数据返回 0 条，而生产返回 80 条 | 语义错误，拒绝；不能靠 LIMIT 后过滤避免 underfill |
| FTS-first `CROSS JOIN` | `report` p95 34.909ms，`invoice` p95 36.451ms（各 10 次）；计划 FTS → ge rowid → gv PK | 与原查询结果等价且快，采用 |

CROSS JOIN 实验在同一 SQLite fixture 中比较所有字段和次序：ID、BM25 rank、mtime tie-break、ID tie-break、managed flag。adversarial rows 包含第二个 enabled volume、disabled volume、stale rows、managed/unmanaged、跨 volume 重名与重复路径、相同 rank/mtime，并让 FTS 命中数超过 4096。验证覆盖首页、`report` offset 40、候选窗口附近 offset 4016、`invoice` 首页、页拼接无重复以及 offset 4096 返回空。`ge_tie_a` 与 `ge_tie_b` 的 rank/mtime 完全相同，确认最终 `id ASC` 次序。所有 CROSS JOIN 页面结果与原生产 SQL 完整字段相等；危险的 LIMIT-before-filter 反例则明确不相等。

## 6. 已选生产修复

`search.rs::search_fts` 将 FROM 改为：

```sql
FROM global_entries_fts
CROSS JOIN global_entries ge
CROSS JOIN global_volumes gv
WHERE global_entries_fts MATCH ?1
  AND ge.rowid = global_entries_fts.rowid
  AND gv.id = ge.volume_id
  AND gv.enabled = 1
  AND ge.is_stale = 0
```

BM25、`ORDER BY rank ASC, ge.modified_at_fs DESC, ge.id ASC`、LIMIT、managed EXISTS、外层 tier 次序和 4096 candidate window 均保持原样。SQLite 文档将 `CROSS JOIN` 列为手动控制 join 顺序的机制（[SQLite Query Optimizer Overview](https://www.sqlite.org/optoverview.html#manual_control_of_query_plans)）；这里用它让 FTS MATCH cursor 保持最外层，同时仍在排序和 LIMIT 之前过滤 disabled/stale rows，所以不会产生 post-filter underfill。

修复后的 query plan 预期/已在实验变体观察为：

```text
SCAN global_entries_fts VIRTUAL TABLE INDEX 0:M3
SEARCH ge USING INTEGER PRIMARY KEY (rowid=?)
SEARCH gv USING INDEX sqlite_autoindex_global_volumes_1 (id=?)
CORRELATED SCALAR SUBQUERY 1
SEARCH me USING INDEX idx_managed_entries_global_entry (global_entry_id=? AND enabled=?)
SEARCH ms USING INDEX sqlite_autoindex_managed_scopes_1 (id=?)
USE TEMP B-TREE FOR ORDER BY
```

这是局部 SQL execution 改动；不引入 schema、持久索引、缓存或平台专用 API。测试 query-plan mirror 同步更新。生产回归测试也增加了全链路零结果断言。

剩余性能风险：CROSS JOIN 有意固定当前 FTS-first 顺序；如果将来查询从高选择性词项转成极宽命中，BM25 与 temp B-tree 排序仍可能成为成本。FTS 命中和 4096 候选窗的产品语义没有改变。SQLite/FTS schema 或 fixture 分布发生变化时，应重新检查 `EXPLAIN QUERY PLAN` 和正式矩阵。

## 7. 正式修复后 100k 基准

Windows Hosted run [37920520558](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37920520558) 对最新代码提交 `af74ec3fb6a727c28ddae6dca46dd9624dbe8c23` 运行完整 100,000-row、12-class benchmark，状态 `SUCCESS`。`af74ec3` 只修改 test-only 诊断 helper 的 clippy lint；生产查询 SQL 最后修改于 `9a251eda1327bd0e397b6f393dfbf625dada52ba`。

- Artifact：`global-search-baseline-100000-rows-37920520558`，ID `11611832322`。
- artifact ZIP SHA-256：`f72a033b3ef21e6734266cb232d91e05b1d79fee1545e4899f3b2d0575f30d74`（与 GitHub artifact digest 一致）。
- JSONL SHA-256：`5112c02fdbf1090302a5e317365df0faa5ab8b62bbfeaf7ade86a796197f799b`。
- 数据集：100,000 条合成 SQLite Global Index row；Windows x86_64 Hosted；每项 5 次 warm-up、30 次 warm sample。
- 12/12 query correctness oracle 通过；页拼接、无重复 ID、4096 candidate cap 与 offset 4096 为空均通过。
- 未改动的历史 warm p95 ≤100ms gate：12/12 通过，`performance_gate_summary.passed=true`，`regressions=[]`。

| 查询 class | 修复后 p50 / p95 / p99 (ms) | #342 warm p95 (ms) |
|---|---:|---:|
| Exact basename | 1.106 / 1.219 / 1.296 | 0.782 |
| Name prefix | 42.042 / 43.570 / 44.765 | 33.669 |
| Common prefix high fan-out | 43.279 / 43.900 / 47.866 | 36.002 |
| FTS substring `report` | 61.179 / 63.293 / 69.107 | 28,648.790 |
| FTS substring `invoice` | 63.454 / 69.550 / 77.510 | 36,765.041 |
| Extension exact | 1.100 / 1.135 / 1.158 | 0.816 |
| Extension prefix | 27.333 / 28.252 / 29.108 | 7.435 |
| Duplicate basename | 0.666 / 0.732 / 0.742 | 0.529 |
| No-result `zzznomatchtoken` | 1.131 / 1.164 / 1.198 | 2,386.873 |
| Chinese prefix | 43.495 / 46.434 / 53.468 | 18.227 |
| Punctuation prefix | 43.047 / 44.553 / 45.985 | 18.499 |
| Accented Unicode prefix | 40.828 / 52.019 / 60.115 | 17.634 |

FTS `report` p95 improved about 453×, `invoice` about 529×, and no-result about 2,051× versus #342. These are measured synthetic database latencies, not native filesystem search timings.

另一份修复 SQL 的正式 100k run `37919097906`（source `9a251eda1327bd0e397b6f393dfbf625dada52ba`，artifact ID `11611386965`，ZIP SHA-256 `e45fa0f593f19afe9b614abfb44f63a36b2f5556f6915124d4b9f33d4c3acc52`，JSONL SHA-256 `1fdc57acbd5f21c74dab43f77d1fadaddaed25f9760c243197eb820d31dc654b`）也成功通过；之后的 `af74ec3` 只改 test-only clippy 代码。两次 Windows Hosted run 的普通查询 warm p95 如下：

| 查询 class | run `37919097906` | run `37920520558` | 相对差异 |
|---|---:|---:|---:|
| Exact basename | 1.083ms | 1.219ms | +12.6% |
| Name prefix | 46.230ms | 43.570ms | −5.8% |
| Common prefix | 45.282ms | 43.900ms | −3.1% |
| Extension exact | 1.116ms | 1.135ms | +1.7% |
| Extension prefix | 29.378ms | 28.252ms | −3.8% |
| Duplicate basename | 0.714ms | 0.732ms | +2.5% |
| Chinese prefix | 46.761ms | 46.434ms | −0.7% |
| Punctuation prefix | 45.336ms | 44.553ms | −1.7% |
| Accented Unicode prefix | 43.784ms | 52.019ms | +18.8% |

这些同修复代码的重复结果显示普通查询 profile 在两个 run 间大致稳定（均低于 53ms），支持上述较高绝对值不是由最后这次 FTS SQL 改动引入；但它们不是同一物理 runner 的配对实验，也无法解释其相对 #342 旧 run 的整体抬升。

普通路径相对 #342 的本次单 run p95 确实更高：exact +55.9%、name prefix +29.4%、common prefix +21.9%、extension exact +39.1%、extension prefix +280.0%、duplicate basename +38.4%、Chinese +154.8%、punctuation +140.8%、accented Unicode +195.0%；不过全部仍低于 100ms gate。上述命中型查询均未调用本次修改的 FTS SQL：含标点的完整名及 `IMG_`、`final-v2` 进入 punctuation-prefix tier；其它高扇出 name/extension 查询在早期 tier 填满 80 候选后返回。普通 tier SQL 与其 EXPLAIN 计划均未改变。未完成起始 master 的同期对照，因此历史绝对增幅的 runner 归因仍未验证；不能把它写成零回归。当前修复 run 的 SQLite population 为 251,513ms，#342 为 187,411ms（+34.2%），这一项只提示环境/runner 变化可能存在，不单独证明查询 p95 的归因。

未运行 500k 或 1m：100k 已恢复到 bounded latency 并通过全部历史 gate，而更大规模不是 #346 的必需项；此处先保留成本较低、可重复的最小证据。1m 明确不属于本 Issue 验收范围。

## 8. 稳定性、平台边界与验证

- 正式基准和 staged SQL 诊断在 Windows Hosted 上真实执行，但 fixture 是合成 SQLite index；没有测试 NTFS/MFT/USN、APFS/FSEvents、真实目录 I/O 或文件系统发现延迟。
- macOS Rust Quality 与 native performance lanes 均通过，但这些 lane 不运行本报告的 Global Search benchmark，也不代表已实测 macOS 原生搜索性能。
- Codex Cloud 当前宿主是 Debian 13。已尝试本地定向 `cargo test`，并把可用 GLib/GObject dev 包解到 `/workspace/zen-canvas-native-sysroot` 复用；后续停在缺少 GDK/GTK/WebKit2GTK 开发包。未将 Linux 结果解释为 Windows/macOS，也未把该宿主作为平台性能证据。Windows Hosted diagnostic 已实际编译执行；最终测试结论以 PR CI lanes 为准。
- 修改不涉及文件变化监听、索引落盘、权限覆盖率、AI eligibility 或文件操作生命周期。

## 9. 修改文件与最小范围

生产：

- `src-tauri/src/global_index/search.rs`：仅调整 FTS join order；测试专用 wrapper 复用生产 SQL。

测试 / benchmark：

- `src-tauri/src/global_index/tests.rs`：增加 zero-result 搜索回归断言。
- `src-tauri/src/global_index/tests/global_search_benchmark.rs`：同步 EXPLAIN query-plan mirror；既有 100k 正式 benchmark/gate 保持不变。
- `src-tauri/src/global_index/tests/global_search_fts_diagnostic.rs`：隔离的 stage/变体/语义诊断。
- `.github/workflows/global-search-benchmark.yml`：仅提供手动诊断 mode；PR 路径默认仍跑官方 baseline，不改变默认阈值。

## 10. 当前限制和后续验收

100k 正式 benchmark 与修正后 PR CI 已通过。普通查询相对 #342 的绝对 p95 增幅已记录；两个修复后 run 结果彼此接近，修改后的查询计划/生产 SQL 只涉及 FTS tier，但同期 master 对照因旧 FTS 慢路径而取消，故历史绝对差异的 runner attribution 仍未验证。Documentation-only lane 被 scope plan 跳过，source/evidence 与 change-scope/governance contracts 已通过。建议 Owner 审阅该性能 caveat 和 Draft PR；保持 PR OPEN / Draft，Issue #346 OPEN，不 merge、不关闭 Issue、不运行 Codex Review。
