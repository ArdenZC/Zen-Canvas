// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, SettingsProvider, type ChromeContextValue, type SettingsContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { OnboardingDialog, ONBOARDING_STORAGE_KEY } from "../src/components/OnboardingDialog";
import type { AIProductFeatureReadiness, AppSettings } from "../src/types/domain";
import { SETTINGS_SECTION_EVENT } from "../src/components/spotlight/commandRegistry";
import { AI_SETTINGS_MODE_REQUEST_KEY } from "../src/views/settings/settingsNavigation";

const apiMocks = vi.hoisted(() => ({
  getAIFeatureReadiness: vi.fn(),
  addManagedScope: vi.fn()
}));
const dialogMocks = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: apiMocks }));
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);

const t = makeTranslator("zh");
const settings: AppSettings = {
  closeBehavior: "ask",
  folderNamingLanguage: "zh",
  defaultScanFolders: [],
  restoreRetentionDays: 30,
  launchAtLogin: false,
  backgroundIndexOnStartup: false,
  searchHotkey: "Ctrl+Shift+Space",
  searchScopeMode: "all",
  customSearchRoots: [],
  organizeRootMode: "current_folder",
  organizeRootPath: undefined,
  useLegacyBuiltinClassificationRules: false,
  useLearnedRulesAsAutoRules: false
};
const readiness: AIProductFeatureReadiness = {
  provider: {
    state: "disabled",
    reason: "provider_disabled",
    providerMode: "cloud",
    providerKind: "openai_compatible",
    providerPreset: null,
    model: null,
    credentialRequired: true,
    credentialConfigured: false,
    settingsRevision: "fixture",
    bindingFingerprint: "fixture"
  },
  managedScopes: [],
  cleanup: {
    state: "disabled",
    reason: "provider_disabled",
    provider: {
      state: "disabled",
      reason: "provider_disabled",
      providerMode: "cloud",
      providerKind: "openai_compatible",
      providerPreset: null,
      model: null,
      credentialRequired: true,
      credentialConfigured: false,
      settingsRevision: "fixture",
      bindingFingerprint: "fixture"
    },
    cleanupAiEnabled: true,
    localAiAllowed: false,
    cloudAiAllowed: false,
    bindingFingerprint: "fixture",
    disclosure: {
      providerPayloadIncludesFileName: false,
      providerPayloadIncludesParentPath: false,
      providerPayloadIncludesFullPath: false,
      providerPayloadIncludesFileContent: false,
      providerContentIsBounded: true
    }
  }
};

function makeSettingsContext(overrides: Partial<SettingsContextValue> = {}) {
  return {
    settings,
    isLoadingSettings: false,
    settingsError: "",
    updateSettings: vi.fn().mockResolvedValue(true),
    setFolderNamingLanguage: vi.fn().mockResolvedValue(true),
    setDefaultScanFolders: vi.fn().mockResolvedValue(true),
    setRestoreRetentionDays: vi.fn().mockResolvedValue(true),
    setLaunchAtLogin: vi.fn().mockResolvedValue(true),
    setBackgroundIndexOnStartup: vi.fn().mockResolvedValue(true),
    setSearchHotkey: vi.fn().mockResolvedValue(true),
    setSearchScopeMode: vi.fn().mockResolvedValue(true),
    setCustomSearchRoots: vi.fn().mockResolvedValue(true),
    setOrganizeRootMode: vi.fn().mockResolvedValue(true),
    setOrganizeRootPath: vi.fn().mockResolvedValue(true),
    ...overrides
  } as unknown as SettingsContextValue;
}

function makeChrome(setView = vi.fn()) {
  return { t, setView, view: "scanner", language: "zh", theme: "light", onError: vi.fn() } as unknown as ChromeContextValue;
}

function flushFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function flushAsync() {
  return act(async () => {
    await Promise.resolve();
    await flushFrame();
  });
}

