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
| R-002 | 把 `ai_jobs` 泛化为通用 Job Runtime | High | AI 表和 worker 保持 typed domain owner | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | 每个 domain 固定 owner/claim/cancel/recovery | 持续阻断 |
| R-004 | Scan 崩溃后误判完成 | High | run/generation/scan_seen/recovery | 已处理，持续回归 |
| R-005 | Watcher overflow 丢失最终一致性 | High | Rust owner、revision gap、managed reconciliation | 已处理，持续回归 |
| R-006 | 多 watcher/provider 跨域写入 | High | File Library 与 Global Index 隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | 禁止迁移 `files.id`；保持旁路 identity | 持续阻断 |
| R-008 | operation identity 被 fingerprint 替代 | Critical | mutation 继续走 preview/claim/identity/journal | 持续阻断 |
| R-009 | Dedupe 用户语义错误 | High | physical identity、exact/potential、不得自动删除 | 持续回归 |
| R-010 | Dedupe/Finding 重启丢失 | High | durable dedupe 与 Analysis Run/Finding | 已处理 |
| R-011 | Global cursor 被当通用 generation/cursor | High | 各域 revision/cursor 独立 | 持续阻断 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | scope/provider/correction/consent gate | 持续阻断 |
| R-013 | AI 覆盖用户 correction/decision | Critical | correction/decision 最高优先 | 持续阻断 |
| R-014 | Content Artifact 泄露隐私 | Critical | Task 08 consent/预算/脱敏/retention/purge | 当前核心门禁 |
| R-015 | AI trace 被当内容库 | High | trace 仅诊断，raw response 不持久化 | 持续阻断 |
| R-016 | 过期 Organization Plan 仍执行 | Critical | live preview/identity/root health/fingerprint | 已加固，持续回归 |
| R-017 | 业务绕过 preview/journal/restore | Critical | 所有 filesystem mutation 经过既有安全链 | 持续阻断 |
| R-018 | OFFSET 在实时 File Library 跳页/重复 | High | revision snapshot + keyset cursor | 已关闭，持续回归 |
| R-019 | 跨页选择表达不真实 | High | explicit/all_matching authoritative selection | 已关闭，持续回归 |
| R-020 | 大表 count/sort/FTS 成本失控 | Medium | deferred exact、query plan、cold/warm | 持续性能门禁 |
| R-021 | Native helper/service 协议漂移 | High | versioned protocol、native smoke | 持续监控 |
| R-022 | partial/degraded/stale 被当 complete/current | High | health/completeness 同 snapshot | 持续回归 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | fixture、rollback、reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 短事务、WAL reader benchmark | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 当前代码/测试为事实，Closeout 同步 | 持续监控 |
| R-026 | 阶段循环依赖 | High | 完整模块 prerequisite/non-goal | 已重排 |
| R-027 | 性能被 warm/optimize 掩盖 | Medium | cold/warm/query plan/阶段 IO | 持续监控 |
| R-028 | Audit warning 被误当修复 | Medium | 记录 owner/inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/library/content/AI/plan/rule scope 分离 | 持续阻断 |
| R-030 | 分支混入无关文件 | High | allowed paths、Draft PR scope review | 持续门禁 |

## 已处理模块风险摘要

| 范围 | ID | 最终合同 | 状态 |
|---|---|---|---|
| Scan/Watcher | R-031–R-038 | root lease、generation/revision CAS、metadata-error safety、durable reconciliation | 已处理，持续测试 |
| Identity/Dedupe | R-039–R-050 | operation identity 隔离、hardlink-safe physical identity、full hash、durable runs | 已处理，持续测试 |
| Analysis/Finding | R-051–R-060 | staged publication、finding identity、decision、retention、hydrate | 已处理，持续测试 |
| Global Search | R-061–R-073 | single authority、source health、ID-only actions、window lifecycle、IME/ARIA | 已处理，持续测试 |
| File Library | R-074–R-092 | Query V2、cursor authority、selection、tags、Saved Views、scope、permissions | 已处理，持续测试 |
| Task 05 handoff | R-093–R-101 | query loop、cursor tamper、100k TEMP set、snapshot UI、CRUD/CAS/DTO/ARIA/deferred count | 已由 Task 06 实现 |
| Organization Plan | R-102–R-123 | durable review、live dry-run、scope health、recovery、retention、summary、package evidence | 已由 Task 06/07 实现，持续回归 |
| Rule Proposal | R-124–R-142 | proposal、AST validation、impact、Apply、repository CAS、backend execution | 已由 Task 07 实现，六项接受遗留见下表 |

