import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FileType, LibrarySavedView } from "../../../types/domain";
import type { NavigationTarget } from "../../../types/fileWorkspace";
import type { Translator } from "../../../types/ui";
import type { FileLibraryExperienceController } from "../fileLibraryExperience";
import type { LibrarySourceOwner } from "./librarySourceOwner";

const LIBRARY_FILE_TYPES: readonly FileType[] = [
  "Document",
  "Image",
  "Video",
  "Audio",
  "Code",
  "ArchivePackage",
  "Installer",
  "Spreadsheet",
  "Presentation",
  "Other"
];

export type LibraryNavigationGroup = "library" | "types" | "saved" | "tags";

export interface LibraryNavigationEntry {
  id: string;
  label: string;
  target: Extract<NavigationTarget, { kind: "library" }>;
  active: boolean;
  activate: () => void;
}

export interface LibraryNavigationSurface {
  signature: string;
  all: LibraryNavigationEntry;
  types: readonly LibraryNavigationEntry[];
  savedViews: readonly LibraryNavigationEntry[];
  tags: readonly LibraryNavigationEntry[];
}

interface LibraryNavigationSurfaceContextValue {
  surface: LibraryNavigationSurface | null;
  register: (surface: LibraryNavigationSurface) => void;
  clear: () => void;
}

const LibraryNavigationSurfaceContext = createContext<LibraryNavigationSurfaceContextValue | null>(null);

