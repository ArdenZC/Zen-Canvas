# Global Search 合成基准与回归证据基线

状态：**Windows 100k 完整合成矩阵已测：12 类正确性断言通过，FTS 子串和无结果查询有严重 p95 超限；500k/1m 未运行。首次完整运行未生成 artifact，已修正 CI 输出路径并安排新 PR HEAD 复跑。未修改生产搜索代码。**

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

支持 `100000`、`500000`、`1000000`、`2000000`、`5000000` 行；PR 自动运行 100k，手动工作流可选其他规模。合成记录包含唯一 ID、确定性大小与修改时间、扩展名分布、混合大小写、空格、数字、下划线、连字符、点、重名、长文件名、中文、NFC/NFD 字符形式，以及浅层/深层/多兄弟目录和 Windows 形态路径。样本路径对应 Documents、Downloads、Pictures、Desktop 和开发项目；没有访问这些真实路径。

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

PR 会在 Windows Hosted Runner 执行 100k；`workflow_dispatch` 可选 100k/500k/1m/2m/5m。workflow 使用固定 `shared-key` 的 `Swatinem/rust-cache` 缓存 Rust registry、依赖构建产物和 target，允许不同规模及后续 PR 工作流复用已下载依赖。Cloud 工作区的 Cargo registry 位于 `/home/agent/.cargo`，项目 build target 位于 `src-tauri/target`。行动与 artifact 定义见 `.github/workflows/global-search-benchmark.yml`。手动复现命令：

```powershell
$env:ZC_GLOBAL_SEARCH_BENCHMARK_ENTRIES = "500000"
$env:ZC_GLOBAL_SEARCH_BENCHMARK_OUTPUT = (Join-Path $PWD "ci-evidence/global-search-baseline.jsonl")
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib global_index::tests::global_search_benchmark::global_search_synthetic_benchmark_baseline -- --ignored --exact --nocapture --test-threads=1
```

查询计划基于 `search.rs::candidate_sql` 生成同形 `EXPLAIN QUERY PLAN` SQL，并保留生产 SQL 中的索引选择/排序；报告会将其标为镜像查询，不伪称从生产私有语句自动捕获。计划输出只描述 SQLite 对合成数据库的策略。

## 6. 基准结果

完整运行：[Windows Hosted Runner run 37863673393](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37863673393)，source SHA `98e8f46954d0af7dd37374303cfdd897ce58a438`，Windows Server 2025 x86_64。路径和文件名是合成数据，只测 SQLite Global Index 查询，不访问真实文件系统。固定查询矩阵完整运行 **6,478.16 秒（约 107 分 58 秒）** 后因性能门槛失败；性能门槛在所有 12 类查询完成后才统一判定。

| 行数 | fixture 生成 ms | SQLite 写入 ms | DB 主库 bytes | 主库 + WAL bytes | 正确性 / 状态 |
| ---: | ---: | ---: | ---: | ---: | --- |
| 100,000 | 271.022 | 130,943.738 | 131,321,856 | 151,283,288 | 12/12 count oracle、12/12 query 结果通过；3 个查询类超历史 p95 门槛 |
| 500,000 | — | — | — | — | 未运行：100k 完整矩阵耗时约 108 分钟且已发现三个严重超限热点 |
| 1,000,000 | — | — | — | — | 未运行；没有从 100k 外推 |

生成 fixture 时保留生产 entry、count 和 FTS 触发器；共 196 个 512 行事务。SQLite page count 为 32,061，page size 为 4,096；采样时 WAL 为 19,961,432 bytes，SHM 为 65,536 bytes。索引已建好后查询计时。测试没有记录 RSS、扫描吞吐或 OS page-cache 冷读。

### 完整 100k 查询分位数

单位为 ms。`warm` 通过 `Database::search_global_entries`，包含 pool checkout；`reopened` 每个样本新建 SQLite connection，但不把 connection open 耗时计入查询，也没有清除 OS page cache。每类有 5 次 warmup、30 次 warm 和 30 次 reopened 样本。分位数按排序后的线性插值计算。

