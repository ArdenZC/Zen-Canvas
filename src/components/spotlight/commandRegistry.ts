import type { Translator, View } from "../../types/ui";

export type SpotlightCommandGroup = "actions" | "settings" | "history";

export type SpotlightCommand = {
  kind: "command";
  id: string;
  label: string;
  description: string;
  keywords: string[];
  group: SpotlightCommandGroup;
  view: View;
  settingsSection?: string;
};

export function createCommandRegistry(t: Translator): SpotlightCommand[] {
  return [
    command("overview", t("overview"), t("commandOverviewDesc"), ["概览", "overview", "扫描", "scan"], "actions", "scanner"),
    command("library", t("fileLibrary"), t("commandLibraryDesc"), ["文件", "library", "files"], "actions", "library"),
    command("suggestions", t("organizeSuggestions"), t("commandSuggestionsDesc"), ["整理", "建议", "organize", "suggestions"], "actions", "organize"),
    command("cleanup", t("storageCleanup"), t("commandCleanupDesc"), ["清理", "空间", "cleanup", "storage", "safe trash"], "actions", "cleanup"),
    command("history", t("history"), t("commandHistoryDesc"), ["历史", "恢复", "history", "restore"], "history", "restore"),
    command("automation", t("automation"), t("commandAutomationDesc"), ["自动化", "规则", "automation", "rules"], "actions", "rules"),
    command("settings", t("settings"), t("commandSettingsDesc"), ["设置", "偏好", "settings"], "settings", "settings"),
    command("search-scope-settings", t("searchScopeSettings"), t("commandSearchScopeDesc"), ["搜索范围", "范围设置", "search scope"], "settings", "settings", "settings-search-scope"),
    command("theme-settings", t("commandThemeSettings"), t("commandThemeDesc"), ["主题", "外观", "深色", "浅色", "theme"], "settings", "settings", "settings-appearance"),
    command("ai-settings", t("commandAISettings"), t("commandAIDesc"), ["AI", "模型", "ollama", "cloud"], "settings", "settings", "settings-ai")
  ];
}

export function queryCommandRegistry(query: string, registry: SpotlightCommand[]) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return registry.filter((item) =>
    [item.label, item.description, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle)
  );
}

export function executeSpotlightCommand(
  command: SpotlightCommand,
  actions: {
    setView: (view: View) => void;
    requestSettingsSection: (sectionId: string) => void;
    onClose: () => void;
  }
) {
  actions.setView(command.view);
  if (command.settingsSection) actions.requestSettingsSection(command.settingsSection);
  actions.onClose();
}

export const SETTINGS_SECTION_EVENT = "zen-canvas:settings-section";

export function requestSettingsSection(sectionId: string) {
  try {
    window.sessionStorage.setItem(SETTINGS_SECTION_EVENT, sectionId);
  } catch {
    // The in-memory event still handles the current window.
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_SECTION_EVENT, { detail: sectionId }));
}

function command(
  id: string,
  label: string,
  description: string,
  keywords: string[],
  group: SpotlightCommandGroup,
  view: View,
  settingsSection?: string
): SpotlightCommand {
  return { kind: "command", id, label, description, keywords, group, view, settingsSection };
}
