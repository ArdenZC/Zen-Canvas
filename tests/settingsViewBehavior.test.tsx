// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProviderPreset, AISettings } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  getAISettings: vi.fn(),
  listAIProviderPresets: vi.fn(),
  saveAISettings: vi.fn(),
  publishAIProcessingMode: vi.fn(),
  getGlobalHotkeyStatus: vi.fn(),
  testAIProviderConnection: vi.fn(),
  debugAIClassificationOnce: vi.fn(),
  updateSettings: vi.fn(),
  scanPath: vi.fn(),
  enqueueRoot: vi.fn(),
  setGlobalHotkeyError: vi.fn()
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    getAISettings: mocks.getAISettings,
    listAIProviderPresets: mocks.listAIProviderPresets,
    saveAISettings: mocks.saveAISettings,
    getGlobalHotkeyStatus: mocks.getGlobalHotkeyStatus,
    testAIProviderConnection: mocks.testAIProviderConnection,
    debugAIClassificationOnce: mocks.debugAIClassificationOnce
  }
}));

vi.mock("../src/contexts/AppContexts", async () => {
  const { makeTranslator } = await import("../src/i18n");
  const saved = vi.fn(async () => true);
  return {
    useChromeContext: () => ({
      language: "en",
      setLanguage: vi.fn(),
      theme: "light",
      setTheme: vi.fn(),
      setView: vi.fn(),
      platform: "browser",
      closeBehavior: "ask",
      setCloseBehavior: saved,
      t: makeTranslator("en")
    }),
    useSettingsContext: () => ({
      settings: {
        folderNamingLanguage: "en",
        defaultScanFolders: [],
        restoreRetentionDays: 30,
        launchAtLogin: false,
        backgroundIndexOnStartup: false,
        searchHotkey: "CmdOrCtrl+K",
        searchScopeMode: "all",
        customSearchRoots: [],
        organizeRootMode: "current_folder",
        organizeRootPath: undefined,
        useLegacyBuiltinClassificationRules: false,
        useLearnedRulesAsAutoRules: false
      },
      updateSettings: mocks.updateSettings,
      setFolderNamingLanguage: saved,
      setDefaultScanFolders: saved,
      setRestoreRetentionDays: saved,
      setLaunchAtLogin: saved,
      setBackgroundIndexOnStartup: saved,
      setSearchHotkey: saved,
      setSearchScopeMode: saved,
      setCustomSearchRoots: saved,
      setOrganizeRootMode: saved,
      setOrganizeRootPath: saved
    })
  };
});

vi.mock("../src/store/useScanManagerStore", () => ({
  useScanManagerStore: (selector: (state: { scanPath: typeof mocks.scanPath }) => unknown) => selector({ scanPath: mocks.scanPath })
}));

vi.mock("../src/store/useBackgroundIndexerStore", () => ({
  useBackgroundIndexerStore: (selector: (state: {
    pendingRoots: string[];
    currentRoot: string | null;
    isBackgroundIndexing: boolean;
    failedRoots: Array<{ path: string; message: string }>;
    completedRoots: string[];
    enqueueRoot: typeof mocks.enqueueRoot;
  }) => unknown) => selector({
    pendingRoots: [],
    currentRoot: null,
    isBackgroundIndexing: false,
    failedRoots: [],
    completedRoots: [],
    enqueueRoot: mocks.enqueueRoot
  })
}));

vi.mock("../src/store/useAppStore", () => ({
  useAppStore: (selector: (state: { globalHotkeyError: string; setGlobalHotkeyError: typeof mocks.setGlobalHotkeyError }) => unknown) => selector({
    globalHotkeyError: "",
    setGlobalHotkeyError: mocks.setGlobalHotkeyError
  })
}));

vi.mock("../src/store/useAIProcessingModeStore", () => ({
  useAIProcessingModeStore: (selector: (state: { publish: typeof mocks.publishAIProcessingMode }) => unknown) => selector({
    publish: mocks.publishAIProcessingMode
  })
}));

vi.mock("../src/store/useFileLibraryStore", () => ({
  useFileLibraryStore: (selector: (state: { selectedFileId: string | null; libraryPage: { files: [] } }) => unknown) => selector({
    selectedFileId: null,
    libraryPage: { files: [] }
  })
}));

import { SettingsView } from "../src/views/settings/SettingsView";

const secret = "TEST_SECRET_DO_NOT_EXPOSE";

const cloudPreset: AIProviderPreset = {
  id: "deepseek",
  label: "DeepSeek",
  providerKind: "openai_compatible",
  defaultBaseUrl: "https://api.deepseek.com",
  defaultChatPath: "/chat/completions",
  defaultModel: "deepseek-chat",
  supportsResponseFormat: true,
  supportsThinking: true,
  supportsReasoningEffort: false
};

const customPreset: AIProviderPreset = {
  ...cloudPreset,
  id: "custom_openai_compatible",
  label: "Custom",
  defaultBaseUrl: "https://custom.example",
  defaultModel: "custom-model"
};

