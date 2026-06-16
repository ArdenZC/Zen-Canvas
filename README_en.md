🌌 Zen Canvas

A local-first file lifecycle steward for personal desktops.
It is not a raw file explorer replacement, nor a cold command-line classifier. It seamlessly connects workspace scanning, indexing, cognitive understanding, secure previews, and rollback logs into a completely safe local loop.

🎨 Spatial Aesthetics & Glassmorphism

Holographic Radar Decoupling: The main scanner dashboard houses a dynamic Conic-Gradient scanner and metrics to visually diagnose clutter ratio with raw physical feedback.

Apple VisionOS Material: The workspace uses heavily blurred, high-saturation glass structures (.glass-panel) paired with a 3-track moving drift ambient lighting system (.orb), adapting flawlessly to Glacier Light & Deep Sea Dark themes.

Spotlight-grade Search Bar: Floating at the top-center of the app, instantly summoned via Ctrl/Cmd + K. Fueled by a native SQLite FTS5 engine, offering 100k-level query matching in <100ms.

🔮 Core Dispatched Zones

📂 Dispatch Zone

💎 Targeted Asset Type

🛡️ Safety & Execution Strategy

Core Assets

Active projects, study notes, career portfolios

Structured and routed to active working directories.

Quiet Archive

Historical invoices, receipts, old backup zip files

Suggested to be relocated to the Archive Glacier.

Privacy Vault

Passport scans, ID documents, credential files

Advice-only in this version. Safe bounds forbid automatic moving.

Cleanup Lane

Expired installers (.exe/.dmg), stray screenshots

Grouped into the disposable queue. No deletion execution in MVP.

💻 Quick Start

Make sure you have Node.js (>= 22) installed on your machine.

# Clone the repository
git clone https://github.com/ArdenZC/file-manager-assistant.git
cd file-manager-assistant

# Install dependencies (recompiles better-sqlite3 binaries locally)
npm install

# Start concurrently Vite & Electron Dev Server
npm run dev

# Run typechecks, unit tests, and performance benchmark suite
npm run verify


🛠️ Packaging & Release

The built-in GitHub Actions CI/CD pipeline (release-build.yml) takes care of generating unsigned portable artifacts on v* tag pushes:

Windows Target: NSIS installer + portable ZIP (x64, ia32, arm64) via npm run dist:win

macOS Target: DMG disk image + ZIP (x64, arm64) via npm run dist:mac
