# Zen Canvas Architecture Remediation V1

本目录用于管理 Zen Canvas 在 PR #15 合并后的架构整改、数据模型演进、跨模块重构和 Codex 分阶段任务。

它与 `docs/design/` 的职责不同：

- `docs/design/`：品牌、UI/UX、页面交互、视觉规范和设计验收；
- `docs/remediation/`：Rust/Tauri、SQLite、任务与队列、索引、文件身份、整理计划、查询协议、内容理解和跨模块工程治理。

两套文档可以同时生效。任何阶段涉及界面时，仍必须遵守当前有效的 UI/UX 规范；任何阶段涉及文件系统、数据库、AI、搜索或恢复时，必须优先保留既有安全边界。

---

## 1. 当前基线

- 仓库：`ArdenZC/Zen-Canvas`
- 默认分支：`master`
- PR #15：已合并
- PR #15 合并提交锚点：`a2c0516dc7a8628cb7210003da3d66f5d84f3a2f`
- PR #15 主题：系统级搜索、Managed AI 边界、原生文件身份、平台安全和永久 CI 验证
- 当前版本线：`0.1.40`

后续任务不得假设 `master` 永远停留在上述提交。每个任务开始时必须记录实际 `HEAD`，并确认它包含 PR #15 的合并提交：

```bash
git rev-parse HEAD
git merge-base --is-ancestor a2c0516dc7a8628cb7210003da3d66f5d84f3a2f HEAD
```

第二条命令必须返回成功。

---

## 2. 文档优先级

Codex 开始任何整改阶段前，依次阅读：

1. 仓库根目录的 `AGENTS.md` 或其他当前生效的开发说明（若存在）；
2. `docs/remediation/README.md`；
3. `docs/remediation/REMEDIATION_MASTER_PLAN_V1.md`；
4. `docs/remediation/CODEX_REMEDIATION_INDEX_V1.md`；
5. 当前阶段任务书；
6. 当前阶段依赖的 ADR、closeout、测试和实际源码；
7. 涉及 UI 时，再阅读当前有效的 `docs/design/` 规范。

仓库文档发生冲突时按以下原则处理：

1. 数据安全、文件安全、恢复能力和用户数据兼容性最高；
2. 根目录当前开发说明高于本目录；
3. 当前阶段任务书高于总体计划；
4. 已合并代码和测试事实高于旧文档描述；
5. UI 品牌规范不能覆盖后端安全边界；
6. 不得通过删除、弱化、跳过或改写测试来消除冲突。

发现无法判断的冲突时，停止实施并汇报，不自行扩大任务范围。

---

## 3. 执行原则

### 3.1 一次只执行一个阶段

每个阶段必须：

- 独立分支；
- 独立提交；
- 独立 Draft PR；
- 独立测试；
- 独立验收；
- 完成后停止并等待人工审核。

不得在一个阶段中“顺手完成”后续模块。

### 3.2 先审计，再冻结实现

`Task 00` 是唯一立即可执行的阶段。它只调查 PR #15 合并后的真实架构，不修改生产代码。

Task 01 及之后的任务，在 Task 00 审计结论通过人工验收前都只是暂定方向，不是实施授权。

### 3.3 不得重复建设

PR #15 已经加入或强化了：

- Windows MFT/USN 与 macOS Spotlight/FSEvents 系统级索引；
- disabled volume 隔离；
- 原生文件身份；
- Managed AI 持久队列；
- scope、provider policy、fingerprint、取消和用户修正的调用前后复核；
- provider 输出验证；
- 平台安全边界；
- 性能、原生回归、安全审计和打包 CI。

后续任务必须先判断现有能力能否扩展，不得另建第二套全局索引、第二套 Managed AI 队列或绕开现有安全入口。

### 3.4 默认禁止事项

除非当前任务书明确授权：

- 不修改数据库 schema；
- 不新增第三方依赖；
- 不改变对外 API 或持久化协议；
- 不删除、放宽、跳过或改写既有测试；
- 不删除功能来规避架构问题；
- 不把临时 mock、调试页面或测试数据带入生产路径；
- 不把 AI 变成可以直接执行任意文件操作的 Agent；
- 不信任前端提交的源路径、目标路径或文件身份；
- 不让 unmanaged 文件进入内容提取或云端 AI；
- 不将清理默认改为永久删除；
- 不绕过 operation journal、预览和恢复链路；
- 不把 Windows UI 伪装成 macOS，反之亦然；
- 不发布 tag、release、安装包或修改公开发布配置。

---

## 4. 安全与产品不变量

所有整改必须持续满足：

1. 扫描与索引本身不修改用户文件；
2. 全局索引是 metadata-only 数据域；
3. 只有用户明确管理的 scope 才能进入内容理解、AI、重复检测和整理；
4. 所有移动、重命名和清理先生成后端权威预览；
5. 执行时重新验证文件身份、范围、路径、冲突和计划版本；
6. 文件操作先写 pending journal；
7. 应用启动时协调中断操作；
8. 恢复只针对 Zen Canvas 成功执行且仍可验证的操作；
9. Safe Trash 优先于永久删除；
10. Sensitive、冲突、低置信度和身份不确定项默认要求确认；
11. 用户修正优先于 AI 结果；
12. disabled、unavailable 或 stale 数据不得被错误呈现为可安全执行。

---

## 5. 标准分支与提交

建议分支：

```text
remediation/00-post-merge-audit
remediation/01-job-scan-foundation
remediation/02-file-fingerprint-dedupe
...
```

文档阶段提交示例：

```text
docs: establish post-merge remediation baseline
```

实施阶段提交应清楚描述单一阶段目标，不使用笼统的 `update`、`fix stuff` 或 `refactor all`。

---

## 6. 当前文档

```text
docs/remediation/
├── README.md
├── REMEDIATION_MASTER_PLAN_V1.md
├── CODEX_REMEDIATION_INDEX_V1.md
└── TASK_00_POST_MERGE_BASELINE_AUDIT.md
```

Task 00 完成后，Codex 预计新增：

```text
POST_MERGE_BASELINE_AUDIT.md
REMEDIATION_CAPABILITY_MATRIX.md
REMEDIATION_RISK_REGISTER.md
```

后续详细任务书只能在 Task 00 审计通过后逐个冻结。

---

## 7. 完成汇报的最低内容

每个阶段必须汇报：

1. 实际基线 `HEAD`；
2. 修改文件及目的；
3. 关键设计与数据流变化；
4. 保留的兼容性与安全边界；
5. 新增或修改的测试；
6. 所有验证命令及完整结果摘要；
7. 未完成事项；
8. 已知风险；
9. 提交 SHA；
10. Draft PR；
11. 明确声明已停止，未开始下一阶段。
