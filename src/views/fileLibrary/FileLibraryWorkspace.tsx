import { ArrowLeft, ArrowRight, Menu, X } from "lucide-react";
import { lazy, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useI18nContext } from "../../contexts/AppContexts";
import { StateBlock } from "../shared/ui";
import { useFileLibraryExperience } from "./FileLibraryExperienceProvider";
import type { FileLibraryExperienceState, FileLibraryMode } from "./fileLibraryExperience";
import "./fileLibraryWorkspace.css";

const LegacyVaultView = lazy(() => import("../vault/VaultView").then((module) => ({ default: module.VaultView })));

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
  const navigationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeNavigationRef = useRef<HTMLButtonElement | null>(null);
  const [layout, setLayout] = useState<FileLibraryLayout>("compact");
  const [navigationOpen, setNavigationOpen] = useState(false);

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

  useEffect(() => {
    if (!navigationOpen || layout !== "compact") return;

    closeNavigationRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavigationOpen(false);
        window.requestAnimationFrame(() => navigationTriggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layout, navigationOpen]);

  useEffect(() => {
    if (layout !== "compact") setNavigationOpen(false);
  }, [layout]);

  const closeNavigation = () => {
    setNavigationOpen(false);
    window.requestAnimationFrame(() => navigationTriggerRef.current?.focus());
  };
  const history = state.workspace.session;
  const targetLabel = state.mode === "library"
    ? t("fileLibrary")
    : state.workspace.browse?.location.displayName ?? t("fileLibraryModeBrowse");

  return (
    <div
      ref={workspaceRef}
      className="file-library-workspace"
      data-layout={layout}
      data-mode={state.mode}
      data-detached-browse={state.detachedBrowse ? "true" : "false"}
    >
      <WorkspaceCommandBar
        layout={layout}
        mode={state.mode}
        targetLabel={targetLabel}
        canGoBack={history.historyIndex > 0}
        canGoForward={history.historyIndex >= 0 && history.historyIndex < history.history.length - 1}
        onBack={() => void controller.back()}
        onForward={() => void controller.forward()}
        onModeChange={(mode) => void controller.switchMode(mode)}
        onOpenNavigation={() => setNavigationOpen(true)}
        navigationOpen={navigationOpen}
        navigationTriggerRef={navigationTriggerRef}
        t={t}
      />

      <div className="file-library-workspace-body">
        <aside className="file-library-navigation-slot" data-workspace-slot="navigation" aria-label={t("fileLibraryNavigation")}>
          <WorkspaceNavigation mode={state.mode} t={t} />
        </aside>

        <main className="file-library-content-slot" data-workspace-slot="content">
          {state.mode === "library"
            ? <LibraryModeAdapter />
            : <BrowseModeContent state={state} t={t} />}
        </main>

        <aside
          className="file-library-context-slot"
          data-workspace-slot="context"
          aria-hidden="true"
        />
      </div>

      {layout === "compact" && navigationOpen ? (
        <div className="file-library-navigation-drawer-layer" data-navigation-drawer-layer>
          <button
            className="file-library-navigation-scrim"
            type="button"
            aria-label={t("fileLibraryCloseNavigation")}
            onClick={closeNavigation}
          />
          <aside
            id="file-library-navigation-drawer"
            className="file-library-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("fileLibraryNavigation")}
          >
            <div className="file-library-navigation-drawer-header">
              <strong>{t("fileLibraryNavigation")}</strong>
              <button
                ref={closeNavigationRef}
                className="file-library-quiet-button"
                type="button"
                aria-label={t("fileLibraryCloseNavigation")}
                onClick={closeNavigation}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <WorkspaceNavigation mode={state.mode} t={t} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

type WorkspaceCommandBarProps = {
  layout: FileLibraryLayout;
  mode: FileLibraryMode;
  targetLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onModeChange: (mode: FileLibraryMode) => void;
  onOpenNavigation: () => void;
  navigationOpen: boolean;
  navigationTriggerRef: RefObject<HTMLButtonElement | null>;
  t: ReturnType<typeof useI18nContext>["t"];
};

export function WorkspaceCommandBar({
  layout,
  mode,
  targetLabel,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onModeChange,
  onOpenNavigation,
  navigationOpen,
  navigationTriggerRef,
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

      {layout === "compact" ? (
        <button
          ref={navigationTriggerRef}
          className="file-library-command-button file-library-navigation-trigger"
          type="button"
          aria-label={t("fileLibraryOpenNavigation")}
          aria-controls="file-library-navigation-drawer"
          aria-expanded={navigationOpen}
          aria-haspopup="dialog"
          onClick={onOpenNavigation}
        >
          <Menu size={15} aria-hidden="true" />
          <span>{t("fileLibraryOpenNavigation")}</span>
        </button>
      ) : null}
    </div>
  );
}

function WorkspaceNavigation({ mode, t }: { mode: FileLibraryMode; t: WorkspaceCommandBarProps["t"] }) {
  return (
    <div className="file-library-navigation-content">
      <div>
        <span className="file-library-eyebrow">{t("fileLibraryNavigation")}</span>
        <strong className="file-library-navigation-title">
          {mode === "library" ? t("fileLibraryModeLibrary") : t("fileLibraryModeBrowse")}
        </strong>
      </div>
      <p className="file-library-navigation-hint">
        {mode === "library" ? t("fileLibraryNavigationLibraryHint") : t("fileLibraryNavigationBrowseHint")}
      </p>
    </div>
  );
}

function LibraryModeAdapter() {
  return (
    <div className="file-library-library-adapter" data-library-migration-adapter="legacy-vault">
      <LegacyVaultView />
    </div>
  );
}

function BrowseModeContent({ state, t }: { state: FileLibraryExperienceState; t: WorkspaceCommandBarProps["t"] }) {
  if (state.detachedBrowse) {
    return (
      <StateBlock
        title={t("fileLibraryBrowseDetachedTitle")}
        description={t("fileLibraryBrowseDetachedDesc")}
      />
    );
  }

  return (
    <StateBlock
      title={t("fileLibraryBrowseTargetTitle")}
      description={t("fileLibraryBrowseTargetDesc")}
    />
  );
}
