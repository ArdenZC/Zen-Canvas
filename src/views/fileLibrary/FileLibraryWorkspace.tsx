import { ArrowLeft, ArrowRight, Grid2X2, List, PanelRightClose, PanelRightOpen } from "lucide-react";
import { lazy, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18nContext } from "../../contexts/AppContexts";
import type { WorkspaceViewMode } from "../../fileWorkspace";
import { useFileLibraryExperience } from "./FileLibraryExperienceProvider";
import type { FileLibraryMode } from "./fileLibraryExperience";
import { ContextPanelPresentationProvider } from "./context/contextPanelPresentation";
import {
  FileLibraryCommandBarSurfaceProvider,
  type FileLibraryCommandBarSurface,
  type FileLibraryCommandBarSurfaceOwner
} from "./fileLibraryCommandBarSurface";
import "./fileLibraryWorkspace.css";

const LibraryMode = lazy(() => import("./library/LibraryMode").then((module) => ({ default: module.LibraryMode })));
const BrowseMode = lazy(() => import("./browse/BrowseMode").then((module) => ({ default: module.BrowseMode })));

type FileLibraryLayout = "large" | "medium" | "compact";

const layoutForWidth = (width: number): FileLibraryLayout => {
  if (width >= 1120) return "large";
  if (width >= 820) return "medium";
  return "compact";
};

export function FileLibraryWorkspace() {
  const { controller, state } = useFileLibraryExperience();
  const { t } = useI18nContext();
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<FileLibraryLayout>("compact");
  const [commandBarSurface, setCommandBarSurface] = useState<FileLibraryCommandBarSurface | null>(null);

  const registerSurface = useCallback((surface: FileLibraryCommandBarSurface) => {
    setCommandBarSurface((current) => current?.owner === surface.owner
      && current.search === surface.search
      && current.actions === surface.actions
      && current.enabled === surface.enabled
      ? current
      : surface);
  }, []);
  const clearSurface = useCallback((owner: FileLibraryCommandBarSurfaceOwner) => {
    setCommandBarSurface((current) => current?.owner === owner ? null : current);
  }, []);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;

    const updateLayout = () => setLayout(layoutForWidth(element.clientWidth));
    updateLayout();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateLayout);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const history = state.workspace.session;
  const contextOpen = history.presentation.contextOpen === true;
  const viewMode = history.presentation.viewMode ?? "list";
  const targetLabel = state.mode === "library"
    ? t("fileLibrary")
    : state.workspace.browse?.location.displayName ?? t("fileLibraryModeBrowse");

  useEffect(() => {
    const handleLocalSearchShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") return;
      if (!commandBarSurface?.enabled || !commandBarSurface.searchInputRef.current) return;
      event.preventDefault();
      commandBarSurface.searchInputRef.current.focus();
      commandBarSurface.searchInputRef.current.select();
    };
    window.addEventListener("keydown", handleLocalSearchShortcut);
    return () => window.removeEventListener("keydown", handleLocalSearchShortcut);
  }, [commandBarSurface]);

  return (
    <FileLibraryCommandBarSurfaceProvider value={{ registerSurface, clearSurface }}>
      <div
        ref={workspaceRef}
        className="file-library-workspace"
        data-layout={layout}
        data-mode={state.mode}
        data-detached-browse={state.detachedBrowse ? "true" : "false"}
        data-context-open={contextOpen ? "true" : "false"}
      >
        <WorkspaceCommandBar
          mode={state.mode}
          targetLabel={targetLabel}
          canGoBack={history.historyIndex > 0}
          canGoForward={history.historyIndex >= 0 && history.historyIndex < history.history.length - 1}
          onBack={() => void controller.back()}
          onForward={() => void controller.forward()}
          onModeChange={(mode) => void controller.switchMode(mode)}
          localSearch={commandBarSurface?.search}
          sourceActions={commandBarSurface?.actions}
          contextOpen={contextOpen}
          onContextToggle={() => controller.setContextOpen(!contextOpen)}
          viewMode={viewMode}
          onViewModeChange={(nextViewMode) => controller.setViewMode(nextViewMode)}
          t={t}
        />

        <ContextPanelPresentationProvider layout={layout}>
          <div className="file-library-workspace-body">
            <aside className="file-library-navigation-slot" data-workspace-slot="navigation" aria-hidden="true" />

            <main className="file-library-content-slot" data-workspace-slot="content">
              {state.mode === "library"
                ? <LibrarySourceSlot />
                : <BrowseMode />}
            </main>

            <aside
              className="file-library-context-slot"
              data-workspace-slot="context"
              aria-hidden="true"
            />
          </div>
        </ContextPanelPresentationProvider>
      </div>
    </FileLibraryCommandBarSurfaceProvider>
  );
}

