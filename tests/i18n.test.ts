import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

describe("makeTranslator", () => {
  it("falls back to the key string when a translation is missing", () => {
    const t = makeTranslator("zh");

    expect(t("missing.translation" as Parameters<typeof t>[0])).toBe("missing.translation");
  });

  it("describes scanner disk size as a reference capacity, not real disk usage", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");

    expect(zh("diskUsageInScope")).toContain("磁盘容量参考值");
    expect(en("diskUsageInScope").toLowerCase()).toContain("reference capacity");
  });
});
