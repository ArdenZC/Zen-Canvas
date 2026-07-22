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
    expect(markup).toContain("AI 空间清理分析");
    expect(markup).toContain("请先扫描空间");
    expect(source).not.toContain("void scan();");
    expect(source).not.toContain("default_scan_roots");
  });

  it("shows a first-class AI cleanup analysis panel before the candidate list", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen/Project"]} t={makeTranslator("zh")} />
    );

    expect(markup).toContain("AI 空间清理分析");
    expect(markup).toContain("使用当前 AI 模型复查清理候选");
    expect(markup).toContain("AI 分析全部候选");
    expect(markup).toContain("AI 复查高风险项");
    expect(markup).toContain("AI 分析已选项");
    expect(markup.indexOf("AI 空间清理分析")).toBeLessThan(markup.indexOf("Top 占用排行"));
  });

  it("renders cleanup guidance, three tiers, and conservative default safe selection", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen/Project"]} t={makeTranslator("zh")} />
    );

    expect(markup).toContain("全部");
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

  it("uses the persistent store and safe trash cleanup in-page", () => {
    const api = {
      revealStorageCandidate: vi.fn().mockResolvedValue(undefined),
      startStorageCleanupScan: vi.fn().mockResolvedValue("job-1"),
      cancelStorageCleanupScan: vi.fn().mockResolvedValue(undefined),
      getStorageCleanupScanStatus: vi.fn(),
      moveCleanupCandidatesToSafeTrash: vi.fn().mockResolvedValue({
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

    expect(source).toContain("useStorageCleanupStore");
    expect(source).toContain("startStorageCleanupScan");
    expect(source).toContain("cancelStorageCleanupScan");
    expect(source).toContain("moveCleanupCandidatesToSafeTrash");
    expect(source).toContain("ConfirmDialog");
    expect(source).toContain("storageCleanupReviewConfirmTitle");
    expect(source).not.toContain("globalThis.confirm");
    expect(source).not.toContain("window.confirm");
    expect(source).toContain("onReveal(candidate.path)");
    expect(source).toContain('t("storageCleanupMoveToSafeTrash")');
  });

  it("does not route cleanup through Preview or Timeline state", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).not.toContain("previewCleanupOperations");
    expect(source).not.toContain("useOperationQueueStore");
    expect(source).not.toContain("setPreviewResult");
    expect(source).not.toContain('setView("preview")');
    expect(source).not.toContain("Timeline");
    expect(source).toContain("api.analyzeCleanupCandidatesWithAI(displayedJobId, ids)");
    expect(source).toContain("applyAIAnalyzedCandidates(displayedJobId, candidates)");
    expect(source).not.toContain("analyzeCleanupCandidatesWithAI(ids)");
    expect(source).not.toContain("analyzeCleanupCandidatesWithAI(displayedJobId, ids).then(() => api.moveCleanupCandidatesToSafeTrash");
    expect(makeTranslator("zh")("storageCleanupGeneratePreview")).toBe("查看安全清理候选");
    expect(makeTranslator("zh")("storageCleanupPreviewDesc")).not.toContain("预览执行");
  });

  it("requires the displayed job for AI and Safe Trash actions", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).toContain("const displayedJobIdState = useStorageCleanupStore((state) => state.displayedJobId)");
    expect(source).toContain("const displayedJobId = initialAnalysis ? null : displayedJobIdState");
    expect(source).toContain("api.moveCleanupCandidatesToSafeTrash(displayedJobId, [...selectedCleanupIds])");
    expect(source).toContain("if (!displayedJobId)");
    expect(source).toContain("disabled={!selectedCleanupIds.size || isExecuting || !displayedJobId || Boolean(mutationUnavailable)}");
  });

  it("documents AI cleanup readiness states and settings guidance", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).toContain('t("storageCleanupAIEnableAI")');
    expect(source).toContain('t("storageCleanupAIEnableCleanup")');
    expect(source).toContain('t("storageCleanupAIAnalyzing")');
    expect(makeTranslator("zh")("storageCleanupAIEnableAI")).toBe("请先在设置中启用 AI");
    expect(makeTranslator("zh")("storageCleanupAIEnableCleanup")).toBe("请开启 AI 空间清理分析");
  });

  it("renders one main candidate list with tier filter pills instead of duplicated tier sections", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} initialRoots={["C:/Users/Zen"]} t={makeTranslator("zh")} />
    );

    expect(source).toContain("activeTierFilter");
    expect(source).toContain("filteredCandidates");
    expect(source).not.toContain("function TierSection");
    expect(source).not.toContain("TIER_ORDER.map");
    expect(markup.match(/data-candidate-id=\"safe-node-modules\"/g)?.length).toBe(1);
    expect(markup.match(/data-candidate-id=\"review-video\"/g)?.length).toBe(1);
    expect(markup.match(/data-candidate-id=\"caution-app\"/g)?.length).toBe(1);
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

  it("shows active scan progress and cancel affordance", () => {
    const source = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(source).toContain('t("storageCleanupScanningDesc")');
    expect(source).toContain("scanProgress?.scannedEntries");
    expect(source).toContain("scanProgress?.currentPath");
    expect(source).toContain("cancelScan");
    expect(source).toContain('t("storageCleanupCancelScan")');
  });
});
