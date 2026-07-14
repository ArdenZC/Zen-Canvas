// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tauriApi } from "../src/api/tauriApi";
import { ChromeProvider, RulesProvider, type ChromeContextValue, type RulesContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { useFileLibraryStore } from "../src/store/useFileLibraryStore";
import type { Rule } from "../src/types/domain";
import { RulesView } from "../src/views/rules/RulesView";

const t = makeTranslator("en");
const chrome = { t, setView: vi.fn() } as unknown as ChromeContextValue;
const initialRules: Rule[] = [rule("rule-a", "First rule", true), rule("rule-b", "Second rule", true), rule("rule-c", "Third rule", false)];

type HarnessProps = {
  initialRules?: Rule[];
  deleteMode?: "success" | "false" | "throw";
  toggleGate?: Promise<void>;
  onToggle?: () => void;
};

function RulesHarness({ initialRules: configuredRules, deleteMode = "success", toggleGate, onToggle }: HarnessProps) {
  const [rules, setRules] = useState(() => configuredRules ?? initialRules);
  const value: RulesContextValue = {
    rules,
    saveRule: async (next) => setRules((current) => current.map((rule) => rule.id === next.id ? next : rule)),
    toggleRuleEnabled: async (rule, enabled) => {
      onToggle?.();
      if (toggleGate) await toggleGate;
      setRules((current) => current.map((item) => item.id === rule.id ? { ...item, enabled } : item));
    },
    deleteRule: async (rule) => {
      if (deleteMode === "throw") throw new Error("sqlite offline");
      if (deleteMode === "false") return false;
      setRules((current) => current.filter((item) => item.id !== rule.id));
      return true;
    }
  };
  return createElement(ChromeProvider, { value: chrome, children: createElement(RulesProvider, { value, children: createElement(RulesView) }) });
}

function rule(id: string, name: string, enabled: boolean): Rule {
  return {
    id,
    name,
    source: "user",
    enabled,
    priority: 75,
    weight: 75,
    root_operator: "AND",
    groups: [{ id: `${id}-group`, operator: "AND", conditions: [{ id: `${id}-condition`, field: "name", operator: "contains", value: id }] }],
    action: { purpose: "Project", lifecycle: "Inbox" },
    created_at: "2026-07-14T00:00:00Z",
    updated_at: "2026-07-14T00:00:00Z"
  };
}

describe("automation rule workspace behavior", () => {
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="app-shell-content"></div><div id="test-root"></div>';
    useFileLibraryStore.setState({ scope: { kind: "all" }, organizeQueueTotal: 4, isLoadingOrganizeQueue: false });
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true, configurable: true });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({
      matches: query.includes("max-width") ? window.innerWidth <= Number(query.match(/(\d+)px/)?.[1] ?? 0) : true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as unknown as MediaQueryList });
    root = createRoot(document.getElementById("test-root")!);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.restoreAllMocks();
    resetModalInfrastructureForTests();
    document.body.innerHTML = "";
  });

  async function renderRules(props: HarnessProps = {}) {
    await act(async () => root.render(createElement(RulesHarness, props)));
  }

  function rowButtons() {
    return Array.from(document.querySelectorAll<HTMLButtonElement>("[data-rule-row-content]"));
  }

  function detailsAreVisible() {
    let current = document.querySelector<HTMLElement>("#automation-inspector-title");
    while (current) {
      if (current.className.includes("hidden")) return false;
      current = current.parentElement;
    }
    return Boolean(document.querySelector("#automation-inspector-title"));
  }

  it("keeps row keyboard focus separate from detail activation and gives the switch its own action", async () => {
    Object.defineProperty(window, "innerWidth", { value: 900, writable: true, configurable: true });
    const onToggle = vi.fn();
    let resolveToggle!: () => void;
    const toggleGate = new Promise<void>((resolve) => { resolveToggle = resolve; });
    await renderRules({ onToggle, toggleGate });
    const [first, second] = rowButtons();

    first.focus();
    await act(async () => first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(second);
    expect(detailsAreVisible()).toBe(false);

    await act(async () => second.click());
    expect(document.querySelector("#automation-inspector-title")?.textContent).toContain("Second rule");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(detailsAreVisible()).toBe(false);
    expect(document.activeElement).toBe(second);

    const switchButton = document.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1];
    await act(async () => switchButton.click());
    expect(onToggle).toHaveBeenCalledOnce();
    expect(detailsAreVisible()).toBe(false);
    expect(switchButton.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1].disabled).toBe(true);
    await act(async () => { resolveToggle(); await toggleGate; });
    expect(document.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1].getAttribute("aria-checked")).toBe("false");
  });

  it("deletes successfully and focuses the next row, while a false result keeps confirmation open", async () => {
    await renderRules();
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Delete rule"]')!.click());
    const confirm = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent === "Delete rule")!;
    await act(async () => confirm().click());
    expect(document.querySelectorAll("[data-rule-row-content]")).toHaveLength(2);
    expect(document.querySelector("#automation-inspector-title")?.textContent).toContain("Second rule");

    await act(async () => root.render(createElement(RulesHarness, { key: "failure", deleteMode: "false" })));
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Delete rule"]')!.click());
    await act(async () => confirm().click());
    expect(document.querySelector("[role=alertdialog]")).toBeTruthy();
    expect(document.querySelector("[role=alert]")?.textContent).toContain("Rule delete failed");
    expect(document.querySelectorAll("[data-rule-row-content]")).toHaveLength(3);
  });

  it("returns to the empty state and restores focus after deleting the last rule", async () => {
    await renderRules({ initialRules: [rule("only-rule", "Only rule", true)] });
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Delete rule"]')!.click());
    const confirm = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent === "Delete rule")!;
    await act(async () => confirm().click());
    const createFirst = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create first rule") ?? null;
    expect(createFirst).toBeTruthy();
    expect(document.activeElement).toBe(createFirst);
  });

  it("rejects a stale scope result and does not let it overwrite a newer run", async () => {
    const firstRun = deferred({ scanned: 1, updated: 1, skipped: 0, needsConfirmation: 0 });
    const secondRun = deferred({ scanned: 2, updated: 2, skipped: 0, needsConfirmation: 0 });
    vi.spyOn(tauriApi, "executeRulesForScope")
      .mockReturnValueOnce(firstRun.promise)
      .mockReturnValueOnce(secondRun.promise);
    vi.spyOn(useFileLibraryStore.getState(), "loadOrganizeQueue").mockResolvedValue();
    vi.spyOn(useFileLibraryStore.getState(), "refresh").mockResolvedValue();
    await renderRules();

    const openRunConfirmation = async () => {
      const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Generate suggestions"))!;
      await act(async () => run.click());
      const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("Generate suggestions"))!;
      await act(async () => confirm.click());
    };

    await openRunConfirmation();
    useFileLibraryStore.getState().setScope({ kind: "roots", roots: ["C:/new-scope"] });
    await act(async () => Promise.resolve());
    await openRunConfirmation();
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Calculating suggestions");

    await act(async () => { firstRun.resolve(); await firstRun.promise; });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Calculating suggestions");
    await act(async () => { secondRun.resolve(); await secondRun.promise; await Promise.resolve(); });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Updated 2");
  });

  it("invalidates a pending run when a rule is toggled", async () => {
    const pendingRun = deferred({ scanned: 1, updated: 1, skipped: 0, needsConfirmation: 0 });
    vi.spyOn(tauriApi, "executeRulesForScope").mockReturnValue(pendingRun.promise);
    vi.spyOn(useFileLibraryStore.getState(), "loadOrganizeQueue").mockResolvedValue();
    vi.spyOn(useFileLibraryStore.getState(), "refresh").mockResolvedValue();
    let resolveToggle!: () => void;
    const toggleGate = new Promise<void>((resolve) => { resolveToggle = resolve; });
    await renderRules({ toggleGate });
    const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Generate suggestions"))!;
    await act(async () => run.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("Generate suggestions"))!;
    await act(async () => confirm.click());

    const firstSwitch = document.querySelector<HTMLButtonElement>('[role="switch"]')!;
    await act(async () => firstSwitch.click());
    resolveToggle();
    await act(async () => { await toggleGate; await Promise.resolve(); });
    await act(async () => { pendingRun.resolve(); await pendingRun.promise; });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Run result is stale");
    expect(document.querySelector('[role="status"]')?.textContent).not.toContain("Updated 1");
  });

  it("keeps the narrow layout contract on the 1023px boundary", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    Object.defineProperty(window, "innerWidth", { value: 1023, writable: true, configurable: true });
    await renderRules();
    await act(async () => rowButtons()[0].click());
    expect(document.querySelector('button[aria-label="Back to rules"]')).toBeTruthy();

    await act(async () => root.unmount());
    root = createRoot(document.getElementById("test-root")!);
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true, configurable: true });
    await renderRules();
    expect(document.querySelector('button[aria-label="Back to rules"]')).toBeNull();
  });
});

function deferred<T>(initial: T) {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve: () => resolve(initial) };
}
