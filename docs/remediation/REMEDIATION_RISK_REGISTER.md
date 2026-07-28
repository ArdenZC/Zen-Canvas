# Remediation Risk Register

这是 PR #15 合并后、Task 00 审计形成并随整改阶段持续更新的风险基线。只有人工批准并位于 `master` 的完整模块任务书能够授权对应生产修改。

等级：

- **Critical**：可能越过文件、AI、隐私或恢复安全边界，或造成不可逆数据后果。
- **High**：可能造成跨域数据错误、任务丢失、错误执行或不兼容迁移。
- **Medium**：造成一致性、性能、可观测性或维护风险，但有局部缓解。
- **Low**：影响较小，仍需在对应阶段留下证据。

## 持续全局风险

| ID | 风险 | 等级 | 触发条件/影响 | 阻断/缓解与验收条件 | 状态 |
|---|---|---|---|---|---|
| R-001 | 重建第二套 Global Index | Critical | 新模块重新扫描全盘并建立第二套 volume/entry/FTS，导致 search、AI、scope 和 stale 事实分裂 | 所有 global discovery/search 复用 `global_*`；架构 guard | 持续阻断越界 |
| R-002 | 把 Managed AI `ai_jobs` 误作通用 Job Runtime | High | scan/cleanup/dedupe/search 污染 provider、scope、fingerprint、correction | 保持 AI 表和 worker 领域专用 | 禁止泛化 |
| R-003 | 无边界跨域 durable queue | Critical | renderer、Tauri、native service 和 provider 重复消费，造成重复执行或丢失 | 每个 domain 定义唯一 owner、claim、cancel、retry 和 recovery | 持续阻断 |
| R-004 | Scan 崩溃后误判完成 | High | 内存 job 消失但 `files` 已部分写入，旧逻辑执行 stale | run/generation/scan_seen/recovery | 已由 01A 处理，持续回归 |
| R-005 | Watcher overflow 后最终一致性丢失 | High | bounded channel 丢事件且无 durable owner | Rust owner、revision gap、managed scan reconcile | 已由 01B 处理，持续回归 |
| R-006 | 多 watcher/provider 重复消费 | High | File Library watcher、USN、FSEvents、Spotlight 写入边界混淆 | 保持 files/global 数据域隔离 | 持续监控 |
| R-007 | Path ID 与 native ID 混用 | Critical | rename/cross-volume/case 后误合并实体或丢历史 | 旁路 mapping；禁止迁移 `files.id` | 阻断主键迁移 |
| R-008 | operation identity 被弱化为普通 fingerprint | Critical | symlink/reparse、claim/restore 语义丢失，错误移动或恢复 | mutation 继续走 claim、preview、identity、journal；dedupe identity 独立 | 持续阻断 |
| R-009 | Dedupe 产生错误用户语义 | High | hardlink、物理同一文件、同内容文件和外部变化被混为 reclaim | physical identity、exact/potential；不得自动删除 | 持续回归 |
| R-010 | Dedupe/cleanup finding 重启丢失 | High | 内存结果无法重放或审计 | durable dedupe 与 Analysis Run/Finding | 已由 Task 02/03 处理，持续回归 |
| R-011 | Global cursor 被误作通用 generation | High | USN/FSEvents/Spotlight cursor 语义不同 | File Library generation 和 query session 独立 | 已冻结 |
| R-012 | Managed Scope/Cloud AI 越权 | Critical | unmanaged/global row 进入 AI 或 cloud 读取未授权内容 | 保持 scope、provider policy、correction gate | 持续阻断 |
| R-013 | AI 覆盖用户纠正或 finding decision | Critical | reanalysis/retry 覆盖 correction/decision | correction/decision 永远优先；negative tests | 持续阻断 |
| R-014 | Content Artifact 泄露隐私/密钥 | Critical | 默认读取/上传内容或长期保存正文 | Task 08 定义预算、脱敏、retention 和 consent | 阻断 Task 08 前越界 |
| R-015 | 把 AI trace 当内容库 | High | trace 截断/脱敏造成错误复用 | trace 仅诊断；artifact 独立 | 持续阻断 |
| R-016 | Organization Plan 过期仍执行 | Critical | renderer 持旧 preview，文件或 AI 结果已改变 | Task 06 Plan 绑定 revision/snapshot/identity | 阻断 Task 06 前越界 |
| R-017 | 业务层绕过 preview/journal/restore | Critical | AI、cleanup、finding、command 或 selection 直接调用 filesystem | 所有 mutation 经过 preview、identity、journal、Safe Trash | 持续阻断 |
| R-018 | OFFSET 在实时 File Library 数据中跳页/重复 | High | scan/watcher 改变排序，用户或 plan 选择错行 | Task 05 File Query V2 snapshot/cursor | 等待 Task 05 |
| R-019 | File Library 跨页选择表达不真实 | High | UI 只选 loaded rows 却描述为全结果 | Task 05 server-side selection contract | 等待 Task 05 |
| R-020 | 大表 count/sort 成本失控 | Medium | CTE/count/OFFSET 在大表和 watcher 下变慢 | cold/warm/query-plan evidence | 持续监控 |
| R-021 | Native helper/service 协议漂移 | High | Windows service、desktop fallback、installer/CI 不一致 | versioned protocol、native smoke | 持续监控 |
| R-022 | partial index 被当 complete | High | provider 权限/fallback 只返回部分结果但 UI/AI 当全量 | completeness/source/error 明确投影 | Task 04 强制整改 Search UI，持续监控 provider |
| R-023 | 迁移破坏 operation/cleanup 账本 | Critical | 新 schema 破坏恢复字段或 startup reconcile | 每次真实 fixture、rollback、reconcile tests | 持续阻断 |
| R-024 | 主库跨域锁竞争 | High | 新表/长事务导致 global、AI、library、journal busy | 短 publication transaction、WAL reader benchmark | 持续监控 |
| R-025 | 文档与实现漂移 | Medium | 旧文档阶段、表名或边界与源码不一致 | 当前代码和测试为事实；阶段 closeout | 持续监控 |
| R-026 | 阶段循环依赖 | High | Plan、finding、identity、runtime 相互等待 | 完整模块 prerequisite/non-goal/migration | 已按 8 模块重排 |
| R-027 | 性能基线被 optimize 掩盖 | Medium | pre/post optimize 指标误导 | 保留 cold/warm/阶段 IO | 持续监控 |
| R-028 | 安全 audit warning 被误当修复 | Medium | audit exit 0 但 allowed warnings 未解决 | 记录 owner 和 inventory | 持续监控 |
| R-029 | 过早扩大 scope | Critical | global/search/cleanup/Managed Scope 混为一套 | 每种 root/scope 显式；negative tests | 持续阻断 |
| R-030 | 分支混入无关文件 | High | broad stage 混入生产代码、权限或 build output | allowed path、Draft PR scope review | 持续门禁 |

