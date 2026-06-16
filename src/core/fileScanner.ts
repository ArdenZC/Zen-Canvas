import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream, type Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FileRecord, ScanResult, ScanRoot } from "../types/domain.js";
import { getExtension, getFileType } from "./fileTypes.js";
import { nowIso, stableId } from "./id.js";

const ignoredDirectoryNames = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".gradle",
  ".idea",
  ".vscode",
  ".venv",
  "__pycache__",
  "appdata",
  "build",
  "coverage",
  "dist",
  "env",
  "library",
  "out",
  "system32",
  "target",
  "venv",
  "$recycle.bin",
  "windows"
]);

const projectMarkerFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "tsconfig.json",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "next.config.js",
  "next.config.mjs",
  "pyproject.toml",
  "requirements.txt",
  "poetry.lock",
  "pipfile",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "settings.gradle",
  "gradlew",
  "pubspec.yaml",
  "composer.json",
  "gemfile",
  "makefile",
  "cmakelists.txt",
  "docker-compose.yml"
]);

const projectMarkerExtensions = [".sln", ".csproj", ".fsproj", ".vbproj", ".xcodeproj", ".xcworkspace"];

const maxFilesPerScan = 5000;
const maxDepth = 6;
const maxHashBytes = 512 * 1024 * 1024;

export async function scanDefaultRoots(): Promise<ScanResult> {
  const home = os.homedir();
  const rootNames = process.platform === "darwin"
    ? ["Desktop", "Downloads", "Documents", "Pictures", "Movies", "Music"]
    : ["Desktop", "Downloads", "Documents", "Pictures", "Videos", "Music"];
  const rootPaths = rootNames.map((name) => path.join(home, name));
  return scanRoots(rootPaths);
}

export async function scanRoots(rootPaths: string[]): Promise<ScanResult> {
  const scannedAt = nowIso();
  const files: FileRecord[] = [];
  const skipped: ScanResult["skipped"] = [];
  const roots: ScanRoot[] = [];

  for (const rootPath of rootPaths) {
    const root: ScanRoot = {
      id: stableId(rootPath),
      path: rootPath,
      platform: process.platform,
      enabled: true,
      last_scanned_at: scannedAt,
      created_at: scannedAt
    };
    roots.push(root);

    try {
      const stat = await fs.stat(rootPath);
      if (!stat.isDirectory()) {
        skipped.push({ path: rootPath, reason: "Not a directory" });
        continue;
      }
      await scanDirectory(rootPath, files, skipped, scannedAt, 0);
    } catch (error) {
      skipped.push({ path: rootPath, reason: readableError(error) });
    }
  }

  await fillDuplicateHashes(files);
  return { roots, files, skipped, scannedAt };
}

async function scanDirectory(
  directory: string,
  files: FileRecord[],
  skipped: ScanResult["skipped"],
  scannedAt: string,
  depth: number
) {
  if (files.length >= maxFilesPerScan || depth > maxDepth || shouldSkipDirectory(directory)) return;

  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true, encoding: "utf8" }) as Dirent<string>[];
  } catch (error) {
    skipped.push({ path: directory, reason: readableError(error) });
    return;
  }

  if (isProjectRoot(entries)) {
    try {
      await addProjectFolderRecord(directory, files, scannedAt);
      skipped.push({ path: directory, reason: "Project folder summarized; internal files skipped" });
    } catch (error) {
      skipped.push({ path: directory, reason: readableError(error) });
    }
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFilesPerScan) return;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".")) {
        await scanDirectory(fullPath, files, skipped, scannedAt, depth + 1);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    try {
      const stat = await fs.stat(fullPath);
      const extension = getExtension(fullPath);
      files.push({
        id: stableId(fullPath),
        name: entry.name,
        path: fullPath,
        directory,
        extension,
        size: stat.size,
        file_type: getFileType(fullPath),
        purpose: "Unknown",
        lifecycle: "Reference",
        context: "",
        risk_level: "Unknown",
        hash: null,
        created_at: stat.birthtime.toISOString(),
        modified_at: stat.mtime.toISOString(),
        scanned_at: scannedAt,
        last_seen_at: scannedAt,
        is_hidden: entry.name.startsWith("."),
        is_deleted: false,
        is_duplicate: false,
        suggested_action: "Keep",
        suggested_target_path: "",
        suggested_name: entry.name,
        confidence: 0,
        classification_reason: "",
        matched_rules: [],
        requires_confirmation: false,
        indexed_at: scannedAt,
        source_id: stableId(findSourceRoot(directory)),
        is_stale: false
      });
    } catch (error) {
      skipped.push({ path: fullPath, reason: readableError(error) });
    }
  }
}

async function addProjectFolderRecord(directory: string, files: FileRecord[], scannedAt: string) {
  if (files.some((file) => file.path === directory)) return;
  const stat = await fs.stat(directory);
  const name = path.basename(directory);
  const parent = path.dirname(directory);
  files.push({
    id: stableId(directory),
    name,
    path: directory,
    directory: parent,
    extension: "folder",
    size: 0,
    file_type: "Other",
    purpose: "Project",
    lifecycle: "Active",
    context: "Project Folder",
    risk_level: "Normal",
    hash: null,
    created_at: stat.birthtime.toISOString(),
    modified_at: stat.mtime.toISOString(),
    scanned_at: scannedAt,
    last_seen_at: scannedAt,
    is_hidden: name.startsWith("."),
    is_deleted: false,
    is_duplicate: false,
    suggested_action: "Review",
    suggested_target_path: "",
    suggested_name: name,
    confidence: 0.86,
    classification_reason: "Detected project root; internal files are summarized to avoid moving configured environments",
    matched_rules: ["Project folder boundary"],
    requires_confirmation: true,
    dispatch_zone: "CoreAssets",
    recommended_folder: "Projects",
    dispatch_reason: "Project environments should be organized at the folder boundary",
    next_action: "Review project folder placement only",
    indexed_at: scannedAt,
    source_id: stableId(findSourceRoot(directory)),
    is_stale: false
  });
}

function isProjectRoot(entries: Dirent<string>[]) {
  return entries.some((entry) => {
    const name = entry.name.toLowerCase();
    if (entry.isFile() && projectMarkerFiles.has(name)) return true;
    if (entry.isFile() && projectMarkerExtensions.some((extension) => name.endsWith(extension))) return true;
    return entry.isDirectory() && [".git", ".hg", ".svn"].includes(name);
  });
}

async function fillDuplicateHashes(files: FileRecord[]) {
  const bySize = new Map<number, FileRecord[]>();
  for (const file of files) {
    if (file.size <= 0 || file.size > maxHashBytes) continue;
    const bucket = bySize.get(file.size) ?? [];
    bucket.push(file);
    bySize.set(file.size, bucket);
  }

  for (const bucket of bySize.values()) {
    if (bucket.length < 2) continue;
    await Promise.all(
      bucket.map(async (file) => {
        file.hash = await hashFile(file.path);
      })
    );
  }
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function shouldSkipDirectory(directory: string): boolean {
  const parts = directory.toLowerCase().split(/[\\/]+/);
  return parts.some((part) => ignoredDirectoryNames.has(part));
}

function findSourceRoot(directory: string): string {
  const home = os.homedir();
  const relative = path.relative(home, directory);
  const firstPart = relative.split(/[\\/]+/).filter(Boolean)[0];
  return firstPart ? path.join(home, firstPart) : directory;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
