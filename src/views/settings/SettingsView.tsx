import { useEffect, useState, type KeyboardEvent } from "react";
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
import type {
  CloseBehavior,
  FolderNamingLanguage,
  RestoreRetentionDays,
  ScanRootSetting,
  SearchRootSetting,
  SearchScopeMode
} from "../../types/domain";
import { acceleratorFromKeyboardEvent, formatHotkeyLabel, isValidSearchHotkey } from "../../utils/hotkeys";
import { compactPath } from "../../utils/viewHelpers";
import { buttonIconDanger, buttonSecondary, cn, glassButton, inputSurface } from "../../utils/tw";
import {
  ControlGroup,
  NoticeBanner,
  SegmentedControl,
  StateBlock,
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

export function SettingsView() {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
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
      searchHotkey,
      searchScopeMode,
      customSearchRoots
    },
    setFolderNamingLanguage,
    setDefaultScanFolders,
    setRestoreRetentionDays,
    setLaunchAtLogin,
    setSearchHotkey,
    setSearchScopeMode,
    setCustomSearchRoots
  } = useSettingsContext();
  const scanPath = useScanManagerStore((state) => state.scanPath);
  const globalHotkeyError = useAppStore((state) => state.globalHotkeyError);
  const setGlobalHotkeyError = useAppStore((state) => state.setGlobalHotkeyError);
  const hotkey = formatHotkeyLabel(searchHotkey, platform);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsStatusTone, setSettingsStatusTone] = useState<StatusTone>("success");
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [recordingHotkeyPreview, setRecordingHotkeyPreview] = useState("");

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
      showStatus(t("settingsSavedInline"));
    }
  }

  async function setSearchRootEnabled(root: SearchRootSetting, enabled: boolean) {
    const saved = await setCustomSearchRoots(toggleSearchRoot(customSearchRoots, root.id, enabled));
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function deleteSearchRoot(root: SearchRootSetting) {
    const saved = await setCustomSearchRoots(removeSearchRoot(customSearchRoots, root.id));
    if (saved) {
      showStatus(t("settingsSavedInline"));
    }
  }

  async function scanRootNow(root: ScanRootSetting) {
    await scanPath(root.path);
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

  function handleHotkeyRecording(event: KeyboardEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setIsRecordingHotkey(false);
      setRecordingHotkeyPreview("");
      return;
    }

    const accelerator = acceleratorFromKeyboardEvent(event.nativeEvent, platform);
    setRecordingHotkeyPreview(accelerator ? formatHotkeyLabel(accelerator, platform) : event.key);
    if (!accelerator) {
      showStatus(t("hotkeyInvalid"), "warning");
      return;
    }
    void updateSearchHotkey(accelerator);
  }

  return (
    <div className={cn(pageSurface, "grid gap-4 overflow-auto")}>
      <section className={cn(panelSurface, "grid gap-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title={t("settings")} body={t("settingsDesc")} />
          {settingsStatus && settingsStatusTone === "success" ? (
            <span className={cn(quietText, "rounded-full border border-[var(--line)] bg-white/24 px-3 py-1.5 dark:bg-white/5")} aria-live="polite">
              {settingsStatus}
            </span>
          ) : null}
        </div>

        {settingsStatus && settingsStatusTone === "warning" ? (
          <NoticeBanner tone="warning">{settingsStatus}</NoticeBanner>
        ) : null}

        <ControlGroup title={t("settingsAppearanceLanguage")} description={t("settingsAppearanceLanguageDesc")}>
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
          <div className={formRow}>
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
              <div key={root.id} className={compactInteractiveRow()}>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 text-left">
                    <strong className="block truncate text-sm">{root.label}</strong>
                    <span className="block truncate text-xs text-[var(--muted)]" title={root.path}>{compactPath(root.path, 72)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button className={toggleButtonClass(root.enabled)} onClick={() => void setScanRootEnabled(root, !root.enabled)} aria-label={root.enabled ? t("disableScanFolder") : t("enableScanFolder")} aria-pressed={root.enabled}><i /></button>
                    <button className={buttonSecondary} onClick={() => void scanRootNow(root)} title={t("scanNow")}>
                      <Play size={14} />
                      <span>{t("scanNow")}</span>
                    </button>
                    <button className={buttonIconDanger} onClick={() => void deleteScanRoot(root)} title={t("deleteScanFolder")} aria-label={t("deleteScanFolder")}>
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

        <ControlGroup title={t("settingsSearch")} description={t("settingsSearchDesc")}>
          <div className={formRow}>
            <div>
              <strong className="block text-sm">{t("searchHotkey")}</strong>
              <span className={metadataText}>{t("searchHotkeyDesc")}</span>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
              <span className="rounded-xl border border-[var(--line)] bg-white/25 px-3 py-1.5 text-sm font-medium text-[var(--ink)] dark:bg-white/5">{hotkey}</span>
              <button className={cn(buttonSecondary, isRecordingHotkey && "border-blue-400/45 bg-blue-500/10 text-blue-700 dark:text-blue-200")} onClick={() => setIsRecordingHotkey(true)}>
                <Keyboard size={14} />
                <span>{t("changeHotkey")}</span>
              </button>
            </div>
          </div>
          {isRecordingHotkey && (
            <NoticeBanner tone="info" title={t("hotkeyCaptureTitle")}>
              <div
                className="mt-2 grid gap-2 rounded-xl border border-dashed border-blue-400/50 bg-blue-500/8 px-3 py-3 outline-none"
                tabIndex={0}
                onKeyDown={handleHotkeyRecording}
              >
                <span>{t("recordingHotkey")}</span>
                <span className={quietText}>{t("hotkeyCaptureCurrent")}: {recordingHotkeyPreview || hotkey}</span>
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
                className={cn(glassButton, searchHotkey === accelerator && "border-blue-400/50 bg-blue-500/10 text-blue-700 dark:text-blue-200")}
                key={accelerator}
                onClick={() => void updateSearchHotkey(accelerator)}
              >
                {formatHotkeyLabel(accelerator, platform)}
              </button>
            ))}
          </div>
          <div className={formRow}>
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
          {searchScopeMode === "custom_roots" && (
            <div className="grid gap-2">
              <div className="flex justify-end">
                <button className={buttonSecondary} onClick={() => void addCustomSearchRoot()}>
                  <FolderPlus size={15} />
                  <span>{t("addSearchFolder")}</span>
                </button>
              </div>
              {customSearchRoots.length ? customSearchRoots.map((root) => (
                <div key={root.id} className={compactInteractiveRow()}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0 text-left">
                      <strong className="block truncate text-sm">{root.label}</strong>
                      <span className="block truncate text-xs text-[var(--muted)]" title={root.path}>{compactPath(root.path, 72)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button className={toggleButtonClass(root.enabled)} onClick={() => void setSearchRootEnabled(root, !root.enabled)} aria-label={root.enabled ? t("disableSearchFolder") : t("enableSearchFolder")} aria-pressed={root.enabled}><i /></button>
                      <button className={buttonIconDanger} onClick={() => void deleteSearchRoot(root)} title={t("deleteSearchFolder")} aria-label={t("deleteSearchFolder")}>
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
          <span className={quietText}>{t("searchScopeDoesNotChangeLibrary")}</span>
        </ControlGroup>

        <ControlGroup title={t("settingsSafetyRestore")} description={t("settingsSafetyRestoreDesc")}>
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
            label={t("launchAtLogin")}
            description={t("launchAtLoginDesc")}
            checked={launchAtLogin}
            onChange={(next) => void updateLaunchAtLogin(next)}
          />
        </ControlGroup>

        <details className={cn(formSection, "group")}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">{t("settingsDeveloperRelease")}</summary>
          <div className="mt-3 grid gap-3">
            <p className={metadataText}>{t("developerReleaseDesc")}</p>
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
  );
}

function toggleButtonClass(enabled: boolean) {
  return cn(
    "relative h-7 w-12 rounded-full border border-[var(--line)] bg-slate-300/50 transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 [&_i]:absolute [&_i]:left-1 [&_i]:top-1 [&_i]:h-5 [&_i]:w-5 [&_i]:rounded-full [&_i]:bg-white [&_i]:shadow-sm [&_i]:transition",
    enabled && "bg-blue-500 [&_i]:translate-x-5"
  );
}