## Task 01A 专项风险

| ID | 风险 | 等级 | 最终契约 | 状态 |
|---|---|---|---|---|
| R-031 | 同 root active run/旧 generation 竞争 | Critical | partial unique index + root pointer + lease + generation/revision CAS | 已处理，持续测试 |
| R-032 | metadata error 导致错误 stale 或 scan_seen 无界 | Critical | coverage-breaking；bounded retention | 已处理，持续测试 |
| R-033 | multi-root mapping 或 dedupe 调度语义不真实 | High | durable requested→effective；dedupe at-least-once | 已处理 |
| R-034 | schema rollback 与旧 binary guard 冲突 | High | commit 前 transaction rollback；future schema rejection | 已处理，后续沿用 |
| R-035 | renderer 重启后旧 scan event 覆盖新状态 | High | durable revision + hydrate | 已处理 |
| R-036 | Session phase 随 root phase 倒退 | High | session 独立聚合 phase | 已处理 |
| R-037 | 把内存 DedupeJobManager 误作持久幂等下游 | High | durable dedupe run 为 truth | 已由 Task 02 处理 |

## Task 01B / Task 02 专项风险

| ID | 风险 | 等级 | 最终契约 | 状态 |
|---|---|---|---|---|
| R-038 | 最近 watcher error 擦除待恢复规则失败 | High | 独立 `watcher_rule_recovery_required` | 已由 Task 02 处理，持续回归 |
| R-039 | 轻量 identity 误替代 operation identity | Critical | 只读 physical helper；operation identity 不变 | 已处理，持续阻断混用 |
| R-040 | Hardlink 被计为可释放副本 | Critical | physical key 去重；hardlink-only 不建内容组 | 已处理，持续回归 |
| R-041 | Fingerprint stale cache 误确认重复 | Critical | modified_ns + physical identity + version + CAS | 已处理 |
| R-042 | Prehash 被误当最终证据 | Critical | prehash 只淘汰；full BLAKE3 确认 | 已处理 |
| R-043 | Dedupe crash 后丢失历史或重复并行 IO | High | durable runs、one-active-scope、interrupted recovery | 已处理，持续回归 |
| R-044 | Group publication 空窗或半成品 | High | deterministic group + 短事务 publication | 已处理 |
| R-045 | Scope 变化时发布不完整组 | Critical | global authority + snapshot；diagnostic scope 不发布 | 已由 Task 03 处理 |
| R-046 | Dedupe worker 压垮磁盘/内存/SQLite | High | bounded workers/channel、真实 IO progress | 已处理，持续性能门禁 |
| R-047 | Duplicate UI 越权执行删除 | Critical | duplicate UI/Finding 只读；无 keeper/delete | 持续阻断 |
| R-048 | 旧 `content_hash` 与 group 双重事实 | High | group membership authority；content_hash mirror | 已处理，持续回归 |

