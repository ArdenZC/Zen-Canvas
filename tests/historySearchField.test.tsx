// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistorySearchField, type HistorySearchMode } from "../src/views/history/HistorySearchField";

let container: HTMLDivElement;
let root: Root;

function renderField(mode: HistorySearchMode, layout: "wide" | "narrow", value = "", onChange = vi.fn()) {
  act(() => {
    root.render(
      <section data-layout={layout}>
        <HistorySearchField mode={mode} value={value} placeholder="Search history" onChange={onChange} />
      </section>
    );
  });
  return onChange;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("HistorySearchField", () => {
  it("keeps exactly one decorative search icon inside the input wrapper", () => {
    renderField("operation", "wide");

    const wrapper = container.querySelector<HTMLLabelElement>('[data-history-search-field="true"]')!;
    const input = container.querySelector<HTMLInputElement>('[data-history-search-input="true"]')!;
    const icons = container.querySelectorAll<SVGSVGElement>('[data-history-search-icon="true"]');

    expect(wrapper.tagName).toBe("LABEL");
    expect(wrapper.dataset.historySearchMode).toBe("operation");
    expect(icons).toHaveLength(1);
    expect(wrapper.contains(icons[0])).toBe(true);
    expect(wrapper.contains(input)).toBe(true);
    expect(icons[0].getAttribute("aria-hidden")).toBe("true");
    expect(icons[0].getAttribute("focusable")).toBe("false");
    expect(icons[0].getAttribute("tabindex")).toBeNull();
    expect(icons[0].classList.contains("pointer-events-none")).toBe(true);
    expect(input.getAttribute("aria-label")).toBe("Search history");
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it("preserves one shared structure across operation, cleanup, state, and layout rerenders", () => {
    const onChange = renderField("operation", "wide");
    const input = container.querySelector<HTMLInputElement>('[data-history-search-input="true"]')!;

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "failed restore");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();

    renderField("cleanup", "wide", "failed restore", onChange);
    expect(container.querySelector('[data-history-search-field="true"]')?.getAttribute("data-history-search-mode")).toBe("cleanup");
    expect(container.querySelectorAll('[data-history-search-icon="true"]')).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('[data-history-search-input="true"]')?.value).toBe("failed restore");

    renderField("cleanup", "narrow", "failed restore", onChange);
    expect(container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("narrow");
    expect(container.querySelectorAll('[data-history-search-field="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-history-search-icon="true"]')).toHaveLength(1);
  });
});
