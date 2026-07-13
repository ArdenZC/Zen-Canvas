// @vitest-environment happy-dom
import { act, createElement, forwardRef, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ModalPortal,
  isUsableFocusTarget,
  resetModalInfrastructureForTests
} from "../src/components/modal/ModalPortal";

const visibleRect = {
  width: 10,
  height: 10,
  top: 0,
  left: 0,
  right: 10,
  bottom: 10,
  x: 0,
  y: 0,
  toJSON() { return {}; }
};
const nativeGetClientRects = HTMLElement.prototype.getClientRects;

function flushAnimationFrames() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

const ModalButton = forwardRef<HTMLButtonElement, { children: string }>(({ children }, ref) => (
  <button ref={ref} type="button">{children}</button>
));

function TestStack({ onFirstEscape, onSecondEscape }: { onFirstEscape: () => void; onSecondEscape: () => void }) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement | null>(null);
  const secondFocusRef = useRef<HTMLButtonElement | null>(null);
  const [firstOpen, setFirstOpen] = useState(true);
  const [secondOpen, setSecondOpen] = useState(true);
  return createElement(
    "div",
    null,
    createElement("button", { ref: triggerRef, id: "react-trigger", type: "button" }, "Trigger"),
    firstOpen && createElement(ModalPortal, {
      modalId: "react-first",
      initialFocusRef: firstFocusRef,
      restoreFocus: () => triggerRef.current,
      onEscape: () => { onFirstEscape(); },
      children: createElement(
        "div",
      { role: "dialog", "aria-label": "First dialog" },
      createElement(ModalButton, { ref: firstFocusRef, children: "First action" }),
      createElement("button", { type: "button", onClick: () => setSecondOpen(false) }, "Close second"),
      createElement("button", { type: "button", onClick: () => setFirstOpen(false) }, "Close first"),
      secondOpen && createElement(ModalPortal, {
        modalId: "react-second",
        initialFocusRef: secondFocusRef,
        onEscape: () => { onSecondEscape(); setSecondOpen(false); },
        children: createElement(
          "div",
        { role: "dialog", "aria-label": "Second dialog" },
        createElement(ModalButton, { ref: secondFocusRef, children: "Second action" }),
        createElement("button", { type: "button" }, "Second close")
      )
    })
      )
    })
  );
}

describe("real React modal stack", () => {
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    resetModalInfrastructureForTests();
    HTMLElement.prototype.getClientRects = nativeGetClientRects;
    document.body.innerHTML = "";
  });

  it("stacks real portals, traps focus to the top, and restores the trigger after the last close", async () => {
    document.body.innerHTML = '<div id="app-shell-content"><button id="background">Background</button></div><div id="react-root"></div>';
    HTMLElement.prototype.getClientRects = () => [visibleRect] as unknown as DOMRectList;
    const firstEscape = () => undefined;
    let secondEscapeCount = 0;
    root = createRoot(document.getElementById("react-root")!);
    act(() => root!.render(createElement(TestStack, { onFirstEscape: firstEscape, onSecondEscape: () => { secondEscapeCount += 1; } })));
    await flushAnimationFrames();

    const app = document.getElementById("app-shell-content")! as HTMLElement;
    let layers = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-layer]"));
    const firstLayer = document.querySelector<HTMLElement>('[data-modal-id="react-first"]')!;
    const secondLayer = document.querySelector<HTMLElement>('[data-modal-id="react-second"]')!;
    expect(layers).toHaveLength(2);
    expect(app.inert).toBe(true);
    expect(app.getAttribute("aria-hidden")).toBe("true");
    expect(firstLayer.style.position).toBe("fixed");
    expect(firstLayer.style.inset).toBe("0");
    expect(firstLayer.style.isolation).toBe("isolate");
    expect(firstLayer.getAttribute("aria-hidden")).toBe("true");
    expect(secondLayer.getAttribute("aria-hidden")).toBeNull();
    expect(Number(secondLayer.style.zIndex)).toBeGreaterThan(Number(firstLayer.style.zIndex));
    expect(document.activeElement?.textContent).toBe("Second action");

    const secondButtons = secondLayer.querySelectorAll<HTMLButtonElement>("button");
    secondButtons[secondButtons.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement?.textContent).toBe("Second action");
    (document.getElementById("background") as HTMLElement).focus();
    await flushAnimationFrames();
    expect(secondLayer.contains(document.activeElement)).toBe(true);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await flushAnimationFrames();
    });
    expect(secondEscapeCount).toBe(1);
    layers = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-layer]"));
    expect(layers).toHaveLength(1);
    expect(layers[0].getAttribute("aria-hidden")).toBeNull();
    expect(document.activeElement?.textContent).toBe("First action");
    await act(async () => {
      (Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Close first") as HTMLButtonElement).click();
      await flushAnimationFrames();
      await flushAnimationFrames();
    });
    expect(app.inert).toBe(false);
    expect(app.getAttribute("aria-hidden")).toBeNull();
    expect(document.activeElement?.id).toBe("react-trigger");
    expect(document.querySelector("[data-modal-layer]")).toBeNull();
  });

  it("does not restore a disconnected, hidden, inert, or zero-geometry target", () => {
    const hidden = document.createElement("button");
    hidden.hidden = true;
    document.body.appendChild(hidden);
    expect(isUsableFocusTarget(hidden)).toBe(false);
    const zeroGeometry = document.createElement("button");
    zeroGeometry.getClientRects = () => [] as unknown as DOMRectList;
    document.body.appendChild(zeroGeometry);
    expect(isUsableFocusTarget(zeroGeometry)).toBe(false);
    zeroGeometry.inert = true;
    expect(isUsableFocusTarget(zeroGeometry)).toBe(false);
  });
});