## Task 07 → Task 08 接受遗留

| ID | 风险 | 等级 | Task 08 强制解决方案 | 状态 |
|---|---|---|---|---|
| R-143 | 同一 catalog revision 对应不同 effective ruleset | Critical | learned rule 与影响 ruleset 的 settings/policy 统一进入 catalog/classification authority | 已关闭，持续回归 |
| R-144 | manual rule execution 在 catalog/rules/scope 间 TOCTOU | Critical | 单一 backend execution snapshot，绑定 catalog/settings/rules/scope/root/library | 已关闭，持续回归 |
| R-145 | impact predicate match 被误当真实 engine 结果 | Critical | 复用 classification simulation；preview/execution differential tests | 已关闭，持续回归 |
| R-146 | Proposal UI 缺 before/after/risk/scope/conflict completeness | High | 完整审核事实和 accessibility tests | 已关闭，持续回归 |
| R-147 | manual edit 后 AI summary/provenance 冒充当前 candidate | High | candidate origin、summary invalidation、preview invalidation | 已关闭，持续回归 |
| R-148 | dangerous prompt 依赖模型主动映射才 deny | Critical | backend-owned multilingual forbidden-intent gate | 已关闭，持续回归 |

六项不得再次后移。关闭后继续完整 Task 08 Content Artifact 模块。

## Task 08 Local Content Artifacts and Understanding 风险

