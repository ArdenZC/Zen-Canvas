import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { FileRecord } from "../src/types/domain";
import { deriveHubFileModel, groupFilesByHubBucket } from "../src/views/hub/HubView";

describe("HubView file buckets", () => {
  it("groups classified files into the same bucket rules used by HubView", () => {
    const files = [
      file({ id: "actionable", name: "core.pdf", suggested_action: "Move", suggested_target_path: "/test/Work", confidence: 0.9 }),
      file({ id: "review", name: "review.pdf", suggested_action: "Review", requires_confirmation: true }),
      file({ id: "keep", name: "keep.pdf", suggested_action: "Keep" }),
      file({ id: "delete", name: "delete.log", suggested_action: "DeleteCandidate" }),
      file({ id: "privacy", name: "passport.pdf", risk_level: "Sensitive" })
    ];

    const grouped = groupFilesByHubBucket(files);

    expect(grouped.Actionable.map((item) => item.id)).toEqual(["actionable"]);
    expect(grouped.Review.map((item) => item.id)).toEqual(["review"]);
    expect(grouped.Keep.map((item) => item.id)).toEqual(["keep"]);
    expect(grouped.Cleanup.map((item) => item.id)).toEqual(["delete"]);
    expect(grouped.Sensitive.map((item) => item.id)).toEqual(["privacy"]);
  });

  it("derives pending and bucketed hub files in one pass", () => {
    const files = [
      file({ id: "pending", name: "pending.pdf", classification_status: "unclassified" }),
      file({ id: "actionable", name: "core.pdf", suggested_action: "Move", suggested_target_path: "/test/Work", confidence: 0.9 }),
      file({ id: "keep", name: "archive.zip", suggested_action: "Keep" }),
      file({ id: "review", name: "cleanup.tmp", suggested_action: "Review" })
    ];

    const model = deriveHubFileModel(files);

    expect(model.pendingFiles.map((item) => item.id)).toEqual(["pending"]);
    expect(model.bucketedFiles.Actionable.map((item) => item.id)).toEqual(["actionable"]);
    expect(model.bucketedFiles.Keep.map((item) => item.id)).toEqual(["keep"]);
    expect(model.bucketedFiles.Review.map((item) => item.id)).toEqual(["review"]);
    expect(model.bucketedFiles.Sensitive).toEqual([]);
    expect(model.classifiedCount).toBe(3);
    expect(model.actionablePreviewCount).toBe(1);
    expect(model.requiresConfirmationCount).toBe(1);
    expect(model.keepCount).toBe(1);
  });

  it("keeps Smart Dispatch framed as a non-destructive review workbench", () => {
    const hubView = fs.readFileSync(path.join(process.cwd(), "src/views/hub/HubView.tsx"), "utf8");

    expect(hubView).toContain("pageFrame");
    expect(hubView).toContain("contentPanel");
    expect(hubView).toContain("softPanel");
    expect(hubView).toContain("SummaryChip");
    expect(hubView.indexOf('t("runDispatch")')).toBeLessThan(hubView.indexOf("<FileCardList"));
    expect(hubView).toContain("StateBlock");
    expect(hubView).toContain("NoticeBanner");
    expect(hubView).toContain("ToneBadge");
    expect(hubView).toContain("IconButton");
    expect(hubView).toContain("interactiveRow");
    expect(hubView).toContain("HUB_BUCKET_PREVIEW_LIMIT");
    expect(hubView).toContain("本次最多处理");
    expect(hubView).toContain("可进入预览");
    expect(hubView).toContain("需人工确认");
    expect(hubView).toContain("保留不动");
    expect(hubView).toContain("清理候选");
    expect(hubView).not.toContain("max-h-64");
    expect(hubView).not.toContain("grid max-h-64 gap-2 overflow-auto pr-1");
    expect(hubView).toContain('t("hubSafetyHint")');
    expect(hubView).toContain('t("hubPendingDesc")');
    expect(hubView).toContain('t("hubBucketSuggestionHint")');
    expect(hubView).toContain('t("hubEmptyBucket")');
    expect(hubView).not.toContain("emptyState");
    expect(hubView).not.toContain("toneClasses");
  });
});

function file(overrides: Partial<FileRecord>): FileRecord {
  return {
    id: "file",
    name: "file.txt",
    path: "/test/file.txt",
    directory: "/test",
    extension: "txt",
    size: 128,
    file_type: "Document",
    purpose: "Unknown",
    lifecycle: "Inbox",
    context: "",
    risk_level: "Normal",
    hash: null,
    created_at: "2026-06-21T00:00:00Z",
    modified_at: "2026-06-21T00:00:00Z",
    scanned_at: "2026-06-21T00:00:00Z",
    last_seen_at: "2026-06-21T00:00:00Z",
    is_hidden: false,
    is_deleted: false,
    is_duplicate: false,
    suggested_action: "Keep",
    suggested_target_path: "",
    suggested_name: "",
    confidence: 0.5,
    classification_reason: "",
    classification_status: "classified",
    matched_rules: [],
    requires_confirmation: false,
    ...overrides
  };
}
