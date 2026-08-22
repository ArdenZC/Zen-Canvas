import type { MaterializationState, PreviewSourceRef } from "../../../types/fileWorkspace";
import type {
  BrowsePresentationCollectionContext,
  BrowsePresentationEntry,
  LibraryPresentationCollectionContext,
  LibraryPresentationEntry,
  PresentationCollectionContext,
  PresentationEntry
} from "../presentation/contracts";

export interface PreviewSourceProjection {
  readonly key: string;
  readonly source: "library" | "browse";
  readonly previewSource: Extract<PreviewSourceRef, { kind: "managed" | "ephemeral" }>;
  readonly displayName: string;
  readonly entryKind: "file" | "directory";
  readonly extension?: string;
  readonly typeHint?: string;
  readonly size?: number;
  readonly modifiedAt?: number;
  readonly createdAt?: number;
  readonly materialization?: MaterializationState;
}

/**
 * Converts one currently loaded presentation entry into the existing opaque
 * PreviewSourceRef contract. This function intentionally has no path input,
 * path reconstruction or all-matching expansion surface.
 */
export function previewSourceFromEntry(
  entry: PresentationEntry | undefined,
  collection: PresentationCollectionContext | null
): PreviewSourceProjection | null {
  if (entry === undefined || collection === null || entry.source !== collection.source) return null;

  if (entry.source === "library" && collection.source === "library") {
    return previewSourceFromLibraryEntry(entry, collection);
  }
  if (entry.source === "browse" && collection.source === "browse") {
    return previewSourceFromBrowseEntry(entry, collection);
  }
  return null;
}

function previewSourceFromLibraryEntry(
  entry: LibraryPresentationEntry,
  collection: LibraryPresentationCollectionContext
): PreviewSourceProjection | null {
  if (entry.entryRef.kind !== "managed" || entry.entryRef.fileId.length === 0) return null;
  const fileId = entry.entryRef.fileId;
  return {
    key: `library:${collection.provenance.queryFingerprint}:${collection.provenance.snapshotRevision}:${fileId}`,
    source: "library",
    previewSource: { kind: "managed", fileId },
    displayName: entry.displayName,
    entryKind: entry.entryKind,
    ...(entry.extension === undefined ? {} : { extension: entry.extension }),
    ...(entry.typeHint === undefined ? {} : { typeHint: entry.typeHint }),
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(entry.modifiedAt === undefined ? {} : { modifiedAt: entry.modifiedAt }),
    ...(entry.createdAt === undefined ? {} : { createdAt: entry.createdAt }),
    ...(entry.materialization === undefined ? {} : { materialization: entry.materialization })
  };
}

function previewSourceFromBrowseEntry(
  entry: BrowsePresentationEntry,
  collection: BrowsePresentationCollectionContext
): PreviewSourceProjection | null {
  const { entryRef } = entry;
  if (entryRef.browseSessionId !== collection.provenance.sessionId || entryRef.entryId.length === 0) return null;
  return {
    key: `browse:${collection.provenance.sessionId}:${collection.provenance.enumerationId}:${entryRef.entryId}`,
    source: "browse",
    previewSource: {
      kind: "ephemeral",
      browseSessionId: entryRef.browseSessionId,
      entryId: entryRef.entryId
    },
    displayName: entry.displayName,
    entryKind: entry.entryKind,
    ...(entry.extension === undefined ? {} : { extension: entry.extension }),
    ...(entry.typeHint === undefined ? {} : { typeHint: entry.typeHint }),
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(entry.modifiedAt === undefined ? {} : { modifiedAt: entry.modifiedAt }),
    ...(entry.createdAt === undefined ? {} : { createdAt: entry.createdAt }),
    ...(entry.materialization === undefined ? {} : { materialization: entry.materialization })
  };
}
