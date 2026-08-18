import {
  Archive,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  PanelLeft,
  X
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { useI18nContext } from "../../contexts/AppContexts";
import type { Language } from "../../i18n";
import type { NavigationTarget } from "../../types/fileWorkspace";
import { LibraryModeAdapter } from "./LibraryModeAdapter";
import {
  createFileLibraryExperienceController,
  type FileLibraryExperienceController
} from "./fileLibraryExperienceController";
import "./FileLibraryWorkspace.css";

export function FileLibraryWorkspace() {
  const { language } = useI18nContext();
  const copy = workspaceCopy(language);
  const controllerRef = useRef<FileLibraryExperienceController | null>(null);
  const navToggleRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const lifecycleGeneration = useRef(0);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  if (controllerRef.current === null) {
    controllerRef.current = createFileLibraryExperienceController();
  }
  const controller = controllerRef.current;
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => {
    lifecycleGeneration.current += 1;
    const generation = lifecycleGeneration.current;
    return () => {
      queueMicrotask(() => {
        if (lifecycleGeneration.current === generation) {
          void controller.dispose();
        }
      });
    };
  }, [controller]);

  useEffect(() => {
    if (!isNavigationOpen) return;
    navRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsNavigationOpen(false);
      requestAnimationFrame(() => navToggleRef.current?.focus());
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isNavigationOpen]);

  function switchMode(mode: "library" | "browse") {
    if (controller.switchMode(mode)) setIsNavigationOpen(false);
  }

  const targetLabel = workspaceTargetLabel(snapshot.activeTarget, snapshot.mode, copy);

  return (
    <section
      className="file-library-workspace"
      data-file-library-workspace
      data-workspace-mode={snapshot.mode}
      aria-label={copy.fileLibrary}
    >
      <div className="file-library-command-bar" role="toolbar" aria-label={copy.workspaceControls}>
        <div className="file-library-history-actions" aria-label={copy.historyControls}>
          <button
            type="button"
            className="file-library-history-button"
            disabled={!snapshot.canGoBack}
            aria-label={copy.back}
            title={copy.back}
            onClick={() => void controller.goBack()}
          >
            <ChevronLeft size={17} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="file-library-history-button"
            disabled={!snapshot.canGoForward}
            aria-label={copy.forward}
            title={copy.forward}
            onClick={() => void controller.goForward()}
          >
            <ChevronRight size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="file-library-mode-switch" role="group" aria-label={copy.organizationMode}>
          <button
            type="button"
            className="file-library-mode-button"
            aria-pressed={snapshot.mode === "library"}
            onClick={() => switchMode("library")}
          >
            {copy.library}
          </button>
          <button
            type="button"
            className="file-library-mode-button"
            aria-pressed={snapshot.mode === "browse"}
            onClick={() => switchMode("browse")}
          >
            {copy.browse}
          </button>
        </div>

        <div className="file-library-target-identity" title={targetLabel}>
          {targetLabel}
        </div>

        <div className="file-library-command-tail">
          <button
            ref={navToggleRef}
            type="button"
            className="file-library-nav-toggle"
            aria-label={isNavigationOpen ? copy.closeNavigation : copy.openNavigation}
            aria-expanded={isNavigationOpen}
            aria-controls="file-library-local-navigation"
            onClick={() => setIsNavigationOpen((open) => !open)}
          >
            {isNavigationOpen
              ? <X size={16} strokeWidth={1.8} />
              : <PanelLeft size={16} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      <div className="file-library-body">
        <button
          type="button"
          tabIndex={isNavigationOpen ? 0 : -1}
          className="file-library-compact-backdrop"
          data-open={isNavigationOpen}
          aria-label={copy.closeNavigation}
          onClick={() => {
            setIsNavigationOpen(false);
            requestAnimationFrame(() => navToggleRef.current?.focus());
          }}
        />

        <aside
          id="file-library-local-navigation"
          ref={navRef}
          className="file-library-local-nav"
          data-open={isNavigationOpen}
          tabIndex={-1}
          aria-label={copy.localNavigation}
        >
          <LocalNavigation mode={snapshot.mode} copy={copy} />
        </aside>

        <main className="file-library-content-slot" data-file-library-content>
          {snapshot.mode === "library"
            ? <LibraryModeAdapter />
            : <BrowseShellEmpty copy={copy} />}
        </main>
      </div>
    </section>
  );
}

function LocalNavigation({
  mode,
  copy
}: {
  mode: "library" | "browse";
  copy: WorkspaceCopy;
}) {
  if (mode === "browse") {
    return (
      <>
        <span className="file-library-nav-heading">{copy.browse}</span>
        <div className="file-library-nav-item" data-active="true">
          <FolderOpen size={16} strokeWidth={1.7} />
          <span>{copy.locations}</span>
        </div>
        <p className="file-library-nav-note">{copy.noBrowseLocationShort}</p>
      </>
    );
  }

  return (
    <>
      <span className="file-library-nav-heading">{copy.library}</span>
      <div className="file-library-nav-item" data-active="true">
        <Archive size={16} strokeWidth={1.7} />
        <span>{copy.fileLibrary}</span>
      </div>
    </>
  );
}

function BrowseShellEmpty({ copy }: { copy: WorkspaceCopy }) {
  return (
    <div className="file-library-browse-empty">
      <div className="file-library-browse-empty-copy">
        <FolderOpen size={28} strokeWidth={1.5} aria-hidden="true" />
        <h2>{copy.noBrowseLocation}</h2>
        <p>{copy.noBrowseLocationDescription}</p>
      </div>
    </div>
  );
}

function workspaceTargetLabel(
  target: NavigationTarget | null,
  mode: "library" | "browse",
  copy: WorkspaceCopy
) {
  if (mode === "browse") return copy.browse;
  if (target?.kind !== "library") return copy.fileLibrary;
  if (target.key === "legacy_library") return copy.fileLibrary;
  return target.key;
}

interface WorkspaceCopy {
  fileLibrary: string;
  library: string;
  browse: string;
  locations: string;
  workspaceControls: string;
  historyControls: string;
  organizationMode: string;
  localNavigation: string;
  back: string;
  forward: string;
  openNavigation: string;
  closeNavigation: string;
  noBrowseLocation: string;
  noBrowseLocationShort: string;
  noBrowseLocationDescription: string;
}

function workspaceCopy(language: Language): WorkspaceCopy {
  if (language === "zh") {
    return {
      fileLibrary: "文件库",
      library: "资料库",
      browse: "浏览",
      locations: "位置",
      workspaceControls: "文件库工作区控制",
      historyControls: "前进与后退",
      organizationMode: "组织方式",
      localNavigation: "文件库本地导航",
      back: "后退",
      forward: "前进",
      openNavigation: "打开本地导航",
      closeNavigation: "关闭本地导航",
      noBrowseLocation: "尚未打开位置",
      noBrowseLocationShort: "打开位置后会在这里显示浏览上下文。",
      noBrowseLocationDescription: "浏览模式用于直接查看文件系统位置，不会自动把位置加入资料库或建立索引。"
    };
  }
  return {
    fileLibrary: "File Library",
    library: "Library",
    browse: "Browse",
    locations: "Locations",
    workspaceControls: "File Library workspace controls",
    historyControls: "Back and forward",
    organizationMode: "Organization mode",
    localNavigation: "File Library local navigation",
    back: "Back",
    forward: "Forward",
    openNavigation: "Open local navigation",
    closeNavigation: "Close local navigation",
    noBrowseLocation: "No location is open",
    noBrowseLocationShort: "Browse context appears here after a location is opened.",
    noBrowseLocationDescription: "Browse mode opens filesystem locations directly without automatically adding them to Library or indexing them."
  };
}
