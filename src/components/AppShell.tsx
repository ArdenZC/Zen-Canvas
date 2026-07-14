import {
  Archive,
  Clock3,
  Cloud,
  Cpu,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Radar,
  Search,
  Settings,
  SlidersHorizontal,
  Square,
  TriangleAlert,
  X
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { CommandModal } from "./CommandModal";
import { ViewErrorBoundary } from "./ErrorBoundary";
import { AmbientMesh, CloseChoiceDialog, ZenMark } from "./ShellChrome";
import { requestSettingsSection } from "./spotlight/commandRegistry";
import { useChromeContext, useSettingsContext } from "../contexts/AppContexts";
import { resolveEffectiveSearchScope } from "../hooks/useAppSettings";
import { hideToBackground } from "../hooks/useWindowBehavior";
import { useAppStore } from "../store/useAppStore";
import { useFileLibraryStore } from "../store/useFileLibraryStore";
import { useOrganizeDecisionStore } from "../store/useOrganizeDecisionStore";
import { useOperationQueueStore } from "../store/useOperationQueueStore";
import { resolveAIProcessingMode, useAIProcessingModeStore, type AIProcessingModeState } from "../store/useAIProcessingModeStore";
import type { AppSettings, DashboardStats, LibraryScope } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { formatDate } from "../utils/format";
import { cn, statusToast, toastTone } from "../utils/tw";
import { compactPath, libraryScopeLabel, readableError } from "../utils/viewHelpers";
import { PageHeader, pageFrame, softPanel, viewStage } from "../views/shared/ui";
import { organizeScopeKey } from "../views/organize/organizeModel";
import { APP_SHELL_CONTENT_ID, ModalHost } from "./modal/ModalPortal";

const ScannerView = lazy(() => import("../views/scanner/ScannerView").then((module) => ({ default: module.ScannerView })));
const StorageCleanupView = lazy(() => import("../views/cleanup/StorageCleanupView").then((module) => ({ default: module.StorageCleanupView })));
const HubView = lazy(() => import("../views/hub/HubView").then((module) => ({ default: module.HubView })));
const VaultView = lazy(() => import("../views/vault/VaultView").then((module) => ({ default: module.VaultView })));
const TimelineView = lazy(() => import("../views/timeline/TimelineView").then((module) => ({ default: module.TimelineView })));
const RulesView = lazy(() => import("../views/rules/RulesView").then((module) => ({ default: module.RulesView })));
const RestoreView = lazy(() => import("../views/restore/RestoreView").then((module) => ({ default: module.RestoreView })));
const SettingsView = lazy(() => import("../views/settings/SettingsView").then((module) => ({ default: module.SettingsView })));

const appRoot =
  cn(pageFrame, "relative h-screen min-h-0 min-w-0 bg-[var(--zc-canvas)] text-[var(--zc-text-primary)]");
const searchWindowRoot =
  "relative h-full w-full overflow-hidden bg-transparent text-[var(--zc-text-primary)]";
const titlebar =
  "relative z-30 grid h-12 grid-cols-[228px_minmax(0,1fr)_228px] items-center border-b border-[var(--zc-divider)] bg-[var(--zc-titlebar)] px-4 backdrop-blur-xl [-webkit-app-region:drag] max-[1100px]:grid-cols-[176px_minmax(0,1fr)_176px] max-[720px]:grid-cols-[1fr_auto]";
const noDrag = "[-webkit-app-region:no-drag]";
const spotlightButton =
  "mx-auto grid h-8 w-[min(42vw,440px)] min-w-64 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-full border border-[var(--zc-control-border)] bg-[var(--zc-surface-subtle)] px-3 text-xs text-[var(--zc-text-secondary)] shadow-sm transition-[background,border-color,box-shadow,color] duration-[var(--zc-duration-fast)] hover:border-[var(--zc-control-border-hover)] hover:bg-[var(--zc-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)] [&_kbd]:rounded-md [&_kbd]:border [&_kbd]:border-[var(--zc-divider)] [&_kbd]:bg-[var(--zc-surface)] [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[11px] [&_kbd]:font-medium [&_kbd]:text-[var(--zc-text-tertiary)]";
const workspaceShell = "relative z-10 grid min-h-0 flex-1 grid-cols-[228px_minmax(0,1fr)] max-[1100px]:grid-cols-[176px_minmax(0,1fr)]";
const sidebarClass =
  "flex min-h-0 flex-col gap-5 border-r border-[var(--zc-divider)] bg-[var(--zc-sidebar)] px-4 py-5 backdrop-blur-xl";
const navItemBase =
  "relative flex min-h-10 w-full items-center gap-3 rounded-[var(--zc-radius-control)] border border-transparent px-3 py-2 text-left text-sm font-medium text-[var(--zc-text-secondary)] transition-[background,border-color,color] duration-[var(--zc-duration-fast)] before:absolute before:left-0 before:top-2 before:h-6 before:w-0.5 before:rounded-full before:bg-[var(--zc-primary)] before:opacity-0 hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";
const navItemActive = "bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)] before:opacity-100";
const workspaceClass = "flex min-h-0 min-w-[720px] flex-col overflow-hidden px-5 py-5 max-[1100px]:min-w-0 max-[1100px]:px-3";
const viewStageClass = viewStage;
const windowsControlButton =
  "grid h-12 w-11 place-items-center text-[var(--zc-text-secondary)] transition-[background,color] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--zc-focus-ring)]";
const windowsCloseButton =
  "grid h-12 w-11 place-items-center text-[var(--zc-text-secondary)] transition-[background,color] hover:bg-[var(--zc-window-close-hover)] hover:text-[var(--zc-window-close-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--zc-focus-ring)]";
const macControlButton = "grid h-6 w-6 place-items-center rounded-full";
const navGroupTitle = "px-3 pt-2 text-[11px] font-semibold text-[var(--zc-text-tertiary)]";

type NavItem = { id: View; label: string; icon: typeof Radar };
type NavGroup = { id: "primary" | "advanced"; label: string; items: NavItem[] };

export function AppShell() {
  const {
    isSearchMode,
    isWindows,
    setIsCommandOpen,
    hotkeyLabel,
    view,
    isCommandOpen,
    isCloseChoiceOpen,
    onCancelCloseChoice,
    resolveCloseChoice,
    t
  } = useChromeContext();
  const stats = useFileLibraryStore((state) => state.stats);
  const scope = useFileLibraryStore((state) => state.scope);
  const decisions = useOrganizeDecisionStore((state) => state.decisions);
  const organizeFiles = useFileLibraryStore((state) => state.organizeQueue);
  const previewActionCount = organizePendingCount(scope, organizeFiles.map((file) => file.id), decisions);
  const executionIntent = useOperationQueueStore((state) => state.executionIntent);
  const spotlightTriggerRef = useRef<HTMLButtonElement | null>(null);

  if (isSearchMode) return <SearchWindow />;

  const groups = navGroups(t);
  const activeLabel = view === "rules"
    ? t("automationWorkspaceTitle")
    : groups.flatMap((group) => group.items).find((item) => item.id === view)?.label ?? viewLabel(view, t);
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));
  const headingDescription = viewDescription(view, stats, scope, scopeText, view === "preview" && executionIntent?.source === "organize" ? executionIntent.allowedPreviewIds.size : previewActionCount, t);

  return (
    <div className={appRoot}>
      <AmbientMesh />
      <div id={APP_SHELL_CONTENT_ID} className="contents">
      <header className={titlebar}>
        <div className="flex items-center justify-start">
          {!isWindows ? <MacWindowControls /> : null}
        </div>
        <div className="flex items-center justify-center">
          <button ref={spotlightTriggerRef} className={cn(spotlightButton, noDrag)} onClick={() => setIsCommandOpen(true)}>
            <Search size={15} className="text-[var(--zc-primary)]" />
            <span className="min-w-0 truncate text-left">{t("globalSearch")}</span>
            <kbd>{hotkeyLabel}</kbd>
          </button>
        </div>
        <div className="flex items-center justify-end">
          {isWindows ? <WindowsControls /> : null}
        </div>
      </header>
      <div className={workspaceShell}>
        <Sidebar groups={groups} />
        <main className={workspaceClass}>
          <ShellViewHeading view={view} activeLabel={activeLabel} headingDescription={headingDescription} />
          <ToastContainer />
          <div className={viewStageClass}>
            <ViewErrorBoundary key={view}>
              <AppViewContent />
            </ViewErrorBoundary>
          </div>
        </main>
      </div>
      {isCommandOpen && <CommandLauncher restoreFocusRef={spotlightTriggerRef} />}
      {isCloseChoiceOpen && (
        <CloseChoiceDialog t={t} onCancel={onCancelCloseChoice} onChoose={resolveCloseChoice} />
      )}
      </div>
      <ModalHost />
    </div>
  );
}

