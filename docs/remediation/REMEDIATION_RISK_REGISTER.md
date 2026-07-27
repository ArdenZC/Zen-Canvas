# Remediation Risk Register

这是 PR #15 合并后、Task 00 审计形成并随整改阶段持续更新的风险基线。风险记录可能被后续改动放大的 failure mode；只有人工批准的任务书能够授权对应生产修改。

等级：

- **Critical**：可能越过文件、AI、隐私或恢复安全边界，或造成不可逆数据后果。
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不兼容迁移。
- **Medium**：会造成一致性、性能、可观测性或维护风险，但有局部缓解。
- **Low**：影响较小，仍需在对应阶段留下证据。

| ID | 风险 | 等级 | 触发条件/影响 | 当前证据 | 阻断/缓解与验收条件 | 状态 |
|---|---|---|---|---|---|---|
| R-001 | 重建第二套 Global Index | Critical | 新模块重新扫描全盘并建立第二套 volume/entry/FTS，导致 search、AI、scope 和 stale 事实分裂 | `global_index/coordinator.rs`、repository/global schema | 所有 global discovery/search 复用 `global_*`；架构 guard | 持续阻断越界 |
| R-002 | 把 Managed AI `ai_jobs` 误作通用 Job Runtime | High | scan/cleanup/dedupe 污染 provider、scope、fingerprint、correction | Managed AI worker/schema | 保持 AI 表和 worker 领域专用 | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | renderer、Tauri、native service 和 provider 重复消费，造成重复执行或丢失 | watcher、AI worker、global coordinator | 每个 domain 定义唯一 owner、claim、cancel、retry 和 recovery | 持续阻断 |
| R-004 | Scan 崩溃后误判完成 | High | 内存 job 消失但 `files` 已部分写入，旧逻辑可能执行 stale | scan ledger | Task 01A run/generation/scan_seen/recovery | 已由 01A 处理，持续回归 |
| R-005 | Watcher overflow 后最终一致性丢失 | High | bounded channel/renderer queue 丢事件且无 durable owner | watcher/reconciliation | Task 01B Rust owner、revision gap、managed scan reconcile | 已由 01B 处理，持续回归 |
| R-006 | 多 watcher/provider 重复消费 | High | File Library watcher、USN、FSEvents、Spotlight 写入边界混淆 | watcher 与 global provider | 保持 files/global 数据域隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | rename/cross-volume/case 后误合并实体或丢历史 | scanner path-id、global stable id、path identity | Task 02 只做旁路 mapping；禁止迁移 `files.id` | 阻断主键迁移 |
| R-008 | operation identity 被弱化为普通 fingerprint | Critical | symlink/reparse、claim/restore 语义丢失，错误移动或恢复 | `fs_safety/identity.rs`、`file_ops.rs` | mutation 继续走 claim、preview、identity、journal；dedupe lightweight identity 独立 | 持续阻断 |
| R-009 | Dedupe 产生错误用户语义 | High | hardlink、物理同一文件、同内容文件和外部变化被混为 reclaim | `dedupe.rs`、`files.content_hash` | Task 02 physical identity、group、exact/potential reclaim；不得自动删除 | Task 02 必须关闭 |
| R-010 | Dedupe/cleanup finding 重启丢失 | High | 内存结果无法重放或审计 | `DedupeJobManager`、`StorageCleanupState` | Task 02 durable dedupe run/group；Task 03 durable analysis finding | 分阶段处理 |
| R-011 | Global cursor 被误作通用 generation | High | USN/FSEvents/Spotlight cursor 语义不同，回放跳过或重复 | global coordinator/provider | File Library generation 独立 | 已冻结 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | unmanaged/global row 进入 AI 或 cloud 读取未授权内容 | managed scope、AI worker pre/post validation | 保持 scope、managed entry、provider policy、correction 四重 gate | 持续阻断 |
| R-013 | AI 覆盖用户纠正 | Critical | reanalysis/retry 覆盖 correction | Managed AI `user_corrected` | correction 永远优先；所有新 consumer 加 negative tests | 持续阻断 |
| R-014 | Content Artifact 泄露隐私/密钥 | Critical | 默认读取/上传内容或长期保存正文/trace | metadata-only request、AI trace | Task 08 先定义预算、脱敏、加密、retention 和 consent | 阻断 08 |
| R-015 | 把 AI trace 当内容库 | High | trace 截断/重启丢失/脱敏造成错误复用 | `ai/trace.rs` | trace 仅诊断；artifact 独立 schema | 持续阻断 |
| R-016 | Organization Plan 过期仍执行 | Critical | renderer 持旧 preview，文件或 AI 结果已改变 | operation preview/identity | Plan 绑定 revision/snapshot/identity，执行仍走 authoritative preview | 阻断 05 |
| R-017 | 业务层绕过 preview/journal/restore | Critical | AI、cleanup、NL rule 或 selection 直接调用 filesystem | file_ops/storage analyzer | 所有 mutation 经过 preview、identity、journal、Safe Trash | 持续阻断 |
| R-018 | OFFSET 在 realtime 数据中跳页/重复 | High | scan/watcher 改变排序，用户或 plan 选择错行 | files queries | Task 04 snapshot/cursor/fallback | 等待 04 |
| R-019 | 跨页选择表达不真实 | High | UI 只选 loaded rows 却描述为全结果 | File Library selection | Query V2 server-side selection | 等待 04 |
| R-020 | 大表 count/sort 成本失控 | Medium | CTE/count/OFFSET 在大表和 watcher 下变慢 | library queries/performance tests | 保留 cold/warm/plan evidence；Task 02 移除 duplicate CTE | 持续监控 |
| R-021 | Native helper/service 协议漂移 | High | Windows service、desktop fallback、installer/CI 不一致 | Windows service/protocol/CI | versioned protocol、source validation、native smoke | 持续监控 |
| R-022 | partial index 被当 complete | High | provider 权限或 fallback 只返回部分结果但 UI/AI 当全量 | provider status/coordinator | 状态带 completeness/source/error；AI 不消费未授权 partial | 持续监控 |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | 新 schema 破坏恢复字段或 startup reconcile | schema migrations、operation queries | 每次 migration 真实 fixture、rollback、reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 新表/长事务导致 global upsert、AI claim、library query、journal busy | 单 SQLite、Immediate transaction | 短 publication transaction、worker不持锁、WAL reader benchmark | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 旧文档阶段、表名或边界与源码不一致 | remediation/design/security docs | 当前代码和测试为事实；每阶段更新 evidence/closeout | 持续监控 |
| R-026 | 阶段循环依赖 | High | Plan、finding、identity、runtime 相互等待，产生半成品 schema | remediation index | 每阶段 prerequisite/non-goal/migration/rollback | 已拆分 |
| R-027 | 性能基线被 optimize 掩盖 | Medium | pre-optimize 很慢、post-optimize 很快，误判持续性能 | performance script | 保留 cold/warm/阶段 IO 指标 | 持续监控 |
| R-028 | 安全 audit warning 被误当修复 | Medium | audit exit 0 但 allowed warnings 未解决 | Rust audit inventory | release gate 记录 owner 和 warning inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/search/cleanup/Managed Scope 混为一套，越权扫描或 AI | scope/root validation | 每种 root/scope 显式；跨域需授权映射和 negative tests | 持续阻断 |
| R-030 | 分支混入无关文件 | High | broad stage/commit 混入生产代码、权限或 build output |阶段 allowed path | path guard、cached diff、Draft PR scope review | 持续门禁 |

