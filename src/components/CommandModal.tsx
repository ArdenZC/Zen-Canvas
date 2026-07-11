import { useEffect, useMemo, useState, type RefObject } from "react";
import type * as React from "react";
import { Activity, Archive, ChevronRight, Clock3, Code, CornerDownLeft, FileText, Folder, Image as ImageIcon, LayoutGrid, Radar, Search, Video, X } from "lucide-react";
import { motion } from "motion/react";
import { tauriApi } from "../api/tauriApi";
import type { FileRecord, LibraryScope } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { buttonSecondary, cn, toneClasses } from "../utils/tw";
import { useBackgroundIndexerStore } from "../store/useBackgroundIndexerStore";
import { compactPath, formatDisplayPath, readableError } from "../utils/viewHelpers";
import { IconButton, StateBlock, ToneBadge, quietText } from "../views/shared/ui";

const keyBadge =
  "flex items-center justify-center rounded border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--zc-text-tertiary)] shadow-sm";
const commandShellBase =
  "w-full overflow-hidden border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-spotlight)] backdrop-blur-xl";
const commandShellCollapsed =
  "h-16 w-full max-w-[720px] rounded-full";
const commandShellExpanded =
  "rounded-2xl";
const commandShellDialogWidth = "max-w-[720px]";
const commandShellStandaloneExpanded = "w-full max-w-[720px]";

const commandInputRowBase =
  "relative flex h-16 min-h-16 items-center gap-3 border-b border-[var(--zc-divider)] px-4 transition-colors";
const commandInputRowCollapsed =
  "relative flex h-16 min-h-16 items-center gap-3 border-b-0 px-4 transition-colors";
const commandInputRowFocused = "";

const commandSearchIcon =
  "grid h-5 w-5 shrink-0 place-items-center text-[var(--zc-primary)]";

const commandInput =
  "command-input h-full min-w-0 flex-1 bg-transparent text-lg text-[var(--zc-text-primary)] outline-none placeholder:text-[var(--zc-text-tertiary)] focus:outline-none focus-visible:outline-none";

const commandResultsShell = "grid min-h-0 gap-0";
const commandResultsBody = "max-h-[50vh] overflow-y-auto p-2";
const commandResultsHeader = "flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--zc-text-tertiary)]";

const commandResultsList = "flex flex-col gap-1";
const commandResultItemBase =
  "grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--zc-radius-field)] px-3 py-3 text-left transition-[background,box-shadow] duration-[var(--zc-duration-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--zc-focus-ring)]";
const commandResultItemActive =
  "bg-[var(--zc-surface-selected)] shadow-[inset_0_0_0_1px_var(--zc-primary-soft)]";
const commandResultItemInactive =
  "hover:bg-[var(--zc-surface-hover)]";

const commandFileIcon =
  "flex shrink-0 items-center justify-center w-10 h-10 rounded-lg border";
const commandFileName = "truncate text-sm font-medium text-[var(--zc-text-primary)] transition-colors";
const commandFileMeta = "truncate text-xs text-[var(--zc-text-secondary)]";

const commandFooter =
  "flex items-center justify-between border-t border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-4 py-3 text-xs text-[var(--zc-text-secondary)]";
const shortcutHints = "flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1";
const shortcutHint = "inline-flex min-w-0 items-center gap-1 whitespace-nowrap";
const shortcutHintLabel = "hidden max-w-24 truncate text-[var(--zc-text-secondary)] sm:inline";
const highlightMark =
  "rounded-sm bg-[var(--zc-primary-soft)] px-1 text-[var(--zc-primary-text)]";
const commandIdleGroups = "grid gap-3 p-4 sm:grid-cols-2";
const commandIdleGroup = "grid gap-2 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3";
const commandIdleAction = "flex min-h-10 items-center gap-3 rounded-[var(--zc-radius-control)] px-2.5 text-left text-sm text-[var(--zc-text-secondary)] transition-[background,color] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]";
const SEARCH_RESULT_LIMIT = 80;
const standaloneSearchWindowCollapsedHeight = 160;
const standaloneSearchWindowExpandedHeight = 660;

