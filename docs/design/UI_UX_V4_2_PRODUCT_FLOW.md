# Zen Canvas UI/UX V4.2 产品流程与信息架构修订

> 文档角色：V4.2 产品流程事实来源  
> 状态：正式执行基线  
> 适用范围：信息架构、整理文件、空间清理、预览执行、历史恢复  
> 关联文档：
>
> - `docs/design/UI_UX_V4_2_SPEC.md`
> - `docs/design/UI_UX_V4_2_EXECUTION.md`

---

## 1. 修订背景

V4 已经完成设计系统、App Shell、Spotlight、文件库、整理建议、空间清理、历史恢复和设置等主要界面，但真实使用暴露出两个 P0 产品问题：

1. **空间清理存在于代码和页面中，却没有固定导航入口。**
2. **整理文件仍以逐文件审查为主，用户处理大量文件时必须反复查看单个建议。**
3. **`needs-review` 同时承担系统准备状态和用户决定，导致部分文件显示“需要复核”，但实际只有“保留原位”可选。**

这三个问题不能通过修改圆角、间距和按钮样式解决，必须先修正信息架构、工作流和前端领域模型。

---

## 2. 当前实现问题

### 2.1 空间清理不可发现

当前存在独立 `cleanup` View 和 `StorageCleanupView`，但主导航没有“空间清理”。

目前用户主要依赖概览页的优先任务状态，才可能被带到 Cleanup。这意味着：

- 用户不知道应用具有空间清理能力；
- 用户无法主动开始空间扫描；
- 没有已有清理结果时，入口更难出现；
- 核心功能依赖系统状态偶然暴露。

### 2.2 整理文件仍是逐文件审批

当前 Organize Workspace 的主体是：

- 左侧单文件列表；
- 右侧 Inspector；
- 用户选择单个文件；
- 查看当前路径、建议目标、原因和风险；
- 再选择接受、保留或编辑名称。

即使存在批量模式，用户仍然需要先找出并选择文件。对于几百个文件，这只是将“手工整理”变成“手工审核 AI 建议”。

### 2.3 `needs-review` 状态混合了不同问题

当前文件可能因为以下任意原因进入 `needs-review`：

- 低置信度；
- 敏感文件；
- 重复文件；
- 需要确认；
- Preview 要求确认。

但接受建议和编辑能力又依赖：

- 是否存在 Preview；
- Preview 是否 Pending；
- 是否可执行；
- 是否存在 Blocking Reason；
- 是否允许编辑名称。

因此可能出现：

- 状态显示“需要复核”；
- 接受按钮禁用；
- 编辑按钮禁用；
- 只剩“保留原位”。

这不是有效的用户决策，而是没有可用方案时错误使用了“需要复核”标签。

---

## 2A. 最新实现基线

当前 `master` 已具备：

- AI Provider Registry 与 Provider Capability；
- 模型发现；
- Request Trace 与请求诊断；
- AI 分类部分结果保留；
- 文件名规范化；
- 索引扩展名保护；
- 扩展名不匹配时强制 Review；
- Preview 与执行队列中的安全文件名处理。

新产品流程必须建立在这些能力之上，不能以旧版代码快照为准。

### 2A.1 兼容原则

- 第一版 Organize V2 继续复用现有 Operation Preview；
- 第一版尽量不修改 Rust API；
- 前端派生 Readiness、Review Reason、Available Actions 和 Group；
- 不重新编写扩展名解析；
- 不因部分失败丢弃有效结果；
- Settings 后续重新分层，但保留全部 Provider 和诊断能力。

---

## 3. 产品原则修订

### 3.1 发现性优先于导航数量

不再坚持“一级主导航最多四项”。

核心用户任务必须拥有固定、可预测入口。

### 3.2 方案优先，而不是文件优先

整理对象从：

> 单个文件建议

改为：

> 一组具有相同目标和依据的整理方案

用户默认审查方案和例外，不审查所有文件。

### 3.3 例外优先

高置信度、无冲突、非敏感、可执行的整理项进入默认选中的整理方案。

用户主要处理：

