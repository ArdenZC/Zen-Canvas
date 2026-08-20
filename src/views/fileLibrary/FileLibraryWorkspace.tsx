import { ArrowLeft, ArrowRight } from "lucide-react";
import { lazy, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useI18nContext } from "../../contexts/AppContexts";
import { useFileLibraryExperience } from "./FileLibraryExperienceProvider";
import type { FileLibraryMode } from "./fileLibraryExperience";
import "./fileLibraryWorkspace.css";

const LegacyVaultView = lazy(() => import("../vault/VaultView").then((module) => ({ default: module.VaultView })));
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
        mode={state.mode}
        targetLabel={targetLabel}
        canGoBack={history.historyIndex > 0}
        canGoForward={history.historyIndex >= 0 && history.historyIndex < history.history.length - 1}
        onBack={() => void controller.back()}
        onForward={() => void controller.forward()}
        onModeChange={(mode) => void controller.switchMode(mode)}
        t={t}
      />

      <div className="file-library-workspace-body">
        <aside className="file-library-navigation-slot" data-workspace-slot="navigation" aria-hidden="true" />

        <main className="file-library-content-slot" data-workspace-slot="content">
          {state.mode === "library"
            ? <LibraryModeAdapter />
            : <BrowseMode />}
        </main>

        <aside
          className="file-library-context-slot"
          data-workspace-slot="context"
          aria-hidden="true"
        />
      </div>
    </div>
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

    </div>
  );
}

function LibraryModeAdapter() {
  return (
    <div className="file-library-library-adapter" data-library-migration-adapter="legacy-vault">
      <LegacyVaultView presentation="embedded" />
    </div>
  );
}
