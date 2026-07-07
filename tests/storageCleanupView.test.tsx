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

const analysis: StorageAnalysis = {
  total_size: 3_600_000_000,
  reclaimable_estimate: 1_200_000_000,
  review_estimate: 900_000_000,
  denied_paths: ["C:/Users/Zen/AppData/Local/Locked"],
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
      risk_note: null,
      trash_allowed: true
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
      trash_allowed: false
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
      trash_allowed: false
    }
  ]
};

describe("StorageCleanupView", () => {
  it("renders the three cleanup tiers and explicit safety guidance", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} t={makeTranslator("zh")} />
    );

    expect(markup).toContain("可安全清理");
    expect(markup).toContain("需人工判断");
    expect(markup).toContain("谨慎处理");
    expect(markup).toContain("执行前仍会进入预览确认，不会自动删除文件");
    expect(markup).toContain("未统计，结果可能低估");
    expect(markup).toContain("node_modules");
    expect(markup).toContain("course.mp4");
    expect(markup).toContain("Example");
  });

  it("selects only safe candidates for cleanup preview by default", async () => {
    const api = {
      scanStorageCleanup: vi.fn().mockResolvedValue(analysis),
      revealStorageCandidate: vi.fn().mockResolvedValue(undefined),
      previewCleanupCandidates: vi.fn().mockResolvedValue([])
    };
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} api={api} t={makeTranslator("zh")} />
    );

    expect(markup).toContain("加入清理预览");
    expect(markup).toContain("生成清理预览");
    expect(markup).toContain("data-selected-cleanup-ids=\"safe-node-modules\"");
    expect(markup).not.toContain("data-selected-cleanup-ids=\"review-video");
    expect(markup).not.toContain("data-selected-cleanup-ids=\"caution-app");
  });

  it("keeps review and caution actions reveal-only or advice-only", () => {
    const markup = renderToStaticMarkup(
      <StorageCleanupView initialAnalysis={analysis} t={makeTranslator("zh")} />
    );

    expect(markup).toContain("打开位置");
    expect(markup).toContain("查看建议");
    expect(markup).not.toContain("review-video\">加入清理预览");
    expect(markup).not.toContain("caution-app\">加入清理预览");
  });

  it("uses existing primitives and bounded scroll areas for the desktop minimum size", () => {
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
    expect(source).not.toContain("backdrop-blur");
  });
});