- 低置信度；
- 目标不明确；
- 重复文件；
- 敏感文件；
- 名称冲突；
- 文件不可用；
- 不支持的操作。

### 3.4 系统状态与用户决定分离

系统可以判断：

- 已准备好；
- 需要用户决定；
- 暂时无法处理。

用户可以决定：

- 包含在本次整理；
- 修改目标；
- 保留原位；
- 稍后处理。

“需要复核”不能再作为用户决定值。

### 3.5 不因分组降低安全性

方案分组只改变审查方式，不改变安全边界：

- 最终仍生成逐文件 Operation Preview；
- 最终仍执行逐文件冲突检查；
- 最终仍需要用户进入预览；
- 文件变更仍可从历史记录恢复；
- 分组接受不等于立即执行。

---

# 4. V4.2 信息架构

## 4.1 主导航

```text
Zen Canvas

概览
文件库
整理文件
空间清理
历史记录

────────────

自动化
设置
```

### 导航含义

| 入口 | 用户问题 |
|---|---|
| 概览 | 现在最值得处理的是什么？ |
| 文件库 | 我的文件在哪里？ |
| 整理文件 | 怎样把文件放得更有序？ |
| 空间清理 | 怎样安全释放磁盘空间？ |
| 历史记录 | 刚才发生了什么，能否恢复？ |
| 自动化 | 怎样让相同工作以后自动完成？ |
| 设置 | 如何调整应用行为？ |

## 4.2 空间清理的三类入口

空间清理必须同时具备：

1. **侧边栏固定入口**
2. **概览空间摘要入口**
3. **Spotlight 命令入口**

### 概览入口

空间摘要区域提供：

> 检查可释放空间

当已有分析结果时显示：

> 可释放约 4.8 GB · 查看清理建议

### Spotlight 命令

至少支持：

- 打开空间清理；
- 扫描可清理空间；
- 查看清理建议。

## 4.3 页面之间的关系

```text
概览
 ├── 扫描文件
 ├── 打开整理文件
 ├── 打开空间清理
 └── 打开历史记录

文件库
 ├── 选择文件后加入整理审查
 ├── 在文件夹中显示
 └── Quick Look / 打开文件

整理文件
 ├── 整理方案
 ├── 需要我决定
 ├── 暂时无法处理
 └── 最终预览

空间清理
 ├── 选择位置
 ├── 扫描空间
 ├── 审查清理建议
 └── 安全废纸篓

预览执行
 └── 历史记录 / 恢复

自动化
 └── 可由用户明确选择“以后也这样处理”创建规则
```

---

# 5. 整理文件 V2：整体工作流

## 5.1 工作流

```text
选择或继承当前文件范围
        ↓
加载分类结果与 Operation Preview
        ↓
生成逐文件整理项
        ↓
按目标与操作生成整理方案组
        ↓
┌─────────────────────────────┐
│ 整理方案     需要我决定     暂时无法处理 │
└─────────────────────────────┘
        ↓
用户主要处理例外
        ↓
预览已选择操作
        ↓
逐文件重新验证
        ↓
执行
        ↓
历史记录可恢复
```

## 5.2 页面摘要

```text
整理文件

已分析 326 个文件

285 个已加入整理方案
31 个需要你决定
10 个暂时无法处理

没有文件会在最终预览前移动。
```

主操作：

> 预览已选择的 285 项操作

---

# 6. 整理文件 V2：一级视图

## 6.1 整理方案

展示：

- 已准备好的高置信度分组；
- 默认选中的安全项目；
- 目标文件夹；
- 数量与大小；
- 来源位置；
- 示例文件；
- 分组依据；
- 风险和冲突摘要。

用户不需要逐文件批准。

## 6.2 需要我决定

只展示真正需要用户输入才能继续的项目。

每个项目必须明确：

- 为什么需要用户决定；
- 系统已经知道什么；
- 当前有什么可行选择；
- 哪些选择可以批量应用；
- 是否可以创建以后自动处理的规则。

## 6.3 暂时无法处理

只展示当前不能形成有效操作的项目：

