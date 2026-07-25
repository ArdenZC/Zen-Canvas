# Zen Canvas UI/UX V4.2 Precision & Clarity 设计规范

> 状态：正式执行基线  
> 版本：V4.2  
> 适用范围：React / TypeScript / Tailwind CSS / Tauri 桌面应用  
> 支持平台：Windows、macOS  
> 支持模式：Light、Dark、中文、英文  
> 目标：在保留 V4 视觉基础和安全边界的前提下，修正核心信息架构与整理工作流，并完成全局 UI/UX 精密打磨、体验减法、组件统一和跨平台收口。
>
> 产品流程事实来源：`docs/design/UI_UX_V4_2_PRODUCT_FLOW.md`。当本文件与产品流程文档存在冲突时，以产品流程文档为准。

---

## 1. 产品体验目标

Zen Canvas 是一个本地优先的个人数字空间管理工具，而不是传统文件管理器、工程控制台或 SaaS 仪表盘。

用户进入应用后，只需要快速理解：

1. 当前文件空间有什么值得注意；
2. 哪些项目需要自己决定；
3. Zen Canvas 接下来可以安全地做什么；
4. 已执行的操作是否可以恢复。

最终体验必须传达：

> 安静、有序、本地优先。复杂能力留在背后，用户只看到清楚的判断和下一步。

### 1.1 V4.2 成功标准

- 一级主导航固定展示 5 个核心用户任务：概览、文件库、整理文件、空间清理、历史记录；
- 每个页面状态最多只有 1 个视觉主操作；
- 普通页面不直接展示 Batch、Concurrency、Token、JSON、内部阶段名、内部枚举；
- 扫描、整理、清理、恢复均具备开始、进行、完成、失败、取消和部分成功状态；
- 所有文件变更必须先预览；
- 危险操作必须说明影响范围、可恢复性和冲突处理；
- 不使用浏览器原生 `confirm`；
- Light、Dark、Windows、macOS 均为完整体验；
- 980×680 最小窗口仍可完整操作；
- 中文、英文、长文件名、长路径不造成布局破坏；
- 200% 文本缩放不遮挡主要操作；
- 所有核心流程可仅使用键盘完成；
- 视觉必须具有 Zen Canvas 自身识别度，而不只是“苹果蓝 + 毛玻璃”。

---

## 2. 本阶段边界

### 2.1 保留

- 当前 V4 视觉系统、Spotlight、文件库、Preview、Safe Trash 和 History Restore 基础；
- Spotlight 作为全局效率中枢；
- 文件库列表 + Inspector 架构；
- 整理文件按方案审查、例外决策、最终预览、后执行的安全链；
- Safe Trash 与 History Restore；
- 当前 Zustand、Tauri API 和业务状态架构；
- Light / Dark；
- 中文 / 英文；
- Windows / macOS 双平台支持。

### 2.2 不做

- 不增加 OCR、文件转换等新产品功能；
- 不改变 Rust 文件操作安全边界；
- 第一阶段尽量不修改 Rust 数据格式和 API 合约；前端领域模型、Store 和组件结构允许为新工作流重构；
- 不进行新一轮推翻式视觉重构；
- 不大面积增加毛玻璃、发光和渐变；
- 不把所有区域都改成卡片；
- 不以隐藏功能解决布局问题；
- 不以降低可读性换取“更紧凑”；
- 不在单个 PR 中重构所有页面。

---

## 2A. 最新 Master 兼容基线

所有 V4.2 整改必须建立在最新 `master` 上，并完整保留：

- AI Provider Registry；
- Provider Capability Metadata；
- AI Model Discovery；
- Test Connection；
- AI Request Trace 与 Request Diagnostics；
- Trace 导出与清空；
- 部分 AI 分类结果保留；
- 文件名规范化；
- 索引扩展名保护；
- Organize 与 Preview 中的扩展名不匹配拦截。

### 2A.1 不得回退

- 不得用旧版 Settings 快照覆盖 Provider Registry 或模型发现；
- 不得删除 Request Trace API；
- 不得在 React 中重新实现低质量扩展名解析；
- 不得绕过现有文件名规范化工具；
- 不得因部分 AI 失败而清空已经成功的分类结果；
- 不得让扩展名不安全的建议进入 Ready 或默认选择；
- 不得用 UI 重构改变 Rust 文件操作安全边界。

### 2A.2 Settings 层级

普通 AI 设置可以展示：

- AI 模式；
- Provider；
- Model；
- Credential；
- Test Connection；
- Save。

高级设置可以展示：

- Base URL；
- Chat Path；
- Batch Size；
- Concurrency；
- Timeout；
- Max Tokens；
- Thinking；
- JSON Output。

Developer Mode 可以展示：

- Request Trace；
- Provider / Model；
- Duration；
- HTTP Status；
- Token Usage；
- Parse Stage；
- Warning / Failure；
- Export Diagnostics；
- Clear Diagnostics。

请求诊断不得占据普通 AI 设置首屏。

---

## 3. 核心设计原则

### 3.1 单一主路径

每个页面状态最多只能存在一个视觉主按钮。

允许存在多个操作，但其层级必须明确：

- Primary：当前最推荐的下一步；
- Secondary：可选操作；
- Ghost：返回、取消、低频工具；
- Overflow：重新加载、重新分析、批量模式、调试等低频操作；
- Disclosure：技术详情、高级参数和次级说明。