## Task 03 专项风险

| ID | 风险 | 等级 | 触发条件/影响 | 合同/处置 | 状态 |
|---|---|---|---|---|---|
| R-049 | 局部 dedupe run 破坏跨 root group | Critical | A/B 跨 root group 后只重扫 A，旧 group 被 stale | authoritative publication 固定覆盖全部 enabled managed roots | 已合并，持续回归 |
| R-050 | Prehash/取消/progress 产生错误 cache 或进度 | High | prehash 期间变化；cancel 丢 hash；metadata 显示 100% | before/after identity；drain valid；真实 IO；小文件一次读 | 已合并，持续回归 |
| R-051 | Partial/cancelled findings 被当 active | Critical | detector 只跑一半或取消仍替换旧结果 | staged + source snapshot + atomic publication | 已合并，持续回归 |
| R-052 | Detector 失败擦除上次有效发现 | High | 新 run 单 detector 失败后旧 active 被 supersede | 只替换成功 detector/scope | 已合并，持续回归 |
| R-053 | Finding decision 错误继承到新内容 | High | 同路径文件变化，旧 dismissed 仍隐藏 | identity-sensitive key | 已合并，持续回归 |
| R-054 | Finding/AI 越权成为执行授权 | Critical | AI 升级 Safe、renderer path、finding 直接删除 | finding 不是授权；preview/identity/journal/Safe Trash | 持续阻断 |
| R-055 | exact/potential 与重叠 finding 双重计数 | High | duplicate 与 Safe finding 对同一物理对象重复求和 | exact/potential 分离；physical subject union | **主体已合并，最后 physical-union 缺口转入 Task 04 第一组** |
| R-056 | 任意 path/detector 注入 | Critical | renderer 传任意 path、脚本、SQL 或动态 detector | fixed Rust registry；scope/path validation | 持续阻断 |
| R-057 | 内存 cleanup candidate 跨重启仍可执行 | Critical | job 丢失/ID 重用/renderer 持旧对象 | durable finding/revision；DB resolve + live identity | 已合并，持续回归 |
| R-058 | Analysis schema/事务拖慢主库 | High | 10k finding 长写事务或 traversal 持锁 | staging 短写、短 publication、WAL benchmark | 已合并，持续性能门禁 |
| R-059 | Analysis retention 删除仍被引用事实 | High | prune 级联 active finding/decision | child-first bounded global row budget | 已合并，持续回归 |
| R-060 | renderer 只显示事件不从 ledger 恢复 | High | restart/revision gap 显示旧 finding/status | hydrate + revision reject + refetch | 已合并，持续回归 |

