# Task 05 — File Library Query V2、用户标签、Saved Views 与 Inspector

## 0. 执行状态

本文件是 Zen Canvas Architecture Remediation V1 的 **Task 05 完整产品模块任务书**。

它覆盖固定产品模块 5：**文件库**。

执行授权仅在以下条件同时满足后成立：

```text
本文件已位于当前 master
+
CODEX_REMEDIATION_INDEX_V1.md 将 Task 05 标记为唯一可执行完整模块
+
master 包含 Task 04 / PR #35 squash merge commit
14616d4344314afce0878dbc681988c04183a9bc
```

Task 05 必须在一个实施分支、一个 Draft PR 中连续完成。不得拆成 05A/05B/05C，不得创建独立的 Task 04 收尾任务，不得中途停在内部子阶段等待重新设计。

建议实施分支：

```text
remediation/05-file-library
```

Task 06、Task 07、Task 08 继续禁止执行。

---

## 1. 基线与前置事实

### 1.1 代码基线

- Task 04 / PR #35 source final HEAD：`5a42b0312286ae5eab2b01e9bdc13662ba761e5a`；
- Task 04 / PR #35 squash merge：`14616d4344314afce0878dbc681988c04183a9bc`；
- 当前数据库：schema 30；
- 当前版本线：`0.1.40`；
- Global Index 与 File Library `files` 数据域继续分离；
- `files.id` 不迁移；
- operation/cleanup journal、Safe Trash、restore 不改造；
- Managed AI schema/provider 不改造。

每次启动实施都必须记录实际 `master HEAD`，确认它包含上述 merge commit。若实际 master 又包含后续已合并 CI、文档或安全提交，以实际 HEAD 为基线，不得 reset 回旧 SHA。

### 1.2 当前文件库事实

当前 File Library 已有：

- `files` managed metadata 表和 trigram FTS；
- `LibraryScope` 的 all/current scan/roots 兼容模型；
- `get_paged_files` OFFSET 分页；
- 50 行增量加载；
- React Virtual 虚拟列表；
- loaded rows 内的单选、多选、Shift range、Ctrl/Cmd+A；
- 基础搜索、分类筛选、duplicate/review filter；
- client-side advanced filter 和 sort；
- 为保证“过滤真实性”而最多收集 200 页/10,000 条的临时策略；
- 单文件/多文件 Inspector，但 detail 主要来自当前 page 的完整 `FileRecord`；
- metadata-only preview；
- Duplicate Groups 只读面板；
- existing AI classification/organize consumers 仍复用旧 `get_paged_files`。

当前主要结构问题：

1. OFFSET 在 scan/watcher/operation 更新下会漏项或重复；
2. advanced filter 和 sort 只对 renderer 已加载集合生效；
3. `collectLibraryPages` 通过最多加载 10,000 行弥补真值缺陷，不能扩展到 100k/1M；
4. selection 只保存 loaded IDs，无法真实表达“全部匹配结果”；
5. `FileRecord` 同时承担 list summary、Inspector detail、classification detail 和 operation input，IPC 过宽；
6. Inspector 依赖当前 page 缓存，跨页 selection 或数据更新后容易显示缺失/旧数据；
7. 没有用户自定义标签的持久模型；
8. 没有 durable Saved Views；
9. scope 仍主要由 renderer path 数组表达，Saved View 无法稳定引用 durable scan root；
10. `last_opened_at/open_count` 没有当前可靠持久事实，不应继续作为真实排序能力宣传。

---

## 2. 产品目标

Task 05 将文件库收敛为一个 **数据库权威、可分页、可复用查询、可真实跨页选择、用户可标记、Inspector 按需取详情** 的 managed file library。

完整目标：

1. 建立严格 versioned 的 `FileQuerySpec V2`；
2. 所有搜索、筛选、排序下沉 SQLite；
3. 使用 snapshot revision + keyset cursor，消除 OFFSET 漂移；
4. 区分 list summary、detail、selection summary DTO；
5. 建立真实跨页 selection contract；
6. 建立用户标签及批量标签操作；
7. 用户标签与系统 Purpose/Lifecycle/Risk 严格分离；
8. 建立 durable Saved Views；
9. Saved View 保存规范化查询，不保存 cursor/selection；
10. 文件库 scope 引用 durable scan roots，不信任任意 renderer path；
11. Inspector 使用 ID-only backend detail 查询和 latest-request-wins；
12. 保留虚拟列表并完善键盘、焦点、ARIA 和大数据交互；
13. 日常 100k 和上限 1M 性能门禁；
14. 首先关闭 Task 04 人工接受并转入本阶段的 4 项遗留。

---

## 3. 明确不做

Task 05 不做：

