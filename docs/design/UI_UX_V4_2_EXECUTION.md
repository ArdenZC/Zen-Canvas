# Zen Canvas UI/UX V4.2 Precision & Clarity 执行计划

> 状态：待执行  
> 基线：当前 `master`  
> 设计规范：`docs/design/UI_UX_V4_2_SPEC.md`  
> 产品流程规范：`docs/design/UI_UX_V4_2_PRODUCT_FLOW.md`  
> 目标：先修正信息架构与核心工作流，再完成组件、页面和跨平台精修。

---

## 1. 新的整改顺序

V4.2 不再从纯视觉 Primitive 直接开始。

```text
产品逻辑与领域模型
        ↓
设计基础
        ↓
Shell、导航与 Cleanup 入口
        ↓
整理文件 V2
        ↓
空间清理
        ↓
Preview & Execute
        ↓
其他工作区
        ↓
全局 QA
```

原因：

- 空间清理当前不可发现；
- 整理文件当前要求用户逐文件审核；
- `needs-review` 混合系统状态和用户决定；
- 继续精修旧流程会强化错误的交互模型。

---

## 2. 执行原则

每个 PR 必须：

- 只有一个主要目标；
- 可独立审查和回滚；
- 不扩大 Rust 修改范围；
- 不删除现有安全能力；
- 不静默改变文件操作；
- 不同时保留新旧两套正式工作区；
- 不把无法验证的内容写成已完成。

标准流程：

```text
审计
→ 输出计划
→ 人工确认
→ 实现
→ 定向测试
→ 全量前端测试
→ Diff 自查
→ 视觉 QA
→ 修复
→ 文档更新
→ 人工 Review
→ 合并
```

---

## 2A. 最新 Master 兼容要求

所有 PR 必须基于最新 `master`，并保留：

- AI Provider Registry；
- Provider Capability；
- Model Discovery；
- Test Connection；
- Request Trace；
- Export / Clear Diagnostics；
- 部分 AI 分类结果处理；
- 文件名规范化；
- 索引扩展名保护；
- Organize / Preview 的扩展名不匹配拦截。

任何计划如果基于旧代码快照，必须停止实施并重新审计。

---

## 3. PR 总览

| PR | 名称 | 主要目标 | 状态 |
|---|---|---|---|
| PR 0 | Product Flow Foundation | 新信息架构、Organize V2 模型、测试骨架 | 待开始 |
| PR 1 | Design Foundation Finalization | Token、Density、Radius、Typography、Primitives | 未开始 |
| PR 2 | Shell, Navigation & Entry Points | 五项主导航、Cleanup 三类入口、Spotlight | 未开始 |
| PR 3 | Organize Files V2 | 方案分组、例外优先、新决策模型 | 未开始 |
| PR 4 | Storage Cleanup Workflow | 四阶段清理工作流、单一 AI 入口 | 未开始 |
| PR 5 | Preview & Execute | 多来源预览、冲突与执行收口 | 未开始 |
| PR 6 | File Library | 工具栏、列表、Inspector、Quick Look | 未开始 |
| PR 7 | Remaining Workspaces | History、Automation、Overview、Settings、Onboarding | 未开始 |
| PR 8 | Global QA & Release Gate | 视觉回归、DPI、A11y、性能、文档 | 未开始 |

状态枚举：

- 未开始
- 审计中
- 实现中
- 自查中
- 视觉 QA
- 待 Review
- 已完成
- 阻塞

---

# 4. PR 0 — Product Flow Foundation

## 4.1 分支

```text
codex/ui-v4-2-product-flow
```

## 4.2 目标

建立新的前端领域模型和测试事实，使后续 UI 不再依赖旧的逐文件 `needs-review` 决策模型。

本 PR 允许修改前端 Model、Store、Type 和 Test，但不完成最终页面视觉重构。

## 4.3 必须审计

