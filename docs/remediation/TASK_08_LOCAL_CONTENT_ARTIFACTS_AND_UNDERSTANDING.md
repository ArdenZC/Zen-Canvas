# Task 08 — Consent-Bound Local Content Artifacts and Understanding

## 1. 执行地位

Task 08 是固定八模块主线中的最后一个完整产品模块：**本地内容理解**。

本任务书进入 `master` 后，Task 08 才获得生产实施授权。实施仍必须使用：

```text
一个实施分支
+
一个 Draft PR
+
完整代码级验收
+
停止等待人工决定
```

不得拆成 Task 08A/08B、content-cleanup、OCR-only、Rule-fix-only 或并行产品阶段。

### 基线

- Task 07 / PR #42 squash merge：`4e07de9c02198eb3352d9b2b1f289d61a3df128c`；
- 当前 schema：33；
- Task 08 授权 schema：`33 → 34`；
- 推荐实施分支：`remediation/08-local-content-understanding`；
- Task 08 实施不得自动合并、打 tag 或创建 release。

Task 07 经人工接受合并，但人工代码审查识别的六项问题被接受为 Task 08 **第一组强制生产改动**，不得再次后移。

---

## 2. Task 07 接受遗留：Task 08 第一组

以下六项必须在建设 Content Artifact 前完成真实行为修复和回归测试。

### 2.1 Effective Rule Catalog authority

`rule_catalog_state` 或等价后端 authority 必须覆盖所有会改变实际有效 ruleset 的持久事实，包括：

- learned rule insert/update/enable state；
- user rule CRUD/toggle；
- 会改变 system/learned rule 参与方式的设置；
- 任何影响 classification version 的后端规则政策。

同一个 catalog revision 不得对应两套不同的实际 ruleset。禁止只在 user Rule V2 CRUD 中 bump catalog，而让 learning/settings 旁路。

### 2.2 Rule execution snapshot / TOCTOU

`execute_rules_for_scope_v2` 必须建立单一后端权威执行快照，至少绑定：

- catalog revision；
- settings/policy fingerprint；
- enabled persisted rules 及 classification version；
- durable managed scope IDs；
- root health、watcher recovery/revision；
- library/scope revision。

不得先读取 catalog N，随后加载并执行 catalog N+1 的规则，却返回 N。不得在 scope/root 已变化后继续声称使用原健康 authority。

允许通过短事务快照、领域锁、immutable execution snapshot 或等价方案解决；不得让 renderer 提交 Rule vector 或 path list。

### 2.3 Rule impact 与真实分类语义一致

Rule Proposal impact 不能只统计候选 predicate match。它必须复用或调用与真实 classification engine 同源的纯模拟逻辑，覆盖：

- priority / weight 排序；
- enabled user/learned/system rules；
- legacy built-in policy；
- winner / runner-up conflict；
- action merge；
- Sensitive/System safety guard；
- `safe_action` 降级；
- normalized file type；
- 实际 before/after classification 与 suggestion。

首屏仍可 exact/deferred，但 sample、changed count、conflict 和 after state 必须是真实 engine 语义。要求 differential tests：同一 fixture 的 preview simulation 与实际执行结果逐字段一致。

### 2.4 Proposal Workspace 审核事实完整

Impact UI 必须展示并正确标记：

- before → after；
- risk 与 requires confirmation；
- scope health；
- permission class；
- broad match；
- conflict analysis 是 complete 还是 bounded sample；
- exact/deferred 与 sample 上限。

不得只展示文件名与大小后允许 Apply。

### 2.5 Manual edit provenance

用户手工编辑 proposal candidate 后：

- 旧 AI summary 不得继续冒充当前 AST 的描述；
- provider/model provenance 与 candidate origin 必须可区分；
- UI 明确显示 `manually edited`；
- preview 必须失效并重新生成；
- Apply provenance 保留原 proposal，同时记录当前 candidate 是人工修订。

