# Remediation Risk Register

这是 PR #15 合并后、Task 00 审计形成的风险基线。风险记录后续整改可能放大的 failure mode，不代表当前阶段可以修改对应生产行为。

等级：

- **Critical**：可能越过文件、AI、隐私或恢复安全边界，或造成不可逆数据后果。
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不兼容迁移。
- **Medium**：会造成一致性、性能、可观测性或维护风险，但有局部缓解。
- **Low**：影响较小，仍需在对应阶段留下证据。

| ID | 风险 | 等级 | 触发条件/影响 | 当前证据 | 阻断/缓解与验收条件 | 状态 |
|---|---|---|---|---|---|---|
| R-001 | 重建第二套 Global Index | Critical | 新模块重新扫描全盘并建立第二套 volume/entry/FTS，导致 search、AI、scope 和 stale 事实分裂 | `global_index/coordinator.rs`、`repository.rs`、global schema | 所有 global discovery/search 复用 `global_*`；架构 guard | 持续阻断越界 |
| R-002 | 把 Managed AI `ai_jobs` 误作通用 Job Runtime | High | scan/cleanup/dedupe 污染 provider、scope、fingerprint、correction | Managed AI worker/schema | 保持 AI 表和 worker 领域专用 | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | renderer、Tauri、native service 和 provider 重复消费，造成重复执行或丢失 | watcher、AI worker、global coordinator | 每个 domain 定义唯一 owner、claim、cancel、retry 和 recovery | 未定义前阻断 |
| R-004 | Scan 崩溃后误判完成 | High | 内存 job 消失但 `files` 已部分写入，旧逻辑可能执行 stale | `scanner.rs::ScanJobManager` | Task 01A 建立 run/generation/scan_seen/recovery | Task 01A 处理 |
| R-005 | Watcher overflow 后最终一致性丢失 | High | bounded channel/renderer queue 丢事件且无 durable owner | `watcher.rs`、`fsWatcherQueue.ts` | Task 01B 定义 authoritative reconcile 和 replay | 等待 01B |
| R-006 | 多 watcher/provider 重复消费 | High | File Library watcher、USN、FSEvents、Spotlight 写入边界混淆 | watcher 与 global provider | 保持 files/global 数据域隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | rename/cross-volume/case 后误合并实体或丢历史 | scanner path-id、global stable id、path identity | 先做 mapping/collision/backfill/rollback；禁止直接改 `files.id` | 阻断 identity 迁移 |
| R-008 | operation identity 被弱化为普通 fingerprint | Critical | symlink/reparse、claim/restore 语义丢失，错误移动或恢复 | `fs_safety/identity.rs`、`file_ops.rs` | mutation 继续走 claim、preview、identity、journal | 持续阻断 |
| R-009 | Dedupe 产生错误用户语义 | High | hardlink、物理同一文件、同内容文件和外部变化被混为 reclaim | `dedupe.rs`、`files.content_hash` | Task 02 定义 physical identity、group 和 reclaim；不得自动删除 | 等待 02 |
| R-010 | Dedupe/cleanup finding 重启丢失 | High | 内存结果无法重放或审计 | `DedupeJobManager`、`StorageCleanupState` | Task 03 建立 analysis run/finding；Safe Trash journal 保持独立 | 等待 03 |
| R-011 | Global cursor 被误作通用 generation | High | USN/FSEvents/Spotlight cursor 语义不同，回放跳过或重复 | global coordinator/provider | File Library generation 独立 | 已冻结 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | unmanaged/global row 进入 AI 或 cloud 读取未授权内容 | managed scope、AI worker pre/post validation | 保持 scope、managed entry、provider policy、correction 四重 gate | 持续阻断 |
| R-013 | AI 覆盖用户纠正 | Critical | reanalysis/retry 覆盖 correction | Managed AI `user_corrected` | correction 永远优先；所有新 consumer 加 negative tests | 持续阻断 |
| R-014 | Content Artifact 泄露隐私/密钥 | Critical | 默认读取/上传内容或长期保存正文/trace | metadata-only request、AI trace | Task 08 先定义预算、脱敏、加密、retention 和 consent | 阻断 08 |
| R-015 | 把 AI trace 当内容库 | High | trace 截断/重启丢失/脱敏造成错误复用 | `ai/trace.rs` | trace 仅诊断；artifact 独立 schema | 持续阻断 |
| R-016 | Organization Plan 过期仍执行 | Critical | renderer 持旧 preview，文件或 AI 结果已改变 | operation preview/identity | Plan 绑定 revision/snapshot/identity，执行仍走 authoritative preview | 阻断 05 |
| R-017 | 业务层绕过 preview/journal/restore | Critical | AI、cleanup、NL rule 或 selection 直接调用 filesystem | `file_ops.rs`、storage analyzer | 所有 mutation 经过 preview、identity、journal、Safe Trash | 持续阻断 |
| R-018 | OFFSET 在 realtime 数据中跳页/重复 | High | scan/watcher 改变排序，用户或 plan 选择错行 | files queries 的 LIMIT/OFFSET | Task 04 定义 snapshot/cursor 和 fallback | 等待 04 |
| R-019 | 跨页选择表达不真实 | High | UI 只选 loaded rows 却描述为全结果 | File Library selection | Query V2 建立 server-side selection | 等待 04 |
| R-020 | 大表 count/sort 成本失控 | Medium | CTE/count/OFFSET 在大表和 watcher 下变慢 | library queries/performance tests | 保留 cold/warm/plan evidence，再决定 index/cursor | 等待 04 |
| R-021 | Native helper/service 协议漂移 | High | Windows service、desktop fallback、installer/CI 不一致 | Windows service/protocol/CI | versioned protocol、source validation、native smoke | 持续监控 |
| R-022 | partial index 被当 complete | High | provider 权限或 fallback 只返回部分结果但 UI/AI 当全量 | provider status/coordinator | 状态带 completeness/source/error；AI 不消费未授权 partial | 持续监控 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | 新 schema 破坏 v18–26 恢复字段或 startup reconcile | schema migrations、operation queries | 每次 migration 必须有真实 fixture、rollback 和 reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 新表/长事务导致 global upsert、AI claim、library query、journal busy | 单 SQLite、Immediate transaction | 测事务时长和 WAL reader；禁止把大型分析塞入 mutation transaction | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 旧文档阶段、表名或边界与源码不一致 | remediation/design/security docs | 当前代码和测试为事实；每阶段更新 evidence/closeout | 持续监控 |
| R-026 | 阶段循环依赖 | High | Plan、finding、identity、runtime 相互等待，产生半成品 schema | remediation index | 每阶段声明 prerequisite/non-goal/migration/rollback | 已拆分 |
| R-027 | 性能基线被 optimize 掩盖 | Medium | pre-optimize 很慢、post-optimize 很快，误判持续性能 | performance script | 保留 cold/warm/optimize 分段指标 | 持续监控 |
| R-028 | 安全 audit warning 被误当修复 | Medium | audit exit 0 但 allowed warnings 未解决 | Rust audit inventory | release gate 记录 owner 和 warning inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/search/cleanup/Managed Scope 混为一套，越权扫描或 AI | scope/root validation | 每种 root/scope 显式，跨域需授权映射和 negative tests | 持续阻断 |
| R-030 | 分支混入无关文件 | High | broad stage/commit 混入生产代码、权限或 build output |阶段 allowed path | path guard、cached diff、Draft PR scope review | 持续门禁 |