- `src/types/ui.ts`
- `src/types/domain.ts`
- `src/components/AppShell.tsx`
- `src/views/scanner/ScannerView.tsx`
- `src/views/organize/OrganizeSuggestionsView.tsx`
- `src/views/organize/OrganizeSuggestionList.tsx`
- `src/views/organize/OrganizeSuggestionInspector.tsx`
- `src/views/organize/OrganizeBatchToolbar.tsx`
- `src/views/organize/OrganizeDecisionBar.tsx`
- `src/views/organize/OrganizeTargetDialog.tsx`
- `src/utils/fileNaming.ts`
- `src/views/timeline/PreviewFileRow.tsx`
- `src/views/settings/SettingsView.tsx`
- `src/views/settings/aiSettingsModel.ts`
- `src/views/organize/organizeModel.ts`
- `src/store/useOrganizeDecisionStore.ts`
- `src/store/useOperationQueueStore.ts`
- `src/i18n.ts`
- Organize、Preview、Cleanup 相关测试

## 4.4 必须完成

### 新领域类型

```ts
OrganizeReadiness
OrganizeUserDecision
OrganizeReviewReason
OrganizeResolutionAction
OrganizePlanItem
OrganizePlanGroup
OrganizeDecisionRecordV2
OrganizeAnalysisState
```

### 派生函数

```ts
deriveOrganizeReadiness
deriveOrganizeReviewReasons
deriveOrganizeAvailableActions
deriveOrganizeInitialDecision
buildOrganizePlanItems
groupOrganizePlanItems
summarizeOrganizePlan
```

### 核心规则

- `needs-review` 不再作为用户决定；
- `unsafe-extension-change` 作为独立 Review Reason；
- 无 Preview 的项不得显示接受建议；
- 扩展名不安全的项不得进入 Ready；
- 组级改名逐文件保留扩展名；
- 部分 AI 结果必须保留有效方案；
- 无 Preview 的项不能进入 selected；
- blocked 与 requires-decision 分开；
- Ready 项只有满足全部安全条件才默认选择；
- 删除操作不进入普通 Organize Ready Group；
- Group 从 Item 派生，不单独持久化；
- 最终 Preview 只接收 selected / customized；
- 组级操作最终写回逐文件决定。

### Store 能力

- 单文件决定；
- 组级决定；
- 自定义目标；
- 自定义名称；
- 相似项目批量应用；
- Scope 清理；
- V1 Record 安全失效。

### 测试矩阵

- 无 Preview；
- 低置信度；
- 敏感文件；
- 重复文件；
- 名称冲突；
- 缺少目标；
- unavailable source；
- unsupported action；
- blocked preview；
- Ready 默认选择；
- Grouping；
- Group 排除；
- 文件级排除；
- Preview ID 选择；
- V1 状态失效；
- “需要决定但只有保留原位”的回归测试；
- extension preservation；
- unsafe extension change；
- base-name rename while preserving extension；
- mixed-extension group rename；
- partial AI classification；
- valid results preserved after partial failure；
- retry incomplete classification。

## 4.5 明确不做

- 不修改 Rust；
- 不修改 API 合约；
- 不完成最终 Organize 页面；
- 不修改 Cleanup 页面；
- 不创建第二套意义重叠的 Store；
- 不绕过 Operation Preview。

## 4.6 完成定义

- 新模型命名与文档一致；
- 测试覆盖所有关键路径；
- 旧状态不会进入新 Preview；
- 不安全扩展名建议不会进入 Ready；
- 提议名称通过现有文件名工具规范化；
- 部分分类不会丢弃有效 Plan Item；
- TypeScript、测试、Build 通过；
- Codex 明确列出未验证项。

---

# 5. PR 1 — Design Foundation Finalization

## 分支

```text
codex/ui-v4-2-design-foundation
```

## 目标

完成 V4.2 共享视觉基础，为新工作区提供统一 Primitive。

## 涉及

- `src/styles/tokens.css`
- `src/index.css`
- `src/utils/tw.ts`
- `src/views/shared/ui.ts`
- Settings Primitives
- 共享组件测试

## 必须完成

- Default / Compact Density；
- Micro / Row Radius；
- Typography；
- Surface Level；
- Button / IconButton；
- Input / Search / Select；
- Segmented Control；
- Switch；
- Chip / Badge；
- Metric Strip；
- Notice；
- Empty / Error / Loading；
- List Row；
- Dialog / Popover；
- Focus / Reduced Motion。

## 明确不做

- 不重构业务页面；
- 不改 Rust；
- 不新增业务状态。

---

# 6. PR 2 — Shell, Navigation & Entry Points

## 分支

