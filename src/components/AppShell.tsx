import {
  Archive,
  Clock3,
  FolderSearch,
  LayoutGrid,
  ListChecks,
  LockKeyhole,
  Minus,
  Radar,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Square,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { CommandModal } from "./CommandModal";
import { ViewErrorBoundary } from "./ErrorBoundary";
import { AmbientMesh, CloseChoiceDialog, TitlebarTools, ZenMark } from "./ShellChrome";
import { useChromeContext, useSettingsContext } from "../contexts/AppContexts";
import { resolveEffectiveSearchScope } from "../hooks/useAppSettings";
import { hideToBackground } from "../hooks/useWindowBehavior";
import { useAppStore } from "../store/useAppStore";
import { useFileLibraryStore } from "../store/useFileLibraryStore";
import { useOperationQueueStore } from "../store/useOperationQueueStore";
import { useScanManagerStore } from "../store/useScanManagerStore";
import type { AppSettings, DashboardStats, LibraryScope } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { formatDate } from "../utils/format";
import { cn, glassButton, glassButtonPrimary, statusToast, toastTone } from "../utils/tw";
import { compactPath, libraryScopeLabel, readableError } from "../utils/viewHelpers";
import { PageHeader, inlineActions, pageFrame, softPanel, viewStage } from "../views/shared/ui";
import {
  HubView,
  RestoreView,
  RulesView,
  ScannerView,
  SettingsView,
  TimelineView,
  VaultView
} from "../views";

const appRoot =
  cn(pageFrame, "relative h-screen min-h-[680px] min-w-[980px] bg-[var(--bg)] text-[var(--ink)]");
const searchWindowRoot =
  "relative h-full w-full overflow-hidden bg-transparent text-[var(--ink)]";
const titlebar =
  "relative z-30 grid h-12 grid-cols-[minmax(208px,240px)_1fr_minmax(208px,240px)] items-center border-b border-[var(--line-dark)] bg-[var(--surface)] px-4 backdrop-blur-xl [-webkit-app-region:drag]";
const noDrag = "[-webkit-app-region:no-drag]";
const spotlightButton =
  "mx-auto grid h-8 w-[min(42vw,420px)] min-w-64 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-full border border-[var(--line-dark)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--muted)] shadow-sm transition-[background,border-color,box-shadow,color] hover:border-blue-400/24 hover:bg-[var(--surface-strong)] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.055)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/50 [&_kbd]:rounded-md [&_kbd]:border [&_kbd]:border-[var(--line-dark)] [&_kbd]:bg-[var(--surface-soft)] [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-[11px] [&_kbd]:font-medium [&_kbd]:text-[var(--quiet)]";
const workspaceShell = "relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(220px,248px)_minmax(0,1fr)]";
const sidebarClass =
  "flex min-h-0 flex-col gap-5 border-r border-[var(--line-dark)] bg-[var(--surface)] px-4 py-5 backdrop-blur-xl";
const navItemBase =
  "flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left text-sm font-medium text-[var(--muted)] transition-[background,border-color,box-shadow,color] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] dark:hover:bg-slate-700/70";
const navItemActive = "border-blue-400/24 bg-blue-500/9 text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]";
const workspaceClass = "flex min-h-0 min-w-0 flex-col overflow-hidden px-5 py-5";
const viewStageClass = viewStage;
const windowsControlButton =
  "grid h-8 w-10 place-items-center text-[var(--muted)] transition-[background,color] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500/45";
const windowsCloseButton =
  "grid h-8 w-10 place-items-center text-[var(--muted)] transition-[background,color] hover:bg-red-500/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-400/60";
const macControlButton = "grid h-6 w-6 place-items-center rounded-full";
const navGroupTitle = "px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--quiet)]";

type NavItem = { id: View; label: string; icon: typeof Radar };
type NavGroup = { id: "workspace" | "system"; label: string; items: NavItem[] };

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
  const previewActionCount = useOperationQueueStore((state) => state.previewActionCount);

  if (isSearchMode) return <SearchWindow />;

  const groups = navGroups(t);
  const activeLabel = groups.flatMap((group) => group.items).find((item) => item.id === view)?.label ?? t("spaceScan");
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));
  const headingDescription = viewDescription(view, stats, scopeText, previewActionCount, t);

  return (
    <div className={appRoot}>
      <AmbientMesh />
      <header className={titlebar}>
        <div className="flex items-center justify-start">
          {!isWindows ? <MacWindowControls /> : <ChromeTools />}
        </div>
        <div className="flex items-center justify-center">
          <button className={cn(spotlightButton, noDrag)} onClick={() => setIsCommandOpen(true)}>
            <Search size={15} className="text-blue-500/85" />
            <span className="min-w-0 truncate text-left">{t("globalSearch")}</span>
            <kbd>{hotkeyLabel}</kbd>
          </button>
        </div>
        <div className="flex items-center justify-end">
          {!isWindows ? <ChromeTools /> : <WindowsControls />}
        </div>
      </header>
      <div className={workspaceShell}>
        <Sidebar groups={groups} />
        <main className={workspaceClass}>
          <ViewHeading activeLabel={activeLabel} headingDescription={headingDescription} />
          <ToastContainer />
          <div className={viewStageClass}>
            <ViewErrorBoundary key={view}>
              <AppViewContent />
            </ViewErrorBoundary>
          </div>
        </main>
      </div>
      {isCommandOpen && <CommandLauncher />}
      {isCloseChoiceOpen && (
        <CloseChoiceDialog t={t} onCancel={onCancelCloseChoice} onChoose={resolveCloseChoice} />
      )}
    </div>
  );
}

