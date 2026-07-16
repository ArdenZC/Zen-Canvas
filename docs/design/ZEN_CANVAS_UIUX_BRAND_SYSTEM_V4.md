# Zen Canvas UI/UX 与品牌系统规范 v4.0

**状态：正式设计基线（2026-07）**  
**目标：综合设计评分 ≥ 9.0/10**  
**适用范围：React/Tauri 桌面应用、独立 Spotlight 搜索窗口、系统托盘、亮色/深色模式、macOS/Windows**

---

## 1. 产品体验目标

Zen Canvas 不是传统文件管理器，也不是面向工程师的规则控制台。它是一个本地优先的个人数字空间管家。

用户进入应用后，只需要理解三件事：

1. 当前文件空间有什么值得注意；
2. 哪些项目需要自己作决定；
3. Zen Canvas 能安全地完成什么。

最终体验应当传达：

> 安静、有序、本地优先。复杂能力留在背后，用户只看到清楚的判断和下一步。

### 1.1 9 分标准

- 一级主导航不超过 4 项；
- 每个页面只有一个主要操作；
- 普通界面不显示 Batch Size、并发、Token、JSON、内部阶段名等工程参数；
- 扫描、整理、清理和恢复均有清晰的开始、进行、完成、失败和撤销状态；
- 所有文件变更必须先预览；
- 危险操作必须说明影响范围和是否可恢复；
- 不使用浏览器原生 `confirm`；
- 亮色、深色、Windows、macOS 都是完整体验，而不是简单换色；
- 125%/150% 缩放、小窗口和中文界面保持可读；
- 视觉必须具有 Zen Canvas 自身识别度，而不仅是“苹果蓝 + 毛玻璃”。

---

## 2. 品牌系统

### 2.1 品牌概念

品牌标志由两个核心形态组成：

- **Zen Core**：圆形，代表理解、扫描、智能判断；
- **Canvas**：圆角方形，代表承载、空间、秩序；
- **重叠关系**：代表文件被理解后归位到有序空间。

品牌动效遵循四阶段：

> 识别文件 → 智能分析 → 分类整理 → 有序归位

### 2.2 品牌使用边界

品牌层允许：

- 蓝青渐变；
- 柔和发光；
- 半透明叠加；
- 模糊；
- 品牌形态动效。

适用场景：

- 应用图标；
- 启动页；
- 空状态；
- 扫描/分析等待；
- 完成状态；
- 宣传视觉。

工作层必须清晰：

- 文件列表；
- 路径；
- 文件属性；
- 筛选；
- Inspector；
- 规则和设置。

工作层不允许大面积发光、渐变文字或模糊背景。

### 2.3 图标尺寸策略

- 128–1024px：完整 App Icon；
- 64px：减弱模糊和阴影；
- 32px：强化轮廓，减少透明层；
- 16–24px：独立绘制 Micro Mark，不允许直接缩放大图；
- 系统托盘：单色符号版本。

---

## 3. 信息架构

### 3.1 最终主导航

1. **概览**
2. **文件库**
3. **整理建议**
4. **历史记录**

高级区域：

- **自动化**
- **设置**

### 3.2 功能归属

| 当前功能 | 最终归属 |
|---|---|
| 空间扫描 | 概览中的任务，不再作为长期一级页面 |
| 空间清理 | 概览发起的四阶段任务 |
| 智能整理 | 整理建议 |
| 预览执行 | 整理建议的最终步骤 |
| 文件库 | 文件库 |
| 规则引擎 | 自动化 |
| 恢复记录 | 历史记录 |
| 设置 | 设置 |

### 3.3 渐进式披露

默认界面只显示当前决策必需的信息。

高级内容通过以下方式出现：

- Inspector；
- Popover；
- Sheet；
- “高级选项”折叠区；
- 设置中的开发者模式。

不得在主页面直接铺开工程参数。

---

## 4. 设计 Token

所有新 UI 必须使用语义 Token。禁止在业务组件中新增临时十六进制颜色、`slate-*`、`blue-*` 或随机圆角。

