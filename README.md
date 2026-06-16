<circle cx="200" cy="130" r="140" fill="#1e3a8a" opacity="0.25" filter="url(#glow)" />
<circle cx="650" cy="150" r="100" fill="#4c1d95" opacity="0.2" filter="url(#glow)" />

<path d="M-100 130 C 200 50, 400 210, 900 130" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="2" />
<path d="M-100 150 C 150 210, 450 50, 900 150" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1.5" />

<g transform="translate(110, 130)">
  <circle cx="25" cy="-25" r="38" fill="url(#orbGradient)" filter="url(#glow)" opacity="0.9" />
  <rect x="-45" y="-15" width="64" height="64" rx="18" fill="url(#glassGradient)" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" filter="url(#glass-blur)" />
  <rect x="-44" y="-14" width="62" height="62" rx="17" fill="none" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
</g>

<!-- Localized Text for Chinese -->
<text x="240" y="115" font-family="'Inter', -apple-system, sans-serif" font-size="44" font-weight="700" fill="url(#textGradient)" letter-spacing="-1">Zen Canvas</text>
<text x="242" y="152" font-family="'Inter', -apple-system, sans-serif" font-size="16" font-weight="500" fill="#34C759" letter-spacing="4">个人数字资产管家</text>
<text x="242" y="180" font-family="'Inter', -apple-system, sans-serif" font-size="13" font-weight="400" fill="#64748B" letter-spacing="0.5">基于 SQLite FTS5 与 Electron 的本地优先文件生命周期管理器</text>

<g transform="translate(242, 205)" font-family="'Inter', -apple-system, sans-serif" font-size="10" font-weight="700" letter-spacing="1">
  <rect x="0" y="0" width="75" height="20" rx="6" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.3)" stroke-width="1"/>
  <text x="12" y="13" fill="#60A5FA">ELECTRON</text>

  <rect x="85" y="0" width="55" height="20" rx="6" fill="rgba(52, 199, 89, 0.12)" stroke="rgba(52, 199, 89, 0.25)" stroke-width="1"/>
  <text x="98" y="13" fill="#86EFAC">REACT</text>

  <rect x="150" y="0" width="55" height="20" rx="6" fill="rgba(245, 158, 11, 0.12)" stroke="rgba(245, 158, 11, 0.25)" stroke-width="1"/>
  <text x="165" y="13" fill="#FCD34D">SQLITE</text>
</g>


🌌 Zen Canvas

本地优先 (Local-First) 的桌面个人文件生命周期管家。
它不是传统资源管理器的粗暴替代者，也不是冷冰冰的文件批量分类脚本，而是一个将「全盘扫描 ➔ 智能理解 ➔ 方案预览 ➔ 安全操作 ➔ 时光机回滚」完美串联的安全闭环。

🎨 极致空间美学

全息雷达析构：主视窗搭载动态 Conic-Gradient 雷达扫描仪与数据可视化 Metrics，以物理直觉呈现当前工作区的净化状态。

VisionOS 材质粒子：全局采用重度模糊高饱和毛玻璃（.glass-panel）与三轨道漫反射漂移光斑（.orb），完美自适应系统深浅双轨主题（Glacier Light & Deep Sea Dark）。

Spotlight 极速全局检索：常驻顶部中央，通过 Ctrl/Cmd + K 唤起。搭载高性能本地 FTS5 引擎，实现 10万级别 文件检索 <100ms 的极致性能。

🔮 核心工作流与四区分配模型 (The Dispatching Framework)

Zen Canvas 拒绝直接对您的原始文件进行破坏性修改。扫描后，系统将依据业务属性、生命阶段和潜在风险，将文件流转到以下四个物理分拣域 (Dispatch Zones)：

📂 分拣区域 (Zones)

💎 覆盖资产类型 (Purpose)

🛡️ 安全处理策略 (Safety Boundary)

核心资产 (Core Assets)

项目文档、学习教程、当前工作代码

智能归置到对应的规范业务目录下，保留工作热度。

沉寂归档 (Quiet Archive)

历史发票、超期参考资料、往期备份

建议一键转移至 Archive 冷数据冰川，降低当前工作区噪音。

隐私保险箱 (Privacy Vault)

护照扫描、身份证件、含有敏感隐私词文件

绝对只提供整理建议，默认不进行任何实际物理移动或重命名。

临时清理 (Cleanup Lane)

超期安装包 (.dmg/.exe)、临时桌面截图

归类到垃圾清理待办。MVP 阶段不执行删除动作，仅供确认。

⚙️ 极简本地架构 (Architecture)

                     ┌────────────────────────────────────────┐
                     │          React 19 Rendering UI         │
                     │  (Glacier Light & Deep Sea Dark Mode)  │
                     └───────────────────┬────────────────────┘
                                         │ IPC Invoke (Secure Context)
                                         ▼
                     ┌────────────────────────────────────────┐
                     │          Preload.ts (Sandbox)          │
                     └───────────────────┬────────────────────┘
                                         │ Electron IPC Channel
                                         ▼
                     ┌────────────────────────────────────────┐
                     │      Electron 42 Main Process (Node)   │
                     └──────┬──────────────────────────┬──────┘
                            │                          │
                            ▼                          ▼
               ┌────────────────────────┐  ┌────────────────────────┐
               │    Local SQLite WAL    │  │  Chokidar File Watcher │
               │   (FTS5 Search Index)  │  │ (Stale Source Tracker) │
               └────────────────────────┘  └────────────────────────┘


💻 快速开始 (Development)

在开始前，请确保您的本地开发环境已经安装了 Node.js (>= 22)。

# 1. 克隆并进入仓库
git clone https://github.com/ArdenZC/file-manager-assistant.git
cd file-manager-assistant

# 2. 安装本地原生依赖 (自动触发 better-sqlite3 二进制编译)
npm install

# 3. 启动双进程开发热更新环境 (Electron + Vite)
npm run dev

# 4. 执行严苛的单元测试与10万级 FTS 性能测试
npm run verify


🚀 自动化构建与发行

GitHub Actions 工作流（.github/workflows/release-build.yml）已完全打通。当向远程推送以 v* 开头的 Tag 时，将全自动触发云端双端构建：

# 全维质量校验
npm run typecheck       # TypeScript 静态检查
npm test                # 逻辑单元测试
npm run test:performance # 性能跑分测试

# 本地打包 Windows 安装包
npm run dist:win        # 生成 NSIS 安装程序及绿色版 ZIP
# 本地打包 macOS 安装包
npm run dist:mac        # 生成 DMG 磁盘镜像及压缩包
