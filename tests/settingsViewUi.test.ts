import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("settings view UI", () => {
  it("uses system-preferences sections and shared settings primitives", () => {
    const settingsView = read("src/views/settings/SettingsView.tsx");
    const sharedUi = read("src/views/shared/ui.ts");
    const t = makeTranslator("zh");

    expect(t("settingsAppearanceLanguage")).toBe("外观与语言");
    expect(t("settingsScanRoots")).toBe("扫描目录");
    expect(t("settingsSearch")).toBe("搜索");
    expect(t("settingsOrganizeRoot")).toBe("整理目标根目录");
    expect(t("organizeRootCurrentFolder")).toBe("当前文件夹下分类");
    expect(t("organizeRootZenCanvasFolder")).toBe("集中放入 ZenCanvas 文件夹");
    expect(t("organizeRootCustomRoot")).toBe("自定义整理目录");
    expect(t("settingsSafetyRestore")).toBe("安全与恢复");
    expect(t("settingsWindowBehavior")).toBe("窗口行为");
    expect(t("settingsStartup")).toBe("启动项");
    expect(t("settingsDeveloperRelease")).toBe("开发检查");

    expect(sharedUi).toContain("ControlGroup");
    expect(sharedUi).toContain("SwitchButton");
    expect(sharedUi).toContain("SwitchField");
    expect(sharedUi).toContain("SegmentedControl");
    expect(settingsView).toContain("formSection");
    expect(settingsView).toContain("formRow");
    expect(settingsView).toContain("ControlGroup");
    expect(settingsView).toContain("SwitchButton");
    expect(settingsView).toContain("SwitchField");
    expect(settingsView).toContain("SegmentedControl");
    expect(settingsView).toContain('t("settingsAppearanceLanguage")');
    expect(settingsView).toContain('t("settingsScanRoots")');
    expect(settingsView).toContain('t("settingsSearch")');
    expect(settingsView).toContain('t("settingsOrganizeRoot")');
    expect(settingsView).toContain("organizeRootMode");
    expect(settingsView).toContain("setOrganizeRootMode");
    expect(settingsView).toContain("setOrganizeRootPath");
    expect(settingsView).toContain('t("organizePreviewStillRequired")');
    expect(settingsView).toContain('t("settingsSafetyRestore")');
    expect(settingsView).toContain('t("settingsWindowBehavior")');
    expect(settingsView).toContain('t("settingsStartup")');
    expect(settingsView).toContain('t("settingsDeveloperRelease")');
    expect(settingsView).toContain("settingsSectionsLabel");
    expect(settingsView).toContain('useState("settings-appearance")');
    expect(settingsView).toContain('id="settings-general"');
    expect(settingsView).toContain('id="settings-appearance"');
    expect(settingsView).toContain('id="settings-files-scan"');
    expect(settingsView).toContain('id="settings-automation"');
    expect(settingsView).toContain('id="settings-ai"');
    expect(settingsView).toContain('id="settings-privacy"');
    expect(settingsView).toContain('id="settings-about"');
    expect(settingsView).not.toContain("statusToast");
  });

  it("polishes hotkey capture, directory rows, and developer release affordance", () => {
    const settingsView = read("src/views/settings/SettingsView.tsx");
    const t = makeTranslator("zh");

    expect(t("hotkeyCaptureTitle")).toBe("正在录制快捷键");
    expect(t("hotkeyCaptureCurrent")).toBe("当前按键");
    expect(t("settingsSavedInline")).toBe("已保存");
    expect(t("developerReleaseDesc")).toContain("开发用途");
    expect(t("confirmDeleteScanFolderTitle")).toBe("删除这个扫描目录？");
    expect(t("confirmDeleteSearchFolderTitle")).toBe("删除这个搜索目录？");

    expect(settingsView).toContain("recordingHotkeyPreview");
    expect(settingsView).toContain("statusLabel={root.enabled ? t(\"enabled\") : t(\"disabled\")}");
    expect(settingsView).not.toContain("className={toggleSwitch(root.enabled)}");
    expect(settingsView).toContain("NoticeBanner");
    expect(settingsView).toContain("StateBlock");
    expect(settingsView).toContain("compactPath(root.path");
    expect(settingsView).toContain('aria-label={t("deleteScanFolder")}');
    expect(settingsView).toContain('title={t("deleteScanFolder")}');
    expect(settingsView).toContain('aria-label={t("deleteSearchFolder")}');
    expect(settingsView).toContain('title={t("deleteSearchFolder")}');
    expect(settingsView).toContain("ConfirmDialog");
    expect(settingsView).toContain("folderDeleteConfirm");
    expect(settingsView).toContain("aria-pressed={searchHotkey === accelerator}");
    expect(settingsView).toContain('t("confirmDeleteScanFolderDesc")');
    expect(settingsView).toContain('t("confirmDeleteSearchFolderDesc")');
    expect(settingsView).toContain("<details");
    expect(settingsView).toContain('DEVELOPER_MODE_STORAGE_KEY = "zc-developer-mode"');
    expect(settingsView).toContain('developerMode ? (');
    expect(settingsView).toContain('t("developerModeDesc")');
    expect(settingsView).toContain("setTimeout");
  });
});
