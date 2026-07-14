import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, Keyboard, Play, Trash2 } from "lucide-react";
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
import { acceleratorFromKeyboardEvent, formatHotkeyLabel, isValidSearchHotkey } from "../../utils/hotkeys";
import { compactPath, normalizePathLike, readableError } from "../../utils/viewHelpers";
import { buttonIconDanger, buttonSecondary, cn, glassButton, inputSurface, selectSurface } from "../../utils/tw";
import {
  ConfirmDialog,
  ControlGroup,
  NoticeBanner,
  SegmentedControl,
  StateBlock,
  SwitchButton,
  SwitchField,
  ToneBadge,
  compactInteractiveRow,
  formRow,
  formSection,
  metadataText,
  pageSurface,
  panelSurface,
  quietText,
  softPanel,
  SectionTitle
} from "../shared/ui";

type StatusTone = "success" | "warning";
type FolderDeleteConfirmState =
  | { kind: "scan"; root: ScanRootSetting }
  | { kind: "search"; root: SearchRootSetting };

const DEVELOPER_MODE_STORAGE_KEY = "zc-developer-mode";

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
  const publishAIProcessingMode = useAIProcessingModeStore((state) => state.publish);
  const [aiPresets, setAiPresets] = useState<AIProviderPreset[]>([]);
  const [isLoadingAISettings, setIsLoadingAISettings] = useState(false);
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);
  const [isTestingAIConnection, setIsTestingAIConnection] = useState(false);
  const [aiConnectionStatus, setAiConnectionStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [aiDebugTarget, setAiDebugTarget] = useState("");
  const [isDebuggingAI, setIsDebuggingAI] = useState(false);
  const [aiDebugStatus, setAiDebugStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [aiDebugResult, setAiDebugResult] = useState<AIDebugClassificationResult | null>(null);
  const [activeSettingsSection, setActiveSettingsSection] = useState("settings-appearance");
  const [developerMode, setDeveloperMode] = useState(readDeveloperMode);
  const hotkeyCaptureRef = useRef<HTMLDivElement | null>(null);

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

  function focusSettingsSection(sectionId: string) {
    setActiveSettingsSection(sectionId);
    window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ block: "start" });
      section?.focus({ preventScroll: true });
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
    function focusSection(sectionId: string) {
      window.setTimeout(() => {
        const targetSection = sectionId === "settings-appearance" ? "settings-appearance" : sectionId === "settings-search-scope" ? "settings-search" : sectionId;
        setActiveSettingsSection(targetSection);
        const section = document.getElementById(sectionId) ?? document.getElementById(targetSection);
        section?.scrollIntoView({ block: "start" });
        section?.focus({ preventScroll: true });
      }, 0);
    }

    function handleSectionRequest(event: Event) {
      const sectionId = (event as CustomEvent<string>).detail;
      if (sectionId) focusSection(sectionId);
    }

    window.addEventListener(SETTINGS_SECTION_EVENT, handleSectionRequest);
    try {
      const pendingSection = window.sessionStorage.getItem(SETTINGS_SECTION_EVENT);
      if (pendingSection) {
        window.sessionStorage.removeItem(SETTINGS_SECTION_EVENT);
        focusSection(pendingSection);
      }
    } catch {
      // In-memory events still work when storage is unavailable.
    }
    return () => window.removeEventListener(SETTINGS_SECTION_EVENT, handleSectionRequest);
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
    };
  }, [publishAIProcessingMode]);

  function showStatus(message: string, tone: StatusTone = "success") {
    setSettingsStatus(message);
    setSettingsStatusTone(tone);
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
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: t("folderPickerTitle")
    });
    const path = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
    if (!path?.trim()) return;

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
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: t("organizeRootPickerTitle")
    });
    const path = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
    if (!path?.trim()) return;

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
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: t("folderPickerTitle")
    });
    const path = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
    if (!path?.trim()) return;

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
  }

  async function confirmFolderDelete() {
    if (!folderDeleteConfirm || isDeletingFolderConfig) return;
    setIsDeletingFolderConfig(true);
    try {
      if (folderDeleteConfirm.kind === "scan") {
        await deleteScanRoot(folderDeleteConfirm.root);
      } else {
        await deleteSearchRoot(folderDeleteConfirm.root);
      }
      setFolderDeleteConfirm(null);
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
    setAiConnectionStatus(null);
    setAiDebugStatus(null);
    setAiSettings((current) => current ? { ...current, ...partial } : current);
  }

  function applyAIClassificationPreset(mode: "fast" | "standard" | "detailed") {
    if (mode === "fast") {
      updateAISettings({
        batchSize: 20,
        classificationConcurrency: 2,
        maxTokens: 1024,
        sendFullPath: false,
        sendParentPath: true
      });
      return;
    }
    if (mode === "detailed") {
      updateAISettings({
        batchSize: 5,
        classificationConcurrency: 1,
        maxTokens: 2048,
        sendFullPath: true,
        sendParentPath: true
      });
      return;
    }
    updateAISettings({
      batchSize: 10,
      classificationConcurrency: 2,
      maxTokens: 1024,
      sendFullPath: false,
      sendParentPath: true
    });
  }

  function selectAIPreset(presetId: AIProviderPresetId) {
    const preset = aiPresets.find((item) => item.id === presetId);
    setAiConnectionStatus(null);
    setAiDebugStatus(null);
    setAiSettings((current) => {
      if (!preset) return current ? { ...current, preset: presetId } : current;
      const fallback = current ?? defaultAISettingsFromPreset(preset);
      if (!fallback) return fallback;
      return {
        ...fallback,
        preset: preset.id,
        provider: preset.providerKind,
        baseUrl: preset.defaultBaseUrl,
        chatPath: preset.defaultChatPath,
        model: preset.defaultModel,
        apiKey: fallback.apiKey,
        batchSize: preset.providerKind === "ollama" ? 5 : 10,
        classificationConcurrency: preset.providerKind === "ollama" ? 1 : 2
      };
    });
  }

  async function saveAISettings() {
    if (!aiSettings || isSavingAISettings) return;
    const next = normalizeAISettingsForSave(aiSettings);
    setIsSavingAISettings(true);
    setAiConnectionStatus(null);
    try {
      const saved = await tauriApi.saveAISettings(next);
      setAiSettings(saved);
      publishAIProcessingMode({ enabled: saved.enabled, provider: saved.provider });
      showStatus(t("aiSettingsSaved"));
    } catch (error) {
      setAiConnectionStatus({
        tone: "warning",
        message: sanitizeAIStatusMessage(`${t("aiSettingsSaveFailed")}：${readableError(error)}`, aiSettings.apiKey)
      });
    } finally {
      setIsSavingAISettings(false);
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
    <div className={cn(pageSurface, "overflow-auto")}>
      <section className={cn(panelSurface, "mx-auto grid w-full max-w-[1180px] gap-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title={t("settings")} body={t("settingsDesc")} />
          {settingsStatus && settingsStatusTone === "success" ? (
            <span className={cn(quietText, "rounded-full border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] px-3 py-1.5")} aria-live="polite">
              {settingsStatus}
            </span>
          ) : null}
        </div>

        {settingsStatus && settingsStatusTone === "warning" ? (
          <NoticeBanner tone="warning">{settingsStatus}</NoticeBanner>
        ) : null}

        <div className={cn(softPanel, "grid gap-2 p-2")}>
          <span className={cn(quietText, "px-2")}>{t("settingsSectionsLabel")}</span>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8" aria-label={t("settingsSectionsLabel")}>
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={cn(
                  "min-h-9 rounded-[var(--zc-radius-control)] px-2 py-1.5 text-sm font-medium transition-[background,color,box-shadow]",
                  activeSettingsSection === section.id
                    ? "bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)] shadow-sm"
                    : "text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)]"
                )}
                aria-pressed={activeSettingsSection === section.id}
                onClick={() => focusSettingsSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <ControlGroup id="settings-appearance" title={t("settingsAppearanceLanguage")} description={t("settingsAppearanceLanguageDesc")}>
          <div className={formRow}>
            <div><strong className="block text-sm">{t("language")}</strong><span className={metadataText}>{t("languageDesc")}</span></div>
            <SegmentedControl
              value={language}
              ariaLabel={t("language")}
              options={[
                { value: "zh", label: "中文" },
                { value: "en", label: "English" }
              ]}
              onChange={setLanguage}
            />
          </div>
          <div id="settings-appearance-theme" tabIndex={-1} className={cn(formRow, "outline-none")}>
            <div><strong className="block text-sm">{t("appearance")}</strong><span className={metadataText}>{t("appearanceDesc")}</span></div>
            <SegmentedControl
              value={theme}
              ariaLabel={t("appearance")}
              options={[
                { value: "light", label: t("lightTheme") },
                { value: "dark", label: t("darkTheme") },
                { value: "system", label: t("systemTheme") }
              ]}
              onChange={setTheme}
            />
          </div>
          <div className={formRow}>
            <div><strong className="block text-sm">{t("folderNaming")}</strong><span className={metadataText}>{t("folderNamingDesc")}</span></div>
            <SegmentedControl
              value={folderNamingLanguage}
              ariaLabel={t("folderNaming")}
              options={[
                { value: "en", label: t("englishFolderNames") },
                { value: "zh", label: t("chineseFolderNames") }
              ]}
              onChange={(next) => void updateFolderNamingLanguage(next)}
            />
          </div>
        </ControlGroup>

        <div id="settings-files-scan" tabIndex={-1} className="grid gap-4 outline-none">
        <ControlGroup title={t("settingsScanRoots")} description={t("settingsScanRootsDesc")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={quietText}>{t("defaultScanFoldersRestartHint")}</span>
            <button className={buttonSecondary} onClick={() => void addDefaultScanFolder()}>
              <FolderPlus size={15} />
              <span>{t("addScanFolder")}</span>
            </button>
          </div>
          <div className="grid gap-2">
            {defaultScanFolders.length ? defaultScanFolders.map((root) => (
              <div key={root.id} className={cn(compactInteractiveRow(), "px-3 py-2")}>
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto] md:items-center">
                  <div className="min-w-0 text-left">
                    <strong className="block truncate text-sm">{root.label}</strong>
                    <span className="block truncate text-xs leading-5 text-[var(--muted)]" title={root.path}>{compactPath(root.path, 72)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                    <SwitchButton
                      checked={root.enabled}
                      label={root.enabled ? t("disableScanFolder") : t("enableScanFolder")}
                      statusLabel={root.enabled ? t("enabled") : t("disabled")}
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
              <StateBlock title={t("defaultScanFolders")} description={t("noDefaultScanFolders")} primaryAction={(
                <button className={buttonSecondary} onClick={() => void addDefaultScanFolder()}>
                  <FolderPlus size={15} />
                  <span>{t("addScanFolder")}</span>
                </button>
              )} />
            )}
          </div>
        </ControlGroup>

        <ControlGroup title={t("settingsOrganizeRoot")} description={t("settingsOrganizeRootDesc")}>
          <div className={formRow}>
            <div>
              <strong className="block text-sm">{t("settingsOrganizeRoot")}</strong>
              <span className={metadataText}>
                {organizeRootMode === "current_folder"
                  ? t("organizeRootCurrentDesc")
                  : organizeRootMode === "zen_canvas_folder"
                    ? t("organizeRootZenCanvasDesc")
                    : t("organizeRootCustomDesc")}
              </span>
              <span className={metadataText}>{t("organizePreviewStillRequired")}</span>
            </div>
            <SegmentedControl
              value={organizeRootMode}
              ariaLabel={t("settingsOrganizeRoot")}
              options={[
                { value: "current_folder", label: t("organizeRootCurrentFolder") },
                { value: "zen_canvas_folder", label: t("organizeRootZenCanvasFolder") },
                { value: "custom_root", label: t("organizeRootCustomRoot") }
              ]}
              onChange={(next) => void updateOrganizeRootMode(next)}
            />
          </div>
          {organizeRootMode === "custom_root" ? (
            <div className={formRow}>
              <div>
                <strong className="block text-sm">{t("organizeRootCustomRoot")}</strong>
                <span className={metadataText}>{t("organizeRootCustomDesc")}</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
                <input
                  className={cn(inputSurface, "min-w-[220px] flex-1 md:w-[360px]")}
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
            </div>
          ) : null}
        </ControlGroup>
        </div>

        <ControlGroup id="settings-search" title={t("settingsSearch")} description={t("settingsSearchDesc")}>
          <div className={formRow}>
            <div>
              <strong className="block text-sm">{t("searchHotkey")}</strong>
              <span className={metadataText}>{t("searchHotkeyDesc")}</span>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
              <span className="rounded-xl border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--ink)]">{hotkey}</span>
              <button className={cn(buttonSecondary, isRecordingHotkey && "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)] text-[var(--zc-primary-text)]")} onClick={() => setIsRecordingHotkey(true)}>
                <Keyboard size={14} />
                <span>{t("changeHotkey")}</span>
              </button>
            </div>
          </div>
          {isRecordingHotkey && (
            <NoticeBanner tone="info" title={t("hotkeyCaptureTitle")}>
              <div
                ref={hotkeyCaptureRef}
                className="mt-2 grid gap-2 rounded-xl border border-[var(--zc-info-border)] bg-[var(--zc-info-soft)] px-3 py-3 outline-none focus-visible:shadow-[0_0_0_3px_var(--zc-focus-ring-soft)]"
                tabIndex={0}
              >
                <span>{t("recordingHotkey")}</span>
                <span className={quietText}>{t("hotkeyCaptureCurrent")}: {recordingHotkeyPreview || hotkey}</span>
                <span className={quietText}>Esc: {t("cancel")}</span>
              </div>
            </NoticeBanner>
          )}
          {globalHotkeyError ? (
            <NoticeBanner tone="warning">{t("hotkeyConflictHint")}</NoticeBanner>
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
          <div id="settings-search-scope" tabIndex={-1} className={cn(formRow, "outline-none")}>
            <div><strong className="block text-sm">{t("searchScopeSettings")}</strong><span className={metadataText}>{t("searchScopeSettingsDesc")}</span></div>
            <SegmentedControl
              value={searchScopeMode}
              ariaLabel={t("searchScopeSettings")}
              options={[
                { value: "all", label: t("searchScopeAllIndexed") },
                { value: "current_scan", label: t("searchScopeCurrentScan") },
                { value: "custom_roots", label: t("searchScopeCustomRoots") }
              ]}
              onChange={(next) => void updateSearchScopeMode(next)}
            />
          </div>
          <span className={quietText}>{t("searchLocalIndexBoundary")}</span>
          {searchScopeMode === "custom_roots" && (
            <div className="grid gap-2">
              <div className="flex justify-end">
                <button className={buttonSecondary} onClick={() => void addCustomSearchRoot()}>
                  <FolderPlus size={15} />
                  <span>{t("addSearchFolder")}</span>
                </button>
              </div>
              {customSearchRoots.length ? customSearchRoots.map((root) => (
                <div key={root.id} className={cn(compactInteractiveRow(), "px-3 py-2")}>
                  <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto] md:items-center">
                    <div className="min-w-0 text-left">
                      <strong className="block truncate text-sm">{root.label}</strong>
                      <span className="block truncate text-xs leading-5 text-[var(--muted)]" title={root.path}>{compactPath(root.path, 72)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                      <SwitchButton
                        checked={root.enabled}
                        label={root.enabled ? t("disableSearchFolder") : t("enableSearchFolder")}
                        statusLabel={root.enabled ? t("enabled") : t("disabled")}
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
                <StateBlock title={t("searchScopeCustomRoots")} description={t("searchScopeCustomEmpty")} primaryAction={(
                  <button className={buttonSecondary} onClick={() => void addCustomSearchRoot()}>
                    <FolderPlus size={15} />
                    <span>{t("addSearchFolder")}</span>
                  </button>
                )} />
              )}
            </div>
          )}
          {(isBackgroundIndexing || pendingBackgroundRoots.length > 0 || completedBackgroundRoots.length > 0 || failedBackgroundRoots.length > 0) ? (
            <div className={cn(softPanel, "grid gap-1.5 p-3 text-sm")} aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[var(--ink)]">{t("backgroundIndexingTitle")}</strong>
                <ToneBadge tone={isBackgroundIndexing ? "info" : failedBackgroundRoots.length ? "warning" : "success"}>
                  {isBackgroundIndexing ? t("backgroundIndexingRunning") : t("backgroundIndexingIdle")}
                </ToneBadge>
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
            </div>
          ) : null}
          <span className={quietText}>{t("searchScopeDoesNotChangeLibrary")}</span>
        </ControlGroup>

        <ControlGroup id="settings-privacy" title={t("settingsSafetyRestore")} description={t("settingsSafetyRestoreDesc")}>
          <div className={formRow}>
            <div><strong className="block text-sm">{t("logRetention")}</strong><span className={metadataText}>{t("logRetentionDesc")}</span></div>
            <SegmentedControl
              value={String(restoreRetentionDays)}
              ariaLabel={t("logRetention")}
              options={([15, 30, 60, 90] as RestoreRetentionDays[]).map((days) => ({ value: String(days), label: `${days} ${t("days")}` }))}
              onChange={(next) => void updateRestoreRetentionDays(Number(next) as RestoreRetentionDays)}
            />
          </div>
        </ControlGroup>

        <div id="settings-general" tabIndex={-1} className="grid gap-4 outline-none">
        <ControlGroup title={t("settingsWindowBehavior")} description={t("settingsWindowBehaviorDesc")}>
          <div className={formRow}>
            <div><strong className="block text-sm">{t("closeBehavior")}</strong><span className={metadataText}>{t("closeBehaviorDesc")}</span></div>
            <SegmentedControl
              value={closeBehavior}
              ariaLabel={t("closeBehavior")}
              options={[
                { value: "ask", label: t("askEveryTime") },
                { value: "minimize", label: t("minimizeToTray") },
                { value: "quit", label: t("quitApp") }
              ]}
              onChange={(next) => void updateCloseBehavior(next)}
            />
          </div>
        </ControlGroup>

        <ControlGroup title={t("settingsStartup")} description={t("settingsStartupDesc")}>
          <SwitchField
            label={t("backgroundIndexOnStartup")}
            description={t("backgroundIndexOnStartupDesc")}
            checked={backgroundIndexOnStartup}
            onChange={(next) => void updateBackgroundIndexOnStartup(next)}
            statusLabel={backgroundIndexOnStartup ? t("enabled") : t("disabled")}
          />
          <SwitchField
            label={t("launchAtLogin")}
            description={t("launchAtLoginDesc")}
            checked={launchAtLogin}
            onChange={(next) => void updateLaunchAtLogin(next)}
            statusLabel={launchAtLogin ? t("enabled") : t("disabled")}
          />
        </ControlGroup>
        </div>

        <ControlGroup id="settings-automation" title={t("settingsAutomation")} description={t("settingsAutomationDesc")}>
          <NoticeBanner tone="info">{t("automationSafetyBoundary")}</NoticeBanner>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={metadataText}>{t("automationManualRuleSet")}</span>
            <button className={buttonSecondary} onClick={() => setView("rules")}>{t("automationRules")}</button>
          </div>
        </ControlGroup>

        <div id="settings-ai" tabIndex={-1} className="outline-none">
        <ControlGroup title={t("settingsAI")} description={t("settingsAIDesc")}>
          {isLoadingAISettings || !aiSettings ? (
            <StateBlock title={t("aiSettingsLoading")} description={t("aiSettingsLoadingDesc")} />
          ) : (
            <div className="grid gap-4">
              <SwitchField
                label={t("aiEnabledLabel")}
                description={t("aiEnabledDesc")}
                checked={aiSettings.enabled}
                onChange={(next) => updateAISettings({ enabled: next })}
                statusLabel={aiSettings.enabled ? t("enabled") : t("disabled")}
              />
              <SwitchField
                label={t("aiCleanupEnabledLabel")}
                description={t("aiCleanupEnabledDesc")}
                checked={aiSettings.cleanupAiEnabled}
                onChange={(next) => updateAISettings({ cleanupAiEnabled: next })}
                statusLabel={aiSettings.cleanupAiEnabled ? t("enabled") : t("disabled")}
              />
              {developerMode ? (
              <details open className={cn(softPanel, "grid gap-3 p-3")}>
                <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">{t("advancedSettings")}</summary>
                <div className="grid gap-4">
              <div className={cn(softPanel, "grid gap-2 p-3")}>
                <strong className="text-sm text-[var(--ink)]">{t("aiClassificationPresets")}</strong>
                <span className={quietText}>{t("aiClassificationPresetsDesc")}</span>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonSecondary} onClick={() => applyAIClassificationPreset("fast")}>{t("aiPresetFast")}</button>
                  <button className={buttonSecondary} onClick={() => applyAIClassificationPreset("standard")}>{t("aiPresetStandard")}</button>
                  <button className={buttonSecondary} onClick={() => applyAIClassificationPreset("detailed")}>{t("aiPresetDetailed")}</button>
                </div>
              </div>
              <div className={formRow}>
                <div>
                  <strong className="block text-sm">{t("aiProviderPreset")}</strong>
                  <span className={metadataText}>{t("aiProviderPresetDesc")}</span>
                </div>
                <select
                  className={cn(selectSurface, "min-w-[260px]")}
                  value={aiSettings.preset}
                  onChange={(event) => selectAIPreset(event.target.value as AIProviderPresetId)}
                >
                  {aiPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Base URL" value={aiSettings.baseUrl} onChange={(value) => updateAISettings({ baseUrl: value })} />
                <TextField label="Chat Path" value={aiSettings.chatPath} onChange={(value) => updateAISettings({ chatPath: value })} />
                {aiSettings.provider === "ollama" ? (
                  <div className={cn(softPanel, "p-3 text-sm text-[var(--muted)]")}>{t("aiLocalApiKeyHint")}</div>
                ) : (
                  <TextField
                    label="API Key"
                    type="password"
                    value={aiSettings.apiKey}
                    onChange={(value) => updateAISettings({ apiKey: value })}
                    placeholder={aiSettings.apiKeyConfigured ? t("aiStoredApiKeyPlaceholder") : t("aiEmptyApiKeyPlaceholder")}
                  />
                )}
                <TextField label="Model" value={aiSettings.model} onChange={(value) => updateAISettings({ model: value })} />
                <NumberField
                  label="Batch Size"
                  description={t("aiBatchSizeDesc")}
                  value={aiSettings.batchSize}
                  min={1}
                  onChange={(value) => updateAISettings({ batchSize: value })}
                />
                <NumberField
                  label={t("aiConcurrencyLabel")}
                  description={t("aiConcurrencyDesc")}
                  value={aiSettings.classificationConcurrency}
                  min={1}
                  onChange={(value) => updateAISettings({ classificationConcurrency: Math.min(4, Math.max(1, value)) })}
                />
                <NumberField
                  label="Max Tokens"
                  value={aiSettings.maxTokens}
                  min={512}
                  onChange={(value) => updateAISettings({ maxTokens: value })}
                />
                <NumberField label="Timeout Seconds" value={aiSettings.timeoutSeconds} min={1} onChange={(value) => updateAISettings({ timeoutSeconds: value })} />
              </div>
              <NoticeBanner tone="info">
                {t("aiLearningHint")}
              </NoticeBanner>
              <div className="grid gap-3 md:grid-cols-2">
                <SwitchField
                  label={t("aiLearnedRulesLabel")}
                  description={t("aiLearnedRulesDesc")}
                  checked={useLearnedRulesAsAutoRules}
                  onChange={(next) => void updateSettings({ useLearnedRulesAsAutoRules: next })}
                  statusLabel={useLearnedRulesAsAutoRules ? t("enabled") : t("disabled")}
                />
                <SwitchField
                  label={t("aiLegacyRulesLabel")}
                  description={t("aiLegacyRulesDesc")}
                  checked={useLegacyBuiltinClassificationRules}
                  onChange={(next) => void updateSettings({ useLegacyBuiltinClassificationRules: next })}
                  statusLabel={useLegacyBuiltinClassificationRules ? t("enabled") : t("disabled")}
                />
              </div>
              {aiSettings.preset === "deepseek" && ["deepseek-chat", "deepseek-reasoner"].includes(aiSettings.model.trim()) ? (
                <NoticeBanner tone="warning">{t("aiOldModelWarning")}</NoticeBanner>
              ) : null}
              {(aiSettings.provider === "ollama" || aiSettings.model.toLowerCase().includes("qwen3")) ? (
                <NoticeBanner tone="warning">{t("aiQwenWarning")}</NoticeBanner>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <SwitchField
                  label={t("aiForceJsonLabel")}
                  description={t("aiForceJsonDesc")}
                  checked={aiSettings.forceJsonOutput}
                  onChange={(next) => updateAISettings({ forceJsonOutput: next })}
                  statusLabel={aiSettings.forceJsonOutput ? t("enabled") : t("disabled")}
                />
                <SwitchField
                  label={t("aiThinkingLabel")}
                  description={t("aiThinkingDesc")}
                  checked={aiSettings.enableThinking}
                  onChange={(next) => updateAISettings({ enableThinking: next })}
                  statusLabel={aiSettings.enableThinking ? t("enabled") : t("disabled")}
                />
                <TextField
                  label="Reasoning Effort"
                  value={aiSettings.reasoningEffort ?? ""}
                  onChange={(value) => updateAISettings({ reasoningEffort: value || null })}
                  placeholder={t("aiReasoningPlaceholder")}
                />
                <SwitchField
                  label={t("aiSendFullPathLabel")}
                  description={t("aiSendFullPathDesc")}
                  checked={aiSettings.sendFullPath}
                  onChange={(next) => updateAISettings({ sendFullPath: next })}
                  statusLabel={aiSettings.sendFullPath ? t("enabled") : t("disabled")}
                />
                <SwitchField
                  label={t("aiSendParentPathLabel")}
                  description={t("aiSendParentPathDesc")}
                  checked={aiSettings.sendParentPath}
                  onChange={(next) => updateAISettings({ sendParentPath: next })}
                  statusLabel={aiSettings.sendParentPath ? t("enabled") : t("disabled")}
                />
              </div>
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-[var(--ink)]">{t("aiExtraBodyLabel")}</span>
                  <textarea
                    className={cn(inputSurface, "min-h-24 resize-y py-2 font-mono")}
                    value={aiSettings.extraBodyJson ?? ""}
                    onChange={(event) => updateAISettings({ extraBodyJson: event.target.value || null })}
                    placeholder={t("aiExtraBodyPlaceholder")}
                  />
                </label>
                <span className={quietText}>{t("aiSecretsHint")}</span>
              </div>
              {aiConnectionStatus ? (
                <NoticeBanner tone={aiConnectionStatus.tone}>{aiConnectionStatus.message}</NoticeBanner>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button className={buttonSecondary} onClick={() => void testAIConnection()} disabled={isTestingAIConnection || isSavingAISettings}>
                  {isTestingAIConnection ? t("aiTestingConnection") : t("aiTestConnection")}
                </button>
                <button className={buttonSecondary} onClick={() => void saveAISettings()} disabled={isSavingAISettings || isTestingAIConnection}>
                  {isSavingAISettings ? t("aiSavingSettings") : t("aiSaveSettings")}
                </button>
              </div>
              <details className={cn(softPanel, "grid gap-3 p-3")}>
                <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">{t("aiDebugTitle")}</summary>
                <div className="mt-3 grid gap-3">
                  <NoticeBanner tone="warning">
                    {t("aiDebugWarning")}
                  </NoticeBanner>
                  {selectedLibraryFile ? (
                    <div className={cn(softPanel, "grid gap-1 p-3 text-xs text-[var(--muted)]")}>
                      <span className="font-medium text-[var(--ink)]">{t("aiSelectedFile")}</span>
                      <span>{selectedLibraryFile.name}</span>
                      <span title={selectedLibraryFile.path}>{compactPath(selectedLibraryFile.path, 96)}</span>
                    </div>
                  ) : (
                    <span className={quietText}>{t("aiNoSelectedFile")}</span>
                  )}
                  <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto_auto] md:items-end">
                    <TextField
                      label={t("aiDebugTargetLabel")}
                      value={aiDebugTarget}
                      onChange={setAiDebugTarget}
                      placeholder={t("aiDebugTargetPlaceholder")}
                    />
                    <button
                      className={buttonSecondary}
                      onClick={() => setAiDebugTarget(selectedLibraryFile?.id ?? "")}
                      disabled={!selectedLibraryFile || isDebuggingAI}
                    >
                      {t("aiUseSelectedFile")}
                    </button>
                    <button
                      className={buttonSecondary}
                      onClick={() => void debugAIClassificationOnce()}
                      disabled={isDebuggingAI || !aiDebugTarget.trim()}
                    >
                      {isDebuggingAI ? t("aiDebugging") : t("aiDebugSingleFile")}
                    </button>
                  </div>
                  {aiDebugStatus ? (
                    <NoticeBanner tone={aiDebugStatus.tone}>{sanitizeAIStatusMessage(aiDebugStatus.message, aiSettings.apiKey)}</NoticeBanner>
                  ) : null}
                  {aiDebugResult ? (
                    <div className="grid gap-3">
                      <div className={cn(softPanel, "grid gap-1 p-3 text-xs text-[var(--muted)]")}>
                        <span>Provider: {aiDebugResult.provider} / {aiDebugResult.preset}</span>
                        <span>Model: {aiDebugResult.model}</span>
                        <span>Endpoint: {aiDebugResult.baseUrl}{aiDebugResult.chatPath}</span>
                        <span>HTTP: {aiDebugResult.httpStatus} · response_format: {String(aiDebugResult.requestUsedResponseFormat)} · thinking: {aiDebugResult.requestUsedThinkingField ?? "未使用"}</span>
                        <span>Max Tokens: {aiDebugResult.maxTokens} · Batch Size: {aiDebugResult.batchSize} · Parse Stage: {aiDebugResult.parseStage}</span>
                        <span>refId: {aiDebugResult.refId || "未生成"} · real file id: {aiDebugResult.realFileId || "未匹配"}</span>
                        <span>Path: {compactPath(aiDebugResult.path, 96)}</span>
                        <span>Model returned refId/id: {aiDebugResult.modelReturnedRefId ?? "空"} / {aiDebugResult.modelReturnedId ?? "空"} · idMappingMatched: {String(aiDebugResult.idMappingMatched)}</span>
                        <span>missingOptionalFields: {aiDebugResult.missingOptionalFields.length ? aiDebugResult.missingOptionalFields.join(", ") : "无"} · fallbackApplied: {String(aiDebugResult.fallbackApplied)}</span>
                        <span>itemParseWarnings: {aiDebugResult.itemParseWarnings.length ? aiDebugResult.itemParseWarnings.join("；") : "无"}</span>
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
                </div>
              </details>
                </div>
              </details>
              ) : (
                <NoticeBanner tone="info">{t("developerModeDesc")}</NoticeBanner>
              )}
            </div>
          )}
        </ControlGroup>
        </div>

        <details id="settings-about" tabIndex={-1} className={cn(formSection, "group", "outline-none")}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">{t("settingsDeveloperRelease")}</summary>
          <div className="mt-3 grid gap-3">
            <p className={metadataText}>{t("developerReleaseDesc")}</p>
            <SwitchField
              label={t("developerMode")}
              description={t("developerModeDesc")}
              checked={developerMode}
              onChange={setDeveloperModePreference}
              statusLabel={developerMode ? t("enabled") : t("disabled")}
            />
            <div className={cn(softPanel, "grid gap-2 p-3")}>
              <div className={formRow}>
                <div><strong className="block text-sm">{t("searchSources")}</strong><span className={metadataText}>{t("searchSourcesDesc")}</span></div>
                <ToneBadge tone="info">{t("localOnly")}</ToneBadge>
              </div>
              <div>
                <strong className="block text-sm">{t("excludedDirs")}</strong>
                <span className={metadataText}>node_modules, .git, target, dist, build</span>
              </div>
            </div>
          </div>
        </details>
      </section>
    </div>
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

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <input
        className={inputSurface}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  description,
  value,
  min,
  onChange
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      {description ? <span className={quietText}>{description}</span> : null}
      <input
        className={inputSurface}
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
      />
    </label>
  );
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
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <pre className={cn(inputSurface, "max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-5")}>
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
    batchSize: preset.providerKind === "ollama" ? 5 : 10,
    classificationConcurrency: preset.providerKind === "ollama" ? 1 : 2,
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