可在 schema 33 现有字段和 validation/provenance JSON 中完成；不得为这一项单独创建 schema 35。

### 2.6 Backend-owned forbidden intent gate

后端必须对原始 prompt 做确定性的危险意图分类，而不是依赖模型主动映射为 `DeleteCandidate`。至少覆盖：

- delete/trash/empty trash/permanent removal；
- shell/script/command/tool/MCP；
- auto-enable/auto-run/execute now；
- 绕过 preview/journal/restore；
- 读取正文/OCR/content 条件仍不属于 Rule AST V1。

模型返回表面 benign candidate 时，原 prompt 的 deny 意图仍必须阻断。中文、英文和常见变体需要真实行为测试；不得只做源码字符串断言。

---

## 3. 产品目标

Task 08 建立一套**默认关闭、明确同意、受预算约束、可删除、可重建、可解释**的 managed File Library 内容理解能力。

用户能够：

1. 对明确选择的 managed root 或 durable File Library selection 预览内容分析范围；
2. 看到将读取哪些格式、多少文件、多少字节、是否调用本地或云 provider；
3. 显式确认后执行本地格式提取；
4. 为选择的文件生成 bounded summary、keywords 和 language；
5. 在 File Library 中查看、搜索和筛选 current Content Artifact；
6. 识别 unsupported、blocked、stale、truncated 和 failed；
7. 重建或删除 Content Artifact，而不删除、移动或修改源文件；
8. 随时关闭 root policy 并清除该 scope 的内容数据。

Task 08 不把 Zen Canvas 变成 OCR 工具箱、文档编辑器、通用 RAG 数据库、向量数据库、聊天 Agent 或自动文件整理器。

---

## 4. 参考项目与许可证边界

参考项目：

```text
QiuYannnn/Local-File-Organizer
SHA a19559942a35d98e9d2168fa58f288d9ea294bc6
LICENSE: MIT
```

冻结阅读范围至少包括：

- `LICENSE`；
- `README.md`；
- `main.py`；
- `file_utils.py`；
- 文本和图像处理入口；
- dry-run / operation flow。

只借鉴轻量原则：

- 本地优先；
- 按格式选择 extractor；
- 有界读取而非完整无界载入；
- 先展示结果再进行后续动作；
- 内容理解结果与文件操作分离；
- unsupported 格式明确跳过。

明确拒绝：

- Python/Conda/Nexa/Tesseract runtime 直接嵌入；
- source、prompt、CLI 流程或目录结构移植；
- 扫描任意用户 path；
- 读取后直接复制、移动或重命名文件；
- 无 identity binding 的结果；
- 无 consent 的批量正文读取；
- 全文、图片或路径静默发送到云端；
- 隐式下载模型；
- 把模型输出当 mutation authority。

即使参考代码为 MIT，也必须独立设计 Rust/Tauri 数据模型、extractor、UI 和测试。

---

## 5. 不可回退的数据与安全前提

1. managed `files` 继续是 File Library authority；
2. Global Index 不读取、join 或复制 Content Artifact；
3. `files.id` 不迁移，也不改为 content hash；
4. scanner/watcher ownership 不变；
5. Content Artifact 不成为 operation identity；
6. Content Artifact、summary、keywords 不直接授权 move/rename/delete；
7. filesystem mutation 继续经过 Organization Plan、preview、identity、journal、Safe Trash 和 restore；
8. Rule AST V1 继续 metadata-only；Task 08 不创建 Rule AST V2 或 content rule field；
9. AI trace 继续只用于 bounded diagnostics，不是 Content Artifact；
10. Search window 不获得内容读取、分析、删除 artifact 或 provider 调用权限；
11. 所有内容命令 main-window-only；
12. browser mock 不读取本地文件，不伪装真实提取、持久化或 provider 调用。

---

## 6. Schema 34

Task 08 授权 additive schema 34。至少新增以下领域事实；最终列名可按 Rust/SQLite 规范调整，但语义不得削弱。

