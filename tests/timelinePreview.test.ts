import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("preview execute safety UI", () => {
  it("uses shared primitives for the execution safety summary and progress state", () => {
    const timeline = read("src/views/timeline/TimelineView.tsx");
    const t = makeTranslator("zh");

    expect(t("previewSafetyTitle")).toBe("执行前请确认");
    expect(t("executeSelectedWithCount")).toBe("执行已选操作 · {count}");
    expect(t("previewNoOverwriteDelete")).toContain("不会覆盖");
    expect(t("previewNoOverwriteDelete")).toContain("不会删除");
    expect(t("groupNoExecutableItems")).toBe("此分组没有可执行项");
    expect(t("operationCreatesParent")).toBe("会创建父目录");
    expect(t("operationProgressTitle")).toBe("正在执行已选操作");

    expect(timeline).toContain("MetricCard");
    expect(timeline).toContain("NoticeBanner");
    expect(timeline).toContain("StateBlock");
    expect(timeline).toContain("MetricCard label={t(\"previewTotalSuggestions\")}");
    expect(timeline).toContain("MetricCard label={t(\"selectedOperations\")}");
    expect(timeline).toContain("MetricCard label={t(\"executableItems\")}");
    expect(timeline).toContain("MetricCard label={t(\"blockedItems\")}");
    expect(timeline).toContain("MetricCard label={t(\"confirmationItems\")}");
    expect(timeline).toContain("MetricCard label={t(\"autoCreateFolders\")}");
    expect(timeline).toContain('tone="warning"');
    expect(timeline).toContain('t("executeSelectedWithCount")');
    expect(timeline).toContain("selectedCount.toLocaleString()");
    expect(timeline).toContain("disabled={executable.length === 0}");
    expect(timeline).toContain("groupDisabledDescriptionId");
    expect(timeline).toContain("aria-describedby={executable.length === 0 ? groupDisabledDescriptionId : undefined}");
    expect(timeline).toContain('t("groupNoExecutableItems")');
    expect(timeline).toContain('t("operationProgressTitle")');
    expect(timeline).toContain("glassButtonWarning");
  });

  it("shows source and target paths as distinct bounded rows with operation state badges", () => {
    const row = read("src/views/timeline/PreviewFileRow.tsx");
    const t = makeTranslator("zh");

    expect(t("sourcePath")).toBe("原路径");
    expect(t("targetPath")).toBe("目标路径");
    expect(t("operationMoveRename")).toBe("移动并重命名");
    expect(t("operationBlocked")).toBe("已阻止");
    expect(t("operationExecutable")).toBe("可执行");
    expect(t("operationNeedsConfirmation")).toBe("需确认");

    expect(row).toContain("ToneBadge");
    expect(row).toContain("compactInteractiveRow");
    expect(row).toContain("operationLabel(preview.operation_type");
    expect(row).toContain('t("sourcePath")');
    expect(row).toContain('t("targetPath")');
    expect(row).toContain('path={preview.source_path}');
    expect(row).toContain('path={preview.target_path}');
    expect(row).toContain("compactPath(path");
    expect(row).toContain('t("operationBlocked")');
    expect(row).toContain('t("operationExecutable")');
    expect(row).toContain('t("operationNeedsConfirmation")');
    expect(row).toContain("minmax(0,1fr)");
    expect(row).not.toContain("truncate rounded-lg");
  });
});