export async function activateCommandNavigation({
  standalone,
  view,
  fileId,
  setView,
  setSelectedFileId,
  onClose,
  activateSearchResult = tauriApi.activateSearchResult
}: {
  standalone: boolean;
  view: View;
  fileId: string | null;
  setView: (view: View) => void;
  setSelectedFileId: (id: string) => void;
  onClose: () => void;
  activateSearchResult?: (view: View, fileId: string | null) => Promise<void>;
}) {
  if (standalone) {
    await activateSearchResult(view, fileId);
    return;
  }

  if (fileId) setSelectedFileId(fileId);
  setView(view);
  onClose();
}

export function isSortingPreviewShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
) {
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.altKey || event.shiftKey) return false;
  const key = event.key.toLowerCase();
  return key === "enter" || key === "p";
}

export function CommandModal({
  inputRef,
  setView,
  setSelectedFileId,
  onClose,
  t,
  onError,
  searchScope,
  searchScopeLabel,
  searchScopeEmptyMessage,
  standalone = false
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  setView: (view: View) => void;
  setSelectedFileId: (id: string) => void;
  onClose: () => void;
  platform: NodeJS.Platform | "browser";
  t: Translator;
  onError?: (message: string) => void;
  searchScope?: LibraryScope;
  searchScopeLabel?: string;
  searchScopeEmptyMessage?: string;
  standalone?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FileRecord[]>([]);
  const [queryState, setQueryState] = useState<"idle" | "pending" | "done" | "failed">("idle");
  const [commandError, setCommandError] = useState("");
  const [commandIndexStatus, setCommandIndexStatus] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const enqueueBackgroundIndexRoots = useBackgroundIndexerStore((state) => state.enqueueRoots);
  const isBackgroundIndexing = useBackgroundIndexerStore((state) => state.isBackgroundIndexing);
  const currentBackgroundRoot = useBackgroundIndexerStore((state) => state.currentRoot);
  const pendingBackgroundRoots = useBackgroundIndexerStore((state) => state.pendingRoots.length);
  const trimmedSearch = search.trim();
  const showResults = trimmedSearch.length > 0 && results.length > 0;
  const activeResultId = showResults ? `command-result-${activeIndex}` : undefined;
  const isScopedEmpty = Boolean(searchScopeEmptyMessage);
  const isCustomRootNoResults =
    searchScope?.kind === "roots"
    && searchScope.roots.length > 0
    && trimmedSearch.length > 0
    && queryState === "done"
    && results.length === 0;
  const statusTitle =
    queryState === "pending"
      ? t("commandTypingTitle")
      : queryState === "failed"
        ? t("commandFailedTitle")
        : isScopedEmpty
          ? t("commandScopedEmptyTitle")
          : trimmedSearch
            ? t("commandNoResultsTitle")
            : t("commandIdleTitle");
  const statusDescription =
    queryState === "pending"
      ? t("commandSearching")
      : queryState === "failed"
        ? commandError || t("commandSearchFailed")
        : isScopedEmpty
          ? searchScopeEmptyMessage || t("commandScopedEmptyDesc")
          : isCustomRootNoResults
            ? commandIndexStatus || t("commandCustomRootsNoResults")
          : trimmedSearch
            ? t("commandNoResults")
            : t("commandIdleDesc");
  const isStandaloneCollapsed =
    standalone
    && !trimmedSearch
    && queryState === "idle"
    && !isScopedEmpty;
  const shouldShowIdleState = !standalone && !trimmedSearch;
  const shouldShowStateBlock = !showResults && (queryState !== "idle" || isScopedEmpty);
  const showScopeMeta = Boolean(searchScopeLabel && !isStandaloneCollapsed);

  useEffect(() => {
    if (!standalone) return;
    void tauriApi.resizeSearchWindow(!isStandaloneCollapsed).catch(() => undefined);
  }, [isStandaloneCollapsed, standalone]);

  useEffect(() => {
    if (!standalone) return;
    const handleBlur = () => onClose();
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [standalone, onClose]);

  useEffect(() => {
    if (!trimmedSearch) {
      setResults([]);
      setQueryState("idle");
      setCommandError("");
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    setCommandError("");
    setCommandIndexStatus("");
    if (searchScopeEmptyMessage) {
      setResults([]);
      setQueryState("done");
      setActiveIndex(0);
      return;
    }
    setQueryState("pending");
    const timer = window.setTimeout(() => {
      tauriApi.searchFiles(trimmedSearch, SEARCH_RESULT_LIMIT, searchScope)
        .then((files) => {
          if (cancelled) return;
          setResults(files);
          setQueryState("done");
          setActiveIndex(0);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setQueryState("failed");
          setCommandError(t("commandSearchFailed"));
        });
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchScope, searchScopeEmptyMessage, t, trimmedSearch]);

  const visibleResults = useMemo(() => results, [results]);

  useEffect(() => {
    if (!showResults || !activeResultId) return;
    document.getElementById(activeResultId)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeResultId, showResults]);

  async function chooseFile(file: FileRecord) {
    try {
      await activateCommandNavigation({
        standalone,
        view: "library",
        fileId: file.id,
        setView,
        setSelectedFileId,
        onClose
      });
    } catch (error) {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    }
  }

  async function revealFile(file: FileRecord) {
    try {
      await tauriApi.revealInFolder(file.path);
    } catch (error) {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    }
  }

  async function openSortingPreview() {
    try {
      await activateCommandNavigation({
        standalone,
        view: "preview",
        fileId: null,
        setView,
        setSelectedFileId,
        onClose
      });
    } catch (error) {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    }
  }

  function clearSearch() {
    setSearch("");
    setCommandIndexStatus("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function indexSearchScopeRoots() {
    if (searchScope?.kind !== "roots") return;
    enqueueBackgroundIndexRoots(searchScope.roots);
    setCommandIndexStatus(t("commandIndexQueued"));
  }

  function openIdleDestination(view: View) {
    void activateCommandNavigation({
      standalone,
      view,
      fileId: null,
      setView,
      setSelectedFileId,
      onClose
    }).catch((error) => {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    });
  }

  function getResultTone(file: FileRecord) {
    const purpose = (file.purpose || "").toLowerCase();
    if (purpose.includes("strategy") || purpose.includes("finance") || file.lifecycle === "Archive") return "purple";
    if (purpose.includes("media") || purpose.includes("image")) return "amber";
    if (purpose.includes("code") || purpose.includes("script")) return "green";
    if (purpose.includes("doc") || purpose.includes("text")) return "blue";
    if (file.risk_level === "Sensitive" || purpose.includes("sensitive")) return "red";
    return "slate";
  }

  function getIcon(fileType: string) {
    const type = (fileType || "").toLowerCase();
    if (type === "folder") return <Folder size={20} strokeWidth={1.5} />;
    if (type === "video" || type === "mp4") return <Video size={20} strokeWidth={1.5} />;
    if (type === "image" || type === "png" || type === "jpg") return <ImageIcon size={20} strokeWidth={1.5} />;
    if (type === "code" || type === "ts" || type === "js" || type === "tsx" || type === "json") return <Code size={20} strokeWidth={1.5} />;
    return <FileText size={20} strokeWidth={1.5} />;
  }

  return (
    <div
      className={cn(
        standalone
          ? "relative z-10 flex h-full w-full items-start justify-center bg-transparent pt-8 px-8"
          : "fixed inset-0 z-40 flex items-start justify-center bg-[var(--zc-overlay)] px-5 pt-[15vh] backdrop-blur-sm sm:pt-[20vh]"
      )}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        layout
        className={cn(
          commandShellBase,
          isStandaloneCollapsed ? commandShellCollapsed : commandShellExpanded,
          !isStandaloneCollapsed && (standalone ? commandShellStandaloneExpanded : commandShellDialogWidth)
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        role={standalone ? "search" : "dialog"}
        aria-modal={standalone ? undefined : true}
        aria-label={t("globalSearch")}
        aria-busy={queryState === "pending"}
        onKeyDown={(event) => {
          if ((event.metaKey && event.key === "Backspace") || (event.ctrlKey && event.key === "Backspace")) {
            event.preventDefault();
            clearSearch();
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, Math.max(0, visibleResults.length - 1)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && event.altKey && visibleResults[activeIndex]) {
            event.preventDefault();
            void revealFile(visibleResults[activeIndex]);
            return;
          }
          if (isSortingPreviewShortcut(event)) {
            event.preventDefault();
            void openSortingPreview();
            return;
          }
          if (event.key === "Enter" && visibleResults[activeIndex]) {
            event.preventDefault();
            void chooseFile(visibleResults[activeIndex]);
          }
          if (event.key === "Escape") onClose();
        }}
      >
        <div
          className={cn(
            isStandaloneCollapsed ? commandInputRowCollapsed : commandInputRowBase,
            inputFocused && commandInputRowFocused
          )}
        >
          <span className={commandSearchIcon}>
            <Search size={18} strokeWidth={2.2} />
          </span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={showResults}
            aria-controls="command-results"
            aria-activedescendant={activeResultId}
            value={search}
            placeholder={t("commandPlaceholder")}
            onChange={(event) => setSearch(event.target.value)}
            onClick={() => inputRef.current?.focus()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className={commandInput}
          />
          {search && (
            <IconButton
              className="h-8 w-8 rounded-lg border-transparent bg-transparent text-[var(--zc-text-secondary)] shadow-none hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)]"
              onClick={clearSearch}
              aria-label={t("commandClearSearch")}
              title={t("commandClearSearch")}
            >
              <X size={16} strokeWidth={2.5} />
            </IconButton>
          )}
          <kbd className={cn(keyBadge, "hidden sm:inline-flex")}>ESC</kbd>
        </div>
        {showScopeMeta && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--zc-divider)] px-4 py-2 text-[11px] leading-tight text-[var(--zc-text-secondary)]">
            <span className="min-w-0 truncate">{searchScopeLabel}</span>
            <span className="hidden shrink-0 sm:inline">{t("commandScopeMeta")}</span>
          </div>
        )}
        {showResults && (
          <div className={commandResultsShell}>
            <div className={commandResultsBody}>
              <div className={commandResultsHeader}>
                <span>{t("smartMatches")}</span>
                <span className={cn(quietText, "hidden sm:inline")}>{t("commandKeyboardHint")}</span>
              </div>
              <div id="command-results" role="listbox" className={commandResultsList}>
                {visibleResults.map((file, index) => {
                  const tone = getResultTone(file);
                  const extension = file.extension ? file.extension.replace(".", "").toUpperCase() : file.file_type;
                  return (
                    <button
                      key={file.id}
                      id={`command-result-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={cn(
                        commandResultItemBase,
                        index === activeIndex ? commandResultItemActive : commandResultItemInactive
                      )}
                      onClick={() => void chooseFile(file)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={cn(commandFileIcon, toneClasses(tone))}>
                        {getIcon(file.extension ? file.extension.replace(".", "") : file.file_type)}
                      </span>
                      <span className="grid min-w-0 gap-1.5">
                        <strong className={commandFileName}>
                          <HighlightText text={file.name} highlight={trimmedSearch} />
                        </strong>
                        <span className={commandFileMeta} title={formatDisplayPath(file.path)}>{compactPath(formatDisplayPath(file.path), 74)}</span>
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <ToneBadge tone={tone as any}>{file.purpose}</ToneBadge>
                          <ToneBadge tone="slate">{extension}</ToneBadge>
                          {file.risk_level !== "Normal" && <ToneBadge tone={file.risk_level === "Sensitive" ? "red" : "amber"}>{file.risk_level === "Sensitive" ? t("sensitiveLabel") : file.risk_level}</ToneBadge>}
                          {file.is_duplicate && <ToneBadge tone="amber">{t("libraryDuplicateFiles")}</ToneBadge>}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-[var(--zc-text-secondary)]">
                        {index === activeIndex && <ChevronRight className="text-[var(--zc-primary)]" size={16} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={commandFooter}>
              <span>{t("matchesFound").replace("{count}", String(visibleResults.length))}</span>
              <div className={shortcutHints}>
                <ShortcutHint badge={<CornerDownLeft className="w-3 h-3" />} label={t("commandOpenHint")} />
                <ShortcutHint badge="↑↓" label="to navigate" />
                <ShortcutHint badge="ESC" label="to close" />
              </div>
            </div>
          </div>
        )}
        {shouldShowIdleState && (
          <CommandIdleGroups
            t={t}
            isBackgroundIndexing={isBackgroundIndexing}
            currentBackgroundRoot={currentBackgroundRoot}
            pendingBackgroundRoots={pendingBackgroundRoots}
            onOpen={openIdleDestination}
          />
        )}
        {shouldShowStateBlock && (
          <div className="px-4 py-4" aria-live={queryState === "failed" ? "assertive" : "polite"} role={queryState === "failed" ? "alert" : "status"}>
            <StateBlock
              tone={queryState === "failed" ? "error" : queryState === "pending" ? "info" : isScopedEmpty ? "warning" : "neutral"}
              title={statusTitle}
              description={statusDescription}
              density="compact"
              primaryAction={isCustomRootNoResults ? (
                <button className={buttonSecondary} onClick={indexSearchScopeRoots}>
                  {t("indexSearchFolders")}
                </button>
              ) : undefined}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function CommandIdleGroups({
  t,
  isBackgroundIndexing,
  currentBackgroundRoot,
  pendingBackgroundRoots,
  onOpen
}: {
  t: Translator;
  isBackgroundIndexing: boolean;
  currentBackgroundRoot: string | null;
  pendingBackgroundRoots: number;
  onOpen: (view: View) => void;
}) {
  const backgroundDescription = isBackgroundIndexing && currentBackgroundRoot
    ? compactPath(formatDisplayPath(currentBackgroundRoot), 42)
    : pendingBackgroundRoots > 0
      ? t("spotlightPendingTasks").replace("{count}", String(pendingBackgroundRoots))
      : t("spotlightNoBackgroundTasks");

  return (
    <div className={commandIdleGroups} aria-label={t("commandIdleTitle")}>
      <IdleGroup title={t("spotlightRecentFiles")}>
        <IdleAction icon={Archive} label={t("fileLibrary")} onClick={() => onOpen("library")} />
      </IdleGroup>
      <IdleGroup title={t("spotlightRecentOperations")}>
        <IdleAction icon={Clock3} label={t("history")} onClick={() => onOpen("restore")} />
      </IdleGroup>
      <IdleGroup title={t("spotlightCommonTasks")}>
        <IdleAction icon={Radar} label={t("overview")} onClick={() => onOpen("scanner")} />
        <IdleAction icon={LayoutGrid} label={t("organizeSuggestions")} onClick={() => onOpen("organize")} />
      </IdleGroup>
      <IdleGroup title={t("spotlightBackgroundTasks")}>
        <div className="flex min-h-10 items-center gap-3 px-2.5 text-sm text-[var(--zc-text-secondary)]" role="status">
          <Activity size={17} className={isBackgroundIndexing ? "animate-pulse text-[var(--zc-primary)]" : "text-[var(--zc-text-tertiary)]"} />
          <span className="min-w-0 truncate">{backgroundDescription}</span>
        </div>
      </IdleGroup>
    </div>
  );
}

function IdleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={commandIdleGroup}>
      <h3 className="px-2 text-xs font-semibold text-[var(--zc-text-tertiary)]">{title}</h3>
      {children}
    </section>
  );
}

function IdleAction({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Archive;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={commandIdleAction} onClick={onClick}>
      <Icon size={17} className="text-[var(--zc-primary)]" />
      <span>{label}</span>
      <ChevronRight size={15} className="ml-auto text-[var(--zc-text-tertiary)]" />
    </button>
  );
}

function ShortcutHint({ badge, label }: { badge: React.ReactNode; label: string }) {
  return (
    <span className={shortcutHint}>
      <kbd className={keyBadge}>{badge}</kbd>
      <span className={shortcutHintLabel}>{label}</span>
    </span>
  );
}

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  const value = highlight.trim();
  if (!value) return <>{text}</>;
  const escaped = value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const matcher = new RegExp(`(${escaped})`, "ig");
  return (
    <>
      {text.split(matcher).map((part, index) => (
        part.toLowerCase() === value.toLowerCase()
          ? <mark className={highlightMark} key={`${part}-${index}`}>{part}</mark>
          : <span key={`${part}-${index}`}>{part}</span>
      ))}
    </>
  );
}