- 来源文件不存在；
- 权限不足；
- 操作类型不支持；
- Preview 被阻止；
- 目标路径无效且无法自动修复；
- 当前平台不支持该文件操作。

这些项目不得伪装成“需要确认”。

---

# 7. 整理方案分组规则

## 7.1 分组键

第一版优先使用现有前端数据派生，无需立即修改 Rust API。

建议分组键：

```ts
groupKey = [
  operationType,
  normalizedTargetParent,
  suggestedAction,
  primaryReasonFamily
].join("::");
```

其中：

- `operationType`：move / rename / move_rename；
- `normalizedTargetParent`：最终目标父目录；
- `suggestedAction`：Move / Rename / MoveAndRename / Archive；
- `primaryReasonFamily`：规则、文件类型、用途或上下文的稳定归因。

不得将以下项目放入普通 Ready Group：

- Sensitive；
- Duplicate；
- requires_confirmation；
- confidence 低于阈值；
- Preview 不可执行；
- Blocking Reason 存在；
- 来源不可用；
- 目标缺失；
- 名称冲突未解决。

## 7.2 组级摘要

每个组至少包括：

```ts
interface OrganizePlanGroupSummary {
  id: string;
  targetPath: string;
  operationType: OperationType;
  itemCount: number;
  selectedCount: number;
  totalSize: number;
  sourceDirectories: string[];
  sampleFiles: string[];
  averageConfidence: number;
  minimumConfidence: number;
  reasonSummary: string;
  warningCount: number;
  conflictCount: number;
}
```

## 7.3 默认选择规则

只有满足以下全部条件的项目才允许默认选择：

- readiness 为 `ready`；
- Preview 存在；
- Preview 为 `pending`；
- Preview 可执行；
- 无 Blocking Reason；
- 非敏感；
- 非重复；
- 无需确认；
- confidence 达到安全阈值；
- target_path 有效；
- 操作不是 `move_to_trash`。

推荐阈值：

```ts
DEFAULT_READY_CONFIDENCE = 0.8;
```

默认选择只表示：

> 包含在本次预览中

不表示立即执行。

---

