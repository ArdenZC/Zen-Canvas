// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { ViewErrorBoundary } from "../src/components/ErrorBoundary";
import { makeTranslator } from "../src/i18n";

const t = makeTranslator("zh");

describe("view error recovery", () => {
  let root: Root;
  let setView: ReturnType<typeof vi.fn<(view: string) => void>>;
  let shouldThrow: boolean;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="test-root"></div>';
    root = createRoot(document.getElementById("test-root")!);
    setView = vi.fn();
    shouldThrow = true;
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    consoleError.mockRestore();
    document.body.innerHTML = "";
  });

  function renderBoundary(view: "library" | "scanner" = "library") {
    const chrome = { t, setView, view, language: "zh", theme: "light", onError: vi.fn() } as unknown as ChromeContextValue;
    function FlakyView() {
      if (shouldThrow) throw new Error("renderer_internal_failure");
      return createElement("div", { id: "recovered" }, "recovered");
    }
    act(() => root.render(createElement(
      ChromeProvider,
      { value: chrome, children: createElement(ViewErrorBoundary, null, createElement(FlakyView)) }
    )));
  }

  it("presents localized recovery copy and hides raw error text behind technical details", () => {
    renderBoundary();
    expect(document.querySelector("[data-view-error-boundary]")).toBeTruthy();
    expect(document.body.textContent).toContain("此页面暂时无法显示");
    expect(document.body.textContent).toContain("页面遇到问题");
    expect(document.querySelector("[data-view-error-technical-details]")?.textContent).toContain("renderer_internal_failure");
    const description = [...document.querySelectorAll("p")].find((node) => node.textContent?.includes("页面遇到问题"));
    expect(description?.textContent).not.toContain("renderer_internal_failure");
  });

  it("resets the captured error when retry succeeds", () => {
    renderBoundary();
    shouldThrow = false;
    const retry = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "重试");
    act(() => retry?.click());
    expect(document.getElementById("recovered")?.textContent).toBe("recovered");
    expect(document.querySelector("[data-view-error-boundary]")).toBeNull();
  });

  it("offers a safe route back to Overview when another view fails", () => {
    renderBoundary("library");
    shouldThrow = false;
    const back = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "返回概览");
    act(() => back?.click());
    expect(setView).toHaveBeenCalledWith("scanner");
  });

  it("routes a failed Overview to Settings instead of re-rendering the same failed view", () => {
    renderBoundary("scanner");
    shouldThrow = false;
    const fallback = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "打开设置");
    expect(fallback).toBeTruthy();
    act(() => fallback?.click());
    expect(setView).toHaveBeenCalledWith("settings");
  });
});
