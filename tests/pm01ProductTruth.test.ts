import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { maturityCopy } from "../src/i18n/maturityCopy";

const zh = makeTranslator("zh");
const en = makeTranslator("en");

describe("PM-01 product truth", () => {
  it("positions Rules and Automation as compatibility policies, not Organize semantic authority", () => {
    for (const [t, compatibilityPattern, legacyPattern, doesNotCreatePattern, noReplacePattern] of [
      [zh, /兼容性/, /旧分类/, /不会生成/, /不会替换/],
      [en, /legacy classification policies/, /legacy classification/, /does not create/, /do not replace/]
    ] as const) {
      expect(t("viewDescRules")).toMatch(compatibilityPattern);
      expect(t("automationWorkspaceDesc")).toMatch(/Managed AI/);
      expect(t("settingsAutomationDesc")).toMatch(/Managed AI/);
      expect(t("automationRunConfirmDesc")).toMatch(legacyPattern);
      expect(t("automationRunConfirmDesc")).toMatch(doesNotCreatePattern);
      expect(t("automationPreviewRequiredHint")).toMatch(/Managed AI/);
      expect(t("reapplyRulesSafetyDesc")).toMatch(noReplacePattern);
    }
  });

  it("keeps learning history out of current Managed AI semantics and makes no active Preference Memory claim", () => {
    const dictionary = readFileSync(resolve("src/i18n/dictionary.ts"), "utf8");
    expect(zh("aiLearningHint")).toContain("当前 Managed AI 语义评估不会读取它");
    expect(en("aiLearningHint")).toContain("Current Managed AI semantic assessments do not read it");
    expect(zh("aiLearnedRulesDesc")).toContain("不是当前 Managed AI 语义输入");
    expect(en("aiLearnedRulesDesc")).toContain("not an input to current Managed AI semantics");
    expect(dictionary).not.toMatch(/Preference Memory|偏好记忆/i);
  });

  it("keeps Files, Search, Preview, and History/Restore available when AI is skipped", () => {
    expect(zh("onboardingSkipFeatureBoundary")).toContain("文件、搜索、预览和历史恢复仍可使用");
    expect(en("onboardingSkipFeatureBoundary")).toContain("Files, Search, Preview, and History/Restore remain available");
    for (const key of [
      "onboardingCapabilityFiles",
      "onboardingCapabilitySearch",
      "onboardingCapabilityPreview",
      "onboardingCapabilityRestore"
    ] as const) {
      expect(zh(key).length).toBeGreaterThan(0);
      expect(en(key).length).toBeGreaterThan(0);
    }
  });

  it("keeps Skip AI separate from the required useful-folder first value", () => {
    expect(zh("onboardingSkipAI")).toBe("跳过 AI 配置");
    expect(en("onboardingSkipAI")).toBe("Skip AI setup");
    expect(zh("onboardingUsefulFolderRequired")).toContain("选择并保存一个有用的文件夹");
    expect(en("onboardingUsefulFolderRequired")).toContain("Choose and save a useful folder");
    expect(maturityCopy("zh").onboardingNeedsFolder).toContain("添加一个有用的文件夹");
    expect(maturityCopy("en").onboardingNeedsFolder).toContain("Add a useful folder");
  });
});
