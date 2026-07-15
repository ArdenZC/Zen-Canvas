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
    const settingsPrimitives = read("src/views/settings/components/SettingsPrimitives.tsx");
    const sharedUi = read("src/views/shared/ui.ts");
    const appShell = read("src/components/AppShell.tsx");
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
    expect(settingsView).toContain("SettingsLayout");
    expect(settingsView).toContain("SettingsSection");
    expect(settingsView).toContain("SettingsControlGroup");
    expect(settingsView).toContain("SettingsSegmentedControl");
    expect(settingsView).toContain("SettingsSwitch");
    expect(settingsPrimitives).toContain('data-settings-scroll-container');
    expect(settingsPrimitives).toContain('min-[1180px]:grid-cols-[minmax(190px,220px)_minmax(0,960px)]');
    expect(settingsPrimitives).toContain('role="radiogroup"');
    expect(settingsPrimitives).toContain('role="switch"');
    expect(settingsPrimitives).toContain("data-settings-switch-track");
    expect(settingsPrimitives).toContain("data-settings-switch-thumb");
    expect(settingsPrimitives).toContain('aria-current={active ? "location" : undefined}');
    expect(settingsPrimitives).toContain("centerSettingsNavItem");
    expect(settingsPrimitives).not.toContain('scrollIntoView({ block: "nearest", inline: "nearest" })');
    expect(settingsPrimitives).toContain("[scrollbar-width:none]");
    expect(settingsPrimitives).toContain('data-settings-nav-fade="end"');
    expect(settingsPrimitives).toContain("sticky top-0 z-20");
    expect(settingsPrimitives).toContain("min-[1180px]:grid-cols-[minmax(0,1fr)_minmax(0,360px)]");
    expect(settingsPrimitives).not.toContain("min-[720px]:grid-cols");
    expect(settingsView).toContain('t("settingsAppearance")');
    expect(settingsView).toContain('t("settingsScanRoots")');
    expect(settingsView).toContain('t("settingsSearch")');
    expect(settingsView).toContain('t("settingsOrganizeRoot")');
    expect(settingsView).toContain("organizeRootMode");
    expect(settingsView).toContain("setOrganizeRootMode");
    expect(settingsView).toContain("setOrganizeRootPath");
    expect(settingsView).toContain('t("organizePreviewStillRequired")');
    expect(settingsView).toContain('t("settingsPrivacy")');
    expect(settingsView).toContain('t("settingsWindowBehavior")');
    expect(settingsView).toContain('t("settingsStartup")');
    expect(settingsView).toContain('t("developerMode")');
    expect(settingsView).toContain("settingsSectionsLabel");
    expect(settingsView).toContain("href={packageInfo.homepage}");
    expect(settingsView).toContain('t("aboutOpenProject")');
    expect(settingsView).not.toContain("<h1");
    expect(appShell).toContain("ShellViewHeading");
    const sectionOrder = [
      "settings-general",
      "settings-appearance",
      "settings-files-scan",
      "settings-search",
      "settings-automation",
      "settings-ai",
      "settings-privacy",
      "settings-about"
    ].map((id) => settingsView.indexOf(`id=\"${id}\"`));
    expect(sectionOrder.every((index) => index >= 0)).toBe(true);
    expect(sectionOrder).toEqual([...sectionOrder].sort((left, right) => left - right));
    expect(settingsView).toContain('useState("settings-general")');
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
    expect(settingsView).not.toContain("statusLabel={root.enabled ? t(\"enabled\") : t(\"disabled\")}");
    expect(settingsView).not.toContain("className={toggleSwitch(root.enabled)}");
    expect(settingsView).toContain("SettingsInlineMessage");
    expect(settingsView).toContain("SettingsEmptyState");
    expect(settingsView).toContain("compactPath(root.path");
    expect(settingsView).toContain('aria-label={t("deleteScanFolder")}');
    expect(settingsView).toContain('title={t("deleteScanFolder")}');
    expect(settingsView).toContain('aria-label={t("deleteSearchFolder")}');
    expect(settingsView).toContain('title={t("deleteSearchFolder")}');
    expect(settingsView).toContain("ConfirmDialog");
    expect(settingsView).toContain("folderDeleteConfirm");
    expect(settingsView).toContain("if (saved) setFolderDeleteConfirm(null)");
    expect(settingsView).toContain("async function pickFolder(title: string)");
    expect(settingsView).toContain('t("folderPickerFailed")');
    expect(settingsView).toContain("aria-pressed={searchHotkey === accelerator}");
    expect(settingsView).toContain('t("confirmDeleteScanFolderDesc")');
    expect(settingsView).toContain('t("confirmDeleteSearchFolderDesc")');
    expect(settingsView).toContain("SettingsDisclosure");
    expect(settingsView).toContain('DEVELOPER_MODE_STORAGE_KEY = "zc-developer-mode"');
    expect(settingsView).toContain('developerMode ? (');
    expect(settingsView).toContain('t("developerModeDesc")');
    expect(settingsView).toContain("setTimeout");
  });

  it("keeps AI settings fail-closed, visibly dirty, localized, and keyboard-selectable", () => {
    const settingsView = read("src/views/settings/SettingsView.tsx");
    const settingsPrimitives = read("src/views/settings/components/SettingsPrimitives.tsx");
    const en = makeTranslator("en");

    expect(settingsView).toContain("data-ai-save-bar");
    expect(settingsView).toContain("data-ai-runtime-mode={runtimeAIUserMode}");
    expect(settingsView).toContain("data-ai-draft-mode={draftAIUserMode}");
    expect(settingsView).toContain('data-ai-settings-state="error"');
    expect(settingsView).toContain("disabled={!aiSettingsDirty || isSavingAISettings || isTestingAIConnection}");
    expect(settingsView).toContain("aiSettingsSaveFailed");
    expect(settingsView).not.toContain("setAiSettings(previous)");
    expect(settingsView).toContain('layout="three-option-responsive"');
    expect(settingsView).not.toContain("settings-ai-advanced-provider");
    expect(settingsPrimitives).toContain('role="radiogroup"');
    expect(settingsPrimitives).toContain('role="radio"');
    expect(settingsPrimitives).toContain("aria-checked={selected}");
    expect(settingsView).toContain("AI_CLASSIFICATION_PRESET_IDS");
    expect(settingsView.match(/id="settings-ai-provider"/g)).toHaveLength(1);
    expect(settingsView).toContain("apiKey: settings.apiKey");
    expect(settingsView).not.toContain("batchSize: preset.providerKind");
    expect(settingsView).toContain("scrollSettingsSectionIntoView(settingsScrollRef.current, targetId, options)");
    expect(settingsView).toContain('container.addEventListener("scroll", scheduleUpdate');
    expect(settingsView).toContain("developerMode ? (");
    expect(settingsView).toContain('t("aiAdvancedConnection")');
    expect(settingsView).toContain("SettingsSecretField");
    expect(settingsView).toContain("disabled={aiDependentControlsDisabled}");
    expect(settingsView).not.toContain("min-[720px]:grid-cols");
    expect(settingsView).not.toContain("aiModeForSettings");
    expect(en("languageDesc")).not.toMatch(/[\u3400-\u9fff]/);
    expect(en("globalSearch")).toContain("folders");
    expect(en("aiChatPathLabel")).toBe("Chat endpoint path");
    expect(en("aiBatchSizeLabel")).toBe("Batch size");
    expect(en("aiTimeoutLabel")).toBe("Timeout (seconds)");
    expect(en("showApiKey")).toBe("Show API key");
    expect(en("hideApiKey")).toBe("Hide API key");
  });
});
