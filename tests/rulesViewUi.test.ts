import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("rules view UI", () => {
  it("separates system templates from editable user rules and removes window.confirm", () => {
    const rulesView = read("src/views/rules/RulesView.tsx");
    const sharedUi = read("src/views/shared/ui.ts");
    const t = makeTranslator("zh");

    expect(t("systemRuleTemplates")).toBe("系统规则模板");
    expect(t("userRules")).toBe("用户规则");
    expect(t("lockedTemplate")).toBe("锁定模板");
    expect(t("editableRule")).toBe("可编辑规则");
    expect(t("confirmDeleteRuleTitle")).toBe("删除这条规则？");
    expect(t("confirmReapplyRulesTitle")).toBe("执行自动规则？");

    expect(sharedUi).toContain("ConfirmDialog");
    expect(rulesView).toContain("ConfirmDialog");
    expect(rulesView).toContain("systemRules");
    expect(rulesView).toContain("userRules");
    expect(rulesView).toContain('t("systemRuleTemplates")');
    expect(rulesView).toContain('t("userRules")');
    expect(rulesView).toContain('t("lockedTemplate")');
    expect(rulesView).toContain('t("editableRule")');
    expect(rulesView).toContain("buttonIconDanger");
    expect(rulesView).not.toContain("window.confirm");
  });

  it("makes the builder readable with sections and an expected-result summary", () => {
    const rulesView = read("src/views/rules/RulesView.tsx");
    const t = makeTranslator("zh");

    expect(t("ruleBasicInfo")).toBe("基本信息");
    expect(t("ruleConditions")).toBe("条件");
    expect(t("ruleActions")).toBe("动作");
    expect(t("ruleExpectedResult")).toBe("预期结果摘要");
    expect(t("ruleNoAutoMove")).toBe("不会自动移动文件");
    expect(t("rulePreviewRequired")).toBe("需要进入预览确认");
    expect(t("reapplyRulesSafetyDesc")).toContain("可能覆盖 AI 分类结果");
    expect(t("reapplyRulesSafetyDesc")).toContain("默认不会覆盖用户手动确认或纠正过的结果");
    expect(t("ruleNoAutoMove")).toContain("不会自动移动文件");
    expect(t("rulePreviewRequired")).toContain("需要进入预览确认");

    expect(rulesView).toContain('t("ruleBasicInfo")');
    expect(rulesView).toContain('t("ruleConditions")');
    expect(rulesView).toContain('t("ruleActions")');
    expect(rulesView).toContain('t("ruleExpectedResult")');
    expect(rulesView).toContain('t("ruleNoAutoMove")');
    expect(rulesView).toContain('t("rulePreviewRequired")');
    expect(rulesView).toContain("expectedResultText");
    expect(rulesView).toContain("<div className={pageSurface}>");
    expect(rulesView).not.toContain("2xl:overflow-hidden");
    expect(rulesView).not.toContain("grid min-h-0 gap-4 overflow-auto");
    expect(rulesView).toContain("buttonIconDanger");
    expect(rulesView).toContain('aria-label={t("deleteCondition")}');
    expect(rulesView).toContain("aria-pressed={rootOperator === item}");
    expect(rulesView).toContain("aria-pressed={group.operator === item}");
    expect(rulesView).toContain("NoticeBanner");
    expect(rulesView).toContain("buttonSecondary");
    expect(rulesView).toContain("glassButtonWarning");
  });
});
