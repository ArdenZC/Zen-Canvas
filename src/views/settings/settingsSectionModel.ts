export const SETTINGS_SECTION_IDS = [
  "settings-general",
  "settings-appearance",
  "settings-files-scan",
  "settings-search",
  "settings-global-index",
  "settings-platform-diagnostics",
  "settings-managed-scopes",
  "settings-automation",
  "settings-ai",
  "settings-privacy",
  "settings-about"
] as const;

export type SettingsSectionId = typeof SETTINGS_SECTION_IDS[number];

export const PROGRESSIVE_SETTINGS_SECTION_IDS = [
  "settings-global-index",
  "settings-platform-diagnostics",
  "settings-managed-scopes"
] as const satisfies readonly SettingsSectionId[];

const progressiveSectionIds = new Set<string>(PROGRESSIVE_SETTINGS_SECTION_IDS);

export const SETTINGS_NAV_SECTION_IDS = SETTINGS_SECTION_IDS.filter(
  (sectionId) => !progressiveSectionIds.has(sectionId)
);

export function isProgressiveSettingsSectionId(sectionId: string) {
  return progressiveSectionIds.has(sectionId);
}

export function settingsSectionRequestTarget(sectionId: string) {
  return sectionId === "settings-search-scope" ? "settings-search" : sectionId;
}

export function settingsNavigationSectionId(sectionId: string) {
  const targetId = settingsSectionRequestTarget(sectionId);
  if (targetId === "settings-global-index" || targetId === "settings-platform-diagnostics") return "settings-search";
  if (targetId === "settings-managed-scopes") return "settings-ai";
  return targetId;
}
