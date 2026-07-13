import { createPortal } from "react-dom";
import { Fragment, useEffect, useState, type ReactNode } from "react";

export const APP_SHELL_CONTENT_ID = "app-shell-content";
export const MODAL_HOST_ID = "modal-host";

type ModalSnapshot = {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
};

let modalCount = 0;
let modalSnapshots: ModalSnapshot[] = [];
let observer: MutationObserver | null = null;

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

export function ModalHost() {
  const [host] = useState(() => ensureModalHost());
  return host ? null : null;
}

export function ModalPortal({ children }: { children: ReactNode }) {
  const [host] = useState(() => ensureModalHost());
  const [inline, setInline] = useState(() => typeof document !== "undefined" && !findContentRoot());
  useEffect(() => {
    if (!inline && findContentRoot()) return;
    if (findContentRoot()) setInline(false);
  }, [inline]);
  useEffect(() => {
    if (!host || inline) return;
    return acquireModalIsolation();
  }, [host, inline]);
  if (typeof document === "undefined" || inline) return <Fragment>{children}</Fragment>;
  return host ? createPortal(children, host) : <Fragment>{children}</Fragment>;
}

function isHiddenByAncestor(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.hidden || current.inert || current.getAttribute("aria-hidden") === "true") return true;
    current = current.parentElement;
  }
  return false;
}

export function isUsableFocusTarget(element: HTMLElement | null): element is HTMLElement {
  if (!element || !element.isConnected || element === document.body || element === document.documentElement) return false;
  if (element.matches(":disabled, [disabled], [hidden]")) return false;
  if (isHiddenByAncestor(element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  if (!element.getClientRects().length) return false;
  return true;
}

function focusAndVerify(element: HTMLElement | null) {
  if (!isUsableFocusTarget(element)) return false;
  element.focus();
  return document.activeElement === element;
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
  }
  const seen = new Set<HTMLElement>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (focusAndVerify(candidate)) return candidate;
  }
  return null;
}

export function resetModalInfrastructureForTests() {
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