### 6.1 `content_scope_policies`

每个 durable managed root 一条 policy：

- `root_id`；
- `enabled`，默认 false；
- allowed extractor families；
- per-file byte limit；
- extracted char limit；
- raw text retention mode，默认 `none`；
- local understanding allowed；
- cloud understanding allowed，默认 false；
- revision；
- created/updated timestamps。

Policy 使用 root revision + policy revision CAS。root disabled/degraded/reconciliation 时 policy 不授予读取权。

### 6.2 `content_runs`

Durable run/provenance ledger：

- id；
- mode：`extract | understand | rebuild | purge`；
- status：`building | ready | running | cancelling | completed | partially_completed | cancelled | failed | stale`；
- canonical scope JSON/fingerprint；
- policy/root/library revisions；
- provider mode/provenance；
- requested/materialized/completed/failed/skipped/blocked counts；
- byte/char budgets；
- revision；
- error code/detail；
- timestamps。

### 6.3 `content_run_items`

每个 run item 绑定：

- durable file ID；
- source size/mtime/is_dir/content hash（如已有）；
- root ID；
- extractor kind/version；
- item status；
- artifact ID；
- error code/detail；
- revision/timestamps。

Materialization 上限 10,000 files；必须先完整 preflight，再原子发布，不得悄悄只处理前 N 条。

### 6.4 `content_artifacts`

每个 current artifact 至少包含：

- backend-generated artifact ID；
- file ID/root ID；
- source identity snapshot；
- extractor kind/version；
- artifact status：`current | stale | unsupported | blocked | failed`；
- content fingerprint；
- language；
- bounded summary；
- bounded keywords JSON；
- optional bounded extracted text；
- `text_retained` / `truncated`；
- provider kind/preset/model 或 deterministic-local provenance；
- policy version；
- revision；
- created/updated/stale timestamps。

默认不持久化 raw/extracted text。只有 policy 明确开启本地 text retention 时才允许保存，并必须有独立容量和 retention 上限。

### 6.5 `content_artifact_fts`

只服务 managed File Library Content Search：

- summary；
- keywords；
- 可选 retained extracted text。

FTS 不进入 Global Search，不索引 path/credential/trace。删除或 purge artifact 必须同步删除 FTS facts。

### 6.6 迁移禁止项

- 不 ALTER `files` 大表；
- 不迁移 `files.id`；
- 不修改 operation/cleanup journal schema；
- 不修改 dedupe/Analysis/Plan/Rule Proposal ledger；
- 不创建通用 vector store；
- 不创建通用 Job Runtime；
- `user_version` 最后写入；
- schema conflict/future schema 必须 rollback/fail closed。

---

## 7. Consent 与权威预览

内容读取前必须先生成 backend-authoritative preview。

Preview request 只接受：

```text
version
requestId
scope: durable File Library scope/selection
mode
expected policy/root/library revisions
provider mode
```

不得接受 arbitrary path、raw file list、renderer-computed bytes、provider secret 或 source content。

Preview response 至少包含：

- canonical scope and health；
- exact file count 或明确 deferred；
- exact/upper-bound byte and char budgets；
- supported/unsupported/blocked counts；
- format distribution；
- local/cloud provider disclosure；
- raw text retention disclosure；
- bounded metadata sample（最多 20）；
- policy/root/library revisions；
- preview fingerprint；
- confirmation text。

Start 必须提交 preview fingerprint + `confirmed=true`，并重新验证全部 authority。scope/root/policy/library 变化返回 stale。

### 默认行为

- 未创建 policy：disabled；
- policy disabled：不得读取正文；
- local extraction：仍需首次/每次 run 的明确 preview confirmation；
- cloud understanding：每次 run 单独确认，root policy 只表示允许询问，不代表自动发送；
- Sensitive/System/blocked 文件禁止发送云 provider；
- 不得后台静默下载模型。

---

## 8. Fixed Extractor Registry

Task 08 使用固定、typed、versioned extractor registry，不允许插件脚本或用户自定义命令。

