# Remediation Risk Register

这是 PR #15 合并后持续更新的风险基线。只有人工批准并位于 `master` 的完整模块任务书能够授权生产修改。

等级：

- **Critical**：可能越过文件、AI、隐私或恢复边界，或造成不可逆数据后果；
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不兼容迁移；
- **Medium**：造成一致性、性能、可观测性或维护风险；
- **Low**：影响较小，仍需留下证据。

## 持续全局风险

| ID | 风险 | 等级 | 触发条件/影响 | 阻断/缓解与验收条件 | 状态 |
|---|---|---|---|---|---|
| R-001 | 重建第二套 Global Index | Critical | search、AI、scope、stale 事实分裂 | global discovery/search 只复用 `global_*` | 持续阻断 |
| R-002 | 把 `ai_jobs` 泛化为通用 Job Runtime | High | scan/cleanup/dedupe/search 污染 AI 语义 | AI 表和 worker 保持领域专用 | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | 多 owner 重复消费、丢失或重复执行 | 每个 domain 固定 owner/claim/cancel/retry/recovery | 持续阻断 |
| R-004 | Scan 崩溃后误判完成 | High | partial files 被执行 stale | run/generation/scan_seen/recovery | 已处理，持续回归 |
| R-005 | Watcher overflow 后丢失最终一致性 | High | bounded channel 丢事件 | Rust owner、revision gap、managed reconciliation | 已处理，持续回归 |
| R-006 | 多 watcher/provider 跨域写入 | High | files/global authority 混淆 | File Library 与 Global Index 隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | rename/case/cross-volume 后误合并或丢历史 | 禁止迁移 `files.id`；保持旁路 identity | 持续阻断 |
| R-008 | operation identity 被 fingerprint 替代 | Critical | symlink/reparse/restore 安全语义丢失 | mutation 继续走 preview/claim/identity/journal | 持续阻断 |
| R-009 | Dedupe 用户语义错误 | High | hardlink、物理副本和同内容文件混淆 | physical identity、exact/potential、不得自动删除 | 持续回归 |
| R-010 | Dedupe/Finding 重启丢失 | High | 内存结果不可审计 | durable dedupe 与 Analysis Run/Finding | 已处理 |
| R-011 | Global cursor 被当通用 generation/cursor | High | 不同 provider/query 语义混用 | scan generation、Global Search、Library、Plan revision 独立 | 持续阻断 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | unmanaged/global row 进入 AI | scope/provider/correction gate | 持续阻断 |
| R-013 | AI 覆盖用户 correction/decision | Critical | retry/reanalysis 覆盖人工决定 | correction/decision 最高优先 | 持续阻断 |
| R-014 | Content Artifact 泄露隐私 | Critical | 默认读取/上传或长期保存正文 | Task 08 consent/预算/脱敏/retention | 阻断提前建设 |
| R-015 | AI trace 被当内容库 | High | 截断/脱敏数据被业务复用 | trace 仅诊断 | 持续阻断 |
| R-016 | 过期 Organization Plan 仍执行 | Critical | renderer 持旧 plan/dry run | plan/item revision、live preview/identity、dry-run fingerprint | **Task 06 当前强制整改** |
| R-017 | 业务绕过 preview/journal/restore | Critical | AI/finding/plan/command 直接 filesystem | 所有 mutation 经过既有安全链 | 持续阻断 |
| R-018 | OFFSET 在实时 File Library 跳页/重复 | High | scan/watcher 改变排序 | Library revision snapshot + keyset cursor | 已实现，Task 06 补 cursor integrity |
| R-019 | 跨页选择表达不真实 | High | loaded rows 被描述为全部结果 | explicit/all_matching selection contract | 已实现，Task 06 补 100k truth |
| R-020 | 大表 count/sort 成本失控 | Medium | CTE/count/deep pagination 拖慢 100k/1M | deferred exact count、query plan、cold/warm benchmark | **Task 06 第一组** |
| R-021 | Native helper/service 协议漂移 | High | service/fallback/installer 不一致 | versioned protocol、native smoke | 持续监控 |
| R-022 | partial/degraded 被当 complete | High | 权限/provider 仅返回部分结果 | health/completeness 同 snapshot | 已处理，持续回归 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | schema 改动破坏恢复 | fixture、rollback、reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 长事务阻塞 global/AI/library/journal | 短事务、WAL reader benchmark | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 阶段、schema、边界过时 | 当前代码/测试为事实，Closeout 同步 | 持续监控 |
| R-026 | 阶段循环依赖 | High | Plan/finding/identity 相互等待 | 完整模块 prerequisite/non-goal | 已重排 |
| R-027 | 性能被 `PRAGMA optimize` 掩盖 | Medium | 只测 warm/optimized path | cold/warm/query plan/阶段 IO | 持续监控 |
| R-028 | Audit warning 被误当修复 | Medium | exit 0 但 allowed advisories 仍存在 | 记录 owner/inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/library/cleanup/AI/plan scope 混为一套 | 每种 root/scope 显式、negative tests | 持续阻断 |
| R-030 | 分支混入无关文件 | High | broad stage 混入 release/build/后续模块 | allowed paths、Draft PR scope review | 持续门禁 |

