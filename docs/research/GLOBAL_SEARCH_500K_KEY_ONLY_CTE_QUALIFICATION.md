# Zen Canvas #360 — Global Search Key-only CTE Qualification

> 状态：受控资格验证进行中；生产 SQL / Schema / IPC / 100ms Gate 未改动。等待 Windows Hosted 100k 与 500k 同 fixture Original 对照 Key-only CTE 的正式结果。本文不会以局部 SQL 结果代替 pooled search 或 Repository Snapshot。

## 1. 审计基线与边界

| 项目 | 记录 |
|---|---|
| Repository | `ArdenZC/Zen-Canvas` |
| Issue | [#360](https://github.com/ArdenZC/Zen-Canvas/issues/360)，保持 OPEN |
| Starting `origin/master` SHA | `16b9c791acf9e2e907174ce21863025d079e5351`（重新 fetch 后与本地基线一致） |
| 分支 | `research/issue-360-global-search-key-only-cte-qualification` |
| PR | 待创建 Draft；不合并、不关闭 Issue |
| 变更类别 | test-only SQL candidate、诊断、独立 Hosted workflow、研究报告 |
| 生产搜索与 source-health SQL | 未修改；Candidate B (#359) 保持当前 master 生产实现 |
| Schema / FTS index / IPC / query gate | 未修改；仍为 limit clamp 1–200、候选窗口 4096、warm p95 100ms |
| 1m benchmark / Codex Review | 未运行 / 不运行 |

开始前检查了开放 PR。#356 是 Windows process heap 研究，#335 是 onboarding scan-scope；均未修改本次 Global Search SQL、Schema 或诊断。PR #361 已合并至当前 master，Issue #359 已关闭。

### #359 合并后质量状态

master exact-head hosted run [38050482258](https://github.com/ArdenZC/Zen-Canvas/actions/runs/38050482258)，head `16b9c791acf9e2e907174ce21863025d079e5351`，结论 **FAILURE**。Source checkout、scope/routing、validation plan、Windows Global Index service、Windows/macOS Rust quality、Windows/macOS release compile、Native macOS performance、Library & Content、Workspace Foundation、Search、Preview Platform、Scan & Schema 均成功。`Performance / Intelligence (push)` 在 “Run Intelligence performance suite from prepared binary” 失败；聚合 Performance profile 因该 shard 失败，Windows/macOS Quality gates 随后因依赖聚合失败而失败。该失败是本次研究的 CI blocker 记录，不在本分支修复或重跑。

## 2. 研究问题与候选

比较同一 fixture 上的：

1. **Original**：当前生产 `search.rs` 中的 prefix、extension-prefix 与 FTS tier SQL。
2. **Key-only CTE**：研究用的 `WITH candidates AS MATERIALIZED` 变体；先按生产谓词、排序键和 limit 收集 `rowid / id / modified_at_fs / rank`，再按 rowid 回表投影完整 `GlobalSearchResult` 并计算 managed 标记。

候选仅通过 `#[cfg(test)]` thread-local override 进入现有 tier、pooled search、Repository Snapshot 的真实调用路径。release build 不包含 override；生产 SQL 文本和默认执行路径不变。精确 SQL 与 query bind 参数由 JSONL 证据记录，源码生成器位于 `src-tauri/src/global_index/search.rs` 的 `key_only_*_sql` 函数。

Prefix 与 extension-prefix 在 candidates 中先过滤 enabled volume 和 `is_stale = 0`，然后按 `modified_at_fs DESC, id ASC` 排序再 limit。FTS 保留 `global_entries_fts CROSS JOIN global_entries CROSS JOIN global_volumes` 的 FTS-first 顺序、`bm25(global_entries_fts, 8.0, 2.0, 1.0)`、相同 rank/mtime/id 排序。最终查询根据候选 rowid 回表，并保留同一 managed EXISTS 语义。Exact basename 与 exact extension 不适用 CTE，继续走 Original 路径。

## 3. 实验方法

- Windows Hosted 单 runner；分别建立 deterministic synthetic Global Index 100k 与 500k fixture。每种规模只 population 一次；Original 与候选复用同一个数据库、连接及查询参数，不运行 filesystem scan。
- fixture 使用现有生产 schema/index/FTS trigger 与 512 行写批次。JSONL 记录 runner、SQLite 版本、PRAGMA、生成/填充时间、DB 大小、source SHA 与 fixture 元数据。
- 各配对实验 5 warmups、30 组交替顺序 samples，报告 p50/p95/p99。独立记录 raw SQL tier、真实 `Database::search_global_entries` pooled search、真实 `Database::search_global_entries_snapshot`。
- Snapshot 在同一 SQLite read transaction 内比较 results、source-health、source_revision、index_status；Original 与候选均使用 master 当前 #359 Candidate B source-health SQL。
- correctness 使用完整结果对象比较（字段、rank、排序），覆盖 12 个历史查询类别；另覆盖 4096 candidate window、limit clamp、分页边界、命中规模、FTS rank、stale/disabled 过滤、managed/unmanaged、同 rank/mtime ties 和跨 tier 去重。
- Windows 进程 CPU / working set / private bytes 为调用前后 process-wide boundary samples，不是 OS 峰值或 SQL attribution。SQLite 临时 B-tree 字节数无法归因，标为 **NOT VERIFIED**。

## 4. 历史基线（非本次配对结果）

正式 500k 历史测试 #350：12/12 correctness 通过、5/12 warm p95 ≤100ms、7/12 未通过。历史 Windows 500k synthetic p95（不可与本次 A/B 混为同一 runner 配对）：

| 查询类别 | 历史 p95 (ms) | 100ms |
|---|---:|---|
| Exact basename | 0.428 | PASS |
| Name prefix | 122.733 | FAIL |
| Common/high-fanout prefix | 124.964 | FAIL |
| FTS report | 157.715 | FAIL |
| FTS invoice | 162.472 | FAIL |
| Exact extension | 0.511 | PASS |
| Extension prefix | 88.581 | PASS |
| Duplicate basename | 0.351 | PASS |
| No result | 0.457 | PASS |
| Chinese prefix | 122.870 | FAIL |
| Punctuation prefix | 121.500 | FAIL |
| Accented Unicode prefix | 118.173 | FAIL |

历史 #352 局部 SQL 配对只测 query tier：name prefix p95 `78.532 → 37.045ms`、FTS report `112.579 → 80.811ms`、FTS invoice `117.087 → 86.216ms`。这不是 pooled 或完整 snapshot 证据。#359 已合并后的当前 production Snapshot p95（原 Candidate B source-health，历史 500k run）：no-result `432.649ms`、prefix `658.827ms`、FTS `770.355ms`。本次必须重新配对确认 Key-only CTE 是否改善当前全路径。

## 5. 正确性与 adversarial 覆盖

诊断按以下矩阵逐项断言。正式 Hosted JSONL 完成前结果列保持待验证，不将编译成功解释为运行成功。

| 覆盖 | 证据方式 | Hosted 结果 |
|---|---|---|
| Exact basename / exact extension | 原路径全字段结果 + count oracle | 待测 |
| Name/common prefix、中文、标点、重音 | Original 与 CTE helper / full pooled 比较 | 待测 |
| FTS report、invoice、单命中、零命中 | 整个结果对象及 rank 相等；解释计划须仍以 FTS virtual table 为首 | 待测 |
| Extension prefix | 全字段对比 | 待测 |
| 12 类正式矩阵 | Original 与候选 pooled / Snapshot result 相等 | 待测 |
| 第一页 80、limit 200、请求 500 clamp 到 200 | pooled 入口完整列表等价 | 待测 |
| offset 4016 / 最后一页 / offset 4096 | 4096 候选窗口、所有字段及排序等价 | 待测 |
| 0 / 1 / 5 / 100 / 1,000 / 4,096 / 10,000 / 25,000 hits | 同一 rollback-only overlay，比较 SQL tier | 待测 |
| disabled volume / stale rows | adversarial fixture；两种不安全的 limit-before-filter 方案须明确 underfill | 待测 |
| multi-volume、managed/unmanaged、equal rank/mtime、duplicate basename、跨 tier duplicate | 完整 `GlobalSearchResult` equality 与去重断言 | 待测 |
| Snapshot transaction / source revision | 比较 results/source-health/revision/index-status 与 BLAKE3 revision | 待测 |
| schema/index/overlay lifecycle | schema/index signature 不变；所有 overlay rollback 后 row count 恢复 | 待测 |

## 6. 性能结果

Hosted run / attempt、artifact IDs 与 ZIP SHA-256、fixture preparation、SQLite 环境、12 类 correctness、执行计划/VM/fullscan/sort，以及所有三层 paired 数据将在 Windows Hosted 运行后填入。禁止在此处用 #352 query-tier 数字推断 pooled 或 Snapshot 结果。

### 6.1 100k

| 层次 | 本次 Original vs Key-only CTE p50/p95/p99 | 100ms 判断 | 结果 |
|---|---|---|---|
| SQL tier | 待运行 | 待运行 | 待验证 |
| Pooled search（12 类） | 待运行 | 待运行 | 待验证 |
| Repository Snapshot（12 类） | 待运行 | 不适用旧 gate，单独报告绝对时延 | 待验证 |

### 6.2 500k

| 层次 | 本次 Original vs Key-only CTE p50/p95/p99 | 100ms 判断 | 结果 |
|---|---|---|---|
| SQL tier | 待运行 | 待运行 | 待验证 |
| Pooled search（12 类） | 待运行 | 待运行 | 待验证 |
| Repository Snapshot（12 类） | 待运行 | 不适用旧 gate，单独报告绝对时延 | 待验证 |

### 6.3 资源与计划

SQL EXPLAIN、VM steps、Fullscan steps、Sort operations、结果数、temp B-tree presence、CPU / working set / private bytes、DB size / population time、pagination 与 hit-scale 都以 Hosted artifact 为准。临时 B-tree 实际字节数 **NOT VERIFIED**。Snapshot 入口没有 SQLite statement counters，不能把 SQL-tier counters 冒充 Snapshot counters。

## 7. CI 与验证状态

| 验证 | 状态 |
|---|---|
| `cargo fmt -- --check` | PASS |
| Windows GNU target `cargo check --features desktop-runtime --lib --tests` | PASS（仅交叉编译，不是 Windows 执行） |
| `actionlint` 专用 workflow | PASS |
| `git diff --check` | PASS |
| Documentation check | 待设置 `DOCS_DIFF_BASE=origin/master` 后执行；首次无该变量运行未执行检查并报错 |
| Governance check | 待执行 |
| Local Linux Rust tests | NOT RUNNABLE：仓库在 Linux 编译时引用 Windows/macOS 专用 `keyring` target dependency；该失败不是测试结果 |
| Windows Hosted 100k + 500k qualification | 待运行 |
| PR exact-head 100k baseline / quality CI | 待 PR 后检查 |
| Windows/macOS 原生文件系统 / 用户体验 | NOT VERIFIED；Windows Hosted SQLite synthetic benchmark 不测 NTFS scan，macOS 未用于 CTE benchmark |

## 8. 结论

在真实 Windows Hosted 同 fixture 结果到达前，本报告**不建议授权生产 SQL 变更**，也不声称 CTE 已资格通过。最终建议将分别考虑 correctness、query-tier 100ms gate、pooled latency 和完整 Snapshot 改善；如果只有 tier 获益而 pooled / Snapshot 无明显收益，则保持生产 SQL 不变。若 CTE 在某种低命中、分页或 Unicode 拓扑回退，应保留逐项数据并将结论提交 Owner 决策。

当前 final verdict：**PENDING — Windows Hosted paired qualification required**。
