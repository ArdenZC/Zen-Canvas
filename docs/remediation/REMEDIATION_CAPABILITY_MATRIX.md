# Remediation Capability Matrix

本矩阵记录当前主线能力、可扩展缺口与明确禁止项。状态只使用：`完整存在`、`部分存在，可扩展`、`不存在`、`与现有架构冲突`、`不应建设`、`Task 08 授权建设`。

| 能力/契约 | 状态 | 当前源码证据 | 边界与缺口 | 当前任务决定 |
|---|---|---|---|---|
| 单库 Global Index | 完整存在 | `db/schema.rs::ensure_global_index_schema`；`global_index/*` | `global_*` 表、FTS、volume/provider 状态已存在 | 复用；Content Search 不进入 Global Search |
| Windows native provider | 完整存在 | `global_index/windows/*` | MFT/USN、service/direct fallback、journal cursor | 持续跨平台回归 |
| macOS Spotlight/FSEvents provider | 部分存在，可扩展 | `global_index/macos/*` | 权限/partial/pending 语义复杂 | Task 08 不改 owner |
| Durable File Library scan | 完整存在 | scan roots/sessions/runs/seen；scanner/watcher | generation、recovery、multi-root、reconciliation | 作为 content managed scope authority |
| 通用 Job Runtime | 与现有架构冲突 | scan/dedupe/analysis/AI/plan/content 各自生命周期 | 泛化会破坏 owner/recovery 语义 | 不建设 |
| Durable Managed AI queue | 完整存在 | `ai_jobs/ai_job_items/ai_analysis_state` | 领域专用 managed file AI | Task 08 不泛化、不作为第二 content queue |
| 交互式 AI provider client | 完整存在 | provider presets、credential、JSON mode、timeout | 可支持用户触发 bounded request；不是 durable queue | Task 08 optional understanding 复用 |
| Managed Scope policy | 完整存在 | managed scope/root health/query V2 | local/cloud、enabled scope、correction gate | content policy 在 durable root 上加 consent，不旁路 |
| File identity safety | 完整存在 | `fs_safety/*`、`file_ops.rs` | operation identity 不是通用主键 | Content Artifact 不替代 identity |
| Cross-domain stable file identity | 部分存在，可扩展 | global native ID、library path ID、operation identity、content hash | 不同数据域语义不同 | 不迁移 `files.id` |
| Durable Dedupe | 完整存在 | dedupe run、group/member、fingerprint cache | hardlink-safe、bounded workers | Content 可读 hash snapshot，但不成为 duplicate authority |
| Durable Analysis Finding | 完整存在 | analysis run/finding/evidence/decision | finding 不是 mutation authority | Content Artifact 独立 ledger |
| Organization Plan | 完整存在 | schema32 `organization_plans/items` | live dry-run/root health/recovery/retention/summary 已闭环 | Content 不修改 Plan schema或执行链 |
| Server-authoritative operation preview | 完整存在 | operation previews、identity verify | execute 重新解析 current preview | Content 不产生 operation preview |
| Durable operation journal | 完整存在 | operations query、pending journal、startup reconcile | filesystem truth | content delete/purge 不调用 journal |
| Safe Trash / cleanup journal | 完整存在 | storage analyzer/cleanup ledger | 非永久删除、restore identity | Content 不获得 cleanup 权限 |
| File Library Query V2 | 完整存在 | `db/queries/library.rs`；Vault stores | scope/revision/keyset/selection/tags/Saved Views | content source materialization 复用 |
| Cross-page authoritative selection | 完整存在 | explicit TEMP set、all_matching contract | 100k boundary | content preview/run 只接受 durable selection |
| Deferred exact count | 完整存在 | File Library count token/resolver | exact 另行解析，不估算 | content preview 复用 truthfulness 原则 |
| Content scope consent policy | 完整存在 | `content_scope_policies` | 默认关闭、root/policy revision、local/cloud/raw-text flags | schema34 `content_scope_policies` |
| Durable Content Run | 完整存在 | `content_runs`/`content_run_items` | typed extract/understand/rebuild/purge；不是通用 runtime | schema34 run/item ledger，上限10k |
| Fixed content extractor registry | 完整存在 | `content.rs` | typed/versioned/bounded；无插件脚本或外部 executable | txt/md/csv、PDF text、docx/xlsx/pptx |
| OCR/Image VLM extractor | 不应建设 | 当前不存在 | 引入大 runtime、跨平台/package/privacy 风险 | Task 08 明确 unsupported |
| Content Artifact | 完整存在 | `content_artifacts` | identity-bound、current/stale、summary/keywords、default no raw text | schema34 `content_artifacts` |
| Retained extracted text | 部分存在，可扩展（Task 08） | `content_artifacts.raw_text` | 默认 none；显式 policy、容量/时间上限、purge | 可选 nullable bounded text，不是默认 |
| Managed Content FTS | 完整存在 | `content_artifact_fts` | summary/keywords/optional retained text；不含 path | schema34，File Library only |
| Global content search | 与现有架构冲突 | Global Search 独立 authority | join Content Artifact 会污染 completeness/permission | 不建设 |
| Vector database / embeddings store | 不应建设 | 当前不存在 | 过度架构、模型/隐私/迁移成本 | Task 08 禁止 |
| RAG/chat over files | 不应建设 | 当前不存在 | 会扩大为通用知识库/Agent | Task 08 禁止 |
| AI trace diagnostics | 完整存在 | `ai/trace.rs` | ring buffer、redaction/truncation；非业务事实 | content raw response 不持久化 |
| Structured Rule AST V1 | 完整存在 | Rust Rule types、validator、classification engine、manual builder | metadata-only fixed DSL | Task 08 不加 content fields/AST V2 |
| Rule repository revision CAS | 完整存在 | schema33 Rule Repository V2 | Create/Update/Toggle/Delete 分离 | Task 08 第一组修 effective catalog |
| Rule catalog authority | 完整存在 | `rule_catalog_state`；backend adapters | learned/settings/user CRUD/toggle 共用 authority gate | Task 08 第一组已关闭 |
| Backend-authoritative Rule execution | 完整存在 | `execute_rules_for_scope_v2` | catalog/rules/scope/root snapshot 与 process-local mutation gate | Task 08 第一组已关闭 |
| Durable NL Rule Proposal | 完整存在 | schema33 `rule_proposals` | lifecycle/recovery/retention | Task 08 保持 |
| Rule proposal canonical validator | 完整存在 | strict envelope、grounding、permission codes、original-prompt gate | backend-owned forbidden intent | Task 08 第一组已关闭 |
| Rule impact preview | 完整存在 | predicate/compiler、scope token、classification simulation | before/after differential engine semantics | Task 08 第一组已关闭 |
| Human proposal Apply | 完整存在 | proposal applying/applied + user rule/catalog CAS | default disabled、不修改 files | Task 08 保持 |
| Proposal review UI | 完整存在 | RuleProposalWorkspace | before/after/risk/scope/conflict completeness；manual provenance | Task 08 第一组已关闭 |
| Natural-language Agent runtime | 不应建设 | 无 tool/task/session runtime | 与产品边界、权限和安全模型冲突 | 永久禁止 |
| Generic tool permission registry | 不应建设 | Tauri capability 已是命令边界 | shell/MCP/tool allow-list 会扩大产品为 Agent | 永久禁止 |
| Script/SQL/shell Rule language | 不应建设 | typed Rule AST | 任意执行不可安全预览 | 永久禁止 |
| Global Search | 完整存在 | global repository/commands/window | 与 File Library/Content 独立 | Search window denied content/rule writes |
| Command Registry | 部分存在，可扩展 | Spotlight command metadata | 不是 Agent tool registry | 不扩展为 tools |
| Durable reconciliation framework | 不存在 | 各域独立 recovery | 跨域万能框架会抹平领域语义 | 不建设 |
| Python/Conda/Tesseract/Nexa runtime | 不应建设 | 当前应用无该 runtime | package、security、cross-platform、download 风险 | Task 08 禁止 |
| Pure Rust fixed-format parsers | 完整存在 | `content.rs` + zip | 最小依赖、license/RustSec/package-size 证据 | 仅固定 extractor registry |
| Content delete/purge | 完整存在 | `content.rs` | 只删 artifact/run/FTS，不删源文件 | main-window、IDs、revision、confirmed |
| Content watcher invalidation | 完整存在 | artifact stale trigger + managed owner | 只标 stale/触发已同意 local extraction；不发 cloud | 复用 watcher，不改 scan ownership |
| Browser content mock | 完整存在 | `browserMockApi.ts` | deterministic fixture，不读文件、不调 provider、不持久化 | 明确 mock 标签和权限否定测试 |

## 结论

当前最成熟的可复用基础设施是 Global Index、Managed File Library、Managed Scope、provider client、Rule AST V1、Organization Plan、operation/restore journal 和 Safe Trash。Task 08 的正确扩展是在 managed File Library 内建立 consent-bound、identity-bound、bounded、可删除的 Content Artifact：先修复 Task 07 六项接受遗留，再通过 authoritative preview、fixed local extractor、default no raw text、per-run cloud gate、managed-only FTS、rebuild/purge/retention 完成内容理解。最危险的误读是把本模块扩张为 OCR/RAG/vector/Agent、第二 AI queue、通用 Job Runtime或文件自动 mutation；这些均被明确禁止。