## Task 01A 专项风险

| ID | 风险 | 等级 | 触发条件/影响 | 最终契约 | 状态 |
|---|---|---|---|---|---|
| R-031 | 同 root active run/旧 generation 竞争 | Critical | 两个 session 并发或旧 worker 晚回写，造成 generation 倒退或错误 stale | partial unique index + root active pointer + lease token + generation/revision CAS；affected-row 必须为 1 | 任务书已解决，实施验收 |
| R-032 | metadata error 导致错误 stale 或 scan_seen 无限增长 | Critical | 真实文件 metadata 失败却被当 missing；observation 永久增长 | metadata error coverage-breaking、禁止 stale；7/30 日 + newest-two + active/recovery pin 的 bounded prune | 任务书已解决，实施验收 |
| R-033 | multi-root mapping 或 dedupe 调度语义不真实 | High | nested/duplicate/invalid/unstarted 无法解释；把内存 dedupe 误称 exactly-once | `scan_session_roots` 持久 requested→effective；session terminal priority 固定。Dedupe 仅记录 durable intent，采用 at-least-once 安全重算，不承诺跨重启 exactly-once | 任务书已解决；durable dedupe 延后 Task 02 |
| R-034 | schema 27 rollback 与旧 binary guard 冲突 | High | schema 27 无法被 schema-26 binary 打开，错误回退会绕过 guard | commit 前 transaction rollback；commit 后只用 schema-27-capable build 关 gate；旧 binary 保持 future-schema rejection | 任务书已解决，migration 验收 |
| R-035 | renderer 重启后旧 scan event 覆盖新状态 | High | 内存 sequence 丢失或晚到事件回退 generation/status | run/session durable revision；先 hydrate，按 revision/generation/identity 过滤和 gap refetch | 任务书已解决，前端验收 |
| R-036 | Session phase 随 root phase 倒退 | High | 多 root 顺序扫描中，前一个 finalizing 后下一个 preparing，renderer 将 session 看作倒退 | session 使用独立聚合 phase `preparing/running/finalizing/completed`；root phase 单独展示 | 任务书已解决，前端验收 |
| R-037 | 把内存 DedupeJobManager 误作持久幂等下游 | High | crash 后无法按 dispatch key 查询旧 job，错误承诺 logical at-most-once | Task 01A 不改 dedupe；允许 at-least-once 重算，重复计算不得影响 scan/stale/用户文件；durable dedupe 归 Task 02 | 任务书已解决，实施需验证幂等安全 |

## 风险结论

Task 01A 任务书已经完成架构验收，但生产实施仍必须通过 migration、并发、crash、stale、性能和跨平台 CI。任何 Critical/High 风险在对应实现没有 owner、测试、迁移和 rollback 证据前，继续阻断合并和后续阶段。