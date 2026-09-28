import { SETTINGS_SECTION_EVENT } from "../../components/spotlight/commandRegistry";
import type { View } from "../../types/ui";

export const AI_SETTINGS_MODE_REQUEST_KEY = "zc-ai-settings-mode-request";

export function openSettingsSection(setView: (view: View) => void, sectionId: string) {
  try {
    window.sessionStorage.setItem(SETTINGS_SECTION_EVENT, sectionId);
  } catch {
    // The Settings view still opens when session storage is unavailable.
  }
  setView("settings");
}

export function openAISettingsForMode(setView: (view: View) => void, mode: "local" | "cloud") {
  try {
    window.sessionStorage.setItem(AI_SETTINGS_MODE_REQUEST_KEY, mode);
  } catch {
    // The user can still choose the provider mode directly in Settings.
  }
  openSettingsSection(setView, "settings-ai-provider");
}
