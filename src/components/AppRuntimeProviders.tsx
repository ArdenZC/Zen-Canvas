import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { tauriApi } from "../api/tauriApi";
import { ChromeProvider, RulesProvider, SettingsProvider } from "../contexts/AppContexts";
import { useAppChrome } from "../hooks/useAppChrome";
import { enabledScanRootPaths, enabledSearchRootPaths, useAppSettings } from "../hooks/useAppSettings";
import { useFsWatcher } from "../hooks/useFsWatcher";
import { useRulePersistence } from "../hooks/useRulePersistence";
import { useWindowBehavior } from "../hooks/useWindowBehavior";
import { makeTranslator } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { useBackgroundIndexerStore } from "../store/useBackgroundIndexerStore";
import { useFileLibraryStore } from "../store/useFileLibraryStore";
import { useOperationQueueStore } from "../store/useOperationQueueStore";
import { persistRuleEnabledToggle, persistUserRuleDelete } from "../store/rulePersistence";
import { useRulesStore } from "../store/useRulesStore";
import { useScanManagerStore } from "../store/useScanManagerStore";
import type {
  CloseBehavior,
  FolderNamingLanguage,
  OrganizeRootMode,
  RestoreRetentionDays,
  ScanRootSetting,
  SearchRootSetting,
  SearchScopeMode,
  Rule
} from "../types/domain";
import { applySearchNavigation } from "../utils/searchNavigation";
import { normalizePathLike, readableError } from "../utils/viewHelpers";

