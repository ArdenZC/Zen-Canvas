import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

if (process.platform !== "win32") {
  throw new Error("The NSIS registry-authority smoke requires Windows.");
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(
  repositoryRoot,
  "tests",
  "fixtures",
  "windows-registry-authority-smoke.nsi",
);
const authorityPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "registry-authority.nsh",
);
const localAppData = process.env.LOCALAPPDATA;
const candidates = [
  process.env.MAKENSIS,
  localAppData && path.join(localAppData, "tauri", "NSIS", "makensis.exe"),
  localAppData && path.join(localAppData, "tauri", "NSIS", "Bin", "makensis.exe"),
  path.join(process.env.ProgramFiles ?? "", "NSIS", "makensis.exe"),
].filter(Boolean);
const makensis = candidates.find((candidate) => fs.existsSync(candidate));

if (!makensis) {
  throw new Error(
    `makensis.exe was not found in the package toolchain candidates: ${candidates.join(", ")}`,
  );
}

const tempParent = path.join(repositoryRoot, ".tmp-tests");
fs.mkdirSync(tempParent, { recursive: true });
const tempRoot = fs.mkdtempSync(path.join(tempParent, "registry-authority-smoke-"));
const executablePath = path.join(tempRoot, "registry-authority-smoke.exe");

try {
  const compile = spawnSync(
    makensis,
    [
      "/NOCD",
      "/V4",
      `/DZC_SMOKE_OUTFILE=${executablePath}`,
      `/DZC_REGISTRY_AUTHORITY_FILE=${authorityPath}`,
      fixturePath,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (compile.error || compile.status !== 0) {
    throw new Error(
      `Registry-authority smoke compilation failed.\n${compile.stdout ?? ""}\n${compile.stderr ?? ""}`,
      { cause: compile.error },
    );
  }
  if (!fs.existsSync(executablePath) || fs.statSync(executablePath).size === 0) {
    throw new Error("Registry-authority smoke compilation produced no executable.");
  }

  const run = spawnSync(executablePath, [], {
    cwd: tempRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (run.error || run.status !== 0) {
    const logPath = path.join(tempRoot, "registry-authority-smoke.log");
    const semanticLog = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    throw new Error(
      `Registry-authority smoke failed with exit ${run.status}.\n${semanticLog}\n${run.stdout ?? ""}\n${run.stderr ?? ""}`,
      { cause: run.error },
    );
  }
  process.stdout.write(
    `Windows NSIS registry-authority smoke passed with ${path.basename(makensis)}.\n`,
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
