import { createPortal } from "react-dom";
import { Fragment, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

export const APP_SHELL_CONTENT_ID = "app-shell-content";
export const MODAL_HOST_ID = "modal-host";

export interface ModalStackEntry {
  id: string;
  element: HTMLElement | null;
  restoreTarget: HTMLElement | null;
  openedAt: number;
  onEscape?: () => void;
  preferredRestore?: () => HTMLElement | null;
}

type ModalSnapshot = {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
};

let modalCount = 0;
let modalSnapshots: ModalSnapshot[] = [];
let observer: MutationObserver | null = null;
let modalStack: ModalStackEntry[] = [];
let globalKeydownAttached = false;

export function ensureModalHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(MODAL_HOST_ID);
  if (existing instanceof HTMLElement) return existing;
  const host = document.createElement("div");
  host.id = MODAL_HOST_ID;
  host.dataset.modalHost = "true";
  document.body.appendChild(host);
  return host;
}

function findContentRoot() {
  if (typeof document === "undefined") return null;
  const root = document.getElementById(APP_SHELL_CONTENT_ID);
  return root instanceof HTMLElement ? root : null;
}

function isolateContentRoot() {
  const root = findContentRoot();
  if (!root) return;
  if (!modalSnapshots.some((snapshot) => snapshot.element === root)) {
    modalSnapshots.push({
      element: root,
      inert: root.inert,
      ariaHidden: root.getAttribute("aria-hidden")
    });
  }
  root.inert = true;
  root.setAttribute("aria-hidden", "true");
}