### 3.2 渐进式披露

默认界面只显示当前决策需要的信息。

高级内容只能通过以下方式出现：

- Inspector；
- Popover；
- Context Menu；
- Disclosure；
- Sheet；
- Developer Mode；
- “查看详情”。

### 3.3 安全优先，但不信息轰炸

安全性通过以下方式表达：

- 明确说明“会发生什么”；
- 明确说明“不会发生什么”；
- 明确说明“是否可以恢复”；
- 对冲突和不可执行项进行行内解释；
- 执行前显示摘要；
- 详细技术信息按需展开。

不得通过同屏堆叠多条 Banner、七八个统计和大量工程术语来表达安全。

### 3.4 统一而非机械一致

统一的是：

- 组件 API；
- 视觉层级；
- 交互状态；
- 间距；
- 圆角；
- 字体；
- Focus；
- 文案逻辑。

不要求所有页面都使用同样数量的卡片、按钮或表面。


### 3.5 方案优先与例外优先

整理文件默认展示整理方案组，而不是逐文件审批列表。

- Ready 项按目标文件夹和操作分组；
- 高置信度、安全、无冲突项目可默认加入本次预览；
- 用户主要处理“需要我决定”的少量例外；
- 单文件明细只在展开组或处理例外时出现；
- 分组不改变最终逐文件 Preview 和冲突校验。

### 3.6 系统状态与用户决定分离

系统准备状态只允许：

- 已准备好；
- 需要用户决定；
- 暂时无法处理。

用户决定只允许表达：

- 包含在本次整理；
- 排除本次；
- 修改方案；
- 保留原位；
- 稍后处理。

“需要复核”不得同时作为系统状态和用户决定。

### 3.7 核心功能必须可发现

核心用户任务不得仅依赖概览状态偶然暴露。

空间清理必须拥有：

- 固定主导航入口；
- 概览入口；
- Spotlight 命令入口。

---

## 4. 设计 Token

所有新 UI 必须使用语义 Token。

禁止在业务组件中新增：

- `slate-*`
- `gray-*`
- `blue-*`
- `red-*`
- `green-*`
- 临时十六进制颜色
- 随机圆角
- 随机阴影
- 随机高度

### 4.1 色彩角色

必须至少保留以下语义：

```css
--zc-canvas;
--zc-canvas-elevated;

--zc-surface;
--zc-surface-subtle;
--zc-surface-hover;
--zc-surface-selected;
--zc-surface-floating;

--zc-text-primary;
--zc-text-secondary;
--zc-text-tertiary;
--zc-text-disabled;

--zc-divider;
--zc-border;
--zc-border-strong;

--zc-primary;
--zc-primary-hover;
--zc-primary-pressed;
--zc-primary-soft;
--zc-primary-text;

--zc-success;
--zc-success-soft;
--zc-success-text;
--zc-warning;
--zc-warning-soft;
--zc-warning-text;
--zc-danger;
--zc-danger-soft;
--zc-danger-text;
--zc-info;
--zc-info-soft;
--zc-info-text;

--zc-focus-ring;
--zc-focus-ring-soft;
--zc-overlay;
```

### 4.2 材质层级

只允许四种主要材质：

1. **Canvas**  
   应用底层背景，无阴影。

2. **Content**  
   主要工作区、列表、普通设置内容。无明显阴影。

3. **Raised**  
   Inspector、局部工具区、Sticky Action Bar。只使用轻阴影。

4. **Floating**  
   Dialog、Popover、Context Menu、Spotlight。允许 Blur 和明显阴影。

### 4.3 毛玻璃使用范围

仅允许用于：

- 侧边栏；
- 标题栏；
- Spotlight；
- Dialog；
- Popover；
- Context Menu；
- 浮动操作条。

禁止用于：

- 文件列表；
- 表格；
- 普通内容卡片；
- 设置行；
- History 列表；
- Automation 列表。

---

## 5. 尺寸与密度

V4.2 正式建立两套控件密度：

```ts
type Density = "default" | "compact";
```

禁止在业务组件中临时组合 `min-h-8`、`min-h-9`、`min-h-10` 制造随机密度。

### 5.1 控件尺寸

| 元素 | Default | Compact | 使用场景 |
|---|---:|---:|---|
| Button | 40px | 34–36px | 页面操作 / 工具栏 |
| Icon Button | 36px | 32px | Inspector / 行内 |
| Input | 40px | 36px | 表单 / 工具栏 |
| Select | 40px | 36px | 表单 / 工具栏 |
| Segmented Track | 36px | 34px | 模式选择 |
| Filter Chip | 28px | 28px | 已应用筛选 |
| Badge | 22–24px | 22px | 状态 |
| File Library Row | 52px | 不适用 | 高密度文件库 |
| 普通工作区列表行 | 48px | 44px | History / Automation |
| Settings Row | 最低 56px | 不适用 | 根据说明自然扩展 |
| Windows Window Control | 44×48px | 不适用 | 标题栏 |

### 5.2 点击区域

- 所有主要交互点击区域不得小于 32×32px；
- macOS 交通灯可视圆点可为 12px，但点击区域不得小于 24×24px；
- Input 内部 Eye / Clear Button 为 28×28px；
- 小图标不得单独承担低于 32px 的点击目标。

---

