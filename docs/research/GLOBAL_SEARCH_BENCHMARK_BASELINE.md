# Global Search 合成基准与回归证据基线

状态：**100k 精确 benchmark source SHA 已完成完整合成矩阵并核验 artifact：12/12 count oracle、12/12 query 与分页正确性通过；3/12 查询类超过历史 100ms p95 门槛。Artifact 上传成功。500k/1m 为 Owner scale-stop 后 DEFERRED / NOT RUN。未修改生产搜索代码。**

Issue：[#342 Global Search benchmark and regression evidence baseline](https://github.com/ArdenZC/Zen-Canvas/issues/342)

## 1. 审计基线与范围

| 项目 | 值 |
| --- | --- |
| 起始远程分支 | `origin/master` |
| 起始 master SHA | `0eda3e0d232a22eba116a99567b7bdf6735c5104` |
| 研究分支 | `test/issue-342-global-search-benchmark-baseline` |
| 审查范围 | Global Search 的 SQLite 查询、现有忽略的合成基准、查询正确性及独立基准工作流 |
| 明确不包含 | 生产搜索语义、索引 Schema/IPC、AI 资格、SoA、SIMD、查询缓存、拼音、真实文件系统扫描 |

任务从远程 master 当前对象建立；同一检查时点 `HEAD` 与 `origin/master` 相同。Issue #342 保持 OPEN。初始 PR 检查只发现 Draft PR #335（onboarding 扫描范围，与本任务无关），未发现搜索基准冲突 PR。本任务不改变 Issue 或 PR 的既有状态。

本次只改 Global Index 测试代码、隔离的 GitHub Actions 工作流和本报告；不改生产查询实现、Schema、IPC、用户设置或文件操作语义。Linux keyring 目标依赖边界保持不变。

## 2. 当前 Global Search 查询路径

源码证据：

- `src-tauri/src/global_index/search.rs`：`search_global_entries_on_connection` 依次查精确文件名、名称前缀、精确扩展名、扩展名前缀，最后按查询字符选择 FTS 或标点前缀候选；这些是分层候选查询，不是全文件系统扫描。
- 同文件中的 `MAX_SEARCH_LIMIT = 200`、`MAX_TIER_CANDIDATES = 4_096`、`MAX_SEARCH_OFFSET = 1_000_000` 限定单次结果、候选窗与 offset。候选按稳定 ID 去重；名称/扩展名层按 `modified_at_fs DESC, id ASC` 排序；FTS 层先按 BM25 排序。
- `src-tauri/src/db/schema.rs`：Global Index 使用带 trigram tokenizer 的 SQLite FTS5 外部内容表；插入、删除、文件名/路径/扩展名更新由触发器同步 FTS，另有触发器维护 volume entry count。
- `src-tauri/src/db/connection.rs`：应用连接使用 WAL、`synchronous=NORMAL`、外键、内存临时存储、mmap 和 busy timeout。基准不关闭触发器，也不降低同步级别。
- `src-tauri/src/global_index/commands.rs` 与 `repository.rs`：命令在只读事务中运行查询，并一并读取来源健康状态和索引状态。本基准测量真实 `Database::search_global_entries` 查询入口及其连接池 checkout；它不计入 Tauri IPC、状态快照和渲染开销。通过同一个生产 `search_global_entries_on_connection` 做结果/分页断言。

这项基准衡量已建好 SQLite Global Index 上的查询耗时。fixture 使用 Windows 形态的合成路径字符串，但不在磁盘创建文件；它不测 NTFS/MFT/USN、APFS/FSEvents 或首次文件发现。

## 3. 原有基准缺口

起始 master 中的 `src-tauri/src/global_index/tests.rs` 有两个 `#[ignore]` 的合成性能测试（10 万、100 万行），但它们不足以作为回归证据基线：

- fixture 只有单层平目录、连续格式的 `Report-*.txt`，查询覆盖少且数据分布窄；缺 50 万规模。
- 建库时删除 FTS 插入触发器与 entry-count 插入触发器，之后手动重建 FTS/计数；1M 测试还把 `synchronous` 设为 `OFF`，低估真实写入成本。
- 每个查询只做 2 次预热和 3 次计时；没有稳定的 p50/p95/p99 分位证据。
- 断言只检查某个名称是否出现，不能证明完整数量、固定顺序、无重复、offset 页边界和候选窗上限。
- 100k 有可选的查询计划打印，1M 仅打印一个前缀计划；没有统一采集 DB/WAL 大小、fixture 生成和写入时间。
- 两个测试均被忽略，CI 默认不会执行。

新基准替换上述两份重复实现，仍归属现有 Global Index 测试模块，不新增第二套基准权威。

## 4. 新基准 fixture 与正确性契约

主要实现：`src-tauri/src/global_index/tests/global_search_benchmark.rs`，由现有 `tests.rs` 的 `global_search_benchmark` 子模块引入。

支持 `100000`、`500000`、`1000000`、`2000000`、`5000000` 行；PR 中 benchmark 测试源文件变化时自动运行 100k，手动工作流可选其他规模。合成记录包含唯一 ID、确定性大小与修改时间、扩展名分布、混合大小写、空格、数字、下划线、连字符、点、重名、长文件名、中文、NFC/NFD 字符形式，以及浅层/深层/多兄弟目录和 Windows 形态路径。样本路径对应 Documents、Downloads、Pictures、Desktop 和开发项目；没有访问这些真实路径。

每 512 条记录一批事务写入。所有生产 Global Index 触发器必须在建库过程中存在，结束后验证 FTS 报告命中数和 trigger 维护的 volume count 与预期相符。不会删除/重建 FTS，不会关闭 trigger，也不会改变同步模式。

查询矩阵包括：

| 查询类 | 代表输入 | 验证重点 |
| --- | --- | --- |
| 精确文件名 | `Annual Budget 2026.xlsx` | 唯一精确命中 |
| 常见名称前缀 | `quarterly` | 多结果确定排序 |
| 高扇出前缀 | `IMG_` | 4096 条候选窗与 offset |
| FTS 子串 | `report`、`invoice` | 完整预期 ID、顺序及总匹配量 |
| 扩展名精确/前缀 | `pdf`、`jp` | 扩展名查询层 |
| 重名 | `meeting-notes.md` | 多路径相同 basename 的顺序 |
| 无结果 | `zzznomatchtoken` | 空结果 |
| 中文/标点/重音字符 | `数据库`、`final-v2`、`RÉSUMÉ` | Unicode 前缀及标点查询 |

正确性先于计时：先以独立 SQLite count oracle 对每个查询核对完整匹配总数，再比较生产查询返回的预期 ID 顺序、结果数、去重数和 limit；高扇出场景验证前两页拼接与首 80 条一致、offset 4090 页边界以及 offset 4096 为空。预期数据由独立的确定性 fixture 规则生成，搜索结果来自生产 SQL 实现。另有非忽略 Unicode 测试记录大小写行为及 NFC/NFD 当前不等价的语义。

当前基准版本每个查询先做 5 次预热，再收集 30 个 warmed 样本和 30 个 reopened-connection 样本。FTS 子串查询在旧版本的 100/50 样本下单类就耗时约 80 分钟，因此采用需求规定的 30 次下限完成固定矩阵；JSONL 明确记录每类样本数。warm 测量经过 `Database::search_global_entries`，计入池连接 checkout；reopened 测量每个样本都新开 SQLite connection，计时从查询开始、连接创建不计时。它**不是冷磁盘测试**：没有清空 OS page cache。分位数使用排序后线性插值。

性能门槛超限会写出该查询的 `performance_gate` 记录并继续跑完所有正确性通过的 query classes；所有查询结束后再写 `performance_gate_summary` 并统一失败。这样阈值失败不会截断后续查询的性能证据。独立 count、结果、顺序、去重或分页正确性断言仍会立即失败，以免错误结果进入基准。

旧基准的 100 ms p95 约束保留为 warmed 查询回归门槛，适用于不超过 1M 的规模，并按查询类分别检查。2M/5M 是扩展诊断规模，不把旧门槛外推为已批准产品 SLA。

## 5. 数据采集与复现

每个运行导出 JSONL artifact，包含 source SHA、runner OS/架构、entry 数、fixture 生成耗时、直接向 Global Index 表写入合成记录的 SQLite 耗时、512 行事务耗时分布、触发器清单、FTS 与逐查询 count-oracle 验证数量、SQLite page count/page size、主库/WAL/SHM 字节、查询计划和每类查询两种连接模式的 p50/p95/p99/min/max。它不测生产 provider 写入吞吐、RSS 或扫描吞吐。

PR benchmark path filter 只在两个隔离的 Rust benchmark 测试源文件变更时触发 100k Hosted Runner 矩阵；报告更新与 workflow maintenance 不会单独启动长时间矩阵。手动 workflow_dispatch 仍可选 100k、500k、1m、2m、5m。workflow 使用固定 shared-key 的 Swatinem/rust-cache 缓存 Rust registry、依赖构建产物和 target，允许不同规模及后续 PR 工作流复用依赖。Cloud 工作区的 Cargo registry 位于 /home/agent/.cargo，项目 build target 位于 src-tauri/target。工作流定义见 .github/workflows/global-search-benchmark.yml。手动复现命令：

```powershell
$env:ZC_GLOBAL_SEARCH_BENCHMARK_ENTRIES = "500000"
$env:ZC_GLOBAL_SEARCH_BENCHMARK_OUTPUT = (Join-Path $PWD "ci-evidence/global-search-baseline.jsonl")
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib global_index::tests::global_search_benchmark::global_search_synthetic_benchmark_baseline -- --ignored --exact --nocapture --test-threads=1
```

查询计划基于 `search.rs::candidate_sql` 生成同形 `EXPLAIN QUERY PLAN` SQL，并保留生产 SQL 中的索引选择/排序；报告会将其标为镜像查询，不伪称从生产私有语句自动捕获。计划输出只描述 SQLite 对合成数据库的策略。

## 6. 基准结果

最终 100k 证据来自 Windows Hosted Runner run [37872989762](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37872989762)，benchmark source SHA 为 16a2c18e87ab220ec3ddaf4ab11eaf70dcc12f70。Runner metadata 记录 Windows / x86_64。测试对象是 100,000 条合成 SQLite Global Index entry；路径只作为字符串写入数据库，没有创建或扫描真实文件。

GitHub Actions artifact **上传成功**：

| 项目 | 值 |
| --- | --- |
| Artifact name | global-search-baseline-100000-rows-37872989762 |
| Artifact ID | 11593946907 |
| GitHub artifact 状态 | 未过期；上传步骤 SUCCESS |
| ZIP 大小 | 3,660 bytes |
| Artifact digest | sha256:ae6cc04c449909d7a0f657c7c052d8a9cf494bba107b1d26b9038e4c990b1f9d |
| 本地下载校验 | 下载 ZIP 的 SHA-256 与 GitHub digest 完全一致 |
| JSONL 记录 | 45 条：1 dataset、12 count oracle、6 query plan、1 pagination、12 query、12 performance gate、1 summary |

Artifact 内 source SHA、run ID、平台和数据集字段与本节引用一致。报告是 benchmark 完成后的文档更新；下表性能数据绑定于 source SHA 16a2c18e87ab220ec3ddaf4ab11eaf70dcc12f70，不得解释为之后的文档提交重新跑出的结果。Final documentation HEAD 由 PR 最新 head 单独标识。

| 行数 | fixture 生成 ms | SQLite population ms | SQLite 主库 bytes | 主库 + WAL bytes | WAL / SHM bytes | 正确性 |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100,000 | 217.927 | 187,411.249 | 131,321,856 | 151,283,288 | 19,961,432 / 65,536 | 12/12 count oracle、12/12 query 与分页断言通过 |
| 500,000 | — | — | — | — | — | DEFERRED / NOT RUN — Owner scale-stop after 100k measured FTS pathology |
| 1,000,000 | — | — | — | — | — | DEFERRED / NOT RUN — Owner scale-stop after 100k measured FTS pathology |

数据库 page count 为 32,061，page size 为 4,096。数据库文件大小属于合成 SQLite Global Index；不代表文件系统扫描吞吐、进程 RSS、查询期间 CPU 或真实用户库占用。测试没有清理 OS page cache。

### 完整 100k 查询分位数

以下值来自已下载并校验 digest 的 JSONL。单位为毫秒，每类先做 5 次 warmup，再分别采集 30 个 warm 样本和 30 个 reopened-connection 样本。Warm 走 Database::search_global_entries 并计入连接池 checkout；reopened 每个样本新开 SQLite connection，但 connection open 时间不计入延迟。两种模式都没有清除 OS page cache，因此 reopened 不是冷盘读取测试。分位数以排序后线性插值计算。

| 查询类 | 完整匹配数 | warm p50 / p95 / p99 | reopened p50 / p95 / p99 |
| --- | ---: | ---: | ---: |
| exact basename | 1 | 0.652 / 0.782 / 1.024 | 0.863 / 0.911 / 0.955 |
| name prefix quarterly | 5,000 | 32.277 / 33.669 / 34.257 | 25.567 / 25.967 / 26.506 |
| common prefix high fan-out IMG_ | 4,999 | 33.335 / 36.002 / 38.706 | 26.631 / 27.028 / 27.167 |
| FTS substring report | 5,000 | 28,092.386 / **28,648.790** / 28,717.074 | 28,201.995 / 30,454.042 / 34,090.706 |
| FTS substring invoice | 5,000 | 35,643.821 / **36,765.041** / 38,380.463 | 35,625.693 / 35,870.300 / 35,901.047 |
| extension exact pdf | 18,130 | 0.762 / 0.816 / 1.251 | 1.010 / 1.066 / 1.108 |
| extension prefix jp | 8,129 | 7.180 / 7.435 / 8.604 | 13.210 / 13.275 / 13.667 |
| duplicate basename | 5,000 | 0.486 / 0.529 / 0.537 | 0.719 / 0.757 / 0.760 |
| no result zzznomatchtoken | 0 | 2,371.596 / **2,386.873** / 2,391.529 | 2,378.208 / 2,397.035 / 2,407.244 |
| Chinese prefix | 5,000 | 17.785 / 18.227 / 18.305 | 23.764 / 24.225 / 27.073 |
| punctuation prefix final-v2 | 5,000 | 18.080 / 18.499 / 18.657 | 24.225 / 27.321 / 29.362 |
| Unicode accented prefix | 5,000 | 17.361 / 17.634 / 17.701 | 23.055 / 23.719 / 25.378 |

12 个 count oracle 和 12 个 query record 均为 correct。Pagination record 验证分页拼接与前 80 条一致、无重复 ID、offset-at-cap 为空，offset 4090 返回预期 6 条。100ms warmed p95 gate 保持原值，结果为 **9/12 PASS、3/12 FAIL**：

| 超限查询类 | warm p95 | 与 100ms gate 的关系 |
| --- | ---: | --- |
| FTS substring report | 28,648.790 ms（28.649 s） | FAIL |
| FTS substring invoice | 36,765.041 ms（36.765 s） | FAIL |
| no result | 2,386.873 ms（2.387 s） | FAIL |

Workflow 的 benchmark test step 以 failure 结束，是由于以上三项实测性能 gate 超限；correctness assertions 与固定矩阵均完成，随后 artifact upload step 为 SUCCESS。它是性能回归证据，不是 artifact、runner 或 benchmark 基础设施失败。正常项目 CI 与 benchmark gate 是分开的状态。

FTS report 的 EXPLAIN QUERY PLAN 来自按 search.rs::candidate_sql 构造的镜像 SQL，而不是运行时私有查询自动捕获。计划记录包括：

- SEARCH gv USING INDEX idx_global_volumes_enabled (enabled=?)
- SEARCH ge USING INDEX idx_global_entries_volume (volume_id=? AND is_stale=?)
- SCAN global_entries_fts VIRTUAL TABLE INDEX 0:=M3
- correlated managed-entry 子查询通过 idx_managed_entries_global_entry 与 managed scope 主键索引访问
- USE TEMP B-TREE FOR ORDER BY

它与秒级 FTS 延迟一同构成 **measured follow-up hypothesis**：候选访问与 join 顺序可能不利，应由独立调查验证；计划本身没有证明根因，也没有证明 FTS5 本身性能差。No-result 查询 p95 为 2.387 秒，需要和对应 fallback 一起分析，但当前 artifact 未单独记录其 query plan。

### 500k / 1m 扩展规模

500k 与 1m 没有执行，状态明确为 **DEFERRED / NOT RUN — Owner scale-stop after 100k measured FTS pathology**，不是 PASS，也没有通过 100k 外推。Owner 决定在扩展前先记录已有 100k 的完整证据：两个 FTS p95 为 28.649 秒和 36.765 秒，无结果 p95 为 2.387 秒；更大 fixture 不会单独解释这些热点根因，并会重复消耗 Hosted Runner 时间。

Workflow 仍保留 workflow_dispatch 的 100k、500k、1m、2m、5m 选项。本轮不手动启动更大规模，也不在 #343 修改生产 SQL。关联的 measured follow-up 是 Issue #346 — Investigate Global Search FTS join order and no-result latency；#343 只记录证据，不实现该调查任务。

先前 source SHA 的旧性能数字不作为本节最终基线。对于以后的性能比较，应使用 exact source SHA、run、artifact 一起锁定被测代码与 JSONL，而不是把报告提交 SHA 当作 benchmark source。

### Cloud Linux 尝试

Cloud 中已按仓库 `rust-toolchain.toml` 安装 Rust 1.97.1；Rust/Cargo registry 共用 `/home/agent/.cargo`，系统库通过环境已有的 `/tmp/zc-audit-sysroot` pkg-config 路径复用。格式化可以本地执行。针对 Unicode 回归的 Linux `cargo test` 在 crate 编译阶段因 Linux 上不存在 `keyring` crate 而失败：项目仅为 Windows/macOS target 声明 keyring 依赖，但 `src-tauri/src/ai/settings.rs` 在 Linux 编译路径引用该类型。此处按项目平台边界停止，没有添加 Linux keyring 依赖、改 target cfg 或伪造 Linux 搜索结果。该阻塞不妨碍 Windows Hosted Runner 运行任务所需测试。

## 7. 平台证据边界

| 能力 | 状态 | 证据边界 |
| --- | --- | --- |
| SQLite Global Search 查询代码 | **完整 100k 矩阵已验证，性能门槛失败** | 12 类 synthetic SQLite query 都完成正确性和 p50/p95/p99；其中 FTS `report`、FTS `invoice`、无结果查询的 warm p95 超限 |
| Windows NTFS/MFT/USN 初次或增量发现 | **NOT VERIFIED** | 合成数据库不会触发 MFT/USN 或访问 NTFS 文件 |
| macOS APFS/FSEvents、隐私权限和预览 | **NOT VERIFIED** | 本任务不提供 macOS native runner 证据 |
| 冷盘读取 | **NOT VERIFIED** | reopen 模式不清 OS page cache |
| Linux Cloud SQL timing 作为 Windows/macOS 代用 | **禁止解释** | Linux 本次因 keyring 编译目标边界无法运行；即使可运行也只代表 Linux SQL 合成结果 |

Windows Hosted Runner 可以证明代码在该 runner 上对合成 SQLite fixture 的表现与正确性，不等价于 Owner 本机 NTFS 索引性能或 macOS 表现。Native file discovery、权限覆盖率及 watcher 恢复不属于本证据集。

## 8. 结果解释与后续决策

本次 100k 合成矩阵显示三个查询热点：FTS report warm p95 28.649 秒、FTS invoice 36.765 秒、无结果查询 2.387 秒。Owner 已在 Issue #346 登记 measured follow-up；该 issue 的下一步是隔离测量 FTS 子阶段、验证实际查询计划和 no-result fallback，并以结果等价测试保护现有顺序、去重及候选窗语义。#343 不实现这项调查。测得结果只涉及当前 synthetic SQLite 查询，不代表真实文件发现速度。

不建议根据这次数据直接重构 SoA 或引入 SIMD：当前测量定位在合成 SQLite 查询路径，尚无证据证明字符串扫描是瓶颈。Windows NTFS/MFT/USN、macOS APFS/FSEvents、权限覆盖率、冷盘读取及真实文件系统增量恢复仍需 Owner 实机验收，且不由本报告代替。