function SearchWindow() {
  return (
    <div className={cn(searchWindowRoot, "flex items-start justify-center")}>
      <CommandLauncher standalone />
    </div>
  );
}

function CommandLauncher({ standalone = false }: { standalone?: boolean }) {
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
    />
  );
}

function commandSearchScopeLabel(settings: AppSettings, currentLibraryScope: LibraryScope, t: Translator) {
  if (settings.searchScopeMode === "all") return `${t("searchScopeLabel")}: ${t("searchScopeAllIndexed")}`;
  if (settings.searchScopeMode === "current_scan") {
    const currentLabel = libraryScopeLabel(currentLibraryScope, t("searchScopeAllIndexed"), t("noFolderSelected"));
    return currentLibraryScope.kind === "all"
      ? `${t("searchScopeLabel")}: ${t("searchScopeAllIndexed")}`
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

function ChromeTools() {
  const { language, theme, effectiveTheme, setLanguage, setTheme, t } = useChromeContext();

  return (
    <TitlebarTools
      language={language}
      theme={theme}
      effectiveTheme={effectiveTheme}
      setLanguage={setLanguage}
      setTheme={setTheme}
      t={t}
    />
  );
}

function MacWindowControls() {
  const { handleWindowAction, t } = useChromeContext();

  return (
    <div className={cn("flex items-center gap-1", noDrag)} aria-label="Window controls">
      <button className={macControlButton} onClick={() => handleWindowAction("close")} aria-label={t("close")}>
        <span className="h-3 w-3 rounded-full bg-red-500 shadow-sm" />
      </button>
      <button className={macControlButton} onClick={() => handleWindowAction("minimize")} aria-label={t("minimize")}>
        <span className="h-3 w-3 rounded-full bg-amber-400 shadow-sm" />
      </button>
      <button className={macControlButton} onClick={() => handleWindowAction("maximize")} aria-label={t("maximize")}>
        <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
      </button>
    </div>
  );
}

function WindowsControls() {
  const { handleWindowAction, t } = useChromeContext();

  return (
    <div className={cn("flex items-center overflow-hidden rounded-lg border border-[var(--line-dark)] bg-[var(--surface-soft)]", noDrag)} aria-label="Window controls">
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
  const previewActionCount = useOperationQueueStore((state) => state.previewActionCount);

  return (
    <aside className={sidebarClass}>
      <div className="flex items-center gap-3">
        <ZenMark />
        <div>
          <strong className="block text-base font-semibold">{t("appName")}</strong>
          <span className="block text-xs text-[var(--muted)]">{t("appSubtitle")}</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-3">
        {groups.map((group) => (
          <section className="grid gap-1 border-t border-[var(--line-dark)] pt-3 first:border-t-0 first:pt-0" key={group.id}>
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
                {item.id === "preview" && previewActionCount > 0 && (
                  <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/10 px-1 text-[11px] font-medium text-red-600 dark:text-red-300" aria-label={`${previewActionCount} pending`}>
                    {previewActionCount}
                  </span>
                )}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <div className={cn(softPanel, "mt-auto flex items-start gap-3 p-3 text-sm")}>
        <LockKeyhole size={17} className="mt-0.5 text-blue-500/75" />
        <div>
          <strong className="block text-sm text-[var(--ink)]">{t("localOnly")}</strong>
          <span className="block text-xs leading-5 text-[var(--muted)]">{t("privacyLine")}</span>
        </div>
      </div>
    </aside>
  );
}

function ViewHeading({
  activeLabel,
  headingDescription
}: {
  activeLabel: string;
  headingDescription: string;
}) {
  const { view, t } = useChromeContext();
  const isScanning = useScanManagerStore((state) => state.isScanning);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const handleScan = useScanManagerStore((state) => state.handleScan);

  if (view === "scanner") return null;

  return (
    <PageHeader
      title={activeLabel}
      description={headingDescription}
      actions={
        <div className={inlineActions}>
          <button className={glassButton} onClick={handleChooseFolders} disabled={isScanning}>
            <FolderSearch size={17} />
            <span>{t("chooseFolders")}</span>
          </button>
          <button className={glassButtonPrimary} onClick={handleScan} disabled={isScanning}>
            <RefreshCw size={17} className={isScanning ? "animate-spin" : ""} />
            <span>{t("scanCommon")}</span>
          </button>
        </div>
      }
    />
  );
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
      <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-full border border-emerald-400/25 bg-[var(--surface-strong)] px-3 py-2 text-xs font-medium text-emerald-700 shadow-[var(--shadow)] backdrop-blur-xl dark:text-emerald-200" role="status">
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
  const { view } = useChromeContext();

  if (view === "scanner") return <ScannerView />;
  if (view === "organize") return <HubView />;
  if (view === "library") return <VaultView />;
  if (view === "preview") return <TimelineView />;
  if (view === "rules") return <RulesView />;
  if (view === "restore") return <RestoreView />;
  return <SettingsView />;
}

function viewDescription(
  view: View,
  stats: DashboardStats,
  scopeText: string,
  previewActionCount: number,
  t: Translator
): string {
  switch (view) {
    case "scanner":
      return `${t("lastScan")}: ${stats.lastScannedAt ? formatDate(stats.lastScannedAt) : t("notScannedYet")}`;
    case "organize":
      return `${t("currentOrganizeScope")}: ${scopeText} · ${t("viewDescOrganize")}`;
    case "library":
      return `${t("currentScope")}: ${scopeText} · ${stats.totalFiles.toLocaleString()} ${t("files")}`;
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
      id: "workspace",
      label: t("navWorkspace"),
      items: [
        { id: "scanner", label: t("spaceScan"), icon: Radar },
        { id: "organize", label: t("smartDispatch"), icon: LayoutGrid },
        { id: "library", label: t("fileLibrary"), icon: Archive },
        { id: "preview", label: t("previewExecute"), icon: ListChecks }
      ]
    },
    {
      id: "system",
      label: t("navSystem"),
      items: [
        { id: "rules", label: t("ruleEngine"), icon: SlidersHorizontal },
        { id: "restore", label: t("restoreRecords"), icon: Clock3 },
        { id: "settings", label: t("settings"), icon: Settings }
      ]
    }
  ];
}
