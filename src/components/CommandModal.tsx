import { useEffect, useMemo, useState, type RefObject } from "react";
import { ChevronRight, File, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { tauriApi } from "../api/tauriApi";
import type { FileRecord, LibraryScope } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { buttonSecondary, cn, toneClasses } from "../utils/tw";
import { useBackgroundIndexerStore } from "../store/useBackgroundIndexerStore";
import { compactPath, readableError } from "../utils/viewHelpers";
import { IconButton, StateBlock, ToneBadge, quietText } from "../views/shared/ui";

const keyBadge =
  "rounded bg-white px-1.5 py-0.5 font-sans text-xs font-medium text-neutral-600 shadow-sm border border-neutral-200 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300";
const commandHintText = "text-[11px] leading-tight text-[var(--quiet)]";
const commandShellBase =
  "w-full overflow-hidden bg-white/95 shadow-2xl ring-1 ring-neutral-200/50 backdrop-blur-xl transition-[border-radius,background,box-shadow] dark:bg-neutral-900/95 dark:ring-white/10";
const commandShellCollapsed =
  "h-full max-w-none rounded-full";
const commandShellExpanded =
  "rounded-2xl";
const commandShellDialogWidth = "max-w-[720px]";
const commandShellStandaloneExpanded = "max-w-none";
const commandShortcutHints = "flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1";
const commandInputRowBase =
  "flex h-16 min-h-16 items-center gap-3 border-b border-neutral-100 px-5 transition-colors dark:border-white/10";
const commandInputRowCollapsed =
  "flex h-full min-h-0 items-center gap-3 border-b-0 px-5 transition-colors";
const commandInputRowFocused = "bg-white/70 dark:bg-white/[0.03]";
const commandSearchIcon =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/15 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/20";
const commandInput =
  "command-input h-full min-w-0 flex-1 bg-transparent text-lg text-neutral-900 outline-none placeholder:text-neutral-400 focus:outline-none focus-visible:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500";
const commandClearButton =
  "h-8 w-8 rounded-lg border-transparent bg-transparent text-neutral-500 shadow-none hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100";
const commandScopeMeta =
  "flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-2 dark:border-white/10";
const commandResultsShell = "grid min-h-0 gap-0";
const commandResultsBody = "min-h-0 px-3 py-3";
const commandResultsHeader = "flex items-center justify-between gap-3 px-3 pb-2";
const commandResultsTitle =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400";
const commandResultsList = "grid max-h-[360px] gap-1 overflow-y-auto overscroll-contain pr-1";
const commandResultItemBase =
  "grid min-h-[74px] grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-transparent transition-[background,box-shadow,color]";
const commandResultItemActive = "bg-blue-50/80 ring-blue-500/20 dark:bg-blue-500/10";
const commandResultItemInactive = "hover:bg-neutral-50 dark:hover:bg-white/[0.04]";
const commandFileIcon =
  "flex h-10 w-10 items-center justify-center rounded-lg border";
const commandFileName = "block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100";
const commandFileMeta = "block truncate text-xs text-neutral-500 dark:text-neutral-400";
const commandBadges = "flex min-w-0 flex-wrap items-center gap-1.5";
const commandResultChevron = "flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400";
const commandFooter =
  "flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-3 text-xs text-neutral-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-neutral-400";
const commandStateWrapper = "px-4 py-4";
const shortcutHint = "inline-flex min-w-0 items-center gap-1 whitespace-nowrap";
const shortcutHintLabel = "hidden max-w-24 truncate text-neutral-500 sm:inline dark:text-neutral-400";
const highlightMark =
  "rounded-sm bg-blue-100/50 px-1 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200";
const SEARCH_RESULT_LIMIT = 80;
const standaloneSearchWindowCollapsedHeight = 92;
const standaloneSearchWindowExpandedHeight = 520;

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
  platform,
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
  const locateKey = platform === "darwin" ? "⌥↵" : "Alt↵";
  const sortingPreviewKey = platform === "darwin" ? "⌘↵ / ⌘P" : "Ctrl↵ / Ctrl P";
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
    if (file.risk_level === "Sensitive") return "red";
    if (file.lifecycle === "Archive") return "purple";
    return "blue";
  }

  return (
    <div
      className={cn(
        standalone
          ? "relative z-10 flex h-full w-full items-center justify-center bg-transparent p-0"
          : "fixed inset-0 z-40 flex items-start justify-center bg-neutral-950/25 px-5 pt-[12vh] backdrop-blur-lg"
      )}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        className={cn(
          commandShellBase,
          isStandaloneCollapsed ? commandShellCollapsed : commandShellExpanded,
          !isStandaloneCollapsed && (standalone ? commandShellStandaloneExpanded : commandShellDialogWidth)
        )}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
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
              className={commandClearButton}
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
          <div className={cn(commandHintText, commandScopeMeta)}>
            <span className="min-w-0 truncate">{searchScopeLabel}</span>
            <span className="hidden shrink-0 sm:inline">{t("commandScopeMeta")}</span>
          </div>
        )}
        {showResults && (
          <div className={commandResultsShell}>
            <div className={commandResultsBody}>
              <div className={commandResultsHeader}>
                <span className={commandResultsTitle}>{t("smartMatches")}</span>
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
                        <File size={20} strokeWidth={1.5} />
                      </span>
                      <span className="grid min-w-0 gap-1.5">
                        <strong className={commandFileName}>
                          <HighlightText text={file.name} highlight={trimmedSearch} />
                        </strong>
                        <span className={commandFileMeta} title={file.path}>{compactPath(file.path, 74)}</span>
                        <span className={commandBadges}>
                          <ToneBadge tone="info">{file.purpose}</ToneBadge>
                          <ToneBadge tone="slate">{extension}</ToneBadge>
                          {file.risk_level !== "Normal" && <ToneBadge tone={file.risk_level === "Sensitive" ? "warning" : "amber"}>{file.risk_level === "Sensitive" ? t("sensitiveLabel") : file.risk_level}</ToneBadge>}
                          {file.is_duplicate && <ToneBadge tone="warning">{t("libraryDuplicateFiles")}</ToneBadge>}
                        </span>
                      </span>
                      <span className={commandResultChevron}>
                        {index === activeIndex && <ChevronRight className="text-blue-500" size={16} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={commandFooter}>
              <span>{t("matchesFound").replace("{count}", String(visibleResults.length))}</span>
              <div className={commandShortcutHints}>
                <ShortcutHint badge="↵" label={t("commandOpenHint")} />
                <ShortcutHint badge={locateKey} label={t("commandRevealHint")} />
                <ShortcutHint badge={sortingPreviewKey} label={t("commandPreviewHint")} />
              </div>
            </div>
          </div>
        )}
        {shouldShowStateBlock && (
          <div className={commandStateWrapper} aria-live={queryState === "failed" ? "assertive" : "polite"} role={queryState === "failed" ? "alert" : "status"}>
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

function ShortcutHint({ badge, label }: { badge: string; label: string }) {
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
