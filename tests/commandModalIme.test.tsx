// @vitest-environment happy-dom
import { act, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandModal } from "../src/components/CommandModal";
import { tauriApi } from "../src/api/tauriApi";
import { makeTranslator } from "../src/i18n";

const t = makeTranslator("en");

function setInputValue(input: HTMLInputElement, value: string, composing = false) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  const event = new InputEvent("input", { bubbles: true, inputType: "insertText", data: value });
  Object.defineProperty(event, "isComposing", { configurable: true, value: composing });
  Object.defineProperty(event, "keyCode", { configurable: true, value: composing ? 229 : 0 });
  input.dispatchEvent(event);
}

describe("mounted CommandModal IME behavior", () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not query or execute commands during composition, then commits one final value", async () => {
    const searchGlobalEntries = vi.spyOn(tauriApi, "searchGlobalEntries").mockResolvedValue({
      version: 2,
      requestId: "ime-request",
      normalizedQuery: "中",
      results: [],
      indexStatus: {
        platform: "browser",
        enabled: true,
        status: "ready",
        processedEntries: 1,
        collectionComplete: true,
        totalEntries: 1,
        indexedVolumes: 1,
        readyVolumes: 1,
        pendingVolumes: 0,
        lastSyncAt: null,
        lastError: null
      },
      collectionComplete: true,
      resultState: "empty",
      sourceRevision: "ime-source",
      sourceHealth: []
    });
    vi.spyOn(tauriApi, "onSearchWindowState").mockResolvedValue(() => undefined);
    vi.spyOn(tauriApi, "getSearchWindowState").mockResolvedValue({ sessionId: 1, revision: 1, phase: "visible_collapsed" });
    const openGlobalSearchResult = vi.spyOn(tauriApi, "openGlobalSearchResult").mockResolvedValue();
    const revealGlobalSearchResult = vi.spyOn(tauriApi, "revealGlobalSearchResult").mockResolvedValue();
    const activateSearchResult = vi.spyOn(tauriApi, "activateSearchResult").mockResolvedValue();
    const setView = vi.fn();
    const setSelectedFileId = vi.fn();
    const onClose = vi.fn();
    const inputRef = { current: null } as RefObject<HTMLInputElement | null>;

    await act(async () => {
      root = createRoot(container);
      root.render(
        <CommandModal
          inputRef={inputRef}
          setView={setView}
          setSelectedFileId={setSelectedFileId}
          onClose={onClose}
          platform="browser"
          t={t}
          standalone
        />
      );
    });
    const input = container.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    expect(input).toBeTruthy();

    await act(async () => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    for (const value of ["z", "zh", "zhong"]) {
      await act(async () => setInputValue(input, value, true));
    }
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(searchGlobalEntries).not.toHaveBeenCalled();

    for (const key of ["Enter", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]) {
      await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
    }
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    expect(openGlobalSearchResult).not.toHaveBeenCalled();
    expect(revealGlobalSearchResult).not.toHaveBeenCalled();
    expect(activateSearchResult).not.toHaveBeenCalled();
    expect(setView).not.toHaveBeenCalled();
    expect(setSelectedFileId).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      setInputValue(input, "中");
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    expect(searchGlobalEntries).toHaveBeenCalledTimes(1);
    expect(searchGlobalEntries.mock.calls[0][0].query).toBe("中");
  });
});