- Organization Plan；
- AI 整理 dry run；
- 自动移动、重命名、归档或删除；
- 自然语言规则生成；
- Content Artifact、全文提取、OCR；
- 文件内容编辑器、播放器或完整文件管理器；
- 云同步、多设备标签同步；
- filename-embedded tags；
- `.ts`/sidecar tag 文件；
- 把 TagSpaces 数据结构或 UI 源码移植进 Zen Canvas；
- 第二套 Global Index；
- 把 Global Search cursor/session 复用为 Library cursor/snapshot；
- 迁移 `files.id`；
- 修改 operation/cleanup journal schema；
- 修改 Managed AI schema/provider；
- 将标签操作解释为文件系统 mutation；
- 为查询建立每次物化全部 file ID 的 snapshot item 表；
- 长期持有跨 IPC SQLite read transaction；
- 泛化通用 Job Runtime。

旧 `get_paged_files` 可作为其他已存在模块的兼容 API 保留，但 Task 05 File Library UI 完成后不得继续走旧 OFFSET/renderer filter 路径。

---

## 4. TagSpaces 参考边界

### 4.1 固定参考

- repository：`tagspaces/tagspaces`；
- 本任务书分析 SHA：`7ec3a2e8632b8bf5db685436e6d2d8805977a880`；
- default branch：`develop`；
- license：GNU AGPL-3.0。

实施开始时 Codex 必须重新读取该 SHA 的 `LICENSE.txt`，并记录实际分析文件。若 develop 已推进，可额外记录新 HEAD，但不得用新 HEAD 替换本任务书冻结的许可证边界，除非人工修订任务书。

### 4.2 仅允许借鉴的设计原则

允许独立吸收：

- Location 作为明确浏览上下文，而不是隐式路径字符串；
- tag vocabulary 与文件列表交互分层；
- tag AND/OR/NOT 等组合筛选概念；
- Saved Search/Saved View 是命名的查询状态；
- Inspector/Properties 按需显示细节；
- 批量交互必须先有明确 selection 语义；
- 搜索、筛选、标签、位置和历史入口在信息架构上可发现；
- 用户元数据不应和系统自动分类混为同一字段。

### 4.3 明确拒绝

禁止：

- 复制、翻译、逐段改写 TagSpaces 源码；
- 复制 component/hook/context/reducer 结构；
- 复制 SearchQuery、SearchOptions、SavedSearchesContext 的字段或 action 名；
- 复制 UI 布局、CSS、图标组合；
- 复制 filename tagging 或 sidecar metadata 实现；
- 复制 localStorage 作为 Saved View 持久事实；
- 复制其完整 Location/File Manager 模型；
- 复制 Pro/扩展功能边界；
- 因同为 React/TypeScript 而进行“等价重写”。

Closeout 必须列出：参考文件、设计借鉴、主动拒绝、无 AGPL 代码/结构移植证据。

---

## 5. 第一组生产改动：关闭 Task 04 接受遗留

以下问题不得再次后移。完成后继续整个 Task 05，不得停止等待验收。

### 5.1 Degraded source 不得显示 complete

修复 Global Search `collection_complete`：

所有 enabled source 只有在真正 ready 且没有以下状态时才可 complete：

- discovered/indexing/syncing/rebuild_required；
- permission_required；
- spotlight_not_indexed；
- spotlight_unavailable；
- spotlight_external_not_indexed；
- fsevents_unavailable；
- unavailable；
- error；
- paused；
- 其他未知/降级状态。

要求：

- 部分结果可返回，但必须为 partial/pending/failed 中的真实状态；
- 空结果 + degraded 不得显示普通 empty；
- source health、snapshot revision 和 results 继续保持同一 read snapshot；
- 增加每个 degraded 状态的 response-state 测试。

### 5.2 Standalone navigation 在 ACK 后重新验证

Task 04 ready handshake 必须在发出 `search-navigate` 前再次验证原始：

- session ID；
- revision；
- phase；
- nonce/ACK；
- main-window readiness。

最终 hide 必须使用原 session/revision 的 scoped mutation request，禁止 `None` 无条件隐藏当前新 session。

覆盖：

- 等待 ACK 期间 hide；
- 等待 ACK 期间 reopen；
- 旧 session ACK 到达；
- 新 session 已 visible 时旧 navigation 不发出且不隐藏新窗口；
- timeout/failure 保持可重试。

### 5.3 Search tie-break 与 punctuation 语义

- extension exact/prefix tier 最终 tie-break 必须使用 durable `ge.id ASC`，不得使用 SQLite `rowid` 作为产品稳定身份；
- punctuation fallback 不得简单剥离首尾标点后改变查询语义；
- `.gitignore`、`C++`、`report!`、方括号、星号、问号等必须有明确 bounded 语义；
- benchmark 的 punctuation case 必须断言结果正确，不得只测耗时；
- 100k/1M 门限继续通过。

### 5.4 Mounted IME 行为测试

生产逻辑保留 display value 与 committed query 分离，但必须增加 mounted interaction test：