# 8. 整理方案桌面端 Wireframe

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 整理文件                                         [预览 285 项操作] │
│ 已分析 326 个文件 · 没有文件会在最终预览前移动                      │
├──────────────────────────────────────────────────────────────────────┤
│ [整理方案 285] [需要我决定 31] [暂时无法处理 10]       范围 ▾  ··· │
├──────────────────────────────────────────────────────────────────────┤
│ ✓ 已选择全部高可信整理项                         285 个文件 · 6.4GB │
│    取消勾选任意组即可排除；执行前还会逐文件检查冲突                  │
├──────────────────────────────────────────────────────────────────────┤
│ ▼ ✓ 图片 / 截图                                      86 个 · 426MB │
│     目标：~/Pictures/Screenshots                                  │
│     来源：桌面 21 · 下载 47 · 微信图片 18                            │
│     依据：文件类型、文件名模式和来源位置高度一致                    │
│     示例：Screenshot 2026-07-21.png · 微信截图_20260722.png         │
│                          [修改目标] [查看 86 个文件]                 │
├──────────────────────────────────────────────────────────────────────┤
│ ▶ ✓ 学习资料 / 数据库技术                             54 个 · 186MB │
│     目标：~/Documents/Study/Database                                │
├──────────────────────────────────────────────────────────────────────┤
│ ▶ ✓ 软件安装包                                        23 个 · 3.8GB │
│     目标：~/Downloads/Software                                      │
├──────────────────────────────────────────────────────────────────────┤
│ 已选择 285 项 · 6.4GB                         [预览已选择的操作]     │
└──────────────────────────────────────────────────────────────────────┘
```

## 8.1 组的交互

点击组标题：

- 展开 / 收起文件明细；
- 不进入单独 Inspector 才能理解基本方案。

组级操作：

- 包含 / 排除整个组；
- 修改整个组的目标；
- 展开文件；
- 在文件库中查看；
- 将组内例外移入“需要我决定”。

文件级操作只在展开后出现：

- 排除单个文件；
- 修改目标；
- 保留原位；
- 查看文件；
- Quick Look。

---

# 9. 整理方案窄窗口 Wireframe

```text
┌──────────────────────────────────────┐
│ 整理文件                 [预览 285] │
│ 已分析 326 个文件                    │
├──────────────────────────────────────┤
│ 整理方案 | 需要决定 | 无法处理       │
├──────────────────────────────────────┤
│ ✓ 图片 / 截图              86 个     │
│   ~/Pictures/Screenshots             │
│   桌面、下载、微信图片               │
│   [查看详情]                         │
├──────────────────────────────────────┤
│ ✓ 学习资料                 54 个     │
│   ~/Documents/Study/Database         │
│   [查看详情]                         │
├──────────────────────────────────────┤
│ 已选择 285 项 · 6.4GB                │
│ [预览已选择的操作]                   │
└──────────────────────────────────────┘
```

详情进入同一工作区的详情 Pane，不使用叠加大量小弹窗。

---

# 10. “需要我决定”工作流

## 10.1 统一结构

每个例外项必须显示：

```text
为什么需要你决定
文件与当前位置
系统建议或候选方案
可执行的用户选择
是否应用到相似文件
```

不得显示：

- “需要复核”但没有具体原因；
- 主要操作全部禁用；
- 只有“保留原位”可选；
- 无 Preview 却显示“接受建议”。

## 10.2 按原因分组

一级可按照原因分组：

- 目标位置不确定；
- 可能是重复文件；
- 文件可能包含敏感内容；
- 目标位置存在同名文件；
- 系统无法确定文件用途；
- 一组文件中存在不同用途。

---

# 11. Review Reason 与用户操作

## 11.1 低置信度 `low-confidence`

用户说明：

> Zen Canvas 无法可靠判断这个文件的用途。

操作：

- 选择目标文件夹；
- 选择一个候选分类；
- 保留原位；
- 稍后处理。

批量能力：

- 应用到当前相似文件；
- 明确选择后可创建自动化规则。

## 11.2 可能重复 `possible-duplicate`

用户说明：

> 找到了内容相同或高度相似的文件。

操作：

- 查看对比；
- 保留两者；
- 保留较新的文件；
- 将候选项交给空间清理；
- 稍后处理。

原则：

- 整理工作区不应静默删除重复文件；
- 删除相关选择应进入空间清理或 Safe Trash 确认流程。

## 11.3 敏感文件 `sensitive-file`

用户说明：

> 这个文件可能包含隐私、身份或重要资料。

操作：

- 查看文件；
- 允许按建议移动；
- 选择其他目标；
- 保留原位；
- 稍后处理。

不得批量默认批准敏感文件。

## 11.4 名称冲突 `name-conflict`

用户说明：

> 目标位置已经存在同名文件。

操作：

- 自动添加编号；
- 修改文件名；
- 选择其他文件夹；
- 查看两个文件；
- 保留原位。

可以批量应用：

- 对本组所有冲突自动编号。

## 11.5 扩展名不安全 `unsafe-extension-change`

用户说明：

> 建议名称试图改变文件扩展名。为避免文件失效，Zen Canvas 已阻止这次改名。

示例：

```text
Install_Package.lnk → Install_Package.exe
```

可用操作：

- 保留原扩展名并修改基础名称；
- 只移动，不重命名；
- 选择其他安全名称；
- 保留原位；
- 稍后处理。

规则：

- 不得进入 Ready；
- 不得默认选择；
- 不安全名称不得进入 Preview；
- 组级改名必须逐文件保留各自扩展名；
- 必须复用当前文件名规范化工具。

## 11.6 缺少目标 `missing-target`

用户说明：

> 当前没有可执行的目标文件夹。

操作：

- 选择目标文件夹；
- 保留原位；
- 稍后处理。

不得显示“接受建议”。

## 11.7 混合分组 `mixed-group`

用户说明：

> 这些文件看起来相似，但可能属于不同用途。

操作：

- 拆分为候选子组；
- 为选中文件指定目标；
- 保留原位；
- 稍后处理。

## 11.8 来源不可用 `unavailable-source`

用户说明：

> 文件已经移动、删除，或当前无法访问。

操作：

- 重新检查；
- 在文件夹中查找；
- 从本次计划移除。

不得作为人工整理建议继续展示。

## 11.9 不支持的操作 `unsupported-action`

用户说明：

> 当前平台或当前版本无法安全完成这项操作。

操作：

- 在文件夹中显示；
- 保留原位；
- 从计划移除；
- 查看技术详情。

---

# 12. 例外项 Wireframe

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 目标位置不确定                                                18 项 │
├──────────────────────────────────────────────────────────────────────┤
│ project-final.pdf                                                     │
│ 当前：~/Downloads/project-final.pdf                                   │
│                                                                      │
│ 可能属于：                                                           │
│ [项目资料]  ~/Documents/Projects                                     │
│ [学习资料]  ~/Documents/Study                                        │
│                                                                      │
│ [选择其他文件夹] [保留原位] [稍后处理]                               │
│ □ 将选择应用到另外 17 个相似文件                                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

# 13. 相似项目一次性决定

当同一 Review Reason 下存在相似项目时，提供：

```text
仅应用到这个文件
应用到这 18 个相似文件
以后遇到类似文件时也这样处理
```

第三项必须：

- 显式展示即将创建的规则；
- 允许用户编辑规则名称、范围和条件；
- 不能静默创建 Automation Rule；
- 不能将本次临时选择自动升级为永久规则。

---

# 13A. 部分 AI 分类结果

AI 分析必须支持：

```ts
export type OrganizeAnalysisState =
  | "idle"
  | "analyzing"
  | "complete"
  | "partial"
  | "failed"
  | "canceled";