### 必须支持

- UTF-8/UTF-16/常见可检测编码的 `.txt`；
- `.md`；
- bounded `.csv`；
- text-layer `.pdf`；
- `.docx`；
- `.xlsx`；
- `.pptx`。

### 明确 unsupported

- legacy binary `.doc/.xls/.ppt`；
- password-protected/encrypted archives/documents；
- executable/binary blobs；
- symlink target traversal；
- video/audio；
- ebook；
- arbitrary archive；
- OCR-only scanned PDF；
- image OCR / general VLM；
- remote URLs。

Task 08 不捆绑 Tesseract、Python、Conda、Nexa 或外部 executable。未来 OCR 必须另有人工任务书；不得在本 Task 内顺手加入。

### 安全预算

每个 extractor 必须限制：

- source bytes；
- pages/slides/sheets/rows；
- archive entries；
- decompressed bytes；
- compression ratio；
- nesting depth；
- extracted characters；
- wall-clock time；
- cancellation checks。

Malformed、zip bomb、PDF bomb、encoding bomb、huge sparse file 和 permission error 必须返回稳定 blocked/failed code，不 panic、不 OOM、不读取 scope 外文件。

---

## 9. Artifact identity、stale 与重建

Artifact currentness 必须绑定：

```text
file ID
+
root ID
+
size / mtime / is_dir
+
content hash（若已有且适用）
+
extractor kind/version
+
policy version
+
provider/model/prompt policy version（如使用）
```

源 identity、extractor 或 policy 变化时 artifact 变 stale，不得继续展示为 current。

Watcher/scanner 只能标记 invalidation 或安排已同意的 local extraction；不得自动发云 provider。不存在 content consent 的 root 不得被 watcher 读取正文。

Rebuild 创建新 artifact 后原子替换 current projection；失败时保留旧 artifact 但明确 stale，不得把旧 summary 冒充当前结果。

---

## 10. Local extraction 与 optional understanding

### 10.1 Deterministic extraction

Extractor 在本地进程中读取 source，产出 bounded normalized text 和 extraction facts。该阶段不调用 AI provider。

默认只持久化：

- summary/preview 所需的结构化 facts；
- language；
- char/page/row counts；
- truncation；
- extractor provenance。

Raw extracted text 默认仅存在于 bounded memory，处理后清除。

### 10.2 Summary / keywords

Task 08 支持两种 understanding：

1. deterministic local：无模型时生成 bounded extractive summary/keywords；
2. configured provider：用户明确触发，对最多 20 个 selected current extraction results 生成 structured summary/keywords。

不得创建第二 durable AI queue。Provider request 使用现有交互式 provider client、credential、timeout、JSON mode 和 bounded cancellation owner。

### 10.3 Cloud provider gate

非 loopback/OpenAI-compatible cloud provider 必须：

- 每次请求明确确认；
- 展示文件数量与最大 chars；
- 不发送 path、root、文件名、其他文件列表、operation logs、tags、credentials 或 trace；
- payload 只含 bounded extracted text 和固定 schema；
- Sensitive/System/blocked 文件 fail closed；
- raw response 不持久化；
- trace 脱敏且 bounded；
- timeout/cancel 不自动 retry。

Local provider 仍受 size/char/cancel/retention 约束，但不需要云发送确认。

### 10.4 Strict model envelope

模型只能返回 fixed JSON：

```text
summary
keywords[]
language?
warnings[]
```

后端限制长度、数量、字符集和未知字段。模型不得输出 path、filename、Rule、Plan、operation、script 或 tool request。

---

## 11. Content Search 与 File Library 集成

新增 managed Content Search，不扩展 Global Search。

Query 只返回 current、authorized artifact：

- content text；
- keywords；
- language；
- artifact status；
- extractor kind；
- truncated/text-retained flags。

结果通过 file ID join 回 managed File Library detail，必须绑定 library/content revisions 和 keyset cursor。不得 OFFSET 深分页，不从 loaded page 推断全局统计。