```text
codex/ui-v4-2-shell-navigation
```

## 目标

落地五项主导航和空间清理三类入口，同时统一 Shell、Page Header、Spotlight 与全局状态。

## 主导航

```text
概览
文件库
整理文件
空间清理
历史记录
```

高级区域：

```text
自动化
设置
```

## 必须完成

- “整理建议”用户文案改为“整理文件”；
- Cleanup 固定导航入口；
- Overview 空间摘要 Cleanup 入口；
- Spotlight 的打开 / 扫描 / 查看 Cleanup 命令；
- Sidebar 220px / 176px；
- AI 状态紧凑化；
- 标题栏与 Window Controls；
- Page Header 只出现一次；
- Toast、Dialog、Focus Restore。

## 测试

- 导航顺序；
- active route；
- Cleanup 可发现；
- Overview 入口；
- Spotlight 命令；
- 中文 / 英文；
- 980×680；
- Keyboard。

---

# 7. PR 3 — Organize Files V2

## 分支

```text
codex/ui-v4-2-organize-v2
```

## 目标

将默认工作流从逐文件审批改为：

> 整理方案 + 例外优先 + 最终预览

## 页面结构

```text
Page Header
Plan Summary
Plan Tabs
Plan / Exceptions / Blocked Content
Sticky Action Bar
```

一级视图：

- 整理方案；
- 需要我决定；
- 暂时无法处理。

## 整理方案

必须实现：

- 按目标和操作分组；
- 显示目标、数量、大小、来源、示例和依据；
- Ready Group 默认选中；
- 组级包含 / 排除；
- 修改整个组的目标；
- 文件名编辑分离基础名称和受保护扩展名；
- 组级改名为每个文件独立生成安全名称；
- 扩展名不安全时提供专门解决操作；
- 展开文件；
- 单文件排除和修改；
- 不需要逐个打开 Inspector 才能理解方案。

## 需要我决定

必须覆盖：

- low-confidence；
- possible-duplicate；
- sensitive-file；
- name-conflict；
- missing-target；
- mixed-group。

每一项：

- 显示具体原因；
- 至少有两个有意义的结果；
- 无 Preview 时不显示“接受建议”；
- 支持仅当前 / 相似项目；
- 永久规则必须显式确认。

## 暂时无法处理

覆盖：

- unavailable-source；
- unsupported-action；
- blocked preview；
- permission。

操作：

- 重试；
- 在文件夹中显示；
- 从本次计划移除；
- 技术详情。

## 旧流程移除

新工作区启用并通过测试后：

- 逐文件 List + Inspector 不再作为默认首页；
- 不保留两个正式入口；
- 移除未使用组件和测试；
- 不为了兼容长期维护两套状态模型。

## 明确不做

- 不修改 Rust；
- 不在 Organize 中直接删除；
- 不绕过 Preview；
- 不静默创建 Rule。

## 视觉 QA

- 326 文件；
- 10+ 方案组；
- 31 个例外；
- 长目标路径；
- 大组展开；
- Light / Dark；
- 中文 / 英文；
- 1440 / 1280 / 1024 / 980；
- Keyboard；
- Reduced Motion。

---

# 8. PR 4 — Storage Cleanup Workflow

## 分支

```text
codex/ui-v4-2-storage-cleanup
```

## 目标

落地固定入口后的四阶段空间清理工作流。

## 阶段

1. 选择位置；
2. 扫描中；
3. 审查建议；
4. 确认与执行；
5. 结果终态。

## 必须完成

- 初始状态只显示范围和扫描；
- 扫描中隐藏结果与 AI；
- Review 阶段统一高密度列表；
- 删除重复 AI 面板和按钮；
- AI 只保留“再检查需要确认的项目”；
- Safe / Review / Caution 用户化；
- Caution 不可直接加入；
- Sticky Safe Trash Bar；
- 结果进入 History；
- Organize 中的重复文件可以跳转 Cleanup 重复筛选。

## 明确不做

- 不改变扫描算法；
- 不改变 Safe Trash；
- 不改变恢复逻辑；
- 不扩大 AI API。

---

# 9. PR 5 — Preview & Execute

## 分支

```text
codex/ui-v4-2-preview-execute
```

## 目标

使同一 Preview Workspace 清楚支持：