function SearchWindow() {
  return (
    <div className={searchWindowRoot}>
      <CommandLauncher standalone />
    </div>
  );
}

function CommandLauncher({
  standalone = false,
  restoreFocusRef
}: {
  standalone?: boolean;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const { commandInputRef, setView, setIsCommandOpen, platform, onError, t } = useChromeContext();
  const { settings } = useSettingsContext();
  const currentLibraryScope = useFileLibraryStore((state) => state.scope);
  const setSelectedFileId = useFileLibraryStore((state) => state.setSelectedFileId);
  const effectiveSearchScope = useMemo(
    () => resolveEffectiveSearchScope(settings, currentLibraryScope),
    [currentLibraryScope, settings]
  );
  const searchScopeLabel = commandSearchScopeLabel(settings, currentLibraryScope, t);
  const searchScopeEmptyMessage = commandSearchScopeEmptyMessage(settings, currentLibraryScope, t);

  function closeCommand() {
    setIsCommandOpen(false);
    if (standalone) {
      void hideToBackground((error) => {
        onError(`${t("windowActionFailed")}：${readableError(error)}`);
      });
    }
  }

  return (
    <CommandModal
      inputRef={commandInputRef}
      setView={setView}
      setSelectedFileId={setSelectedFileId}
      onClose={closeCommand}
      platform={platform}
      t={t}
      onError={onError}
      searchScope={effectiveSearchScope}
      searchScopeLabel={searchScopeLabel}
      searchScopeEmptyMessage={searchScopeEmptyMessage}
      standalone={standalone}
      restoreFocusRef={restoreFocusRef}
    />
  );
}

function commandSearchScopeLabel(settings: AppSettings, currentLibraryScope: LibraryScope, t: Translator) {
  if (settings.searchScopeMode === "all") return t("searchScopeAllIndexedLabel");
  if (settings.searchScopeMode === "current_scan") {
    const currentLabel = libraryScopeLabel(currentLibraryScope, t("searchScopeAllIndexed"), t("noFolderSelected"));
    return currentLibraryScope.kind === "all"
      ? t("searchScopeAllIndexedLabel")
      : `${t("searchScopeLabel")}: ${t("searchScopeCurrentScan")}${currentLibraryScope.roots.length ? ` · ${currentLabel}` : ""}`;
  }

  const enabledRoots = settings.customSearchRoots.filter((root) => root.enabled && root.path.trim());
  if (!enabledRoots.length) return `${t("searchScopeLabel")}: ${t("searchScopeCustomEmpty")}`;
  const first = compactPath(enabledRoots[0].path, 42);
  const suffix = enabledRoots.length > 1 ? ` +${enabledRoots.length - 1}` : "";
  return `${t("searchScopeLabel")}: ${t("searchScopeCustomRoots")}: ${first}${suffix}`;
}

function commandSearchScopeEmptyMessage(settings: AppSettings, currentLibraryScope: LibraryScope, t: Translator) {
  if (settings.searchScopeMode === "custom_roots" && !settings.customSearchRoots.some((root) => root.enabled && root.path.trim())) {
    return t("searchScopeCustomEmpty");
  }
  if (
    settings.searchScopeMode === "current_scan" &&
    (currentLibraryScope.kind !== "current_scan" || currentLibraryScope.roots.length === 0)
  ) {
    return t("searchScopeCurrentScanEmpty");
  }
  return "";
}

function MacWindowControls() {
  const { handleWindowAction, t } = useChromeContext();

  return (
    <div className={cn("flex items-center gap-1", noDrag)} aria-label="Window controls">
      <button className={macControlButton} onClick={() => handleWindowAction("close")} aria-label={t("close")}>
        <span className="h-3 w-3 rounded-full bg-[var(--zc-window-mac-close)] shadow-sm" />
      </button>
      <button className={macControlButton} onClick={() => handleWindowAction("minimize")} aria-label={t("minimize")}>
        <span className="h-3 w-3 rounded-full bg-[var(--zc-window-mac-minimize)] shadow-sm" />
      </button>
      <button className={macControlButton} onClick={() => handleWindowAction("maximize")} aria-label={t("maximize")}>
        <span className="h-3 w-3 rounded-full bg-[var(--zc-window-mac-maximize)] shadow-sm" />
      </button>
    </div>
  );
}

function WindowsControls() {
  const { handleWindowAction, t } = useChromeContext();

  return (
    <div className={cn("flex h-12 items-center", noDrag)} aria-label="Window controls">
      <button className={windowsControlButton} onClick={() => handleWindowAction("minimize")} aria-label={t("minimize")}>
        <Minus size={15} strokeWidth={1.6} />
      </button>
      <button className={windowsControlButton} onClick={() => handleWindowAction("maximize")} aria-label={t("maximize")}>
        <Square size={12} strokeWidth={1.6} />
      </button>
      <button className={windowsCloseButton} onClick={() => handleWindowAction("close")} aria-label={t("close")}>
        <X size={16} strokeWidth={1.6} />
      </button>
    </div>
  );
}

function Sidebar({ groups }: { groups: NavGroup[] }) {
  const { view, setView, t } = useChromeContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const organizeFiles = useFileLibraryStore((state) => state.organizeQueue);
  const decisions = useOrganizeDecisionStore((state) => state.decisions);
  const previewActionCount = organizePendingCount(scope, organizeFiles.map((file) => file.id), decisions);
  const aiModeStatus = useAIProcessingModeStore((state) => state.status);
  const aiModeSettings = useAIProcessingModeStore((state) => state.settings);
  const aiModeError = useAIProcessingModeStore((state) => state.error);
  const loadAIProcessingMode = useAIProcessingModeStore((state) => state.load);

  useEffect(() => {
    void loadAIProcessingMode();
  }, [loadAIProcessingMode]);

  function openAISettings() {
    openAIProcessingModeSettings(setView, requestSettingsSection);
  }

  return (
    <aside className={sidebarClass}>
      <div className="flex items-center gap-3">
        <ZenMark />
        <div>
          <strong className="block text-base font-semibold">{t("appName")}</strong>
          <span className="block text-xs text-[var(--zc-text-secondary)]">{t("appSubtitle")}</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-3">
        {groups.map((group) => (
          <section className="grid gap-1 border-t border-[var(--zc-divider)] pt-3 first:border-t-0 first:pt-0" key={group.id}>
            <span className={navGroupTitle}>{group.label}</span>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={cn(navItemBase, view === item.id && navItemActive)}
                onClick={() => setView(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === "organize" && previewActionCount > 0 && (
                  <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--zc-warning-soft)] px-1 text-[11px] font-medium text-[var(--zc-warning-text)]" aria-label={t("organizePendingBadge").replace("{count}", previewActionCount.toLocaleString())}>
                    {previewActionCount}
                  </span>
                )}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <AIProcessingModeStatus
        state={{ status: aiModeStatus, settings: aiModeSettings, error: aiModeError }}
        t={t}
        onCheckSettings={openAISettings}
      />
    </aside>
  );
}

export function ShellViewHeading({
  view,
  activeLabel,
  headingDescription,
  actions
}: {
  view: View;
  activeLabel: string;
  headingDescription: string;
  actions?: React.ReactNode;
}) {
  if (view === "scanner") return null;

  return <PageHeader title={activeLabel} description={headingDescription} actions={actions} />;
}

function ToastContainer() {
  const toast = useAppStore((state) => state.toast);
  const clearToast = useAppStore((state) => state.clearToast);
  const { view } = useChromeContext();
  const previousViewRef = useRef(view);

  useEffect(() => {
    if (!toast || toast.type === "error") return;
    const timeout = window.setTimeout(clearToast, toast.type === "success" ? 2200 : 3200);
    return () => window.clearTimeout(timeout);
  }, [clearToast, toast]);

  useEffect(() => {
    if (previousViewRef.current !== view) {
      previousViewRef.current = view;
      if (toast?.type === "success") clearToast();
    }
  }, [clearToast, toast, view]);

  if (!toast) return null;

  if (toast.type === "success") {
    return (
      <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-full border border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] px-3 py-2 text-xs font-medium text-[var(--zc-success-text)] shadow-[var(--zc-shadow-raised)] backdrop-blur-xl" role="status">
        {toast.message}
      </div>
    );
  }

  return (
    <div className={cn(statusToast, toastTone(toast.type))} role={toast.type === "error" ? "alert" : "status"}>
      {toast.message}
    </div>
  );
}

function AppViewContent() {
  const { view, t } = useChromeContext();

  let content;
  if (view === "scanner") content = <ScannerView />;
  else if (view === "cleanup") content = <StorageCleanupView />;
  else if (view === "organize") content = <HubView />;
  else if (view === "library") content = <VaultView />;
  else if (view === "preview") content = <TimelineView />;
  else if (view === "rules") content = <RulesView />;
  else if (view === "restore") content = <RestoreView />;
  else content = <SettingsView />;
  return <Suspense fallback={<div className={softPanel}>{t("loading")}</div>}>{content}</Suspense>;
}

function organizePendingCount(scope: LibraryScope, fileIds: string[], decisions: Record<string, { state: string }>) {
  const scopeKey = organizeScopeKey(scope);
  return fileIds.filter((fileId) => {
    const state = decisions[`${scopeKey}::${fileId}`]?.state;
    return state === "undecided" || state === "needs-review";
  }).length;
}

export function AIProcessingModeStatus({
  state,
  t,
  onCheckSettings
}: {
  state: AIProcessingModeState;
  t: Translator;
  onCheckSettings?: () => void;
}) {
  const mode = sidebarMode(state, t);
  return (
    <div className={cn(softPanel, "mt-auto flex items-start gap-3 p-3 text-sm")} data-ai-processing-mode={resolveAIProcessingMode(state)}>
      <AIProcessingModeIcon mode={mode.id} />
      <div className="min-w-0 flex-1">
        <strong className="block text-sm text-[var(--zc-text-primary)]">{mode.title}</strong>
        <span className="block text-xs leading-5 text-[var(--zc-text-secondary)]">{mode.description}</span>
        {mode.id === "failed" && onCheckSettings ? (
          <button
            className="mt-1 rounded px-1 py-0.5 text-xs font-semibold text-[var(--zc-warning-text)] hover:bg-[var(--zc-warning-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]"
            onClick={onCheckSettings}
          >
            {t("modeCheckSettings")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AIProcessingModeIcon({ mode }: { mode: ReturnType<typeof resolveAIProcessingMode> }) {
  const iconClass = "mt-0.5 shrink-0";
  if (mode === "loading") {
    return <LoaderCircle data-ai-mode-icon="loader" size={17} className={cn(iconClass, "animate-spin text-[var(--zc-info-text)]")} />;
  }
  if (mode === "failed") {
    return <TriangleAlert data-ai-mode-icon="warning" size={17} className={cn(iconClass, "text-[var(--zc-warning-text)]")} />;
  }
  if (mode === "disabled") {
    return <LockKeyhole data-ai-mode-icon="disabled" size={17} className={cn(iconClass, "text-[var(--zc-neutral-text)]")} />;
  }
  if (mode === "local") {
    return <Cpu data-ai-mode-icon="local" size={17} className={cn(iconClass, "text-[var(--zc-success-text)]")} />;
  }
  return <Cloud data-ai-mode-icon="cloud" size={17} className={cn(iconClass, "text-[var(--zc-info-text)]")} />;
}

export function openAIProcessingModeSettings(
  setView: (view: View) => void,
  openSection: (sectionId: string) => void
) {
  setView("settings");
  openSection("settings-ai");
}

function viewDescription(
  view: View,
  stats: DashboardStats,
  scope: LibraryScope,
  scopeText: string,
  previewActionCount: number,
  t: Translator
): string {
  switch (view) {
    case "scanner":
      return `${t("lastScan")}: ${stats.lastScannedAt ? formatDate(stats.lastScannedAt) : t("notScannedYet")}`;
    case "cleanup":
      return t("viewDescCleanup");
    case "organize":
      return `${t("currentOrganizeScope")}: ${scopeText} · ${t("viewDescOrganize")}`;
    case "library":
      return fileLibraryHeadingDescription(scope, stats.totalFiles, scopeText, t);
    case "preview":
      return previewActionCount > 0
        ? `${previewActionCount.toLocaleString()} ${t("items")} · ${t("viewDescPreview")}`
        : t("viewDescPreview");
    case "rules":
      return t("viewDescRules");
    case "restore":
      return t("viewDescRestore");
    case "settings":
      return t("viewDescSettings");
  }
}

function navGroups(t: Translator): NavGroup[] {
  return [
    {
      id: "primary",
      label: t("navPrimary"),
      items: [
        { id: "scanner", label: t("overview"), icon: Radar },
        { id: "library", label: t("fileLibrary"), icon: Archive },
        { id: "organize", label: t("organizeSuggestions"), icon: LayoutGrid },
        { id: "restore", label: t("history"), icon: Clock3 }
      ]
    },
    {
      id: "advanced",
      label: t("navAdvanced"),
      items: [
        { id: "rules", label: t("automation"), icon: SlidersHorizontal },
        { id: "settings", label: t("settings"), icon: Settings }
      ]
    }
  ];
}

export function fileLibraryHeadingDescription(
  scope: LibraryScope,
  scopedTotal: number,
  scopeText: string,
  t: Translator
) {
  const prefix = `${t("currentScope")}: ${scopeText}`;
  return scope.kind === "current_scan" && scope.roots.length === 0
    ? prefix
    : `${prefix} · ${scopedTotal.toLocaleString()} ${t("files")}`;
}

function viewLabel(view: View, t: Translator) {
  if (view === "cleanup") return t("storageCleanup");
  if (view === "preview") return t("previewExecute");
  return t("overview");
}

function sidebarMode(
  state: AIProcessingModeState,
  t: Translator
) {
  const mode = resolveAIProcessingMode(state);
  if (mode === "loading") return { id: mode, title: t("modeLoading"), description: t("modeLoadingDesc") };
  if (mode === "failed") return { id: mode, title: t("modeFailed"), description: t("modeFailedDesc") };
  if (mode === "disabled") return { id: mode, title: t("modeAIDisabled"), description: t("modeAIDisabledDesc") };
  if (mode === "local") return { id: mode, title: t("modeAILocal"), description: t("modeAILocalDesc") };
  return { id: mode, title: t("modeAICloud"), description: t("modeAICloudDesc") };
}
