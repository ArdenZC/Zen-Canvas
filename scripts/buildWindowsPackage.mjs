import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeBuildScript = path.join(repositoryRoot, "scripts", "buildWindowsPreviewHandler.mjs");
const packageConfig = path.join(
  repositoryRoot,
  "src-tauri",
  "tauri.windows.package.conf.json",
);
const packageResourcePath = path.join(
  repositoryRoot,
  "src-tauri",
  "native",
  "packaged",
  "zen_canvas_windows_preview_handler.dll",
);

function run(command, args) {
  const isWindowsBatch = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  const executable = isWindowsBatch ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs = isWindowsBatch
    ? ["/d", "/s", "/c", "call", command, ...args]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Unable to start ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.platform === "win32") {
  // This runs before Tauri invokes its Rust build script. The package-only
  // config below therefore sees a fresh production artifact, while ordinary
  // Cargo invocations continue to use the resource-free default config.
  run(process.execPath, [nativeBuildScript]);
  if (!fs.existsSync(packageResourcePath)) {
    throw new Error(`Expected package staging DLL is missing: ${packageResourcePath}`);
  }
}

const tauriCommand = path.join(
  repositoryRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri",
);
const tauriArgs = ["build", "--features", "desktop-runtime"];
if (process.platform === "win32") {
  tauriArgs.push("--config", packageConfig);
}
tauriArgs.push(...process.argv.slice(2));
run(tauriCommand, tauriArgs);