- Organize Plan；
- Cleanup Selection；
- Automation。

## 必须完成

- 根据来源显示“返回整理方案”或“返回空间清理”；
- 默认摘要不超过三个核心数字；
- 详细安全信息折叠；
- UI 可按来源组展示，执行仍逐文件；
- 被阻止和未选择明确区分；
- 执行中替换按钮为进度；
- 结果状态和 History 入口；
- 再次检查来源、目标和冲突。

---

# 10. PR 6 — File Library

## 分支

```text
codex/ui-v4-2-file-library
```

## 必须完成

- 单行工具栏；
- 搜索当前范围；
- Filter Chip 第二行按需出现；
- 52px 列表；
- Selected / Focused；
- Quick Look；
- Inspector；
- 双击系统打开；
- 选中文件可加入 Organize 的“需要我决定”队列；
- 桌面键盘模型；
- 980×680 无横向溢出。

---

# 11. PR 7 — Remaining Workspaces

## History

- 三项一级筛选；
- 高级筛选 Popover；
- Metric Strip；
- Restore Bar；
- 技术详情折叠。

## Automation

- 删除 SaaS 式统计卡；
- 规则自然语言摘要；
- 新建规则单一主操作；
- Organize 的“以后这样处理”打开预填规则 Dialog。

## Overview

- Cleanup 固定入口；
- Priority Task；
- 空间摘要；
- 动态隐藏空模块。

## Settings

- Provider Registry；
- Model Discovery；
- Provider Capability-aware Controls；
- Test Connection；
- Request Trace Viewer；
- Export / Clear Diagnostics；
- 诊断仅在 Developer Mode 或高级工具中显示；
- Density；
- Segmented；
- AI 普通 / 高级；
- Sticky Save Bar；
- 不全部卡片化。

## Onboarding

- 三步；
- 扫描范围；
- AI 用户语言；
- 重新打开入口。

---

# 12. PR 8 — Global QA & Release Gate

## 产品流程

- Cleanup 可发现；
- Organize 默认方案分组；
- 例外具有真实选择；
- 无 `needs-review` 决策死路；
- 最终 Preview；
- History Restore。

## 页面状态

- Empty；
- Normal；
- Loading；
- Processing；
- Success；
- Partial；
- Error；
- Permission；
- Long Content；
- Multi-select；
- Disabled；
- Narrow。

## 视口

- 1440×900；
- 1280×800；
- 1180×720；
- 1024×700；
- 980×680。

## 主题与语言

- Light 中文；
- Dark 中文；
- Light English；
- Dark English。

## 平台

- Windows DPI；
- High Contrast；
- Narrator；
- macOS Retina；
- VoiceOver；
- Window Controls；
- Drag Region。

无法验证必须明确记录。

---

# 13. 最终 Release Gate

全部满足才允许完成：

- 空间清理固定导航入口；
- 概览和 Spotlight 有 Cleanup 入口；
- Organize 默认首页不是逐文件列表；
- Ready 项形成方案分组；
- 高可信项可默认加入预览；
- 每个例外显示具体原因；
- 每个 requires-decision 至少有两个真实结果；
- 不存在 `needs-review` 用户决定；
- 无 Preview 不显示接受建议；
- 扩展名不安全项不进入 Ready；
- 组级和文件级改名保留索引扩展名；
- 部分 AI 分类保留有效结果并支持重试未完成项；
- Provider Registry、Model Discovery 和 Request Trace 保持可用；
- Blocked 不进入人工确认队列；
- 分组最终展开为逐文件 Preview；
- 整理文件不直接删除；
- 页面标题零重复；
- 每状态一个 Primary；
- 无硬编码用户文案；
- 无业务组件临时颜色；
- 980×680 无横向溢出；
- Keyboard；
- Focus Restore；
- Light / Dark；
- 中文 / 英文；
- TypeScript、测试、Build 通过；
- 未验证平台能力明确记录。

---

# 14. 当前进度

## PR 0 — Product Flow Foundation

状态：未开始

下一步：

1. Codex 阅读四份文档；
2. 审计 Model、Store、Preview 和 Test；
3. 第一轮只输出差距和实现计划；
4. 人工确认后再编码。

## PR 1–PR 8

状态：未开始