```text
mount CommandModal
compositionstart
change z
change zh
change zhong
等待超过 debounce
backend search 调用次数 = 0
compositionend 中
等待 debounce
backend 仅调用一次，query = 中
```

同时验证 composition 中 Enter/Arrow/Home/End/Page 键不执行、不移动 active selection。

---

## 6. Schema 31 授权

Task 05 明确授权数据库从 schema 30 升级到 schema 31。

不得 ALTER/重建 `files` 大表，不得迁移 `files.id`。

### 6.1 `user_tags`

```sql
CREATE TABLE user_tags (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    color_token TEXT NOT NULL DEFAULT 'neutral',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_user_tags_name
    ON user_tags(normalized_name COLLATE NOCASE, id);
```

合同：

- ID 由 backend 生成；
- display name trim 后 1–64 Unicode scalar；
-拒绝 control character、path separator、空白名；
- `system:`、`zen:` 等保留前缀不得由用户创建；
- normalized name 由 backend 统一生成；
- color 只能来自 Zen Canvas 固定 semantic palette token，不接受任意 CSS/HTML；
-同 normalized name 冲突返回稳定错误；
- rename 不改 ID；
-删除 tag 必须显式确认 usage count。

### 6.2 `file_user_tags`

```sql
CREATE TABLE file_user_tags (
    file_id TEXT NOT NULL
        REFERENCES files(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    tag_id TEXT NOT NULL
        REFERENCES user_tags(id)
        ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(file_id, tag_id)
);

CREATE INDEX idx_file_user_tags_tag_file
    ON file_user_tags(tag_id, file_id);
```

`ON UPDATE CASCADE` 是强制要求，因为现有 ordinary move/restore 路径可能更新 `files.id`。不得让 metadata tag 阻断 operation/restore 的既有索引更新。

### 6.3 `library_saved_views`

```sql
CREATE TABLE library_saved_views (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    query_spec_version INTEGER NOT NULL CHECK (query_spec_version = 2),
    query_spec_json TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_library_saved_views_position
    ON library_saved_views(position, updated_at DESC, id);
```

合同：

-只保存 backend canonicalized FileQuerySpec V2；
-不保存 cursor、snapshot revision、selection 或 loaded row；
-JSON 解析后必须通过固定 enum/范围验证；
-不得含任意 SQL、regex program、shell、script 或任意 filesystem path；
-scope 使用 durable scan root ID；
-打开 Saved View 时创建新 query snapshot；
-root 缺失/disabled/degraded 时显示 scope health，绝不回退为 all。

### 6.4 `library_query_state`

```sql
CREATE TABLE library_query_state (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    updated_at INTEGER NOT NULL
);

INSERT INTO library_query_state(singleton_id, revision, updated_at)
VALUES (1, 1, <now>);
```

该表是 File Library 查询一致性时钟，不是 Global Index revision，不是 scan generation，不是 durable query job。

### 6.5 revision bump 规则

建立统一 repository helper，例如：

```text
bump_library_query_revision_in_transaction(tx)
```

一次业务 transaction 最多 bump 一次。禁止在 `files` 大表上建立每行更新 revision 的 trigger，避免 100k scan 产生 100k 次 singleton write。

以下生产写路径必须审计并在同一 transaction 中 bump：

- scanner batch insert/update；
- watcher upsert/stale/reconciliation；
- operation/restore 后 path/id/metadata 更新；
- rule/AI classification 改变 query/filter/sort 字段；
- stale/prune；
- duplicate group active publication/invalidation；
- user tag assign/remove；
-会改变 list summary 或 query membership/order 的其他写入。

Saved View 自身增删改不改变文件 query revision。

必须建立 integration tests 证明各类写路径使 revision 前进，并建立 architecture guard 防止新增 query-affecting repository 写路径忘记 bump。

### 6.6 Migration/rollback

- migration 在 `BEGIN IMMEDIATE` 内完成；
-任一表、索引、seed 或校验失败，整个 migration 回滚，user_version 保持 30；
-全部成功后最后设置 31；
- current schema 启动路径执行 `ensure_file_library_schema`；
-旧 binary 对 future schema 继续拒绝；
-不删除、改写或 backfill 用户文件行；
-新 tag/saved view 表初始为空；
-真实 schema 30 fixture、100k files fixture、WAL reader、foreign key、files.id update cascade 必须测试。

---

## 7. FileQuerySpec V2

### 7.1 请求 DTO

建立严格 DTO，概念结构如下：

```text
FileQueryRequestV2 {
  version: 2,
  requestId,
  query: FileQuerySpecV2,
  pageSize,
  cursor?
}

FileQuerySpecV2 {
  scope,
  text?,
  filters,
  sort
}
```

### 7.2 Scope

V2 scope 只接受：

```text
all_enabled_roots
roots { scanRootIds[] }
current_scan { scanSessionId }
```

要求：

