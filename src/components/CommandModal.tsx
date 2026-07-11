import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type * as React from "react";
import { Activity, Archive, ChevronRight, Clock3, Code, CornerDownLeft, FileText, Folder, Image as ImageIcon, LayoutGrid, Radar, Search, Video, X } from "lucide-react";
import { motion } from "motion/react";
import { tauriApi } from "../api/tauriApi";
import type { FileRecord, LibraryScope, OperationLog } from "../types/domain";
import type { Translator, View } from "../types/ui";
import { buttonSecondary, cn, toneClasses } from "../utils/tw";
import { useBackgroundIndexerStore } from "../store/useBackgroundIndexerStore";
import { useFileLibraryStore } from "../store/useFileLibraryStore";
import { useOperationQueueStore } from "../store/useOperationQueueStore";
import { compactPath, formatDisplayPath, readableError } from "../utils/viewHelpers";
import { IconButton, StateBlock, ToneBadge, quietText } from "../views/shared/ui";
import { createCommandRegistry, executeSpotlightCommand, queryCommandRegistry, requestSettingsSection, type SpotlightCommand } from "./spotlight/commandRegistry";
import { buildRecentGroups, groupSpotlightResults, mergeSpotlightResults, type SpotlightResult } from "./spotlight/spotlightModel";
import { cycleDialogFocus, restoreDialogFocus } from "./spotlight/focusTrap";

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
const commandIdleGroups = "grid gap-3 px-4 py-3";
const commandIdleGroup = "grid gap-1 border-b border-[var(--zc-divider)] pb-3 last:border-b-0 last:pb-0";
const commandIdleAction = "flex min-h-10 items-center gap-3 rounded-[var(--zc-radius-control)] px-2.5 text-left text-sm text-[var(--zc-text-secondary)] transition-[background,color] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]";
const commandBackgroundStatus = "flex min-h-9 items-center gap-2 border-t border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-4 text-xs text-[var(--zc-text-secondary)]";
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
  standalone = false,
  restoreFocusRef
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
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FileRecord[]>([]);
  const [queryState, setQueryState] = useState<"idle" | "pending" | "done" | "failed">("idle");
  const [commandError, setCommandError] = useState("");
  const [commandIndexStatus, setCommandIndexStatus] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const enqueueBackgroundIndexRoots = useBackgroundIndexerStore((state) => state.enqueueRoots);
  const isBackgroundIndexing = useBackgroundIndexerStore((state) => state.isBackgroundIndexing);
  const currentBackgroundRoot = useBackgroundIndexerStore((state) => state.currentRoot);
  const pendingBackgroundRoots = useBackgroundIndexerStore((state) => state.pendingRoots.length);
  const libraryFiles = useFileLibraryStore((state) => state.libraryPage.files);
  const operationLogs = useOperationQueueStore((state) => state.operationLogs);
  const trimmedSearch = search.trim();
  const commandRegistry = useMemo(() => createCommandRegistry(t), [t]);
  const commandResults = useMemo(
    () => queryCommandRegistry(trimmedSearch, commandRegistry),
    [commandRegistry, trimmedSearch]
  );
  const visibleResults = useMemo(
    () => mergeSpotlightResults(results, commandResults),
    [commandResults, results]
  );
  const resultGroups = useMemo(() => groupSpotlightResults(visibleResults, t), [t, visibleResults]);
  const recentGroups = useMemo(() => buildRecentGroups(libraryFiles, operationLogs, t), [libraryFiles, operationLogs, t]);
  const showResults = trimmedSearch.length > 0 && visibleResults.length > 0;
  const activeResultId = showResults ? `command-result-${activeIndex}` : undefined;
  const isScopedEmpty = Boolean(searchScopeEmptyMessage);
  const isCustomRootNoResults =
    searchScope?.kind === "roots"
    && searchScope.roots.length > 0
    && trimmedSearch.length > 0
    && queryState === "done"
    && visibleResults.length === 0;
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
    const previous = restoreFocusRef?.current ?? (document.activeElement as HTMLElement | null);
    inputRef.current?.focus();
    return () => {
      if (!standalone) restoreDialogFocus(restoreFocusRef?.current ?? previous);
    };
  }, [inputRef, restoreFocusRef, standalone]);

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

  async function chooseCommand(command: SpotlightCommand) {
    try {
      if (standalone) {
        await activateCommandNavigation({
          standalone,
          view: command.view,
          fileId: null,
          setView,
          setSelectedFileId,
          onClose
        });
        return;
      }
      executeSpotlightCommand(command, { setView, requestSettingsSection, onClose });
    } catch (error) {
      const message = readableError(error);
      setCommandError(message);
      onError?.(message);
    }
  }

  function chooseResult(result: SpotlightResult) {
    if (result.kind === "file") void chooseFile(result.file);
    else void chooseCommand(result);
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

  function openSearchScopeSettings() {
    const command = commandRegistry.find((item) => item.id === "search-scope-settings");
    if (command) void chooseCommand(command);
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
        ref={dialogRef}
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
          if (!standalone && event.key === "Tab" && dialogRef.current) {
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            ));
            cycleDialogFocus(event, focusable, document.activeElement as HTMLElement | null);
          }
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
          const activeResult = visibleResults[activeIndex];
          if (event.key === "Enter" && event.altKey && activeResult?.kind === "file") {
            event.preventDefault();
            void revealFile(activeResult.file);
            return;
          }
          if (isSortingPreviewShortcut(event)) {
            event.preventDefault();
            void openSortingPreview();
            return;
          }
          if (event.key === "Enter" && activeResult) {
            event.preventDefault();
            chooseResult(activeResult);
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
            <button
              className="hidden shrink-0 rounded-md px-2 py-1 font-medium text-[var(--zc-primary-text)] hover:bg-[var(--zc-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)] sm:inline"
              onClick={openSearchScopeSettings}
              aria-label={t("openSearchScopeSettings")}
            >
              {t("commandScopeMeta")}
            </button>
          </div>
        )}
        {showResults && (
          <div className={commandResultsShell}>
            <div className={commandResultsBody}>
              <div className={commandResultsHeader}>
                <span>{t("smartMatches")}</span>
                <span className={cn(quietText, "hidden sm:inline")}>{t("commandKeyboardHint")}</span>
              </div>
              <SpotlightResultGroups
                groups={resultGroups}
                results={visibleResults}
                activeIndex={activeIndex}
                highlight={trimmedSearch}
                t={t}
                onChoose={chooseResult}
                onActivate={setActiveIndex}
                getIcon={getIcon}
                getResultTone={getResultTone}
              />
            </div>
            <div className={commandFooter}>
              <span>{t("matchesFound").replace("{count}", String(visibleResults.length))}</span>
              <div className={shortcutHints}>
                <ShortcutHint badge={<CornerDownLeft className="w-3 h-3" />} label={t("commandOpenHint")} />
                <ShortcutHint badge="↑↓" label={t("commandNavigateHint")} />
                <ShortcutHint badge="ESC" label={t("commandCloseHint")} />
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
            recentGroups={recentGroups}
            onOpen={openIdleDestination}
            onOpenFile={(file) => void chooseFile(file)}
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

function SpotlightResultGroups({
  groups,
  results,
  activeIndex,
  highlight,
  t,
  onChoose,
  onActivate,
  getIcon,
  getResultTone
}: {
  groups: ReturnType<typeof groupSpotlightResults>;
  results: SpotlightResult[];
  activeIndex: number;
  highlight: string;
  t: Translator;
  onChoose: (result: SpotlightResult) => void;
  onActivate: (index: number) => void;
  getIcon: (fileType: string) => React.ReactNode;
  getResultTone: (file: FileRecord) => string;
}) {
  return (
    <div id="command-results" role="listbox" className="grid gap-2">
      {groups.map((group) => (
        <section className="grid gap-1" key={group.type} aria-label={group.label}>
          <h3 className={commandResultsHeader}>{group.label}</h3>
          <div className={commandResultsList}>
            {group.items.map((result) => {
              const index = results.indexOf(result);
              const active = index === activeIndex;
              if (result.kind === "command") {
                return (
                  <button
                    key={`command:${result.id}`}
                    id={`command-result-${index}`}
                    role="option"
                    aria-selected={active}
                    data-result-kind="command"
                    className={cn(commandResultItemBase, active ? commandResultItemActive : commandResultItemInactive)}
                    onClick={() => onChoose(result)}
                    onMouseEnter={() => onActivate(index)}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--zc-primary-soft)] text-[var(--zc-primary-text)]">
                      <Search size={18} />
                    </span>
                    <span className="grid min-w-0 gap-1">
                      <strong className={commandFileName}><HighlightText text={result.label} highlight={highlight} /></strong>
                      <span className={commandFileMeta}>{result.description}</span>
                    </span>
                    <ChevronRight className={active ? "text-[var(--zc-primary)]" : "text-[var(--zc-text-tertiary)]"} size={16} />
                  </button>
                );
              }

              const file = result.file;
              const tone = getResultTone(file);
              const extension = file.extension ? file.extension.replace(".", "").toUpperCase() : file.file_type;
              return (
                <button
                  key={result.id}
                  id={`command-result-${index}`}
                  role="option"
                  aria-selected={active}
                  data-result-kind="file"
                  className={cn(commandResultItemBase, active ? commandResultItemActive : commandResultItemInactive)}
                  onClick={() => onChoose(result)}
                  onMouseEnter={() => onActivate(index)}
                >
                  <span className={cn(commandFileIcon, toneClasses(tone))}>
                    {getIcon(file.extension ? file.extension.replace(".", "") : file.file_type)}
                  </span>
                  <span className="grid min-w-0 gap-1.5">
                    <strong className={commandFileName}><HighlightText text={file.name} highlight={highlight} /></strong>
                    <span className={commandFileMeta} title={formatDisplayPath(file.path)}>{compactPath(formatDisplayPath(file.path), 74)}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <ToneBadge tone={tone as any}>{file.purpose}</ToneBadge>
                      <ToneBadge tone="slate">{extension}</ToneBadge>
                      {file.risk_level !== "Normal" && <ToneBadge tone={file.risk_level === "Sensitive" ? "red" : "amber"}>{file.risk_level === "Sensitive" ? t("sensitiveLabel") : file.risk_level}</ToneBadge>}
                      {file.is_duplicate && <ToneBadge tone="amber">{t("libraryDuplicateFiles")}</ToneBadge>}
                    </span>
                  </span>
                  <ChevronRight className={active ? "text-[var(--zc-primary)]" : "text-[var(--zc-text-tertiary)]"} size={16} />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function CommandIdleGroups({
  t,
  isBackgroundIndexing,
  currentBackgroundRoot,
  pendingBackgroundRoots,
  recentGroups,
  onOpen,
  onOpenFile
}: {
  t: Translator;
  isBackgroundIndexing: boolean;
  currentBackgroundRoot: string | null;
  pendingBackgroundRoots: number;
  recentGroups: ReturnType<typeof buildRecentGroups>;
  onOpen: (view: View) => void;
  onOpenFile: (file: FileRecord) => void;
}) {
  const backgroundDescription = isBackgroundIndexing && currentBackgroundRoot
    ? compactPath(formatDisplayPath(currentBackgroundRoot), 42)
    : pendingBackgroundRoots > 0
      ? t("spotlightPendingTasks").replace("{count}", String(pendingBackgroundRoots))
      : t("spotlightNoBackgroundTasks");

  return (
    <>
      <div className={commandIdleGroups} aria-label={t("commandIdleTitle")}>
        {recentGroups.map((group) => (
          <IdleGroup title={group.label} key={group.type}>
            {group.type === "recent-files"
              ? group.items.map((file) => (
                  <IdleAction key={file.id} icon={Archive} label={file.name} onClick={() => onOpenFile(file)} />
                ))
              : group.items.map((operation) => (
                  <IdleAction key={operation.id} icon={Clock3} label={operationLabel(operation)} onClick={() => onOpen("restore")} />
                ))}
          </IdleGroup>
        ))}
        <IdleGroup title={t("spotlightCommonTasks")}>
          <IdleAction icon={Radar} label={t("overview")} onClick={() => onOpen("scanner")} />
          <IdleAction icon={LayoutGrid} label={t("organizeSuggestions")} onClick={() => onOpen("organize")} />
        </IdleGroup>
      </div>
      <div className={commandBackgroundStatus} role="status" aria-label={t("spotlightBackgroundTasks")}>
        <Activity size={15} className={isBackgroundIndexing ? "animate-pulse text-[var(--zc-primary)]" : "text-[var(--zc-text-tertiary)]"} />
        <span className="min-w-0 truncate">{backgroundDescription}</span>
      </div>
    </>
  );
}

function operationLabel(operation: OperationLog) {
  const from = operation.old_name || operation.name_before || operation.source_path;
  const to = operation.new_name || operation.name_after || operation.target_path;
  return from && to && from !== to ? `${from} → ${to}` : to || from || operation.operation_type;
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
