import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, Keyboard, Play, Trash2 } from "lucide-react";
import packageInfo from "../../../package.json";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext, useSettingsContext } from "../../contexts/AppContexts";
import {
  removeSearchRoot,
  removeDefaultScanRoot,
  toggleSearchRoot,
  toggleDefaultScanRoot,
  upsertSearchRoot,
  upsertDefaultScanRoot
} from "../../hooks/useAppSettings";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import { useAppStore } from "../../store/useAppStore";
import { useBackgroundIndexerStore } from "../../store/useBackgroundIndexerStore";
import { useAIProcessingModeStore } from "../../store/useAIProcessingModeStore";
import { SETTINGS_SECTION_EVENT } from "../../components/spotlight/commandRegistry";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import type {
  AIConnectionTestResult,
  AIDebugClassificationResult,
  AIProviderPreset,
  AIProviderPresetId,
  AISettings,
  CloseBehavior,
  FolderNamingLanguage,
  OrganizeRootMode,
  RestoreRetentionDays,
  ScanRootSetting,
  SearchRootSetting,
  SearchScopeMode
} from "../../types/domain";
import type { Translator } from "../../types/ui";
import {
  aiSettingsEqual,
  applyAIClassificationPreset,
  resolveAIClassificationPreset,
  type AIClassificationPresetId
} from "./aiSettingsModel";
import { acceleratorFromKeyboardEvent, formatHotkeyLabel, isValidSearchHotkey } from "../../utils/hotkeys";
import { compactPath, normalizePathLike, readableError } from "../../utils/viewHelpers";
import { buttonIconDanger, buttonSecondary, cn, glassButton } from "../../utils/tw";
import {
  ConfirmDialog,
  compactInteractiveRow,
  quietText
} from "../shared/ui";
import {
  SettingsControlGroup,
  SettingsDisclosure,
  SettingsEmptyState,
  SettingsInlineMessage,
  SettingsLayout,
  SettingsRow,
  SettingsSection,
  SettingsSegmentedControl,
  SettingsSelect,
  SettingsSwitch,
  SettingsSwitchControl,
  SettingsTextField,
  settingsField
} from "./components/SettingsPrimitives";

type StatusTone = "success" | "warning";
type AIUserMode = "off" | "local" | "cloud";
type FolderDeleteConfirmState =
  | { kind: "scan"; root: ScanRootSetting }
  | { kind: "search"; root: SearchRootSetting };

const DEVELOPER_MODE_STORAGE_KEY = "zc-developer-mode";
const SETTINGS_SECTION_IDS = [
  "settings-general",
  "settings-appearance",
  "settings-files-scan",
  "settings-search",
  "settings-automation",
  "settings-ai",
  "settings-privacy",
  "settings-about"
] as const;
const AI_CLASSIFICATION_PRESET_IDS = ["fast", "standard", "detailed", "custom"] as const;
const AI_CLASSIFICATION_LABEL_KEYS: Record<typeof AI_CLASSIFICATION_PRESET_IDS[number], Parameters<Translator>[0]> = {
  fast: "aiPresetFast",
  standard: "aiPresetStandard",
  detailed: "aiPresetDetailed",
  custom: "aiPresetCustom"
};
const AI_PROVIDER_LABEL_KEYS: Record<AIProviderPresetId, Parameters<Translator>[0]> = {
  deepseek: "aiProviderDeepSeek",
  kimi: "aiProviderKimi",
  qwen_dashscope: "aiProviderQwenDashscope",
  zhipu_glm: "aiProviderZhipuGlm",
  minimax: "aiProviderMinimax",
  baichuan: "aiProviderBaichuan",
  doubao_ark: "aiProviderDoubaoArk",
  siliconflow: "aiProviderSiliconflow",
  custom_openai_compatible: "aiProviderCustomOpenai",
  ollama: "aiProviderOllama"
};

function aiProviderLabel(preset: AIProviderPreset, t: Translator) {
  return t(AI_PROVIDER_LABEL_KEYS[preset.id]);
}

function aiUserMode(settings: AISettings): AIUserMode {
  if (!settings.enabled) return "off";
  return settings.provider === "ollama" ? "local" : "cloud";
}

function userProviderValue(settings: AISettings): "deepseek" | "openai_compatible" | "ollama" | "custom" {
  if (settings.provider === "ollama") return "ollama";
  if (settings.preset === "deepseek") return "deepseek";
  if (settings.preset === "custom_openai_compatible") return "custom";
  return "openai_compatible";
}

function applyProviderPreset(settings: AISettings, preset: AIProviderPreset): AISettings {
  return {
    ...settings,
    enabled: settings.enabled,
    provider: preset.providerKind,
    preset: preset.id,
    baseUrl: preset.defaultBaseUrl,
    chatPath: preset.defaultChatPath,
    model: preset.defaultModel,
    apiKey: settings.apiKey
  };
}

