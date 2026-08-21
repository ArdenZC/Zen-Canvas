import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { SearchField } from "../shared/ui";
import type { Translator } from "../../types/ui";

export type FileLibraryCommandBarSurfaceOwner = "library" | "browse";

export interface FileLibraryCommandBarSurface {
  owner: FileLibraryCommandBarSurfaceOwner;
  search: ReactNode;
  actions?: ReactNode;
  searchInputRef: RefObject<HTMLInputElement | null>;
  enabled: boolean;
}

interface FileLibraryCommandBarSurfaceContextValue {
  registerSurface: (surface: FileLibraryCommandBarSurface) => void;
  clearSurface: (owner: FileLibraryCommandBarSurfaceOwner) => void;
}

const FileLibraryCommandBarSurfaceContext = createContext<FileLibraryCommandBarSurfaceContextValue | null>(null);

export function FileLibraryCommandBarSurfaceProvider({
  value,
  children
}: {
  value: FileLibraryCommandBarSurfaceContextValue;
  children: ReactNode;
}) {
  return (
    <FileLibraryCommandBarSurfaceContext.Provider value={value}>
      {children}
    </FileLibraryCommandBarSurfaceContext.Provider>
  );
}

export function useFileLibraryCommandBarSurface() {
  const context = useContext(FileLibraryCommandBarSurfaceContext);
  return context ?? {
    registerSurface: () => undefined,
    clearSurface: () => undefined
  };
}

export function useRegisterFileLibraryCommandBarSurface(
  owner: FileLibraryCommandBarSurfaceOwner,
  search: ReactNode,
  searchInputRef: RefObject<HTMLInputElement | null>,
  enabled: boolean,
  actions?: ReactNode
) {
  const { registerSurface, clearSurface } = useFileLibraryCommandBarSurface();
  useEffect(() => {
    registerSurface({ owner, search, actions, searchInputRef, enabled });
    return () => clearSurface(owner);
  }, [actions, clearSurface, enabled, owner, registerSurface, search, searchInputRef]);
}

export function useFileLibraryLibrarySearchSurface({
  enabled,
  value,
  onChange,
  placeholder,
  actions,
  t
}: {
  enabled: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  actions?: ReactNode;
  t: Translator;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const search = useMemo(() => enabled ? (
    <SearchField
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onClear={() => onChange("")}
      label={t("librarySearchLabel")}
      clearLabel={t("librarySearchClear")}
      placeholder={placeholder}
      inputRef={searchInputRef}
      className="file-library-command-search-field"
      data-file-library-local-search="true"
    />
  ) : null, [enabled, onChange, placeholder, t, value]);
  useRegisterFileLibraryCommandBarSurface("library", search, searchInputRef, enabled, actions);
}
