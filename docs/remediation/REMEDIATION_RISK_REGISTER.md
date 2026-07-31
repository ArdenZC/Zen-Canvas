# Remediation Risk Register

这是 PR #15 合并后持续更新的风险基线。只有人工批准并位于 `master` 的完整模块任务书能够授权生产修改。

等级：

- **Critical**：可能越过文件、AI、隐私或恢复边界，或造成不可逆数据后果；
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不兼容迁移；
- **Medium**：造成一致性、性能、可观测性或维护风险；
- **Low**：影响较小，仍需留下证据。

## 持续全局风险

| ID | 风险 | 等级 | 阻断/缓解与验收条件 | 状态 |
|---|---|---|---|---|
| R-001 | 重建第二套 Global Index | Critical | global discovery/search 只复用 `global_*` | 持续阻断 |
| R-002 | 把 `ai_jobs` 泛化为通用 Job Runtime | High | AI 表和 worker 保持领域专用 | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | 每个 domain 固定 owner/claim/cancel/recovery | 持续阻断 |
| R-004 | Scan 崩溃后误判完成 | High | run/generation/scan_seen/recovery | 已处理，持续回归 |
| R-005 | Watcher overflow 丢失最终一致性 | High | Rust owner、revision gap、managed reconciliation | 已处理，持续回归 |
| R-006 | 多 watcher/provider 跨域写入 | High | File Library 与 Global Index 隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | 禁止迁移 `files.id`；保持旁路 identity | 持续阻断 |
| R-008 | operation identity 被 fingerprint 替代 | Critical | mutation 继续走 preview/claim/identity/journal | 持续阻断 |
| R-009 | Dedupe 用户语义错误 | High | physical identity、exact/potential、不得自动删除 | 持续回归 |
| R-010 | Dedupe/Finding 重启丢失 | High | durable dedupe 与 Analysis Run/Finding | 已处理 |
| R-011 | Global cursor 被当通用 generation/cursor | High | 各域 revision/cursor 独立 | 持续阻断 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | scope/provider/correction gate | 持续阻断 |
| R-013 | AI 覆盖用户 correction/decision | Critical | correction/decision 最高优先 | 持续阻断 |
| R-014 | Content Artifact 泄露隐私 | Critical | Task 08 consent/预算/脱敏/retention | 阻断提前建设 |
| R-015 | AI trace 被当内容库 | High | trace 仅诊断 | 持续阻断 |
| R-016 | 过期 Organization Plan 仍执行 | Critical | live preview/identity/root health/fingerprint | **Task 07 第一组继续加固** |
| R-017 | 业务绕过 preview/journal/restore | Critical | 所有 filesystem mutation 经过既有安全链 | 持续阻断 |
| R-018 | OFFSET 在实时 File Library 跳页/重复 | High | revision snapshot + keyset cursor | 已关闭，持续回归 |
| R-019 | 跨页选择表达不真实 | High | explicit/all_matching authoritative selection | 已关闭，持续回归 |
| R-020 | 大表 count/sort 成本失控 | Medium | deferred exact count、query plan、cold/warm | 持续性能门禁 |
| R-021 | Native helper/service 协议漂移 | High | versioned protocol、native smoke | 持续监控 |
| R-022 | partial/degraded 被当 complete | High | health/completeness 同 snapshot | 持续回归 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | fixture、rollback、reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 短事务、WAL reader benchmark | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 当前代码/测试为事实，Closeout 同步 | 持续监控 |
| R-026 | 阶段循环依赖 | High | 完整模块 prerequisite/non-goal | 已重排 |
| R-027 | 性能被 warm/optimize 掩盖 | Medium | cold/warm/query plan/阶段 IO | 持续监控 |
| R-028 | Audit warning 被误当修复 | Medium | 记录 owner/inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/library/cleanup/AI/plan/rule scope 分离 | 持续阻断 |
| R-030 | 分支混入无关文件 | High | allowed paths、Draft PR scope review | 持续门禁 |

## 已处理模块风险摘要

