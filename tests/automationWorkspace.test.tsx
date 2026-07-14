// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { makeTranslator } from "../src/i18n";
import type { Rule } from "../src/types/domain";
import { AutomationRuleDialog } from "../src/views/automation/AutomationRuleDialog";
import { acceptsAutomationRunResult, automationOverview, createAutomationRunContext, draftConditionSummary, ruleActionSummary, ruleConditionSummary, validateRuleDraft } from "../src/views/automation/automationModel";
import { normalizeConditionForField, validateRuleCondition } from "../src/views/rules/ruleBuilder";

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
    expect(draftConditionSummary([{ ...sample.groups[0], conditions: [{ ...sample.groups[0].conditions[0], value: "" }] }], "AND", t)).toBe("Condition is incomplete");
    expect(draftConditionSummary([], "AND", t)).toBe("Condition is incomplete");
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

  it("persists edited priority and explains the backend scoring order", async () => {
    const onSave = vi.fn(async (_rule: Rule) => undefined);
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open rule={sample} t={t} onClose={vi.fn()} onSave={onSave} />));
    const advancedToggle = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Advanced conditions"))!;
    await act(async () => advancedToggle.click());
    expect(document.body.textContent).toContain("Matching candidates are ordered by combined score");
    const priority = document.querySelector<HTMLInputElement>('input[type="number"][max="1000"]')!;
    await act(async () => setInputValue(priority, "333"));
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save rule")!;
    await act(async () => save.click());
    expect(onSave.mock.calls[0][0]).toMatchObject({ priority: 333 });
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

  it("uses one condition draft with a field-compatible input matrix and auto-corrected operator", async () => {
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open t={t} onClose={vi.fn()} onSave={vi.fn(async (_rule: Rule) => undefined)} />));

    const field = document.querySelector<HTMLSelectElement>('select[aria-label="Field"]')!;
    const operator = document.querySelector<HTMLSelectElement>('select[aria-label="Operator"]')!;
    const setSelect = (element: HTMLSelectElement, value: string) => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };

    await act(async () => setSelect(field, "size"));
    expect(operator.value).toBe("equals");
    expect(Array.from(operator.options, (option) => option.value)).toEqual(["equals", "greaterThan", "lessThan"]);
    expect(document.querySelector<HTMLInputElement>('input[type="number"][aria-label="Value"]')).toBeTruthy();

    await act(async () => setSelect(field, "modified_at"));
    expect(operator.value).toBe("olderThanDays");
    expect(Array.from(operator.options, (option) => option.value)).toEqual(["olderThanDays", "newerThanDays"]);
    expect(document.querySelector<HTMLInputElement>('input[type="number"][step="1"]')).toBeTruthy();

    await act(async () => setSelect(field, "file_type"));
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Value"]')).toBeTruthy();
    expect(Array.from(operator.options, (option) => option.value)).toEqual(["equals", "is"]);

    await act(async () => setSelect(field, "is_duplicate"));
    expect(operator.value).toBe("is");
    expect(Array.from(document.querySelector<HTMLSelectElement>('select[aria-label="Value"]')!.options, (option) => option.textContent)).toEqual(["Yes", "No"]);
  });

  it("hides the basic editor while advanced is open and preserves the same draft when collapsed", async () => {
    const onSave = vi.fn(async (_rule: Rule) => undefined);
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open t={t} onClose={vi.fn()} onSave={onSave} />));
    const [name] = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="number"])'));
    await act(async () => setInputValue(name, "One draft"));
    const advancedToggle = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Advanced conditions"))!;
    expect(document.querySelector('[id$="-condition-editor"]')).toBeTruthy();
    await act(async () => advancedToggle.click());
    expect(document.querySelector('[id$="-condition-editor"]')).toBeNull();
    expect(document.querySelector('[aria-label="Advanced conditions"]')).toBeTruthy();
    await act(async () => advancedToggle.click());
    expect(document.querySelector<HTMLInputElement>('input[value="One draft"]')).toBeTruthy();
  });

  it("does not make the live rule summary an assertive per-keystroke announcement", async () => {
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open t={t} onClose={vi.fn()} onSave={vi.fn(async (_rule: Rule) => undefined)} />));
    const summary = document.querySelector("section")!;
    expect(summary.hasAttribute("aria-live")).toBe(false);
  });

  it("starts new rules paused, keeps edit state, and retains the modal after save failure", async () => {
    const onSave = vi.fn(async (_rule: Rule) => { throw new Error("sqlite offline"); });
    root = createRoot(document.getElementById("test-root")!);
    await act(async () => root!.render(<AutomationRuleDialog open t={t} onClose={vi.fn()} onSave={onSave} />));
    const [name, value] = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="number"])'));
    await act(async () => {
      setInputValue(name, "Paused rule");
      setInputValue(value, "report");
    });
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save rule")!;
    await act(async () => save.click());
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({ enabled: false });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('input[value="Paused rule"]')).toBeTruthy();
  });

  it("rejects non-finite and out-of-range numeric drafts and accepts only the current run context", () => {
    expect(validateRuleDraft("ok", sample.groups, Number.NaN, 75).weight).toBe("finite");
    expect(validateRuleDraft("ok", sample.groups, 101, 75).weight).toBe("range");
    expect(validateRuleDraft("ok", sample.groups, 75, 1001).priority).toBe("range");
    const context = createAutomationRunContext(4, { kind: "all" }, [sample], "2026-07-14T00:00:00Z");
    expect(acceptsAutomationRunResult(context, true, 4, context.scopeSignature, context.enabledRuleVersion)).toBe(true);
    expect(acceptsAutomationRunResult(context, true, 5, context.scopeSignature, context.enabledRuleVersion)).toBe(false);
    expect(acceptsAutomationRunResult(context, true, 4, "different-scope", context.enabledRuleVersion)).toBe(false);
    expect(acceptsAutomationRunResult(context, true, 4, context.scopeSignature, "different-rules")).toBe(false);
    expect(acceptsAutomationRunResult(context, false, 4, context.scopeSignature, context.enabledRuleVersion)).toBe(false);
    expect(validateRuleCondition({ id: "days", field: "modified_at", operator: "olderThanDays", value: -1 })).toBe("nonNegative");
    expect(validateRuleCondition({ id: "days-fraction", field: "modified_at", operator: "olderThanDays", value: 1.5 })).toBe("integer");
    expect(validateRuleCondition({ id: "size-text", field: "size", operator: "greaterThan", value: "not-a-number" })).toBe("number");
    expect(normalizeConditionForField({ ...sample.groups[0].conditions[0], operator: "contains" }, "size").operator).toBe("equals");
  });
});
