import { Archive, File, FileCode2, FileImage, FileText, Music2, Package, Video } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { Translator } from "../../types/ui";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import { cn } from "../../utils/tw";
import type { OrganizeDecision, OrganizeSuggestion } from "./organizeModel";

const ROW_HEIGHT = 76;

export function OrganizeSuggestionList({
  suggestions,
  activeId,
  batchMode,
  batchIds,
  t,
  onActivate,
  onToggleBatch,
  onKeyDown,
  listRef
}: {
  suggestions: OrganizeSuggestion[];
  activeId: string;
  batchMode: boolean;
  batchIds: Set<string>;
  t: Translator;
  onActivate: (fileId: string) => void;
  onToggleBatch: (fileId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  listRef?: RefObject<HTMLDivElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: suggestions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });
  useEffect(() => {
    const index = suggestions.findIndex((suggestion) => suggestion.file.id === activeId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [activeId, suggestions, virtualizer]);

  return (
    <div
      ref={(node) => { scrollRef.current = node; if (listRef) listRef.current = node; }}
      className="h-full min-h-[260px] overflow-auto overscroll-contain"
      role="list"
      tabIndex={0}
      aria-label={t("organizeSuggestionList")}
      aria-activedescendant={activeId ? `organize-suggestion-${activeId}` : undefined}
      aria-keyshortcuts="ArrowUp ArrowDown Home End Space K E Escape Enter"
      onKeyDown={onKeyDown}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const suggestion = suggestions[virtualRow.index];
          return (
            <div
              key={suggestion.file.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <SuggestionRow
                suggestion={suggestion}
                active={activeId === suggestion.file.id}
                batchMode={batchMode}
                batchSelected={batchIds.has(suggestion.file.id)}
                t={t}
                onActivate={() => onActivate(suggestion.file.id)}
                onToggleBatch={() => onToggleBatch(suggestion.file.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  active,
  batchMode,
  batchSelected,
  t,
  onActivate,
  onToggleBatch
}: {
  suggestion: OrganizeSuggestion;
  active: boolean;
  batchMode: boolean;
  batchSelected: boolean;
  t: Translator;
  onActivate: () => void;
  onToggleBatch: () => void;
}) {
  const Icon = suggestionIcon(suggestion);
  const target = suggestion.effectivePreview?.target_path || suggestion.file.suggested_target_path;
  return (
    <div
      id={`organize-suggestion-${suggestion.file.id}`}
      role="listitem"
      aria-current={active ? "true" : undefined}
      aria-label={`${suggestion.file.name} · ${decisionLabel(suggestion.decision, t)}`}
      data-organize-decision={suggestion.decision}
      className={cn(
        "grid h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--zc-divider)] px-3 text-left transition-[background,border-color,box-shadow] duration-[var(--zc-duration-fast)]",
        "hover:bg-[var(--zc-surface-hover)]",
        active && "bg-[var(--zc-surface-selected)] shadow-[inset_3px_0_0_var(--zc-primary)]",
        batchSelected && "outline outline-1 outline-offset-[-1px] outline-[var(--zc-focus-ring)]"
      )}
      onClick={onActivate}
    >
      <div className="flex items-center gap-2">
        {batchMode ? (
          <input
            type="checkbox"
            checked={batchSelected}
            onChange={onToggleBatch}
            onClick={(event) => event.stopPropagation()}
            aria-label={t("organizeBatchSelectItem").replace("{name}", suggestion.file.name)}
          />
        ) : null}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)]" aria-hidden="true">
          <Icon size={17} />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="min-w-0 truncate text-sm text-[var(--zc-text-primary)]">{suggestion.file.name}</strong>
          {suggestion.preview?.requires_confirmation ? <span className="shrink-0 text-[11px] text-[var(--zc-warning-text)]">{t("organizeNeedsConfirmation")}</span> : null}
        </div>
        <span className="block truncate text-xs text-[var(--zc-text-secondary)]" title={formatDisplayPath(suggestion.file.path)}>{compactPath(formatDisplayPath(suggestion.file.directory), 54)}</span>
        <span className="block truncate text-[11px] text-[var(--zc-text-tertiary)]" title={target ? formatDisplayPath(target) : undefined}>{target ? `${t("organizeTargetShort")}: ${compactPath(formatDisplayPath(target), 54)}` : t("organizeTargetUnavailable")}</span>
      </div>
      <DecisionBadge decision={suggestion.decision} t={t} />
    </div>
  );
}

export function DecisionBadge({ decision, t }: { decision: OrganizeDecision; t: Translator }) {
  const tone = decision === "accepted" || decision === "edited"
    ? "border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] text-[var(--zc-success-text)]"
    : decision === "blocked"
      ? "border-[var(--zc-danger-border)] bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]"
      : decision === "needs-review"
        ? "border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]"
        : "border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)]";
  return <span className={cn("max-w-28 truncate rounded-md border px-2 py-1 text-[11px] font-semibold", tone)}>{decisionLabel(decision, t)}</span>;
}

export function decisionLabel(decision: OrganizeDecision, t: Translator) {
  const key = {
    undecided: "organizeDecisionUndecided",
    accepted: "organizeDecisionAccepted",
    kept: "organizeDecisionKept",
    edited: "organizeDecisionEdited",
    blocked: "organizeDecisionBlocked",
    "needs-review": "organizeDecisionNeedsReview"
  }[decision] as Parameters<Translator>[0];
  return t(key);
}

function suggestionIcon(suggestion: OrganizeSuggestion) {
  const type = suggestion.file.file_type;
  if (type === "Image") return FileImage;
  if (type === "Video") return Video;
  if (type === "Audio") return Music2;
  if (type === "Code") return FileCode2;
  if (type === "ArchivePackage") return Archive;
  if (type === "Installer") return Package;
  if (type === "Document" || type === "Spreadsheet" || type === "Presentation") return FileText;
  return File;
}