| ID | 风险 | 等级 | 阻断/验收条件 | 状态 |
|---|---|---|---|---|
| R-149 | 未经同意读取正文 | Critical | policy 默认 disabled；preview + confirmed；negative read instrumentation | 已关闭，持续回归 |
| R-150 | renderer arbitrary path/file list 成为内容读取 authority | Critical | durable managed scope/selection IDs only；backend materialization | 已关闭，持续回归 |
| R-151 | unhealthy/disabled/reconciliation root 仍读取内容 | Critical | root/policy/library revisions + health revalidation | 已关闭，持续回归 |
| R-152 | Content Artifact 未绑定 source identity 而冒充 current | Critical | file/root/size/mtime/hash/extractor/policy/provider fingerprint | 已关闭，持续回归 |
| R-153 | 旧 artifact 在 source 变化后继续展示为 current | Critical | watcher/scanner invalidation、stale state、atomic rebuild | 已关闭，持续回归 |
| R-154 | raw extracted text 默认持久化 | Critical | default `none`；显式 policy、容量/时间上限、purge tests | 已关闭，持续回归 |
| R-155 | FTS 删除后仍保留正文 tokens | Critical | artifact/text/FTS child-first atomic delete/purge | 已关闭，持续回归 |
| R-156 | cloud provider 静默收到正文 | Critical | 每次 run 单独确认、exact chars disclosure、payload inspection | 已关闭，持续回归 |
| R-157 | cloud payload 泄露 path/filename/tags/secrets | Critical | fixed DTO 只含 bounded text；redaction/negative tests | 已关闭，持续回归 |
| R-158 | Sensitive/System/blocked 文件发送 cloud | Critical | backend risk gate，fail closed | 已关闭，持续回归 |
| R-159 | raw provider response/trace 被当 artifact | High | strict envelope；raw response 不持久化；trace bounded | 已关闭，持续回归 |
| R-160 | 新建第二 durable AI queue | High | provider understanding 使用现有交互 client + bounded owner | 持续阻断 |
| R-161 | Content run 被泛化为通用 Job Runtime | High | typed extract/understand/rebuild/purge domain only | 持续阻断 |
| R-162 | extractor zip/PDF bomb 导致 OOM/DoS | Critical | entry/ratio/decompressed/object/page/output/chars/time/cancel budgets；CMap/temporary buffers；hostile PDF/ZIP 与真实 text-layer fixture | 已修复，CI 通过，待第五轮验收 |
| R-163 | extractor 跟随 symlink 或读取 scope 外文件 | Critical | regular managed file identity revalidation；no traversal | 已关闭，持续回归 |
| R-164 | malformed/encoding 文件 panic 或 silent truncation | High | stable status/error/truncated semantics，real fixtures | 已关闭，持续回归 |
| R-165 | legacy Office/OCR/external runtime 偷渡 | High | fixed registry；unsupported；dependency/path review | 持续阻断 |
| R-166 | 隐式下载模型或外部 executable | Critical | no Python/Conda/Tesseract/Nexa/sidecar；package tests | 持续阻断 |
| R-167 | Content Search 扩散到 Global Search | High | managed content FTS only；separate revision/cursor | 持续阻断 |
| R-168 | Content Search 使用 OFFSET 或 loaded-page totals | High | keyset + backend summary + revision snapshot | 已关闭，持续回归 |
| R-169 | Content Artifact 成为 Rule/Plan/mutation authority | Critical | no Rule AST content field；no operation command path | 持续阻断 |
| R-170 | 删除 artifact 误删源文件 | Critical | delete/purge SQL-only content facts；source identity assertions | 已关闭，持续回归 |
| R-171 | run materialization 超上限部分提交 | High | 10k preflight + staged atomic publication | 已关闭，持续回归 |
| R-172 | crash/restart 重复 provider 或 extractor work | High | run/item owner/revision/recovery；atomic artifact+FTS+item publication；completed no replay；fault injection；active-owner contention | 已修复，CI 通过，待第五轮验收 |
| R-173 | active run 被 retention 删除 | High | active states excluded；child-first bounded prune | 已关闭，持续回归 |
| R-174 | retention 错用 age AND count | Medium | age UNION count overflow、dedup、每批 20 | 已关闭，持续回归 |
| R-175 | main DB 被 extraction/FTS 长事务阻塞 | High | short publication transactions、WAL reader benchmark | 已关闭，持续回归 |
| R-176 | 依赖许可证/漏洞/package size 失控 | High | fixed versions、license inventory、RustSec、size delta | 已关闭，持续回归 |
| R-177 | browser mock 冒充真实读取/provider/持久化 | High | explicit mock labels、negative capability tests | 已关闭，持续回归 |
| R-178 | Search window 获得内容命令 | Critical | main-window-only capability matrix | 已关闭，持续回归 |
| R-179 | Local-File-Organizer 源码/CLI/prompt 移植 | High | fixed SHA/MIT inventory；principle-only independent implementation | 许可证门禁 |
| R-180 | 自行建设 Task 09/OCR/RAG/Agent | Critical | Task 08 non-goals、PR scope tests、人工授权 | 持续阻断 |

## 风险结论

Task 07 已通过 PR #42 squash 合并，merge commit 为 `4e07de9c02198eb3352d9b2b1f289d61a3df128c`。R-143–R-148 经人工接受进入 Task 08 第一组，不得再次后移。第四轮 review 指出的 R-162/R-172 已补齐 PDF parser 真实 mid-flight timeout-through-run publication 证据、object/decompressed/page/output/time/cancel/CMap/temporary-buffer 限制、Provider pre-claim settings validation、owner-aware abort、provider 原子 publication、active-owner contention、owner/revision CAS、恢复/cancel/no-replay 和故障注入证据；code head `80bfabd7ce1d11d7dfbadb4ef8df9d875935e437` 的 code-head CI `30690147656` 已通过，状态保持“已修复，CI 通过，待第五轮验收”，不提前宣称永久关闭。Task 08 的核心风险不只是 parser 正确性，而是未经同意读取正文、把 retained text/FTS/trace 变成隐私泄露面、把 cloud provider 或 Content Artifact 误当执行权威。最终合同固定为 consent-bound preview、managed scope、typed bounded extractor、identity-bound artifact、default no raw text、per-run cloud confirmation、purge/rebuild/retention、managed-only Content Search，以及对 filesystem mutation 的完全隔离。
