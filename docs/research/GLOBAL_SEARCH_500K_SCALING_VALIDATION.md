# Zen Canvas #348：Global Search 500k Scaling 与普通查询波动验证

> **结论：VERIFIED PERFORMANCE REGRESSION。** 500,000 行标准合成 benchmark 中 12/12 查询与 count oracle、分页和候选窗断言通过；7/12 warm p95 超过未修改的 100ms 历史门槛。Artifact 已成功上传。未修改生产搜索、索引或文件系统代码。500k 数据规模结论只代表 Windows Hosted 合成 SQLite 查询。

## 1. 基线、范围与并行工作

- 仓库：ArdenZC/Zen-Canvas；Issue [#348](https://github.com/ArdenZC/Zen-Canvas/issues/348)，保持 OPEN。
- 开始时 fetch 的最新 origin/master 与已知 #347 squash merge 相同：**9fe67765a94998b1659edd0f41242867fa3c749b**。
- #347 的 post-merge CI run [37924637390](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37924637390) 对该 SHA 为 SUCCESS。
- 审阅了 #342《Global Search 合成基准与回归证据基线》和 #346《Global Search FTS Join Order 与无结果延迟调查》；没有修改这两份历史报告。
- 开始时 Open/Draft PR 检查发现 #349 managed-scan SQLite contention 调查和 #335 onboarding 工作。#349 改动 scanner / scan SQL 等文件，未改 Global Search 查询或 benchmark；#335 有 Global Index 锁竞争测试，但未改 search benchmark/workflow。没有重复的 500k Global Search benchmark。
- 研究分支：test/issue-348-global-search-500k-scaling。benchmark 直接在 master 上执行；报告变更作为独立 evidence-only Draft PR 提交。
- 范围：500k 现有 12 类查询的正确性、warm 与 reopened-connection 延迟、SQLite 文件体积和 100ms 门槛；比较 #342 / #347 普通 tier 波动。未改生产 SQL、Schema、IPC、索引行为、排序、阈值、benchmark fixture 或 workflow。

## 2. 预检与运行方式

复用了现有 .github/workflows/global-search-benchmark.yml、global_search_benchmark.rs 和 tests.rs，没有增加并行 benchmark 框架。

- workflow_dispatch 已支持 entries=500000、mode=baseline；实际 runner 为 windows-latest，job timeout 为 180 分钟。
- workflow 使用不同 entry 数和模式隔离 concurrency group，cancel-in-progress=false。启动前没有其他 Global Search benchmark 运行，本轮只启动一份 500k baseline。
- JSONL 输出路径为 ci-evidence/global-search-baseline.jsonl；upload step 使用 always()，即使性能断言失败也上传记录。
- 正式规则保持原样：每类 5 次 warm-up、30 次 warm 查询、30 次 reopened-connection 查询；warm p95 ≤100ms。reopened 每个样本新开 SQLite 连接，但连接打开时间不在计时范围内，也没有清 OS page cache，所以它不是 cold-disk 测试。
- 最近的 100k artifact 主库为 131,321,856 bytes、WAL 为 19,961,432 bytes、SHM 为 65,536 bytes。简单按 5 倍估算，500k 主库加 WAL 约 756MB；该估算只用于容量预检，不作为实测结论。实际 500k 文件数据见第 6 节。
- #342 与 #347 的 100k workflow 总耗时分别约 82 分钟（旧未修 FTS 热点）和 5分18秒；#347 SQLite population 为 156.104 秒。实际 500k 矩阵运行约 29分44秒，未接近 180 分钟 timeout。

## 3. 500k benchmark 来源与 Hosted 环境

- GitHub Actions run：[37928710426](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37928710426)，workflow_dispatch，run attempt 1。
- benchmark source SHA：**9fe67765a94998b1659edd0f41242867fa3c749b**，CI checkout 日志和 JSONL context 均确认使用精确该 SHA。
- 运行时间：12:14:12Z 至 12:43:59Z；正式 Cargo benchmark 测试耗时 1,497.85 秒。
- runner：GitHub Actions Hosted runner instance 1000023546；Windows Server 2025，10.0.26100；image windows-2025-vs2026，version 20260925.250.1；架构 x86_64。
- fixture：复用现有确定性 synthetic Global Index generator、生产 SQLite schema 和所有 production triggers。数据仅为数据库内的路径字符串，没有在文件系统生成 500k 个真实文件。
- 实际 entry 数与 volume entry_count 均为 500,000；FTS report 行数为 25,000。SQLite WAL mode，page_size 4096，benchmark connection 使用 temp_store=MEMORY。源码还设置 synchronous=NORMAL、foreign_keys=ON、mmap_size=3,000,000,000 和 5 秒 busy timeout。
- 基准上下文只记录 OS/架构；CI job 给出 Windows image 与 ephemeral runner ID。CPU 型号、CPU 利用率、RAM 使用量和 runner 剩余磁盘空间没有采集，列为 NOT VERIFIED。

## 4. 正确性结果

正确性先于性能门槛：

- count oracle：**12/12 correct**。
- 12 类生产查询：**12/12 correct**，预期首屏 ID 和排序全部一致，无重复 ID；每类返回 limit=80 或实际匹配数（无结果为 0）。
- high-fan-out pagination：拼接页与前 80 条一致；跨页无重复；offset 4090 返回预期 6 条；offset 4096（候选窗上限）为空；candidate window=4096。
- 结果顺序、匹配总数、页边界与正式 100ms threshold 分别记录在 artifact；没有将错误结果计作性能数据。
- 500k 主 fixture 的行全在单个 enabled volume，且 is_stale=0。因此，此次 500k 矩阵本身没有 disabled-volume/stale adversarial row，不能声称在 500k fixture 中实测了这些排除路径。既有 #346 focused diagnostic run [37917085530](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37917085530) 在相同 Global Search SQL 变体上加入 disabled volume、stale row、第二个 enabled volume 及超过 4096 FTS matches，验证 FTS-first 查询与原查询的 IDs/order/rank/managed projection 和 pagination 等价。该项是 100k adversarial 证据，不冒充 500k 特殊过滤 fixture。

## 5. 完整 500k 延迟矩阵

单位为毫秒。每格按 p50 / p95 / p99 / min / max 顺序；两种连接模式各 n=30。count 是完整符合查询的匹配数，不是返回的首屏数量。

| 查询类 | 完整匹配数 | Warm p50 / p95 / p99 / min / max | Reopened p50 / p95 / p99 / min / max | IDs / order |
| --- | ---: | ---: | ---: | --- |
| Exact basename | 1 | 0.394 / 0.428 / 0.432 / 0.390 / 0.433 | 0.572 / 0.625 / 0.656 / 0.556 / 0.666 | PASS |
| Name prefix | 25,000 | 115.789 / 122.733 / 139.690 / 110.278 / 146.458 | 101.430 / 106.165 / 126.773 / 99.420 / 135.051 | PASS |
| Common prefix / high fan-out | 24,999 | 118.554 / 124.964 / 128.866 / 116.505 / 129.514 | 103.068 / 105.657 / 107.645 / 99.919 / 108.174 | PASS |
| FTS report | 25,000 | 151.652 / 157.715 / 165.498 / 143.540 / 168.546 | 136.948 / 145.460 / 155.997 / 131.015 / 159.213 | PASS |
| FTS invoice | 25,000 | 156.761 / 162.472 / 167.225 / 150.713 / 168.839 | 141.901 / 159.146 / 171.310 / 136.608 / 175.782 | PASS |
| Extension exact | 90,630 | 0.472 / 0.511 / 0.515 / 0.465 / 0.516 | 0.693 / 0.744 / 0.770 / 0.668 / 0.779 | PASS |
| Extension prefix | 40,629 | 81.362 / 88.581 / 119.103 / 76.441 / 131.259 | 64.251 / 66.163 / 66.724 / 63.299 / 66.897 | PASS |
| Duplicate basename | 25,000 | 0.322 / 0.351 / 0.354 / 0.317 / 0.355 | 0.551 / 0.600 / 0.678 / 0.531 / 0.709 | PASS |
| No result | 0 | 0.420 / 0.457 / 0.460 / 0.416 / 0.461 | 0.761 / 1.497 / 1.811 / 0.691 / 1.902 | PASS |
| Chinese prefix | 25,000 | 117.821 / 122.870 / 123.289 / 114.314 / 123.421 | 101.400 / 105.968 / 131.397 / 98.261 / 141.642 | PASS |
| Punctuation prefix | 25,000 | 115.139 / 121.500 / 124.224 / 111.218 / 125.148 | 99.868 / 103.962 / 108.282 / 97.044 / 109.667 | PASS |
| Accented Unicode prefix | 25,000 | 115.419 / 118.173 / 119.350 / 111.974 / 119.641 | 95.555 / 98.757 / 100.861 / 94.733 / 101.591 | PASS |

### 100ms gate

Historical warm p95 limit remains **100ms** and was not changed. **5/12 pass; 7/12 fail**:

| 超限查询 | Warm p95 | 与门槛差值 |
| --- | ---: | ---: |
| Name prefix | 122.733ms | +22.733ms |
| Common prefix / high fan-out | 124.964ms | +24.964ms |
| FTS report | 157.715ms | +57.715ms |
| FTS invoice | 162.472ms | +62.472ms |
| Chinese prefix | 122.870ms | +22.870ms |
| Punctuation prefix | 121.500ms | +21.500ms |
| Accented Unicode prefix | 118.173ms | +18.173ms |

每类 30 个 warm 样本的最小值也高于 100ms，上述结果不是单个尾部样本导致。extension prefix warm p95 为 88.581ms，虽通过门槛但靠近 100ms；其 p99 为 119.103ms，说明分布尾部也应保留关注。zero-result 保持亚毫秒 warm p95。

Benchmark test step 和整体 500k workflow 为 **failure**，具体原因是最终历史性能门槛断言：7 个 warm p95 超限。count oracle、query IDs、分页、候选窗均通过；runner/setup、checkout、cache cleanup 和 artifact upload 均成功。这是已验证的性能门槛失败，不是 infrastructure failure。

## 6. SQLite 文件和写入成本

以下为 benchmark 在查询前采集到的合成 SQLite 指标，不代表真实用户文件库、进程 RSS 或 OS 冷盘读取。

| 项目 | 100k #347 exact-head | 500k #348 | 增长 |
| --- | ---: | ---: | ---: |
| Entry rows | 100,000 | 500,000 | 5.00x |
| Fixture generation | 216.386ms | 978.494ms | 4.52x |
| SQLite population | 156,104.467ms | 1,420,740.200ms | 9.10x |
| Main database | 131,321,856 bytes | 655,818,752 bytes | 4.99x |
| WAL at capture | 19,961,432 bytes | 23,768,312 bytes | 1.19x |
| Main + WAL | 151,283,288 bytes | 679,587,064 bytes | 4.49x |
| SHM at capture | 65,536 bytes | 65,536 bytes | 1.00x |
| SQLite page count | 32,061 | 160,112 | 4.99x |
| Page size | 4,096 bytes | 4,096 bytes | unchanged |

500k 的 trigger-enabled SQLite population 花费 23分40.740秒，显著高于 100k 的 5 倍线性估算；这是独立于搜索延迟门槛的写入成本观察。该项是在不同 ephemeral runner 上测得，runner load/CPU model 未捕获，不外推为精确规模模型。500k 主库加 WAL 约 648 MiB；benchmark 成功在该 Hosted 环境生成并测量，但 runner 剩余磁盘容量未被记录。

## 7. 查询计划与来源分析

benchmark 在实际 500k SQLite database 上执行 EXPLAIN QUERY PLAN。测试 helper 由 search.rs 当前 candidate SQL 生成镜像查询；artifact 的 plan_sql_source 标记为 mirrors_current_search.rs_candidate_sql，因此计划来自真实 SQLite 规划，但 SQL 是 source-mirrored，不是运行时私有 statement 自动 hook。

500k 普通 tier 计划：

- Exact/name prefix 使用 idx_global_entries_active_name_order；prefix 高扇出路径还使用 temp B-tree 进行 order。
- Extension exact/prefix 使用 idx_global_entries_active_extension_order；prefix 结果需要 temp B-tree。
- Punctuation prefix 使用 active-name-order 索引并临时排序。Chinese 与 accented Unicode 走相同的 name-prefix query shape。

500k FTS plan：先 SCAN global_entries_fts VIRTUAL TABLE INDEX 0:M3，再以 global_entries INTEGER PRIMARY KEY(rowid) 查 ge、以 volumes primary-key id 查 gv，然后访问 managed EXISTS 索引，最后对 BM25 / mtime / id order 使用 temp B-tree。该计划保持 #347 的 FTS-first 顺序，没有退回 volume → entries → FTS。

普通 tier SQL 和 EXPLAIN 访问路径在 #342 100k 与 #347 100k artifact 中一致；500k 上也命中相同索引形状。规模增长后仍保持高 fan-out 匹配数线性增加到约 5 倍，而这些类别 p95 增长约 3.3–3.8 倍。no-result 和唯一精确查询仍为亚毫秒 warm p95。当前数据指向高扇出前缀/排序和 FTS 大命中集在 500k 下越过历史预算；没有证据说明 FTS join-order 修复被 planner 回退。

## 8. 普通查询 run-to-run 波动

先比较两个都使用 100k fixture 的正式 artifact，避免把不同数据量当作 #347 ordinary-tier code 影响：

- #342 run [37872989762](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37872989762)，source 16a2c18e87ab220ec3ddaf4ab11eaf70dcc12f70，runner instance 1000023123。
- #347 exact-head run [37921985290](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37921985290)，source d4e9bf1b08dc7570b8bbb7dd4e346090f7c5b0b0，runner instance 1000023472。
- #348 scale run [37928710426](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37928710426)，runner instance 1000023546。

三个 job 都是 Windows Server 2025 10.0.26100、windows-2025-vs2026 image 20260925.250.1、x86_64。100k #342 与 #347 runs 的数据库 page count、page size、main/WAL/SHM bytes、WAL mode、temp_store=MEMORY 及 fixture entry 数相同。benchmark 连接方式一致：warm 经 Database pool entrypoint 并计 checkout；reopened 每次新开 connection 但不计 open 且不清 OS page cache。CPU 型号与 Hosted VM 规格没有写进这些结果，因此同 OS/image 不代表同 CPU 或同负载。

| 普通查询 | #342 warm p95 | #347 warm p95 | warm 变化 | #342 reopened p95 | #347 reopened p95 | reopened 变化 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Exact basename | 0.782ms | 0.720ms | -7.9% | 0.911ms | 1.208ms | +32.6% |
| Name prefix | 33.669ms | 34.820ms | +3.4% | 25.967ms | 26.086ms | +0.5% |
| Common prefix | 36.002ms | 34.082ms | -5.3% | 27.028ms | 27.187ms | +0.6% |
| Extension exact | 0.816ms | 0.801ms | -1.8% | 1.066ms | 1.074ms | +0.8% |
| Extension prefix | 7.435ms | 23.347ms | +214.0% | 13.275ms | 15.920ms | +19.9% |
| Duplicate basename | 0.529ms | 0.542ms | +2.5% | 0.757ms | 0.773ms | +2.1% |
| Chinese prefix | 18.227ms | 34.033ms | +86.7% | 24.225ms | 27.258ms | +12.5% |
| Punctuation prefix | 18.499ms | 34.377ms | +85.8% | 27.321ms | 28.382ms | +3.9% |
| Accented Unicode prefix | 17.634ms | 33.932ms | +92.4% | 23.719ms | 26.397ms | +11.3% |

普通搜索 SQL 没有随 #347 改动；两个 100k artifact 的 ordinary query plans 相同。warm 和 reopened 的变化幅度不同，且其 Hosted runner instance ID 确实不同。SQLite population 也从 #342 的 187.411 秒变为 #347 的 156.104 秒。现有证据不足以将 p95 差异归因于 #347 或确定主要 runner 成因；唯一可支持的结论是跨 run 波动已测得、单次 run 内分位数较集中，但没有受控配对实验。

**SAME-RUNNER PAIRED CONTROL NOT VERIFIED。** 本任务没有在同一物理 runner 上执行旧/新查询 SQL A/B；也没有重新运行旧 master 的慢 FTS 全矩阵。

500k run 是不同规模的 same-code scale measurement，不是 100k ordinary variance 的配对对照。500k 高 fan-out 查询的正确性和延迟都在同一 job/fixture 内通过 30 warm 与 30 reopened sample 实测。

## 9. Artifact 与复现边界

- Artifact name：global-search-baseline-500000-rows-37928710426。
- Artifact ID：11616034036；GitHub upload SUCCESS，保留至 2026-11-08。
- ZIP digest：sha256:5ae4cfe1bb22827e0945346691865cdecd810d0b4619ff643e8b08c14157f505。
- 下载后 ZIP SHA-256 与 GitHub digest 相同。
- 提取 JSONL SHA-256：75a043505ddcb8ad3da27e7a953269caf05c3c7820143eb71fee05c76a19f0b0。
- JSONL 共 45 条：dataset 1、count oracle 12、query plan 6、pagination/candidate-window 1、query 12、performance gate 12、performance summary 1。
- Benchmark source SHA=9fe67765a94998b1659edd0f41242867fa3c749b；这是 benchmark binary/test checkout SHA。后续 PR 只包含此报告时，documentation-only PR HEAD 是另一条分支上的独立文档提交；二者不能混称。PR 当前 HEAD SHA 应以本报告所在 Draft PR 的 GitHub metadata 为准；没有因为文档提交重新运行 500k。

## 10. 证据分层与 NOT VERIFIED

### MEASURED

- Windows Hosted Server 2025 上，对 500,000 条 synthetic SQLite Global Index entries 完成固定 12 类 benchmark。
- 12/12 query / count oracle 和 pagination/candidate-cap assertion 正确。
- 7/12 warm p95 超过既有 100ms gate，workflow 因该 gate 失败；Artifact upload 成功。
- SQLite population、main DB / WAL / SHM bytes、page count/page size 和 source-mirrored query plan 均来自 run 37928710426 JSONL。

### SOURCE-DERIVED

- workflow 180 分钟 timeout、500k dispatch 参数、取消策略、输出路径和 threshold implementation 见 .github/workflows/global-search-benchmark.yml。
- 30 warm / 30 reopened / 5 warmup、fixture generator、count oracle、pagination 与 EXPLAIN mirror 来自 src-tauri/src/global_index/tests/global_search_benchmark.rs。
- FTS-first join order 与普通查询 SQL/index shape 来自 src-tauri/src/global_index/search.rs。
- #342 与 #347 ordinary query plans、fixture metadata、100ms gate 与 SQLite sizes 来自两个已校验 artifact。

### NOT VERIFIED

- 禁用 volume / stale row 在 500k corpus 内的 adversarial 排除测试；现有同 SQL 形状 adversarial evidence 来自 #346 100k diagnostic。
- 同物理 runner old/new paired A/B（明确为 SAME-RUNNER PAIRED CONTROL NOT VERIFIED）。
- CPU 型号、虚拟 CPU/RAM 规格、CPU load、runner 剩余空间与 benchmark 期间 RSS/CPU 占用。
- 清 OS page cache 后的真正 cold-disk 查询时间。
- 500k 个真实 Windows 文件 NTFS/MFT/USN 枚举与监听恢复；本基准只写数据库。
- macOS APFS/Spotlight/FSEvents 搜索或恢复。
- Tauri UI / IPC 端到端键入到结果延迟。
- 一百万条规模。状态：**1M NOT RUN — REQUIRES OWNER DECISION**。

## 11. 风险与 Owner 决策

1. 500k 仍能返回正确结果，但七类高扇出/FTS 查询超过历史门槛。建议把这些 query class 和 artifact 交 Owner triage，后续若决定修复，应创建独立 defect/fix issue 与独立验证；不在 #348 改生产代码。
2. SQLite trigger-enabled population 的实测时间 23.7 分钟，接近 100k population 的 9.1 倍；需要单独判断是否符合预期以及是否有生产建库体验风险。该数据没有实际文件扫描/Provider 写入成本。
3. 1m 不自动运行。建议 Owner 先决定是否处理 500k 的高扇出性能越线和 population 成本，再授权是否运行 1m。
4. 普通查询跨 #342/#347 的 100k warm p95 差异无法归因于代码或 runner；后续要回答因果问题，必须设计受控的同 runner paired SQL comparison。旧 FTS 查询的慢全矩阵不应为此再跑。

本报告只加入研究分支。benchmark artifact 绑定于 master source SHA 9fe67765a94998b1659edd0f41242867fa3c749b；Draft PR 的最终文档 HEAD 是独立的报告提交（详见 PR metadata）。不修改 Issue #348 状态，不合并 PR，不运行 Codex Review。