```

`partial` 表示：

- 一部分文件已经获得有效结果；
- 一部分文件没有返回可靠结果；
- 已有有效结果必须保留；
- 用户可以先审查已生成方案；
- 用户可以只重试未完成文件。

映射规则：

- 有安全、有效 Preview 的文件正常派生 Ready / Requires Decision；
- 有候选信息但仍需用户输入的文件进入“需要我决定”；
- 完全缺少可执行信息的文件进入“暂时无法处理”；
- 未完成文件不得无依据进入 Ready；
- 少量失败不得清空整批方案。

---

# 14. 新的前端领域模型

## 14.1 系统准备状态

```ts
export type OrganizeReadiness =
  | "ready"
  | "requires-decision"
  | "blocked";
```

含义：

- `ready`：已形成安全、可执行的 Preview；
- `requires-decision`：必须获得用户输入才能形成最终动作；
- `blocked`：当前没有用户选择可以直接使其执行。

## 14.2 用户决定

```ts
export type OrganizeUserDecision =
  | "pending"
  | "selected"
  | "excluded"
  | "customized"
  | "keep"
  | "deferred";
```

含义：

- `pending`：尚未决定；
- `selected`：包含在最终预览；
- `excluded`：从本次计划排除，但不表达永久保留；
- `customized`：修改目标或名称后包含；
- `keep`：明确保留原位；
- `deferred`：稍后处理，继续保留在例外队列。

## 14.3 复核原因

```ts
export type OrganizeReviewReason =
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

允许一项包含多个原因，但必须确定一个 `primaryReviewReason` 用于界面分组。

## 14.4 可用操作

```ts
export type OrganizeResolutionAction =
  | "select-suggested"
  | "choose-target"
  | "choose-category"
  | "rename"
  | "rename-preserving-extension"
  | "move-without-rename"
  | "auto-rename"
  | "compare-files"
  | "keep-both"
  | "send-to-cleanup"
  | "reveal-source"
  | "retry"
  | "keep"
  | "defer"
  | "remove-from-plan";
```

界面不得自行通过多个布尔值猜测按钮。

每个计划项应由模型明确提供：

```ts
availableActions: OrganizeResolutionAction[];
```

## 14.5 计划项

