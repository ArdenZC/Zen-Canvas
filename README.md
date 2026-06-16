# Zen Canvas

<p align="center">
  <img src="docs/banner_zh.svg" width="100%" alt="Zen Canvas Banner" />
</p>

<p align="center">
  语言切换：<b>简体中文</b> | <a href="README_en.md">English Edition ➔</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-v42.4.0-3178C6?style=flat-cube&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-v19.0.0-61DAFB?style=flat-cube&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-v5.8.3-3178C6?style=flat-cube&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-FTS5-003B57?style=flat-cube&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/github/actions/workflow/status/ArdenZC/file-manager-assistant/release-build.yml?style=flat-cube&label=CI%2FCD" alt="Build Status" />
  <img src="https://img.shields.io/github/license/ArdenZC/file-manager-assistant?style=flat-cube&color=emerald" alt="License" />
</p>

---

## 🌌 简介

> **本地优先 (Local-First) 的桌面个人文件生命周期管家。**
> 它不是传统资源管理器的粗暴替代者，也不是冷冰冰的文件批量分类脚本，而是一个将「全盘扫描 ➔ 智能理解 ➔ 方案预览 ➔ 安全操作 ➔ 时光机回滚」完美串联的安全闭环。

### 🎨 极致空间美学
* **全息雷达析构**：主视窗搭载动态 Conic-Gradient 雷达扫描仪与数据可视化 Metrics，以物理直觉呈现当前工作区的净化状态。
* **VisionOS 材质粒子**：全局采用重度模糊高饱和毛玻璃与三轨道漫反射漂移光斑，完美自适应系统深浅双轨主题。
* **Spotlight 极速全局检索**：常驻顶部中央，通过 `Ctrl/Cmd + K` 唤起。搭载高性能本地 FTS5 引擎，实现 **10万级别** 文件检索 `<100ms` 的极致性能。

---

## 🔮 核心工作流与四区分配模型 (The Dispatching Framework)

Zen Canvas 拒绝直接对您的原始文件进行破坏性修改。扫描后，系统将依据业务属性、生命阶段和潜在风险，将文件流转到以下四个**物理分拣域 (Dispatch Zones)**：

| 📂 分拣区域 (Zones) | 💎 覆盖资产类型 (Purpose) | 🛡️ 安全处理策略 (Safety Boundary) |
| :--- | :--- | :--- |
| **核心资产 (Core Assets)** | 项目文档、学习教程、当前工作代码 | 智能归置到对应的规范业务目录下，保留工作热度。 |
| **沉寂归档 (Quiet Archive)** | 历史发票、超期参考资料、往期备份 | 建议一键转移至 `Archive` 冷数据冰川，降低当前工作区噪音。 |
| **隐私保险箱 (Privacy Vault)** | 护照扫描、身份证件、含有敏感隐私词文件 | **绝对只提供整理建议**，默认不进行任何实际物理移动或重命名。 |
| **临时清理 (Cleanup Lane)** | 超期安装包 (`.dmg`/`.exe`)、临时桌面截图 | 归类到垃圾清理待办。MVP 阶段**不执行删除动作**，仅供确认。 |

---

## ⚙️ 极简本地架构 (Architecture)

```text
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
