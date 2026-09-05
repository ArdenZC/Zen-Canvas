# W6-04 File Library Rendered Review Result

## 1. 结论

- **评审类型**：Windows 原生 Tauri/Computer Use 渲染验收；不是浏览器 mock，也不是 Codex Review。
- **评审状态**：COMPLETE（R0–R12 已执行；无法安全或真实完成的项明确标记 `UNVERIFIED`）。
- **P0/P1 安全结论**：未发现数据丢失、文件系统安全或安全边界问题；未执行删除、移动、重命名、恢复或清理用户文件。
- **最终决策**：

  **ACTIVATE BOUNDED W6-04 IMPLEMENTATION**

  仅激活一个有边界的 W6-04 后续：修复并重新验证 File Library 筛选弹层在中等窗口宽度下的定位/可用性。不得扩展为 W6-05 安装、发布或 Explorer Preview 工作。

## 2. R0：来源、基线和环境

评审日期：2026-09-05（Asia/Shanghai）。

| 项目 | 实际值 |
| --- | --- |
| 仓库 | `ArdenZC/Zen-Canvas`，工作目录 `F:\Coding\Zen-Canvas` |
| 评审分支 | `docs/w6-04-file-library-rendered-review-result` |
| 同步方式 | `git fetch origin master`，随后基于最新 `origin/master` 快进同步；目标分支与 `origin/master` 当前同点 |
| 评审开始 HEAD | `9895079a4ebb1e810b8c42d6a74b24ba147c6645` |
| `origin/master` | `9895079a4ebb1e810b8c42d6a74b24ba147c6645` |
| 评审开始完整 tree | `b93e73711c7ca12683d113d7d4708b16ab7139c9` |
| W6-03 预期生产基线 | `9fd34956c8907810fea676e643202ea735af46df` |
| W6-03 生产 tree | `237d63c842a200eba1058d206c9dc89a7b0e6ebf` |
| 基线差异 | 仅有项目当前真相/启动记录/本任务记录等文档差异；未发现 production source 差异 |
| Windows | Windows 11 专业版，版本 `10.0.26200`，Build `26200` |
| 架构 | OS 与进程均为 x64 |
| 主显示器 | `1920×1080`，工作区 `1920×1032` |
| 系统显示缩放 | `96 DPI / 100%`；未更改系统设置 |
| 原生应用 | `F:\CargoTarget\debug\zen-canvas.exe`，真实窗口标题 `Zen Canvas` |
| 原生控制面 | 通过 Computer Use 的真实窗口/控件树和截图操作；未使用浏览器 tab、browser mock、PowerShell UIA 或脚本替代 native evidence |

评审过程中发现一次 Git 的 racy-clean 时间戳状态，`src-tauri/Cargo.toml` 内容哈希与 HEAD 相同；刷新索引后工作树恢复干净。没有覆盖、重置或吸收该路径的内容。

## 3. 构建和启动来源

- 依赖安装：`npm ci --no-audit --no-fund`，退出码 0；未修改 source 或 lockfile。
- 真实开发启动命令：

  ```text
  npm run dev -- --config '{"identifier":"com.startlan.zencanvas.w604qa"}'
  ```

- 隔离应用标识：`com.startlan.zencanvas.w604qa`。
- 隔离应用数据目录：
  - `C:\Users\77588\AppData\Roaming\com.startlan.zencanvas.w604qa`
  - `C:\Users\77588\AppData\Local\com.startlan.zencanvas.w604qa`
- 首次未隔离启动观察到已有用户数据库/已安装全局索引服务造成的活动运行锁；随后使用隔离标识和新夹具完成了真实 native 验收。预先存在的 `C:\Program Files\Zen Canvas\zen-canvas.exe --index-service` 未停止、未修改；用户数据库未删除或清理。
- 关闭应用时使用 Zen Canvas 自身的“直接退出”确认；未强杀进程。

## 4. R1：安全夹具

夹具位于非系统盘、仓库忽略目录 `.tmp-tests`，仅包含人工构造的无敏感内容。首次夹具因隔离实例中已有 active-run 状态而不能继续，随后创建了新目录并成功完成扫描：

```text
F:\Coding\Zen-Canvas\.tmp-tests\w6-04-rendered-review-20260905
F:\Coding\Zen-Canvas\.tmp-tests\w6-04-rendered-review-20260905-unique
```

有效夹具包含 5 个子目录（`Archive`、`Data`、`Project Notes`、`Source`、`Specs`）和 10 个文件，覆盖 Markdown、TXT、JSON、CSV、TypeScript、中文文件名等类型。有效 root 的 Overview 显示扫描完成、10 files / 569 B；File Library 显示 16 / 16（目录和文件条目）。

验收结束前已逐一核对两个确切路径的文件清单，并仅删除这两个任务专属目录；删除后再次检查确认均不存在。未删除 `.tmp-tests` 下其他内容、`node_modules`、Cargo 缓存、应用数据或用户文件。

## 5. R2–R4：File Library 原生渲染和交互

### R2 原生启动与 onboarding