## 6. 圆角系统

新增并统一使用：

```css
--zc-radius-micro: 6px;
--zc-radius-row: 8px;
--zc-radius-control: 10px;
--zc-radius-field: 12px;
--zc-radius-panel: 16px;
--zc-radius-floating: 20px;
--zc-radius-window: 24px;
```

### 6.1 使用规则

| 元素 | 圆角 |
|---|---:|
| 输入框内部按钮 | 6px |
| 普通列表行 | 8px |
| Button / Nav Item | 10px |
| Input / Field | 12px |
| Panel | 16px |
| Dialog / Popover | 20px |
| App Window | 24px |
| Search / Status Pill | 完整胶囊 |

### 6.2 禁止事项

- 普通列表行不得使用 Panel Radius；
- 同屏完整圆角面板尽量不超过 4 个；
- 禁止卡片套卡片套卡片；
- 胶囊仅用于搜索、状态和少量紧凑控制；
- 不得为每个列表行增加独立阴影。

---

## 7. 间距系统

基础单位为 4px：

```css
--zc-space-1: 4px;
--zc-space-2: 8px;
--zc-space-3: 12px;
--zc-space-4: 16px;
--zc-space-5: 20px;
--zc-space-6: 24px;
--zc-space-8: 32px;
--zc-space-10: 40px;
--zc-space-12: 48px;
```

### 7.1 页面间距

- 标准页面外边距：20px；
- 窄窗口页面外边距：12–16px；
- Page Header 与首个内容区：16px；
- 同级 Section：20–24px；
- Panel 内边距：16px；
- 紧凑工具栏内边距：8–12px；
- 列表行左右内边距：12px；
- 列表主次文字间距：2–4px。

---

## 8. 字体系统

字体栈：

```css
font-family:
  Inter,
  ui-sans-serif,
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "PingFang SC",
  "Microsoft YaHei",
  "Segoe UI",
  sans-serif;
```

### 8.1 字号与字重

| 用途 | 字号 | 字重 | 行高 |
|---|---:|---:|---:|
| 页面标题 | 28px | 600 | 1.25 |
| 窄屏页面标题 | 24px | 600 | 1.25 |
| 区域标题 | 18px | 600 | 1.35 |
| 卡片主标题 | 15px | 600 | 1.4 |
| 列表主标题 | 14px | 500/600 | 1.4 |
| 正文 | 13–14px | 400 | 1.6 |
| 次级说明 | 12–13px | 400 | 1.5 |
| 表头 / 标签 | 11–12px | 500/600 | 1.4 |

### 8.2 原则

- 中文正文不得低于 13px；
- 不大量使用全大写和高字距；
- 路径、时间、文件大小保持可读对比度；
- `font-semibold` 只用于标题、关键数字和选中项；
- 同一页面不应同时出现过多字重；
- 数字摘要使用 `tabular-nums`。

---

## 9. 阴影与动效

### 9.1 阴影

```css
--zc-shadow-raised: 0 8px 24px rgba(...);
--zc-shadow-floating: 0 20px 56px rgba(...);
--zc-shadow-spotlight: 0 28px 80px rgba(...);
```

规则：

- Content 不使用明显阴影；
- Raised 使用轻阴影；
- Floating 使用明显阴影；
- 普通列表行不使用阴影；
- Segmented Thumb 仅允许极轻微 Shadow。

### 9.2 动效时长

| 动效 | 时长 |
|---|---:|
| Hover / Press | 120ms |
| 颜色 / 选中切换 | 160–180ms |
| Popover / Dialog | 180ms |
| Inspector 切换 | 200–240ms |
| 页面状态切换 | 240ms |
| 品牌状态动效 | 600–1200ms |

### 9.3 动效原则

- 列表行不使用 Scale；
- Hover 不发生明显位移；
- 普通内容不使用 Blur 动画；
- Reduced Motion 下关闭位移动画；
- Zen Canvas 的动效应安静、准确，不强调活泼和弹跳。

---

## 10. 共享组件规范

## 10.1 Button

保留以下语义：

```ts
type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "warning"
  | "link";

type ButtonDensity = "default" | "compact";
```

### Primary

- 每个页面状态最多一个；
- Loading 时保持宽度稳定；
- 不用于筛选、模式选择和普通导航；
- 不与另一主色按钮并排竞争。

### Secondary

- 普通操作；
- 工具栏默认使用 Compact；
- 不允许比 Primary 更醒目。

### Ghost

- 返回、取消、低频工具；
- 默认无边框；
- Hover 才显示背景。

### Danger

- Soft Danger 用于进入危险流程；
- 实心 Danger 只用于最终不可逆确认；
- Safe Trash 不是不可逆删除，可使用 Primary，但必须说明可恢复。

### Disabled

- 不得只降低透明度；
- 非显而易见的禁用状态必须提供原因；
- 初始状态不应展示整组禁用控件。

---

## 10.2 IconButton

- Default 36×36px；
- Compact 32×32px；
- 内部图标 15–17px；
- 必须有 `aria-label`；
- Tooltip 不能作为唯一可访问名称；
- Danger IconButton 只在 Hover 或明确上下文中出现。

---

## 10.3 Input / Search / Select

### Input

- Default 40px；
- Compact 36px；
- 左右 Padding 12px；
- Placeholder 不代替 Label；
- Error 在字段下方显示；
- 保存失败不能只通过 Toast 表达。

