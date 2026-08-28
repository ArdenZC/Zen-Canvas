import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("[preview-handler] native Windows DLL is not built on this platform.");
  process.exit(0);
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeTargetDirectory = path.join(repositoryRoot, "src-tauri", "native", "target");
const nativeDllPath = path.join(
  nativeTargetDirectory,
  "release",
  "zen_canvas_windows_preview_handler.dll",
);
const packageResourceDirectory = path.join(repositoryRoot, "src-tauri", "native", "packaged");
const packageResourcePath = path.join(
  packageResourceDirectory,
  "zen_canvas_windows_preview_handler.dll",
);

// The package staging file is task-owned. Remove it before building so a
// failed native build can never leave a stale DLL available to the package
// resource config.
if (fs.existsSync(packageResourcePath)) {
  fs.rmSync(packageResourcePath);
}

const result = spawnSync(
  "cargo",
  [
    "build",
    "--release",
    "--manifest-path",
    path.join(
      repositoryRoot,
      "src-tauri",
      "native",
      "windows-preview-handler",
      "Cargo.toml",
    ),
  ],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: nativeTargetDirectory,
    },
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error) {
  throw new Error("Unable to start the Windows Preview Handler build: " + result.error.message);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

let nativeDllStats;
try {
  nativeDllStats = fs.statSync(nativeDllPath);
} catch (error) {
  throw new Error(
    "Windows Preview Handler release build did not produce the expected DLL: " +
      (error instanceof Error ? error.message : String(error)),
  );
}
if (!nativeDllStats.isFile() || nativeDllStats.size === 0) {
  throw new Error(
    `Windows Preview Handler release build produced an invalid DLL: ${nativeDllPath}`,
  );
}

fs.mkdirSync(packageResourceDirectory, { recursive: true });
fs.copyFileSync(nativeDllPath, packageResourcePath);
console.log(`[preview-handler] packaged production DLL: ${packageResourcePath}`);
