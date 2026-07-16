// @vitest-environment happy-dom

import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { emptyPage, useFileLibraryStore } from "../src/store/useFileLibraryStore";
import { useOperationQueueStore } from "../src/store/useOperationQueueStore";
import { useOrganizeDecisionStore } from "../src/store/useOrganizeDecisionStore";
import type { FileRecord, OperationPreview } from "../src/types/domain";
import { OrganizeSuggestionsView } from "../src/views/organize/OrganizeSuggestionsView";
import { ConfirmDialog } from "../src/views/shared/ui";
import { TimelineView } from "../src/views/timeline/TimelineView";

const apiMocks = vi.hoisted(() => ({ executeMoves: vi.fn() }));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    executeMoves: apiMocks.executeMoves,
    cancelOperations: vi.fn(),
    getOperationPreviewsForScope: vi.fn(),
    getOperationLogs: vi.fn().mockResolvedValue([]),
    restoreMoves: vi.fn()
  }
}));

const t = makeTranslator("zh");
const chrome = { t, setView: vi.fn(), language: "zh", view: "preview" } as unknown as ChromeContextValue;
let container: HTMLDivElement;
let root: Root;
let narrowMatches = true;
const narrowListeners = new Set<(event: MediaQueryListEvent) => void>();

function markVisible(element: HTMLElement) {
  element.getClientRects = () => [{ width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON() { return {}; } }] as unknown as DOMRectList;
}

function preview(id: string, overrides: Partial<OperationPreview> = {}): OperationPreview {
  return {
    id,
    fileId: `file-${id}`,
    operation_type: "rename",
    source_path: `C:/Downloads/${id}.txt`,
    target_path: `C:/Work/${id}.txt`,
    old_name: `${id}.txt`,
    new_name: `${id}.txt`,
    status: "pending",
    risk_level: "Normal",
    confidence: 0.95,
    requires_confirmation: false,
    selected_by_default: true,
    is_executable: true,
    editable_new_name: true,
    will_create_parent: false,
    reason: "Rule match",
    ...overrides
  };
}

function file(id: string): FileRecord {
  return {
    id: `file-${id}`,
    name: `${id}.txt`,
    path: `C:/Downloads/${id}.txt`,
    directory: "C:/Downloads",
    extension: "txt",
    size: 128,
    file_type: "Document",
    purpose: "Work",
    suggested_action: "Move",
    suggested_target_path: `C:/Work/${id}.txt`,
    suggested_name: `${id}.txt`,
    risk_level: "Normal",
    lifecycle: "Active",
    confidence: 0.95,
    requires_confirmation: false,
    is_duplicate: false,
    is_deleted: false,
    is_stale: false,
    matched_rules: [],
    context: "work",
    classification_reason: "Rule match"
  } as unknown as FileRecord;
}

function render(node: React.ReactNode) {
  act(() => root.render(createElement(ChromeProvider, { value: chrome, children: node })));
}