### Search

- 左侧 Search Icon；
- 有内容时显示 28px Clear Button；
- 清空后恢复焦点；
- `Escape` 第一次清空、第二次关闭；
- 文件库搜索必须标明“搜索当前范围”。

### Select

- 菜单宽度不得小于触发器；
- 选中项显示 Check；
- 不只依赖背景色；
- 菜单必须限制在窗口可视范围内。

---

## 10.4 Segmented Control

Track：

- Subtle Background；
- 1px Inset Ring；
- Padding 4px；
- 圆角 10px。

Thumb：

- Surface Background；
- 1px 微弱 Ring；
- 极轻 Shadow；
- 圆角 7px；
- 不使用整块高饱和蓝色填充。

规则：

- Active Text 使用 Primary Text；
- Focus 由外层 Focus Ring 表达；
- 超过 4 项改用 Select；
- 窄窗口优先垂直布局，不允许随机难看的双行换行；
- 使用 `aria-pressed` 或 Radio 语义。

---

## 10.5 Switch

- 44×24px；
- Thumb 18px；
- 内距 3px；
- 开启态使用 Primary；
- 关闭态使用 Control Border；
- Disabled 仍可识别当前值；
- Label 和控件均可点击；
- 保留 `role="switch"` 与 `aria-checked`。

---

## 10.6 Chips 与 Badges

### Filter Chip

- 高度 28px；
- Row Radius 8px；
- Remove Icon 14px；
- 整个移除区域可点击；
- Focus 状态清晰。

### Status Badge

- 可使用胶囊；
- 同一对象只保留一个主要状态 Badge；
- 风险同时使用文字或图标；
- 不同时堆叠多个意思重叠的 Badge。

---

## 10.7 Surface

收敛为：

```tsx
<Surface level="content" />
<Surface level="raised" />
<Surface level="floating" />
```

旧的 `glassPanel`、`appPanel`、`softPanel`、`contentPanel` 等命名只允许在迁移阶段短期兼容，最终必须删除或映射到明确 Level。

---

## 10.8 List Row

统一结构：

```text
[可选选择控件] [图标] [主信息 / 次级信息] [状态] [辅助操作]
```

状态：

- Hover：轻背景；
- Selected：Selected Surface；
- Focused：2px Focus Ring；
- Selected + Focused：同时存在但不形成多层描边；
- Missing：警告图标 + 文案；
- Disabled：不可点击并提供原因；
- 不在普通 Hover 中直接使用危险红色背景。

---

## 10.9 Inspector

宽度：

- 标准：360px；
- 最大：400px；
- 小于断点时切换为列表 / 详情模式；
- 不压缩到难以阅读的窄栏。

结构：

1. Sticky Header；
2. 主对象信息；
3. 核心属性；
4. 可折叠高级信息；
5. Sticky Footer Action。

规则：

- 不重复列表中已经完整展示的内容；
- 多选时显示多选摘要；
- 无选择时显示轻量空状态；
- 主要操作不能同时存在于 Inspector 和底部操作栏。

---

## 10.10 Metric

普通页面优先使用 `MetricStrip`，避免 SaaS 式四卡片仪表盘。

Metric Card 仅用于真正需要比较的数据，例如 Cleanup 空间摘要。

规则：

- Tone 通过图标、顶部细线或文字表达；
- 不使用整张高饱和状态背景；
- 组件 API 中的 `tone` 必须真正生效，否则删除该属性。

---

## 10.11 Notice Banner

- 同一页面顶部最多一条常驻 Notice；
- 多条安全信息合并；
- 详细信息放入 Disclosure；
- Info 不应长期显示大面积蓝色块；
- Warning 只用于需要用户行动的情况；
- Error 保持到问题解决或关闭；
- Banner 中最多一个操作。

---

## 10.12 Toast

- Success：约 2.2 秒；
- Info：约 3.2 秒；
- Error：更长或手动关闭；
- 同时只显示一个；
- 页面已有 Inline Error 时不重复；
- 文件操作成功可提供“查看历史”；
- 不遮挡 Sticky Action Bar；
- 正确使用 `role=status` / `role=alert`。

---

## 10.13 Empty / Loading / Error State

每个核心页面必须覆盖：

- 首次空状态；
- 搜索无结果；
- 筛选无结果；
- 加载中；
- 加载失败；
- 权限失败；
- 数据过期；
- 部分成功；
- 完成状态。

### Empty State

- 一个标题；
- 一句说明；
- 一个主要操作；
- 最多一个次级操作；
- 不显示禁用控件组；
- 可以使用轻量 Brand Mark。

### Loading

- 首次加载使用 Skeleton；
- 后台刷新保留当前内容；
- 列表加载更多使用行内 Loading；
- 不使用大面积纯文字 “Loading...”。

---

## 10.14 Dialog

### Confirm Dialog

- 最大宽度 440px；
- 顺序固定：Title → Description → Emphasis → Error → Actions；
- 危险确认默认焦点放 Cancel；
- 普通确认可放 Primary；
- Processing 时阻止 Escape 和重复提交；
- 按钮宽度稳定；
- 关闭后恢复触发元素焦点。

### 编辑 Dialog

- 最大宽度 640–720px；
- Header / Footer 固定；
- 中间内容独立滚动；
- 字段错误显示在 Dialog 内；
- 不使用全局 Toast 替代字段错误。

