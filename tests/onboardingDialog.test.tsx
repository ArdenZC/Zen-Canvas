// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, SettingsProvider, type ChromeContextValue, type SettingsContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { OnboardingDialog, ONBOARDING_STORAGE_KEY } from "../src/components/OnboardingDialog";
import type { AIProviderPreset, AISettings, AppSettings } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  getAISettings: vi.fn(),
  listAIProviderPresets: vi.fn(),
  saveAISettings: vi.fn()
}));
const dialogMocks = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: apiMocks }));
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);

import { useAIProcessingModeStore } from "../src/store/useAIProcessingModeStore";

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
const aiSettings: AISettings = {
  enabled: false,
  provider: "openai_compatible",
  preset: "deepseek",
  baseUrl: "https://api.deepseek.com",
  chatPath: "/chat/completions",
  apiKey: "",
  apiKeyConfigured: false,
  model: "deepseek-chat",
  temperature: 0.2,
  maxTokens: 2048,
  batchSize: 10,
  classificationConcurrency: 2,
  timeoutSeconds: 60,
  sendFullPath: false,
  sendParentPath: true,
  classificationMode: "hybrid",
  cleanupAiEnabled: false,
  forceJsonOutput: true,
  enableThinking: false,
  reasoningEffort: null,
  extraBodyJson: null
};
const presets: AIProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    providerKind: "openai_compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultChatPath: "/chat/completions",
    defaultModel: "deepseek-chat",
    supportsResponseFormat: true,
    supportsJsonMode: true,
    supportsThinking: false,
    supportsReasoningEffort: false
  },
  {
    id: "ollama",
    label: "Ollama",
    providerKind: "ollama",
    defaultBaseUrl: "http://127.0.0.1:11434",
    defaultChatPath: "/v1/chat/completions",
    defaultModel: "llama3.2",
    supportsResponseFormat: true,
    supportsJsonMode: true,
    supportsThinking: false,
    supportsReasoningEffort: false
  }
];

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
    apiMocks.getAISettings.mockReset().mockResolvedValue({ ...aiSettings });
    apiMocks.listAIProviderPresets.mockReset().mockResolvedValue(presets);
    apiMocks.saveAISettings.mockReset().mockImplementation(async (next: AISettings) => next);
    dialogMocks.open.mockReset().mockResolvedValue("D:/Documents");
    useAIProcessingModeStore.setState({ status: "loading", settings: null, error: "" });
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

  it("walks through privacy, scope, and AI choices using existing persistence paths", async () => {
    const setDefaultScanFolders = vi.fn().mockResolvedValue(true);
    renderOnboarding({ setDefaultScanFolders });
    await flushAsync();

    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.body.textContent).toContain("本地优先");

    const firstNext = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "继续");
    await act(async () => firstNext?.click());
    expect(document.body.textContent).toContain("选择要建立索引的范围");
    const chooseFolder = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("选择文件夹"));
    expect(chooseFolder).toBeTruthy();
    await act(async () => chooseFolder?.click());
    expect(dialogMocks.open).toHaveBeenCalledWith(expect.objectContaining({ directory: true, multiple: false }));
    expect(setDefaultScanFolders).toHaveBeenCalledOnce();

    const next = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "继续");
    await act(async () => next?.click());
    await flushAsync();
    expect(document.body.textContent).toContain("选择 AI 处理模式");

    const cloud = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.startsWith("云端 AI"));
    expect(cloud).toBeTruthy();
    await act(async () => cloud?.click());
    const finish = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "进入概览");
    await act(async () => finish?.click());

    expect(apiMocks.saveAISettings).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, provider: "openai_compatible", preset: "deepseek" }));
    expect(useAIProcessingModeStore.getState()).toMatchObject({ settings: { enabled: false, provider: "openai_compatible" } });
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(setView).toHaveBeenCalledWith("scanner");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("fails closed when AI persistence fails and still allows a safe skip", async () => {
    apiMocks.saveAISettings.mockRejectedValue(new Error("sqlite offline"));
    renderOnboarding();
    await flushAsync();
    const next = () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "继续");
    await act(async () => next()?.click());
    await act(async () => next()?.click());
    await flushAsync();
    const finish = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "进入概览");
    await act(async () => finish?.click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("首次使用设置未保存");
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(setView).not.toHaveBeenCalled();

    const skip = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "稍后设置");
    await act(async () => skip?.click());
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(setView).toHaveBeenCalledWith("scanner");
  });
});
