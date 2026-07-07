import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { StorageAnalysis } from "../src/types/domain";
import { StorageCleanupView } from "../src/views/cleanup/StorageCleanupView";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

function article(markup: string, id: string) {
  const start = markup.indexOf(`data-candidate-id="${id}"`);
  const end = markup.indexOf("</article>", start);
  return markup.slice(start, end);
}

const analysis: StorageAnalysis = {
  total_size: 4_300_000_000,
  reclaimable_estimate: 1_900_000_000,
  review_estimate: 900_000_000,
  denied_paths: ["C:/Users/Zen/AppData/Local/Locked"],
  warnings: [],
  candidates: [
    {
      id: "safe-node-modules",
      path: "C:/Users/Zen/Project/node_modules",
      name: "node_modules",
      size: 1_200_000_000,
      tier: "Safe",
      category: "Developer cache",
      reason: "Package dependencies can be recreated.",
      suggested_action: "MoveToTrash",
      risk_note: "Review project context first.",
      trash_allowed: true,
      selected_by_default: true
    },
    {
      id: "safe-build",
      path: "C:/Users/Zen/Project/build",
      name: "build",
      size: 700_000_000,
      tier: "Safe",
      category: "Regenerable development output",
      reason: "Build output can be recreated.",
      suggested_action: "MoveToTrash",
      risk_note: "Confirm this is generated output before cleanup.",
      trash_allowed: true,
      selected_by_default: false
    },
    {
      id: "review-video",
      path: "C:/Users/Zen/Downloads/course.mp4",
      name: "course.mp4",
      size: 900_000_000,
      tier: "Review",
      category: "Downloads",
      reason: "User-owned media needs review.",
      suggested_action: "Reveal",
      risk_note: "Open the location before selecting cleanup.",
      trash_allowed: false,
      selected_by_default: false
    },
    {
      id: "caution-app",
      path: "C:/Program Files/Example",
      name: "Example",
      size: 1_500_000_000,
      tier: "Caution",
      category: "Application",
      reason: "Installed app body.",
      suggested_action: "UninstallAdvice",
      risk_note: "Use the app uninstaller.",
      trash_allowed: false,
      selected_by_default: false
    }
  ]
};

describe("StorageCleanupView", () => {
  it("starts with an explicit cleanup scope chooser instead of scanning default roots", () => {
    const markup = renderToStaticMarkup(<StorageCleanupView t={makeTranslator("zh")} />);
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(markup).toContain("选择一个磁盘或文件夹开始分析");
    expect(markup).toContain("例如 Downloads、Desktop、D:\\Projects 或整个 F: 盘。");
    expect(markup).toContain("选择要分析的磁盘或文件夹");
    expect(source).not.toContain("void scan();");
    expect(source).not.toContain("default_scan_roots");
  });

  it("renders cleanup guidance, three tiers, and conservative default safe selection", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen/Project"]} t={makeTranslator("zh")} />
    );

    expect(markup).toContain("可安全清理");
    expect(markup).toContain("需人工判断");
    expect(markup).toContain("谨慎处理");
    expect(markup).toContain("不会自动删除文件");
    expect(markup).toContain("未统计，结果可能低估");
    expect(markup).toContain("data-selected-cleanup-ids=\"safe-node-modules\"");
    expect(markup).not.toContain("data-selected-cleanup-ids=\"safe-build");
    expect(markup).not.toContain("data-selected-cleanup-ids=\"review-video");
    expect(markup).not.toContain("data-selected-cleanup-ids=\"caution-app");
  });

  it("shows candidates by size descending in the main ranking", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen"]} t={makeTranslator("zh")} />
    );

    expect(markup.indexOf("Example")).toBeLessThan(markup.indexOf("node_modules"));
    expect(markup.indexOf("node_modules")).toBeLessThan(markup.indexOf("course.mp4"));
    expect(markup.indexOf("course.mp4")).toBeLessThan(markup.indexOf("build"));
  });

  it("keeps review and caution reveal-only or advice-only", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen"]} t={makeTranslator("zh")} />
    );
    const reviewCard = article(markup, "review-video");
    const cautionCard = article(markup, "caution-app");

    expect(markup).toContain("打开位置");
    expect(markup).toContain("查看建议");
    expect(reviewCard).not.toContain("选择移到回收站");
    expect(cautionCard).not.toContain("选择移到回收站");
    expect(cautionCard).not.toContain("可移到回收站");
  });

  it("uses selected roots for scan and executes trash cleanup in-page", () => {
    const api = {
      scanStorageCleanup: vi.fn().mockResolvedValue(analysis),
      revealStorageCandidate: vi.fn().mockResolvedValue(undefined),
      moveCleanupCandidatesToTrash: vi.fn().mockResolvedValue({
        moved: 1,
        skipped: 0,
        failed: 0,
        logs: []
      })
    };
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen"]} api={api} t={makeTranslator("zh")} />
    );

    expect(source).toContain("api.scanStorageCleanup(selectedRoots)");
    expect(source).toContain("moveCleanupCandidatesToTrash");
    expect(source).toContain("ConfirmDialog");
    expect(source).toContain("onReveal(candidate.path)");
    expect(source).toContain('t("storageCleanupMoveToTrash")');
  });

  it("does not route cleanup through Preview or Timeline state", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).not.toContain("previewCleanupOperations");
    expect(source).not.toContain("useOperationQueueStore");
    expect(source).not.toContain("setPreviewResult");
    expect(source).not.toContain('setView("preview")');
    expect(source).not.toContain("Timeline");
    expect(makeTranslator("zh")("storageCleanupGeneratePreview")).toBe("查看安全清理候选");
    expect(makeTranslator("zh")("storageCleanupPreviewDesc")).not.toContain("预览执行");
  });

  it("keeps the small-window layout scrollable without a horizontal ranking table", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).toContain("pageSurface");
    expect(source).toContain("contentPanel");
    expect(source).toContain("softPanel");
    expect(source).toContain("NoticeBanner");
    expect(source).toContain("StateBlock");
    expect(source).toContain("ToneBadge");
    expect(source).toContain("IconButton");
    expect(source).toContain("MetricCard");
    expect(source).toContain("overflow-auto");
    expect(source).toContain("max-h");
    expect(source).not.toContain("min-w-[720px]");
    expect(source).not.toContain("grid-cols-[minmax(140px,1.1fr)_minmax(220px,2fr)_110px_140px_96px]");
  });

  it("shows active scan explanation and future progress/cancel TODO", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).toContain('t("storageCleanupScanningDesc")');
    expect(source).toContain('t("storageCleanupProgressTodo")');
  });
});
