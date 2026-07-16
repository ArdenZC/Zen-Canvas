# Codex 任务 02：App Shell v4.0

## 任务定位

建立 Zen Canvas 的最终全局框架：

- 四项主导航；
- 高级功能分组；
- Windows/macOS 双平台窗口结构；
- 统一的 Spotlight；
- 动态 AI 处理模式；
- 页面级布局和焦点管理。

本阶段只负责 Shell、导航与全局检索，不重做 Overview、文件库、整理建议和历史记录的业务内容。

> 当前仓库可能已经分多次提交实施了本任务的一部分。最终验收不以某个历史提交为准，而以本任务书的完整标准为准。

---

## 依赖与阅读

必须先阅读：

1. `ZEN_CANVAS_UIUX_BRAND_SYSTEM_V4.md`
2. `CODEX_TASK_01_DESIGN_FOUNDATION_V4.md`
3. 当前：
   - `src/components/AppShell.tsx`
   - `src/components/ShellChrome.tsx`
   - `src/components/CommandModal.tsx`
   - `src/components/spotlight/*`
   - `src/store/useAIProcessingModeStore.ts`
   - `src/i18n.ts`
   - 相关 Shell/Spotlight 测试

---

## 最终目标

1. 主导航固定为：
   - 概览
   - 文件库
   - 整理建议
   - 历史记录
2. 高级区固定为：
   - 自动化
   - 设置
3. 清理和执行预览保留为内部业务路由，由任务流程进入；
4. Windows 使用 Windows 习惯的窗口控制；
5. macOS 保留交通灯和连续拖拽区；
6. Spotlight 成为文件、操作、设置、历史记录的统一入口；
7. Spotlight 支持完整键盘、焦点循环、焦点恢复和结果自动滚动；
8. 侧栏动态显示 AI 关闭、本地模型、云端 AI、加载和错误状态；
9. 主题和语言不长期占据标题栏；
10. 普通用户文案自然、简洁，不使用内部工程术语。

---

## 允许修改

优先：

- `src/components/AppShell.tsx`
- `src/components/ShellChrome.tsx`
- `src/components/CommandModal.tsx`
- `src/components/spotlight/*`
- `src/store/useAIProcessingModeStore.ts`
- `src/i18n.ts`
- `src/views/settings/SettingsView.tsx`
- Shell/Spotlight 相关测试

必要时：

- `src/types/ui.ts`：仅在不破坏内部旧路由的前提下调整类型；
- `src/contexts/AppContexts.tsx`；
- 与 Spotlight 设置定位有关的轻量工具文件。

---

## 禁止修改

- Overview/Scanner 的页面内容结构；
- 文件库、整理建议、清理、历史记录页面；
- 扫描、移动、重命名、清理、恢复业务逻辑；
- Tauri API、Rust、数据库；
- Store 中与本阶段无关的数据模型；
- 安装新依赖。

---

## 1. 最终导航

### 主导航

只显示：

- 概览
- 文件库
- 整理建议
- 历史记录

### 高级区

只显示：

- 自动化
- 设置

### 内部路由

以下能力必须继续可用，但不作为固定一级导航：

- 空间清理；
- 执行预览；
- 恢复详情；
- 扫描任务详情。

不要为了精简导航删除业务路由。

### 侧栏选中态

- 使用 `surface-selected`；
- 图标与文字同步增强；
- 使用细左侧指示线或轻微内描边；
- 不使用高饱和整块蓝；
- Focus 与 Selected 必须视觉可区分。

---

## 2. 双平台标题栏

### Windows

- 48px 标题栏；
- 最小化、最大化、关闭为系统习惯位置；
- 关闭 Hover 使用系统红色；
- 不把三个系统按钮放进胶囊；
- 左侧保留安静、连续的拖拽区；
- 不常驻语言和主题切换按钮。

### macOS

- 交通灯点击区域不小于 24×24px；
- 左侧交通灯之外保持连续拖拽区；
- 搜索和其他控件使用 no-drag；
- 不在右侧堆放低频主题与语言按钮。

### 标题栏中心

只保留 Spotlight 触发器：

- 文案：`搜索文件、操作或设置`
- 快捷键：`Ctrl/Cmd + K`
- 输入框外观应像入口，不伪装成页面搜索表单；
- 点击、快捷键均可打开。

---

## 3. Spotlight 信息架构

### 空闲状态

按有数据才显示的原则展示：

- 最近文件；
- 最近操作；
- 常用任务；
- 后台任务状态。

无数据的分组不显示空卡片。

### 搜索结果分组

- 文件夹；
- 文件；
- 操作；
- 设置；
- 历史记录。

### 文案

中文不得出现：

- 全局资产与指令检索；
- 生命周期维度；
- 控制指令；
- `Smart Matches` 英文括注；
- `Unknown`。

使用：

