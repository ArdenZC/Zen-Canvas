import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Translator } from "../src/types/ui";

const reactHooks = vi.hoisted(() => {
  type Slot<T> = T | undefined;
  type CallbackSlot = { callback: unknown; deps?: readonly unknown[] };
  type MemoSlot = { value: unknown; deps?: readonly unknown[] };

  let hookIndex = 0;
  const stateSlots: Slot<[unknown, (next: unknown) => void]>[] = [];
  const refSlots: Slot<{ current: unknown }>[] = [];
  const callbackSlots: Slot<CallbackSlot>[] = [];
  const memoSlots: Slot<MemoSlot>[] = [];

  function sameDeps(previous?: readonly unknown[], next?: readonly unknown[]) {
    if (!previous || !next || previous.length !== next.length) return false;
    return previous.every((value, index) => Object.is(value, next[index]));
  }

  return {
    resetAll() {
      hookIndex = 0;
      stateSlots.length = 0;
      refSlots.length = 0;
      callbackSlots.length = 0;
      memoSlots.length = 0;
    },
    resetRender() {
      hookIndex = 0;
    },
    useState(initial: unknown) {
      const index = hookIndex++;
      if (!stateSlots[index]) {
        const value = typeof initial === "function" ? (initial as () => unknown)() : initial;
        const setState = (next: unknown) => {
          const current = stateSlots[index];
          if (!current) return;
          const [currentValue, setter] = current;
          const value = typeof next === "function" ? (next as (value: unknown) => unknown)(currentValue) : next;
          stateSlots[index] = [value, setter];
        };
        stateSlots[index] = [value, setState];
      }
      return stateSlots[index];
    },
    useRef(initial: unknown) {
      const index = hookIndex++;
      refSlots[index] ??= { current: initial };
      return refSlots[index];
    },
    useEffect() {
      hookIndex += 1;
    },
    useMemo(factory: () => unknown, deps?: readonly unknown[]) {
      const index = hookIndex++;
      const previous = memoSlots[index];
      if (previous && sameDeps(previous.deps, deps)) return previous.value;
      const value = factory();
      memoSlots[index] = { value, deps };
      return value;
    },
    useCallback(callback: unknown, deps?: readonly unknown[]) {
      const index = hookIndex++;
      const previous = callbackSlots[index];
      if (previous && sameDeps(previous.deps, deps)) return previous.callback;
      callbackSlots[index] = { callback, deps };
      return callback;
    }
  };
});

vi.mock("react", () => ({
  useCallback: reactHooks.useCallback,
  useEffect: reactHooks.useEffect,
  useMemo: reactHooks.useMemo,
  useRef: reactHooks.useRef,
  useState: reactHooks.useState
}));

import { useOperationQueue } from "../src/hooks/useOperationQueue";

describe("useOperationQueue callbacks", () => {
  beforeEach(() => {
    reactHooks.resetAll();
  });

  it("keeps onRenamePreview stable across renders", () => {
    const first = renderOperationQueue();
    const second = renderOperationQueue();

    expect(second.onRenamePreview).toBe(first.onRenamePreview);
  });
});

function renderOperationQueue() {
  reactHooks.resetRender();
  return useOperationQueue({
    files: [],
    rules: [],
    t: ((key: string) => key) as Translator,
    onRefreshData: async () => {},
    onError: () => {},
    onSuccess: () => {}
  });
}