## Task 01A 专项风险

| ID | 风险 | 等级 | 最终契约 | 状态 |
|---|---|---|---|---|
| R-031 | 同 root active run/旧 generation 竞争 | Critical | partial unique index + root pointer + lease + generation/revision CAS | 已处理，持续测试 |
| R-032 | metadata error 导致错误 stale 或 scan_seen 无界 | Critical | coverage-breaking、禁止 stale；7/30 日 + newest-two bounded prune | 已处理，持续测试 |
| R-033 | multi-root mapping 或 dedupe 调度语义不真实 | High | durable requested→effective；dedupe at-least-once，不承诺 exactly-once | scan部分已处理；durable dedupe归02 |
| R-034 | schema rollback 与旧 binary guard 冲突 | High | commit前 transaction rollback；commit后仅新-schema-capable build gate-off | 已处理，所有后续 migration沿用 |
| R-035 | renderer 重启后旧 scan event 覆盖新状态 | High | durable revision；先hydrate，按 revision/generation过滤 | 已处理 |
| R-036 | Session phase 随 root phase 倒退 | High | session独立聚合 phase | 已处理 |
| R-037 | 把内存 DedupeJobManager 误作持久幂等下游 | High | 01A只保存dispatch intent；Task02建立领域run | Task 02 必须关闭 |