### 4.1 亮色模式

```css
--zc-canvas: #f4f6f9;
--zc-canvas-elevated: #f8f9fb;
--zc-sidebar: rgba(247, 249, 252, 0.82);
--zc-titlebar: rgba(249, 250, 252, 0.78);

--zc-surface: #ffffff;
--zc-surface-subtle: #f7f8fa;
--zc-surface-hover: #eef5ff;
--zc-surface-selected: #e7f1ff;
--zc-surface-floating: rgba(255, 255, 255, 0.92);

--zc-text-primary: #1c1c1e;
--zc-text-secondary: #5f6470;
--zc-text-tertiary: #858a95;
--zc-text-disabled: #aeb3bc;

--zc-divider: rgba(28, 28, 30, 0.09);
--zc-border: rgba(28, 28, 30, 0.12);
--zc-border-strong: rgba(28, 28, 30, 0.18);

--zc-primary: #007aff;
--zc-primary-hover: #006be6;
--zc-primary-pressed: #005bc4;
--zc-primary-soft: rgba(0, 122, 255, 0.10);

--zc-brand-cyan: #4facfe;
--zc-brand-green: #22c55e;
--zc-brand-teal: #06b6d4;

--zc-success: #1f9d61;
--zc-warning: #c78400;
--zc-danger: #d92d20;
```

### 4.2 深色模式

```css
--zc-canvas: #0a0f1a;
--zc-canvas-elevated: #0d1421;
--zc-sidebar: rgba(14, 22, 36, 0.88);
--zc-titlebar: rgba(10, 15, 26, 0.82);

--zc-surface: #111b2a;
--zc-surface-subtle: #152132;
--zc-surface-hover: #182b46;
--zc-surface-selected: #17365d;
--zc-surface-floating: rgba(17, 27, 42, 0.94);

--zc-text-primary: #f7f9fc;
--zc-text-secondary: #b5bdca;
--zc-text-tertiary: #7f8999;
--zc-text-disabled: #5f6876;

--zc-divider: rgba(255, 255, 255, 0.08);
--zc-border: rgba(255, 255, 255, 0.11);
--zc-border-strong: rgba(255, 255, 255, 0.18);

--zc-primary: #4facfe;
--zc-primary-hover: #72beff;
--zc-primary-pressed: #2e93e8;
--zc-primary-soft: rgba(79, 172, 254, 0.14);

--zc-success: #4ade80;
--zc-warning: #fbbf24;
--zc-danger: #ff6b6b;
```

### 4.3 材质层级

只允许四种主要材质：

1. **Canvas**：应用背景；
2. **Content**：内容表面，无明显阴影；
3. **Raised**：Inspector、局部工具区，轻阴影；
4. **Floating**：Dialog、Popover、Spotlight，允许模糊和明显阴影。

玻璃效果只用于：

- 侧边栏；
- 标题栏；
- Spotlight；
- Popover/Dialog；
- 悬浮工具条。

文件列表、表格和主要内容不得默认使用毛玻璃。

### 4.4 圆角

```css
--zc-radius-control: 10px;
--zc-radius-field: 12px;
--zc-radius-panel: 16px;
--zc-radius-floating: 20px;
--zc-radius-window: 24px;
```

限制：

- 普通列表行不使用大圆角；
- 不允许卡片套卡片；
- 同屏完整圆角面板应尽量少于 4 个；
- 胶囊形状仅用于搜索、状态和少量紧凑控制，不用于所有按钮。

### 4.5 间距

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

### 4.6 阴影

```css
--zc-shadow-raised: 0 8px 24px rgba(20, 32, 50, 0.08);
--zc-shadow-floating: 0 20px 56px rgba(14, 24, 40, 0.18);
--zc-shadow-spotlight: 0 28px 80px rgba(8, 18, 32, 0.28);
```

内容卡片不得普遍使用强阴影。

---

## 5. 字体系统

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

### 5.1 字号