File Library Inspector 至少展示：

- Content Analysis 状态；
- consent/policy；
- summary；
- keywords/language；
- extractor/provider provenance；
- current/stale/truncated；
- source identity time；
- Rebuild；
- Delete Content Data。

Selection actions：

- Preview Content Analysis；
- Analyze Locally；
- optional Understand with Provider；
- Rebuild stale；
- Delete Content Data。

所有按钮必须区分分析 artifact 与源文件，不得使用“Delete file”含混文案。

---

## 12. API 最低集合

至少新增或等价实现：

```text
get_content_scope_policy
set_content_scope_policy
preview_content_run
start_content_run
get_content_run
list_content_runs
cancel_content_run
query_content_run_items
get_content_artifact
query_content_artifacts
rebuild_content_artifacts
delete_content_artifacts
purge_content_scope
understand_content_artifacts
```

写命令必须：

- main-window-only；
- durable IDs only；
- expected revisions；
- explicit confirmation；
- stable error code；
- no arbitrary paths；
- no generic SQL/script/tool payload。

Delete/purge 只删除 Content Artifact、run item 和 FTS facts，不修改源文件，不调用 cleanup/operation journal。

---

## 13. Run lifecycle、recovery 与 retention

### Run lifecycle

```text
building → ready → running → completed
                     ↘ partially_completed
                     ↘ cancelling → cancelled
                     ↘ failed
                     ↘ stale
```

- building materialization 必须 staged/atomic；
- owner 使用 run revision/CAS；
- cancellation bounded；
- startup recovery 不重放已经完成的 extractor item；
- interrupted running item 转回 pending 或 failed 必须有确定合同；
- 不允许两个 owner 同时处理同一 item；
- 单次 local extraction 并发最多 2，provider understanding 最多 1；
- 每批短事务，保持 WAL reader 可用。

### Retention

- current artifact 在源文件 current 且 policy enabled 时不按 age 自动删除；
- stale artifact 默认 30 天；
- optional retained extracted text 默认最多 7 天并有总容量上限；
- terminal runs 默认 30 天，最多保留 100；
- age UNION count overflow；
- child-first、dedup、每次最多 20 个 run；
- active runs/items 不删除；
- purge scope 使用显式 confirmed + root/policy revision；
- 删除 artifact 不删除正式 Rule、Plan、Finding、operation log 或源文件。

---

## 14. Dependencies 与供应链

Task 08 可新增**最小、纯 Rust、进程内**格式解析依赖，但必须同时满足：

- 仅用于固定 extractor registry；
- 锁定版本；
- 记录 LICENSE 与 transitive inventory；
- 无 shell/external executable；
- 无动态下载模型；
- Windows/macOS release compile；
- RustSec/npm audit；
- package size delta 单独记录；
- malformed/bomb fuzz-style fixtures。

禁止新增 Python、Node server、Tesseract、Nexa SDK、LibreOffice、Pandoc、Java、Docker sidecar、数据库 server 或向量数据库。

依赖和 lockfile 如有变化必须在 Closeout 明确列出，不能继续沿用“无变化”模板。

---

## 15. Permissions、Mock 与隐私文案

### Tauri capability

- main window：允许 policy、preview、run、artifact query/rebuild/delete；
- Search window：全部 denied；
- 无 generic read-file/path invoke；
- build.rs/main.rs/lib.rs/capability/security matrix 同步。

### Browser mock

Mock 可以提供标记为 mock 的固定 artifact/run fixture，但必须明确：

- 不读取本地文件；
- 不执行真实 extractor；
- 不调用 provider；
- 不持久化 SQLite；
- 不证明 privacy/package 成功。

### 必须显示的隐私事实

UI 至少明确展示：

- “内容分析默认关闭”；
- “本地提取会读取所选文件正文”；
- “云端理解会发送有界提取文本，不发送路径或文件名”；
- “删除内容数据不会删除源文件”；
- retained text 是否开启及保留多久。

