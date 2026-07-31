# Remediation Capability Matrix

本矩阵记录当前主线能力、可扩展缺口与明确禁止项。状态只使用：`完整存在`、`部分存在，可扩展`、`不存在`、`与现有架构冲突`、`不应建设`。

| 能力/契约 | 状态 | 当前源码证据 | 边界与缺口 | 当前任务决定 |
|---|---|---|---|---|
| 单库 Global Index | 完整存在 | `db/schema.rs::ensure_global_index_schema`；`global_index/*` | `global_*` 表、FTS、volume/provider 状态已存在 | 复用；Task 07 不重建 |
| Windows native provider | 完整存在 | `global_index/windows/*` | MFT/USN、service/direct fallback、journal cursor | 持续跨平台回归 |
| macOS Spotlight/FSEvents provider | 部分存在，可扩展 | `global_index/macos/*` | 权限/partial/pending 语义复杂 | Task 07 不改 owner |
| Durable File Library scan | 完整存在 | scan roots/sessions/runs/seen；scanner/watcher | generation、recovery、multi-root、reconciliation 已完成 | 作为 Rule impact managed scope |
| 通用 Job Runtime | 与现有架构冲突 | scan/dedupe/analysis/AI/journal 各自生命周期 | 泛化会破坏 owner/recovery 语义 | 不建设 |
| Durable Managed AI queue | 完整存在 | `ai_jobs/ai_job_items/ai_analysis_state`；Managed worker | 领域专用于 managed file AI | Task 07 不写入/泛化 |
| 交互式 AI provider client | 完整存在 | AI provider presets、credential、JSON mode、timeout | 可支持用户触发短请求；不是 durable queue | Task 07 复用来生成 proposal |
| Managed Scope policy | 完整存在 | `global_index/managed_scope.rs` 等 | local/cloud、enabled scope、correction gate | Plan 与 impact preview 必须复用 |
| File identity safety | 完整存在 | `fs_safety/*`、`file_ops.rs` | operation identity 不是通用主键 | Plan execution 继续复用 |
| Cross-domain stable file identity | 部分存在，可扩展 | global native ID、library path ID、operation identity | 不同数据域语义不同 | 不迁移 `files.id` |
| Durable Dedupe | 完整存在 | dedupe run、group/member、fingerprint cache | hardlink-safe、bounded workers | Rule 只可读取 duplicate 条件 |
| Durable Analysis Finding | 完整存在 | analysis run/finding/evidence/decision | finding 不是 mutation authority | Rule/Plan 只读 bounded summary |
| Organization Plan | 完整存在 | schema32 `organization_plans/items`；Task 07 live dry-run/recovery regressions | live target、root health、review transition、terminal recovery、retention、summary 已闭环 | Task 07 第一组已关闭 |
| Server-authoritative operation preview | 完整存在 | `get_operation_previews_by_file_ids`、identity verify | execute 重新解析 current preview | 必须与 dry run 绑定同一 live proposal |
| Durable operation journal | 完整存在 | operations query、pending journal、startup reconcile | filesystem truth | 不另建 journal、不改 schema |
| Safe Trash / cleanup journal | 完整存在 | storage analyzer/cleanup ledger | 非永久删除、restore identity | Rule Proposal 不获得 cleanup 权限 |
| File Library Query V2 | 完整存在 | `db/queries/library.rs`；Vault V2 stores | scope/revision/keyset/selection/tags/Saved Views | Rule impact 使用该 authority |
| Cross-page authoritative selection | 完整存在 | explicit TEMP set、all_matching contract | 100k boundary 已实现 | 不作为直接 mutation authority |
| Deferred exact count | 完整存在 | File Library count token/resolver | exact 另行解析，不估算 | Rule impact采用同一 truthfulness原则 |
| Content extractor | 不存在 | 无格式读取器 | 无 consent/size/retention/provider gate | Task 08 前禁止 |
| Content Artifact | 不存在 | schema 无 artifact ledger | AI trace 不是业务内容 artifact | Task 08 前禁止 |
| AI trace diagnostics | 完整存在 | `ai/trace.rs` | ring buffer、redaction/truncation；非业务事实 | Proposal raw response 不持久化 |
| Structured Rule AST V1 | 完整存在 | Rust Rule types、validator、classification engine、manual builder | 允许字段/operator/action 已固定 | Task 07 唯一 candidate target |
| Rule repository revision CAS | 完整存在 | schema33 `rules.revision/ast_version/origin_proposal_id`；`rules_repo.rs` V2 CRUD | Create/Update/Toggle/Delete 分离；旧 whole-object write 已退出 capability | Task 07 完成 |
| Rule catalog authority | 完整存在 | `rule_catalog_state`；backend classification adapters | catalog CAS、classification version、scanner/watcher/manual 统一加载 enabled rules | Task 07 完成 |
| Durable NL Rule Proposal | 完整存在 | schema33 `rule_proposals`；`rule_proposals.rs` lifecycle/recovery/retention | 交互生成 owner 非 durable queue；可重启继续人工审查 | Task 07 完成 |
| Rule proposal canonical validator | 完整存在 | strict envelope、AST V1 canonicalization、literal grounding、permission codes | Rust 是 authority；TS 只做表单提示 | Task 07 完成 |
| Rule impact preview | 完整存在 | metadata SQL compiler、managed scope health、exact/deferred token/fingerprint | sample≤20；Apply 只接受 exact | Task 07 完成 |
| Human proposal Apply | 完整存在 | 单 transaction proposal applying/applied + user rule/catalog CAS | create/update 后均 disabled；不修改 files、不运行规则 | Task 07 完成 |
| Natural-language Agent runtime | 不应建设 | 无 tool/task/session runtime | 与产品边界、权限和安全模型冲突 | 明确禁止 Coworker/OpenCode runtime |
| Generic tool permission registry | 不应建设 | Tauri capability 已是应用命令边界 | shell/MCP/tool allow-list 会扩大产品为 Agent | 仅把 ask/allow/deny 翻译为 proposal validation 类别 |
| Script/SQL/shell Rule language | 不应建设 | Rule AST 是 typed metadata DSL | 任意执行不可安全预览 | 永久禁止 |
| Backend-authoritative Rule execution | 完整存在 | `execute_rules_for_scope_v2`；scanner/watcher authoritative adapters | renderer 只提交 durable scope/mode/catalog revision/confirmed | Task 07 完成 |
| Global Search | 完整存在 | global search repository/commands/window | 与 File Library 独立 | Search window denied Rule writes |
| Command Registry | 部分存在，可扩展 | Spotlight command metadata | 不是 Agent tool registry | Task 07 不扩展为 tools |
| Durable reconciliation framework | 不存在 | 各域独立 recovery | 跨域通用框架会抹平领域语义 | 不建设万能 runtime |

## 结论

当前最成熟的可复用基础设施是 Global Index、Managed File Library、Managed Scope、AI provider/Managed AI policy、Rule AST V1、Organization Plan、operation/restore journal 和 Safe Trash。Task 07 的正确扩展是把自然语言隔离在 durable Rule Proposal 中，经 Rust canonical validation、truthful impact preview 和人工 Apply 后生成默认禁用的用户规则，并把正式 Rule CRUD/Execution 收回 backend authority。最危险的误读是引入 Coworker/OpenCode Agent runtime、第二 AI queue、shell/tools 或 Content Artifact；这些均被明确禁止。
