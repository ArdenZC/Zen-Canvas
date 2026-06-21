import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  nextDefaultScanFolders
} from "../src/hooks/useAppSettings";

describe("app settings helpers", () => {
  it("matches the backend default settings shape", () => {
    expect(DEFAULT_APP_SETTINGS).toEqual({
      closeBehavior: "ask",
      folderNamingLanguage: "en",
      defaultScanFolders: ["Desktop", "Downloads", "Documents"],
      restoreRetentionDays: 30,
      launchAtLogin: false
    });
  });

  it("merges partial settings without mutating the previous object", () => {
    const previous = DEFAULT_APP_SETTINGS;

    const next = mergeAppSettings(previous, {
      defaultScanFolders: ["Downloads"],
      restoreRetentionDays: 90
    });

    expect(next).toEqual({
      closeBehavior: "ask",
      folderNamingLanguage: "en",
      defaultScanFolders: ["Downloads"],
      restoreRetentionDays: 90,
      launchAtLogin: false
    });
    expect(previous.defaultScanFolders).toEqual(["Desktop", "Downloads", "Documents"]);
  });

  it("toggles default scan folders while keeping at least one selected", () => {
    expect(nextDefaultScanFolders(["Desktop", "Downloads"], "Downloads")).toEqual(["Desktop"]);
    expect(nextDefaultScanFolders(["Desktop"], "Desktop")).toEqual(["Desktop"]);
    expect(nextDefaultScanFolders(["Desktop"], "Documents")).toEqual(["Desktop", "Documents"]);
  });
});
