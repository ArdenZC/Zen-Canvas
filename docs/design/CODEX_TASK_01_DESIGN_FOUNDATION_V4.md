# Codex 任务 01：Design Foundation v4.0

## 任务定位

这是 Zen Canvas 9 分 UI/UX 重构的第一步。

本任务只建立稳定的设计基础，不重做业务页面，不调整导航信息架构，不改变扫描、索引、分类、移动、清理和恢复逻辑。

当前应用已经具备完整业务能力，但 UI 依赖大量半透明面板、`slate-*`/`blue-*` Tailwind 色值和相近的玻璃组件。请建立一套语义化、可扩展、兼容现有页面的 Design Foundation v4.0。

---

## 开始前

1. 阅读根目录及相关开发说明；
2. 阅读：
   - `src/styles.css`
   - `src/utils/tw.ts`
   - `src/components/ShellChrome.tsx`
   - `src/components/AppShell.tsx`
   - `src/views/shared/ui.ts`
   - `scripts/generateBrandAssets.ps1`
   - `tests/appArchitecture.test.ts`
3. 运行当前基线：
   ```bash
   npm run typecheck
   npm test
   ```
4. 不要在基线失败时继续大范围修改；先汇报失败原因。

---

## 目标

完成以下内容：

1. 引入 Zen Canvas Brand System 2.0 的语义设计 Token；
2. 建立亮色/深色两套稳定主题；
3. 修复当前 warning 与 danger 语义混淆；
4. 建立 Canvas、Content、Raised、Floating 四层材质；
5. 更新品牌 `ZenMark`，使用“Zen Core 圆形 + Canvas 半透明圆角方形”的品牌结构；
6. 降低 `AmbientMesh` 的视觉干扰；
7. 保留现有组件导出和页面行为，确保后续分阶段迁移；
8. 增加设计系统架构测试。

---

## 本任务允许修改

优先修改：

- `src/styles.css`
- `src/utils/tw.ts`
- `src/components/ShellChrome.tsx`
- `tests/appArchitecture.test.ts`

允许新增：

- `src/styles/tokens.css`
- `src/components/ui/BrandMark.tsx`
- `tests/designSystemV4.test.ts`

确有必要时可以小幅修改：

- `src/views/shared/ui.ts`

---

## 本任务禁止修改

不要修改：

- `src/types/ui.ts` 中的 `View`；
- `src/components/AppShell.tsx` 的导航项和页面映射；
- 所有 Zustand Store；
- Tauri API；
- Rust 后端；
- 数据库；
- 扫描、分类、清理、预览、执行和恢复业务逻辑；
- 页面文案与页面信息架构；
- 当前测试所保护的业务行为。

不要安装新依赖。

---

## 1. 建立语义 Token

建议创建 `src/styles/tokens.css`，并由 `src/styles.css` 导入。

### 亮色

必须至少包含：

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

### 深色

必须至少包含：

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

同时加入：

- 圆角 Token；
- 间距 Token；
- 阴影 Token；
- 动效时长和 easing；
- 焦点环 Token。

### 兼容要求

当前代码仍广泛使用：

- `--bg`
- `--surface`
- `--surface-soft`
- `--surface-strong`
- `--ink`
- `--muted`
- `--quiet`
- `--line`
- `--line-dark`
- `--primary`
- `--warning`
- `--danger`

本任务中暂时保留这些旧变量，但必须改为指向新的 `--zc-*` 语义变量，形成兼容层。

例如：

```css
--bg: var(--zc-canvas);
--surface: var(--zc-surface);
--surface-soft: var(--zc-surface-subtle);
--surface-strong: var(--zc-surface-floating);
--ink: var(--zc-text-primary);
--muted: var(--zc-text-secondary);
--quiet: var(--zc-text-tertiary);
```

不要在本任务中一次性修改所有业务页面。

---

## 2. 字体和可读性

更新字体栈：

```css
Inter,
ui-sans-serif,
-apple-system,
BlinkMacSystemFont,
"SF Pro Text",
"PingFang SC",
"Microsoft YaHei",
"Segoe UI",
sans-serif
```

要求：

- 保留字体平滑和 `font-synthesis: none`；
- 中文正文在后续迁移时不低于 13px；
- 新增组件不得使用低对比度文字；
- 焦点状态使用语义 Token，不写死蓝色 rgba。

---

## 3. 材质体系

在 `src/utils/tw.ts` 中增加清晰的基础导出：

- `canvasSurface`
- `contentSurface`
- `raisedSurface`
- `floatingSurface`
- `sidebarSurface`
- `titlebarSurface`

要求：

- `contentSurface` 不使用 backdrop blur；
- `raisedSurface` 只使用轻阴影；
- `floatingSurface` 才允许 blur 和强阴影；
- `sidebarSurface`、`titlebarSurface` 允许轻量 blur；
- 新材质必须只使用语义变量。