| 用途 | 字号 | 行高 | 字重 |
|---|---:|---:|---:|
| 页面标题 | 28–32px | 1.2 | 600 |
| 主要数字 | 24–30px | 1.15 | 600 |
| 区域标题 | 18–20px | 1.3 | 600 |
| 列表标题 | 13–14px | 1.4 | 500/600 |
| 正文 | 14px | 1.55 | 400 |
| 次级信息 | 12px | 1.5 | 400 |
| 表头/标签 | 11–12px | 1.4 | 500/600 |

原则：

- 中文正文不得低于 13px；
- 不大量使用全大写和高字距；
- 路径、时间、文件大小保持可读对比度；
- `font-semibold` 只用于标题、选中项和关键数字。

---

## 6. 全局 Shell

### 6.1 布局

- 标题栏：48px；
- 侧边栏：220–236px；
- 内容区最小宽度：720px；
- Inspector 建议宽度：300–380px；
- 页面内容最大宽度由页面类型决定，文件库不限制为居中窄列。

### 6.2 macOS

- 使用交通灯窗口控制；
- 交通灯点击区域不小于 24×24px；
- 侧边栏允许柔和半透明；
- 标题栏拖拽区域必须连续；
- 搜索、按钮和交互区域必须标记为 no-drag。

### 6.3 Windows

- 使用 Windows 系统习惯的最小化、最大化、关闭按钮；
- 不使用红黄绿交通灯；
- 可使用接近 Mica 的柔和背景，但不得伪装 macOS；
- 系统控制按钮不应放入额外胶囊容器；
- Close Hover 使用系统红色反馈。

### 6.4 侧边栏

主导航与高级导航必须明显分组。

选中状态：

- 低饱和主色背景；
- 图标和文字同步增强；
- 不使用高饱和整块蓝；
- 可使用 2px 左侧指示线或轻微内发光。

底部“本地模式”是动态状态入口：

- 完全本地；
- 使用云端 AI；
- 使用本地模型；
- AI 已关闭。

不得在使用云端 AI 时仍显示绝对化“仅本地处理”。

---

## 7. Spotlight

Spotlight 是 Zen Canvas 的空间效率中枢。

### 7.1 空闲状态

- 最近文件；
- 最近操作；
- 常用任务；
- 当前后台任务。

### 7.2 结果分组

- 文件；
- 文件夹；
- 操作；
- 设置；
- 历史记录。

### 7.3 行为

- `Cmd/Ctrl + K` 打开；
- `Esc` 关闭；
- 上下键移动；
- `Enter` 执行；
- `Cmd/Ctrl + Enter` 可用于次级动作；
- 结果中清楚显示主动作；
- 搜索窗口和主应用共用同一设计系统。

---

## 8. 基础组件规则

### 8.1 Button

层级只有：

- Primary；
- Secondary；
- Ghost；
- Destructive；
- Icon。

每个页面最多一个 Primary。

按钮高度：

- 标准：36–40px；
- 紧凑工具栏：30–32px；
- 图标按钮点击区域不小于 32×32px。

### 8.2 List Row

列表是主要内容表达方式。

必须支持：

- Hover；
- Selected；
- Focus；
- Disabled；
- Multi-selected；
- Context menu；
- Keyboard navigation。

选中态不能只依赖颜色。

### 8.3 Inspector

Inspector 用于解释当前选择，不得复制列表中已有信息。

优先顺序：

1. 内容预览；
2. 当前状态；
3. 建议及原因；
4. 元数据；
5. 操作。

### 8.4 Notice

普通安全机制不应反复显示成大面积 Notice。

Notice 仅用于：

- 真实异常；
- 权限问题；
- 部分失败；
- 用户当前必须知道的风险。

### 8.5 Dialog / Sheet

必须包含：

- 标题；
- 影响范围；
- 发生什么；
- 能否撤销；
- 一个主动作；
- 一个取消动作。

禁止使用 `window.confirm` / `globalThis.confirm`。

---

## 9. 动效