- backend 从 `scan_roots` / `scan_session_roots` 解析 authoritative normalized path；
-不接受 renderer 任意 path 作为 V2 scope authority；
-root ID 去重和稳定排序；
-disabled/missing/degraded/reconciliation_required root 明确投影 health；
-若某 root 不可用，query 为 partial/invalid scope，不得静默扩大；
-current scan session 不存在或不再可解析时返回稳定错误；
-compatibility `LibraryScope` path API 可保留给旧 consumers，但 VaultView 不再使用。

### 7.3 Filters

至少支持：

- file type：多选 include；
- Purpose：多选 include；
- Lifecycle：多选 include；
- Risk：多选 include；
- size min/max；
- modified from/to；
- created from/to；
- duplicate：any/only/exclude；
- review：any/only/exclude；
- user tags：allOf/anyOf/noneOf；
- active rows 默认 `is_stale = 0`。

所有数组：

-去重；
-固定枚举；
-长度上限；
-空数组规范化为空条件；
-非法组合稳定拒绝。

Tag filter 只引用 tag ID。不存在的 tag ID 不得被解释为文本标签。

### 7.4 Sort

允许：

- relevance（仅 text 非空）；
- modified；
- created；
- name；
- size；
- confidence。

禁止继续展示没有 durable fact 的 last opened/open count 排序。

每种 sort 必须包含 durable `files.id` 最终 tie-break。null/invalid date 不得导致分页漂移。

### 7.5 Text search

复用现有 managed `files_fts`/search CTE 和 scope 边界：

-不 join `global_entries`；
-不搜索 unmanaged/global-only files；
-FTS 构造 injection-safe；
-CJK/英文/标点语义保持；
-text + filters 在同一 SQLite query；
-不把 renderer-filtered loaded rows 当最终结果。

### 7.6 Canonicalization/fingerprint

Backend canonicalize query spec：

- trim text；
-数组去重并按稳定值排序；
-删除默认/空条件；
-normalize numeric/date range；
-root/tag ID 稳定排序；
-生成 canonical JSON；
-用现有 BLAKE3 生成 query fingerprint。

Renderer 不能自行声明 authoritative fingerprint。

---

## 8. Snapshot revision 与 keyset cursor

### 8.1 Snapshot 模型

本阶段采用 **revision-validated stateless snapshot**：

-第一页在单一 SQLite read transaction 中读取 `library_query_state.revision`、scope health、count 和 rows；
-响应返回 `snapshotRevision`、`queryFingerprint`、`nextCursor`；
-下一页再次开启短 read transaction；
- cursor 中 revision/fingerprint 必须与当前 query 和数据库 revision 相同；
- revision 已变化时返回 `library_snapshot_expired`；
- UI 保留当前画面并提供 refresh，不得把新旧页拼接。

该模型不保存历史版本，不保证在写入后继续浏览旧 snapshot，而是 fail closed 防止静默漏项/重复。

### 8.2 Cursor

Cursor 为 backend-issued opaque string，至少绑定：

- contract version；
- query fingerprint；
- snapshot revision；
- sort kind/direction；
-最后一行完整 sort tuple；
- durable file ID tie-break。

要求：

- renderer 不构造 cursor；
- backend 严格解析长度、版本、字段类型和 query binding；
- cursor tamper 只能稳定失败，不得产生任意 SQL；
- relevance cursor 的 floating rank 必须使用可精确 round-trip 的表示；
-pageSize 1–200；
-不得使用 OFFSET 作为 V2 page mechanism；
-第一页和后续页不得重复/遗漏；
-相同 snapshot/query 重放得到相同顺序。

不得新增 encoding 依赖。使用现有 serde/BLAKE3/标准能力实现。

### 8.3 Response

```text
FileQueryResponseV2 {
  version: 2,
  requestId,
  queryFingerprint,
  snapshotRevision,
  files: FileLibrarySummaryDto[],
  totalCount,
  nextCursor?,
  hasMore,
  resultState,
  scopeHealth
}
```

`resultState` 至少区分 complete/partial/empty/failed/snapshot_expired。

`totalCount` 与 rows 来自同一 read snapshot。复杂 count 必须有 query-plan 和性能证据。

---

## 9. Summary、Detail 与 Selection Summary DTO

### 9.1 `FileLibrarySummaryDto`

列表只返回必要字段：

- id；
- name/extension；
- display directory（必要时完整 path 只用于显示，不作为 action authority）；
- size/mtime/ctime；
- isDirectory；
- fileType；
- Purpose/Lifecycle/Risk；
- confidence；
- duplicate/review/stale flags；
-最多固定数量 tag preview + total tag count。

列表不得携带：

- full classification reason；
-完整 matched rules；
-content hash；
-完整 finding evidence；
-operation journal；
-AI trace；
-file content。

### 9.2 `FileLibraryDetailDto`

