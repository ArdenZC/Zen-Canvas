# Remediation Risk Register

这是 PR #15 合并后、Task 00 审计形成并随整改阶段持续更新的风险基线。风险记录可能被后续改动放大的 failure mode；只有人工批准的任务书能够授权对应生产修改。

等级：

- **Critical**：可能越过文件、AI、隐私或恢复安全边界，或造成不可逆数据后果。
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不兼容迁移。
- **Medium**：会造成一致性、性能、可观测性或维护风险，但有局部缓解。
- **Low**：影响较小，仍需在对应阶段留下证据。

| ID | 风险 | 等级 | 触发条件/影响 | 当前证据 | 阻断/缓解与验收条件 | 状态 |
|---|---|---|---|---|---|---|
| R-001 | 重建第二套 Global Index | Critical | 新模块重新扫描全盘并建立第二套 volume/entry/FTS，导致 search、AI、scope 和 stale 事实分裂 | `global_index/` | 所有 global discovery/search 复用 `global_*`；架构 guard | 持续阻断越界 |
| R-002 | 把 Managed AI `ai_jobs` 误作通用 Job Runtime | High | scan/cleanup/dedupe 污染 provider、scope、fingerprint、correction | Managed AI worker/schema | 保持 AI 表和 worker 领域专用 | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | renderer、Tauri、native service 和 provider 重复消费，造成重复执行或丢失 | watcher、AI、scan、dedupe | 每个 domain 定义唯一 owner、claim、cancel、retry 和 recovery | 持续阻断 |
| R-004 | Scan 崩溃后误判完成 | High | 内存 job 消失但 `files` 已部分写入，旧逻辑可能执行 stale | scan ledger | run/generation/scan_seen/recovery | 已由 01A 处理，持续回归 |
| R-005 | Watcher overflow 后最终一致性丢失 | High | bounded channel 丢事件且无 durable owner | watcher/reconciliation | Rust owner、revision gap、managed scan reconcile | 已由 01B 处理，持续回归 |
| R-006 | 多 watcher/provider 重复消费 | High | File Library watcher、USN、FSEvents、Spotlight 写入边界混淆 | watcher 与 global provider | 保持 files/global 数据域隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | rename/cross-volume/case 后误合并实体或丢历史 | scanner path-id、global stable id | 旁路 mapping；禁止迁移 `files.id` | 阻断主键迁移 |
| R-008 | operation identity 被弱化为普通 fingerprint | Critical | symlink/reparse、claim/restore 语义丢失，错误移动或恢复 | `fs_safety`、`file_ops` | mutation 继续走 claim、preview、identity、journal；dedupe identity 独立 | 持续阻断 |
| R-009 | Dedupe 产生错误用户语义 | High | hardlink、物理同一文件、同内容文件和外部变化被混为 reclaim | dedupe/group schema | physical identity、exact/potential；不得自动删除 | 持续回归 |
| R-010 | Dedupe/cleanup finding 重启丢失 | High | 内存结果无法重放或审计 | durable dedupe 已有；`StorageCleanupState` 仍为内存 authority | Task 03 durable analysis run/finding | Task 03 必须关闭 |
| R-011 | Global cursor 被误作通用 generation | High | USN/FSEvents/Spotlight cursor 语义不同 | global coordinator/provider | File Library generation 独立 | 已冻结 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | unmanaged/global row 进入 AI 或 cloud 读取未授权内容 | managed scope、AI pre/post validation | 保持 scope、provider policy、correction gate | 持续阻断 |
| R-013 | AI 覆盖用户纠正 | Critical | reanalysis/retry 覆盖 correction 或 finding decision | Managed AI、future finding decisions | correction/decision 永远优先；negative tests | 持续阻断 |
| R-014 | Content Artifact 泄露隐私/密钥 | Critical | 默认读取/上传内容或长期保存正文 | metadata-only request、AI trace | Task 08 定义预算、脱敏、retention 和 consent | 阻断 08 |
| R-015 | 把 AI trace 当内容库 | High | trace 截断/脱敏造成错误复用 | `ai/trace.rs` | trace 仅诊断；artifact 独立 schema | 持续阻断 |
| R-016 | Organization Plan 过期仍执行 | Critical | renderer 持旧 preview，文件或 AI 结果已改变 | operation preview/identity | Plan 绑定 revision/snapshot/identity | 阻断 05 |
| R-017 | 业务层绕过 preview/journal/restore | Critical | AI、cleanup、finding 或 selection 直接调用 filesystem | file_ops/storage analyzer | 所有 mutation 经过 preview、identity、journal、Safe Trash | 持续阻断 |
| R-018 | OFFSET 在 realtime 数据中跳页/重复 | High | scan/watcher 改变排序，用户或 plan 选择错行 | files queries | Task 04 snapshot/cursor/fallback | 等待 04 |
| R-019 | 跨页选择表达不真实 | High | UI 只选 loaded rows 却描述为全结果 | File Library selection | Query V2 server-side selection | 等待 04 |
| R-020 | 大表 count/sort 成本失控 | Medium | CTE/count/OFFSET 在大表和 watcher 下变慢 | queries/performance tests | cold/warm/plan evidence | 持续监控 |
| R-021 | Native helper/service 协议漂移 | High | Windows service、desktop fallback、installer/CI 不一致 | native protocol/CI | versioned protocol、native smoke | 持续监控 |
| R-022 | partial index 被当 complete | High | provider 权限或 fallback 只返回部分结果但 UI/AI 当全量 | provider status | completeness/source/error | 持续监控 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | 新 schema 破坏恢复字段或 startup reconcile | migrations、journals | 每次真实 fixture、rollback、reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 新表/长事务导致 global、AI、library、journal busy | 单 SQLite | 短 publication transaction、WAL reader benchmark | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 旧文档阶段、表名或边界与源码不一致 | remediation/design/security docs | 当前代码和测试为事实；阶段 closeout | 持续监控 |
| R-026 | 阶段循环依赖 | High | Plan、finding、identity、runtime 相互等待 | remediation index | 每阶段 prerequisite/non-goal/migration | 已拆分 |
| R-027 | 性能基线被 optimize 掩盖 | Medium | pre/post optimize 指标误导 | performance script | 保留 cold/warm/阶段 IO | 持续监控 |
| R-028 | 安全 audit warning 被误当修复 | Medium | audit exit 0 但 allowed warnings 未解决 | Rust audit inventory | 记录 owner 和 inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/search/cleanup/Managed Scope 混为一套 | scope/root validation | 每种 root/scope 显式；negative tests | 持续阻断 |
| R-030 | 分支混入无关文件 | High | broad stage 混入生产代码、权限或 build output |阶段 allowed path | path guard、Draft PR scope review | 持续门禁 |