## Task 01B / Task 02 专项风险

| ID | 风险 | 等级 | 触发条件/影响 | Task 02 最终契约 | 状态 |
|---|---|---|---|---|---|
| R-038 | 最近 watcher error 擦除待恢复规则失败 | High | A规则失败后B正常事件清空error，full scan错误healthy | 独立 `watcher_rule_recovery_required`，仅成功root恢复清零 | 已实施，PR #26 Draft，待人工验收 |
| R-039 | 轻量 identity 误替代 operation identity | Critical | 为复用native ID修改mutation claim/hash语义 | 新 helper只读metadata/native ID；operation identity不变 | 已实施，PR #26 Draft，待人工验收 |
| R-040 | Hardlink 被计为可释放副本 | Critical | 多路径同inode/file-index导致空间夸大和错误清理 | physical key去重；hardlink-only不建内容重复组 | 已实施，PR #26 Draft，待人工验收 |
| R-041 | Fingerprint stale cache 误确认重复 | Critical | same-second修改、rename、算法升级或CAS漏失效 | live modified_ns + physical identity + version + before/after + DB CAS | 已实施，PR #26 Draft，待人工验收 |
| R-042 | Prehash 被误当最终证据 | Critical | sample相同但内容不同建立重复组 | prehash只淘汰；full BLAKE3唯一确认 | 已实施，PR #26 Draft，待人工验收 |
| R-043 | Dedupe crash 后丢失历史或重复并行IO | High | 内存job消失、scan dispatch重放多worker | durable `dedupe_runs`、one-active-scope、interrupted恢复、cache复用 | 已实施，PR #26 Draft，待人工验收 |
| R-044 | Group publication 空窗或半成品 | High | 先删旧组再长事务重建，UI瞬间错误 | deterministic group + 短事务原子publication + snapshot guard | 已实施，PR #26 Draft，待人工验收 |
| R-045 | Scope变化时发布不完整组 | High | run期间scan/watcher变化，新文件缺失或旧文件已变 | scope snapshot hash；变化则warnings/rerun，不替换权威全集 | 已实施，PR #26 Draft，待人工验收 |
| R-046 | Dedupe worker压垮磁盘/内存/SQLite | High | 无界队列、多线程写库、长事务 | 1..8有界worker、single DB writer、bounded channel、字节基准 | 本地缩小性能门禁及 CI Windows/macOS 通过；待人工验收 |
| R-047 | Duplicate UI 越权执行删除 | Critical | 从“识别”直接进入自动清理且无journal | Task02 UI只读；Task03 Finding，后续mutation仍走Safe Trash/journal | 已实施且持续阻断 mutation，待人工验收 |
| R-048 | 旧 `content_hash` 与新 group 双重事实 | High | filter/classification仍查旧CTE，结果漂移 | group membership唯一authority；content_hash仅compat mirror | 已实施，PR #26 Draft，待人工验收 |

## 风险结论

Task 02 已完成 identity、hash IO、持久运行和用户空间语义实现；PR #26 保持 Draft，Windows/macOS CI 已通过。任何关于主键迁移、hardlink、cache validity、group原子性、文件 mutation或跨域scope的 Critical/High 风险，在人工验收完成前继续阻断合并；Task 03 仍禁止执行。