| 范围 | ID | 最终合同 | 状态 |
|---|---|---|---|
| Scan/Watcher | R-031–R-038 | root lease、generation/revision CAS、metadata-error safety、durable reconciliation | 已处理，持续测试 |
| Identity/Dedupe | R-039–R-050 | operation identity 隔离、hardlink-safe physical identity、full hash、durable runs | 已处理，持续测试 |
| Analysis/Finding | R-051–R-060 | staged publication、finding identity、decision、retention、hydrate | 已处理，持续测试 |
| Global Search | R-061–R-073 | single authority、source health、ID-only actions、window lifecycle、IME/ARIA | 已处理，持续测试 |
| File Library | R-074–R-092 | Query V2、cursor authority、selection、tags、Saved Views、scope、permissions | 已处理，持续测试 |
| Task 05 handoff | R-093–R-101 | query loop、cursor tamper、100k TEMP set、snapshot UI、CRUD/CAS/DTO/ARIA/deferred count | 已由 Task 06 实现，持续回归 |

## Task 06 Organization Plan 基线风险

| ID | 风险 | 等级 | 阻断/验收条件 | 状态 |
|---|---|---|---|---|
| R-102 | 内存 organize decision 被当 durable truth | Critical | schema32 plan/item ledger、restart hydrate | 已关闭，持续回归 |
| R-103 | Plan snapshot 被当实时 file identity | Critical | snapshot 仅历史；execution live preview/identity | 已实现但需 R-117 加固 |
| R-104 | renderer 修改 target path/operation kind | Critical | request 只允许 IDs/decision/filename | 已阻断 |
| R-105 | stale proposal 继承 accepted decision | Critical | proposal fingerprint change → review | 已实现但需 R-119 加固 |
| R-106 | Plan 建第二套 operation/undo journal | Critical | operation journal 唯一 truth | 已阻断 |
| R-107 | AI 自动接受或执行 | Critical | AI 只分析；explicit refresh/review/confirm | 已阻断 |
| R-108 | Plan 绕过 managed scope/provider policy | Critical | source V2 selection、managed scope negative tests | 需 R-118 加固 |
| R-109 | Plan 创建半成品/超过上限部分提交 | High | staged atomic publication、10k preflight | 已关闭 |
| R-110 | Dry run 过期仍执行 | Critical | fingerprint 绑定 live facts | 需 R-117 加固 |
| R-111 | 执行崩溃后重复 mutation | Critical | caller batch ID、journal reconciliation、no replay | 已阻断，R-120 补 terminal projection |
| R-112 | 10k plan/1k execution 阻塞主库或 UI | High | keyset/virtual/short transaction/WAL | 持续性能门禁 |
| R-113 | cleanup/delete 混入 Plan | Critical | blocked；无 trash/delete API | 已阻断 |
| R-114 | ai-file-sorter AGPL 移植 | Critical | fixed SHA/license、concept-only | 已通过许可证门禁 |
| R-115 | terminal plan retention 删除 journal | Critical | plan prune 不删除 logs | 已阻断，R-121 修正候选逻辑 |
| R-116 | Search window 调用 plan/AI/execution | Critical | main-only capabilities | 已关闭，持续权限门禁 |

## Task 06 → Task 07 接受遗留

| ID | 风险 | 等级 | Task 07 强制解决方案 | 状态 |
|---|---|---|---|---|
| R-117 | 用户审核旧 target，执行采用新 target | Critical | dry run 与 execution 共享 live canonical proposal/selection；任何 target/risk/preview/collision 变化过期 | 已关闭，故障注入回归 |
| R-118 | Plan 创建后 root disabled/degraded 仍执行 | Critical | refresh/dry run/execute 全链 managed scope/root health revalidation | 已关闭，fail-closed 回归 |
| R-119 | `needs_review` 人工批准路径不可达 | High | backend reviewed transition + live revalidation；blocked 永不可升级 | 已关闭 |
| R-120 | 全部 journal 完成后重启仍停 partial | High | finalize/recovery 共用 terminal projection helper + fault injection | 已关闭 |
| R-121 | Plan retention 使用 age AND count | Medium | age UNION count overflow、去重、child-first、每批 20 | 已关闭 |
| R-122 | Plan 全局数量由首屏 100 行推断 | High | backend authoritative plan summary | 已关闭 |
| R-123 | skipped package job 被描述为 success | Medium | run/job/artifact 逐项证据，本地/远端分开 | 交付门禁；Draft PR 最终记录 |