PASS。真实 Tauri 窗口启动并呈现 onboarding；使用真实 Windows 文件夹选择器，通过地址栏导航到有效夹具，返回 Zen Canvas 后显示已选择 1 个扫描目录，并进入 File Library。首次夹具的 active-run 错误被如实保留为环境观察，没有伪造成功状态。

### R3 默认状态、层级和控件

PASS（有效夹具）。默认 File Library 状态实际显示：

- 全局搜索入口和左侧主导航，File Library 为当前工作区；
- File Library / Browse 工作模式、导航、搜索、筛选、排序、已保存视图；
- 列表/网格/上下文视图切换、查看全部索引文件、切换扫描目录、已保存视图和标签管理；
- scope、16 / 16 结果计数、已选项计数和真实文件/目录列表；
- 后端来源提示“文件库只浏览本机索引，不上传文件”。

初始空状态也被观察到：没有索引结果时显示前往概览开始扫描/查看全部索引文件；该状态没有被当作有数据时的结果总数。

### R4 状态矩阵

| 场景 | 结果 | 证据/限制 |
| --- | --- | --- |
| Library 空/默认状态 | PASS | 原生窗口中的空状态、scope、操作入口均可见 |
| Library 有效夹具浏览 | PASS | 10 files / 569 B；16 / 16 结果 |
| Browse 空状态 | PASS | 原生显示“准备浏览文件”“当前没有打开文件夹”，并明确不会读取/索引/纳入文件库 |
| Browse 打开位置 | `UNVERIFIED` | 两个位置均为后端 `状态未知`，`打开位置` disabled；不能把后端不可用状态推测成 UI PASS 或 FAIL |
| 搜索 | PASS | 输入 `README` 后结果从 16 / 16 变为 1 / 1，仅显示 `README.md`；清除后恢复 16 / 16 |
| 筛选按钮和弹层 | **P2 FAIL** | 1282×862 中等窗口打开后，弹层主要被左侧导航/工作区边界遮挡，仅露出约 90 px，控件不能真实操作；筛选值应用因此为 `UNVERIFIED` |
| 选择 | PASS | 选择 `Review Index.md` 后显示“已选 1 个已加载项”；未触发文件系统操作 |
| Markdown Preview | PASS | 双击 `Review Index.md`，真实浮动快速预览显示 Markdown 内容和“预览内容已准备好” |
| 相邻目录 Preview | `UNVERIFIED`/观察项 | 下一项为 `Source` 目录时出现“预览暂时不可用”；继续到 `main.ts` 后预览成功，未将一次目录预览失败扩大解释为文件预览失败 |
| TypeScript Preview | PASS | `main.ts` 显示 `typescript` 和夹具内容 `export const fixture = "w6-04";` |
| 固定到上下文 | PASS | 真实上下文面板显示固定的 `main.ts` 预览；取消固定并关闭上下文后回到 File Library |

筛选问题与当前代码的可解释关联已做只读核对：File Library 通过相对定位的按钮容器挂载弹层，而 `FileLibraryFilterPopover` 使用右对齐和最大 `380px` 宽度（`src/views/fileLibrary/library/LibraryMode.tsx:86`、`src/views/vault/components/FileLibraryFilterPopover.tsx:21`）。本次没有修改这些文件。

### 主控件与分组

- 主工作流控件为 scope/导航、搜索、筛选/排序、结果视图、选择和 Preview；它们在宽/中/窄窗口均保持可见或以响应式方式降级。
- 已保存视图、标签和上下文属于次级/辅助操作，没有观察到多个相互竞争的主 CTA。
- 唯一需要激活后续实现的渲染问题是中等宽度筛选弹层的边界/定位；不是数据权威、文件执行或安全边界问题。

## 6. R5：真实窗口宽度

使用真实窗口控件操作窗口，而不是只改变 CSS 或浏览器 viewport：

| 窗口状态 | 实际截图尺寸 | 观察 |
| --- | --- | --- |
| Wide | `1920×1032` | PASS；完整工具栏、列表和上下文入口可见 |
| Medium | `1282×862` | PASS（主布局）；筛选弹层出现 P2 遮挡 |
| Narrow | CUA client `969×862`（应用配置最小宽度约 980） | PASS（主布局）；工具栏换行，搜索独占一行，列表保留名称/大小，类型和修改时间列按响应式策略隐藏；无关键文本溢出 |

## 7. R6：主题和语言

PASS（实际 native UI）：

- 默认系统主题呈现中文浅色；
- 在 Preferences 中真实切换到 English，界面文本变为英文；
- 真实切换到 Dark，界面显示深色主题；
- 最后恢复为中文浅色，避免把验收状态留在用户意外偏好中。

## 8. R7：键盘焦点

PASS（有边界的 keyboard smoke，不等同于完整无障碍认证）：

- Tab 操作显示了真实焦点环，并按侧栏/工具栏顺序移动；
- File Library 搜索框可通过 `Ctrl+F` 获得焦点，真实截图显示蓝色焦点边框；
- Escape 可退出当前键盘烟测状态；
- 选择、Preview 和弹层的完整键盘可达性未作全量认证，未扩大为 PASS。

## 9. R8：Narrator