```ts
export interface OrganizePlanItem {
  id: string;
  file: FileRecord;
  basePreview: OperationPreview | null;
  effectivePreview: OperationPreview | null;

  readiness: OrganizeReadiness;
  reviewReasons: OrganizeReviewReason[];
  primaryReviewReason: OrganizeReviewReason | null;

  decision: OrganizeUserDecision;
  selectedByDefault: boolean;

  availableActions: OrganizeResolutionAction[];

  customTargetPath?: string;
  customName?: string;

  signature: string;
  groupKey: string | null;
}
```

## 14.6 计划组

```ts
export interface OrganizePlanGroup {
  id: string;
  key: string;

  targetPath: string;
  operationType: OperationType;
  suggestedAction: SuggestedAction;

  items: OrganizePlanItem[];

  totalSize: number;
  selectedCount: number;
  selectedSize: number;

  sourceDirectories: string[];
  sampleFileIds: string[];

  averageConfidence: number;
  minimumConfidence: number;

  reasonSummary: string;
  warningCount: number;
  conflictCount: number;
}
```

## 14.7 决策记录 V2

```ts
export interface OrganizeDecisionRecordV2 {
  version: 2;

  fileId: string;
  scopeKey: string;
  signature: string;

  decision: OrganizeUserDecision;

  customTargetPath?: string;
  customName?: string;

  resolutionAction?: OrganizeResolutionAction;
  appliedFromGroupId?: string;
  appliedFromSimilarBatchId?: string;
}
```

---

# 15. 模型派生规则

## 15.1 Readiness

伪代码：

```ts
function deriveReadiness(
  file: FileRecord,
  preview: OperationPreview | null
): OrganizeReadiness {
  if (
    file.is_deleted ||
    file.is_stale ||
    preview?.is_executable === false ||
    Boolean(preview?.blocking_reason)
  ) {
    return "blocked";
  }

  if (
    !preview ||
    !preview.target_path.trim() ||
    file.risk_level === "Sensitive" ||
    file.lifecycle === "Sensitive" ||
    file.requires_confirmation ||
    file.is_duplicate ||
    preview.requires_confirmation ||
    file.confidence < 0.8
  ) {
    return "requires-decision";
  }

  return "ready";
}
```

重要区别：

- 没有 Preview 的项目不是“等待接受建议”；
- 没有目标的项目需要用户选择目标；
- blocked 与 requires-decision 必须分开。

## 15.2 默认决定

```ts
function initialDecision(item: OrganizePlanItem): OrganizeUserDecision {
  if (item.readiness === "ready" && item.selectedByDefault) {
    return "selected";
  }

  return "pending";
}
```

## 15.3 Preview 选择

最终预览只接收：

- `selected`；
- `customized`；

且必须具有有效 `effectivePreview`。

`keep`、`excluded`、`deferred` 和 `pending` 不进入最终 Preview。

---

# 16. Store 与迁移策略

## 16.1 当前事实

当前 `useOrganizeDecisionStore` 是普通 Zustand `create` Store，没有持久化中间件。

因此：

- 当前决定主要存在于运行时内存；
- 应用重启后不会自动迁移旧决定；
- V2 上线时不存在复杂的持久化数据库迁移。

## 16.2 推荐 Store

可以将现有 Store 演进为：

```ts
interface OrganizePlanStore {
  decisions: Record<string, OrganizeDecisionRecordV2>;

  syncPlan(...): void;

  setDecision(...): boolean;
  setCustomTarget(...): boolean;
  setCustomName(...): boolean;

  applyGroupDecision(...): void;
  applySimilarResolution(...): void;

  clearDecision(...): void;
  clearScope(...): void;
}
```

可以保留文件名 `useOrganizeDecisionStore.ts` 以减少一次性影响，也可以在完成调用迁移后重命名为：

```text
useOrganizePlanStore.ts
```

不得长期同时维护两个意义重叠的 Store。

## 16.3 旧状态处理

即使当前不持久化，也必须避免热更新或同一会话中的旧状态错误复用。

方案：