## Task 07 Natural-Language Rule Proposal 风险

| ID | 风险 | 等级 | 阻断/验收条件 | 状态 |
|---|---|---|---|---|
| R-124 | 模型输出直接写入正式 Rule | Critical | durable proposal → strict validation → preview → human Apply | 已关闭 |
| R-125 | Proposal Apply 自动启用或运行 | Critical | 新规则默认 disabled；Enable/Run 独立 CAS | 已关闭 |
| R-126 | renderer Rule vector 成为执行 authority | Critical | `execute_rules_for_scope_v2` backend 加载 enabled rules | 已关闭 |
| R-127 | whole-object save 覆盖较新规则 | Critical | per-rule revision + catalog revision CAS；CRUD 分离 | 已关闭 |
| R-128 | 模型虚构 literal/path/数字/target | Critical | literal grounding；非 prompt/规范化/enum → clarification/deny | 已关闭 |
| R-129 | 自然语言变成脚本/Agent/tool runtime | Critical | AST V1 only；无 shell/MCP/tools/SDK/daemon | 持续阻断 |
| R-130 | Proposal AI 泄露文件正文/列表/secrets | Critical | 只发送用户 prompt + fixed schema；privacy tests | 持续阻断 |
| R-131 | 影响预览把 sample/estimate 当全库事实 | High | exact/deferred；sample 标记；Apply 需要 exact | 已关闭 |
| R-132 | stale proposal/preview 应用于新 catalog/library | Critical | proposal/rule/catalog/library/scope/policy fingerprint + CAS | 已关闭 |
| R-133 | update proposal 覆盖已更新 rule | Critical | target rule ID + base revision；stale reject | 已关闭 |
| R-134 | delete/trash/content intent 被转换为可执行 Rule | Critical | deny classification；无 filesystem mutation/content field | 持续阻断 |
| R-135 | 建立第二 durable AI queue | High | 交互式 bounded request；不写 `ai_jobs`；无 auto retry | 持续阻断 |
| R-136 | Rule Proposal 与 Organization Plan ledger 混用 | High | 独立 artifact；Rule 只更新 metadata/suggestion | 持续阻断 |
| R-137 | Rule AST TS/Rust 语义漂移 | High | Rust canonical validator authority + DTO parity tests | 已关闭，持续回归 |
| R-138 | 1M impact count 阻塞 UI/主库 | High | deferred exact impact、token、WAL/query-plan gates | 已关闭，性能门禁 |
| R-139 | terminal proposal retention 删除正式 Rule | Critical | proposal prune 不删除 rule/provenance execution facts | 持续阻断 |
| R-140 | Search window 获得 proposal/rule write/run | Critical | main-only capabilities、negative tests | 持续阻断 |
| R-141 | Coworker/OpenCode 代码或 runtime 移植 | High | fixed SHA/MIT inventory；principle-only；no runtime tests | 许可证/架构门禁 |
| R-142 | 提前建设 Task 08 Content Artifact | Critical | metadata-only；content intent deny/clarify | 持续阻断 |

## 风险结论

Task 06 已通过 PR #40 squash 合并，merge commit 为 `29e85c099c5ee921ad7d4237c780dc47126e0fa3`。R-117–R-123 已接受进入 Task 07 第一组，不得再次后移。Task 07 的核心风险是把自然语言或模型输出误当正式规则/执行授权；最终合同固定为 durable proposal、Rule AST V1、backend validation、truthful impact preview、human Apply、default disabled、revision CAS 和 backend-authoritative execution。Task 08 继续禁止。