| 查询类 | 预期命中数 | warm p50 / p95 / p99 | reopened p50 / p95 / p99 |
| --- | ---: | ---: | ---: |
| 精确文件名 | 1 | 0.877 / 0.959 / 0.975 | 1.150 / 1.651 / 1.738 |
| 名称前缀 `quarterly` | 5,000 | 44.249 / 49.050 / 54.427 | 34.491 / 40.295 / 42.474 |
| 高扇出前缀 `IMG_` | 4,999 | 47.279 / 60.913 / 72.468 | 40.871 / 51.816 / 58.074 |
| FTS 子串 `report` | 5,000 | 40,697.099 / **45,337.153** / 49,177.393 | 39,567.320 / 39,711.631 / 39,832.675 |
| FTS 子串 `invoice` | 5,000 | 51,834.468 / **53,049.098** / 54,177.347 | 51,998.119 / 52,133.997 / 52,161.768 |
| 精确扩展名 `pdf` | 18,130 | 1.037 / 1.391 / 2.289 | 1.311 / 1.372 / 1.478 |
| 扩展名前缀 `jp` | 8,129 | 11.736 / 12.046 / 15.976 | 18.445 / 19.297 / 19.454 |
| 重名 `meeting-notes.md` | 5,000 | 0.669 / 0.715 / 0.721 | 0.963 / 1.027 / 1.195 |
| 无结果 `zzznomatchtoken` | 0 | 3,428.000 / **3,452.392** / 3,457.959 | 3,426.006 / 3,459.455 / 3,467.818 |
| 中文前缀 `数据库` | 5,000 | 27.283 / 28.341 / 28.992 | 34.275 / 38.204 / 39.993 |
| 标点前缀 `final-v2` | 5,000 | 26.785 / 29.322 / 32.540 | 33.694 / 36.521 / 37.882 |
| 重音字符前缀 `RÉSUMÉ` | 5,000 | 25.715 / 26.722 / 27.366 | 32.777 / 34.284 / 35.877 |

12 个独立 count oracle 均正确；12 个 query 类返回的完整预期 ID 顺序、结果数量和唯一性检查全部通过。高扇出查询的第一页与第二页连接结果匹配预期前 80 条，offset 4090 页边界返回 6 条，offset 4096 为空。性能门槛记录为 **3/12 失败**：FTS `report` p95 45.337 秒、FTS `invoice` p95 53.049 秒、无结果查询 p95 3.452 秒，均超过保留的历史 100ms p95 门槛。该门槛是原 ignored 基准的回归阈值，不是新批准的产品 SLA。

FTS `report` 镜像查询计划先经 `idx_global_volumes_enabled` 查 volume，再用 `idx_global_entries_volume(volume_id, is_stale)` 扫描该 volume 条目，之后访问 FTS 虚拟表，并执行相关 managed 子查询与临时排序。该计划是按 `search.rs::candidate_sql` 构造的 `EXPLAIN QUERY PLAN` 镜像，不是运行时私有 SQL 的自动捕获。计划与慢查询同时出现，说明值得优先核查 FTS 查询中的 join order 和候选生成路径，但**尚未证明它们就是根因**。无结果查询也达 3.452 秒 p95；其查询计划未单独捕获，需一并检查无命中时的 fallback 路径。本任务未改生产 SQL。

该 run 在 GitHub job log 打印了 44 条 JSONL 记录（12 count oracle、6 query plan、1 pagination、12 query 分位数、12 performance gate 和 1 summary），但没有生成 artifact：runner 的相对输出路径由 Cargo 测试工作目录解析，和 `upload-artifact` 在仓库根目录查找的位置不同。工作流已将输出文件改为 `${{ github.workspace }}/ci-evidence/global-search-baseline.jsonl` 的绝对路径，并在本修订 PR HEAD 上重跑以产生可下载 JSONL artifact。首次 artifact 缺失不会被误报为已上传。

先前 100k 尝试中，run `37812750902`（source SHA `f61179285ffbc7fcb616c2c9dbe4242f2ff19124`）编译时因测试 count oracle 引用了生产模块私有 `escape_glob` 而失败，未执行 fixture；随后 run `37814520555`（source SHA `ff48085ad02e7049a9438d3026d49295a0c746a5`）使用 100 warmed + 50 reopened 样本，首个 FTS 类 p95 超限后中止。该 run 的 Rust cache 完整命中，恢复 `710,998,689` bytes（约 678 MiB）；Cargo registry 和 `src-tauri/target` 被复用。更新后的完整矩阵使用 30/30 样本并延后性能判定，结果以本节的完整运行记录为准。

500k 与 1m 没有运行。仅 100k 完整矩阵就耗时约 108 分钟，且多个常见/无结果查询达到秒至几十秒；在定位并修复 SQL 查询瓶颈前继续扩大 fixture 不实际，也会大量延长 Hosted Runner 时间。没有估算、更没有把 100k 性能外推到更大规模。

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

本次 100k 合成矩阵显示三个性能热点：FTS `report` warm p95 45.337 秒、FTS `invoice` 53.049 秒、无结果查询 3.452 秒；名称前缀 p95 为 49.050 ms，高扇出前缀为 60.913 ms。下一项最小风险代码任务应单独核查 `search_fts` 的 SQLite join order、候选生成路径以及无结果 fallback，并比较实际 SQL 的执行计划；保持结果排序、去重和候选窗语义不变，再用本基准验证。测得结果只涉及当前 synthetic SQLite 查询，不代表真实文件发现速度。

不建议根据这次数据直接重构 SoA 或引入 SIMD：主要异常出在 FTS SQL 查询计划，而非字符串扫描的已证瓶颈。该 ignored 合成 benchmark 与 JSONL artifact 是本任务唯一新增的搜索性能证据路径；不会新增生产指标或用户设置。Windows NTFS/MFT/USN、macOS APFS/FSEvents、权限覆盖率、冷盘读取及真实文件系统增量恢复仍需 Owner 实机验收，且不由本报告代替。
