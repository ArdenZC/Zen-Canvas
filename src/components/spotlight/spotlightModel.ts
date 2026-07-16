import type { Translator } from "../../types/ui";
import type { FileRecord, OperationLog } from "../../types/domain";
import type { SpotlightCommand, SpotlightCommandGroup } from "./commandRegistry";

export type SpotlightFileResult = { kind: "file"; id: string; file: FileRecord };
export type SpotlightResult = SpotlightFileResult | SpotlightCommand;
export type SpotlightResultGroupType = "folders" | "files" | SpotlightCommandGroup;
export type SpotlightResultGroup = { type: SpotlightResultGroupType; label: string; items: SpotlightResult[] };

export function mergeSpotlightResults(files: FileRecord[], commands: SpotlightCommand[]): SpotlightResult[] {
  return [
    ...files.map((file) => ({ kind: "file" as const, id: `file:${file.id}`, file })),
    ...commands
  ];
}

export function groupSpotlightResults(results: SpotlightResult[], t?: Translator): SpotlightResultGroup[] {
  const order: SpotlightResultGroupType[] = ["folders", "files", "actions", "settings", "history"];
  return order.flatMap((type) => {
    const items = results.filter((item) => resultGroup(item) === type);
    return items.length ? [{ type, label: groupLabel(type, t), items }] : [];
  });
}

export function selectRecentFiles(files: FileRecord[], limit = 4) {
  return [...files]
    .sort((left, right) => recentFileTime(right) - recentFileTime(left))
    .slice(0, limit);
}

export function selectRecentOperations(operations: OperationLog[], limit = 3) {
  return [...operations]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, limit);
}

export function buildRecentGroups(files: FileRecord[], operations: OperationLog[], t: Translator) {
  const recentFiles = selectRecentFiles(files);
  const recentOperations = selectRecentOperations(operations);
  return [
    ...(recentFiles.length ? [{ type: "recent-files" as const, label: t("spotlightRecentFiles"), items: recentFiles }] : []),
    ...(recentOperations.length ? [{ type: "recent-operations" as const, label: t("spotlightRecentOperations"), items: recentOperations }] : [])
  ];
}

function resultGroup(result: SpotlightResult): SpotlightResultGroupType {
  if (result.kind === "command") return result.group;
  return result.file.file_type.toLocaleLowerCase() === "folder" ? "folders" : "files";
}

function groupLabel(type: SpotlightResultGroupType, t?: Translator) {
  if (!t) return type;
  if (type === "folders") return t("spotlightFolders");
  if (type === "files") return t("spotlightFiles");
  if (type === "actions") return t("spotlightActions");
  if (type === "settings") return t("settings");
  return t("history");
}

function recentFileTime(file: FileRecord) {
  return Date.parse(file.last_opened_at || file.modified_at || file.indexed_at || "") || 0;
}