- `signature` 加入 `MODEL_VERSION = 2`；
- Store 初始化 V2 时清空 V1 Record；
- 测试环境显式重置 Store；
- 如果未来增加持久化，使用 `version: 2` 和 migrate；
- 无法迁移的 V1 Decision 安全失效为 `pending`。

---

# 17. 与现有 Operation Preview 的关系

第一版 V2 不要求修改 Rust Preview API。

继续使用现有字段：

- `operation_type`
- `source_path`
- `target_path`
- `risk_level`
- `confidence`
- `requires_confirmation`
- `selected_by_default`
- `is_executable`
- `blocking_reason`
- `editable_new_name`
- `will_create_parent`

前端新增的职责：

1. 派生 Readiness；
2. 派生 Review Reasons；
3. 派生 Available Actions；
4. 生成 Group；
5. 管理用户决定；
6. 为自定义目标构建有效 Preview Override；
7. 最终仍交由 Operation Queue 逐文件验证。

如果现有 API 无法为“修改整个目标文件夹”生成安全 Preview，才在后续独立任务中扩展 API。不得先扩大 Rust 修改范围。

---

# 18. 组件架构建议

```text
src/views/organize/
  OrganizeWorkspace.tsx
  organizeModel.ts

  components/
    OrganizePlanSummary.tsx
    OrganizePlanTabs.tsx
    OrganizePlanGroupList.tsx
    OrganizePlanGroupRow.tsx
    OrganizePlanGroupDetails.tsx
    OrganizeExceptionList.tsx
    OrganizeExceptionItem.tsx
    OrganizeBlockedList.tsx
    OrganizePlanActionBar.tsx
    OrganizeTargetPickerDialog.tsx
    OrganizeSimilarDecisionDialog.tsx
```

迁移原则：

- 不一次性删除所有旧组件；
- 先建立新 Model 和新 Workspace；
- 测试覆盖后移除旧 `OrganizeSuggestionInspector` 等逐文件主流程；
- 文件明细仍可复用部分现有 List / FileTypeIcon；
- Preview 页面继续复用 Operation Queue。

---

# 19. 空间清理完整交互流程

## 19.1 页面入口

空间清理是固定主导航，不再依赖已有分析结果。

## 19.2 四阶段状态机

```ts
type CleanupWorkspaceStage =
  | "select-scope"
  | "scanning"
  | "reviewing"
  | "confirming"
  | "executing"
  | "result";
```

## 19.3 阶段一：选择位置

显示：

- 当前扫描范围；
- 选择文件夹；
- 快捷位置；
- 上次使用范围；
- 开始扫描。

隐藏：

- AI 面板；
- 禁用 AI 操作；
- 候选列表；
- 统计卡；
- 筛选；
- 执行按钮。

Wireframe：

```text
┌─────────────────────────────────────────────────────┐
│ 空间清理                                            │
│ 安全检查可以释放的空间，任何移除项都可从历史恢复。  │
├─────────────────────────────────────────────────────┤
│ 扫描位置                                            │
│ 当前：下载、桌面                                    │
│                                                     │
│ [选择文件夹]     快捷位置 ▾                         │
│                                                     │
│                                  [开始扫描]         │
└─────────────────────────────────────────────────────┘
```

## 19.4 阶段二：扫描中

显示：

- 已扫描条目；
- 已扫描大小；
- 当前路径；
- 取消扫描。

隐藏全部结果和 AI 操作。

```text
正在扫描空间

已检查 12,483 个项目
已分析 18.6 GB
当前：~/Downloads/Installers

[取消扫描]
```

## 19.5 阶段三：审查建议

摘要：

```text
预计可安全释放 4.8 GB
23 个项目需要你确认
4 个项目建议谨慎处理
```

一级筛选：

- 全部；
- 可安全清理；
- 需要确认；
- 谨慎处理。

AI 只提供一个主上下文动作：

> AI 再检查 23 个需要确认的项目

项目可以按类别分组：

- 安装包；
- 临时文件；
- 重复文件；
- 大型旧文件；
- 应用缓存；
- 其他。

## 19.6 阶段四：确认执行

Sticky Bar：

```text
已选择 18 项 · 预计释放 3.2 GB

[移入安全废纸篓]
```

