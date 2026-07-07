import { useEffect, useMemo, useState, type RefObject } from "react";
import { ChevronRight, File, Search, X } from "lucide-react";
import { tauriApi } from "../api/tauriApi";
import type { FileRecord, LibraryScope } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { buttonSecondary, cn, toneClasses } from "../utils/tw";
import { useBackgroundIndexerStore } from "../store/useBackgroundIndexerStore";
import { compactPath, readableError } from "../utils/viewHelpers";
import { IconButton, StateBlock, ToneBadge, quietText } from "../views/shared/ui";

const keyBadge =
  "rounded-md border border-[var(--line-dark)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--quiet)] shadow-sm";
const commandHintText = "text-[11px] leading-tight text-[var(--quiet)]";
const commandShellBase =
  "w-full overflow-hidden border border-[var(--line)] bg-[rgba(248,250,252,0.94)] backdrop-blur-xl transition-[border-radius,background,box-shadow] dark:border-slate-700/80 dark:bg-[rgba(15,23,42,0.96)]";
const commandShellCollapsed =
  "h-full max-w-none rounded-full shadow-[0_14px_42px_rgba(15,23,42,0.18),0_1px_0_rgba(255,255,255,0.64)_inset] dark:shadow-[0_16px_44px_rgba(0,0,0,0.42),0_1px_0_rgba(255,255,255,0.08)_inset]";
const commandShellExpanded =
  "max-w-[720px] rounded-[1.7rem] shadow-[0_24px_76px_rgba(15,23,42,0.24),0_1px_0_rgba(255,255,255,0.72)_inset] dark:shadow-[0_28px_86px_rgba(0,0,0,0.74),0_1px_0_rgba(255,255,255,0.08)_inset]";
const commandShellStandaloneExpanded = "max-w-none";
const commandShortcutHints = "flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1";
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
          : "fixed inset-0 z-40 flex items-start justify-center bg-slate-950/20 px-5 pt-[12vh] backdrop-blur-lg"
      )}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={cn(
          commandShellBase,
          isStandaloneCollapsed ? commandShellCollapsed : commandShellExpanded,
          standalone && !isStandaloneCollapsed && commandShellStandaloneExpanded
        )}
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
            "flex items-center gap-3 border border-transparent px-5 transition-[border-color,box-shadow]",
            isStandaloneCollapsed ? "h-full min-h-0" : "h-[60px] min-h-[60px]",
            inputFocused && "border-blue-400/35 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08),0_0_0_3px_rgba(59,130,246,0.08)]",
            (showResults || shouldShowStateBlock || showScopeMeta) && "border-b-[var(--line-dark)]"
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-blue-400/22 bg-blue-500/10 text-blue-600 dark:text-blue-300">
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
            className="command-input h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--quiet)] focus-visible:outline-none"
          />
          {search && (
            <IconButton
              className="h-8 w-8 rounded-full border-transparent bg-transparent shadow-none"
              onClick={clearSearch}
              aria-label={t("commandClearSearch")}
              title={t("commandClearSearch")}
            >
              <X size={16} strokeWidth={2.5} />
            </IconButton>
          )}
          <kbd className={cn(keyBadge, "hidden px-2 py-1 text-[10px] sm:inline-flex")}>ESC</kbd>
        </div>
        {showScopeMeta && (
          <div className={cn(commandHintText, "flex items-center justify-between gap-3 px-5 py-2")}>
            <span className="min-w-0 truncate">{searchScopeLabel}</span>
            <span className="hidden shrink-0 sm:inline">{t("commandScopeMeta")}</span>
          </div>
        )}
        {showResults && (
          <div className="grid min-h-0 gap-0">
            <div className="min-h-0 px-3 py-3">
              <div className="flex items-center justify-between gap-3 px-3 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--quiet)]">{t("smartMatches")}</span>
                <span className={cn(quietText, "hidden sm:inline")}>{t("commandKeyboardHint")}</span>
              </div>
              <div id="command-results" role="listbox" className="grid max-h-[360px] gap-1 overflow-y-auto overscroll-contain pr-1">
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
                        "grid min-h-[74px] grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-[background,border-color,box-shadow,color]",
                        index === activeIndex
                          ? "border-blue-400/36 bg-blue-500/9 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08),0_0_0_3px_rgba(59,130,246,0.08)]"
                          : "border-transparent hover:bg-[var(--surface-soft)] dark:hover:bg-slate-800/90"
                      )}
                      onClick={() => void chooseFile(file)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={cn("grid h-10 w-10 place-items-center rounded-xl border", toneClasses(tone))}>
                        <File size={20} strokeWidth={1.5} />
                      </span>
                      <span className="grid min-w-0 gap-1.5">
                        <strong className="block truncate text-sm font-semibold text-[var(--ink)]">
                          <HighlightText text={file.name} highlight={trimmedSearch} />
                        </strong>
                        <span className={cn(quietText, "block truncate")} title={file.path}>{compactPath(file.path, 74)}</span>
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <ToneBadge tone="info">{file.purpose}</ToneBadge>
                          <ToneBadge tone="slate">{extension}</ToneBadge>
                          {file.risk_level !== "Normal" && <ToneBadge tone={file.risk_level === "Sensitive" ? "warning" : "amber"}>{file.risk_level === "Sensitive" ? t("sensitiveLabel") : file.risk_level}</ToneBadge>}
                          {file.is_duplicate && <ToneBadge tone="warning">{t("libraryDuplicateFiles")}</ToneBadge>}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-[var(--quiet)]">
                        {index === activeIndex && <ChevronRight className="text-blue-500" size={16} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line-dark)] px-5 py-3 text-xs text-[var(--muted)]">
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
      </div>
    </div>
  );
}

function ShortcutHint({ badge, label }: { badge: string; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
      <kbd className={keyBadge}>{badge}</kbd>
      <span className="hidden max-w-24 truncate sm:inline">{label}</span>
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
          ? <mark className="rounded bg-blue-400/20 px-0.5 text-blue-700 dark:text-blue-200" key={`${part}-${index}`}>{part}</mark>
          : <span key={`${part}-${index}`}>{part}</span>
      ))}
    </>
  );
}
