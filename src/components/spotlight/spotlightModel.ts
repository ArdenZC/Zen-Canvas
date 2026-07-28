import type { Translator } from "../../types/ui";
import type { GlobalSearchResult } from "../../types/domain";
import type { SpotlightCommand, SpotlightCommandGroup } from "./commandRegistry";

export type SpotlightGlobalResult = { kind: "global"; id: string; entry: GlobalSearchResult };
export type SpotlightResult = SpotlightGlobalResult | SpotlightCommand;
export type SpotlightResultGroupType = "folders" | "files" | SpotlightCommandGroup;
export type SpotlightResultGroup = { type: SpotlightResultGroupType; label: string; items: SpotlightResult[] };

export function mergeSpotlightResults(entries: GlobalSearchResult[], commands: SpotlightCommand[]): SpotlightResult[] {
  return [
    ...entries.map((entry) => ({ kind: "global" as const, id: `global:${entry.id}`, entry })),
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

function resultGroup(result: SpotlightResult): SpotlightResultGroupType {
  if (result.kind === "command") return result.group;
  return result.entry.isDirectory ? "folders" : "files";
}

function groupLabel(type: SpotlightResultGroupType, t?: Translator) {
  if (!t) return type;
  if (type === "folders") return t("spotlightFolders");
  if (type === "files") return t("spotlightFiles");
  if (type === "actions") return t("spotlightActions");
  if (type === "settings") return t("settings");
  return t("history");
}