const localPreset: AIProviderPreset = {
  ...cloudPreset,
  id: "ollama",
  label: "Ollama",
  providerKind: "ollama",
  defaultBaseUrl: "http://127.0.0.1:11434",
  defaultChatPath: "/api/chat",
  defaultModel: "qwen3",
  supportsResponseFormat: false,
  supportsThinking: false
};

function initialAISettings(): AISettings {
  return {
    enabled: true,
    provider: "openai_compatible",
    preset: "deepseek",
    baseUrl: "https://api.deepseek.com/custom",
    chatPath: "/chat/completions",
    apiKey: secret,
    apiKeyConfigured: true,
    model: "preserved-model",
    temperature: 0,
    maxTokens: 1024,
    batchSize: 10,
    classificationConcurrency: 2,
    timeoutSeconds: 120,
    sendFullPath: false,
    sendParentPath: true,
    classificationMode: "ai_first",
    cleanupAiEnabled: true,
    forceJsonOutput: false,
    enableThinking: false,
    reasoningEffort: null,
    extraBodyJson: null
  };
}

let container: HTMLDivElement;
let root: Root;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.setItem("zc-developer-mode", "true");
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => undefined;
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  mocks.getAISettings.mockResolvedValue(initialAISettings());
  mocks.listAIProviderPresets.mockResolvedValue([cloudPreset, customPreset, localPreset]);
  mocks.getGlobalHotkeyStatus.mockResolvedValue({ error: null });
  mocks.updateSettings.mockResolvedValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<SettingsView />));
  await flushEffects();
  mocks.publishAIProcessingMode.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("settings view behavior", () => {
  it("disables AI-dependent controls while off and restores preserved configuration when re-enabled", async () => {
    const modeGroup = container.querySelector<HTMLElement>('[role="radiogroup"][aria-label="AI mode"]')!;
    const modeRadios = [...modeGroup.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const off = modeRadios.find((radio) => radio.textContent === "AI is off")!;
    const cloud = modeRadios.find((radio) => radio.textContent === "Using cloud AI")!;
    const apiKey = container.querySelector<HTMLInputElement>("#settings-ai-api-key")!;
    const baseUrl = container.querySelector<HTMLInputElement>("#settings-ai-base-url")!;
    const model = container.querySelector<HTMLInputElement>("#settings-ai-model")!;

    await act(async () => off.click());

    expect(modeRadios.every((radio) => !radio.disabled)).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#settings-ai-cleanup")?.disabled).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("#settings-ai-provider")?.disabled).toBe(true);
    expect(container.querySelector<HTMLElement>('[role="radiogroup"][aria-label="AI classification presets"]')?.getAttribute("aria-disabled")).toBe("true");
    expect(baseUrl.disabled).toBe(true);
    expect(apiKey.disabled).toBe(true);
    expect(model.disabled).toBe(true);
    expect(baseUrl.value).toBe("https://api.deepseek.com/custom");
    expect(apiKey.value).toBe(secret);
    expect(model.value).toBe("preserved-model");
    expect(container.textContent).toContain("Existing provider and request settings are preserved");
    expect(container.querySelector<HTMLButtonElement>("button[type='button']:not([data-settings-secret-toggle])")?.disabled).toBe(false);

    const save = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Save AI settings")!;
    expect(save.disabled).toBe(false);

    await act(async () => cloud.click());
    expect(container.querySelector<HTMLInputElement>("#settings-ai-cleanup")?.disabled).toBe(false);
    expect(baseUrl.value).toBe("https://api.deepseek.com/custom");
    expect(apiKey.value).toBe(secret);
    expect(model.value).toBe("preserved-model");
  });

  it("keeps the API key when the provider changes", async () => {
    const provider = container.querySelector<HTMLSelectElement>("#settings-ai-provider")!;
    const apiKey = container.querySelector<HTMLInputElement>("#settings-ai-api-key")!;
    expect(apiKey.value).toBe(secret);
    provider.value = "custom";
    await act(async () => provider.dispatchEvent(new Event("change", { bubbles: true })));
    expect(container.querySelector<HTMLInputElement>("#settings-ai-api-key")?.value).toBe(secret);
  });

  it("rolls back failed AI saves, does not publish runtime mode, and exposes one redacted alert", async () => {
    mocks.saveAISettings.mockRejectedValue(new Error(`backend rejected ${secret}`));
    const modeGroup = container.querySelector<HTMLElement>('[role="radiogroup"][aria-label="AI mode"]')!;
    const off = [...modeGroup.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((radio) => radio.textContent === "AI is off")!;
    await act(async () => off.click());
    const save = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Save AI settings")!;
    await act(async () => save.click());
    await flushEffects();

    expect(mocks.saveAISettings).toHaveBeenCalledTimes(1);
    expect(mocks.publishAIProcessingMode).not.toHaveBeenCalled();
    const alerts = [...container.querySelectorAll<HTMLElement>('[role="alert"]')];
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain("Failed to save AI settings");
    expect(alerts[0].textContent).toContain("[redacted]");
    expect(container.textContent).not.toContain(secret);
    expect(modeGroup.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe("Using cloud AI");
    expect(container.querySelector('[data-ai-settings-state="error"]')?.textContent).toBe("The last successfully saved AI settings remain active.");
  });
});