通过 `fileId` 单独获取：

-完整 metadata/path；
-scan root/session/health projection；
-所有 user tags；
-系统分类和 provenance；
-duplicate group summary；
-active finding summary；
-stale/missing/identity state；
-安全可用 actions；
-必要的 classification reason/matched rules。

要求：

- ID-only；
-latest-request-wins；
-单个 bounded query/少量固定 queries，不得 per-tag/per-finding N+1；
-不读取文件内容；
-数据变化后 detail revision 不匹配时 refetch；
-Inspector 不依赖当前 loaded page 是否仍含该 ID。

### 9.3 Multi-selection summary

`all_matching` 或跨页 explicit selection 的 count/size/type/tag commonality 由 backend summary endpoint 计算。

Renderer 不通过遍历当前 page 推断全 selection summary。

---

## 10. Selection Contract

### 10.1 模型

```text
LibrarySelectionV1 =
  explicit {
    fileIds[]
  }
  | all_matching {
    query: FileQuerySpecV2,
    queryFingerprint,
    snapshotRevision,
    excludedFileIds[]
  }
```

### 10.2 行为

-单击：单项；
-Ctrl/Cmd click：explicit toggle；
-Shift range：只在已加载连续结果中扩展，不偷偷抓取中间所有页；
-Ctrl/Cmd+A：先选择当前 loaded results，并提供明确“选择全部 N 个匹配结果”动作；
-进入 all_matching 后，单项取消进入 exclusions；
-query/scope/filter/sort fingerprint 改变时 selection 清空；
-snapshot expired 时 all_matching 失效，要求用户刷新并重新选择；
-UI 必须显示 `已选择已加载 X` 或 `已选择全部 N，排除 M`，不得混淆；
-explicit IDs 去重、长度上限、backend revalidate；
-不存在/stale/out-of-scope ID 返回 excluded/missing count，不静默当成功。

### 10.3 Bulk metadata mutation

本阶段唯一新增 bulk mutation 是用户标签 metadata：

- add tags；
- remove tags。

不得通过 selection 直接 move/delete/rename/classify/execute suggestion。

执行标签 mutation 时 backend 在一个 write transaction 中：

1. 验证 main window；
2. 验证 selection DTO；
3. 对 all_matching 验证 snapshot revision/fingerprint；
4. authoritative resolve target set；
5. 验证 expected count；
6. set-based/chunked 写入；
7. bump library revision 一次；
8. commit；
9. 返回 applied/already_present/missing/excluded count 和新 revision。

显式 ID 使用 bounded chunks，避免 SQLite variable limit；all_matching 使用 validated query CTE，不把全部 ID 回传 renderer。

首版 bulk tag target 安全上限：100,000。超过时 fail closed，不允许部分提交。

---

## 11. 用户标签

必须完成：

- list tags + usage count；
- create；
- rename；
- change fixed color token；
- delete（带 usage confirmation）；
- assign/remove to explicit selection；
- assign/remove to all_matching selection；
- Inspector 展示/编辑；
- Query V2 allOf/anyOf/noneOf filter；
- Saved View 保存 tag IDs；
- tag deleted 后 Saved View 打开显示 invalid filter，不静默忽略并扩大结果。

系统字段保持独立：

```text
User Tag ≠ Purpose
User Tag ≠ Lifecycle
User Tag ≠ Risk
User Tag ≠ AI classification
User Tag ≠ Rule action
```

用户标签不会触发文件 rename、sidecar write、AI dispatch 或 organize suggestion。

---

## 12. Saved Views

必须完成：

-从当前 canonical query 创建 Saved View；
-命名、重命名、删除；
-稳定排序/拖拽顺序可选，至少支持明确 position；
-打开时恢复 scope、text、filters、sort；
-打开后执行新 snapshot；
-保存/更新使用 expected `updatedAt` 或 revision，拒绝旧 UI 覆盖；
-缺失 root/tag 投影 invalid references；
-浏览器 mock 使用内存安全模拟，但不伪装 native database persistence；
-Saved View list 与 query result store 分离。

内置视图（如 All、Review、Duplicates）可以代码定义，但不得伪装成用户 Saved View 行。

禁止：

-保存 cursor；
-保存 selected IDs；
-保存任意 SQL；
-保存任意 path；
-localStorage 成为 native Saved View truth；
-Saved View 自动触发文件操作或 AI。

---

## 13. File Library UI/State 重构

### 13.1 Store 分层

至少分离以下职责，可使用独立 Zustand stores 或清晰 slices，但不得继续全部塞入一个混合 store：

1. Query state：spec、fingerprint、snapshot revision、request ID、scope health；
2. Result state：pages、cursor、hasMore、total、loading/error；
3. Selection state：explicit/all_matching/exclusions/focus/anchor；
4. Inspector state：selected primary ID、detail、detail request/revision；
5. Tag state：tag catalog/usage/mutation；
6. Saved View state：list/active view/write state。

