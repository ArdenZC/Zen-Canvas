import { useCallback, useEffect, useRef, useState } from "react";
import { tauriApi } from "../api/tauriApi";
import type {
  AppSettings,
  LibraryScope,
  ScanRootSetting,
  SearchRootSetting,
  VersionedAppSettings
} from "../types/domain";
import { DEFAULT_SEARCH_HOTKEY } from "../utils/hotkeys";
import { normalizePathLike, readableError } from "../utils/viewHelpers";

const defaultFormatSettingsError = (error: unknown) => readableError(error);

export const DEFAULT_APP_SETTINGS: AppSettings = {
  closeBehavior: "ask",
  folderNamingLanguage: "en",
  defaultScanFolders: [],
  restoreRetentionDays: 30,
  launchAtLogin: false,
  backgroundIndexOnStartup: true,
  searchHotkey: DEFAULT_SEARCH_HOTKEY,
  searchScopeMode: "all",
  customSearchRoots: [],
  organizeRootMode: "current_folder",
  organizeRootPath: undefined,
  useLegacyBuiltinClassificationRules: false,
  useLearnedRulesAsAutoRules: false
};

interface UseAppSettingsOptions {
  isDatabaseReady: boolean;
  onError: (message: string) => void;
  formatLoadError?: (error: unknown) => string;
  formatSaveError?: (error: unknown) => string;
}

type SettingsPersistenceApi = Pick<typeof tauriApi, "getSettings" | "saveSettings">;

export async function saveSettingsIntentWithRetry(
  api: SettingsPersistenceApi,
  base: VersionedAppSettings,
  partial: Partial<AppSettings>
): Promise<VersionedAppSettings> {
  try {
    return await api.saveSettings({
      settings: mergeAppSettings(base.settings, partial),
      expectedRevision: base.revision
    });
  } catch (error) {
    if (!readableError(error).includes("settings_revision_conflict")) {
      throw error;
    }
    const latest = await api.getSettings();
    return api.saveSettings({
      settings: mergeAppSettings(latest.settings, partial),
      expectedRevision: latest.revision
    });
  }
}

export function mergeAppSettings(
  settings: AppSettings,
  partial: Partial<AppSettings>
): AppSettings {
  return {
    ...settings,
    ...partial
  };
}

export function createScanRootSetting(
  path: string,
  createdAt = new Date().toISOString()
): ScanRootSetting {
  return createRootSetting(path, createdAt);
}

export function createSearchRootSetting(
  path: string,
  createdAt = new Date().toISOString()
): SearchRootSetting {
  return createRootSetting(path, createdAt);
}

export function upsertDefaultScanRoot(
  current: ScanRootSetting[],
  path: string,
  createdAt = new Date().toISOString()
): ScanRootSetting[] {
  const nextRoot = createScanRootSetting(path, createdAt);
  const existingIndex = current.findIndex((root) => sameScanRootPath(root.path, nextRoot.path));

  if (existingIndex === -1) return [...current, nextRoot];

  return current.map((root, index) =>
    index === existingIndex
      ? {
          ...root,
          path: nextRoot.path,
          label: root.label || nextRoot.label,
          enabled: true
        }
      : root
  );
}

export function toggleDefaultScanRoot(
  current: ScanRootSetting[],
  id: string,
  enabled: boolean
): ScanRootSetting[] {
  return current.map((root) => (root.id === id ? { ...root, enabled } : root));
}

export function removeDefaultScanRoot(
  current: ScanRootSetting[],
  id: string
): ScanRootSetting[] {
  return current.filter((root) => root.id !== id);
}

export function enabledScanRootPaths(roots: ScanRootSetting[]): string[] {
  return enabledRootPaths(roots);
}

export function upsertSearchRoot(
  current: SearchRootSetting[],
  path: string,
  createdAt = new Date().toISOString()
): SearchRootSetting[] {
  const nextRoot = createSearchRootSetting(path, createdAt);
  const existingIndex = current.findIndex((root) => sameScanRootPath(root.path, nextRoot.path));

  if (existingIndex === -1) return [...current, nextRoot];

  return current.map((root, index) =>
    index === existingIndex
      ? {
          ...root,
          path: nextRoot.path,
          label: root.label || nextRoot.label,
          enabled: true
        }
      : root
  );
}

export function toggleSearchRoot(
  current: SearchRootSetting[],
  id: string,
  enabled: boolean
): SearchRootSetting[] {
  return current.map((root) => (root.id === id ? { ...root, enabled } : root));
}