- 搜索文件、文件夹、操作或设置；
- 智能匹配；
- 未分类 / 未知类型。

---

## 4. Spotlight 行为

必须支持：

- `Ctrl/Cmd + K` 打开；
- `Esc` 关闭；
- 清除按钮仅清空搜索，并有 `aria-label` 和 Tooltip；
- 上下键移动；
- Enter 打开当前结果；
- Alt+Enter 或既有次级快捷键执行次级动作；
- Tab/Shift+Tab 在 Dialog 内循环；
- 关闭后恢复到 Spotlight 触发按钮；
- 背景区域在 Dialog 打开时 `inert`；
- 当前结果通过 `aria-activedescendant` 和 `aria-selected` 关联；
- 当前结果变化时自动滚动到完整可见；
- 结果滚动区域与固定 Footer 分离，Footer 不得遮挡最后一项。

### 防止旧结果闪现

查询变化后：

- 旧文件结果必须立即隐藏或与旧 query 绑定；
- 命令结果可以即时显示；
- 不得出现“新查询词 + 旧文件结果”的短暂混合。

---

## 5. Spotlight 视觉

### 容器

- 使用 Floating 材质；
- 最大宽度约 680–720px；
- 内容区域最大高度适配窗口；
- 结果较多时只滚动结果区；
- Footer 固定在容器底部，而不是覆盖内容。

### 结果选中态

使用：

- 轻微 `surface-selected` 背景；
- 1px 内描边；
- 图标和文字增强；
- 可选 2px 左侧指示。

不要使用像输入框一样的粗外圈。

### 匹配词高亮

- `font-semibold`；
- Primary Text；
- 最多极轻背景；
- 不使用明显蓝色胶囊；
- 不增加 `px-1` 破坏字距。

---

## 6. AI 处理模式

状态必须真实区分：

| 状态 | 图标 | 色彩 | 文案 |
|---|---|---|---|
| loading | LoaderCircle | info | 正在确认处理模式 |
| failed | TriangleAlert | warning | 无法确认处理模式 |
| disabled | ShieldCheck/LockKeyhole | neutral | AI 已关闭 |
| local | Cpu | success | 使用本地模型 |
| cloud | Cloud | info | 使用云端 AI |

### 错误状态

- 提供“检查设置”操作；
- 点击定位到设置中的 AI 区域；
- 不只显示错误说明；
- 不使用和正常状态相同的锁图标。

### 隐私文案

必须与真实行为一致：

- AI 关闭：索引和规则仅在本机；
- 本地模型：索引和模型分析均在本机；
- 云端 AI：清楚说明仅发送已启用的分析信息；
- 不允许云端模式仍显示绝对化“仅本地处理”。

---

## 7. 设置定位

Spotlight 中以下操作必须能真实定位：

- 搜索范围；
- 主题；
- AI；
- 语言；
- 隐私。

不要只打开设置首页。

---

## 8. 无障碍

- Dialog 使用 `role="dialog"` 和 `aria-modal`；
- 独立搜索窗口使用适当的 `role="search"`；
- 输入框使用 Combobox 语义；
- 结果使用 Listbox/Option；
- 键盘焦点始终可见；
- 关闭恢复焦点；
- Reduced Motion 下减少开合位移；
- Clear 和 Close 语义明确。

---

## 9. 测试

至少覆盖：

1. 主导航只有四项；
2. 高级区只有自动化和设置；
3. 内部 cleanup/preview 路由仍存在；
4. Windows/macOS 窗口控制结构；
5. 标题栏不常驻语言和主题按钮；
6. Spotlight 文件、文件夹、操作、设置分组；
7. 最近文件和最近操作按真实时间排序并限制数量；
8. 空分组不显示；
9. 新 query 不保留旧文件结果；
10. Footer 不覆盖滚动结果；
11. 当前项自动滚动；
12. Focus Trap 和 Focus Restore；
13. `aria-activedescendant` / `aria-selected`；
14. 清除按钮和 Esc 语义；
15. 五种 AI 模式；
16. failed 状态定位 AI 设置；
17. 中文文案不包含被禁止的工程术语。

---

## 10. 截图验收

提供：

- 1440×900 Windows 亮色 Shell；
- 1440×900 Windows 深色 Shell；
- macOS 标题栏；
- Spotlight 空闲状态；
- Spotlight 文件结果；
- Spotlight 设置结果；
- 键盘选中态；
- 搜索结果滚动到底部；
- 五种 AI 状态对比；
- failed 状态操作。

---

## 11. 完成标准

- Shell 信息架构评分 ≥ 9.0；
- Spotlight 交互评分 ≥ 9.0；
- 标题栏不再有低频工具噪声；
- 不破坏任何旧业务入口；
- Typecheck、Test、Build 全部通过；
- 完成后停止，不进入 Overview。