---

## 16. 性能与容量门禁

必须建立 release-profile benchmark 和 query-plan evidence：

- schema 33→34：100k/1M `files` fixture，不重写 `files`，size delta 可解释；
- 10k run materialization；
- 10k current artifact first page/keyset；
- 100k/1M Content FTS query；
- 1k artifact delete/rebuild planning；
- bounded retained-text capacity；
- WAL reader 在 run writer/extractor publication 时保持可读；
- malformed/bomb fixture 不超过预算；
- cancellation latency；
- provider payload char budget；
- Windows/macOS package size delta。

建议目标：

- 100k content query p95 ≤ 100 ms；
- 1M first page p95 ≤ 250 ms；
- 10k run materialization p95 ≤ 1 s；
- artifact detail p95 ≤ 20 ms；
- cancel owner observe ≤ 1 s；
- 单次 extractor memory 不超过任务书预算并有实测。

无法稳定达到时必须 truthful deferred/partial，不得伪造 estimate 或缩小 fixture。

---

## 17. 测试矩阵

### Task 07 handoff

- learned/settings mutation 与 catalog revision；
- catalog/rules/scope concurrent mutation；
- preview-vs-execution differential；
- Proposal UI 审核事实；
- manual edit provenance；
- 中英文 forbidden intent。

### Schema / repository

- fresh schema 34；
- real schema 33 migration；
- idempotence；
- conflict rollback；
- future schema reject；
- 100k/1M no `files` rewrite；
- WAL reader。

### Extractors

- 每种 mandatory 格式真实 fixture；
- empty、truncated、encoding、malformed；
- encrypted/protected；
- zip bomb/entry count/ratio；
- PDF huge page count；
- symlink/path escape；
- permission denied；
- cancellation；
- no panic/OOM。

### Privacy / provider

- policy disabled 不读取；
- root unhealthy 不读取；
- cloud requires each-run confirm；
- path/filename/secret 不进入 payload；
- Sensitive/System cloud deny；
- raw response 不持久化；
- trace bounded/redacted；
- retained text default none；
- purge removes FTS/text。

### Lifecycle / identity

- source size/mtime/hash change → stale；
- extractor/policy version change → stale；
- restart recovery；
- no duplicate owner；
- active retention protection；
- rebuild atomic projection；
- delete artifact does not touch source。

### UI / accessibility

- backend hydration/remount；
- latest-request-wins；
- stale view retained with banner；
- narrow/200% zoom/CJK/RTL；
- keyboard/focus/dialog trap；
- `aria-live` run/progress/error；
- clear local/cloud/retention disclosures。

### Cross-domain regression

- Global Search unchanged；
- File Library V2 metadata query unchanged；
- Rule AST remains metadata-only；
- Rule/Plan/operation journal unaffected；
- scanner/watcher ownership unchanged；
- no source file mutation from content commands。

---

## 18. 完成交付

Task 08 完成前必须：

```bash
npm run verify:frontend
npm run verify:rust
npm run verify:security
npm run test:remediation
npm run test:performance
npm run build
git diff --check
git status --short
```

还必须提供：

- baseline/final HEAD；
- schema 34 migration/rollback/performance；
- Task 07 六项 handoff 关闭证据；
- extractor registry 与依赖/license inventory；
- consent/provider/privacy tests；
- retention/rebuild/delete semantics；
- 100k/1M query/FTS evidence；
- Windows/macOS Rust、release compile；
- NSIS/unsigned DMG job 的 success/skipped 分开记录；
- 本地 package 与远端 job 分开；
- package size delta；
- known risks；
- 原子提交列表；
- 唯一 Draft PR；
- 明确未创建 OCR、Agent、shell、MCP、tool runtime、第二 AI queue、自动文件 mutation 或 schema 35。

Task 08 完成后停止等待人工代码级验收。不得自动合并、发布或自行创建 Task 09。