---

## 10.15 Popover / Context Menu

- 菜单项高度 36px；
- 图标 16px；
- 分组间 Divider；
- 危险操作放最后；
- 当前选中项显示 Check；
- `Escape` 关闭并恢复焦点；
- 点击外部关闭；
- 菜单位置限制在窗口内；
- 简单菜单不使用 Dialog 样式。

---

## 10.16 File Type Icon

- Micro：16px；
- List：18px；
- Inspector：24px；
- Preview：32px；
- Spotlight、Library、Suggestions 使用同一映射；
- 风险通过独立 Overlay 表达；
- Unknown 使用稳定默认图标。

---

## 10A. 信息架构

主导航固定为：

```text
概览
文件库
整理文件
空间清理
历史记录

自动化
设置
```

规则：

- “整理建议”统一改为用户任务名称“整理文件”；
- 空间清理不得隐藏在概览优先任务中；
- 主导航数量不再以四项为硬约束；
- 概览、Spotlight 和主导航可以提供同一核心任务的不同入口；
- 自动化和设置保持在高级区域。

---

## 11. 全局 Shell 规范

## 11.1 App Shell

- 标题栏 48px；
- Sidebar 宽屏 220px；
- 小窗口 176px；
- 标准页面内容 Padding 20px；
- 窄窗口 Padding 12–16px；
- 标准页面标题由 Shell 统一输出；
- Overview、Automation、History 不得重复渲染页面级标题。

## 11.2 Sidebar Navigation

- Nav Item 高度 40px；
- 图标 18px；
- 图标与文字间距 10–12px；
- 激活线 2px；
- 激活背景低饱和；
- Hover 与 Active 明确区分；
- 普通导航不使用阴影；
- Badge 只显示真正需要用户处理的数量。

## 11.3 AI 状态区域

正常状态：

- 小图标 + 简短模式文本；
- 不使用大型常驻卡片；
- 点击进入 AI 设置。

失败状态：

- 才展开为 Warning Card；
- 提供修复入口。

运行状态：

- 临时显示进度；
- 完成后恢复紧凑状态。

## 11.4 Titlebar

Spotlight：

- 最大宽度 440px；
- 最小宽度 240px；
- 不能与窗口控制发生挤压；
- Focus Ring 不形成双重描边。

Windows：

- 窗口按钮 44×48px；
- 关闭 Hover 为系统式红色；
- 最大化状态图标正确变化。

macOS：

- 可视圆点约 12px；
- 点击区至少 24×24px；
- 圆点间距 8px；
- 不将自定义交通灯描述为系统原生控件；
- 实测拖拽区与双击标题栏。

---

## 12. Page Header 规范

统一结构：

```text
页面标题                              页面主操作
一句简短说明
可选范围 / 状态元信息
```

规则：

- 页面标题只出现一次；
- 描述最多两行；
- 页面主要操作最多一个；
- 其他操作进入紧凑工具栏或 Overflow；
- 不重复展示范围信息；
- Page Header 与首块内容间距固定为 16px。

页面类型：

1. Standard Workspace；
2. Task Workspace；
3. Preferences Workspace。

---

## 13. Spotlight

### 13.1 空闲状态

最多显示：

- 最近打开 3–4 项；
- 最近操作 2–3 项；
- 常用入口 3–4 项。

不渲染空分组，不形成第二套完整导航。

### 13.2 搜索结果

- 文件与命令分组；
- 行高 52–56px；
- Active Row 清楚但不过度使用蓝色；
- 匹配文字高亮克制；
- Scope Meta 单行；
- Footer 快捷键提示不超过 3 个。

### 13.3 键盘

- 上下选择；
- Enter 打开；
- Alt+Enter 在文件夹中显示；
- Cmd/Ctrl+Enter 进入预览；
- Escape 清空或关闭；
- 焦点不得离开 Modal。

---

## 14. Overview

最终结构：

```text
Page Header
当前最重要的事情
空间摘要
最近活动
进行中的后台任务（仅在存在时显示）
```

规则：

- Priority Task 控制高度；
- 有任务时显示 Primary；
- 系统有序时操作降级；
- Scan Task 仅在扫描、失败或部分完成时显示；
- 无后台任务时隐藏后台任务区域；
- Recent Activity 最多 5 条；
- 空间摘要使用 Metric Strip；
- Overview 不成为所有模块的拼盘。

---

## 15. File Library

### 15.1 顶部工具栏

最终结构：

```text
[范围 ▾] [搜索当前范围________________] [筛选] [排序] [···]
```

第二行只在有筛选时显示 Filter Chips。

结果数量进入列表表头，选择数量进入选择操作栏。

### 15.2 文件列表

- 表头 Sticky；
- 行高 52px；
- 小窗口隐藏位置与时间；
- Selected 与 Focused 分别表达；
- Missing 状态明确；
- 自动加载更多，同时保留手动按钮作为后备。

### 15.3 桌面交互

- 单击：选择并更新 Inspector；
- Ctrl/Cmd 单击：追加选择；
- Shift 单击：范围选择；
- Space：Quick Look；
- Enter：默认预览；
- 双击：打开文件或系统默认应用；
- 右键：Context Menu；
- Escape：关闭预览、菜单或清除选择。

### 15.4 Inspector 与 Preview