### 兼容层

现有导出不能直接删除：

- `glassPanel`
- `appPanel`
- `contentPanel`
- `elevatedPanel`
- `softPanel`
- `toolbarSurface`
- `scopeBarSurface`

将它们暂时映射到新的材质体系，避免大量页面在本任务中重写。

在代码中添加简短注释，说明旧导出是迁移兼容层，后续页面任务会逐步移除。

---

## 4. Button 和表单基础样式

更新现有 `glassButton`、`glassButtonPrimary` 等导出，但保留导出名称。

视觉要求：

- 标准按钮高度 36–40px；
- Primary 使用 `--zc-primary`；
- Secondary 使用内容表面和边框；
- Ghost 无永久边框；
- Destructive 使用 danger 语义；
- Disabled 不再依赖固定 `slate-*`；
- Focus 使用统一 Focus Ring Token；
- Hover 不产生明显缩放；
- 不使用所有按钮都毛玻璃的效果。

本任务不改业务组件中的按钮层级，只统一基础视觉。

---

## 5. Brand Mark

将当前 `ZenMark` 更新为 Brand System 2.0：

- 一个蓝青渐变的 Zen Core 圆形；
- 一个前景半透明圆角方形 Canvas；
- 两者有清晰但克制的空间重叠；
- 亮色和深色模式均可用；
- 16–36px 下仍然清楚；
- 不依赖大面积 Glow；
- 不使用嵌套三层方块和中心小圆点的旧图形。

建议将其抽取为：

```tsx
<BrandMark size="micro" | "sidebar" | "app" />
```

最低要求：

- `micro`：16–20px，简化透明和阴影；
- `sidebar`：32–36px；
- `app`：允许更完整品牌表现。

`ZenMark` 可以保留为兼容包装，内部调用 `BrandMark`。

请参考 `scripts/generateBrandAssets.ps1` 已存在的品牌配色和圆形/Canvas 结构，不要重新发明另一套 Logo。

---

## 6. Ambient Mesh

当前全局环境背景使用两层较明显渐变。

调整为：

- 更低透明度；
- 只在 Canvas 层产生轻微品牌氛围；
- 不影响正文和列表对比度；
- 深色模式避免大面积绿色或蓝色光晕；
- `prefers-reduced-motion` 下不增加动画。

不要删除 Ambient Mesh，但让它退到背景。

---

## 7. 无障碍

保留并验证：

- `prefers-reduced-motion`；
- `focus-visible`；
- Dialog 焦点陷阱；
- `aria-label`；
- 标题栏 no-drag 区域。

新的 BrandMark 使用 `aria-hidden`，除非作为独立品牌内容展示。

焦点环必须在亮色和深色下清楚可见。

---

## 8. 测试

新增 `tests/designSystemV4.test.ts`，至少验证：

1. `styles.css` 或 `tokens.css` 包含 `--zc-canvas`、`--zc-surface`、`--zc-primary`；
2. warning 和 danger 使用不同颜色；
3. 深色主题包含独立 Token；
4. `tw.ts` 导出新的四层材质；
5. `tw.ts` 保留旧兼容导出；
6. `BrandMark` 存在 micro/sidebar 两种尺寸；
7. `ZenMark` 仍然存在，避免现有调用失败；
8. `prefers-reduced-motion` 仍存在；
9. 新基础组件不引入 `transform: scale` 交互。

不要删除、放宽或绕过已有测试。

---

## 9. 完成标准

必须通过：

```bash
npm run typecheck
npm test
npm run build
```

如果 `npm run build` 受本地 Tauri/系统环境限制，必须：

1. 先运行前端 TypeScript 和测试；
2. 给出完整错误；
3. 明确区分代码失败和环境失败；
4. 不要声称构建成功。

---

## 10. 完成后汇报格式

请按以下格式汇报：

### 修改文件

逐个说明修改目的。

### 设计系统变化

说明：

- Token；
- 材质；
- Brand Mark；
- Button；
- Ambient Mesh；
- 亮色/深色差异。

### 兼容性

说明旧变量和旧组件如何继续工作。

### 测试

列出每条命令和结果。

### 未完成/风险

如实说明。

### 截图

在可运行环境下提供：

- 1440×900 亮色主窗口；
- 1440×900 深色主窗口；
- 侧边栏 Brand Mark 的 16px/36px 对比。

---

## 最重要的限制

本任务不是页面重设计。

不要顺手：

- 重做导航；
- 新增概览页；
- 合并页面；
- 修改 AI 参数；
- 修改业务文案；
- 重写 Store；
- 修改 Tauri/Rust；
- 删除当前页面功能。

这一步只建立后续所有页面共用的高质量基础。