function readDeveloperMode() {
  try {
    return window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function SettingsView() {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    setView,
    platform,
    closeBehavior,
    setCloseBehavior,
    t
  } = useChromeContext();
  const {
    settings: {
      folderNamingLanguage,
      defaultScanFolders,
      restoreRetentionDays,
      launchAtLogin,
      backgroundIndexOnStartup,
      searchHotkey,
      searchScopeMode,
      customSearchRoots,
      organizeRootMode,
      organizeRootPath,
      useLegacyBuiltinClassificationRules,
      useLearnedRulesAsAutoRules
    },
    updateSettings,
    setFolderNamingLanguage,
    setDefaultScanFolders,
    setRestoreRetentionDays,
    setLaunchAtLogin,
    setBackgroundIndexOnStartup,
    setSearchHotkey,
    setSearchScopeMode,
    setCustomSearchRoots,
    setOrganizeRootMode,
    setOrganizeRootPath
  } = useSettingsContext();
  const scanPath = useScanManagerStore((state) => state.scanPath);
  const pendingBackgroundRoots = useBackgroundIndexerStore((state) => state.pendingRoots);
  const currentBackgroundRoot = useBackgroundIndexerStore((state) => state.currentRoot);
  const isBackgroundIndexing = useBackgroundIndexerStore((state) => state.isBackgroundIndexing);
  const failedBackgroundRoots = useBackgroundIndexerStore((state) => state.failedRoots);
  const completedBackgroundRoots = useBackgroundIndexerStore((state) => state.completedRoots);
  const enqueueBackgroundIndexRoot = useBackgroundIndexerStore((state) => state.enqueueRoot);
  const selectedLibraryFileId = useFileLibraryStore((state) => state.selectedFileId);
  const libraryFiles = useFileLibraryStore((state) => state.libraryPage.files);
  const selectedLibraryFile = libraryFiles.find((file) => file.id === selectedLibraryFileId);
  const globalHotkeyError = useAppStore((state) => state.globalHotkeyError);
  const setGlobalHotkeyError = useAppStore((state) => state.setGlobalHotkeyError);
  const hotkey = formatHotkeyLabel(searchHotkey, platform);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsStatusTone, setSettingsStatusTone] = useState<StatusTone>("success");
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [recordingHotkeyPreview, setRecordingHotkeyPreview] = useState("");
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState<FolderDeleteConfirmState | null>(null);
  const [isDeletingFolderConfig, setIsDeletingFolderConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [persistedAISettings, setPersistedAISettings] = useState<AISettings | null>(null);
  const publishAIProcessingMode = useAIProcessingModeStore((state) => state.publish);
  const [aiPresets, setAiPresets] = useState<AIProviderPreset[]>([]);
  const [isLoadingAISettings, setIsLoadingAISettings] = useState(false);
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);
  const [aiSettingsSaveError, setAiSettingsSaveError] = useState(false);
  const [isTestingAIConnection, setIsTestingAIConnection] = useState(false);
  const [aiConnectionStatus, setAiConnectionStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [aiDebugTarget, setAiDebugTarget] = useState("");
  const [isDebuggingAI, setIsDebuggingAI] = useState(false);
  const [aiDebugStatus, setAiDebugStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [aiDebugResult, setAiDebugResult] = useState<AIDebugClassificationResult | null>(null);
  const [activeSettingsSection, setActiveSettingsSection] = useState("settings-general");
  const [developerMode, setDeveloperMode] = useState(readDeveloperMode);
  const hotkeyCaptureRef = useRef<HTMLDivElement | null>(null);
  const settingsScrollRef = useRef<HTMLDivElement | null>(null);
  const settingsScrollFrameRef = useRef<number | null>(null);
  const aiSaveRequestRef = useRef(0);

  const aiSettingsDirty = Boolean(aiSettings && persistedAISettings && !aiSettingsEqual(aiSettings, persistedAISettings));
  const activeAIClassificationPreset = aiSettings ? resolveAIClassificationPreset(aiSettings) : "custom";

  const settingsSections = [
    { id: "settings-general", label: t("settingsGeneral") },
    { id: "settings-appearance", label: t("settingsAppearance") },
    { id: "settings-files-scan", label: t("settingsFilesScan") },
    { id: "settings-search", label: t("settingsSearch") },
    { id: "settings-automation", label: t("settingsAutomation") },
    { id: "settings-ai", label: t("settingsAI") },
    { id: "settings-privacy", label: t("settingsPrivacy") },
    { id: "settings-about", label: t("settingsAbout") }
  ];

  function focusSettingsSection(sectionId: string, options: { focusContent?: boolean } = {}) {
    const targetId = sectionId === "settings-search-scope" ? "settings-search" : sectionId;
    setActiveSettingsSection(targetId);
    if (options.focusContent === false) return;
    window.requestAnimationFrame(() => {
      const container = settingsScrollRef.current;
      const section = container?.querySelector<HTMLElement>(`#${targetId}`);
      if (container && section) {
        container.scrollTop += section.getBoundingClientRect().top - container.getBoundingClientRect().top;
      }
      const heading = section?.querySelector<HTMLElement>("[data-settings-section-heading]");
      (heading ?? section)?.focus({ preventScroll: true });
    });
  }

  function setDeveloperModePreference(next: boolean) {
    setDeveloperMode(next);
    try {
      window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, String(next));
    } catch {
      // Optional local preference; advanced controls remain fail-closed when storage is unavailable.
    }
  }

  useEffect(() => {
    function handleSectionRequest(event: Event) {
      const sectionId = (event as CustomEvent<string>).detail;
      if (sectionId) focusSettingsSection(sectionId);
    }

    window.addEventListener(SETTINGS_SECTION_EVENT, handleSectionRequest);
    try {
      const pendingSection = window.sessionStorage.getItem(SETTINGS_SECTION_EVENT);
      if (pendingSection) {
        window.sessionStorage.removeItem(SETTINGS_SECTION_EVENT);
        focusSettingsSection(pendingSection);
      }
    } catch {
      // In-memory events still work when storage is unavailable.
    }
    return () => window.removeEventListener(SETTINGS_SECTION_EVENT, handleSectionRequest);
  }, []);

  useEffect(() => {
    const container = settingsScrollRef.current;
    if (!container) return undefined;

    const updateActiveSection = () => {
      settingsScrollFrameRef.current = null;
      const containerRect = container.getBoundingClientRect();
      const sections = SETTINGS_SECTION_IDS
        .map((id) => container.querySelector<HTMLElement>(`#${id}`))
        .filter((section): section is HTMLElement => Boolean(section));
      if (!sections.length) return;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
      const nextSection = atBottom
        ? sections[sections.length - 1]
        : [...sections].reverse().find((section) => section.getBoundingClientRect().top <= containerRect.top + 1) ?? sections[0];
      setActiveSettingsSection((current) => current === nextSection.id ? current : nextSection.id);
    };

    const scheduleUpdate = () => {
      if (settingsScrollFrameRef.current !== null) return;
      settingsScrollFrameRef.current = window.requestAnimationFrame(updateActiveSection);
    };

    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    scheduleUpdate();
    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      if (settingsScrollFrameRef.current !== null) window.cancelAnimationFrame(settingsScrollFrameRef.current);
      settingsScrollFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void tauriApi.getGlobalHotkeyStatus().then((status) => {
      if (!disposed) {
        setGlobalHotkeyError(status?.error ?? "");
      }
    }).catch(() => {
      // Browser previews and test shells may not expose desktop-only commands.
    });
    return () => {
      disposed = true;
    };
  }, [setGlobalHotkeyError]);

  useEffect(() => {
    if (!settingsStatus) return;
    const timer = setTimeout(() => setSettingsStatus(""), settingsStatusTone === "success" ? 2400 : 5200);
    return () => clearTimeout(timer);
  }, [settingsStatus, settingsStatusTone]);

  useEffect(() => {
    if (!isRecordingHotkey) return;
    hotkeyCaptureRef.current?.focus();

    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      recordHotkeyFromEvent(event);
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isRecordingHotkey, hotkey, platform]);

  useEffect(() => {
    let disposed = false;
    setIsLoadingAISettings(true);
    void Promise.all([tauriApi.listAIProviderPresets(), tauriApi.getAISettings()])
      .then(([presets, settings]) => {
        if (disposed) return;
        setAiPresets(presets);
        setAiSettings(settings);
        setPersistedAISettings(settings);
        setAiSettingsSaveError(false);
        publishAIProcessingMode({ enabled: settings.enabled, provider: settings.provider });
      })
      .catch((error) => {
        if (!disposed) {
          setAiConnectionStatus({ tone: "warning", message: `${t("aiSettingsLoadFailed")}：${readableError(error)}` });
        }
      })
      .finally(() => {
        if (!disposed) setIsLoadingAISettings(false);
      });
    return () => {
      disposed = true;
      aiSaveRequestRef.current += 1;
    };
  }, [publishAIProcessingMode]);

  function showStatus(message: string, tone: StatusTone = "success") {
    setSettingsStatus(message);
    setSettingsStatusTone(tone);
  }

  async function pickFolder(title: string) {
    try {
      const selectedPath = await open({ directory: true, multiple: false, title });
      const path = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
      return path?.trim() || null;
    } catch (error) {
      showStatus(`${t("folderPickerFailed")}：${readableError(error)}`, "warning");
      return null;
    }
  }

  async function updateCloseBehavior(next: CloseBehavior) {
    const saved = await setCloseBehavior(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function updateFolderNamingLanguage(next: FolderNamingLanguage) {
    const saved = await setFolderNamingLanguage(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function updateLaunchAtLogin(next: boolean) {
    const saved = await setLaunchAtLogin(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function updateBackgroundIndexOnStartup(next: boolean) {
    const saved = await setBackgroundIndexOnStartup(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function addDefaultScanFolder() {
    const path = await pickFolder(t("folderPickerTitle"));
    if (!path) return;

    const saved = await setDefaultScanFolders(upsertDefaultScanRoot(defaultScanFolders, path));
    if (saved) {
      showStatus(`${t("settingsSavedInline")} · ${t("defaultScanFoldersRestartHint")}`);
    }
  }

  async function setScanRootEnabled(root: ScanRootSetting, enabled: boolean) {
    const saved = await setDefaultScanFolders(toggleDefaultScanRoot(defaultScanFolders, root.id, enabled));
    if (saved) {
      showStatus(`${t("settingsSavedInline")} · ${t("defaultScanFoldersRestartHint")}`);
    }
  }

  async function deleteScanRoot(root: ScanRootSetting) {
    const saved = await setDefaultScanFolders(removeDefaultScanRoot(defaultScanFolders, root.id));
    if (saved) {
      showStatus(`${t("settingsSavedInline")} · ${t("defaultScanFoldersRestartHint")}`);
    }
    return saved;
  }

  async function updateSearchScopeMode(next: SearchScopeMode) {
    const saved = await setSearchScopeMode(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function updateOrganizeRootMode(next: OrganizeRootMode) {
    const saved = await setOrganizeRootMode(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function chooseOrganizeRootPath() {
    const path = await pickFolder(t("organizeRootPickerTitle"));
    if (!path) return;

    const saved = await setOrganizeRootPath(path);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function updateOrganizeRootPath(next: string) {
    const saved = await setOrganizeRootPath(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function addCustomSearchRoot() {
    const path = await pickFolder(t("folderPickerTitle"));
    if (!path) return;

    const saved = await setCustomSearchRoots(upsertSearchRoot(customSearchRoots, path));
    if (saved) {
      enqueueBackgroundIndexRoot(path);
      showStatus(`${t("settingsSavedInline")} · ${t("backgroundIndexQueued")}`);
    }
  }

  async function setSearchRootEnabled(root: SearchRootSetting, enabled: boolean) {
    const saved = await setCustomSearchRoots(toggleSearchRoot(customSearchRoots, root.id, enabled));
    if (saved) {
      if (enabled) enqueueBackgroundIndexRoot(root.path, { force: true });
      showStatus(enabled ? `${t("settingsSavedInline")} · ${t("backgroundIndexQueued")}` : t("settingsSavedInline"));
    }
  }

  async function deleteSearchRoot(root: SearchRootSetting) {
    const saved = await setCustomSearchRoots(removeSearchRoot(customSearchRoots, root.id));
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
    return saved;
  }

  async function confirmFolderDelete() {
    if (!folderDeleteConfirm || isDeletingFolderConfig) return;
    setIsDeletingFolderConfig(true);
    try {
      const saved = folderDeleteConfirm.kind === "scan"
        ? await deleteScanRoot(folderDeleteConfirm.root)
        : await deleteSearchRoot(folderDeleteConfirm.root);
      if (saved) setFolderDeleteConfirm(null);
    } finally {
      setIsDeletingFolderConfig(false);
    }
  }

  async function scanRootNow(root: ScanRootSetting) {
    await scanPath(root.path);
  }

  function indexSearchRootNow(root: SearchRootSetting) {
    enqueueBackgroundIndexRoot(root.path, { force: true });
    showStatus(t("backgroundIndexQueued"));
  }

  function backgroundRootState(root: SearchRootSetting) {
    const normalized = normalizeSettingsRoot(root.path);
    if (currentBackgroundRoot && normalizeSettingsRoot(currentBackgroundRoot) === normalized) return "indexing";
    if (pendingBackgroundRoots.some((path) => normalizeSettingsRoot(path) === normalized)) return "queued";
    if (completedBackgroundRoots.some((path) => normalizeSettingsRoot(path) === normalized)) return "completed";
    return "idle";
  }

  async function updateRestoreRetentionDays(next: RestoreRetentionDays) {
    const saved = await setRestoreRetentionDays(next);
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function updateSearchHotkey(next: string) {
    if (!isValidSearchHotkey(next)) {
      showStatus(t("hotkeyInvalid"), "warning");
      return;
    }

    const saved = await setSearchHotkey(next);
    if (saved) {
      showStatus(t("hotkeySaved"));
      setIsRecordingHotkey(false);
      setRecordingHotkeyPreview("");
    }
  }

  function recordHotkeyFromEvent(event: globalThis.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setIsRecordingHotkey(false);
      setRecordingHotkeyPreview("");
      return;
    }

    const accelerator = acceleratorFromKeyboardEvent(event, platform);
    setRecordingHotkeyPreview(accelerator ? formatHotkeyLabel(accelerator, platform) : event.key);
    if (!accelerator) {
      showStatus(t("hotkeyInvalid"), "warning");
      return;
    }
    void updateSearchHotkey(accelerator);
  }

  function updateAISettings(partial: Partial<AISettings>) {
    if (isSavingAISettings) return;
    setAiSettingsSaveError(false);
    setAiConnectionStatus(null);
    setAiDebugStatus(null);
    setAiSettings((current) => current ? { ...current, ...partial } : current);
  }

  function applyClassificationPreset(mode: Exclude<AIClassificationPresetId, "custom">) {
    setAiSettingsSaveError(false);
    setAiConnectionStatus(null);
    setAiDebugStatus(null);
    setAiSettings((current) => current ? applyAIClassificationPreset(current, mode) : current);
  }

  function updateAIUserMode(mode: AIUserMode) {
    setAiSettingsSaveError(false);
    setAiConnectionStatus(null);
    setAiSettings((current) => {
      if (!current) return current;
      if (mode === "off") return { ...current, enabled: false };

      const targetPreset = mode === "local"
        ? aiPresets.find((preset) => preset.providerKind === "ollama")
        : aiPresets.find((preset) => preset.providerKind !== "ollama" && preset.id === current.preset)
          ?? aiPresets.find((preset) => preset.providerKind !== "ollama" && preset.id === "deepseek")
          ?? aiPresets.find((preset) => preset.providerKind !== "ollama");
      return targetPreset ? applyProviderPreset({ ...current, enabled: true }, targetPreset) : { ...current, enabled: true };
    });
  }

  function selectAIPreset(presetId: AIProviderPresetId) {
    const preset = aiPresets.find((item) => item.id === presetId);
    setAiSettingsSaveError(false);
    setAiConnectionStatus(null);
    setAiDebugStatus(null);
    setAiSettings((current) => {
      if (!preset) return current ? { ...current, preset: presetId } : current;
      const fallback = current ?? defaultAISettingsFromPreset(preset);
      if (!fallback) return fallback;
      return applyProviderPreset(fallback, preset);
    });
  }

  function selectUserProvider(value: "deepseek" | "openai_compatible" | "ollama" | "custom") {
    if (value === "deepseek" || value === "ollama" || value === "custom") {
      selectAIPreset(value === "custom" ? "custom_openai_compatible" : value);
      return;
    }
    const currentCloudPreset = aiSettings && aiSettings.provider !== "ollama" && aiSettings.preset !== "deepseek" && aiSettings.preset !== "custom_openai_compatible"
      ? aiSettings.preset
      : "custom_openai_compatible";
    selectAIPreset(currentCloudPreset as AIProviderPresetId);
  }

  async function saveAISettings() {
    if (!aiSettings || isSavingAISettings) return;
    const next = normalizeAISettingsForSave(aiSettings);
    const requestId = ++aiSaveRequestRef.current;
    const previous = persistedAISettings;
    setIsSavingAISettings(true);
    setAiSettingsSaveError(false);
    setAiConnectionStatus(null);
    try {
      const saved = await tauriApi.saveAISettings(next);
      if (requestId !== aiSaveRequestRef.current) return;
      setAiSettings(saved);
      setPersistedAISettings(saved);
      setAiSettingsSaveError(false);
      publishAIProcessingMode({ enabled: saved.enabled, provider: saved.provider });
      showStatus(t("aiSettingsSaved"));
    } catch (error) {
      if (requestId !== aiSaveRequestRef.current) return;
      if (previous) setAiSettings(previous);
      setAiSettingsSaveError(true);
      setAiConnectionStatus({
        tone: "warning",
        message: sanitizeAIStatusMessage(`${t("aiSettingsSaveFailed")}：${readableError(error)}`, previous?.apiKey ?? aiSettings.apiKey)
      });
    } finally {
      if (requestId === aiSaveRequestRef.current) setIsSavingAISettings(false);
    }
  }

  async function testAIConnection() {
    if (!aiSettings || isTestingAIConnection) return;
    const next = normalizeAISettingsForSave(aiSettings);
    setIsTestingAIConnection(true);
    setAiConnectionStatus(null);
    try {
      const result = await tauriApi.testAIProviderConnection(next);
      setAiConnectionStatus({
        tone: "success",
        message: aiConnectionSuccessMessage(result, t("aiConnectionSucceeded"))
      });
    } catch (error) {
      setAiConnectionStatus({
        tone: "warning",
        message: sanitizeAIStatusMessage(`${t("aiConnectionTestFailed")}：${readableError(error)}`, aiSettings.apiKey)
      });
    } finally {
      setIsTestingAIConnection(false);
    }
  }

  async function debugAIClassificationOnce() {
    if (!aiSettings || isDebuggingAI) return;
    const target = aiDebugTarget.trim();
    if (!target) {
      setAiDebugStatus({ tone: "warning", message: t("aiDebugMissingTarget") });
      return;
    }

    setIsDebuggingAI(true);
    setAiDebugStatus(null);
    setAiDebugResult(null);
    try {
      const result = await tauriApi.debugAIClassificationOnce(target);
      setAiDebugResult(result);
      setAiDebugStatus({
        tone: result.success ? "success" : "warning",
        message: result.success
          ? t("aiDebugSucceeded")
          : `${t("aiDebugFinished")}：${result.parseError ?? t("aiDebugParseFailed")}`
      });
    } catch (error) {
      setAiDebugStatus({
        tone: "warning",
        message: sanitizeAIStatusMessage(`${t("aiDebugFinished")}：${readableError(error)}`, aiSettings.apiKey)
      });
    } finally {
      setIsDebuggingAI(false);
    }
  }

  return (
    <>
    <SettingsLayout
      sections={settingsSections}
      activeSectionId={activeSettingsSection}
      sectionLabel={t("settingsSectionsLabel")}
      onSectionChange={(sectionId, options) => focusSettingsSection(sectionId, options)}
      scrollRef={settingsScrollRef}
    >
        <div className="grid gap-2">
          <p className="max-w-2xl text-sm leading-6 text-[var(--zc-text-secondary)]">{t("settingsDesc")}</p>
          {settingsStatus ? <SettingsInlineMessage tone={settingsStatusTone === "warning" ? "warning" : "success"}>{settingsStatus}</SettingsInlineMessage> : null}
        </div>

        <SettingsSection id="settings-general" title={t("settingsGeneral")} description={t("settingsGeneralDesc")}>
          <SettingsControlGroup title={t("settingsWindowBehavior")} description={t("settingsWindowBehaviorDesc")}>
            <SettingsRow label={t("closeBehavior")} description={t("closeBehaviorDesc")}>
              <SettingsSegmentedControl
                value={closeBehavior}
                ariaLabel={t("closeBehavior")}
                options={[
                  { value: "ask", label: t("askEveryTime") },
                  { value: "minimize", label: t("minimizeToTray") },
                  { value: "quit", label: t("quitApp") }
                ]}
                onChange={(next) => void updateCloseBehavior(next)}
              />
            </SettingsRow>
          </SettingsControlGroup>

          <SettingsControlGroup title={t("settingsStartup")} description={t("settingsStartupDesc")}>
            <SettingsSwitch
              id="settings-background-index-startup"
              label={t("backgroundIndexOnStartup")}
              description={t("backgroundIndexOnStartupDesc")}
              checked={backgroundIndexOnStartup}
              onChange={(next) => void updateBackgroundIndexOnStartup(next)}
            />
            <SettingsSwitch
              id="settings-launch-at-login"
              label={t("launchAtLogin")}
              description={t("launchAtLoginDesc")}
              checked={launchAtLogin}
              onChange={(next) => void updateLaunchAtLogin(next)}
            />
          </SettingsControlGroup>
        </SettingsSection>

        <SettingsSection id="settings-appearance" title={t("settingsAppearance")} description={t("settingsAppearanceDesc")}>
          <SettingsRow label={t("language")} description={t("languageDesc")}>
            <SettingsSegmentedControl
              value={language}
              ariaLabel={t("language")}
              options={[
                { value: "zh", label: t("languageChinese") },
                { value: "en", label: t("languageEnglish") }
              ]}
              onChange={setLanguage}
            />
          </SettingsRow>
          <SettingsRow label={t("appearance")} description={t("appearanceDesc")}>
            <SettingsSegmentedControl
              value={theme}
              ariaLabel={t("appearance")}
              options={[
                { value: "light", label: t("lightTheme") },
                { value: "dark", label: t("darkTheme") },
                { value: "system", label: t("systemTheme") }
              ]}
              onChange={setTheme}
            />
          </SettingsRow>
          <SettingsRow label={t("folderNaming")} description={t("folderNamingDesc")}>
            <SettingsSegmentedControl
              value={folderNamingLanguage}
              ariaLabel={t("folderNaming")}
              options={[
                { value: "en", label: t("englishFolderNames") },
                { value: "zh", label: t("chineseFolderNames") }
              ]}
              onChange={(next) => void updateFolderNamingLanguage(next)}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection id="settings-files-scan" title={t("settingsFilesScan")} description={t("settingsFilesScanDesc")}>
        <SettingsControlGroup title={t("settingsScanRoots")} description={t("settingsScanRootsDesc")}>
          {defaultScanFolders.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={quietText}>{t("defaultScanFoldersRestartHint")}</span>
              <button className={buttonSecondary} onClick={() => void addDefaultScanFolder()}>
                <FolderPlus size={15} />
                <span>{t("addScanFolder")}</span>
              </button>
            </div>
          ) : null}
          <div className="grid gap-2">
            {defaultScanFolders.length ? defaultScanFolders.map((root) => (
              <div key={root.id} className={cn(compactInteractiveRow(), "px-3 py-2")}>
                <div className="grid min-w-0 gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-center">
                  <div className="min-w-0 text-left">
                    <label htmlFor={`scan-root-${root.id}`} className="block truncate text-sm font-medium text-[var(--zc-text-primary)]">{root.label}</label>
                    <span className="block truncate text-xs leading-5 text-[var(--zc-text-tertiary)]" title={root.path}>{compactPath(root.path, 72)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 min-[720px]:justify-end">
                    <SettingsSwitchControl
                      id={`scan-root-${root.id}`}
                      checked={root.enabled}
                      label={root.enabled ? t("disableScanFolder") : t("enableScanFolder")}
                      onChange={(next) => void setScanRootEnabled(root, next)}
                    />
                    <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => void scanRootNow(root)} title={t("scanNow")}>
                      <Play size={14} />
                      <span>{t("scanNow")}</span>
                    </button>
                    <button className={buttonIconDanger} onClick={() => setFolderDeleteConfirm({ kind: "scan", root })} title={t("deleteScanFolder")} aria-label={t("deleteScanFolder")}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <SettingsEmptyState title={t("defaultScanFolders")} description={t("noDefaultScanFolders")} action={(
                <button className={buttonSecondary} onClick={() => void addDefaultScanFolder()}>
                  <FolderPlus size={15} />
                  <span>{t("addScanFolder")}</span>
                </button>
              )} />
            )}
          </div>
        </SettingsControlGroup>

        <SettingsControlGroup title={t("settingsOrganizeRoot")} description={t("settingsOrganizeRootDesc")}>
          <SettingsRow
            label={t("settingsOrganizeRoot")}
            description={organizeRootMode === "current_folder"
              ? t("organizeRootCurrentDesc")
              : organizeRootMode === "zen_canvas_folder"
                ? t("organizeRootZenCanvasDesc")
                : t("organizeRootCustomDesc")}
            hint={t("organizePreviewStillRequired")}
          >
            <SettingsSegmentedControl
              value={organizeRootMode}
              ariaLabel={t("settingsOrganizeRoot")}
              options={[
                { value: "current_folder", label: t("organizeRootCurrentFolder") },
                { value: "zen_canvas_folder", label: t("organizeRootZenCanvasFolder") },
                { value: "custom_root", label: t("organizeRootCustomRoot") }
              ]}
              onChange={(next) => void updateOrganizeRootMode(next)}
            />
          </SettingsRow>
          {organizeRootMode === "custom_root" ? (
            <SettingsRow label={t("organizeRootCustomRoot")} description={t("organizeRootCustomDesc")}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <input
                  className={cn(settingsField, "min-w-0 flex-1")}
                  value={organizeRootPath ?? ""}
                  onChange={(event) => void updateOrganizeRootPath(event.target.value)}
                  placeholder={t("organizeRootPathPlaceholder")}
                  aria-label={t("organizeRootCustomRoot")}
                />
                <button className={buttonSecondary} onClick={() => void chooseOrganizeRootPath()}>
                  <FolderPlus size={15} />
                  <span>{t("chooseFolders")}</span>
                </button>
              </div>
            </SettingsRow>
          ) : null}
        </SettingsControlGroup>
        </SettingsSection>

        <SettingsSection id="settings-search" title={t("settingsSearch")} description={t("settingsSearchDesc")}>
          <SettingsRow label={t("searchHotkey")} description={t("searchHotkeyDesc")}>
            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
              <kbd className="rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-3 py-2 text-sm font-medium text-[var(--zc-text-primary)]">{hotkey}</kbd>
              <button className={cn(buttonSecondary, isRecordingHotkey && "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)] text-[var(--zc-primary-text)]")} onClick={() => setIsRecordingHotkey(true)}>
                <Keyboard size={14} />
                <span>{t("changeHotkey")}</span>
              </button>
            </div>
          </SettingsRow>
          {isRecordingHotkey && (
            <SettingsInlineMessage>
              <div
                ref={hotkeyCaptureRef}
                className="mt-2 grid gap-2 rounded-xl border border-[var(--zc-info-border)] bg-[var(--zc-info-soft)] px-3 py-3 outline-none focus-visible:shadow-[0_0_0_3px_var(--zc-focus-ring-soft)]"
                tabIndex={0}
              >
                <span>{t("recordingHotkey")}</span>
                <span className={quietText}>{t("hotkeyCaptureCurrent")}: {recordingHotkeyPreview || hotkey}</span>
                <span className={quietText}>Esc: {t("cancel")}</span>
              </div>
            </SettingsInlineMessage>
          )}
          {globalHotkeyError ? (
            <SettingsInlineMessage tone="warning">{t("hotkeyConflictHint")}</SettingsInlineMessage>
          ) : (
            <span className={quietText}>{t("hotkeyActiveHint")}</span>
          )}
          <div className="flex flex-wrap gap-2">
            {["CmdOrCtrl+K", "CmdOrCtrl+Shift+K", "Alt+Space", "CmdOrCtrl+Alt+Space"].map((accelerator) => (
              <button
                className={cn(glassButton, searchHotkey === accelerator && "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)] text-[var(--zc-primary-text)]")}
                key={accelerator}
                aria-pressed={searchHotkey === accelerator}
                onClick={() => void updateSearchHotkey(accelerator)}
              >
                {formatHotkeyLabel(accelerator, platform)}
              </button>
            ))}
          </div>
          <SettingsRow label={t("searchScopeSettings")} description={t("searchScopeSettingsDesc")}>
            <SettingsSegmentedControl
              value={searchScopeMode}
              ariaLabel={t("searchScopeSettings")}
              options={[
                { value: "all", label: t("searchScopeAllIndexed") },
                { value: "current_scan", label: t("searchScopeCurrentScan") },
                { value: "custom_roots", label: t("searchScopeCustomRoots") }
              ]}
              onChange={(next) => void updateSearchScopeMode(next)}
            />
          </SettingsRow>
          <span className={quietText}>{t("searchLocalIndexBoundary")}</span>
          {searchScopeMode === "custom_roots" && (
            <div className="grid gap-2">
              {customSearchRoots.length ? (
                <div className="flex justify-end">
                  <button className={buttonSecondary} onClick={() => void addCustomSearchRoot()}>
                    <FolderPlus size={15} />
                    <span>{t("addSearchFolder")}</span>
                  </button>
                </div>
              ) : null}
              {customSearchRoots.length ? customSearchRoots.map((root) => (
                <div key={root.id} className={cn(compactInteractiveRow(), "px-3 py-2")}>
                  <div className="grid min-w-0 gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-center">
                    <div className="min-w-0 text-left">
                      <label htmlFor={`search-root-${root.id}`} className="block truncate text-sm font-medium text-[var(--zc-text-primary)]">{root.label}</label>
                      <span className="block truncate text-xs leading-5 text-[var(--zc-text-tertiary)]" title={root.path}>{compactPath(root.path, 72)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 min-[720px]:justify-end">
                      <SettingsSwitchControl
                        id={`search-root-${root.id}`}
                        checked={root.enabled}
                        label={root.enabled ? t("disableSearchFolder") : t("enableSearchFolder")}
                        onChange={(next) => void setSearchRootEnabled(root, next)}
                      />
                      <button
                        className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
                        onClick={() => indexSearchRootNow(root)}
                        disabled={backgroundRootState(root) === "indexing" || backgroundRootState(root) === "queued"}
                      >
                        <Play size={14} />
                        <span>
                          {backgroundRootState(root) === "indexing"
                            ? t("backgroundIndexingShort")
                            : backgroundRootState(root) === "queued"
                              ? t("backgroundIndexQueuedShort")
                              : t("indexNow")}
                        </span>
                      </button>
                      <button className={buttonIconDanger} onClick={() => setFolderDeleteConfirm({ kind: "search", root })} title={t("deleteSearchFolder")} aria-label={t("deleteSearchFolder")}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <SettingsEmptyState title={t("searchScopeCustomRoots")} description={t("searchScopeCustomEmpty")} action={(
                  <button className={buttonSecondary} onClick={() => void addCustomSearchRoot()}>
                    <FolderPlus size={15} />
                    <span>{t("addSearchFolder")}</span>
                  </button>
                )} />
              )}
            </div>
          )}
          {(isBackgroundIndexing || pendingBackgroundRoots.length > 0 || completedBackgroundRoots.length > 0 || failedBackgroundRoots.length > 0) ? (
            <SettingsInlineMessage tone={failedBackgroundRoots.length ? "warning" : isBackgroundIndexing ? "info" : "success"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{t("backgroundIndexingTitle")}</strong>
                <span className="text-xs">{isBackgroundIndexing ? t("backgroundIndexingRunning") : t("backgroundIndexingIdle")}</span>
              </div>
              {currentBackgroundRoot ? (
                <span className={quietText}>{t("backgroundIndexingCurrent")}: {compactPath(currentBackgroundRoot, 76)}</span>
              ) : null}
              {pendingBackgroundRoots.length > 0 ? (
                <span className={quietText}>{t("backgroundIndexingQueue")}: {pendingBackgroundRoots.length.toLocaleString()}</span>
              ) : null}
              {completedBackgroundRoots[0] ? (
                <span className={quietText}>{t("backgroundIndexingCompleted")}: {compactPath(completedBackgroundRoots[0], 76)}</span>
              ) : null}
              {failedBackgroundRoots[0] ? (
                <span className={quietText}>{t("backgroundIndexingFailed")}: {compactPath(failedBackgroundRoots[0].path, 76)}</span>
              ) : null}
            </SettingsInlineMessage>
          ) : null}
          <span className={quietText}>{t("searchScopeDoesNotChangeLibrary")}</span>
        </SettingsSection>

        <SettingsSection id="settings-automation" title={t("settingsAutomation")} description={t("settingsAutomationDesc")}>
          <SettingsInlineMessage>{t("automationSafetyBoundary")}</SettingsInlineMessage>
          <SettingsRow label={t("automationManualRuleSet")} description={t("automationSettingsDescription")}>
            <button className={buttonSecondary} onClick={() => setView("rules")}>{t("automationRules")}</button>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection id="settings-ai" title={t("settingsAI")} description={t("settingsAIDesc")}>
          {isLoadingAISettings || !aiSettings ? (
            <SettingsEmptyState title={t("aiSettingsLoading")} description={t("aiSettingsLoadingDesc")} />
          ) : (
            <fieldset disabled={isSavingAISettings} aria-busy={isSavingAISettings} className="grid min-w-0 gap-0">
              <SettingsRow label={t("aiModeLabel")} description={t(aiUserMode(aiSettings) === "off" ? "modeAIDisabledDesc" : aiUserMode(aiSettings) === "local" ? "modeAILocalDesc" : "modeAICloudDesc")}>
                <SettingsSegmentedControl
                  value={aiUserMode(aiSettings)}
                  ariaLabel={t("aiModeLabel")}
                  options={[
                    { value: "off", label: t("modeAIDisabled") },
                    { value: "local", label: t("modeAILocal") },
                    { value: "cloud", label: t("modeAICloud") }
                  ]}
                  onChange={updateAIUserMode}
                />
              </SettingsRow>
              <SettingsSwitch
                id="settings-ai-cleanup"
                label={t("aiCleanupEnabledLabel")}
                description={t("aiCleanupEnabledDesc")}
                checked={aiSettings.cleanupAiEnabled}
                onChange={(next) => updateAISettings({ cleanupAiEnabled: next })}
              />
              <SettingsSelect
                id="settings-ai-provider"
                label={t("aiProviderPreset")}
                description={t("aiProviderPresetDesc")}
                value={userProviderValue(aiSettings)}
                options={[
                  { value: "deepseek", label: t("aiProviderDeepSeek") },
                  { value: "openai_compatible", label: t("aiProviderOpenaiCompatible") },
                  { value: "ollama", label: t("aiProviderOllama") },
                  { value: "custom", label: t("aiProviderCustom") }
                ]}
                onChange={selectUserProvider}
              />
              <SettingsRow label={t("aiClassificationPresets")} description={t("aiClassificationPresetsDesc")}>
                <SettingsSegmentedControl
                  value={activeAIClassificationPreset}
                  ariaLabel={t("aiClassificationPresets")}
                  options={AI_CLASSIFICATION_PRESET_IDS.map((presetId) => ({ value: presetId, label: t(AI_CLASSIFICATION_LABEL_KEYS[presetId]) }))}
                  onChange={(presetId) => { if (presetId !== "custom") applyClassificationPreset(presetId); }}
                />
              </SettingsRow>
              <SettingsInlineMessage tone={aiSettings.enabled && aiSettings.provider !== "ollama" && !aiSettings.apiKeyConfigured ? "warning" : "info"}>
                {aiSettings.enabled && aiSettings.provider !== "ollama" && !aiSettings.apiKeyConfigured ? t("aiConfigurationIncomplete") : t(aiUserMode(aiSettings) === "off" ? "modeAIDisabledDesc" : aiUserMode(aiSettings) === "local" ? "modeAILocalDesc" : "modeAICloudDesc")}
              </SettingsInlineMessage>
              {aiConnectionStatus ? <SettingsInlineMessage tone={aiConnectionStatus.tone}>{aiConnectionStatus.message}</SettingsInlineMessage> : null}
              {developerMode ? (
                <SettingsDisclosure title={t("advancedSettings")} description={t("developerModeDesc")}>
                  <SettingsControlGroup title={t("aiAdvancedConnection")} description={t("aiAdvancedConnectionDesc")}>
                    <SettingsSelect
                      id="settings-ai-advanced-provider"
                      label={t("aiProviderPreset")}
                      value={aiSettings.preset}
                      options={aiPresets.map((preset) => ({ value: preset.id, label: aiProviderLabel(preset, t) }))}
                      onChange={selectAIPreset}
                    />
                    <div className="grid min-w-0 gap-4 min-[720px]:grid-cols-2">
                      <SettingsTextField id="settings-ai-base-url" label={t("aiBaseUrlLabel")} value={aiSettings.baseUrl} onChange={(value) => updateAISettings({ baseUrl: value })} />
                      <SettingsTextField id="settings-ai-chat-path" label={t("aiChatPathLabel")} value={aiSettings.chatPath} onChange={(value) => updateAISettings({ chatPath: value })} />
                      {aiSettings.provider === "ollama" ? (
                        <SettingsInlineMessage>{t("aiLocalApiKeyHint")}</SettingsInlineMessage>
                      ) : (
                        <SettingsTextField
                          id="settings-ai-api-key"
                          label={t("aiApiKeyLabel")}
                          type="password"
                          value={aiSettings.apiKey}
                          onChange={(value) => updateAISettings({ apiKey: value })}
                          placeholder={aiSettings.apiKeyConfigured ? t("aiStoredApiKeyPlaceholder") : t("aiEmptyApiKeyPlaceholder")}
                        />
                      )}
                      <SettingsTextField id="settings-ai-model" label={t("aiModelLabel")} value={aiSettings.model} onChange={(value) => updateAISettings({ model: value })} />
                    </div>
                  </SettingsControlGroup>
                  <SettingsControlGroup title={t("aiAdvancedPerformance")} description={t("aiAdvancedPerformanceDesc")}>
                    <div className="grid min-w-0 gap-4 min-[720px]:grid-cols-2">
                      <SettingsTextField id="settings-ai-batch-size" label={t("aiBatchSizeLabel")} description={t("aiBatchSizeDesc")} type="number" value={String(aiSettings.batchSize)} onChange={(value) => updateAISettings({ batchSize: Math.max(1, Number(value) || 1) })} />
                      <SettingsTextField id="settings-ai-concurrency" label={t("aiConcurrencyLabel")} description={t("aiConcurrencyDesc")} type="number" value={String(aiSettings.classificationConcurrency)} onChange={(value) => updateAISettings({ classificationConcurrency: Math.min(4, Math.max(1, Number(value) || 1)) })} />
                      <SettingsTextField id="settings-ai-max-tokens" label={t("aiMaxTokensLabel")} type="number" value={String(aiSettings.maxTokens)} onChange={(value) => updateAISettings({ maxTokens: Math.max(512, Number(value) || 512) })} />
                      <SettingsTextField id="settings-ai-timeout" label={t("aiTimeoutLabel")} type="number" value={String(aiSettings.timeoutSeconds)} onChange={(value) => updateAISettings({ timeoutSeconds: Math.max(1, Number(value) || 1) })} />
                    </div>
                  </SettingsControlGroup>
                  <SettingsControlGroup title={t("aiAdvancedPrivacy")} description={t("aiAdvancedPrivacyDesc")}>
                    <SettingsSwitch id="settings-ai-learned-rules" label={t("aiLearnedRulesLabel")} description={t("aiLearnedRulesDesc")} checked={useLearnedRulesAsAutoRules} onChange={(next) => void updateSettings({ useLearnedRulesAsAutoRules: next })} />
                    <SettingsSwitch id="settings-ai-legacy-rules" label={t("aiLegacyRulesLabel")} description={t("aiLegacyRulesDesc")} checked={useLegacyBuiltinClassificationRules} onChange={(next) => void updateSettings({ useLegacyBuiltinClassificationRules: next })} />
                    <SettingsSwitch id="settings-ai-force-json" label={t("aiForceJsonLabel")} description={t("aiForceJsonDesc")} checked={aiSettings.forceJsonOutput} onChange={(next) => updateAISettings({ forceJsonOutput: next })} />
                    <SettingsSwitch id="settings-ai-thinking" label={t("aiThinkingLabel")} description={t("aiThinkingDesc")} checked={aiSettings.enableThinking} onChange={(next) => updateAISettings({ enableThinking: next })} />
                    <SettingsSwitch id="settings-ai-send-full-path" label={t("aiSendFullPathLabel")} description={t("aiSendFullPathDesc")} checked={aiSettings.sendFullPath} onChange={(next) => updateAISettings({ sendFullPath: next })} />
                    <SettingsSwitch id="settings-ai-send-parent-path" label={t("aiSendParentPathLabel")} description={t("aiSendParentPathDesc")} checked={aiSettings.sendParentPath} onChange={(next) => updateAISettings({ sendParentPath: next })} />
                    <SettingsTextField id="settings-ai-reasoning-effort" label={t("aiReasoningEffortLabel")} value={aiSettings.reasoningEffort ?? ""} onChange={(value) => updateAISettings({ reasoningEffort: value || null })} placeholder={t("aiReasoningPlaceholder")} />
                    <label className="grid min-w-0 gap-1.5">
                      <span className="text-sm font-medium text-[var(--zc-text-primary)]">{t("aiExtraBodyLabel")}</span>
                      <textarea className={cn(settingsField, "min-h-24 resize-y py-2 font-mono")} value={aiSettings.extraBodyJson ?? ""} onChange={(event) => updateAISettings({ extraBodyJson: event.target.value || null })} placeholder={t("aiExtraBodyPlaceholder")} />
                      <span className={quietText}>{t("aiSecretsHint")}</span>
                    </label>
                  </SettingsControlGroup>
                  {aiSettings.preset === "deepseek" && ["deepseek-chat", "deepseek-reasoner"].includes(aiSettings.model.trim()) ? <SettingsInlineMessage tone="warning">{t("aiOldModelWarning")}</SettingsInlineMessage> : null}
                  {(aiSettings.provider === "ollama" || aiSettings.model.toLowerCase().includes("qwen3")) ? <SettingsInlineMessage tone="warning">{t("aiQwenWarning")}</SettingsInlineMessage> : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className={buttonSecondary} onClick={() => void testAIConnection()} disabled={isTestingAIConnection || isSavingAISettings}>
                      {isTestingAIConnection ? t("aiTestingConnection") : t("aiTestConnection")}
                    </button>
                  </div>
                  <SettingsDisclosure title={t("aiDebugTitle")} description={t("aiDebugWarning")}>
                    {selectedLibraryFile ? (
                      <div className="grid gap-1 border-b border-[var(--zc-divider)] pb-3 text-xs text-[var(--zc-text-secondary)]">
                        <span className="font-medium text-[var(--zc-text-primary)]">{t("aiSelectedFile")}</span>
                        <span>{selectedLibraryFile.name}</span>
                        <span title={selectedLibraryFile.path}>{compactPath(selectedLibraryFile.path, 96)}</span>
                      </div>
                    ) : <span className={quietText}>{t("aiNoSelectedFile")}</span>}
                    <div className="grid min-w-0 gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto_auto] min-[720px]:items-end">
                      <SettingsTextField id="settings-ai-debug-target" label={t("aiDebugTargetLabel")} value={aiDebugTarget} onChange={setAiDebugTarget} placeholder={t("aiDebugTargetPlaceholder")} />
                      <button className={buttonSecondary} onClick={() => setAiDebugTarget(selectedLibraryFile?.id ?? "")} disabled={!selectedLibraryFile || isDebuggingAI}>{t("aiUseSelectedFile")}</button>
                      <button className={buttonSecondary} onClick={() => void debugAIClassificationOnce()} disabled={isDebuggingAI || !aiDebugTarget.trim()}>{isDebuggingAI ? t("aiDebugging") : t("aiDebugSingleFile")}</button>
                    </div>
                    {aiDebugStatus ? <SettingsInlineMessage tone={aiDebugStatus.tone}>{sanitizeAIStatusMessage(aiDebugStatus.message, aiSettings.apiKey)}</SettingsInlineMessage> : null}
                    {aiDebugResult ? (
                      <div className="grid gap-3 text-xs text-[var(--zc-text-secondary)]">
                        <div className="grid gap-1 border-b border-[var(--zc-divider)] pb-3">
                          <span>Provider: {aiDebugResult.provider} / {aiDebugResult.preset}</span>
                          <span>Model: {aiDebugResult.model}</span>
                          <span>Endpoint: {aiDebugResult.baseUrl}{aiDebugResult.chatPath}</span>
                          <span>HTTP: {aiDebugResult.httpStatus} · response_format: {String(aiDebugResult.requestUsedResponseFormat)} · thinking: {aiDebugResult.requestUsedThinkingField ?? "—"}</span>
                          <span>Max tokens: {aiDebugResult.maxTokens} · Batch size: {aiDebugResult.batchSize} · Parse stage: {aiDebugResult.parseStage}</span>
                          <span>refId: {aiDebugResult.refId || "—"} · real file id: {aiDebugResult.realFileId || "—"}</span>
                          <span>Path: {compactPath(aiDebugResult.path, 96)}</span>
                          <span>Model returned refId/id: {aiDebugResult.modelReturnedRefId ?? "—"} / {aiDebugResult.modelReturnedId ?? "—"} · idMappingMatched: {String(aiDebugResult.idMappingMatched)}</span>
                          <span>Missing optional fields: {aiDebugResult.missingOptionalFields.length ? aiDebugResult.missingOptionalFields.join(", ") : "—"} · fallbackApplied: {String(aiDebugResult.fallbackApplied)}</span>
                          <span>Item parse warnings: {aiDebugResult.itemParseWarnings.length ? aiDebugResult.itemParseWarnings.join("; ") : "—"}</span>
                        </div>
                        <DebugPreviewBlock label="response summary" value={aiDebugResult.providerResponseSummary} apiKey={aiSettings.apiKey} />
                        <DebugPreviewBlock label="raw response preview" value={aiDebugResult.rawResponsePreview} apiKey={aiSettings.apiKey} />
                        <DebugPreviewBlock label="message content preview" value={aiDebugResult.messageContentPreview} apiKey={aiSettings.apiKey} />
                        <DebugPreviewBlock label="reasoning content preview" value={aiDebugResult.reasoningContentPreview} apiKey={aiSettings.apiKey} />
                        <DebugPreviewBlock label="extracted content preview" value={aiDebugResult.extractedContentPreview} apiKey={aiSettings.apiKey} />
                        <DebugPreviewBlock label="cleaned content preview" value={aiDebugResult.cleanedContentPreview} apiKey={aiSettings.apiKey} />
                        <DebugPreviewBlock label="parse error" value={aiDebugResult.parseError ?? ""} apiKey={aiSettings.apiKey} />
                      </div>
                    ) : null}
                  </SettingsDisclosure>
                </SettingsDisclosure>
              ) : <SettingsInlineMessage>{t("developerModeDesc")}</SettingsInlineMessage>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--zc-divider)] py-4">
                <span className={quietText} role="status" aria-live="polite" data-ai-settings-state={aiSettingsSaveError ? "error" : aiSettingsDirty ? "unsaved" : "applied"}>{aiSettingsSaveError ? t("aiSettingsSaveFailed") : aiSettingsDirty ? t("aiUnsavedChanges") : t("aiSettingsApplied")}</span>
                <button type="button" className={buttonSecondary} onClick={() => void saveAISettings()} disabled={!aiSettingsDirty || isSavingAISettings || isTestingAIConnection}>{isSavingAISettings ? t("aiSavingSettings") : t("aiSaveSettings")}</button>
              </div>
            </fieldset>
          )}
        </SettingsSection>

        <SettingsSection id="settings-privacy" title={t("settingsPrivacy")} description={t("settingsPrivacyDesc")}>
          <SettingsInlineMessage>{t("privacyLine")}</SettingsInlineMessage>
          <SettingsRow label={t("logRetention")} description={t("logRetentionDesc")}>
            <SettingsSegmentedControl
              value={String(restoreRetentionDays)}
              ariaLabel={t("logRetention")}
              options={([15, 30, 60, 90] as RestoreRetentionDays[]).map((days) => ({ value: String(days), label: `${days} ${t("days")}` }))}
              onChange={(next) => void updateRestoreRetentionDays(Number(next) as RestoreRetentionDays)}
            />
          </SettingsRow>
          <SettingsInlineMessage>{t("settingsSafetyRestoreDesc")}</SettingsInlineMessage>
        </SettingsSection>

        <SettingsSection id="settings-about" title={t("settingsAbout")} description={t("settingsAboutDesc")}>
          <SettingsControlGroup title={t("aboutBuildInfo")} description={t("aboutBuildInfoDesc")}>
            <SettingsRow label={t("appName")} description={t("developerReleaseDesc")}>
              <span className="text-sm font-medium text-[var(--zc-text-primary)]">v{packageInfo.version}</span>
            </SettingsRow>
            <SettingsRow label={t("aboutProjectLink")} description={t("aboutProjectLinkDesc")}>
              <a className={buttonSecondary} href={packageInfo.homepage} target="_blank" rel="noreferrer">
                {t("aboutOpenProject")}
              </a>
            </SettingsRow>
          </SettingsControlGroup>
          <SettingsSwitch id="settings-developer-mode" label={t("developerMode")} description={t("developerModeDesc")} checked={developerMode} onChange={setDeveloperModePreference} />
          <SettingsControlGroup title={t("searchSources")} description={t("searchSourcesDesc")}>
            <SettingsInlineMessage>{t("localOnly")}</SettingsInlineMessage>
            <div className="grid gap-1 text-sm">
              <strong className="text-[var(--zc-text-primary)]">{t("excludedDirs")}</strong>
              <span className="text-sm leading-6 text-[var(--zc-text-secondary)]">node_modules, .git, target, dist, build</span>
            </div>
          </SettingsControlGroup>
        </SettingsSection>
    </SettingsLayout>
    <ConfirmDialog
      open={Boolean(folderDeleteConfirm)}
      tone="warning"
      title={folderDeleteConfirm?.kind === "scan" ? t("confirmDeleteScanFolderTitle") : t("confirmDeleteSearchFolderTitle")}
      description={
        folderDeleteConfirm
          ? (folderDeleteConfirm.kind === "scan" ? t("confirmDeleteScanFolderDesc") : t("confirmDeleteSearchFolderDesc")).replace("{path}", folderDeleteConfirm.root.path)
          : undefined
      }
      confirmLabel={folderDeleteConfirm?.kind === "scan" ? t("deleteScanFolder") : t("deleteSearchFolder")}
      cancelLabel={t("cancel")}
      isProcessing={isDeletingFolderConfig}
      onCancel={() => setFolderDeleteConfirm(null)}
      onConfirm={confirmFolderDelete}
    />
    </>
  );
}

function normalizeSettingsRoot(path: string) {
  return normalizePathLike(path.trim());
}

function DebugPreviewBlock({
  label,
  value,
  apiKey
}: {
  label: string;
  value: string | null | undefined;
  apiKey: string;
}) {
  const displayValue = sanitizeAIStatusMessage(value || "—", apiKey);
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-[var(--zc-text-primary)]">{label}</span>
      <pre className={cn(settingsField, "max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-5")}>
        {displayValue}
      </pre>
    </label>
  );
}

function defaultAISettingsFromPreset(preset?: AIProviderPreset): AISettings | null {
  if (!preset) return null;
  return {
    enabled: false,
    provider: preset.providerKind,
    preset: preset.id,
    baseUrl: preset.defaultBaseUrl,
    chatPath: preset.defaultChatPath || "/chat/completions",
    apiKey: "",
    model: preset.defaultModel,
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

function normalizeAISettingsForSave(settings: AISettings): AISettings {
  const chatPath = settings.chatPath.trim();
  return {
    ...settings,
    baseUrl: settings.baseUrl.trim().replace(/\/+$/g, ""),
    chatPath: chatPath ? `/${chatPath.replace(/^\/+/g, "")}` : "/chat/completions",
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    batchSize: Math.max(1, Math.floor(settings.batchSize || 1)),
    classificationConcurrency: settings.provider === "ollama"
      ? 1
      : Math.min(4, Math.max(1, Math.floor(settings.classificationConcurrency || 1))),
    timeoutSeconds: Math.max(1, Math.floor(settings.timeoutSeconds || 1)),
    maxTokens: Math.max(1, Math.floor(settings.maxTokens || 1)),
    reasoningEffort: settings.reasoningEffort?.trim() || null,
    extraBodyJson: settings.extraBodyJson?.trim() || null
  };
}

function sanitizeAIStatusMessage(message: string, apiKey: string) {
  const trimmed = apiKey.trim();
  return trimmed ? message.split(trimmed).join("[redacted]") : message;
}

function aiConnectionSuccessMessage(result: AIConnectionTestResult, successLabel: string) {
  const provider = result.provider === "ollama" ? "Ollama" : "OpenAI-compatible";
  const model = result.model || "—";
  return `${successLabel}: ${provider} / ${model} / ${result.elapsedMs}ms`;
}