describe("first-run onboarding", () => {
  let root: Root;
  let setView: ReturnType<typeof vi.fn<(view: string) => void>>;
  const nativeGetClientRects = HTMLElement.prototype.getClientRects;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    document.body.innerHTML = '<div id="app-shell-content"><button id="background">Background</button></div><div id="test-root"></div>';
    HTMLElement.prototype.getClientRects = () => [{ width: 120, height: 40, top: 0, left: 0, right: 120, bottom: 40, x: 0, y: 0, toJSON() { return {}; } }] as unknown as DOMRectList;
    setView = vi.fn();
    sessionStorage.clear();
    apiMocks.getAIFeatureReadiness.mockReset().mockResolvedValue(readiness);
    apiMocks.addManagedScope.mockReset().mockResolvedValue({ id: "managed-scope" });
    dialogMocks.open.mockReset().mockResolvedValue("D:/Documents");
    root = createRoot(document.getElementById("test-root")!);
  });

  afterEach(() => {
    act(() => root.unmount());
    HTMLElement.prototype.getClientRects = nativeGetClientRects;
    document.body.innerHTML = "";
    localStorage.clear();
  });

  function renderOnboarding(overrides: Partial<SettingsContextValue> = {}) {
    act(() => root.render(createElement(
      ChromeProvider,
      { value: makeChrome(setView), children: createElement(SettingsProvider, { value: makeSettingsContext(overrides), children: createElement(OnboardingDialog) }) }
    )));
  }

  async function clickNext() {
    const next = document.querySelector<HTMLButtonElement>("[data-onboarding-next]");
    expect(next).toBeTruthy();
    await act(async () => next?.click());
    await flushAsync();
  }

  async function reachConnectStep() {
    await clickNext();
    expect(document.querySelector('[data-onboarding-step="2"]')).toBeTruthy();
  }

  async function reachFolderStep() {
    await reachConnectStep();
    await clickNext();
    expect(document.querySelector('[data-onboarding-step="3"]')).toBeTruthy();
  }

  async function chooseFolder() {
    const chooseFolderButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("选择文件夹"));
    expect(chooseFolderButton).toBeTruthy();
    await act(async () => chooseFolderButton?.click());
    await flushAsync();
    expect(dialogMocks.open).toHaveBeenCalledWith(expect.objectContaining({ directory: true, multiple: false }));
  }

  it("completes the five-step first-run flow with separate Managed AI and Cleanup permissions", async () => {
    const setDefaultScanFolders = vi.fn().mockResolvedValue(true);
    renderOnboarding({ setDefaultScanFolders });
    await flushAsync();

    expect(document.querySelector('[data-onboarding-step="1"]')).toBeTruthy();
    await reachFolderStep();
    await chooseFolder();
    const managedConsents = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(managedConsents).toHaveLength(2);
    await act(async () => {
      managedConsents[0].click();
      managedConsents[1].click();
    });
    await clickNext();

    expect(setDefaultScanFolders).toHaveBeenCalledOnce();
    expect(apiMocks.addManagedScope).toHaveBeenCalledWith({
      path: "D:/Documents",
      enabled: true,
      allowLocalAi: true,
      allowCloudAi: true
    });
    expect(document.querySelector('[data-onboarding-step="4"]')).toBeTruthy();
    expect(document.body.textContent).toContain("Cleanup 授权与 Organize 授权互相独立");
    await clickNext();

    expect(document.querySelector('[data-onboarding-step="5"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-onboarding-step="5"] ol li')).toHaveLength(6);
    expect(document.body.textContent).toContain("AI 整理");
    expect(document.body.textContent).toContain("AI 清理");
    await clickNext();

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(setView).toHaveBeenCalledWith("scanner");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(apiMocks.getAIFeatureReadiness).toHaveBeenCalled();
  });

  it.each(["local", "cloud"] as const)("routes the %s AI choice through existing AI Settings", async (mode) => {
    renderOnboarding();
    await flushAsync();
    await reachConnectStep();
    const choice = document.querySelector<HTMLButtonElement>(`[data-onboarding-provider-mode="${mode}"]`);
    expect(choice).toBeTruthy();
    await act(async () => choice?.click());
    expect(choice?.getAttribute("aria-pressed")).toBe("true");
    const configure = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("在 AI 设置中继续"));
    await act(async () => configure?.click());
    expect(sessionStorage.getItem(AI_SETTINGS_MODE_REQUEST_KEY)).toBe(mode);
    expect(setView).toHaveBeenCalledWith("settings");
    expect(document.querySelector('[data-onboarding-step="2"]')).toBeNull();
  });

  it("routes Cleanup permission to its separate existing Settings controls", async () => {
    renderOnboarding();
    await flushAsync();
    await reachFolderStep();
    await clickNext();
    expect(document.querySelector('[data-onboarding-step="4"]')).toBeTruthy();
    const cleanupSettings = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("打开 Cleanup AI 设置"));
    await act(async () => cleanupSettings?.click());
    expect(sessionStorage.getItem(SETTINGS_SECTION_EVENT)).toBe("settings-ai-cleanup");
    expect(setView).toHaveBeenCalledWith("settings");
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
  });

  it("allows Skip AI to complete onboarding while keeping non-AI core features available", async () => {
    const setDefaultScanFolders = vi.fn().mockResolvedValue(true);
    renderOnboarding({ setDefaultScanFolders });
    await flushAsync();
    await act(async () => document.querySelector<HTMLButtonElement>("[data-onboarding-skip-ai]")?.click());

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(setDefaultScanFolders).not.toHaveBeenCalled();
    expect(apiMocks.addManagedScope).not.toHaveBeenCalled();
    expect(setView).toHaveBeenCalledWith("scanner");
    expect(t("modeAIDisabledDesc")).toContain("文件、搜索、预览和历史恢复仍可使用");
    expect(t("modeAIDisabledDesc")).toContain("AI 整理与 AI 清理需要连接提供商");
  });

  it("lets Escape exit the modal without trapping first-run setup", async () => {
    renderOnboarding();
    await flushAsync();
    expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps the default and narrow layout scrollable with reachable keyboard controls", async () => {
    renderOnboarding();
    await flushAsync();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const description = document.querySelector<HTMLElement>("#onboarding-description");
    const footer = dialog?.querySelector("footer");
    expect(dialog?.className).toContain("w-full max-w-3xl");
    expect(dialog?.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(description?.className).toContain("overflow-y-auto");
    expect(description?.className).toContain("overscroll-contain");
    expect(footer?.className).toContain("flex-wrap");
    expect(document.querySelector<HTMLButtonElement>("[data-onboarding-next]")?.disabled).toBe(false);
  });

  it("keeps Getting Started discoverable after onboarding was completed", async () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    renderOnboarding();
    await flushAsync();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const restart = document.querySelector<HTMLButtonElement>("[data-getting-started]");
    expect(restart).toBeTruthy();
    await act(async () => restart?.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