## Task 01A 专项风险

| ID | 风险 | 等级 | 最终契约 | 状态 |
|---|---|---|---|---|
| R-031 | 同 root active run/旧 generation 竞争 | Critical | partial unique index + root pointer + lease + generation/revision CAS | 已处理，持续测试 |
| R-032 | metadata error 导致错误 stale 或 scan_seen 无界 | Critical | coverage-breaking；bounded retention | 已处理，持续测试 |
| R-033 | multi-root mapping 或 dedupe 调度语义不真实 | High | durable requested→effective；dedupe at-least-once | scan 已处理；dedupe 已持久化 |
| R-034 | schema rollback 与旧 binary guard 冲突 | High | commit 前 transaction rollback；future schema rejection | 已处理，后续沿用 |
| R-035 | renderer 重启后旧 scan event 覆盖新状态 | High | durable revision + hydrate | 已处理 |
| R-036 | Session phase 随 root phase 倒退 | High | session 独立聚合 phase | 已处理 |
| R-037 | 把内存 DedupeJobManager 误作持久幂等下游 | High | durable dedupe run 为 truth | 已由 Task 02 处理 |

## Task 01B / Task 02 专项风险

| ID | 风险 | 等级 | 最终契约 | 状态 |
|---|---|---|---|---|
| R-038 | 最近 watcher error 擦除待恢复规则失败 | High | 独立 `watcher_rule_recovery_required` | 已由 Task 02 处理，持续回归 |
| R-039 | 轻量 identity 误替代 operation identity | Critical | 只读 physical helper；operation identity 不变 | 已由 Task 02 处理，持续阻断混用 |
| R-040 | Hardlink 被计为可释放副本 | Critical | physical key 去重；hardlink-only 不建内容组 | 已处理，持续回归 |
| R-041 | Fingerprint stale cache 误确认重复 | Critical | modified_ns + physical identity + version + CAS | 已处理，Task 03 补 prehash race |
| R-042 | Prehash 被误当最终证据 | Critical | prehash 只淘汰；full BLAKE3 确认 | 已处理，Task 03 补 identity 前后校验 |
| R-043 | Dedupe crash 后丢失历史或重复并行 IO | High | durable runs、one-active-scope、interrupted recovery | 已处理，持续回归 |
| R-044 | Group publication 空窗或半成品 | High | deterministic group + 短事务 publication | 已处理，Task 03 补全局 scope authority |
| R-045 | Scope变化时发布不完整组 | Critical | global authority + snapshot；diagnostic scope不得发布 | **Task 03 第一组强制修复** |
| R-046 | Dedupe worker 压垮磁盘/内存/SQLite | High | bounded workers/channel、真实 IO progress | Task 02 有基线；Task 03 补真实 byte progress |
| R-047 | Duplicate UI 越权执行删除 | Critical | duplicate UI/Finding 只读；无 keeper/delete | 持续阻断 |
| R-048 | 旧 `content_hash` 与 group 双重事实 | High | group membership authority；content_hash mirror | 已处理，Task 03 补 rename mirror |

