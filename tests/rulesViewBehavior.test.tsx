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
  toggleGateByRule?: Partial<Record<string, Promise<void>>>;
  toggleFailureIds?: string[];
  onToggle?: (id: string) => void;
};

function RulesHarness({ initialRules: configuredRules, deleteMode = "success", toggleGate, toggleGateByRule, toggleFailureIds = [], onToggle }: HarnessProps) {
  const [rules, setRules] = useState(() => configuredRules ?? initialRules);
  const value: RulesContextValue = {
    rules,
    saveRule: async (next) => setRules((current) => current.map((rule) => rule.id === next.id ? next : rule)),
    toggleRuleEnabled: async (rule, enabled) => {
      onToggle?.(rule.id);
      if (toggleGateByRule?.[rule.id]) await toggleGateByRule[rule.id];
      if (toggleGate) await toggleGate;
      if (toggleFailureIds.includes(rule.id)) throw new Error("sqlite offline");
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

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}

function makeFocusable(element: HTMLElement) {
  Object.defineProperty(element, "getClientRects", {
    configurable: true,
    value: () => [{ width: 120, height: 40, top: 0, left: 0, right: 120, bottom: 40 }]
  });
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

  async function completeRun(props: HarnessProps = {}) {
    vi.spyOn(tauriApi, "executeRulesForScope").mockResolvedValue({ scanned: 1, updated: 1, skipped: 0, needsConfirmation: 0 });
    vi.spyOn(useFileLibraryStore.getState(), "loadOrganizeQueue").mockResolvedValue();
    vi.spyOn(useFileLibraryStore.getState(), "refresh").mockResolvedValue();
    await renderRules(props);
    const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => run.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => confirm.click());
    await act(async () => Promise.resolve());
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
      const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("suggestions"))!;
      await act(async () => run.click());
      const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("suggestions"))!;
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
    const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => run.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => confirm.click());

    const firstSwitch = document.querySelector<HTMLButtonElement>('[role="switch"]')!;
    await act(async () => firstSwitch.click());
    resolveToggle();
    await act(async () => { await toggleGate; await Promise.resolve(); });
    await act(async () => { pendingRun.resolve(); await pendingRun.promise; });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
    expect(document.querySelector('[role="status"]')?.textContent).not.toContain("Updated 1");
  });

  it("marks a completed result stale after a rule edit", async () => {
    await completeRun();
    const edit = document.querySelector<HTMLButtonElement>('button[aria-label="Edit rule"]')!;
    edit.focus();
    await act(async () => edit.click());
    const name = document.querySelector<HTMLInputElement>('input[value="First rule"]')!;
    await act(async () => setInputValue(name, "Edited rule"));
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save rule")!;
    await act(async () => save.click());
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
  });

  it("marks a completed result stale after a rule toggle", async () => {
    await completeRun();
    await act(async () => document.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
  });

  it("marks a completed result stale after a rule delete", async () => {
    await completeRun({ initialRules: [rule("only-rule", "Only rule", true)] });
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Delete rule"]')!.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent === "Delete rule")!;
    await act(async () => confirm.click());
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
  });

  it("marks a completed result stale after a scope change", async () => {
    await completeRun();
    act(() => useFileLibraryStore.getState().setScope({ kind: "roots", roots: ["C:/changed-scope"] }));
    await act(async () => Promise.resolve());
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
  });

  it("keeps a stale state after the old response resolves", async () => {
    const pending = deferred({ scanned: 1, updated: 1, skipped: 0, needsConfirmation: 0 });
    vi.spyOn(tauriApi, "executeRulesForScope").mockReturnValue(pending.promise);
    vi.spyOn(useFileLibraryStore.getState(), "loadOrganizeQueue").mockResolvedValue();
    vi.spyOn(useFileLibraryStore.getState(), "refresh").mockResolvedValue();
    await renderRules();
    const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => run.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => confirm.click());
    act(() => useFileLibraryStore.getState().setScope({ kind: "roots", roots: ["C:/stale-scope"] }));
    await act(async () => Promise.resolve());
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
    await act(async () => { pending.resolve(); await pending.promise; await Promise.resolve(); });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("previous generated result has expired");
    expect(document.querySelector('[role="status"]')?.textContent).not.toContain("Updated 1");
  });

  it("keeps the narrow layout contract on the 1180px boundary", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    Object.defineProperty(window, "innerWidth", { value: 1179, writable: true, configurable: true });
    await renderRules();
    await act(async () => rowButtons()[0].click());
    expect(document.querySelector('button[aria-label="Back to rules"]')).toBeTruthy();

    await act(async () => root.unmount());
    root = createRoot(document.getElementById("test-root")!);
    Object.defineProperty(window, "innerWidth", { value: 1180, writable: true, configurable: true });
    await renderRules();
    expect(document.querySelector('button[aria-label="Back to rules"]')).toBeNull();
  });

  it("restores focus to each real automation dialog trigger", async () => {
    await renderRules();
    const topCreate = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create rule")!;
    makeFocusable(topCreate);
    topCreate.focus();
    await act(async () => topCreate.click());
    const cancelNew = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Cancel")!;
    await act(async () => cancelNew.click());
    expect(document.activeElement).toBe(topCreate);

    await act(async () => {
      const firstRow = rowButtons()[0];
      firstRow.click();
    });
    const edit = document.querySelector<HTMLButtonElement>('button[aria-label="Edit rule"]')!;
    makeFocusable(edit);
    edit.focus();
    await act(async () => edit.click());
    const cancelEdit = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Cancel")!;
    await act(async () => cancelEdit.click());
    expect(document.activeElement).toBe(edit);
  });

  it("restores focus to the empty-state create trigger", async () => {
    await renderRules({ initialRules: [] });
    const emptyCreate = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create first rule")!;
    makeFocusable(emptyCreate);
    emptyCreate.focus();
    await act(async () => emptyCreate.click());
    const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Cancel")!;
    await act(async () => cancel.click());
    expect(document.activeElement).toBe(emptyCreate);
  });

  it("restores the trigger after close, Escape, save, and discarded changes", async () => {
    await renderRules();
    const topCreate = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create rule")!;
    makeFocusable(topCreate);

    topCreate.focus();
    await act(async () => topCreate.click());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(document.activeElement).toBe(topCreate);

    topCreate.focus();
    await act(async () => topCreate.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.activeElement).toBe(topCreate);

    topCreate.focus();
    await act(async () => topCreate.click());
    const [name, value] = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="number"])'));
    await act(async () => {
      setInputValue(name, "Saved rule");
      setInputValue(value, "report");
    });
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save rule")!;
    await act(async () => save.click());
    expect(document.activeElement).toBe(topCreate);

    topCreate.focus();
    await act(async () => topCreate.click());
    const dirtyName = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="number"])'))[0];
    await act(async () => setInputValue(dirtyName, "Discarded rule"));
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    const discard = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent === "Discard changes")!;
    await act(async () => discard.click());
    await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
    expect(document.activeElement).toBe(topCreate);
  });

  it("allows two different rules to toggle concurrently and keeps each busy state independent", async () => {
    let resolveA!: () => void;
    let resolveB!: () => void;
    const gateA = new Promise<void>((resolve) => { resolveA = resolve; });
    const gateB = new Promise<void>((resolve) => { resolveB = resolve; });
    const onToggle = vi.fn();
    await renderRules({ toggleGateByRule: { "rule-a": gateA, "rule-b": gateB }, onToggle });
    const switches = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="switch"]'));

    await act(async () => {
      switches()[0].click();
      switches()[1].click();
      await Promise.resolve();
    });
    expect(onToggle).toHaveBeenCalledWith("rule-a");
    expect(onToggle).toHaveBeenCalledWith("rule-b");
    expect(switches()[0].disabled).toBe(true);
    expect(switches()[1].disabled).toBe(true);
    expect(switches()[0].getAttribute("aria-busy")).toBe("true");
    expect(switches()[1].getAttribute("aria-busy")).toBe("true");

    await act(async () => { resolveA(); await gateA; await Promise.resolve(); });
    expect(switches()[0].disabled).toBe(false);
    expect(switches()[1].disabled).toBe(true);
    expect(switches()[0].getAttribute("aria-checked")).toBe("false");
    expect(switches()[1].getAttribute("aria-checked")).toBe("true");

    await act(async () => { resolveB(); await gateB; await Promise.resolve(); });
    expect(switches()[1].disabled).toBe(false);
    expect(switches()[1].getAttribute("aria-checked")).toBe("false");
  });

  it("isolates a toggle failure to its own row while another rule remains busy", async () => {
    let resolveB!: () => void;
    const gateB = new Promise<void>((resolve) => { resolveB = resolve; });
    await renderRules({ toggleGateByRule: { "rule-b": gateB }, toggleFailureIds: ["rule-a"] });
    const switches = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="switch"]'));

    await act(async () => {
      switches()[0].click();
      switches()[1].click();
      await Promise.resolve();
    });
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Rule state could not be saved");
    expect(switches()[0].disabled).toBe(false);
    expect(switches()[1].disabled).toBe(true);
    expect(switches()[1].getAttribute("aria-busy")).toBe("true");

    await act(async () => { resolveB(); await gateB; await Promise.resolve(); });
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(switches()[0].getAttribute("aria-checked")).toBe("true");
  });

  it("passes only enabled user rules to the manual execution API", async () => {
    const systemRule = { ...rule("system-a", "System rule", true), source: "system" as const };
    const execute = vi.spyOn(tauriApi, "executeRulesForScope").mockResolvedValue({ scanned: 1, updated: 1, skipped: 0, needsConfirmation: 0 });
    vi.spyOn(useFileLibraryStore.getState(), "loadOrganizeQueue").mockResolvedValue();
    vi.spyOn(useFileLibraryStore.getState(), "refresh").mockResolvedValue();
    await renderRules({ initialRules: [rule("rule-a", "First rule", true), systemRule] });

    const run = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => run.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=alertdialog] button")).find((button) => button.textContent?.includes("suggestions"))!;
    await act(async () => confirm.click());
    await act(async () => Promise.resolve());
    expect(execute).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ id: "rule-a", source: "user" })], "all_changed_or_rule_changed");
    expect(execute.mock.calls[0][1]).not.toEqual(expect.arrayContaining([expect.objectContaining({ source: "system" })]));
  });
});

function deferred<T>(initial: T) {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve: () => resolve(initial) };
}