## Task 01A–03 已处理风险

| ID | 风险 | 等级 | 最终契约 | 状态 |
|---|---|---|---|---|
| R-031 | 同 root active run/旧 generation 竞争 | Critical | root lease + generation/revision CAS | 已处理，持续测试 |
| R-032 | metadata error 导致错误 stale | Critical | coverage-breaking；错误 run 禁止 stale | 已处理 |
| R-033 | multi-root mapping/dedupe 调度不真实 | High | durable requested→effective；at-least-once | 已处理 |
| R-034 | migration rollback/future schema guard | High | transaction rollback；future schema rejection | 已处理，持续沿用 |
| R-035 | 旧 scan event 覆盖新状态 | High | durable revision + hydrate | 已处理 |
| R-036 | Session phase 随 root 倒退 | High |独立聚合 phase | 已处理 |
| R-037 | 内存 DedupeJobManager 被当 durable truth | High | durable dedupe run | 已处理 |
| R-038 | watcher error 擦除待恢复失败 | High | durable rule recovery state | 已处理 |
| R-039 | lightweight identity 替代 operation identity | Critical |只读 physical helper | 已处理，持续阻断 |
| R-040 | Hardlink 被计为可释放副本 | Critical | physical key 去重 | 已处理 |
| R-041 | stale fingerprint cache 误确认 | Critical | modified_ns/identity/version/CAS | 已处理 |
| R-042 | Prehash 被当最终证据 | Critical | full BLAKE3 才确认 | 已处理 |
| R-043 | Dedupe crash/并行 IO | High | durable runs、one-active-scope、recovery | 已处理 |
| R-044 | Group publication 半成品 | High | deterministic group + short transaction | 已处理 |
| R-045 | 局部 scope 发布不完整 group | Critical | global duplicate authority | 已处理 |
| R-046 | Dedupe 压垮 IO/SQLite | High | bounded workers/channel | 持续性能门禁 |
| R-047 | Duplicate UI 越权删除 | Critical | read-only；无 keeper/delete | 持续阻断 |
| R-048 | `content_hash` 与 group 双重事实 | High | membership authority；hash mirror | 已处理 |
| R-049 | 局部 dedupe 破坏跨 root group | Critical | authoritative publication 全 enabled roots | 已处理 |
| R-050 | prehash/cancel/progress 错误 | High | before/after identity、真实 IO progress | 已处理 |
| R-051 | partial/cancelled findings 被发布 | Critical | staged + atomic publication | 已处理 |
| R-052 | detector 失败擦除旧有效结果 | High |只替换成功 detector/scope | 已处理 |
| R-053 | finding decision 错误继承 | High | identity-sensitive key | 已处理 |
| R-054 | finding/AI 成为执行授权 | Critical | finding 非授权；mutation 安全链不变 | 持续阻断 |
| R-055 | exact/potential/overlap 双重计数 | High | physical subject union | 已由 Task 04 关闭 |
| R-056 | 任意 path/detector 注入 | Critical | fixed registry + scope/path validation | 持续阻断 |
| R-057 | 内存 cleanup candidate 跨重启执行 | Critical | durable finding/revision + live identity | 已处理 |
| R-058 | Analysis schema/事务拖慢主库 | High | staging/短 publication/WAL benchmark | 持续性能门禁 |
| R-059 | retention 删除仍被引用事实 | High | child-first bounded prune | 已处理 |
| R-060 | renderer 不从 ledger hydrate | High | hydrate + revision reject/refetch | 已处理 |

