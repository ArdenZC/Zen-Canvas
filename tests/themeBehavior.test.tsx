// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppChrome } from "../src/hooks/useAppChrome";
import { useAppStore } from "../src/store/useAppStore";
import { preferredTheme } from "../src/utils/viewHelpers";

let systemDark = false;
let colorSchemeChange: ((event: MediaQueryListEvent) => void) | undefined;

function ThemeHarness() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const chrome = useAppChrome({
    theme,
    setTheme,
    setLanguage: vi.fn(),
    searchHotkey: "Ctrl+K"
  });
  return createElement(
    "label",
    null,
    "Theme",
    createElement(
      "select",
      {
        "aria-label": "Theme",
        value: theme,
        onChange: (event: Event) => setTheme((event.target as HTMLSelectElement).value as "light" | "dark" | "system")
      },
      createElement("option", { value: "light" }, "Light"),
      createElement("option", { value: "dark" }, "Dark"),
      createElement("option", { value: "system" }, "System")
    ),
    createElement("output", { "data-effective-theme": chrome.effectiveTheme }, chrome.effectiveTheme)
  );
}

describe("theme persistence and root state", () => {
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="theme-root"></div>';
    localStorage.clear();
    systemDark = false;
    colorSchemeChange = undefined;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-color-scheme") ? systemDark : false,
        media: query,
        onchange: null,
        addEventListener: (event: string, listener: (change: MediaQueryListEvent) => void) => {
          if (event === "change" && query.includes("prefers-color-scheme")) colorSchemeChange = listener;
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }) as unknown as MediaQueryList
    });
    useAppStore.setState({ theme: "light" });
    document.documentElement.classList.remove("dark");
    root = createRoot(document.getElementById("theme-root")!);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.documentElement.classList.remove("dark");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function choose(value: "light" | "dark" | "system") {
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Theme"]')!;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    await act(async () => select.dispatchEvent(new Event("change", { bubbles: true })));
  }

  it("keeps the selected mode and root class synchronized for light and dark", async () => {
    await act(async () => root.render(createElement(ThemeHarness)));
    await choose("dark");
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Theme"]')?.value).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.querySelector("[data-effective-theme]")?.textContent).toBe("dark");

    await choose("light");
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Theme"]')?.value).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.querySelector("[data-effective-theme]")?.textContent).toBe("light");
  });

  it("follows the system theme and persists across a remount", async () => {
    await act(async () => root.render(createElement(ThemeHarness)));
    await choose("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    systemDark = true;
    await act(async () => colorSchemeChange?.({ matches: true } as MediaQueryListEvent));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("zc-theme")).toBe("system");

    act(() => root.unmount());
    useAppStore.setState({ theme: preferredTheme() });
    root = createRoot(document.getElementById("theme-root")!);
    await act(async () => root.render(createElement(ThemeHarness)));
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Theme"]')?.value).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