AI classification/organize queue 现有兼容职责不应被 Query V2 store 意外重构或扩大。

### 13.2 VaultView

-移除 renderer advanced filtering/sorting；
-移除 `collectLibraryPages` 作为生产 truthfulness 策略；
-不再显示“仅对已加载结果排序”；
-所有 filter chip 与 sort 控件驱动 QuerySpec V2；
-分页只使用 next cursor；
-snapshot expired 保留当前画面并显示刷新入口；
-Saved Views 和 tags 有清晰但不过载的入口；
-Location/scope 显示 durable root 名称和 health；
-不增加复杂仪表盘噪音。

### 13.3 虚拟列表与键盘

保留 `@tanstack/react-virtual`，不新增列表依赖。

支持并测试：

- ArrowUp/Down；
- Home/End；
- PageUp/PageDown；
- Shift range；
- Ctrl/Cmd toggle；
- Ctrl/Cmd+A 两阶段选择语义；
- Space/Enter；
- ContextMenu/Shift+F10；
- cursor page append 后 focus 稳定；
-snapshot refresh 后 focus restore；
-ARIA listbox/option/multiselect；
- `aria-activedescendant` 只引用已渲染 row；
-screen reader selection summary；
-reduced motion/high contrast/200% zoom；
-长文件名、CJK、RTL-safe truncation。

### 13.4 Inspector

-单选按 ID fetch detail；
-多选调用 backend selection summary；
-快速移动 selection 时旧 detail response 不覆盖；
-stale/missing 显示明确状态；
-reveal 使用 file ID backend revalidation，不传任意 renderer path；
-preview 仍 metadata-only；
-内容 preview 延至 Task 08；
-标签编辑是 metadata-only。

---

## 14. API、权限和 Browser Mock

新增/调整 Tauri commands 至少包含：

- `query_file_library_v2`；
- `get_file_library_detail`；
- `get_file_library_selection_summary`；
- `reveal_file_library_entry`；
- `list_user_tags`；
- `create_user_tag`；
- `update_user_tag`；
- `delete_user_tag`；
- `mutate_file_user_tags`；
- `list_library_saved_views`；
- `create_library_saved_view`；
- `update_library_saved_view`；
- `delete_library_saved_view`。

要求：

-所有 write command 要求 `main` window；
-query/detail/reveal 也只授权 File Library main window，Search window 不获得 Library bulk/tag/saved-view 权限；
-reveal 只接受 file ID；
-renderer path 不成为 action authority；
-permission matrix 与 capability JSON 同步；
-TypeScript、Rust、browser mock DTO 一致；
-browser mock 不宣称 native persistence 或 filesystem reveal 成功；
-非法 cursor/query/tag/color/saved-view JSON 有稳定错误码；
-不新增 generic invoke/SQL/shell surface。

---

## 15. Index 与 Query Plan

Schema 31 可增加必要 indexes，但不得盲目堆叠。

至少评估：

- active files + mtime + id；
- active files + ctime + id；
- active files + name COLLATE NOCASE + id；
- active files + size + id；
- active files + confidence + id；
- file type/purpose/lifecycle/risk 与 stable sort；
- tag join；
- duplicate/review filter；
- FTS + filters + keyset。

每个新增 index 必须：

-有 EXPLAIN QUERY PLAN 证据；
-有 100k/1M benchmark 对应场景；
-评估 scan/watcher write amplification；
-没有证据的 index 不添加。

不得依靠 `PRAGMA optimize` 掩盖 cold path。

---

## 16. 性能和容量门禁

### 16.1 100k 日常基准

必须覆盖 cold/warm：

-默认 modified page 1/中间 cursor；
-name asc/desc；
-size；
-file type + lifecycle + risk；
-duplicate/review；
-tag all/any/not；
-text FTS + filters；
-total count；
-detail；
-selection summary；
-10k/100k bulk tag（在安全预算内）；
-concurrent watcher reader；
-snapshot expired detection。

建议门限：

-常见 page p95 ≤ 100 ms；
-复杂 indexed filter p95 ≤ 150 ms；
-detail p95 ≤ 50 ms；
-首屏 UI 无 10k row renderer materialization。

### 16.2 1M 上限基准

必须覆盖：

-默认 page；
-name prefix/text；
-tag filter；
-composite filter；
-keyset deep pagination；
-count；
-WAL reader；
-query plan 不使用 OFFSET full scan。

目标：常见 page p95 ≤ 150 ms；若某精确 count 无法满足，必须在不谎报结果的前提下提出 bounded alternative 并停止等待人工批准，不得自行改成估算 count。

### 16.3 Migration

- schema 30→31，100k files；
- schema 30→31，1M files（允许独立 ignored benchmark）；
- migration 时间、WAL reader、文件大小增量；
- failure rollback；
- files.id ON UPDATE CASCADE；
- old binary future-schema guard。

