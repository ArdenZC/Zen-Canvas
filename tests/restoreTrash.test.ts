import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("restore view trash cleanup logs", () => {
  it("shows move_to_trash logs as system-trash restore only", () => {
    const source = read("src/views/restore/RestoreView.tsx");
    const t = makeTranslator("zh");

    expect(t("restoreFromSystemTrash")).toBe("请从系统回收站恢复");
    expect(t("restoreDesc")).toContain("回收站清理项需要从系统回收站恢复");
    expect(source).toContain('log.operation_type === "move_to_trash"');
    expect(source).toContain('t("restoreFromSystemTrash")');
    expect(source).toContain('log.operation_type !== "move_to_trash"');
  });
});
