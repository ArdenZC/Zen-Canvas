import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("restore view cleanup safe trash", () => {
  it("shows Zen Canvas safe trash batches and restore safety copy", () => {
    const source = read("src/views/restore/RestoreView.tsx");
    const t = makeTranslator("zh");

    expect(t("cleanupTrashRecords")).toBe("清理回收站");
    expect(t("cleanupTrashRestoreBlockedDesc")).toContain("原路径已有文件");
    expect(t("storageCleanupRestoreFromTrash")).toContain("恢复记录");
    expect(source).toContain("listCleanupTrashBatches");
    expect(source).toContain("restoreCleanupTrashItems");
    expect(source).toContain("cleanupBatches");
    expect(source).toContain('t("historyCleanupScope")');
  });
});
