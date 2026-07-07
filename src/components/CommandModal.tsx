import { useEffect, useMemo, useState, type RefObject } from "react";
import type * as React from "react";
import { ChevronRight, File, Search, X, Folder, Video, Image as ImageIcon, Code, FileText, CornerDownLeft } from "lucide-react";
import { motion } from "motion/react";
import { tauriApi } from "../api/tauriApi";
import type { FileRecord, LibraryScope } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { buttonSecondary, cn, toneClasses } from "../utils/tw";
import { useBackgroundIndexerStore } from "../store/useBackgroundIndexerStore";
import { compactPath, formatDisplayPath, readableError } from "../utils/viewHelpers";
import { IconButton, StateBlock, ToneBadge, quietText } from "../views/shared/ui";

const keyBadge =
  "flex items-center justify-center px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 shadow-sm font-mono font-medium text-neutral-500 dark:text-neutral-400 text-[10px]";
const commandShellBase =
  "w-full overflow-hidden bg-white dark:bg-neutral-900 shadow-2xl ring-1 ring-neutral-200 dark:ring-white/10";
const commandShellCollapsed =
  "h-16 w-full max-w-[720px] rounded-full";
const commandShellExpanded =
  "rounded-2xl";
const commandShellDialogWidth = "max-w-[720px]";
const commandShellStandaloneExpanded = "w-full max-w-[720px]";

const commandInputRowBase =
  "relative flex h-16 min-h-16 items-center gap-3 border-b border-neutral-100 px-4 transition-colors dark:border-white/10";
const commandInputRowCollapsed =
  "relative flex h-16 min-h-16 items-center gap-3 border-b-0 px-4 transition-colors";
const commandInputRowFocused = "";

const commandSearchIcon =
  "w-5 h-5 text-neutral-400 shrink-0 grid place-items-center";

const commandInput =
  "command-input h-full min-w-0 flex-1 bg-transparent text-lg text-neutral-900 outline-none placeholder:text-neutral-400 focus:outline-none focus-visible:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500";

const commandResultsShell = "grid min-h-0 gap-0";
const commandResultsBody = "max-h-[50vh] overflow-y-auto p-2";
const commandResultsHeader = "px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between";

const commandResultsList = "flex flex-col gap-1";
const commandResultItemBase =
  "w-full grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 px-3 py-3 rounded-xl transition-all duration-150 text-left";
const commandResultItemActive =
  "bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500/20";
const commandResultItemInactive =
  "hover:bg-neutral-50 dark:hover:bg-white/5";

const commandFileIcon =
  "flex shrink-0 items-center justify-center w-10 h-10 rounded-lg border";
const commandFileName = "text-sm font-medium truncate transition-colors text-neutral-900 dark:text-neutral-100";
const commandFileMeta = "text-xs text-neutral-500 dark:text-neutral-400 truncate";

const commandFooter =
  "flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border-t border-neutral-100 dark:border-white/10 text-xs text-neutral-500 dark:text-neutral-400";
const shortcutHints = "flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1";
const shortcutHint = "inline-flex min-w-0 items-center gap-1 whitespace-nowrap";
const shortcutHintLabel = "hidden max-w-24 truncate text-neutral-500 sm:inline dark:text-neutral-400";
const highlightMark =
  "rounded-sm bg-blue-100/50 px-1 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200";
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
  const shouldShowStateBlock = !showResults && (queryState !== "idle" || shouldShowIdleState || isScopedEmpty);
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
          : "fixed inset-0 z-40 flex items-start justify-center bg-neutral-900/40 px-5 pt-[15vh] sm:pt-[20vh] backdrop-blur-md"
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
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
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
              className="h-8 w-8 rounded-lg border-transparent bg-transparent text-neutral-500 shadow-none hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
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
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2 text-[11px] leading-tight text-neutral-500 dark:border-white/10 dark:text-neutral-400">
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
                        <strong className={cn(commandFileName, index === activeIndex ? "text-blue-900 dark:text-blue-100" : "")}>
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
                      <span className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {index === activeIndex && <ChevronRight className="text-blue-500" size={16} />}
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
