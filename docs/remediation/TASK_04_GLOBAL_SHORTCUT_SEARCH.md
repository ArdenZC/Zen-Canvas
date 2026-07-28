# Task 04 — 全局快捷搜索与命令面整改

## 1. 状态、基线与执行方式

Task 03 已通过 PR #28 合并到 `master`。

Task 04 的生产基线为：

- Task 03 source HEAD：`bed37313930653ecbc43d420ccbc356650ca9e39`
- Task 03 squash merge commit：`70427ff648dd5b9fab66e247fbf0a5ddf8912f45`
- Task 03 已验证 CI run：`30362271784`
- 当前数据库：schema 30
- 当前 Global Index 安全与原生 provider 基线：PR #15 及其后续已合并 hardening

Task 04 是一个完整产品功能模块，对应原对标计划中的：

> 模块 4：全局快捷搜索

本任务：

- 参考 Tolaria 的 keyboard-first Command Palette 与稳定命令面设计；
- 首先关闭 Task 03 接受并后移的 exact reclaimable physical-union 遗留；
- 随后完成 Zen Canvas 全局快捷搜索的后端查询契约、窗口生命周期、全局快捷键、命令清单、状态投影、键盘与无障碍、跨平台行为和性能整改；
- 使用一个实施分支、一个 Draft PR、一次完整验收；
- 不拆分为 04A/04B/04C；
- 不在中间停点重新设计；
- 不开始 Task 05 文件库整改。

建议实施分支：

```text
remediation/04-global-shortcut-search
```

建议 Draft PR 标题：

```text
feat: harden global shortcut search and command surface
```

## 2. 参考项目与许可证边界

### 2.1 参考项目

主要参考：

```text
refactoringhq/tolaria
```

实施开始时必须：

1. 读取 Tolaria 当前 `main` 的 LICENSE；
2. 记录所分析 commit SHA；
3. 重点阅读其 Command Palette、command catalog/manifest、快捷键、菜单命令身份、上下文 availability 和键盘交互；
4. 在 Task 04 Closeout 中登记参考 SHA、许可证和实际借鉴点。

### 2.2 仅允许设计级借鉴

Tolaria 为 AGPL-3.0-or-later。Zen Canvas 不接受其 AGPL 传播义务，因此：

- 禁止复制 Tolaria 源码；
- 禁止逐段翻译或改写；
- 禁止照搬目录结构、类型名称或实现骨架；
- 禁止复制其 manifest JSON、command IDs、快捷键清单、组件结构或 CSS；
- 只能借鉴可独立表达的产品原则和架构思想。

允许借鉴的原则包括：

- keyboard-first；
- 稳定 command ID 与统一 metadata source；
- metadata 与 context-sensitive execution 分离；
- native/renderer/browser QA 之间避免命令身份漂移；
- Command Palette 是受控导航与动作入口，而不是绕过领域安全边界的执行器；
- 大数据量下保持快速、可预测的键盘操作。

### 2.3 明确拒绝的 Tolaria 假设

Zen Canvas 不采用：

- files-first Markdown vault 数据模型；
- Git-first workspace 假设；
- 把文件系统目录当唯一业务真相；
- Tolaria 的具体命令、菜单、vault、note 或 editor 领域结构；
- 任何与 Zen Canvas Global Index、Managed Scope、preview、journal、Safe Trash 和 restore 冲突的实现。

## 3. 当前 Zen Canvas 事实基线

实施前必须重新阅读并以最新源码为准，至少包括：

### Rust / Tauri

- `src-tauri/src/app_control.rs`
- `src-tauri/src/global_index/search.rs`
- `src-tauri/src/global_index/commands.rs`
- `src-tauri/src/global_index/models.rs`
- `src-tauri/src/global_index/repository.rs`
- `src-tauri/src/global_index/coordinator.rs`
- `src-tauri/src/global_index/tests.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/search.json`

### Frontend

- `src/components/CommandModal.tsx`
- `src/components/spotlight/spotlightModel.ts`
- `src/components/spotlight/commandRegistry.ts`
- `src/components/AppShell.tsx`
- `src/api/tauriApi.ts`
- `src/api/browserMockApi.ts`
- `src/views/settings/SettingsView.tsx`
- `src/types/domain.ts`
- `src/styles.css`
- `src/styles/tokens.css`

