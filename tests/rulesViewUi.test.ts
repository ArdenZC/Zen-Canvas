import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("automation workspace source contract", () => {
  it("is a responsive list-detail workspace with supported trigger disclosure", () => {
    const view = read("src/views/rules/RulesView.tsx");
    const t = makeTranslator("zh");

    expect(t("automationWorkspaceTitle")).toBe("自动化工作区");
    expect(view).toContain('useMediaQuery("(max-width: 980px)")');
    expect(view).toContain('role="listbox"');
    expect(view).toContain('event.key === "ArrowDown"');
    expect(view).toContain('event.key === "Enter"');
    expect(view).toContain('event.key === " "');
    expect(view).toContain('event.key !== "Escape"');
    expect(view).toContain("listRef.current?.focus()");
    expect(view).toContain('t("automationScheduleTrigger")');
    expect(view).toContain('available={false}');
  });

  it("runs only classification suggestions and routes review to Organize", () => {
    const view = read("src/views/rules/RulesView.tsx");
    expect(view).toContain("executeRulesForScope");
    expect(view).toContain('setView("organize")');
    expect(view).not.toContain("executeSelected");
    expect(view).not.toContain("executeMoves");
    expect(view).not.toContain("window.confirm");
    expect(view).not.toContain("window.prompt");
    expect(view).not.toContain("window.alert");
  });

  it("uses app modals for editing, dirty close, running, and deletion confirmation", () => {
    const view = read("src/views/rules/RulesView.tsx");
    const dialog = read("src/views/automation/AutomationRuleDialog.tsx");
    expect(view).toContain("AutomationRuleDialog");
    expect(view).toContain("ConfirmDialog");
    expect(dialog).toContain("ModalPortal");
    expect(dialog).toContain("discardOpen");
    expect(dialog).toContain("validateRuleDraft");
    expect(dialog).toContain('aria-modal="true"');
  });
});
