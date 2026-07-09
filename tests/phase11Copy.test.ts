import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("phase 11 product copy", () => {
  it("removes abstract Chinese labels from UI copy", () => {
    const i18n = read("src/i18n.ts");

    for (const phrase of [
      "全息解构中",
      "全维宇宙",
      "活跃枢纽",
      "沉寂冰川",
      "等待引流",
      "执行一键调度",
      "待分拣堆栈",
      "目标盒子",
      "分类策略",
      "发行检查"
    ]) {
      expect(i18n).not.toContain(phrase);
    }
  });

  it("uses plain Chinese labels for core organization concepts", () => {
    const t = makeTranslator("zh");

    expect(t("dispatching")).toBe("正在生成整理建议...");
    expect(t("allAssets")).toBe("全部文件");
    expect(t("activeHub")).toBe("最近在用");
    expect(t("archiveGlacier")).toBe("可归档");
    expect(t("waitingFlow")).toBe("暂无文件进入此分类");
    expect(t("runDispatch")).toBe("刷新整理预览");
    expect(t("inboxStack")).toBe("待整理文件");
    expect(t("targetBoxes")).toBe("建议去向");
    expect(t("strategy")).toBe("自动规则，高级功能");
    expect(t("releaseReady")).toBe("发布检查");
    expect(t("settingsDeveloperRelease")).toBe("开发检查");
  });

  it("makes disk reference copy explicit and safety copy direct in both languages", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");

    expect(zh("scannerReferenceDiskHint")).toContain("参考值");
    expect(zh("scannerReferenceDiskHint")).toContain("不代表真实磁盘使用率");
    expect(zh("diskUsageInScope")).toContain("磁盘容量参考值");
    expect(en("scannerReferenceDiskHint")).toContain("reference value");
    expect(en("scannerReferenceDiskHint")).toContain("not real disk usage");
    expect(en("diskUsageInScope")).toContain("reference capacity");

    for (const key of ["hubSafetyHint", "dispatchDesc", "previewNoOverwriteDelete", "libraryScopeHint", "commandIdleDesc"] as const) {
      expect(en(key).toLowerCase()).toMatch(/preview|review|confirm|local index|no files are uploaded|never move|not moved|not delete|delete files/);
    }
  });
});