- Inspector：元数据、分类信息、轻操作；
- Quick Look：内容预览；
- 双击：真实打开文件；
- 三者职责不得重叠。

---

## 16. Organize Files V2

本节由 `UI_UX_V4_2_PRODUCT_FLOW.md` 进一步定义。

### 16.1 页面目标

用户不应审查所有文件，而应：

1. 浏览整体整理方案；
2. 取消或调整少量不合理分组；
3. 处理真正需要决定的例外；
4. 进入最终逐文件预览。

### 16.2 一级视图

只保留三个一级视图：

- 整理方案；
- 需要我决定；
- 暂时无法处理。

不得将 Ready、Review、Blocked 混入一个逐文件列表。

### 16.3 页面摘要

```text
已分析 326 个文件

285 个已加入整理方案
31 个需要你决定
10 个暂时无法处理

没有文件会在最终预览前移动。
```

主操作：

> 预览已选择的 X 项操作

### 16.4 整理方案组

Ready 项按以下维度派生分组：

- 最终目标父目录；
- 操作类型；
- 建议动作；
- 稳定的建议依据类别。

每个组必须展示：

- 目标位置；
- 文件数量；
- 总大小；
- 来源位置；
- 示例文件；
- 分组依据；
- 平均与最低置信度；
- 风险或冲突数量；
- 包含 / 排除状态。

组级操作：

- 包含或排除整组；
- 修改整组目标；
- 展开文件；
- 在文件库中查看。

高置信度、无冲突、非敏感且可执行的组可以默认选中，但仍必须经过最终 Preview。

### 16.5 文件明细

文件明细不是默认首页。

展开组后允许：

- 排除单个文件；
- 修改单个目标；
- 修改名称；
- 保留原位；
- Quick Look；
- 在文件夹中显示。

### 16.6 需要我决定

每个项目必须显示具体原因，至少包含：

- 低置信度；
- 可能重复；
- 敏感文件；
- 名称冲突；
- 缺少目标；
- 混合分组。

每种原因必须提供上下文相关操作。

不得出现：

- “需要复核”但原因不明确；
- 主要按钮全部禁用；
- 只有“保留原位”可选；
- 无有效 Preview 却显示“接受建议”。

### 16.7 暂时无法处理

只展示：

- 来源不可用；
- 权限问题；
- Preview 被阻止；
- 不支持的操作；
- 无法自动修复的无效目标。

可用操作：

- 重试；
- 在文件夹中显示；
- 从本次计划移除；
- 查看技术详情。

### 16.8 相似项目批量决定

用户处理例外时可以选择：

- 仅应用到这个文件；
- 应用到相似文件；
- 明确创建自动化规则。

永久规则必须经过显式预览与确认，不能静默创建。

### 16.9 前端模型

系统准备状态：

```ts
type OrganizeReadiness =
  | "ready"
  | "requires-decision"
  | "blocked";
```

用户决定：

```ts
type OrganizeUserDecision =
  | "pending"
  | "selected"
  | "excluded"
  | "customized"
  | "keep"
  | "deferred";
```

复核原因：

```ts
type OrganizeReviewReason =
  | "low-confidence"
  | "possible-duplicate"
  | "sensitive-file"
  | "name-conflict"
  | "unsafe-extension-change"
  | "missing-target"
  | "mixed-group"
  | "unavailable-source"
  | "unsupported-action";
```

“needs-review” 不得继续作为用户决定值。

### 16.10 文件名与扩展名安全

Organize 的普通改名只允许修改基础名称，不允许静默修改索引扩展名。

有效：

```text
Report.pdf → Report_2026.pdf
```

不安全：

```text
Shortcut.lnk → Shortcut.exe
```

检测到不安全扩展名变化时：

- Readiness 不得为 `ready`；
- 不得默认选中；
- 不安全名称不得进入最终 Preview；
- 必须显示具体原因；
- 必须提供：
  - 保留原扩展名并修改基础名称；
  - 只移动、不重命名；
  - 选择其他安全名称；
  - 保留原位；
  - 稍后处理。

组级改名必须逐文件调用现有安全工具，并保留每个文件自己的索引扩展名。

### 16.11 部分 AI 分类结果

整理分析状态必须覆盖：

```ts
type OrganizeAnalysisState =
  | "idle"
  | "analyzing"
  | "complete"
  | "partial"
  | "failed"
  | "canceled";
```

在 `partial` 状态：

- 保留有效结果和已生成方案；
- 显示未完成文件数量；
- 提供“重试未完成文件”；
- 不清空已成功方案；
- 信息不足的文件不得进入 Ready Group；
- 可以根据已有信息进入“需要我决定”或“暂时无法处理”。

### 16.12 最终安全边界

- 组级决定最终必须展开为逐文件 Operation Preview；
- 最终 Preview 重新验证来源、目标和冲突；
- 只有 `selected` 与 `customized` 进入 Preview；
- `keep`、`excluded`、`deferred` 和 `pending` 不进入 Preview；
- 整理文件不直接执行删除；
- 重复文件删除相关操作转交空间清理。

---
## 17. Preview & Execute

默认摘要：

```text
即将执行 18 项操作

15 项可直接执行
2 项需要确认
3 项因冲突不会执行
```

详细安全信息放入 Disclosure：