---

## 17. 必须新增的测试

### 17.1 Task 04 遗留

-所有 degraded source completeness；
-ACK 后 session/revision revalidation；
-old navigation 不隐藏新 session；
-extension stable ID tie；
-punctuation correctness；
-mounted IME debounce/invoke count。

### 17.2 Query V2

-DTO version/limits；
-canonicalization/fingerprint；
-root ID scope resolve；
-disabled/missing/degraded roots；
-all filters；
-tag all/any/not；
-all sorts and tie-break；
-first/next cursor；
-no duplicate/no missing；
-replay determinism；
-invalid/tampered cursor；
-query mismatch；
-snapshot revision change；
-FTS injection/CJK/punctuation；
-no Global Index join；
-no OFFSET in V2 page SQL。

### 17.3 Revision

- scanner batch bump once；
-watcher bump；
-stale/reconciliation bump；
-operation/restore bump；
-classification bump；
-duplicate publication bump；
-tag mutation bump；
-Saved View write does not bump file query revision；
-failed transaction does not bump；
-concurrent reader gets old complete snapshot or snapshot_expired, never mixed pages。

### 17.4 Tags

-create/rename/color/delete；
-normalization/case collision/control chars/reserved prefix；
-assign/remove idempotency；
-explicit/all_matching；
-expected count/revision；
-100k cap atomic rejection；
-files.id update cascade；
-tag deletion Saved View invalid reference；
-user tag never modifies Purpose/Lifecycle/Risk/file path/AI job。

### 17.5 Saved Views

-create/update/delete/list/order；
-canonical JSON；
-stale update CAS；
-no cursor/selection persisted；
-root/tag missing；
-invalid SQL/script payload rejection；
-open creates fresh snapshot；
-browser mock parity without fake persistence。

### 17.6 UI

-query/result/selection/inspector store isolation；
-latest request wins；
-old page/detail response reject；
-snapshot expired state；
-no client filter/sort truth；
-two-stage Ctrl/Cmd+A；
-all_matching exclusions；
-query change clears selection；
-multi summary from backend；
-virtual focus/page navigation；
-ARIA；
-Inspector detail fetch；
-ID-only reveal；
-tags/Saved View interactions；
-no content read；
-no Task 06 Organization Plan UI。

### 17.7 Security/contract

-Search window cannot call File Library writes；
-main-window authorization；
-no renderer arbitrary path action；
-no arbitrary SQL/cursor code execution；
-no AGPL transplant；
-no dependency/lockfile change；
-schema exactly 31；
-no files.id migration；
-no journal/Managed AI schema change；
-no second Global Index；
-no file mutation from tags/selection。

---

## 18. 允许修改范围

允许按任务需要修改：

- `src-tauri/src/db/schema.rs`；
- `src-tauri/src/db/types.rs`；
- `src-tauri/src/db/commands.rs`；
- `src-tauri/src/db/queries/files.rs`；
-新增 File Library 专用 repository/query 模块；
- scanner/watcher/operation/classification/dedupe publication 中 revision bump 的最小接入；
- `src-tauri/src/lib.rs`；
- capability/permission；
- `src/types/domain.ts`；
- `src/api/tauriApi.ts`；
- `src/api/browserMockApi.ts`；
- `src/store/useFileLibraryStore.ts` 或新 File Library stores；
- `src/views/vault/**`；
- i18n；
- tests/performance/scripts；
-本任务 Closeout、Index、Risk Register、permission matrix。

禁止借 Task 05 大范围重写：

- Global Index provider/service；
- Managed AI provider/schema；
- Rule AST；
- Analysis/Finding schema；
- Dedupe hashing pipeline；
- operation/cleanup journal schema；
- Safe Trash/restore protocol；
- release/version/tag。

---

## 19. 依赖合同

默认不新增第三方依赖，不修改：

- `package-lock.json`；
- `Cargo.lock`；
- package dependency list；
- Cargo dependency list。

若现有依赖和标准库无法实现 cursor encoding、query builder 或测试，立即停止并提交最小依赖提案，不得自行添加。

不引入 ORM、SQL builder、query parser、tag library、virtual list 或 state management 新依赖。

---

## 20. 建议原子提交

同一个分支和 Draft PR 中建议：

1. `fix(search): close accepted task04 correctness gaps`
2. `db: add schema31 file-library metadata and revision`
3. `library: add canonical query v2 and keyset cursor`
4. `library: split summary detail and selection contracts`
5. `library: add user tag repository and bulk metadata mutation`
6. `library: add durable saved views`
7. `ui: migrate vault to server-authoritative query v2`
8. `ui: add cross-page selection tags views and inspector`
9. `api: align library permissions and browser mock`
10. `test: cover schema query selection tags and performance`
11. `docs: close task05 implementation`

它们只是 review-friendly commit，不是新任务或停点。