## Task 04 全局快捷搜索风险

| ID | 风险 | 等级 | 最终合同 | 状态 |
|---|---|---|---|---|
| R-061 | exact physical subject 重复累计 | High | duplicate + Safe exact authoritative union | 已关闭，持续回归 |
| R-062 | 迟到 response 覆盖新 query/session | High | request/session identity、latest wins | 已关闭，持续回归 |
| R-063 | Search window/hotkey 多 owner | High | Rust lifecycle owner + rollback | 已关闭，持续跨平台回归 |
| R-064 | degraded source 被表示为 complete | High |所有非 ready enabled source 排除 completeness | 已关闭，持续回归 |
| R-065 | stale/disabled/missing result 被打开 | Critical | ID-only backend live revalidation | 已关闭，持续回归 |
| R-066 | Command Palette 绕过安全边界 | Critical | metadata/execute 分离、fixed adapters | 已关闭，持续阻断 |
| R-067 | Tolaria AGPL 代码/结构移植 | Critical | design-only、SHA/LICENSE、无移植审查 | 已通过许可证门禁 |
| R-068 | IME 行为没有 mounted invoke 证明 | High | mounted interaction | 已关闭，持续回归 |
| R-069 | Global Search 与 File Query V2 混用 | Critical |独立 authority/scope/cursor/revision | 已关闭，持续隔离 |
| R-070 | Search metadata N+1 | Medium | single snapshot/grouped health | 已关闭，持续性能门禁 |
| R-071 | tier tie-break/punctuation 语义不稳定 | High | extension durable ID；正确性测试 | 已关闭，持续回归 |
| R-072 | ACK 后旧 navigation 隐藏新 session | High | ACK 后 revalidate；scoped hide | 已关闭，持续回归 |
| R-073 | results/health/revision 不同 snapshot | High | one SQLite read transaction | 已关闭，持续回归 |

## Task 05 文件库风险

| ID | 风险 | 等级 | 最终合同 | 状态 |
|---|---|---|---|---|
| R-074 | Query V2 revision 漏 bump | Critical |统一 transaction helper、写路径 tests | 已实现，持续回归 |
| R-075 | Cursor 可伪造或绑定错误 query | Critical | backend anchor membership + complete tuple validation | **Task 06 第一组，不得后移** |
| R-076 | Renderer filtering/sorting 伪装全库真值 | High | filter/sort 下沉 SQLite | 已关闭 |
| R-077 | all_matching selection 与 snapshot/query 不一致 | Critical | canonical query + fingerprint + revision + exclusions | 已实现，Task 06 补大规模边界 |
| R-078 | Tag metadata 与系统分类或文件名混用 | Critical |独立 tables/DTO；metadata-only | 已关闭，持续阻断 |
| R-079 | Bulk tag 部分提交或越权 | High | authoritative set、100k cap、single transaction | **Task 06 补 TEMP set** |
| R-080 | `files.id` 更新破坏 tag FK | Critical | ON UPDATE CASCADE | 已关闭 |
| R-081 | Saved View 注入/静默扩大 scope | Critical | canonical typed JSON；invalid references | 已关闭，持续回归 |
| R-082 | Saved View 保存 cursor/selection | High |只持久 QuerySpec | 已关闭 |
| R-083 | Summary DTO 过宽或 Detail 不完整 | High | summary/detail/selection 分离 | **Task 06 补 finding/common tags** |
| R-084 | Snapshot 长期占用 WAL/物化百万 IDs | High | stateless query snapshot | 已关闭 |
| R-085 | Root scope 由 renderer path 注入 | Critical | durable IDs、backend resolve | 已关闭 |
| R-086 | schema 31 migration 非原子 | Critical | transaction rollback、future guard | 已关闭 |
| R-087 | Tag/Saved View 主库锁竞争 | High | set-based short transaction | 已验证，持续性能门禁 |
| R-088 | Keyset sort tie 漂移 | High | fixed collation/null + durable ID | 已实现，Task 06 补 cursor anchor |
| R-089 | 1M exact count 无界 | High | deferred exact count，不估算 | **Task 06 第一组，不得后移** |
| R-090 | TagSpaces AGPL 移植 | Critical | design-only | 已通过许可证门禁 |
| R-091 | Search window 获得 Library write 权限 | Critical | main-only capability | 已关闭，持续权限门禁 |
| R-092 | Selection 成为直接文件 mutation authority | Critical | Task 05 只允许 metadata；Task 06 先 plan 再 journal | 持续阻断 |