export function AppRuntimeProviders({ children }: { children: ReactNode }) {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const showError = useAppStore((state) => state.showError);
  const enqueueBackgroundIndexRoots = useBackgroundIndexerStore((state) => state.enqueueRoots);
  const rules = useRulesStore((state) => state.rules);
  const upsertRule = useRulesStore((state) => state.upsertRule);
  const removeUserRule = useRulesStore((state) => state.removeUserRule);
  const hydrateUserRulesFromSQLite = useRulesStore((state) => state.hydrateUserRulesFromSQLite);
  const t = useMemo(() => makeTranslator(language), [language]);
  const refreshCurrentQuery = useCallback(
    () => useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery),
    []
  );
  const formatSettingsLoadError = useCallback(
    (error: unknown) => `${t("settingsLoadFailed")}：${readableError(error)}`,
    [t]
  );
  const formatSettingsSaveError = useCallback(
    (error: unknown) => `${t("settingsSaveFailed")}：${readableError(error)}`,
    [t]
  );
  const formatRuleSyncError = useCallback(() => t("ruleSyncFailed"), [t]);
  const reportWindowActionError = useCallback(
    (error: unknown) => showError(`${t("windowActionFailed")}：${readableError(error)}`),
    [showError, t]
  );

  const appSettingsState = useAppSettings({
    isDatabaseReady: true,
    onError: showError,
    formatLoadError: formatSettingsLoadError,
    formatSaveError: formatSettingsSaveError
  });
  const { settings: appSettings, isLoadingSettings, updateSettings } = appSettingsState;
  const appChrome = useAppChrome({
    theme,
    setTheme,
    setLanguage,
    searchHotkey: appSettings.searchHotkey
  });
  const {
    commandInputRef,
    isCommandOpen,
    setIsCommandOpen,
    platform,
    isWindows,
    effectiveTheme,
    hotkeyLabel,
    isSearchMode
  } = appChrome;
  useRulePersistence({
    enabled: !isSearchMode,
    isDatabaseReady: true,
    rules,
    hydrateUserRulesFromSQLite,
    onError: showError,
    formatSyncError: formatRuleSyncError
  });
  useFsWatcher({ onRefreshData: refreshCurrentQuery, onError: showError, rules, enabled: !isSearchMode });

  useEffect(() => {
    if (isSearchMode) return;
    useScanManagerStore.getState().setDefaultScanRoots(appSettings.defaultScanFolders);
  }, [appSettings.defaultScanFolders, isSearchMode]);

  const backgroundIndexRoots = useMemo(
    () => [
      ...enabledScanRootPaths(appSettings.defaultScanFolders),
      ...enabledSearchRootPaths(appSettings.customSearchRoots)
    ],
    [appSettings.defaultScanFolders, appSettings.customSearchRoots]
  );
  const backgroundIndexRootSignature = useMemo(
    () => backgroundIndexRoots.map(backgroundIndexRootKey).sort().join("\n"),
    [backgroundIndexRoots]
  );

  useEffect(() => {
    if (isSearchMode || isLoadingSettings) return;
    if (appSettings.backgroundIndexOnStartup === false) return;
    enqueueBackgroundIndexRoots(backgroundIndexRoots);
  }, [
    appSettings.backgroundIndexOnStartup,
    backgroundIndexRootSignature,
    enqueueBackgroundIndexRoots,
    isLoadingSettings,
    isSearchMode
  ]);

  useEffect(() => {
    if (isSearchMode) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void tauriApi.onSearchNavigate((payload) => {
      applySearchNavigation(payload, setView, useFileLibraryStore.getState().setSelectedFileId);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch((error) => {
      if (!disposed) showError(readableError(error));
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isSearchMode, setView, showError]);

  useEffect(() => {
    if (isSearchMode) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void tauriApi.onGlobalHotkeyRegistrationFailed((payload) => {
      useAppStore.getState().setGlobalHotkeyError(payload.message);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch((error) => {
      if (!disposed) showError(readableError(error));
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isSearchMode, showError]);

  const setCloseBehavior = useCallback(
    async (next: CloseBehavior) => {
      const savedSettings = await updateSettings({ closeBehavior: next });
      return savedSettings.closeBehavior === next;
    },
    [updateSettings]
  );
  const setFolderNamingLanguage = useCallback(
    async (next: FolderNamingLanguage) => {
      const savedSettings = await updateSettings({ folderNamingLanguage: next });
      return savedSettings.folderNamingLanguage === next;
    },
    [updateSettings]
  );
  const setDefaultScanFolders = useCallback(
    async (next: ScanRootSetting[]) => {
      const savedSettings = await updateSettings({ defaultScanFolders: next });
      return arraysEqual(savedSettings.defaultScanFolders, next);
    },
    [updateSettings]
  );
  const setRestoreRetentionDays = useCallback(
    async (next: RestoreRetentionDays) => {
      const savedSettings = await updateSettings({ restoreRetentionDays: next });
      return savedSettings.restoreRetentionDays === next;
    },
    [updateSettings]
  );
  const setLaunchAtLogin = useCallback(
    async (next: boolean) => {
      const savedSettings = await updateSettings({ launchAtLogin: next });
      return savedSettings.launchAtLogin === next;
    },
    [updateSettings]
  );
  const setBackgroundIndexOnStartup = useCallback(
    async (next: boolean) => {
      const savedSettings = await updateSettings({ backgroundIndexOnStartup: next });
      return savedSettings.backgroundIndexOnStartup === next;
    },
    [updateSettings]
  );
  const setSearchHotkey = useCallback(
    async (next: string) => {
      try {
        const status = await tauriApi.registerGlobalSearchHotkey(next);
        useAppStore.getState().setGlobalHotkeyError(status.error ?? "");
        if (!status.registered) {
          if (status.error) showError(status.error);
          return false;
        }
      } catch (error) {
        const message = readableError(error);
        useAppStore.getState().setGlobalHotkeyError(message);
        showError(message);
        return false;
      }

      const savedSettings = await updateSettings({ searchHotkey: next });
      return savedSettings.searchHotkey === next;
    },
    [showError, updateSettings]
  );
  const setSearchScopeMode = useCallback(
    async (next: SearchScopeMode) => {
      const savedSettings = await updateSettings({ searchScopeMode: next });
      return savedSettings.searchScopeMode === next;
    },
    [updateSettings]
  );
  const setCustomSearchRoots = useCallback(
    async (next: SearchRootSetting[]) => {
      const savedSettings = await updateSettings({ customSearchRoots: next });
      return arraysEqual(savedSettings.customSearchRoots, next);
    },
    [updateSettings]
  );
  const setOrganizeRootMode = useCallback(
    async (next: OrganizeRootMode) => {
      const savedSettings = await updateSettings({ organizeRootMode: next });
      return savedSettings.organizeRootMode === next;
    },
    [updateSettings]
  );
  const setOrganizeRootPath = useCallback(
    async (next?: string) => {
      const normalized = normalizeOptionalPath(next);
      const savedSettings = await updateSettings({ organizeRootPath: normalized });
      return normalizeOptionalPath(savedSettings.organizeRootPath) === normalized;
    },
    [updateSettings]
  );
  const windowBehavior = useWindowBehavior({
    closeBehavior: appSettings.closeBehavior,
    setCloseBehavior,
    onError: reportWindowActionError
  });
  const {
    closeBehavior,
    isCloseChoiceOpen,
    onCancelCloseChoice,
    handleWindowAction,
    requestClose,
    resolveCloseChoice
  } = windowBehavior;

  const saveRule = useCallback(async (rule: Rule) => {
    const savedRule = await tauriApi.saveUserRule(rule);
    upsertRule(savedRule);
  }, [upsertRule]);
  const toggleRuleEnabled = useCallback(async (rule: Rule, enabled: boolean) => {
    await persistRuleEnabledToggle({
      rule,
      enabled,
      saveUserRule: tauriApi.saveUserRule,
      upsertRule
    });
  }, [upsertRule]);
  const deleteRule = useCallback(async (rule: Rule) => {
    if (rule.source !== "user") {
      return false;
    }

    return persistUserRuleDelete({
      rule,
      deleteUserRule: tauriApi.deleteUserRule,
      removeRule: removeUserRule
    });
  }, [removeUserRule]);

  const settingsContextValue = useMemo(() => ({
    settings: appSettings,
    isLoadingSettings,
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
  }), [
    appSettings,
    isLoadingSettings,
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
  ]);
  const rulesContextValue = useMemo(() => ({
    rules,
    saveRule,
    toggleRuleEnabled,
    deleteRule
  }), [deleteRule, rules, saveRule, toggleRuleEnabled]);
  const chromeContextValue = useMemo(() => ({
    commandInputRef,
    isCommandOpen,
    setIsCommandOpen,
    platform,
    isWindows,
    effectiveTheme,
    hotkeyLabel,
    isSearchMode,
    closeBehavior,
    setCloseBehavior,
    isCloseChoiceOpen,
    onCancelCloseChoice,
    handleWindowAction,
    requestClose,
    resolveCloseChoice,
    language,
    setLanguage,
    theme,
    setTheme,
    view,
    setView,
    onError: showError,
    t
  }), [
    commandInputRef,
    isCommandOpen,
    setIsCommandOpen,
    platform,
    isWindows,
    effectiveTheme,
    hotkeyLabel,
    isSearchMode,
    closeBehavior,
    setCloseBehavior,
    isCloseChoiceOpen,
    onCancelCloseChoice,
    handleWindowAction,
    requestClose,
    resolveCloseChoice,
    language,
    setLanguage,
    theme,
    setTheme,
    view,
    setView,
    showError,
    t
  ]);

  return (
    <ChromeProvider value={chromeContextValue}>
      <StoreRuntimeBootstrapper enabled={!isSearchMode} />
      <SettingsProvider value={settingsContextValue}>
        <RulesProvider value={rulesContextValue}>{children}</RulesProvider>
      </SettingsProvider>
    </ChromeProvider>
  );
}

function StoreRuntimeBootstrapper({ enabled }: { enabled: boolean }) {
  const initializeScanListeners = useScanManagerStore((state) => state.initializeScanListeners);
  const initializeOperationQueue = useOperationQueueStore((state) => state.initializeOperationQueue);

  useEffect(() => {
    if (!enabled) return;

    void useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
    void initializeScanListeners();
    void initializeOperationQueue();
  }, [enabled, initializeOperationQueue, initializeScanListeners]);

  return null;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function backgroundIndexRootKey(path: string) {
  return normalizePathLike(path.trim());
}

function normalizeOptionalPath(path?: string | null) {
  const normalized = path?.trim().replace(/\\+/g, "/").replace(/\/+$/g, "");
  return normalized || undefined;
}
