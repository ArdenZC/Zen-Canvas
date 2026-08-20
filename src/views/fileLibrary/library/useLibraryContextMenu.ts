import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { FileLibrarySummary } from "../../../types/domain";
import type { LibrarySourceOwner } from "./librarySourceOwner";
import type { LibraryContextMenuState } from "./LibraryContextMenu";

type LibraryContextSource = Pick<
  LibrarySourceOwner,
  "files" | "focusedId" | "selectionContainsFileId" | "setExplicitSelection"
>;

type CloseReason = "escape" | "outside-pointer" | "action" | "dialog-handoff";

export function useLibraryContextMenu({
  source,
  restoreFocus
}: {
  source: LibraryContextSource;
  restoreFocus: (target: HTMLElement | null) => void;
}) {
  const [contextMenu, setContextMenu] = useState<LibraryContextMenuState | null>(null);

  const openContextMenu = useCallback((file: FileLibrarySummary, anchorX?: number, anchorY?: number) => {
    if (!source.selectionContainsFileId(file.id)) {
      source.setExplicitSelection([file.id], file.id, source.files.findIndex((item) => item.id === file.id));
    }
    const row = document.getElementById(`library-row-${file.id}`);
    const rect = row?.getBoundingClientRect();
    const list = document.querySelector<HTMLElement>('[data-library-source-owner="query-v2"] [role="listbox"]');
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInLibrary = Boolean(active && list?.contains(active) && isValidFocusTarget(active));
    const restoreFocusElement = activeInLibrary
      ? active
      : list?.isConnected
        ? list
        : row?.isConnected
          ? row
          : null;
    const width = 260;
    const height = 220;
    setContextMenu({
      file,
      restoreFocusElement,
      x: Math.max(8, Math.min(anchorX ?? rect?.left ?? 8, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(anchorY ?? rect?.bottom ?? 8, window.innerHeight - height - 8))
    });
  }, [source.files, source.selectionContainsFileId, source.setExplicitSelection]);

  const closeContextMenu = useCallback((
    reason: CloseReason = "action",
    pointerTarget: EventTarget | null = null,
    shouldRestoreFocus = reason !== "dialog-handoff"
  ) => {
    const restoreTarget = contextMenu?.restoreFocusElement ?? null;
    setContextMenu(null);
    if (!shouldRestoreFocus) return;
    requestAnimationFrame(() => {
      if (reason === "outside-pointer") {
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (isValidFocusTarget(active)) return;
        const pointerElement = focusablePointerTarget(pointerTarget);
        if (pointerElement) {
          pointerElement.focus();
          if (document.activeElement === pointerElement) return;
        }
      }
      restoreFocus(restoreTarget);
    });
  }, [contextMenu, restoreFocus]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnPointer = (event: globalThis.PointerEvent) => closeContextMenu("outside-pointer", event.target);
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeContextMenu("escape");
      }
    };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnKey);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnKey);
    };
  }, [closeContextMenu, contextMenu]);

  const openFocusedContextMenu = useCallback(() => {
    const file = source.files.find((item) => item.id === source.focusedId) ?? source.files[0];
    if (file) openContextMenu(file);
  }, [openContextMenu, source.files, source.focusedId]);

  const handleRowContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const file = source.files[index];
    if (file) openContextMenu(file, event.clientX, event.clientY);
  }, [openContextMenu, source.files]);

  return { contextMenu, openContextMenu, closeContextMenu, openFocusedContextMenu, handleRowContextMenu };
}

function isValidFocusTarget(target: HTMLElement | null) {
  return Boolean(target?.isConnected
    && target !== document.body
    && target !== document.documentElement
    && (target.tabIndex >= 0 || target.matches("button, input, select, textarea, a[href], [contenteditable='true']")));
}

function focusablePointerTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (isValidFocusTarget(element)) return element;
  const closest = element?.closest<HTMLElement>("button, input, select, textarea, a[href], [contenteditable='true']") ?? null;
  return isValidFocusTarget(closest) ? closest : null;
}