export function LibraryNavigationSurfaceProvider({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<LibraryNavigationSurface | null>(null);
  const register = useCallback((next: LibraryNavigationSurface) => {
    setSurface((current) => current?.signature === next.signature ? current : next);
  }, []);
  const clear = useCallback(() => setSurface(null), []);
  const value = useMemo<LibraryNavigationSurfaceContextValue>(() => ({
    surface,
    register,
    clear
  }), [clear, register, surface]);
  return <LibraryNavigationSurfaceContext.Provider value={value}>{children}</LibraryNavigationSurfaceContext.Provider>;
}

export function useLibraryNavigationSurface() {
  return useContext(LibraryNavigationSurfaceContext)?.surface ?? null;
}

export function useRegisterLibraryNavigationSurface({
  source,
  controller,
  currentTarget,
  t
}: {
  source: LibrarySourceOwner;
  controller: FileLibraryExperienceController;
  currentTarget: NavigationTarget | null;
  t: Translator;
}) {
  const context = useContext(LibraryNavigationSurfaceContext);
  const surface = useMemo(() => createLibraryNavigationSurface({ source, controller, currentTarget, t }), [
    controller,
    currentTarget,
    source.activeViewId,
    source.querySpec,
    source.savedViews,
    source.scope,
    source.tags,
    t,
    source.applySavedView,
    source.clearFilters,
    source.handleLibrarySearchChange,
    source.setScope,
    source.updateFilters
  ]);
  const latestSurfaceRef = useRef(surface);
  latestSurfaceRef.current = surface;

  useEffect(() => {
    if (!context) return;
    context.register(latestSurfaceRef.current);
    return context.clear;
  }, [context?.clear, context?.register, surface.signature]);
}

export function createLibraryNavigationSurface({
  source,
  controller,
  currentTarget,
  t
}: {
  source: LibrarySourceOwner;
  controller: FileLibraryExperienceController;
  currentTarget: NavigationTarget | null;
  t: Translator;
}): LibraryNavigationSurface {
  const allTarget = libraryTarget("all");
  const all = {
    id: "all",
    label: t("fileLibraryNavigationAll"),
    target: allTarget,
    active: isAllNavigationActive(source, currentTarget),
    activate: () => {
      source.setScope({ kind: "all" });
      source.clearFilters();
      source.handleLibrarySearchChange("");
      controller.navigate(allTarget);
    }
  } satisfies LibraryNavigationEntry;

  const types = LIBRARY_FILE_TYPES.map((fileType) => {
    const target = libraryTarget(`type:${fileType}`);
    return {
      id: `type:${fileType}`,
      label: fileTypeLabel(fileType, t),
      target,
      active: isTypeNavigationActive(source, currentTarget, fileType),
      activate: () => {
        source.updateFilters({ fileTypes: [fileType] });
        controller.navigate(target);
      }
    } satisfies LibraryNavigationEntry;
  });

  const savedViews = source.savedViews.map((view) => {
    const target = libraryTarget(`saved:${view.id}`);
    return {
      id: `saved:${view.id}`,
      label: view.displayName,
      target,
      active: isSavedNavigationActive(source, currentTarget, view),
      activate: () => {
        source.applySavedView(view);
        controller.navigate(target);
      }
    } satisfies LibraryNavigationEntry;
  });

  const tags = source.tags.map((tag) => {
    const target = libraryTarget(`tag:${tag.id}`);
    return {
      id: `tag:${tag.id}`,
      label: tag.displayName,
      target,
      active: isTagNavigationActive(source, currentTarget, tag.id),
      activate: () => {
        source.updateFilters({ tagsAllOf: [tag.id] });
        controller.navigate(target);
      }
    } satisfies LibraryNavigationEntry;
  });

  return {
    signature: JSON.stringify({
      target: currentTarget,
      all: all.active,
      types: types.map((entry) => [entry.id, entry.active]),
      savedViews: savedViews.map((entry) => [entry.id, entry.active]),
      tags: tags.map((entry) => [entry.id, entry.active])
    }),
    all,
    types,
    savedViews,
    tags
  };
}

export function applyLibraryNavigationTarget(
  target: NavigationTarget | null,
  source: LibrarySourceOwner
) {
  const key = libraryNavigationKey(target);
  if (key === null) return false;
  if (key === "all") {
    if (source.scope.kind === "all" && isQueryUnfiltered(source)) return true;
    source.setScope({ kind: "all" });
    source.clearFilters();
    source.handleLibrarySearchChange("");
    return true;
  }
  if (key.startsWith("type:")) {
    const fileType = key.slice("type:".length) as FileType;
    if (!LIBRARY_FILE_TYPES.includes(fileType)) return false;
    if (source.querySpec.filters.fileTypes.length === 1 && source.querySpec.filters.fileTypes[0] === fileType) return true;
    source.updateFilters({ fileTypes: [fileType] });
    return true;
  }
  if (key.startsWith("saved:")) {
    const view = source.savedViews.find((candidate) => candidate.id === key.slice("saved:".length));
    if (!view) return false;
    if (source.activeViewId === view.id && JSON.stringify(source.querySpec) === JSON.stringify(view.query)) return true;
    source.applySavedView(view);
    return true;
  }
  if (key.startsWith("tag:")) {
    const tagId = key.slice("tag:".length);
    if (!source.tags.some((tag) => tag.id === tagId)) return false;
    if (source.querySpec.filters.tagsAllOf.length === 1 && source.querySpec.filters.tagsAllOf[0] === tagId) return true;
    source.updateFilters({ tagsAllOf: [tagId] });
    return true;
  }
  return false;
}

export function libraryNavigationKey(target: NavigationTarget | null): string | null {
  if (target?.kind !== "library") return null;
  if (target.source === "custom" && ["all"].includes(target.key)) return target.key;
  if (target.source === "custom" && /^(type|saved|tag):/u.test(target.key)) return target.key;
  if (target.source === "smart_view" && target.key === "all") return "all";
  if (target.source === "saved_view") return `saved:${target.key}`;
  if (target.source === "tag") return `tag:${target.key}`;
  return null;
}

function libraryTarget(key: string): Extract<NavigationTarget, { kind: "library" }> {
  return { kind: "library", source: "custom", key };
}

function isCurrentTarget(target: NavigationTarget | null, key: string) {
  return libraryNavigationKey(target) === key;
}

function isAllNavigationActive(source: LibrarySourceOwner, target: NavigationTarget | null) {
  return isCurrentTarget(target, "all") && source.scope.kind === "all" && isQueryUnfiltered(source);
}

function isTypeNavigationActive(source: LibrarySourceOwner, target: NavigationTarget | null, fileType: FileType) {
  return isCurrentTarget(target, `type:${fileType}`)
    && source.querySpec.filters.fileTypes.length === 1
    && source.querySpec.filters.fileTypes[0] === fileType;
}

function isSavedNavigationActive(source: LibrarySourceOwner, target: NavigationTarget | null, view: LibrarySavedView) {
  return isCurrentTarget(target, `saved:${view.id}`)
    && source.activeViewId === view.id
    && JSON.stringify(source.querySpec) === JSON.stringify(view.query);
}

function isTagNavigationActive(source: LibrarySourceOwner, target: NavigationTarget | null, tagId: string) {
  return isCurrentTarget(target, `tag:${tagId}`)
    && source.querySpec.filters.tagsAllOf.length === 1
    && source.querySpec.filters.tagsAllOf[0] === tagId;
}

function isQueryUnfiltered(source: LibrarySourceOwner) {
  const { querySpec } = source;
  const filters = querySpec.filters;
  return (querySpec.text ?? "").trim() === ""
    && filters.fileTypes.length === 0
    && filters.purposes.length === 0
    && filters.lifecycles.length === 0
    && filters.risks.length === 0
    && filters.sizeMin === null
    && filters.sizeMax === null
    && filters.modifiedFrom === null
    && filters.modifiedTo === null
    && filters.createdFrom === null
    && filters.createdTo === null
    && filters.duplicate === "any"
    && filters.review === "any"
    && filters.tagsAllOf.length === 0
    && filters.tagsAnyOf.length === 0
    && filters.tagsNoneOf.length === 0;
}

function fileTypeLabel(fileType: FileType, t: Translator) {
  return t(`libraryType${fileType === "ArchivePackage" ? "Archive" : fileType}` as Parameters<Translator>[0]);
}