---

## 21. 启动验证

开始实施前完整运行：

```bash
npm run typecheck
npm test
npm run test:remediation
npm run test:performance
npm run build
npm run verify:rust
npm run security:audit
npm run security:audit:rust
git diff --check
git status --short
```

若 baseline 失败，区分环境与代码问题。不得删除测试、放宽断言、关闭功能或修改任务书规避。

---

## 22. 完成验证

必须运行：

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

还必须运行：

- Task 04 accepted-debt focused tests；
- schema 30→31 migration/rollback；
- File Query V2 focused tests；
- tag/Saved View/selection tests；
- 100k/1M benchmarks；
- Windows/macOS Rust quality；
- release compile；
- NSIS；
- unsigned DMG；
- Dependency audit；
- permission/scope architecture contracts。

Draft PR 条件导致 package job 跳过时，至少保留本地 Windows NSIS 和 GitHub release compile；在人工验收前需要获得可验证的 Windows/macOS package evidence，或如实记录平台限制。

---

## 23. 停止条件

以下任一情况立即停止并汇报证据：

-需要迁移 `files.id`；
-需要第二套 managed files/FTS truth；
-需要复用 Global Search cursor/snapshot；
-需要长期持有跨 IPC SQLite transaction；
-需要为每个 query 物化全部 snapshot item；
-需要新增第三方依赖或 lockfile；
-需要 schema 32；
-需要修改 operation/cleanup journal schema；
-需要修改 Managed AI provider/schema；
-需要 file content/OCR；
-需要 filename/sidecar tagging；
-需要复制 TagSpaces AGPL 代码或结构；
-无法保证 root scope 不静默扩大；
-无法保证 cursor/revision fail closed；
-无法保证 all_matching selection 真实；
-无法保证 tag mutation atomic；
-无法满足 100k 日常性能且没有可信优化路径；
-发现已有 `remediation/05-file-library` 分支或并行 Task 05 PR。

停止时不得自行拆任务、创建 05A、改变 schema 或重写任务书。

---

## 24. Closeout

创建：

```text
docs/remediation/TASK_05_IMPLEMENTATION_CLOSEOUT.md
```

更新：

- `CODEX_REMEDIATION_INDEX_V1.md`；
- `REMEDIATION_RISK_REGISTER.md`；
- `TASK_04_IMPLEMENTATION_CLOSEOUT.md`；
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`；
-必要的设计/测试说明。

Closeout 必须记录：

1. baseline/final HEAD；
2. Task 04 accepted debt 的逐项关闭；
3. TagSpaces SHA/LICENSE；
4.参考/拒绝项；
5.schema 31 migration/rollback；
6.query revision owner 和全部 bump path；
7.QuerySpec canonical form；
8.snapshot/cursor；
9.summary/detail/selection DTO；
10.tags；
11.Saved Views；
12.scope/root health；
13.UI/store architecture；
14.permissions/mock；
15.tests/query plans/performance；
16.Windows/macOS/package/security；
17.known risks；
18.无依赖/lockfile；
19.Task 06 未开始。

---

## 25. Draft PR

仅创建一个 Draft PR：

```text
feat: rebuild file library query tags and saved views
```

PR 描述必须说明：

-这是完整 Task 05 File Library 模块；
-Task 04 的 4 项接受遗留已先关闭；
-TagSpaces 仅 AGPL 设计级参考；
-schema 30→31；
-无依赖/lockfile；
-File Library Query V2 与 Global Search 严格分离；
-keyset + revision snapshot；
-真实跨页 selection；
-user tags 与系统分类分离；
-durable Saved Views；
-ID-only detail/reveal；
-没有文件系统 mutation；
-没有开始 Task 06。

PR 保持 Draft，不得自动合并。

---

## 26. 最终汇报格式

```text
Task 05 已作为完整文件库产品模块完成并停止，等待人工代码级验收。

Baseline HEAD：
Final HEAD：
分支：remediation/05-file-library
Draft PR：
Schema：30 → 31
TagSpaces reference SHA：

Task 04 接受遗留：
1.
2.
3.
4.

File Library：
- Query V2：
- snapshot/cursor：
- revision owner：
- selection：
- tags：
- Saved Views：
- Inspector：
- scope health：

验证：
- Frontend：
- Rust：
- Remediation：
- Security：
- Migration：
- 100k：
- 1M：
- Windows/macOS：
- NSIS/DMG：

提交列表：
Known risks：
工作树：
依赖/lockfile：
Task 06：未开始
PR：保持 Draft、未合并
```

明确声明：

```text
没有拆分 Task 05。
没有创建第二套 File Library 或 Global Index。
没有把 Global Search cursor 用于 File Library。
没有迁移 files.id。
没有新增文件系统 mutation。
没有复制 TagSpaces AGPL 代码或结构。
没有开始 Task 06 或任何后续模块。
```