- 总建议；
- 已选择；
- 自动创建文件夹；
- 低置信度；
- 敏感文件；
- 系统文件；
- Trash 操作；
- 排除原因。

Sticky Execute Bar：

```text
已选择 18 项，其中 15 项可执行
[返回建议]                        [执行 15 项操作]
```

执行中：

- 替换为进度；
- 不显示旧执行按钮；
- 支持取消；
- 结果支持成功、部分成功、失败和取消。

---

## 18. Storage Cleanup

空间清理是固定主导航核心功能，并同时拥有概览与 Spotlight 入口。

用户无需已有分析结果即可主动进入页面并开始扫描。

这是 V4.2 优先级最高的页面之一。

### 阶段一：选择位置

显示：

- 当前选择位置；
- 选择文件夹；
- 快捷位置；
- 开始扫描。

隐藏：

- AI 面板；
- 禁用 AI 按钮；
- 筛选；
- 指标卡；
- 候选列表。

### 阶段二：扫描中

显示：

- 已扫描数量；
- 已扫描空间；
- 当前路径；
- 取消扫描。

隐藏所有结果和 AI 操作。

### 阶段三：审查建议

顶部摘要：

```text
预计可安全释放 4.8 GB
23 个项目需要你确认
4 个项目建议谨慎处理
```

筛选：

- 全部；
- 可安全清理；
- 需要确认；
- 谨慎处理。

AI 只保留一个主要上下文动作：

> AI 再检查 X 个需要确认的项目

已选择项目的 AI 检查放到二级菜单。

删除重复的“分析全部 / 风险 / 已选择”多入口。

### 阶段四：确认与执行

Sticky Bar：

```text
已选择 18 项 · 预计释放 3.2 GB
[移入安全废纸篓]
```

规则：

- Review 项选中时二次确认；
- Caution 项不能直接加入；
- Caution 提供“在文件夹中显示”和“查看原因”。

### 用户文案

- Safe → 可安全清理；
- Review → 需要确认；
- Caution → 谨慎处理；
- Safe Trash → 安全废纸篓。

内部枚举只在 Developer Mode 中显示。

---

## 19. History & Restore

### 19.1 一级筛选

只保留：

- 全部；
- 可恢复；
- 存在问题。

### 19.2 高级筛选

Popover 中：

- 整理操作；
- 清理记录；
- 已恢复；
- 成功；
- 失败；
- 恢复失败；
- 跳过；
- 取消；
- 需要检查；
- 时间范围。

### 19.3 页面结构

- 不重复页面标题；
- Summary 使用 Metric Strip；
- 左侧批次列表；
- 右侧 Inspector；
- 小窗口切换列表 / 详情；
- 选择后显示 Sticky Restore Bar；
- 无选择时隐藏恢复操作区域。

### 19.4 普通用户视图

默认不显示：

- 内部状态枚举；
- 技术错误栈；
- 底层 Session ID；
- 内部恢复意图。

这些内容放到“技术详情”。

---

## 20. Automation

### 20.1 页面顶部

删除内部重复标题。

摘要改为：

> 6 条规则 · 4 条启用 · 2 条暂停 · 12 个项目待确认

右侧只保留：

> 新建规则

删除四张 SaaS 式统计卡。

### 20.2 Rule List

- 行高 48px；
- Rule Name；
- 一句自然语言摘要；
- Switch；
- 一个主要状态；
- 不在每行堆叠按钮。

### 20.3 Inspector

展示：

1. 规则名称；
2. “当……时，将……”自然语言摘要；
3. 当前作用范围；
4. 启用状态；
5. 最近运行；
6. 编辑、复制、删除。

### 20.4 Rule Dialog

- 最大宽度 720px；
- 条件、动作、范围、安全四区；
- 实时自然语言预览；
- 高级表达式仅 Developer Mode；
- 保存失败显示在 Dialog 内；
- 删除使用独立确认。

---

## 21. Settings

### 21.1 保留

- 8 个 Section；
- Sticky Section Nav；
- Scroll Spy；
- Spotlight 深链接；
- 两栏 Settings Row。

### 21.2 分组原则

- 每个 Section 一个清晰边界；
- Group 默认使用标题 + Divider；
- 不把所有 Group 都做成独立卡片；
- AI、文件夹列表、安全配置可以使用局部卡片；
- 避免 Card Soup。

### 21.3 组件

- Segmented Control 使用浅色 Thumb；
- 支持 Default / Compact 密度；
- Hotkey Capture 使用键帽视觉；
- Secret Eye Button 28×28px，绝对居中；
- Select、Input、Button 高度对齐；
- 文件夹项的开关、立即扫描、删除操作视觉分级。

### 21.4 AI 设置

普通模式：

- AI：关闭 / 本地 / 云端；
- 提供商；
- 模型；
- 凭据；
- 测试连接；
- 保存。

高级折叠：

- Base URL；
- Chat Path；
- Batch；
- Concurrency；
- Timeout；
- 调试分类；
- 原始返回。

### 21.5 AI Provider 与诊断兼容要求

Settings 重构必须保留：

- Provider Registry；
- Model Discovery；
- Provider Capability-aware Controls；
- Test Connection；
- Request Trace；
- Export Diagnostics；
- Clear Diagnostics。

信息层级：