动效必须服务于状态理解。

### 9.1 时长

```css
--zc-duration-fast: 120ms;
--zc-duration-standard: 180ms;
--zc-duration-slow: 280ms;
--zc-ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
```

### 9.2 允许

- Hover/Selected 过渡；
- Inspector 内容切换；
- Spotlight 开合；
- 扫描与分析状态；
- 完成后的短反馈；
- 品牌四阶段动效。

### 9.3 禁止

- 每个列表项同时明显飞入；
- 大面积持续脉冲；
- 无意义旋转；
- 页面切换时大幅缩放；
- 使用位移动画导致布局抖动。

必须继续支持 `prefers-reduced-motion`。

---

## 10. 页面原则

### 10.1 概览

只保留：

- 一个当前最重要任务；
- 一条空间摘要；
- 最近活动；
- 后台任务状态。

全页唯一 Primary 是当前推荐动作。

不使用 2×2 快速操作 Dashboard。

### 10.2 文件库

默认：

- 搜索；
- 范围；
- 筛选入口；
- 高密度列表；
- 智能 Inspector。

必须支持：

- 多选；
- Shift 连选；
- 键盘导航；
- 右键菜单；
- 排序；
- Quick Look；
- 平台化“在文件夹/访达中显示”。

### 10.3 整理建议

结构：

- 左侧建议列表；
- 右侧 Inspector；
- 单项接受、保留、修改目标；
- 底部批量预览入口。

不得同时出现含义相近的“接受”“确认并继续”“预览更改”三个主动作。

### 10.4 空间清理

固定为：

> 选择范围 → 分析 → 确认 → 完成

最终执行按钮只出现一次。

所有候选类别都可展开查看具体路径和项目。

### 10.5 历史记录

统一展示：

- 整理；
- 清理；
- 恢复；
- 部分失败；
- 后台任务。

左侧时间线/列表，右侧详情。

可恢复操作必须显示剩余可恢复状态。

### 10.6 自动化

默认使用自然语言规则：

> 当文件类型是截图，并且超过 30 天未使用时，标记为临时文件。

AND、OR、权重和底层字段只在高级编辑中出现。

---

## 11. 状态完整性

每个核心页面必须覆盖：

- 初始；
- 加载；
- 空；
- 正常；
- 进行中；
- 成功；
- 部分成功；
- 失败；
- 权限不足；
- 取消；
- 可撤销；
- 不可恢复。

任何状态都不能通过临时堆叠多个 Notice 来解决。

---

## 12. 无障碍

- 正文与背景对比度至少满足 WCAG AA；
- 仅靠颜色不能表达选中、警告或成功；
- 所有图标按钮有 `aria-label` 和 Tooltip；
- 所有 Dialog 有焦点陷阱、Esc 和焦点恢复；
- 触控/点击区域不小于 32px，关键操作建议 40px；
- 支持完整键盘操作；
- 动效遵循减少动态设置；
- 中文文本不使用过小字号或过浅颜色。

---

## 13. 禁止模式

以下模式不得进入新代码：

- 卡片套卡片；
- 同屏多个蓝色 Primary；
- 所有区域都毛玻璃；
- 重复安全提示；
- 同一操作在页面上出现两次；
- 工程参数直接暴露；
- 新增硬编码颜色；
- 把 Windows 画成 macOS；
- 使用原生浏览器确认框；
- 依赖长段说明弥补交互不清楚；
- 用缩放动画制造选中态；
- 无状态设计的“理想截图式页面”。

---

## 14. 分阶段实施

1. Design Foundation：Token、材质、品牌标志、基础组件兼容层；
2. App Shell：双平台窗口框架、最终导航、Spotlight；
3. Overview；
4. File Library；
5. Suggestions + Preview；
6. Cleanup + History；
7. Automation + Settings；
8. States、Motion、Accessibility、Visual QA。

每阶段必须通过：

```bash
npm run typecheck
npm test
npm run build
```

不得为了视觉整改降低已有测试和安全边界。