## Task 03 专项风险

| ID | 风险 | 等级 | 触发条件/影响 | Task 03 合同 | 状态 |
|---|---|---|---|---|---|
| R-049 | 局部 dedupe run 破坏跨 root group | Critical | A/B 跨 root group 后只重扫 A，旧 group 被 stale | authoritative publication 固定覆盖全部 enabled managed roots；diagnostic scope不得发布 | 阻断 Task 03 合并 |
| R-050 | Prehash/取消/progress 产生错误 cache 或进度 | High | prehash 期间变化；cancel 丢已完成 hash；metadata 阶段显示 100% | before/after identity；drain valid results；真实 read byte budget；小文件读一次 | 阻断 Task 03 合并 |
| R-051 | Partial/cancelled analysis findings 被当 active | Critical | detector 只跑一半或 run 取消仍替换旧结果 | staged findings + source snapshot + atomic successful-detector publication | 阻断 Task 03 合并 |
| R-052 | Detector 失败擦除上次有效发现 | High | 新 run 单 detector 失败后旧 active findings 被 supersede | 只替换成功 detector/scope；失败保留旧 active set | 阻断 Task 03 合并 |
| R-053 | Finding decision 错误继承到新内容 | High | 同一路径文件已变化，旧 dismissed 仍隐藏 | identity-sensitive `finding_key`；changed identity 新 key | 阻断 Task 03 合并 |
| R-054 | Finding/AI 越权成为执行授权 | Critical | AI 升级 Safe、renderer 提交 path 或 finding 直接删除 | AI 只能提高风险；finding 不是授权；preview/identity/journal/Safe Trash gate | 持续阻断 |
| R-055 | exact/potential 与重叠 finding 双重计数 | High | duplicate、large file、large dir 对同一物理对象重复求和 | exact/potential 分离；unique subject aggregation；目录不天真求和 | 阻断 Task 03 合并 |
| R-056 | 任意 path/detector 注入 | Critical | renderer 传任意 managed path、脚本、SQL 或动态 detector | fixed Rust registry；managed root IDs；approved cleanup path validation | 持续阻断 |
| R-057 | 内存 cleanup candidate 跨重启失效但仍可执行 | Critical | job result丢失/ID重用/renderer持旧对象 | durable run/finding/revision；执行前 DB resolve + live identity revalidation | 阻断 Task 03 合并 |
| R-058 | Analysis schema/事务拖慢主库 | High | 10k finding长写事务或 traversal 持锁 | staging 短写、atomic short publication、WAL reader benchmarks | 阻断 Task 03 性能门禁 |

## 风险结论

Task 02 已合并为 schema 29 基线。其 6 个接受遗留已正式转入 Task 03 的第一组强制改动，不得在 Task 03 实施中再次后移。Task 03 必须同时证明全局 dedupe authority、schema 30、durable Analysis Run/Detector/Finding、partial publication safety、identity-sensitive decision、Safe/Review/Caution 语义和现有 Safe Trash/journal 边界。Task 04 在 Task 03 人工验收并合并前继续禁止执行。