### Tests与文档

- `tests/searchSpotlight.test.ts`
- `tests/tauriApi.test.ts`
- `tests/appSettings.test.ts`
- `docs/design/SYSTEM_WIDE_SEARCH_AI_INDEX.md`
- `docs/design/SYSTEM_WIDE_SEARCH_HARDENING.md`
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`
- `docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md`

当前已经存在且不得回退的能力：

- Global Search 与 File Library Query 是独立入口；
- Spotlight 不 join managed `files` 表；
- disabled volume 和 stale entry 在 SQL 边界排除；
- 1–2 字符查询使用 bounded prefix 策略；
- 3 字符及以上使用 FTS，并有 bounded compatibility fallback；
- open/reveal 只接受 entry ID，并重新检查 stale 与 source enabled；
- Rust 已创建唯一 label 的独立 search window；
- 全局快捷键注册已有旧快捷键回滚机制；
- standalone search window 已存在 show/hide、resize 和主窗口导航桥接；
- command registry、file results、settings navigation 和 browser mock 已存在；
- Windows/macOS Global Index provider、安全协议、索引服务和安装流程已完成专项 hardening。

这些属于基线，不得以“重构”为名重新建设第二套系统。

## 4. 第一组强制改动：关闭 Task 03 遗留

Task 03 最终接受并后移的遗留必须在 Task 04 的第一组生产提交中完成，不得再次移入 Task 05。

### 4.1 Exact reclaimable physical union

run-level `exact_reclaimable_bytes` 必须表示可回收物理存储 subject 的确定性并集：

> 同一个物理存储 subject 最多贡献一次 exact reclaimable bytes。

必须同时覆盖：

- duplicate group reclaimable member；
- Safe cleanup heuristic exact finding；
- managed file；
- approved path；
- hardlink alias；
- stale/inactive/superseded finding 和 group；
- AI assessment 后 aggregate refresh；
- 数据库 reopen/hydrate；
- 任意 finding 插入顺序和 `HashMap` 迭代顺序。

要求：

1. exact 与 potential 继续是两个不同事实；
2. duplicate exact 必须解析到 authoritative group members 的物理 subject；
3. keeper 不计为 reclaimable；
4. hardlink aliases 不增加 physical copy 或 exact；
5. 同一 member 已被 Safe exact claim 覆盖时不得再次累计；
6. 不相关 Safe physical subject 必须正常相加；
7. potential-only finding 不得吞掉 exact；
8. 所有 aggregate refresh 路径使用同一实现；
9. 禁止使用 `max(duplicate_total, path_total)` 伪装 physical union；
10. 默认不升级 schema，不新增依赖。

如果 schema 30 无法安全表达所需 physical subject，立即停止并提交缺失事实证据，不得自行创建 schema 31。

### 4.2 Task 03 Closeout 修正

更新：

```text
docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md
```

必须区分：

- Task 03 原实施与修订提交；
- source branch final HEAD：`bed37313930653ecbc43d420ccbc356650ca9e39`；
- master squash merge commit：`70427ff648dd5b9fab66e247fbf0a5ddf8912f45`；
- CI run：`30362271784`；
- PR #28 已合并；
- physical-union hardening 在 Task 04 中完成。

## 5. Task 04 总体目标架构

完成后，全局快捷搜索链路应为：

```text
Global shortcut / app command
→ Rust search-window lifecycle owner
→ renderer search session
→ versioned request DTO
→ existing Global Index query authority
→ response with request identity + health/completeness
→ deterministic command/file presentation
→ keyboard selection
→ backend ID revalidation
→ open/reveal or safe navigation
```

所有权必须明确：

- Global Index SQLite/Rust 是文件搜索结果、source status、enabled/stale 和 ranking 的事实 owner；
- Rust/Tauri 是全局快捷键和 search window 生命周期 owner；
- shared command catalog 是稳定 command metadata owner；
- 各领域 adapter 是 command availability 与执行 owner；
- renderer 只管理当前 search session、输入、展示、焦点与选择；
- renderer 不生成文件事实、source health 或 mutation authority。

## 6. Search Window 生命周期

### 6.1 唯一窗口

必须继续使用单一固定 window label，不得：

- 每次快捷键创建新窗口；
- 同时存在两个 search renderer；
- 让 main-window modal 与 standalone window 争夺同一全局 session owner；
- 因热重载或设置变化重复注册监听器。

### 6.2 明确状态机

定义并测试独立窗口状态，语义至少覆盖：

```text
hidden
→ showing
→ visible_collapsed | visible_expanded
→ hiding
→ hidden
```

要求：

- hidden 时快捷键显示并聚焦输入；
- visible 时同一快捷键切换隐藏；
- Escape 隐藏；
- close-request 默认隐藏，不销毁整个窗口；
- 应用退出显式销毁；
- main window navigation 成功后隐藏；
- show/focus/resize 失败必须返回可诊断状态；
- resize 不得由多个 renderer 竞争；
- stale resize 请求不得覆盖当前 session；
- renderer 重载后从 Rust 获取真实窗口/session 状态。

### 6.3 Blur 语义

不能只用无条件 `window.blur → close` 作为全部规则。

必须区分：

- 用户点击其他应用：隐藏；
- 正在打开系统文件、reveal 或主窗口导航：由权威动作完成后隐藏；
- native menu、context menu、IME candidate、辅助技术焦点变化：不得误关；
- blur 与重新 show 的竞态：旧 blur 不得隐藏新 session。

使用 session/revision 或等价机制拒绝迟到 lifecycle action。

## 7. 全局快捷键合同

当前 hotkey rollback 能力必须保留并补强。

要求：

1. Rust 是注册状态 owner；
2. 设置保存与实际注册结果一致；
3. 新快捷键注册失败时恢复旧快捷键；
4. 旧快捷键恢复也失败时 durable/settings 状态不得谎报 registered；
5. 同 accelerator 重复提交幂等；
6. unsupported accelerator 明确拒绝；
7. OS 冲突显示可理解错误；
8. app restart 后重新注册并 hydrate 状态；
9. settings UI 显示 requested、effective 和 error；
10. browser mock 使用相同 DTO，但不得伪装 native registration 成功；
11. 不得注册多个 active global search shortcut；
12. 不得把快捷键注册失败静默降级成另一随机组合。

## 8. Search Request / Response 合同

### 8.1 Latest request wins

当前仅用闭包 `cancelled` 和 query string 比较不足以成为完整请求身份。

新增或升级严格 DTO，至少表达：

```text
requestId
query
limit
可选兼容 cursor/offset
```

响应至少表达：

```text
requestId
normalizedQuery
results
indexStatus
collectionComplete
provider/source health summary
```

要求：

- request ID 在一次 renderer session 内单调且唯一；
- backend 原样回显 request ID；
- renderer 只接受当前 session 的最新 request；
- query 相同但 request 不同也不得被旧结果覆盖；
- hide/reopen 后旧 session 响应无效；
- error、empty、partial 与 successful empty 必须可区分；
- rapid typing 不产生 loading 状态倒退；
- debounce 清理、invoke completion 和 unmount 不得 set stale state；
- 不建设跨重启 durable search job；
- 不把 interactive Spotlight 查询塞进 `scan_runs`、`dedupe_runs`、`analysis_runs` 或 `ai_jobs`。

### 8.2 Interactive top-N 与 File Query V2 分离

Task 04 只整改 Spotlight 的 bounded interactive query。

不得开始 Task 05 File Library Query V2，包括：

- 全库 snapshot pagination；
- 跨页 selection；
- Saved View query AST；
- Library server-side bulk selection；
- 把 Global Search cursor 当 Library snapshot cursor。

如保留 legacy offset，只能作为兼容入口。Spotlight 主路径应使用 bounded top-N，并具有稳定 tie-breaker。

## 9. Global Index 搜索权威与排名

### 9.1 不建设第二套索引

必须继续复用现有：

- `global_entries`；
- `global_entries_fts`；
- `global_volumes`；
- native provider coordinator；
- existing source enabled/stale/status facts。

禁止：

- 扫描 `files` 作为全局搜索 fallback；
- 在 renderer 建立完整文件缓存；
- 新增另一个 FTS 表；
- 在 Spotlight 查询中触发全盘扫描；
- 复制 File Library watcher 数据到 Global Index；
- 修改 Windows MFT/USN service 或 macOS Spotlight/FSEvents provider，除非发现直接阻断且先停止汇报。

### 9.2 排名必须确定

搜索结果排序必须具有完整稳定 tie-breaker，至少包括：

- exact name；
- name prefix；
- extension；
- FTS rank；
- modified time；
- 最终 stable ID。

结果不得依赖 SQLite 未定义的并列顺序。

命令与文件不得共享一个不可解释的混合分数。应使用独立 section 和明确 section order。

### 9.3 短查询与 fallback

保留并验证：

- 1–2 字符 bounded prefix；
- 至少 3 字符的 FTS；
- punctuation-heavy bounded fallback；
- limit clamp；
- injection-safe query construction；
- disabled source/stale entry 始终排除。

禁止恢复每次键入 `%term%` 全表扫描。

## 10. Index Health 与结果可信度

搜索 UI 必须表达真实 index 状态，而不是只在 mount 时读取一次状态。

至少区分：

- ready/complete；
- indexing；
- syncing；
- paused；
- partial/degraded；
- permission required；
- provider unavailable；
- rebuild required；
- no enabled source。

要求：

1. query response 或同 revision snapshot 携带 health/completeness；
2. UI 不得把 partial/degraded 表示为“已搜索全部文件”；
3. partial 状态下结果可展示，但必须有明确来源和覆盖提示；
4. source 被禁用后已显示结果必须失效；
5. status revision gap 时 refetch；
6. source/provider 错误不得仅写日志；
7. 搜索不自动启用 source、不自动重建 index；
8. 用户可导航到已有 Global Index Settings 处理问题。

## 11. Open / Reveal 安全

继续只接受 backend entry ID，禁止 renderer 提交任意 path 执行 open/reveal。

执行前必须重新验证：

- entry 仍存在；
- entry 非 stale；
- source 仍 enabled；
- path 非空；
- live path 仍存在；
- object kind 未发生危险变化；
- 可用时 native identity 与索引记录一致；
- source/provider 没有进入明确不可信状态。

发生变化时：

- fail closed；
- 返回稳定 error code；
- UI 保持搜索窗口或明确提示刷新；
- 触发已有 Global Index reconcile/rebuild signal 时必须走既有 owner；
- 不得由 renderer 直接更新 global entry；
- 不得自动执行 move、delete、cleanup 或 organization。

## 12. Command Catalog 与命令执行边界

### 12.1 稳定 command metadata source

独立设计一个 Zen Canvas 自有的 command metadata source，至少统一：

- stable command ID；
- i18n label key；
- description key；
- keywords；
- group；
- default shortcut hint；
- browser/native availability metadata；
-测试枚举。

禁止复制 Tolaria manifest 内容或结构。

当前 `commandRegistry.ts` 中散落的 command metadata 必须迁入或由统一 catalog 生成，避免：

- command ID 在 UI、测试和 settings 漂移；
- browser mock 与 native 不一致；
-命令搜索与菜单/快捷键文案不一致；
- command 被重命名后历史测试静默失效。

### 12.2 Metadata 与执行分离

统一 catalog 只拥有 metadata。

领域 adapter 继续拥有：

- availability；
- enabled/disabled reason；
- context；
- execute callback；
- navigation target；
-安全 preview requirement。

command catalog 不得保存任意 Rust command 名或任意 path 作为可执行脚本。

### 12.3 Command 不得成为 mutation authority

全局命令面允许：

- 页面导航；
-打开设置 section；
-打开已有 preview/analysis surface；
-触发明确的只读 refresh；
-调用已有受控 Tauri command。

禁止：

- 直接移动/重命名/删除文件；
- 绕过 Organization Preview；
- 绕过 operation/cleanup journal；
- 绕过 Safe Trash/restore；
- renderer 通过 command ID 拼接任意 Tauri invoke；
- dynamic SQL、shell、script 或模型生成命令；
- 把 finding/AI suggestion 自动执行。

## 13. 结果信息架构与展示

### 13.1 分组

至少分离：

- folders；
- files；
- app actions；
- settings；
- history/recent（仅在有真实权威数据时）。

要求：

- section order 固定；
-每个 item stable key；
- active item 跨 section 正确移动；
- section 为空时不渲染空 header；
- command exact match 可提高 command section 内部优先级，但不得吞掉文件结果；
- hidden/system/managed/source provider 等 metadata 只展示真实事实。

### 13.2 Idle / Recent

standalone Search 不得依赖 main window 当前只加载的一页 `libraryFiles` 来声称“最近文件”。

二选一：

- 建立只读、bounded、server-authoritative recent API；
- 若当前 durable facts 不足，则删除不真实 recent-files section，仅保留真实 command/history。

禁止为了 recent 功能读取全库到 renderer 或新增历史追踪 schema。

### 13.3 状态

UI 必须分别表现：

- idle；
- debounce/pending；
- results；
- successful empty；
- query failed；
- partial/degraded results；
- index unavailable；
- stale result action rejected。

不得使用同一个“没有结果”视图掩盖 failed 或 partial。

## 14. 键盘、IME 与无障碍

全局搜索必须是 keyboard-first，但不能牺牲辅助技术。

至少支持并测试：

- ArrowUp / ArrowDown；
- Home / End；
- PageUp / PageDown；
- Enter 主动作；
-平台约定的辅助动作；
- Escape；
- Tab/Shift+Tab 的明确策略；
-鼠标 hover/click；
-输入变化后 active index clamp；
- section 变化后 selection 保持可解释；
- active row 自动滚动可见；
-窗口 show 后输入获得焦点；
-窗口隐藏后不保留幽灵焦点；
- `aria-expanded`、`aria-controls`、`aria-activedescendant`；
- listbox/option 或语义等价结构；
- screen reader 可获得 item 名称、类型、路径和 action；
- `prefers-reduced-motion`；
-高对比度与 focus ring；
-缩放和长路径截断。

IME 要求：

- composition 中 Enter 不执行；
- composition 中 Arrow keys 不错误移动结果；
- compositionend 后才发起最终查询；
-中文、日文、韩文输入有回归测试。

若结果列表继续保持最大 80 项，可以使用现有滚动列表；若采用虚拟化，必须使用仓库现有依赖并证明 active descendant、scroll-to-index 和动态行高正确。不得新增列表依赖。

## 15. Main Window Modal 与 Standalone Window

当前同一 `CommandModal` 同时承担 main-window modal 和 standalone Search。

整改后必须：

-共享纯 model、catalog、query controller 和 item components；
-不共享互相冲突的 window lifecycle side effect；
-standalone 由 Rust window owner 管理 show/hide/resize；
-main modal 由 React modal owner 管理 focus restore；
-两者不得同时消费同一 global shortcut；
-两者的 command/result semantics 一致；
-browser mode 能渲染 main modal，不伪造 standalone native window；
-standalone 导航到 main window 后，主窗口先 ready/focused，再投递 navigation；
-迟到 navigation 不得覆盖用户随后在 main window 的新选择。

## 16. API、权限、事件与 Mock

更新并保持一致：

- Rust command registration；
- `src-tauri/capabilities/search.json`；
- `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`；
- `src/api/tauriApi.ts`；
- `src/api/browserMockApi.ts`；
- TypeScript domain DTO；
- contract tests。

任何新增事件必须：

-有稳定名称；
-包含 session/request/revision identity；
-只是 backend truth 的 projection；
-支持 unlisten；
-拒绝旧 session；
-不得由 renderer 推断 durable backend terminal 状态。

生产 Search window 只能调用明确 allowlist 的 search/read/navigation command。

改变 source、重建 index、修改 settings 等管理命令继续要求 main-window authorization，不得因 Search window 而放宽。

## 17. 性能与资源边界

### 17.1 数据规模

必须覆盖：

- 100k global entries；
-条件允许时 1M synthetic global entries；
- 1–2 字符短查询；
- 3+ 字符 FTS；
- punctuation fallback；
- 30 次 rapid query burst；
- 80 results render/navigation；
- indexing concurrent reader；
- source disable concurrent query。

### 17.2 性能原则

- 每次 query bounded；
-不在 renderer 排序全库；
-不在 search 时持 SQLite write transaction；
-不因 status 查询对每个 result 发 N+1 请求；
-不因 icon/metadata 对每行同步访问磁盘；
-窗口 hidden 时停止无意义 query；
- query state cleanup 不泄漏 timer/listener；
- source status refresh 有界。

记录：

- cold/warm SQL time；
- query-to-response；
- warm window show-to-focus；
- rapid burst 最终响应；
- WAL reader latency；
- main window 与 search window memory delta。

默认不得放宽仓库现有 search 性能阈值。

## 18. 测试合同

### 18.1 Task 03 遗留

- duplicate exact + 同 member Safe exact，只计一次；
- duplicate exact + 不相关 Safe exact，正常相加；
- hardlink alias 不增加 exact；
- keeper 不计；
- potential-only overlap 不吞 exact；
- insertion order determinism；
- repeated refresh；
- AI aggregate refresh；
- stale/inactive group/finding；
- DB reopen hydrate。

### 18.2 Rust / Global Search

- deterministic ranking tie-break；
- disabled volume 不返回；
- stale entry 不返回；
- short query bounded；
- punctuation fallback bounded；
- request ID echo；
- partial/degraded status projection；
- source disable during query；
- open/reveal stale、disabled、missing、identity changed；
- arbitrary path cannot be submitted；
- hotkey same-value idempotency；
- new registration failure restores old；
- restore failure reports no active shortcut；
- unsupported accelerator；
- one search window；
- show/hide/toggle state；
- old blur/resize/session rejected；
- main navigation waits for focus/ready。

### 18.3 Frontend

- latest request wins，即使 query 文本相同；
- hide/reopen invalidates old response；
- pending/done/failed/empty/partial 不混淆；
- index status updates after mount；
- command/file sections deterministic；
- command metadata single source；
- command availability disabled reason；
- recent section 不依赖当前 library page；
- active index clamp；
- keyboard across sections；
- Page/Home/End；
- mouse/keyboard selection consistency；
- IME composition；
- ARIA attributes；
- focus restore；
- reduced motion；
- standalone/main behavior parity；
- browser mock parity；
- stale open error keeps UI recoverable。

### 18.4 Security / Contract

- Search window permissions 为最小 allowlist；
- main-only administration command 不能从 Search window 调用；
- command ID 不能映射任意 invoke；
-没有新的 filesystem mutation path；
-没有第二套 Global Index；
-没有 Global Search → File Library/Managed AI scope widening；
-没有 AGPL 代码或结构移植；
-没有新增 dependency/lockfile 变化。

### 18.5 性能 / 平台

- 100k benchmark；
-可行时 1M benchmark；
-rapid query burst；
-concurrent indexing reader；
-Windows shortcut/window/open/reveal；
-macOS shortcut/window/open/reveal；
-Windows NSIS；
-macOS unsigned package；
-Dependency audit。

## 19. Schema、依赖和兼容策略

默认合同：

- schema 保持 30；
-不新增数据库表；
-不新增第三方依赖；
-不修改 `package-lock.json`；
-不修改 `Cargo.lock`；
-保留现有 global search command 的兼容 adapter，迁移到新 DTO 后标注 deprecated；
-不形成永久双轨；
- browser mock 与 native 使用同一 public DTO。

如确实需要 schema 31 或新依赖，立即停止并提交：

-缺失事实；
-为什么现有 schema/标准库不能完成；
-最小变更；
-迁移/rollback 和许可证影响。

未经人工批准不得继续。

## 20. 严格禁止

Task 04 禁止：

- 建设第二套 Global Index；
-修改 Windows MFT/USN service；
-修改 macOS Spotlight/FSEvents provider；
-把 File Library `files` 表作为全局搜索 authority；
-开始 File Query V2、跨页 selection 或 Saved Views；
-开始文件库 Tag/Inspector 整改；
-开始 Organization Plan 或 AI 整理预览整改；
-开始自然语言规则；
-开始 Content Artifact/本地内容理解；
-迁移 `files.id`；
-泛化 `ai_jobs`；
-修改 operation/cleanup journal schema；
-弱化 Safe Trash/restore；
-新增文件 mutation command；
-自动执行 command/finding/AI suggestion；
-动态脚本、shell、SQL、模型工具；
-复制或改写 Tolaria AGPL 代码；
-新增依赖或修改 lockfile；
-修改版本号、installer 配置、tag 或 release；
-拆分 Task 04；
-创建多个生产 PR；
-开始 Task 05。

## 21. 建议原子提交

同一实施分支和 Draft PR 内建议：

1. `analysis: close exact reclaimable physical-union debt`
2. `search: add versioned request and health response contract`
3. `search: harden deterministic ranking and result revalidation`
4. `app: make Rust own search-window and shortcut lifecycle`
5. `commands: centralize stable spotlight command metadata`
6. `ui: rebuild keyboard-first search session projection`
7. `api: align permissions events and browser mock`
8. `test: cover search lifecycle accessibility and performance`
9. `docs: close Task 04 implementation`

这些只是一个完整 Task 04 内的提交，不是独立任务或停点。

## 22. 验证门禁

开始前记录基线：

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

完成后运行：

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

并执行 Task 04 全部 focused、100k/1M、window/hotkey、permission、accessibility、IME、Windows/macOS 专项验证。

平台能力无法在本机验证时：

- 如实记录；
-不伪造结果；
-不修改生产代码规避；
-等待 GitHub Windows/macOS CI。

## 23. Closeout 与交付

创建：

```text
docs/remediation/TASK_04_IMPLEMENTATION_CLOSEOUT.md
```

更新：

```text
docs/remediation/CODEX_REMEDIATION_INDEX_V1.md
docs/remediation/REMEDIATION_RISK_REGISTER.md
docs/remediation/TASK_03_IMPLEMENTATION_CLOSEOUT.md
docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md
```

Closeout 必须记录：

- baseline/final HEAD；
- Tolaria reference SHA 与 AGPL 设计级边界；
- Task 03 exact union 遗留关闭；
- schema 30 / no-dependency 结论；
- search request/response contract；
- ranking 和 health semantics；
- window lifecycle；
- hotkey rollback；
- command catalog；
- open/reveal revalidation；
- keyboard/IME/a11y；
- API/permission/mock；
- tests/performance；
- Windows/macOS CI 和 package；
- known risks；
- Task 05 未开始。

完成后：

1. 推送 `remediation/04-global-shortcut-search`；
2. 创建唯一 Draft PR；
3. 等待 Windows、macOS、Dependency audit 全绿；
4. 停止等待人工代码级验收；
5. 不自动合并；
6. 不开始 Task 05。

## 24. 停止条件

出现以下任一情况立即停止：

- 需要建设第二套 Global Index；
-需要修改 native provider/service 才能继续；
-需要 join File Library `files` 才能完成 Global Search；
-需要迁移 `files.id`；
-需要修改 Managed AI schema/provider；
-需要修改 operation/cleanup journal schema；
-需要增加 filesystem mutation；
-需要动态 command/script/SQL；
-需要复制 AGPL 代码；
-需要新增依赖/lockfile；
-需要 schema 31；
-无法保证 disabled/stale source fail closed；
-无法保证 latest-request-wins；
-无法保证 Search window 唯一 owner；
-无法保证 main-only permission 不被 Search window 绕过；
-发现当前 master 已存在另一个 Task 04 实施分支或 PR。

停止时只汇报证据，不自行修改任务书或扩大范围。

## 25. 最终验收标准

Task 04 只有在以下全部成立时才完成：

- Task 03 exact physical union 遗留关闭；
- Global Index 继续是唯一全局文件搜索 authority；
- Spotlight latest-request-wins；
- health/completeness 不再静态或虚假；
- ranking 稳定；
- open/reveal backend revalidation；
- Rust 独占 window/hotkey lifecycle；
- command metadata 单一来源；
- command execution 不越过安全边界；
- keyboard、IME、a11y 完整；
- standalone/main/browser contract 一致；
- schema 仍为 30；
-无新依赖；
-完整测试、性能、安全、构建和跨平台 CI 通过；
-只有一个 Draft PR；
-Task 05 未开始。