function buttonWithText(text: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function setPreviewState(previews: OperationPreview[], selectedIds = new Set(previews.map((item) => item.id))) {
  useOperationQueueStore.setState({
    previews,
    displayPreviews: previews,
    previewNameOverrides: {},
    previewScope: { kind: "all" },
    previewTotal: previews.length,
    previewLimit: 100,
    previewTruncated: false,
    previewHasMore: false,
    selectedOperationIds: selectedIds,
    executionIntent: {
      source: "organize",
      scopeKey: "all",
      allowedPreviewIds: new Set(previews.map((item) => item.id)),
      initialAllowedCount: previews.length,
      sessionId: "v421"
    },
    lastExecutionLogs: [],
    executionError: "",
    operationProgress: null,
    isOperationCanceling: false
  });
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = vi.fn();
  narrowMatches = true;
  narrowListeners.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: narrowMatches,
      media: "(max-width: 1100px)",
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => narrowListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => narrowListeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  apiMocks.executeMoves.mockReset().mockResolvedValue({ logs: [], batch_id: "batch-v421" });
  useFileLibraryStore.setState({
    scope: { kind: "all" },
    libraryPage: emptyPage,
    organizeQueue: [],
    organizeQueueTotal: 0,
    organizeQueueTruncated: false,
    isLoadingOrganizeQueue: false,
    organizeQueueError: "",
    loadStats: vi.fn().mockResolvedValue(undefined),
    loadFirstPage: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    loadOrganizeQueue: vi.fn().mockResolvedValue(undefined)
  });
  useOrganizeDecisionStore.setState({ decisions: {} });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("organize v4.2.1 component interactions", () => {
  it("keeps the only invalid row editable when its group has zero executable items and restores every count", async () => {
    setPreviewState([preview("repairable")]);
    render(createElement(TimelineView));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="新文件名"]')!;

    await changeInput(input, "bad?.txt");

    const groupCheckbox = container.querySelector<HTMLInputElement>('section input[type="checkbox"]')!;
    const group = groupCheckbox.closest("section")!;
    expect(groupCheckbox.disabled).toBe(true);
    expect(group.className).not.toContain("pointer-events-none");
    expect(input.disabled).toBe(false);
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(group.textContent).toContain("已选 1 · 可执行 0");
    expect(buttonWithText("执行已选操作 · 0").hasAttribute("disabled")).toBe(true);

    await changeInput(input, "repaired.txt");

    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(groupCheckbox.disabled).toBe(false);
    expect(group.textContent).toContain("已选 1 · 可执行 1");
    expect(buttonWithText("执行已选操作 · 1").hasAttribute("disabled")).toBe(false);
  });

  it("lets a selected item be cleared after it becomes blocked and does not reselect it when restored", async () => {
    const original = preview("late-block");
    setPreviewState([original]);
    render(createElement(TimelineView));
    const rowCheckbox = () => container.querySelector<HTMLInputElement>(`input[aria-label="选择操作 · ${original.old_name}"]`)!;

    const blocked = { ...original, is_executable: false, blocking_reason: "source changed" };
    await act(async () => useOperationQueueStore.setState({ previews: [blocked], displayPreviews: [blocked] }));
    expect(rowCheckbox().checked).toBe(true);
    expect(rowCheckbox().disabled).toBe(false);
    await act(async () => rowCheckbox().click());
    expect(useOperationQueueStore.getState().selectedOperationIds).toEqual(new Set());

    await act(async () => useOperationQueueStore.setState({ previews: [original], displayPreviews: [original] }));
    expect(rowCheckbox().checked).toBe(false);
    expect(rowCheckbox().disabled).toBe(false);
    await act(async () => rowCheckbox().click());
    expect(useOperationQueueStore.getState().selectedOperationIds).toEqual(new Set([original.id]));
  });

  it("keeps row, summary, button, dialog, and executeMoves aligned after an invalid rename", async () => {
    setPreviewState([preview("first"), preview("second")]);
    render(createElement(TimelineView));

    expect(buttonWithText("执行已选操作 · 2")).toBeTruthy();
    const inputs = container.querySelectorAll<HTMLInputElement>('input[aria-label="新文件名"]');
    await changeInput(inputs[1], "bad?.txt");

    expect(container.querySelector('[data-preview-execution-state="invalid-name"]')?.textContent).toContain("文件名无效");
    expect(inputs[1].getAttribute("aria-invalid")).toBe("true");
    expect(buttonWithText("执行已选操作 · 1")).toBeTruthy();
    const actualCount = [...container.querySelectorAll("dt")].find((item) => item.textContent === "实际可执行")?.parentElement?.querySelector("dd");
    expect(actualCount?.textContent).toBe("1");

    await act(async () => buttonWithText("执行已选操作 · 1").click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("1");
    const confirm = [...dialog!.querySelectorAll("button")].find((item) => item.textContent?.includes("1"));
    await act(async () => confirm?.click());

    await vi.waitFor(() => expect(apiMocks.executeMoves).toHaveBeenCalledTimes(1));
    expect(apiMocks.executeMoves.mock.calls[0][0]).toHaveLength(1);
    expect(apiMocks.executeMoves.mock.calls[0][0][0].id).toBe("first");
  });

  it("restores the executable row state immediately after fixing the name", async () => {
    setPreviewState([preview("rename")]);
    render(createElement(TimelineView));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="新文件名"]')!;

    await changeInput(input, "bad?.txt");
    expect(container.querySelector('[data-preview-execution-state="invalid-name"]')).not.toBeNull();
    expect(container.querySelector('[data-preview-execution-state="executable"]')).toBeNull();
    await changeInput(input, "fixed.txt");
    expect(container.querySelector('[data-preview-execution-state="executable"]')?.textContent).toContain("可执行");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(buttonWithText("执行已选操作 · 1")).toBeTruthy();
  });

  it.each([
    ["default", preview("normal"), "dialog", "执行已确认的整理操作"],
    ["sensitive", preview("sensitive", { risk_level: "Sensitive" }), "alertdialog", "确认执行包含风险的操作"],
    ["system", preview("system", { risk_level: "System" }), "alertdialog", "确认执行包含风险的操作"],
    ["duplicate", preview("duplicate", { is_duplicate: true }), "alertdialog", "确认执行包含风险的操作"],
    ["low-confidence", preview("low", { confidence: 0.5 }), "alertdialog", "确认执行包含风险的操作"],
    ["requires-confirmation", preview("confirm", { requires_confirmation: true }), "alertdialog", "确认执行包含风险的操作"],
    ["create-parent", preview("folder", { will_create_parent: true }), "alertdialog", "确认执行包含风险的操作"],
    ["trash-priority", preview("trash", { operation_type: "move_to_trash", risk_level: "Sensitive" }), "alertdialog", "确认移到回收站"]
  ])("renders the %s confirmation with real dialog semantics", async (_name, operation, role, title) => {
    setPreviewState([operation]);
    render(createElement(TimelineView));
    await act(async () => buttonWithText("执行已选操作 · 1").click());
    const dialog = container.querySelector(`[role="${role}"]`);
    expect(dialog?.textContent).toContain(title);
    expect(dialog?.textContent).toContain("1");
  });

  it("traps focus through a parent rerender, closes on Escape, and restores the trigger", async () => {
    let rerenderParent: () => void = () => undefined;
    function Harness() {
      const [open, setOpen] = useState(false);
      const [revision, setRevision] = useState(0);
      rerenderParent = () => setRevision((value) => value + 1);
      return createElement("div", null,
        createElement("button", { onClick: () => setOpen(true) }, `Open warning ${revision}`),
        createElement(ConfirmDialog, {
          open,
          tone: "warning",
          title: "Warning",
          confirmLabel: "Confirm",
          cancelLabel: "Cancel",
          onConfirm: vi.fn(),
          onCancel: () => setOpen(false)
        })
      );
    }
    render(createElement(Harness));
    const trigger = buttonWithText("Open warning");
    markVisible(trigger);
    trigger.focus();
    await act(async () => trigger.click());
    const dialog = container.querySelector<HTMLElement>('[role="alertdialog"]')!;
    const [cancel, confirm] = dialog.querySelectorAll<HTMLButtonElement>("button");
    expect(document.activeElement).toBe(cancel);
    await act(async () => rerenderParent());
    expect(document.activeElement).toBe(cancel);
    confirm.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(cancel);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(confirm);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(["default", "warning", "danger"] as const)("restores a stable fallback after %s dialog trigger unmount and supports button close", async (tone) => {
    const confirmed = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      const [showTrigger, setShowTrigger] = useState(true);
      const fallbackRef = useRef<HTMLButtonElement | null>(null);
      return createElement("main", null,
        createElement("button", { ref: fallbackRef, "data-dialog-focus-fallback": true }, "Stable action"),
        showTrigger ? createElement("button", { onClick: () => { setOpen(true); setShowTrigger(false); } }, `Open ${tone}`) : null,
        createElement(ConfirmDialog, {
          open,
          tone,
          title: tone,
          confirmLabel: "Confirm",
          cancelLabel: "Cancel",
          restoreFocus: () => fallbackRef.current,
          onConfirm: () => { confirmed(); setOpen(false); },
          onCancel: () => setOpen(false)
        })
      );
    }
    render(createElement(Harness));
    await act(async () => buttonWithText(`Open ${tone}`).click());
    const role = tone === "default" ? "dialog" : "alertdialog";
    const dialog = container.querySelector<HTMLElement>(`[role="${role}"]`)!;
    const buttons = dialog.querySelectorAll<HTMLButtonElement>("button");
    await act(async () => buttons[tone === "danger" ? 1 : 0].click());
    expect(container.querySelector(`[role="${role}"]`)).toBeNull();
    expect(document.activeElement?.textContent).toBe("Stable action");
    expect(confirmed).toHaveBeenCalledTimes(tone === "danger" ? 1 : 0);
  });

  it("keeps wide Inspector semantics out of the DOM and switches narrow details with row focus restoration", async () => {
    const previews = [preview("one"), preview("two")];
    useFileLibraryStore.setState({ organizeQueue: [file("one"), file("two")], organizeQueueTotal: 2 });
    setPreviewState(previews, new Set());
    useOperationQueueStore.setState({ refreshPreviewsForFiles: vi.fn().mockResolvedValue({ previews, total: 2, limit: 100, offset: 0, truncated: false, hasMore: false }) });
    narrowMatches = false;
    render(createElement(OrganizeSuggestionsView));
    await vi.waitFor(() => expect(container.querySelector("#organize-inspector")).not.toBeNull());
    expect(container.textContent).not.toContain("返回文件列表");
    expect(container.querySelector("#organize-suggestion-pane")).not.toBeNull();
    expect(container.querySelector("#organize-inspector")).not.toBeNull();
    expect(container.querySelector("[data-narrow-pane]")).toBeNull();
    await act(async () => container.querySelector("#organize-inspector")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector("#organize-suggestion-pane")).not.toBeNull();

    await setNarrowLayout(true);
    await vi.waitFor(() => expect(container.querySelector('[data-narrow-pane="list"]')).not.toBeNull());

    await act(async () => buttonWithText("查看文件详情").click());
    expect(container.querySelector('[data-narrow-pane="details"]')).not.toBeNull();
    const inspector = container.querySelector<HTMLElement>("#organize-inspector")!;
    inspector.scrollTop = 80;
    await act(async () => inspector.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(container.querySelector('[data-narrow-pane="list"]')).not.toBeNull();
    const list = container.querySelector<HTMLElement>('[role="list"]')!;
    const activeRow = container.querySelector<HTMLElement>('[role="listitem"][aria-current="true"]')!;
    expect(document.activeElement).toBe(activeRow ?? list);
    expect(list.getAttribute("aria-activedescendant")).toBe("organize-suggestion-file-one");

    await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(inspector.scrollTop).toBe(0);
  });
});

async function setNarrowLayout(matches: boolean) {
  narrowMatches = matches;
  await act(async () => {
    const event = { matches, media: "(max-width: 1100px)" } as MediaQueryListEvent;
    for (const listener of narrowListeners) listener(event);
  });
}
