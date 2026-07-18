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

type SettingsLoadGate = {
  promise: Promise<VersionedAppSettings | null>;
  resolve: (value: VersionedAppSettings | null) => void;
};

function createSettingsLoadGate(): SettingsLoadGate {
  let resolve!: (value: VersionedAppSettings | null) => void;
  const promise = new Promise<VersionedAppSettings | null>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

export async function reconcileFailedSettingsSave(
  api: Pick<typeof tauriApi, "getSettings">,
  error: unknown,
  onError: (message: string) => void,
  formatSaveError: (error: unknown) => string
): Promise<VersionedAppSettings | null> {
  onError(formatSaveError(error));
  try {
    return await api.getSettings();
  } catch {
    return null;
  }
}

export async function saveSettingsIntent(
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
    if (!isSettingsRevisionConflict(error)) throw error;
    const latest = await api.getSettings();
    return api.saveSettings({
      settings: mergeAppSettings(latest.settings, partial),
      expectedRevision: latest.revision
    });
  }
}

function isSettingsRevisionConflict(error: unknown) {
  return String(error).includes("settings_revision_conflict");
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
  const settingsLoadPromiseRef = useRef<Promise<VersionedAppSettings | null> | null>(null);
  const settingsLoadGateRef = useRef<SettingsLoadGate | null>(
    isDatabaseReady ? createSettingsLoadGate() : null
  );
  const settingsLoadPendingRef = useRef(false);
  const settingsLoadFailedRef = useRef(false);
  const loadEpochRef = useRef(0);
  const writeEpochRef = useRef(0);
  const settingsLoadedRef = useRef(!isDatabaseReady);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isDatabaseReady) return;

    let cancelled = false;
    const loadEpoch = loadEpochRef.current + 1;
    loadEpochRef.current = loadEpoch;
    const loadWriteEpoch = writeEpochRef.current;
    settingsLoadPendingRef.current = true;
    settingsLoadFailedRef.current = false;
    settingsLoadedRef.current = false;

    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const loaded = await tauriApi.getSettings();
        if (!cancelled && loadEpochRef.current === loadEpoch) {
          settingsRevisionRef.current = loaded.revision;
          persistedSettingsRef.current = loaded.settings;
          settingsLoadPendingRef.current = false;
          settingsLoadFailedRef.current = false;
          settingsLoadedRef.current = true;
          if (writeEpochRef.current === loadWriteEpoch && mountedRef.current) {
            latestSettingsRef.current = loaded.settings;
            setSettings(loaded.settings);
          }
        } else if (!cancelled && loadEpochRef.current === loadEpoch) {
          settingsLoadPendingRef.current = false;
          settingsLoadedRef.current = true;
        }
        return loaded;
      } catch (error) {
        if (!cancelled && loadEpochRef.current === loadEpoch) {
          settingsLoadPendingRef.current = false;
          settingsLoadFailedRef.current = true;
          settingsLoadedRef.current = true;
          onError(formatLoadError(error));
        }
        return null;
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    }

    const loadPromise = loadSettings();
    settingsLoadPromiseRef.current = loadPromise;
    void loadPromise.then((loaded) => {
      if (settingsLoadPromiseRef.current === loadPromise) {
        settingsLoadGateRef.current?.resolve(loaded);
      }
    });
    void loadPromise;

    return () => {
      cancelled = true;
    };
  }, [formatLoadError, isDatabaseReady, onError]);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      writeEpochRef.current += 1;
      const previousOptimisticSettings = latestSettingsRef.current;
      const nextSettings = mergeAppSettings(previousOptimisticSettings, partial);

      latestSettingsRef.current = nextSettings;
      setSettings(nextSettings);

      const saveIntent = async () => {
        let initialLoad: VersionedAppSettings | null = null;
        if (isDatabaseReady && !settingsLoadedRef.current) {
          const loadPromise = settingsLoadPromiseRef.current ?? settingsLoadGateRef.current?.promise;
          if (loadPromise) {
            initialLoad = await loadPromise;
          }
          // A load may resolve after its effect has been cleaned up (for
          // example, while React is remounting the tree). The promise result
          // is still the only safe persistence base for this queued intent;
          // accept it here rather than falling through to a false
          // `settings_load_required` failure.
          if (initialLoad && !settingsLoadedRef.current) {
            persistedSettingsRef.current = initialLoad.settings;
            settingsRevisionRef.current = initialLoad.revision;
            settingsLoadPendingRef.current = false;
            settingsLoadFailedRef.current = false;
            settingsLoadedRef.current = true;
          }
        }
        if (settingsLoadFailedRef.current || !settingsLoadedRef.current) {
          throw new Error("settings_load_required");
        }
        try {
          const saved = await saveSettingsIntent(
            tauriApi,
            {
              settings: persistedSettingsRef.current,
              revision: settingsRevisionRef.current
            },
            partial
          );
          persistedSettingsRef.current = saved.settings;
          settingsRevisionRef.current = saved.revision;
          if (mountedRef.current && requestId === saveRequestIdRef.current) {
            latestSettingsRef.current = saved.settings;
            setSettings(saved.settings);
          }
          return saved.settings;
        } catch (error) {
            const latest = await reconcileFailedSettingsSave(
              tauriApi,
              error,
              onError,
              formatSaveError
            );
            if (latest) {
              persistedSettingsRef.current = latest.settings;
              settingsRevisionRef.current = latest.revision;
            }
            if (mountedRef.current && requestId === saveRequestIdRef.current) {
              latestSettingsRef.current = persistedSettingsRef.current;
              setSettings(persistedSettingsRef.current);
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
    [formatSaveError, isDatabaseReady, onError]
  );

  return {
    settings,
    isLoadingSettings: isLoadingSettings || (isDatabaseReady && !settingsLoadedRef.current),
    updateSettings
  };
}
