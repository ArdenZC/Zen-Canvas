import { FileText, Folder, FolderOpen } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Language } from "../../../i18n";
import type { Translator } from "../../../types/ui";
import { formatBytes, formatDate } from "../../../utils/format";
import type { BrowsePresentationEntry } from "../presentation/contracts";
import type { BrowseSelectionIntent, BrowseSourceOwner } from "./browseSourceOwner";

type BrowseListSource = Pick<
  BrowseSourceOwner,
  "entries" | "selectedIds" | "focusedId" | "selectEntry" | "navigateInto" | "setFocusedId" | "selectAllLoaded" | "clearSelection"
>;

export function BrowseEntryList({
  source,
  language,
  t
}: {
  source: BrowseListSource;
  language: Language;
  t: Translator;
}) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const entries = source.entries;

  useEffect(() => {
    if (source.focusedId === null) return;
    rowRefs.current.get(source.focusedId)?.focus();
  }, [source.focusedId]);

  const focusEntry = (entry: BrowsePresentationEntry, intent: BrowseSelectionIntent = "replace") => {
    source.selectEntry(entry.entryRef.entryId, intent);
  };

  const moveFocus = (index: number, range: boolean) => {
    if (entries.length === 0) return;
    const bounded = Math.max(0, Math.min(entries.length - 1, index));
    focusEntry(entries[bounded], range ? "range" : "replace");
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      source.selectAllLoaded();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      source.clearSelection();
      return;
    }
    const currentIndex = source.focusedId === null
      ? -1
      : entries.findIndex((entry) => entry.entryRef.entryId === source.focusedId);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(currentIndex < 0 ? 0 : currentIndex + 1, event.shiftKey);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(currentIndex <= 0 ? 0 : currentIndex - 1, event.shiftKey);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0, event.shiftKey);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(entries.length - 1, event.shiftKey);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      moveFocus((currentIndex < 0 ? 0 : currentIndex) + 8, event.shiftKey);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      moveFocus((currentIndex < 0 ? 0 : currentIndex) - 8, event.shiftKey);
    }
  };

  return (
    <div
      className="browse-entry-list"
      role="listbox"
      tabIndex={0}
      aria-label={t("browseCurrentFolder")}
      aria-multiselectable="true"
      aria-busy="false"
      data-browse-list="true"
      data-browse-logical-count={entries.length}
      onKeyDown={handleKeyDown}
    >
      {entries.map((entry) => {
        const entryId = entry.entryRef.entryId;
        const selected = source.selectedIds.has(entryId);
        const focused = source.focusedId === entryId;
        const isDirectory = entry.entryKind === "directory";
        const materializationLabel = browseMaterializationLabel(entry, t);
        return (
          <div
            key={entry.renderKey}
            ref={(node) => {
              if (node) rowRefs.current.set(entryId, node);
              else rowRefs.current.delete(entryId);
            }}
            className={`browse-entry-row${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}`}
            role="option"
            tabIndex={focused ? 0 : -1}
            aria-selected={selected}
            aria-label={`${entry.displayName}, ${isDirectory ? t("browseFolder") : t("browseFile")}`}
            data-browse-entry="true"
            data-browse-entry-id={entryId}
            data-browse-entry-kind={entry.entryKind}
            onFocus={() => source.setFocusedId(entryId)}
            onClick={(event) => {
              const intent = event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "replace";
              focusEntry(entry, intent);
            }}
            onDoubleClick={() => {
              if (isDirectory) source.navigateInto(entry);
            }}
          >
            <span className="browse-entry-icon" aria-hidden="true">
              {isDirectory ? <Folder size={18} /> : <FileText size={18} />}
            </span>
            <span className="browse-entry-main">
              <strong className="browse-entry-name">{entry.displayName}</strong>
              <span className="browse-entry-kind">{isDirectory ? t("browseFolder") : t("browseFile")}</span>
            </span>
            <span className="browse-entry-meta">
              <span>{entry.size === undefined ? t("browseUnknownValue") : formatBytes(entry.size)}</span>
              <time dateTime={entry.modifiedAt === undefined ? undefined : String(entry.modifiedAt)}>
                {entry.modifiedAt === undefined ? t("browseUnknownValue") : formatDate(String(entry.modifiedAt), language)}
              </time>
              {materializationLabel ? <span>{materializationLabel}</span> : null}
            </span>
            {isDirectory ? (
              <button
                className="browse-entry-open"
                type="button"
                aria-label={`${t("browseOpenFolder")}: ${entry.displayName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  source.navigateInto(entry);
                }}
              >
                <FolderOpen size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function browseMaterializationLabel(entry: BrowsePresentationEntry, t: Translator): string | undefined {
  switch (entry.materialization) {
    case "metadata_only":
      return t("browseMaterializationMetadata");
    case "remote_placeholder":
      return t("browseMaterializationRemote");
    case "hydrating":
      return t("browseMaterializationHydrating");
    case "unavailable":
      return t("browseMaterializationUnavailable");
    case "unknown":
      return t("browseMaterializationUnknown");
    default:
      return undefined;
  }
}