## Task 04 全局快捷搜索专项风险

| ID | 风险 | 等级 | 触发条件/影响 | Task 04 阻断/验收条件 | 状态 |
|---|---|---|---|---|---|
| R-061 | 同一 physical subject 的 exact reclaimable 被重复累计 | High | duplicate member 同时属于 Safe exact finding，run total 翻倍 | authoritative member physical union；hardlink/keeper/order/AI refresh tests | 已处理，持续回归 |
| R-062 | 迟到 query response 覆盖新输入或新窗口 session | High | rapid typing、相同 query 重发、hide/reopen 后旧 invoke 返回 | session + request ID；latest-request-wins；old session reject | 已处理，持续回归 |
| R-063 | Search window 或 hotkey 多 owner | High | reload/settings race 创建双窗口、双快捷键、旧 blur 隐藏新 session | Rust 唯一 lifecycle owner；transactional hotkey rollback；session revision | 已处理，待跨平台验收 |
| R-064 | partial/degraded index 被呈现为完整搜索 | High | status 只在 mount 读取或 query 不携带 health | response/status 同 revision；明确 coverage/source UI | 已处理，持续回归 |
| R-065 | stale/disabled/missing result 被打开 | Critical | source 状态在展示后变化，renderer 持旧 path | ID-only backend revalidation；live path/native identity；fail closed | 已处理，持续回归 |
| R-066 | Command Palette 绕过领域安全边界 | Critical | command ID 拼接 invoke、直接移动/删除、执行 AI/finding | metadata/execute 分离；固定 adapter allowlist；preview/journal/restore 不变 | 已处理，持续阻断越界 |
| R-067 | Tolaria AGPL 代码或结构被移植 | Critical | 同栈导致复制 manifest/component/command 实现并触发许可证风险 | 只读设计级；记录 SHA/LICENSE；无代码/结构移植审查 | 已完成许可证门禁 |
| R-068 | 键盘、IME、ARIA 与结果列表状态漂移 | High | composition Enter 误执行、active index 越界、虚拟滚动失焦 | IME guard、stable IDs、ARIA、focus/scroll tests | 已处理，待人工交互验收 |
| R-069 | Global Search 与 File Library Query V2 混为一套 | Critical | Spotlight cursor/scope 被用于 library bulk selection，扩大 AI/selection scope | Task 04 仅 bounded top-N；Query V2 延至 Task 05 | 持续阻断 |
| R-070 | Search 状态/metadata N+1 造成性能退化 | Medium | 每行磁盘访问或每结果 source/status 查询 | bounded DTO、单次 health summary、100k/1M/WAL benchmark | 已处理，持续性能门禁 |

## 风险结论

Task 03 已通过 PR #28 合并并形成 schema 30 基线。Task 04 已关闭 R-061，并完成 Tolaria 设计级边界下的 query/session、window、hotkey、health、command catalog、open/reveal、keyboard/IME/a11y 和权限/性能整改。Windows/macOS CI 与人工代码级验收仍是合并门禁；R-069 继续阻断 Task 05 File Library 及后续模块提前执行。
