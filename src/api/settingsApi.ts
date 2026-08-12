import { invokeCommand } from "./core";
import type { SaveSettingsRequest, VersionedAppSettings } from "../types/domain";

export const settingsApi = {
  getSettings(): Promise<VersionedAppSettings> {
    return invokeCommand<VersionedAppSettings>("get_settings");
  },
  saveSettings(request: SaveSettingsRequest): Promise<VersionedAppSettings> {
    return invokeCommand<VersionedAppSettings>("save_settings", { request });
  }
};

export type SettingsApi = typeof settingsApi;