`UNVERIFIED`。只读检查未发现活动 `Narrator` 进程或可用 Narrator 窗口。为避免未经确认地启动或改变系统辅助功能状态，本次没有启动 Narrator，也没有把静态控件树误报为 Narrator 验收。

## 10. R9：真实 DPI/显示缩放

`UNVERIFIED`（替代比例）。实际基线 `96 DPI / 100%` 已记录并在该显示设置下完成渲染观察；没有修改 Windows 系统显示缩放，因此未声称 125%/150% 等替代比例通过。

## 11. R10：明确不执行的 W6-05 范围

以下项目均 **NOT RUN / OUT OF SCOPE**：

- NSIS 安装器、安装/卸载生命周期；
- SmartScreen、Unknown Publisher、UAC 或发布签名；
- Explorer Preview Handler、`prevhost.exe` 或 Windows Explorer Preview Pane；
- `v0.1.40` tag、GitHub Release、发布流程；
- Codex Review、PR 推进或合并。

## 12. R11：问题优先级和决策

### P0

无。

### P1

无。

### P2

**W6-04-P2-01 — 中等窗口筛选弹层不可用（真实渲染）**

- 复现窗口：`1282×862`。
- 操作：打开 File Library 的“筛选”。
- 实际结果：弹层从工具栏相对定位点右对齐并向左延伸，主要区域落在左侧导航/工作区边界后方；native accessibility tree 不能暴露可操作的筛选字段，截图仅看到窄条。
- 影响：用户在常见中等窗口宽度下无法可靠筛选；这是 P2 渲染/交互问题，不是数据丢失或权限问题。
- 有界后续：修复弹层定位或边界策略，然后重跑 R3–R7 的中/窄窗口筛选、焦点和关闭恢复验证。

### P3/观察项

- 未发现需要单独立项的 P3 问题。
- Browse 位置为 `状态未知`、打开按钮 disabled，以及相邻目录 Preview 暂不可用，均保留为 `UNVERIFIED` 观察；当前证据不足以归因到本次 File Library 渲染实现，不能据此扩大实现范围。

### 最终决策

**ACTIVATE BOUNDED W6-04 IMPLEMENTATION**

后续只允许围绕 `W6-04-P2-01` 做最小实现和复验：File Library FilterPopover 的中/窄窗口定位、裁切边界、键盘焦点和 Escape 恢复。不得顺带修改 production code 的其他 File Library authority、Browse 后端状态、索引模型、文件系统执行链或 W6-05 发布/Explorer 范围。

## 13. R12：轻量证据索引和机器摘要

| ID | R | 轻量证据 |
| --- | --- | --- |
| E01 | R0 | Git branch/HEAD/tree、origin/master、W6-03 production tree、Windows build/arch/display 摘要 |
| E02 | R1–R2 | 非系统盘无敏感夹具、真实 Windows folder picker、真实 Tauri onboarding 和隔离启动命令 |
| E03 | R3 | 空状态和有效 root 默认 File Library 原生截图/控件树观察 |
| E04 | R4 | 16 / 16 结果、10 files / 569 B、Browse 状态、搜索 16→1→16、选择 |
| E05 | R4 | 中等窗口筛选弹层实际遮挡截图和 native tree 观察；P2-01 |
| E06 | R4 | `Review Index.md` Markdown Preview、`main.ts` TypeScript Preview、固定上下文面板 |
| E07 | R5 | `1920×1032`、`1282×862`、`969×862` 三个真实窗口状态 |
| E08 | R6–R7 | 中文浅色、English 深色、恢复中文浅色；Tab 焦点环和 Ctrl+F 搜索焦点 |
| E09 | R8–R9 | Narrator 进程不存在；实际 96 DPI/100%，替代 DPI 未执行 |
| E10 | R10–R12 | W6-05 排除项、无 P0/P1、夹具已清理、结果文档和当前分支提交 |

### Machine summary

```text
repo=ArdenZC/Zen-Canvas
branch=docs/w6-04-file-library-rendered-review-result
review_head=9895079a4ebb1e810b8c42d6a74b24ba147c6645
origin_master=9895079a4ebb1e810b8c42d6a74b24ba147c6645
review_tree=b93e73711c7ca12683d113d7d4708b16ab7139c9
production_baseline=9fd34956c8907810fea676e643202ea735af46df
production_tree=237d63c842a200eba1058d206c9dc89a7b0e6ebf
os=Windows 11 Pro 10.0.26200 build 26200
arch=x64
display=1920x1080 working-area=1920x1032 scale=100%
native_binary=F:\CargoTarget\debug\zen-canvas.exe
isolated_identifier=com.startlan.zencanvas.w604qa
fixture_files=10
indexed_results=16/16
p0=0
p1=0
p2=1
narrator=UNVERIFIED
alternate_dpi=UNVERIFIED
w6_05=NOT_RUN
decision=ACTIVATE BOUNDED W6-04 IMPLEMENTATION
```

## 14. R12 收尾检查

- 只新增本结果文档；没有修改 production code。
- 任务夹具已清理并确认不存在。
- 未执行 W6-05、tag、release 或 Codex Review。
- 结果分支提交前应再次核对 `git status --short`，只提交本文件。
