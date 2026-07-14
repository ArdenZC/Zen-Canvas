// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { makeTranslator } from "../src/i18n";
import type { Rule } from "../src/types/domain";
import { AutomationRuleDialog } from "../src/views/automation/AutomationRuleDialog";
import { automationOverview, ruleActionSummary, ruleConditionSummary, validateRuleDraft } from "../src/views/automation/automationModel";

const t = makeTranslator("en");
const setInputValue = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
};
const sample: Rule = {
  id: "rule-1",
  name: "Screenshots",
  source: "user",
  enabled: true,
  priority: 75,
  weight: 75,
  root_operator: "AND",
  groups: [{ id: "group-1", operator: "AND", conditions: [{ id: "condition-1", field: "name", operator: "contains", value: "screenshot" }] }],
  action: { purpose: "Temporary", lifecycle: "Inbox" },
  created_at: "2026-07-14T00:00:00Z",
  updated_at: "2026-07-14T00:00:00Z"
};

describe("automation workspace behavior", () => {
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="app-shell-content"></div><div id="test-root"></div>';
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    resetModalInfrastructureForTests();
    document.body.innerHTML = "";
  });

  it("derives honest counts and readable condition/action summaries", () => {
    expect(automationOverview([sample, { ...sample, id: "paused", enabled: false }], 12)).toEqual({ total: 2, enabled: 1, paused: 1, needsReview: 12 });
    expect(ruleConditionSummary(sample, t)).toBe("File name contains screenshot");
    expect(ruleActionSummary(sample, t)).toBe("Temporary · Inbox");
    expect(validateRuleDraft("", sample.groups)).toMatchObject({ name: "required" });
    expect(validateRuleDraft("ok", [{ ...sample.groups[0], conditions: [{ ...sample.groups[0].conditions[0], value: "" }] }])).toMatchObject({ conditions: "required" });
  });

  it("localizes builder options and keeps invalid drafts unsavable until required fields are valid", async () => {
    const onSave = vi.fn(async (_rule: Rule) => undefined);
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open t={t} onClose={vi.fn()} onSave={onSave} />));

    const textInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="number"])'));
    const [name, value] = textInputs;
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save rule")!;
    expect(save.disabled).toBe(true);
    expect(Array.from(document.querySelectorAll("option"), (option) => option.textContent)).toEqual(expect.arrayContaining(["File name", "contains", "Temporary", "Inbox"]));

    await act(async () => {
      name.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      value.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(2);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(value.getAttribute("aria-invalid")).toBe("true");

    await act(async () => {
      setInputValue(name, "Design files");
      setInputValue(value, "fig");
    });
    expect(save.disabled).toBe(false);
    await act(async () => save.click());
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("preserves fields while editing and saves through the provided persistence boundary", async () => {
    const onSave = vi.fn(async (_rule: Rule) => undefined);
    const onClose = vi.fn();
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open rule={sample} t={t} onClose={onClose} onSave={onSave} />));

    const name = document.querySelector<HTMLInputElement>('input[value="Screenshots"]')!;
    expect(name).toBeTruthy();
    await act(async () => {
      setInputValue(name, "Screenshot inbox");
    });
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save rule")!;
    await act(async () => save.click());

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: "rule-1", name: "Screenshot inbox", enabled: true, priority: 75, action: { purpose: "Temporary", lifecycle: "Inbox" } });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("opens a stacked discard confirmation for dirty close and keeps edits when canceled", async () => {
    const onClose = vi.fn();
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open rule={sample} t={t} onClose={onClose} onSave={vi.fn(async (_rule: Rule) => undefined)} />));
    const name = document.querySelector<HTMLInputElement>('input[value="Screenshots"]')!;
    await act(async () => {
      setInputValue(name, "Dirty");
    });
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
    await act(async () => close.click());

    expect(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).toHaveLength(2);
    const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Cancel" && button.closest('[role="alertdialog"]'))!;
    await act(async () => cancel.click());
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[value="Dirty"]')).toBeTruthy();
  });
});