export function removeSearchRoot(
  current: SearchRootSetting[],
  id: string
): SearchRootSetting[] {
  return current.filter((root) => root.id !== id);
}

export function enabledSearchRootPaths(roots: SearchRootSetting[]): string[] {
  return enabledRootPaths(roots);
}

export function resolveEffectiveSearchScope(
  settings: Pick<AppSettings, "searchScopeMode" | "customSearchRoots">,
  currentLibraryScope: LibraryScope
): LibraryScope {
  if (settings.searchScopeMode === "all") return { kind: "all" };
  if (settings.searchScopeMode === "custom_roots") {
    return { kind: "roots", roots: enabledSearchRootPaths(settings.customSearchRoots) };
  }
  if (currentLibraryScope.kind === "current_scan") return currentLibraryScope;
  return { kind: "current_scan", roots: [] };
}

function createRootSetting<T extends ScanRootSetting | SearchRootSetting>(
  path: string,
  createdAt: string
): T {
  const normalizedPath = normalizeScanRootPath(path);
  return {
    id: scanRootId(normalizedPath),
    path: normalizedPath,
    label: scanRootLabel(normalizedPath),
    enabled: true,
    createdAt
  } as T;
}

function enabledRootPaths(roots: Array<ScanRootSetting | SearchRootSetting>): string[] {
  return roots
    .filter((root) => root.enabled && root.path.trim())
    .map((root) => root.path.trim());
}

function normalizeScanRootPath(path: string) {
  return path.trim().replace(/\\+/g, "/").replace(/\/+$/g, "");
}

function sameScanRootPath(left: string, right: string) {
  return normalizePathLike(normalizeScanRootPath(left)) === normalizePathLike(normalizeScanRootPath(right));
}

function scanRootLabel(path: string) {
  const normalizedPath = normalizeScanRootPath(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.at(-1) || normalizedPath;
}

function scanRootId(path: string) {
  const normalizedPath = normalizePathLike(normalizeScanRootPath(path));
  const slug = normalizedPath
    .replace(/^[a-z]:/i, (drive) => drive[0] ?? "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `scan-root-${slug || "root"}-${fnv1a32(normalizedPath)}`;
}

function fnv1a32(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function useAppSettings({
  isDatabaseReady,
  onError,
  formatLoadError = defaultFormatSettingsError,
  formatSaveError = defaultFormatSettingsError
}: UseAppSettingsOptions) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const latestSettingsRef = useRef(DEFAULT_APP_SETTINGS);
  const persistedSettingsRef = useRef(DEFAULT_APP_SETTINGS);
  const settingsRevisionRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!isDatabaseReady) return;

    let cancelled = false;

    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const loaded = await tauriApi.getSettings();
        if (!cancelled) {
          settingsRevisionRef.current = loaded.revision;
          persistedSettingsRef.current = loaded.settings;
          latestSettingsRef.current = loaded.settings;
          setSettings(loaded.settings);
        }
      } catch (error) {
        if (!cancelled) {
          onError(formatLoadError(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [formatLoadError, isDatabaseReady, onError]);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      const previousOptimisticSettings = latestSettingsRef.current;
      const nextSettings = mergeAppSettings(previousOptimisticSettings, partial);

      latestSettingsRef.current = nextSettings;
      setSettings(nextSettings);

      const saveIntent = async () => {
        try {
          const saved = await saveSettingsIntentWithRetry(
            tauriApi,
            {
              settings: persistedSettingsRef.current,
              revision: settingsRevisionRef.current
            },
            partial
          );
          persistedSettingsRef.current = saved.settings;
          settingsRevisionRef.current = saved.revision;
          if (requestId === saveRequestIdRef.current) {
            latestSettingsRef.current = saved.settings;
            setSettings(saved.settings);
          }
          return saved.settings;
        } catch (error) {
            try {
              const latest = await tauriApi.getSettings();
              persistedSettingsRef.current = latest.settings;
              settingsRevisionRef.current = latest.revision;
            } catch {
              // Keep the last confirmed database snapshot when reconciliation cannot load.
            }
            if (requestId === saveRequestIdRef.current) {
              latestSettingsRef.current = persistedSettingsRef.current;
              setSettings(persistedSettingsRef.current);
              onError(formatSaveError(error));
            }
            return persistedSettingsRef.current;
        }
      };

      const queued = saveQueueRef.current.then(saveIntent, saveIntent);
      saveQueueRef.current = queued.then(
        () => undefined,
        () => undefined
      );
      return queued;
    },
    [formatSaveError, onError]
  );

  return {
    settings,
    isLoadingSettings,
    updateSettings
  };
}