## Task 05 → Task 06 接受遗留

| ID | 风险 | 等级 | Task 06 强制解决方案 | 状态 |
|---|---|---|---|---|
| R-093 | Vault query effect 无限/重复请求 | High | 单向 query flow + mounted invoke-count | **当前第一组** |
| R-094 | 合法 JSON cursor 篡改 | Critical | live anchor membership/tuple revalidation；不信任 cursor count | **当前第一组** |
| R-095 | 100k explicit selection SQL 参数爆炸 | Critical | backend TEMP/request-local selection set | **当前第一组** |
| R-096 | snapshot expired 清空真实画面 | High |保留 rows、banner、all_matching invalidation | **当前第一组** |
| R-097 | Tags/Saved Views 产品 CRUD 不完整 | High |完整 UI/CAS/focus/error tests | **当前第一组** |
| R-098 | Detail/selection summary 缺关键事实 | High | active finding/common directory/tag commonality | **当前第一组** |
| R-099 | 秒级/optional CAS 覆盖新写入 | Critical | schema32 mandatory monotonic revision | **当前第一组** |
| R-100 | virtual ARIA 引用未挂载 row | Medium | mounted-row-only active descendant | **当前第一组** |
| R-101 | 1M complex count 被自行降级为 diagnostic | High |批准的 deferred exact count contract | **当前第一组** |

## Task 06 Organization Plan 风险

| ID | 风险 | 等级 | 阻断/验收条件 | 状态 |
|---|---|---|---|---|
| R-102 | 内存 organize decision 被当 durable truth | Critical | schema32 plan/item ledger、restart hydrate | 当前强制整改 |
| R-103 | Plan snapshot 被当实时 file identity | Critical | snapshot 仅历史；execution live preview/identity | 当前强制整改 |
| R-104 | renderer 修改 target path/operation kind | Critical | request 只允许 IDs/decision/filename；backend proposal | 当前强制整改 |
| R-105 | stale proposal 继承 accepted decision | Critical | proposal fingerprint change → needs-review | 当前强制整改 |
| R-106 | Plan 建第二套 operation/undo journal | Critical | operation journal 唯一 truth；plan 仅 mapping/projection | 当前持续阻断 |
| R-107 | AI 自动接受或执行 | Critical | Managed AI adapter 只分析；explicit refresh/review/confirm | 当前持续阻断 |
| R-108 | Plan 绕过 managed scope/provider policy | Critical | source V2 selection、managed AI gate、negative tests | 当前强制整改 |
| R-109 | Plan 创建半成品/超过上限部分提交 | High | staged atomic publication、10k preflight cap | 当前强制整改 |
| R-110 | Dry run 过期仍执行 | Critical | fingerprint 绑定 revision/item set/live facts | 当前强制整改 |
| R-111 | 执行崩溃后重复 mutation | Critical | caller batch ID、journal reconciliation、no auto replay | 当前强制整改 |
| R-112 | 10k plan/1k execution 阻塞主库或 UI | High | keyset/virtual、short transaction、WAL/performance gates | 当前性能门禁 |
| R-113 | cleanup/delete 混入 Organization Plan | Critical | proposal blocked；无 move_to_trash/delete API | 当前持续阻断 |
| R-114 | ai-file-sorter AGPL 代码/结构移植 | Critical | fixed SHA/license、concept-only、no transplant tests | 当前许可证门禁 |
| R-115 | terminal plan retention 删除 journal | Critical | plan prune 不删除 operation/cleanup logs | 当前强制整改 |
| R-116 | Search window 调用 plan/AI/execution | Critical | main-only capabilities、negative tests | 当前权限门禁 |

## 风险结论

Task 05 已通过 PR #38 squash 合并，merge commit 为 `5468a17790165a149c462a17b64d011750b45410`。R-093–R-101 是人工明确接受并转入 Task 06 第一组的最后遗留，不得再次后移。Task 06 必须建立 durable Organization Plan，同时保持 Managed AI queue、authoritative preview、operation journal、Safe Trash 和 restore 的既有 owner。Task 07–08 继续禁止执行。