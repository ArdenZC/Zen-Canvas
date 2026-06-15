import os from "node:os";
import path from "node:path";
import type { FileRecord, OperationPreview } from "../types/domain.js";

const executableActions = new Set(["Move", "Rename", "MoveAndRename", "Archive"]);
const executableOperationTypes = new Set(["move", "rename", "move_rename"]);
const blockedPathParts = new Set([
  "$recycle.bin",
  "applications",
  "library",
  "program files",
  "program files (x86)",
  "system",
  "system32",
  "windows"
]);

export function validateOperationPreview(
  file: FileRecord,
  operation: OperationPreview,
  homeDirectory = os.homedir()
): string | null {
  if (!executableOperationTypes.has(String(operation.operation_type))) {
    return "Unsupported operation type";
  }

  if (file.risk_level === "Sensitive" || operation.risk_level === "Sensitive") {
    return "Sensitive files are not executed in this MVP";
  }

  if (!executableActions.has(file.suggested_action)) {
    return "File action is not executable in this MVP";
  }

  if (!operation.source_path || !operation.target_path) {
    return "Operation paths are required";
  }

  if (!path.isAbsolute(operation.source_path) || !path.isAbsolute(operation.target_path)) {
    return "Operation paths must be absolute";
  }

  const sourcePath = path.resolve(operation.source_path);
  const indexedPath = path.resolve(file.path);
  const targetPath = path.resolve(operation.target_path);

  if (!samePath(sourcePath, indexedPath)) {
    return "Source path no longer matches the indexed file";
  }

  if (samePath(sourcePath, targetPath)) {
    return "Source and target paths are identical";
  }

  if (!isSafeFileName(operation.new_name)) {
    return "Target file name is not safe";
  }

  if (path.basename(targetPath) !== operation.new_name) {
    return "Target path and new file name do not match";
  }

  if (isDangerousTarget(targetPath)) {
    return "Target path points to a protected system location";
  }

  const targetDirectory = path.dirname(targetPath);
  const sourceDirectory = path.resolve(file.directory);
  if (!samePath(targetDirectory, sourceDirectory) && !isSubpath(targetPath, homeDirectory)) {
    return "Target must remain in the source folder or inside the user home directory";
  }

  return null;
}

export function isSafeFileName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return false;
  if (trimmed !== name) return false;
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  if (/[\u0000-\u001f<>:"|?*]/.test(trimmed)) return false;
  return true;
}

function isDangerousTarget(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  if (samePath(resolved, parsed.root)) return true;

  const targetParts = resolved.toLowerCase().split(/[\\/]+/).filter(Boolean);
  return targetParts.some((part) => blockedPathParts.has(part));
}

function isSubpath(childPath: string, parentPath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
