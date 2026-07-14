// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireModalIsolation,
  ensureModalHost,
  isUsableFocusTarget,
  registerModal,
  resetModalInfrastructureForTests,
  restoreDialogFocus
} from "../src/components/modal/ModalPortal";

function visible(element: HTMLElement) {
  element.getClientRects = () => [{ width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON() { return {}; } }] as unknown as DOMRectList;
}

describe("global modal infrastructure", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-shell-content"><button id="trigger">Open</button><h1 id="heading">Page</h1></div>';
    resetModalInfrastructureForTests();
  });
  afterEach(() => {
    resetModalInfrastructureForTests();
    document.body.innerHTML = "";
  });

  it("isolates the app root while any modal is open and restores original state after the last closes", () => {
    const root = document.getElementById("app-shell-content") as HTMLElement;
    root.setAttribute("aria-hidden", "false");
    const releaseFirst = acquireModalIsolation();
    const releaseSecond = acquireModalIsolation();
    expect(root.inert).toBe(true);
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(ensureModalHost()?.id).toBe("modal-host");
    releaseFirst();
    expect(root.inert).toBe(true);
    releaseSecond();
    expect(root.inert).toBe(false);
    expect(root.getAttribute("aria-hidden")).toBe("false");
  });

  it("captures a replacement app root while a modal is still open", async () => {
    const release = acquireModalIsolation();
    const oldRoot = document.getElementById("app-shell-content") as HTMLElement;
    const replacement = document.createElement("div");
    replacement.id = "app-shell-content";
    document.body.replaceChild(replacement, oldRoot);
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(replacement.inert).toBe(true);
    release();
    expect(replacement.inert).toBe(false);
  });

  it("does not restore focus to hidden or inert targets and uses a visible fallback", () => {
    const previous = document.getElementById("trigger") as HTMLElement;
    const fallback = document.getElementById("heading") as HTMLElement;
    visible(previous);
    visible(fallback);
    previous.setAttribute("aria-hidden", "true");
    expect(isUsableFocusTarget(previous)).toBe(false);
    const restored = restoreDialogFocus(previous, null, "#heading");
    expect(restored).toBe(fallback);
    expect(document.activeElement).toBe(fallback);
  });

  it("prefers an explicit restore target over the previously focused element", () => {
    const previous = document.getElementById("trigger") as HTMLElement;
    const preferred = document.getElementById("heading") as HTMLElement;
    visible(previous);
    visible(preferred);

    const restored = restoreDialogFocus(previous, preferred, "#missing");

    expect(restored).toBe(preferred);
    expect(document.activeElement).toBe(preferred);
  });

  it("routes Escape and focus containment through the top modal only", () => {
    const lower = document.createElement("div");
    const upper = document.createElement("div");
    lower.innerHTML = '<button type="button">Lower</button>';
    upper.innerHTML = '<button type="button">Upper</button>';
    document.body.append(lower, upper);
    const lowerEscape = vi.fn();
    const upperEscape = vi.fn();
    const releaseLower = registerModal("lower", { element: lower, restoreTarget: null, onEscape: lowerEscape });
    const releaseUpper = registerModal("upper", { element: upper, restoreTarget: null, onEscape: upperEscape });

    expect(lower.getAttribute("aria-hidden")).toBe("true");
    expect(upper.getAttribute("aria-hidden")).toBeNull();
    expect(lower.dataset.modalTop).toBe("false");
    expect(upper.dataset.modalTop).toBe("true");
    expect(Number(upper.style.zIndex)).toBeGreaterThan(Number(lower.style.zIndex));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(upperEscape).toHaveBeenCalledTimes(1);
    expect(lowerEscape).not.toHaveBeenCalled();

    releaseUpper();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(lowerEscape).toHaveBeenCalledTimes(1);
    releaseLower();
  });
});
