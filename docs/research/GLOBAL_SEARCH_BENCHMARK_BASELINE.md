# Global Search 合成基准与回归证据基线

状态：**Windows Hosted Runner 结果待完成；未据此授权生产搜索优化。**

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

每个查询先做 5 次预热，再收集 100 个 warmed 样本和 50 个 reopened-connection 样本。warm 测量经过 `Database::search_global_entries`，计入池连接 checkout；reopened 测量每个样本都新开 SQLite connection，计时从查询开始、连接创建不计时。它**不是冷磁盘测试**：没有清空 OS 文件页缓存。分位数使用排序后线性插值。

旧基准的 100 ms p95 约束保留为 warmed 查询回归门槛，适用于不超过 1M 的规模，并按查询类分别检查。2M/5M 是扩展诊断规模，不把旧门槛外推为已批准产品 SLA。

## 5. 数据采集与复现

每个运行导出 JSONL artifact，包含 source SHA、runner OS/架构、entry 数、fixture 生成耗时、直接向 Global Index 表写入合成记录的 SQLite 耗时、512 行事务耗时分布、触发器清单、FTS 与逐查询 count-oracle 验证数量、SQLite page count/page size、主库/WAL/SHM 字节、查询计划和每类查询两种连接模式的 p50/p95/p99/min/max。它不测生产 provider 写入吞吐、RSS 或扫描吞吐。

PR 会在 Windows Hosted Runner 执行 100k；`workflow_dispatch` 可选 100k/500k/1m/2m/5m。workflow 使用固定 `shared-key` 的 `Swatinem/rust-cache` 缓存 Rust registry、依赖构建产物和 target，允许不同规模及后续 PR 工作流复用已下载依赖；Cloud 工作区的 Cargo registry 与 target 同样保留在 `/home/agent/.cargo`。行动与 artifact 定义见 `.github/workflows/global-search-benchmark.yml`。手动复现命令：

```powershell
$env:ZC_GLOBAL_SEARCH_BENCHMARK_ENTRIES = "500000"
$env:ZC_GLOBAL_SEARCH_BENCHMARK_OUTPUT = ".ci-evidence/global-search-baseline.jsonl"
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime --lib global_index::tests::global_search_benchmark::global_search_synthetic_benchmark_baseline -- --ignored --exact --nocapture --test-threads=1
```

查询计划基于 `search.rs::candidate_sql` 生成同形 `EXPLAIN QUERY PLAN` SQL，并保留生产 SQL 中的索引选择/排序；报告会将其标为镜像查询，不伪称从生产私有语句自动捕获。计划输出只描述 SQLite 对合成数据库的策略。

## 6. 基准结果

**Windows Hosted Runner 的测量结果待修复后的当前提交实际运行后填写。** 不把 Linux Cloud 或合成路径结果表述成 NTFS/APFS 性能。

| 行数 | Windows Hosted 来源 SHA / Run | fixture 生成 ms | SQLite 写入 ms | DB 主库 + WAL bytes | 查询 p50/p95/p99 | 正确性 |
| ---: | --- | ---: | ---: | ---: | --- | --- |
| 100,000 | 待运行 | — | — | — | — | 待运行 |
| 500,000 | 待运行 | — | — | — | — | 待运行 |
| 1,000,000 | 待运行 | — | — | — | — | 待运行 |

首次 100k Hosted 尝试（run `37812750902`，source SHA `f61179285ffbc7fcb616c2c9dbe4242f2ff19124`）在测试编译阶段失败，尚未执行 fixture 或查询：benchmark 的独立 SQLite count oracle 引用了生产模块私有的 `escape_glob`，触发 Rust E0425；因此没有 JSONL artifact 或性能数据。当前修正只在 benchmark 测试模块内添加本地 GLOB escape helper，没有改变生产代码。该尝试不计入性能结果，修复后的提交必须重新跑完整要求规模。

各查询类逐项分位、SQL 计划和原始样本以 PR 附件 JSONL 为准；报告在读取精确 source SHA 的 hosted artifacts 后更新。跑不到的规模会保留为未测，不插值或外推。

### Cloud Linux 尝试

Cloud 中已按仓库 `rust-toolchain.toml` 安装 Rust 1.97.1；Rust/Cargo registry 共用 `/home/agent/.cargo`，系统库通过环境已有的 `/tmp/zc-audit-sysroot` pkg-config 路径复用。格式化可以本地执行。针对 Unicode 回归的 Linux `cargo test` 在 crate 编译阶段因 Linux 上不存在 `keyring` crate 而失败：项目仅为 Windows/macOS target 声明 keyring 依赖，但 `src-tauri/src/ai/settings.rs` 在 Linux 编译路径引用该类型。此处按项目平台边界停止，没有添加 Linux keyring 依赖、改 target cfg 或伪造 Linux 搜索结果。该阻塞不妨碍 Windows Hosted Runner 运行任务所需测试。

## 7. 平台证据边界

| 能力 | 状态 | 证据边界 |
| --- | --- | --- |
| SQLite Global Search 查询代码 | Windows Hosted Runner 待验证 | synthetic SQLite fixture；不含 native filesystem enumeration |
| Windows NTFS/MFT/USN 初次或增量发现 | **NOT VERIFIED** | 合成数据库不会触发 MFT/USN 或访问 NTFS 文件 |
| macOS APFS/FSEvents、隐私权限和预览 | **NOT VERIFIED** | 本任务不提供 macOS native runner 证据 |
| 冷盘读取 | **NOT VERIFIED** | reopen 模式不清 OS page cache |
| Linux Cloud SQL timing 作为 Windows/macOS 代用 | **禁止解释** | Linux 本次因 keyring 编译目标边界无法运行；即使可运行也只代表 Linux SQL 合成结果 |

Windows Hosted Runner 可以证明代码在该 runner 上对合成 SQLite fixture 的表现与正确性，不等价于 Owner 本机 NTFS 索引性能或 macOS 表现。Native file discovery、权限覆盖率及 watcher 恢复不属于本证据集。

## 8. 结果解释与后续决策

本 Issue 的职责是先建立可复现基线。**在 100k/500k/1m 精确结果与查询计划到齐前，不声称已有实测瓶颈，也不据此开启 SoA、SIMD、查询缓存或搜索算法改造。** 若某查询类在暖查询中逼近/超过历史 100 ms p95，或数据库在扩展规模出现显著写入/存储代价，下一任务应先复核该查询 SQL/计划和结果分布，并只针对实测热点拆出一个独立任务。仅有总体平均值变好不构成更换搜索架构的证据。

本次预计唯一新回归权威是该 ignored 合成 benchmark 与随 run 保存的 JSONL artifact；不会新增生产指标或用户设置。Owner 实机验收若以后需要，应单独指定真实 NTFS/APFS fixture、机器规格、权限状态和 cold/warm 规程；本报告不替代该验收。