1. 普通配置：模式、Provider、Model、Credential、Test、Save；
2. 高级配置：请求路径、批量、并发、超时、Token、Thinking、JSON；
3. Developer Mode：Request Trace 与诊断。

不得为了简化界面删除诊断能力，也不得让诊断占据普通用户首屏。

### 21.6 保存状态

存在未保存设置时显示 Sticky Save Bar：

```text
有尚未保存的 AI 设置
[放弃修改] [保存设置]
```

---

## 22. Onboarding

三步保持：

1. 本地与隐私；
2. 扫描范围；
3. AI 模式。

优化：

- 使用三个进度点 + “第 X/3 步”；
- Brand Mark 首次出现时播放轻量动效；
- 第一步不使用三张厚重卡片；
- 长路径正确截断；
- AI 文案改为：
  - 暂不使用 AI；
  - 在这台电脑上分析；
  - 使用在线模型；
- 云端明确需要凭据；
- 本地明确需要本地模型；
- Skip 改为“稍后设置”；
- Settings 提供“重新打开首次引导”。

---

## 23. Close Choice Dialog

结构：

```text
关闭 Zen Canvas

你希望将应用最小化到后台，还是完全退出？

[ ] 记住我的选择

取消                         退出应用  最小化到托盘
```

规则：

- Cancel：Ghost；
- Quit：Secondary；
- Minimize：Primary；
- 小窗口允许按钮换行；
- 不使用大型 Logo；
- 根据平台调整按钮顺序，但语义一致。

---

## 24. 文案规范

### 24.1 工程语言替换

| 内部概念 | 用户文案 |
|---|---|
| Executable | 可以执行 |
| Blocked | 因冲突无法执行 |
| Needs Review | 需要你确认 |
| Reanalyze Scope | 重新分析当前范围 |
| Analyze Pending | 分析尚未处理的文件 |
| Preview | 预览将要发生的操作 |
| Scope | 当前文件范围 |
| Rule Execution | 重新应用已启用规则 |
| Partial Failure | 部分项目未完成 |
| Safe Trash | 安全废纸篓 |
| Restore Intent | 恢复预览 |
| AI Provider | AI 服务 |

### 24.2 文案规则

- 按钮使用动词；
- 标题描述结果；
- 错误先说明发生了什么，再说明如何处理；
- 不展示 Rust、Tauri、JSON、Mock、Fixture 等内部术语；
- 不直接展示内部枚举；
- 所有用户文案进入 i18n；
- 禁止 React 组件中硬编码中文或英文。

---

## 25. 无障碍规范

所有修改必须保证：

- Tab 顺序符合视觉顺序；
- Focus Ring 清晰；
- Modal Focus Trap；
- 关闭后焦点恢复；
- Listbox 正确播报；
- Switch 使用 `aria-checked`；
- Segmented 使用 `aria-pressed` 或 Radio；
- Error 使用 `role=alert`；
- Progress 使用 `aria-live=polite`；
- 危险确认使用 `alertdialog`；
- 状态不只依赖颜色；
- 200% 文本缩放不遮挡操作；
- Reduced Motion 不出现位移动画；
- 所有主要流程可仅使用键盘完成。

---

## 26. 响应式与跨平台

必须验证：

- 1440×900；
- 1280×800；
- 1180×720；
- 1100×700；
- 1024×700；
- 980×680。

必须覆盖：

- Light 中文；
- Dark 中文；
- Light English；
- Dark English。

系统验证：

- Windows 100%；
- Windows 125%；
- Windows 150%；
- Windows 200%；
- Windows High Contrast；
- Narrator；
- macOS Retina；
- VoiceOver；
- macOS 交通灯；
- 标题栏拖拽；
- 最小化、最大化、关闭。

---

## 27. 硬性验收标准

以下任一项不满足，不得标记 V4.2 完成：

- 空间清理固定出现在主导航，并可从概览和 Spotlight 进入；
- Organize 默认首页为整理方案分组，而不是逐文件审批列表；
- 系统准备状态与用户决定完全分离；
- 不存在“需要决定但只有保留原位可选”的状态；
- 扩展名不安全的建议不得进入 Ready；
- 组级和文件级改名必须保留索引扩展名；
- 部分 AI 分类必须保留有效结果并允许只重试未完成文件；
- Provider Registry、模型发现和 Request Trace 不得因 UI 重构丢失；
- 页面标题零重复；
- 没有硬编码用户文案；
- 没有业务组件硬编码十六进制颜色；
- 每个页面状态最多一个 Primary；
- 不出现无意义禁用控制组；
- 不出现横向溢出；
- 不出现文字覆盖按钮；
- 不出现卡片套卡片套卡片；
- 普通列表行不使用 Panel Radius；
- Dialog 全部恢复焦点；
- 主要流程支持键盘；
- Console 无错误；
- TypeScript、测试、Build 通过；
- 设计文档与代码尺寸完全一致；
- 无法验证的原生平台能力必须明确标记为未验证。

---

## 28. 设计完成定义

一个页面或组件只有同时满足以下条件，才可以标记完成：

1. 结构与视觉符合本规范；
2. 所有关键状态已覆盖；
3. Light / Dark 已验证；
4. 中文 / 英文已验证；
5. 标准与最小窗口已验证；
6. 键盘流程已验证；
7. Reduced Motion 已验证；
8. 相关测试通过；
9. 生产构建通过；
10. 没有把未验证事项描述为已完成。
