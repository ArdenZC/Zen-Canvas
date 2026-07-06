import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { FileRecord } from "../src/types/domain";
import { deriveHubFileModel, groupFilesByHubBucket } from "../src/views/hub/HubView";

describe("HubView file buckets", () => {
  it("groups classified files into the same bucket rules used by HubView", () => {
    const files = [
      file({ id: "core", name: "core.pdf" }),
      file({ id: "archive", name: "archive.zip", lifecycle: "Archive" }),
      file({ id: "cleanup", name: "cleanup.tmp", suggested_action: "Review" }),
      file({ id: "delete", name: "delete.log", suggested_action: "DeleteCandidate" }),
      file({ id: "privacy", name: "passport.pdf", risk_level: "Sensitive" })
    ];

    const grouped = groupFilesByHubBucket(files);

    expect(grouped.CoreAssets.map((item) => item.id)).toEqual(["core"]);
    expect(grouped.QuietArchive.map((item) => item.id)).toEqual(["archive"]);
    expect(grouped.CleanupLane.map((item) => item.id)).toEqual(["cleanup", "delete"]);
    expect(grouped.PrivacyVault.map((item) => item.id)).toEqual(["privacy"]);
  });

  it("derives pending and bucketed hub files in one pass", () => {
    const files = [
      file({ id: "pending", name: "pending.pdf", classification_status: "unclassified" }),
      file({ id: "core", name: "core.pdf" }),
      file({ id: "archive", name: "archive.zip", lifecycle: "Archive" }),
      file({ id: "cleanup", name: "cleanup.tmp", suggested_action: "Review" })
    ];

    const model = deriveHubFileModel(files);

    expect(model.pendingFiles.map((item) => item.id)).toEqual(["pending"]);
    expect(model.bucketedFiles.CoreAssets.map((item) => item.id)).toEqual(["core"]);
    expect(model.bucketedFiles.QuietArchive.map((item) => item.id)).toEqual(["archive"]);
    expect(model.bucketedFiles.CleanupLane.map((item) => item.id)).toEqual(["cleanup"]);
    expect(model.bucketedFiles.PrivacyVault).toEqual([]);
    expect(model.classifiedCount).toBe(3);
  });

  it("keeps Smart Dispatch framed as a non-destructive review workbench", () => {
    const hubView = fs.readFileSync(path.join(process.cwd(), "src/views/hub/HubView.tsx"), "utf8");

    expect(hubView).toContain("pageFrame");
    expect(hubView).toContain("contentPanel");
    expect(hubView).toContain("softPanel");
    expect(hubView).toContain("MetricCard");
    expect(hubView).toContain("StateBlock");
    expect(hubView).toContain("NoticeBanner");
    expect(hubView).toContain("ToneBadge");
    expect(hubView).toContain("IconButton");
    expect(hubView).toContain("interactiveRow");
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
