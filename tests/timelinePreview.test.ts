import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { OperationPreview } from "../src/types/domain";
import { PreviewFileRow } from "../src/views/timeline/PreviewFileRow";

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
    expect(t("previewNoOverwriteDelete")).toContain("不会永久删除");
    expect(t("groupNoExecutableItems")).toBe("此分组没有可执行项");
    expect(t("operationCreatesParent")).toBe("会创建父目录");
    expect(t("operationProgressTitle")).toBe("正在执行已选操作");

    expect(timeline).toContain("PreviewCount");
    expect(timeline).toContain("NoticeBanner");
    expect(timeline).toContain("StateBlock");
    expect(timeline).toContain("PreviewCount label={t(\"previewTotalSuggestions\")}");
    expect(timeline).toContain("PreviewCount label={t(\"selectedOperations\")}");
    expect(timeline).toContain("PreviewCount label={t(\"executableItems\")}");
    expect(timeline).toContain("PreviewCount label={t(\"blockedItems\")}");
    expect(timeline).toContain("PreviewCount label={t(\"confirmationItems\")}");
    expect(timeline).toContain("PreviewCount label={t(\"autoCreateFolders\")}");
    expect(timeline).toContain('tone={trashSelectionCount ? "danger" : "warning"}');
    expect(timeline).toContain('t("executeSelectedWithCount")');
    expect(timeline).toContain("selectedCount.toLocaleString()");
    expect(timeline).toContain("disabled={executable.length === 0}");
    expect(timeline).toContain("groupDisabledDescriptionId");
    expect(timeline).toContain("aria-describedby={executable.length === 0 ? groupDisabledDescriptionId : undefined}");
    expect(timeline).toContain('t("groupNoExecutableItems")');
    expect(timeline).toContain('t("operationProgressTitle")');
    expect(timeline).toContain("glassButtonWarning");
    expect(timeline).toContain("ConfirmDialog");
    expect(timeline).toContain("executeSelected(true)");
    expect(timeline).not.toContain("window.confirm");
    expect(timeline).not.toContain("globalThis.confirm");
    expect(timeline).toContain('aria-live="polite"');
  });

  it("shows source and target paths as distinct bounded rows with operation state badges", () => {
    const timeline = read("src/views/timeline/TimelineView.tsx");
    const row = read("src/views/timeline/PreviewFileRow.tsx");
    const t = makeTranslator("zh");

    expect(t("sourcePath")).toBe("源文件");
    expect(t("targetPath")).toBe("将移动到");
    expect(t("operationMoveRename")).toBe("移动并重命名");
    expect(t("operationBlocked")).toBe("已阻止");
    expect(t("operationExecutable")).toBe("可执行");
    expect(t("operationNeedsConfirmation")).toBe("需确认");
    expect(t("selectOperation")).toBe("选择操作");

    expect(row).toContain("ToneBadge");
    expect(row).toContain("border-b border-[var(--zc-divider)]");
    expect(row).toContain("bg-[var(--zc-surface-selected)]");
    expect(row).toContain("operationLabel(preview.operation_type");
    expect(row).toContain('t("sourcePath")');
    expect(row).toContain('t("targetPath")');
    expect(row).toContain('path={preview.source_path}');
    expect(row).toContain('path={preview.target_path}');
    expect(row).toContain("displayPath = formatDisplayPath(path)");
    expect(row).toContain("compactPath(displayPath");
    expect(row).toContain("title={displayPath}");
    expect(row).toContain("items-start");
    expect(row).not.toContain("min-h-[176px]");
    expect(row).not.toContain("items-stretch");
    expect(row).toContain('t("operationBlocked")');
    expect(row).toContain('t("operationExecutable")');
    expect(row).toContain('t("operationNeedsConfirmation")');
    expect(row).toContain('aria-label={`${t("selectOperation")} · ${preview.old_name}`}');
    expect(row).toContain("minmax(0,1fr)");
    expect(row).not.toContain("truncate rounded-lg");

    expect(timeline).not.toContain("const PREVIEW_ROW_HEIGHT");
    expect(timeline).toContain("useVirtualizer");
    expect(timeline).toContain("measureElement");
    expect(timeline).not.toContain("virtualRowClass");
    expect(timeline).toContain("overflow-auto");
    expect(timeline).not.toContain("max-h-96");
    expect(row).toContain("sm:grid-cols-[auto_auto_minmax(0,1fr)]");
    expect(row).toContain("grid min-w-0 gap-2 xl:grid-cols-2");
    expect(row).not.toContain("lg:grid-cols-2");
  });

  it("renders move_to_trash previews without rename or create-folder controls", () => {
    const preview: OperationPreview = {
      id: "trash-preview",
      fileId: "file-trash",
      operation_type: "move_to_trash",
      source_path: "C:/Users/Zen/Desktop/zen-cleanup-test/node_modules",
      target_path: "系统回收站",
      old_name: "node_modules",
      new_name: "node_modules",
      status: "pending",
      risk_level: "Normal",
      confidence: 1,
      requires_confirmation: true,
      suggested_action: "DeleteCandidate",
      reason: "Regenerable dependencies.",
      selected_by_default: true,
      is_executable: true,
      editable_new_name: false,
      will_create_parent: false
    };

    const markup = renderToStaticMarkup(createElement(PreviewFileRow, {
      preview,
      isSelected: true,
      toggle: () => undefined,
      onRenamePreview: () => undefined,
      t: makeTranslator("zh")
    }));

    expect(markup).toContain("移到回收站");
    expect(markup).toContain("系统回收站");
    expect(markup).toContain("这不是永久删除");
    expect(markup).not.toContain("会创建父目录");
    expect(markup).not.toContain("aria-label=\"新文件名\"");
    expect(markup).toContain("正常");
    expect(markup).not.toContain("Browser mock preview");
  });

  it("adds timeline safety copy for trash cleanup operations", () => {
    const timeline = read("src/views/timeline/TimelineView.tsx");
    const t = makeTranslator("zh");

    expect(t("previewCleanupTrashSafety")).toContain("系统回收站");
    expect(t("confirmMoveToTrashTitle")).toBe("确认移到回收站？");
    expect(timeline).toContain('t("previewCleanupTrashSafety")');
  });
});