规则：

- Safe 可默认选择；
- Review 需要显式选择和确认；
- Caution 不允许直接加入；
- 删除操作永不混入普通 Organize Group；
- 执行前显示逐项目 Preview。

## 19.7 结果

显示：

- 成功移入多少；
- 释放多少；
- 跳过多少；
- 失败多少；
- 查看历史；
- 恢复操作。

---

# 20. 整理与清理的边界

| 任务 | 整理文件 | 空间清理 |
|---|---|---|
| 移动到更合理文件夹 | 是 | 否 |
| 重命名 | 是 | 否 |
| 归档 | 是 | 可提供入口但不直接处理 |
| 重复文件判断 | 识别并转交 | 审查与移除 |
| 删除 / Safe Trash | 不直接进行 | 是 |
| 释放磁盘空间 | 不是核心目标 | 是 |
| 最终 Preview | 是 | 是 |
| 历史恢复 | 是 | 是 |

当 Organize 识别出重复文件时：

> 将其发送到空间清理的“重复文件”队列

而不是在整理建议中直接显示删除按钮。

---

# 21. Preview & Execute 修订

Preview 页面继续以逐文件操作为最终安全事实来源。

来源可能是：

- Organize Plan；
- Cleanup Selection；
- Automation Rule。

页面顶部默认只显示：

```text
即将执行 285 项操作

279 项可以执行
6 项需要处理冲突
```

详细安全统计折叠。

从 Organize 返回时：

> 返回整理方案

从 Cleanup 返回时：

> 返回空间清理

不得统一写成模糊“返回”。

---

# 22. 验收标准

## 22.1 信息架构

- 空间清理固定出现在主导航；
- 概览存在空间清理入口；
- Spotlight 存在空间清理命令；
- 用户无需先有清理结果即可进入 Cleanup。

## 22.2 整理方案

- 默认视图不是逐文件列表；
- Ready 项按方案分组；
- 组显示目标、数量、大小、来源、依据和示例；
- 高可信安全项可以默认选中；
- 用户可以排除整个组或单个文件；
- 最终仍进入逐文件 Preview。

## 22.3 需要我决定

- 不再显示含糊 `needs-review` 用户状态；
- 每项显示具体原因；
- 每项至少有两个有意义的结果；
- 无 Preview 时不显示“接受建议”；
- 扩展名不安全的建议显示专门原因与安全操作；
- 组级改名逐文件保留索引扩展名；
- 部分 AI 分类保留有效结果并支持只重试未完成项；
- 低置信度、重复、敏感、冲突等使用不同操作；
- 支持将决定应用到相似文件；
- 创建自动化规则必须显式确认。

## 22.4 暂时无法处理

- Blocked 与 Requires Decision 分离；
- 来源不可用和不支持操作不进入人工确认队列；
- 用户能重试、在文件夹中显示或从计划移除。

## 22.5 空间清理

- 固定入口；
- 四阶段工作流；
- 初始阶段不展示禁用 AI 操作；
- 不存在重复 AI 入口；
- Safe / Review / Caution 使用用户语言；
- Review 与 Caution 安全逻辑不退化。

## 22.6 技术

- 第一版尽量不修改 Rust API；
- 新模型测试覆盖；
- V1 运行时决定安全失效；
- Operation Preview 与执行安全检查继续生效；
- Light / Dark；
- 中文 / 英文；
- 980×680；
- Keyboard；
- Reduced Motion。

---

# 23. 不得接受的实现

以下实现即使视觉更漂亮，也视为未完成：

- 仍以逐文件列表作为整理默认首页；
- 只是新增“全选”按钮；
- 只是默认展开第一个文件 Inspector；
- 仍把 `needs-review` 保存为用户决定；
- 仍出现“需要决定但只有保留原位”；
- 为了实现分组绕过最终 Preview；
- 组级接受后立即执行；
- 将重复文件直接删除；
- 将空间清理继续隐藏在概览状态中；
- 同时保留新旧两套 Organize Workspace；
- 因为 UI 重构而修改 Rust 安全边界。