type WorkspaceCommandBarProps = {
  mode: FileLibraryMode;
  targetLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onModeChange: (mode: FileLibraryMode) => void;
  localSearch?: ReactNode;
  sourceActions?: ReactNode;
  viewMode?: WorkspaceViewMode;
  onViewModeChange?: (viewMode: WorkspaceViewMode) => void;
  contextOpen?: boolean;
  onContextToggle?: () => void;
  t: ReturnType<typeof useI18nContext>["t"];
};

export function WorkspaceCommandBar({
  mode,
  targetLabel,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onModeChange,
  localSearch,
  sourceActions,
  viewMode = "list",
  onViewModeChange,
  contextOpen = false,
  onContextToggle = () => undefined,
  t
}: WorkspaceCommandBarProps) {
  const handleModeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "Home" || event.key === "ArrowLeft" ? "library" : "browse";
    onModeChange(nextMode);
    document.querySelector<HTMLButtonElement>(`[data-file-library-mode="${nextMode}"]`)?.focus();
  };

  return (
    <div className="file-library-command-bar" role="toolbar" aria-label={t("fileLibraryModeLabel")}>
      <div className="file-library-command-group file-library-history-controls">
        <button
          className="file-library-command-button"
          type="button"
          aria-label={t("fileLibraryBack")}
          disabled={!canGoBack}
          onClick={onBack}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>{t("fileLibraryBack")}</span>
        </button>
        <button
          className="file-library-command-button"
          type="button"
          aria-label={t("fileLibraryForward")}
          disabled={!canGoForward}
          onClick={onForward}
        >
          <ArrowRight size={15} aria-hidden="true" />
          <span>{t("fileLibraryForward")}</span>
        </button>
      </div>

      <div className="file-library-mode-switch" role="tablist" aria-label={t("fileLibraryModeLabel")}>
        <button
          className="file-library-mode-button"
          type="button"
          role="tab"
          aria-selected={mode === "library"}
          tabIndex={mode === "library" ? 0 : -1}
          data-file-library-mode="library"
          onClick={() => onModeChange("library")}
          onKeyDown={handleModeKeyDown}
        >
          {t("fileLibraryModeLibrary")}
        </button>
        <button
          className="file-library-mode-button"
          type="button"
          role="tab"
          aria-selected={mode === "browse"}
          tabIndex={mode === "browse" ? 0 : -1}
          data-file-library-mode="browse"
          onClick={() => onModeChange("browse")}
          onKeyDown={handleModeKeyDown}
        >
          {t("fileLibraryModeBrowse")}
        </button>
      </div>

      <div className="file-library-command-target" title={targetLabel}>
        <span className="file-library-command-target-label">{targetLabel}</span>
      </div>

      {localSearch ? <div className="file-library-command-search" data-file-library-command-search="true">{localSearch}</div> : null}
      {sourceActions ? <div className="file-library-command-actions" data-file-library-source-actions="true">{sourceActions}</div> : null}

      <div className="file-library-view-switch" role="group" aria-label={t("fileLibraryViewModeLabel")} data-file-library-view-mode={viewMode}>
        <button
          className="file-library-command-button"
          type="button"
          aria-label={t("fileLibraryViewList")}
          aria-pressed={viewMode === "list"}
          data-file-library-view="list"
          onClick={() => onViewModeChange?.("list")}
        >
          <List size={15} aria-hidden="true" />
          <span>{t("fileLibraryViewList")}</span>
        </button>
        <button
          className="file-library-command-button"
          type="button"
          aria-label={t("fileLibraryViewGrid")}
          aria-pressed={viewMode === "grid"}
          data-file-library-view="grid"
          onClick={() => onViewModeChange?.("grid")}
        >
          <Grid2X2 size={15} aria-hidden="true" />
          <span>{t("fileLibraryViewGrid")}</span>
        </button>
      </div>

      <button
        className="file-library-command-button file-library-context-toggle"
        type="button"
        aria-label={contextOpen ? t("fileLibraryContextClose") : t("fileLibraryContextOpen")}
        aria-pressed={contextOpen}
        data-file-library-context-toggle="true"
        onClick={onContextToggle}
      >
        {contextOpen ? <PanelRightClose size={15} aria-hidden="true" /> : <PanelRightOpen size={15} aria-hidden="true" />}
        <span>{t("fileLibraryContextLabel")}</span>
      </button>
    </div>
  );
}

function LibrarySourceSlot() {
  return (
    <div className="file-library-library-adapter" data-library-migration-adapter="library-source-owner" data-library-source-slot="library">
      <LibraryMode />
    </div>
  );
}
