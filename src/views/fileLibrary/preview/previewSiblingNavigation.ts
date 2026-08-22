import type { PreviewSourceProjection } from "./previewSource";

export type PreviewSiblingDirection = "previous" | "next";

/**
 * A bounded navigation projection supplied by the current source owner.
 *
 * The projection contains only the current loaded neighborhood and owner
 * callbacks. It never stores a Query V2 result, Browse page or hidden Preview
 * selection, so a generation change can fail closed without retaining stale
 * collection data.
 */
export interface PreviewSiblingNavigationProjection {
  readonly source: PreviewSourceProjection["source"];
  readonly generation: string;
  readonly currentKey: string;
  readonly currentIndex: number;
  readonly loadedCount: number;
  readonly hasMore: boolean;
  readonly move: (direction: PreviewSiblingDirection) => boolean | Promise<boolean>;
}

export interface PreviewSiblingNavigationState {
  readonly source: PreviewSourceProjection["source"];
  readonly generation: string;
  readonly currentKey: string;
  readonly currentIndex: number;
  readonly loadedCount: number;
  readonly previousAvailable: boolean;
  readonly nextAvailable: boolean;
}

export function createPreviewSiblingNavigation(
  projection: Omit<PreviewSiblingNavigationProjection, "currentIndex" | "loadedCount" | "hasMore"> & {
    readonly currentIndex: number;
    readonly loadedCount: number;
    readonly hasMore: boolean;
  }
): PreviewSiblingNavigationProjection {
  return projection;
}

export function previewSiblingNavigationState(
  projection: PreviewSiblingNavigationProjection | null,
  source: PreviewSourceProjection | null
): PreviewSiblingNavigationState | null {
  if (projection === null || source === null) return null;
  if (projection.source !== source.source
    || projection.generation !== source.generation
    || projection.currentKey !== source.key
    || projection.currentIndex < 0
    || projection.currentIndex >= projection.loadedCount) {
    return null;
  }

  return {
    source: projection.source,
    generation: projection.generation,
    currentKey: projection.currentKey,
    currentIndex: projection.currentIndex,
    loadedCount: projection.loadedCount,
    previousAvailable: projection.currentIndex > 0,
    nextAvailable: projection.currentIndex + 1 < projection.loadedCount || projection.hasMore
  };
}
