import type { FileLibrarySummary, LibrarySelectionV1 } from "../../../types/domain";
import type { BrowsePresentationEntry, LibraryPresentationEntry } from "../presentation/contracts";
import type { PresentationInteractionProjection } from "./interactionContracts";

export interface ContextMenuTarget<Entry> {
  entry: Entry;
  index: number;
}

interface ContextMenuTargetInput<Entry> {
  focusedIndex: number;
  loadedRowCount: number;
  entryAt: (index: number) => Entry | undefined;
  isExplicitlySelected: (entry: Entry) => boolean;
}

/**
 * Resolves only source-confirmed, loaded targets. The selected fallback is
 * deliberately predicate-driven so Library all_matching never becomes an
 * implicit first-row context target.
 */
export function resolveContextMenuTarget<Entry>({
  focusedIndex,
  loadedRowCount,
  entryAt,
  isExplicitlySelected
}: ContextMenuTargetInput<Entry>): ContextMenuTarget<Entry> | null {
  if (focusedIndex >= 0 && focusedIndex < loadedRowCount) {
    const focusedEntry = entryAt(focusedIndex);
    if (focusedEntry !== undefined) return { entry: focusedEntry, index: focusedIndex };
  }

  for (let index = 0; index < loadedRowCount; index += 1) {
    const entry = entryAt(index);
    if (entry !== undefined && isExplicitlySelected(entry)) return { entry, index };
  }

  return null;
}

export function resolveLibraryContextMenuTarget({
  files,
  focusedId,
  selection
}: {
  files: readonly FileLibrarySummary[];
  focusedId: string | null | undefined;
  selection: LibrarySelectionV1 | null | undefined;
}) {
  return resolveContextMenuTarget<FileLibrarySummary>({
    focusedIndex: files.findIndex((file) => file.id === focusedId),
    loadedRowCount: files.length,
    entryAt: (index) => files[index],
    isExplicitlySelected: (file) => selection?.kind === "explicit" && selection.fileIds.includes(file.id)
  });
}

export function resolveBrowseContextMenuTarget({
  entries,
  focusedId,
  selectedIds
}: {
  entries: readonly BrowsePresentationEntry[];
  focusedId: string | null | undefined;
  selectedIds: ReadonlySet<string>;
}) {
  return resolveContextMenuTarget<BrowsePresentationEntry>({
    focusedIndex: entries.findIndex((entry) => entry.entryRef.entryId === focusedId),
    loadedRowCount: entries.length,
    entryAt: (index) => entries[index],
    isExplicitlySelected: (entry) => selectedIds.has(entry.entryRef.entryId)
  });
}

export function resolvePresentationContextMenuTarget(interaction: PresentationInteractionProjection) {
  if (interaction.source === "library") {
    return resolveContextMenuTarget<LibraryPresentationEntry>({
      focusedIndex: interaction.focusedIndex,
      loadedRowCount: interaction.loadedRowCount,
      entryAt: interaction.entryAt,
      isExplicitlySelected: (entry) => interaction.selection?.kind === "explicit" && interaction.selection.fileIds.includes(entry.entryRef.fileId)
    });
  }

  return resolveContextMenuTarget<BrowsePresentationEntry>({
    focusedIndex: interaction.focusedIndex,
    loadedRowCount: interaction.loadedRowCount,
    entryAt: interaction.entryAt,
    isExplicitlySelected: (entry) => interaction.selection.has(entry.entryRef.entryId)
  });
}
