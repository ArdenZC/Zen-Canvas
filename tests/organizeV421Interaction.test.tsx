// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
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

  it("traps focus, closes on Escape, and restores the trigger", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement("div", null,
        createElement("button", { onClick: () => setOpen(true) }, "Open warning"),
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
    trigger.focus();
    await act(async () => trigger.click());
    const dialog = container.querySelector<HTMLElement>('[role="alertdialog"]')!;
    const [cancel, confirm] = dialog.querySelectorAll<HTMLButtonElement>("button");
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

  it("switches the narrow inspector, restores list focus, and resets detail scrolling", async () => {
    const previews = [preview("one"), preview("two")];
    useFileLibraryStore.setState({ organizeQueue: [file("one"), file("two")], organizeQueueTotal: 2 });
    setPreviewState(previews, new Set());
    useOperationQueueStore.setState({ refreshPreviewsForFiles: vi.fn().mockResolvedValue({ previews, total: 2, limit: 100, offset: 0, truncated: false, hasMore: false }) });
    render(createElement(OrganizeSuggestionsView));
    await vi.waitFor(() => expect(container.querySelector('[data-narrow-pane="list"]')).not.toBeNull());

    await act(async () => buttonWithText("查看文件详情").click());
    expect(container.querySelector('[data-narrow-pane="details"]')).not.toBeNull();
    const inspector = container.querySelector<HTMLElement>("#organize-inspector")!;
    inspector.scrollTop = 80;
    await act(async () => inspector.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    const list = container.querySelector<HTMLElement>('[role="list"]')!;
    await act(async () => await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(container.querySelector('[data-narrow-pane="list"]')).not.toBeNull();
    expect(document.activeElement).toBe(list);

    await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(inspector.scrollTop).toBe(0);
  });
});