function startIsolationObserver() {
  if (typeof MutationObserver === "undefined" || observer) return;
  observer = new MutationObserver(() => {
    if (modalCount > 0) isolateContentRoot();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopIsolationObserver() {
  observer?.disconnect();
  observer = null;
}

export function acquireModalIsolation() {
  modalCount += 1;
  if (modalCount === 1) {
    isolateContentRoot();
    startIsolationObserver();
  } else {
    isolateContentRoot();
  }
  return () => {
    modalCount = Math.max(0, modalCount - 1);
    if (modalCount !== 0) return;
    stopIsolationObserver();
    for (const snapshot of modalSnapshots) {
      if (!snapshot.element.isConnected) continue;
      snapshot.element.inert = snapshot.inert;
      if (snapshot.ariaHidden === null) snapshot.element.removeAttribute("aria-hidden");
      else snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
    }
    modalSnapshots = [];
  };
}

function isHiddenByAncestor(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.hidden || current.inert || current.getAttribute("aria-hidden") === "true") return true;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return true;
    current = current.parentElement;
  }
  return false;
}

export function isUsableFocusTarget(element: HTMLElement | null): element is HTMLElement {
  if (typeof document === "undefined" || !element || !element.isConnected || element === document.body || element === document.documentElement) return false;
  if (element.matches(":disabled, [disabled], [hidden], [aria-disabled='true']")) return false;
  if (isHiddenByAncestor(element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  const rects = Array.from(element.getClientRects());
  if (!rects.length && !isNaturallyFocusable(element)) return false;
  const hasVisibleRect = rects.some((rect) => rect.width > 0 || rect.height > 0) || element.clientWidth > 0 || element.clientHeight > 0;
  return hasVisibleRect || isNaturallyFocusable(element);
}

function isNaturallyFocusable(element: HTMLElement) {
  return element.matches("a[href], area[href], button, input, select, textarea, iframe, object, summary, [contenteditable='true']");
}

/** Focuses a semantic fallback without leaving a permanent tabindex on it. */
export function focusWithTemporaryTabIndex(element: HTMLElement | null) {
  if (!isUsableFocusTarget(element)) return false;
  const shouldTemporarilyTab = !isNaturallyFocusable(element) && element.tabIndex < 0;
  const hadTabIndex = element.hasAttribute("tabindex");
  const originalTabIndex = element.getAttribute("tabindex");
  if (shouldTemporarilyTab) element.setAttribute("tabindex", "-1");
  element.focus();
  const focused = document.activeElement === element;
  if (shouldTemporarilyTab) {
    if (hadTabIndex) element.setAttribute("tabindex", originalTabIndex ?? "");
    else element.removeAttribute("tabindex");
  }
  return focused;
}

function focusableIn(element: HTMLElement | null) {
  if (!element) return [];
  return Array.from(element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
  )).filter(isUsableFocusTarget);
}

function focusModalEntry(entry: ModalStackEntry | undefined, preferred: HTMLElement | null = null) {
  if (!entry?.element) return false;
  if (preferred && entry.element.contains(preferred) && focusWithTemporaryTabIndex(preferred)) return true;
  const autofocus = entry.element.querySelector<HTMLElement>("[autofocus]");
  if (focusWithTemporaryTabIndex(autofocus)) return true;
  const first = focusableIn(entry.element)[0];
  if (focusWithTemporaryTabIndex(first)) return true;
  return focusWithTemporaryTabIndex(entry.element);
}

export function restoreDialogFocus(
  previous: Element | null,
  preferred?: HTMLElement | null,
  fallbackSelector = "[data-dialog-focus-fallback]"
) {
  const candidates: HTMLElement[] = [];
  if (previous instanceof HTMLElement) candidates.push(previous);
  if (preferred) candidates.push(preferred);
  if (typeof document !== "undefined") {
    candidates.push(...Array.from(document.querySelectorAll<HTMLElement>(fallbackSelector)));
    candidates.push(...Array.from(document.querySelectorAll<HTMLElement>("main button:not([disabled]), [role='main'] button:not([disabled])")));
    candidates.push(...Array.from(document.querySelectorAll<HTMLElement>("main h1, main h2, [role='main'] h1, [role='main'] h2")));
    const main = document.querySelector<HTMLElement>("main, [role='main']");
    if (main) candidates.push(main);
    candidates.push(...Array.from(document.querySelectorAll<HTMLElement>("#app-shell-content nav a[href], #app-shell-content nav button:not([disabled]), #app-shell-content [data-nav-item]")));
  }
  const seen = new Set<HTMLElement>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (focusWithTemporaryTabIndex(candidate)) return candidate;
  }
  return null;
}

function syncModalStack() {
  const topIndex = modalStack.length - 1;
  modalStack.forEach((entry, index) => {
    const element = entry.element;
    if (!element) return;
    const top = index === topIndex;
    element.dataset.modalIndex = String(index);
    element.dataset.modalTop = top ? "true" : "false";
    element.style.zIndex = String(1000 + index);
    element.inert = !top;
    if (top) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", "true");
  });
}

function handleModalKeyDown(event: KeyboardEvent) {
  const top = modalStack[modalStack.length - 1];
  if (!top?.element) return;
  if (event.key === "Escape") {
    if (!top.onEscape) return;
    event.preventDefault();
    top.onEscape();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = focusableIn(top.element);
  if (!focusable.length) {
    event.preventDefault();
    focusWithTemporaryTabIndex(top.element);
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (!top.element.contains(active)) {
    event.preventDefault();
    focusWithTemporaryTabIndex(event.shiftKey ? last : first);
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    focusWithTemporaryTabIndex(last);
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    focusWithTemporaryTabIndex(first);
  }
}

function startModalKeydownListener() {
  if (globalKeydownAttached || typeof document === "undefined") return;
  document.addEventListener("keydown", handleModalKeyDown);
  globalKeydownAttached = true;
}

function stopModalKeydownListener() {
  if (!globalKeydownAttached || typeof document === "undefined") return;
  document.removeEventListener("keydown", handleModalKeyDown);
  globalKeydownAttached = false;
}

export function registerModal(
  id: string,
  options: Omit<ModalStackEntry, "id" | "openedAt"> = { element: null, restoreTarget: null }
) {
  modalStack = modalStack.filter((entry) => entry.id !== id);
  const entry: ModalStackEntry = { id, openedAt: Date.now(), ...options };
  modalStack.push(entry);
  syncModalStack();
  startModalKeydownListener();
  return () => unregisterModal(id);
}

export function unregisterModal(id: string) {
  const index = modalStack.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const [removed] = modalStack.splice(index, 1);
  const nextTop = modalStack[modalStack.length - 1];
  syncModalStack();
  if (nextTop) {
    requestAnimationFrame(() => focusModalEntry(nextTop, removed.restoreTarget));
  } else {
    requestAnimationFrame(() => restoreDialogFocus(removed.restoreTarget, removed.preferredRestore?.() ?? null));
    stopModalKeydownListener();
  }
  if (removed.element?.isConnected) {
    removed.element.inert = false;
    removed.element.removeAttribute("aria-hidden");
    delete removed.element.dataset.modalIndex;
    delete removed.element.dataset.modalTop;
    removed.element.style.zIndex = "";
  }
}

export function isTopModal(id: string) {
  return modalStack[modalStack.length - 1]?.id === id;
}

export function getModalIndex(id: string) {
  return modalStack.findIndex((entry) => entry.id === id);
}

export function getTopModal() {
  return modalStack[modalStack.length - 1] ?? null;
}

export function getModalStack() {
  return [...modalStack];
}

export interface ModalPortalProps {
  children: ReactNode;
  modalId?: string;
  onEscape?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: () => HTMLElement | null;
}

export function ModalHost() {
  const [host] = useState(() => ensureModalHost());
  return host ? null : null;
}

export function ModalPortal({ children, modalId, onEscape, initialFocusRef, restoreFocus }: ModalPortalProps) {
  const [host] = useState(() => ensureModalHost());
  const [inline, setInline] = useState(() => typeof document !== "undefined" && !findContentRoot());
  const generatedId = useId();
  const id = modalId ?? `modal-${generatedId.replace(/:/g, "-")}`;
  const layerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const preferredRestoreRef = useRef(restoreFocus);
  const initialFocusRefValue = useRef(initialFocusRef);
  onEscapeRef.current = onEscape;
  preferredRestoreRef.current = restoreFocus;
  initialFocusRefValue.current = initialFocusRef;

  useEffect(() => {
    if (!inline && findContentRoot()) return;
    if (findContentRoot()) setInline(false);
  }, [inline]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unregister = registerModal(id, {
      element: layer,
      restoreTarget: previousFocusRef.current,
      onEscape: () => onEscapeRef.current?.(),
      preferredRestore: () => preferredRestoreRef.current?.() ?? null
    });
    const releaseIsolation = host && !inline ? acquireModalIsolation() : () => undefined;
    const focusFrame = requestAnimationFrame(() => {
      if (isTopModal(id)) focusModalEntry(getTopModal(), initialFocusRefValue.current?.current ?? null);
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      unregister();
      releaseIsolation();
    };
  }, [host, id, inline]);

  const layer = <div ref={layerRef} data-modal-layer="true">{children}</div>;
  if (typeof document === "undefined" || inline) return <Fragment>{layer}</Fragment>;
  return host ? createPortal(layer, host) : <Fragment>{layer}</Fragment>;
}

export function resetModalInfrastructureForTests() {
  for (const entry of modalStack) {
    if (!entry.element?.isConnected) continue;
    entry.element.inert = false;
    entry.element.removeAttribute("aria-hidden");
    delete entry.element.dataset.modalIndex;
    delete entry.element.dataset.modalTop;
    entry.element.style.zIndex = "";
  }
  modalStack = [];
  stopModalKeydownListener();
  modalCount = 0;
  stopIsolationObserver();
  for (const snapshot of modalSnapshots) {
    if (!snapshot.element.isConnected) continue;
    snapshot.element.inert = snapshot.inert;
    if (snapshot.ariaHidden === null) snapshot.element.removeAttribute("aria-hidden");
    else snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
  }
  modalSnapshots = [];
}
