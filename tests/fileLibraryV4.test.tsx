import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { FileRecord } from "../src/types/domain";
import {
  defaultLibrarySort,
  emptyLibraryAdvancedFilters,
  filePreviewKind,
  filterLibraryFiles,
  moveFocusIndex,
  selectionForRowClick,
  selectionSummary,
  sortLibraryFiles
} from "../src/views/vault/fileLibraryModel";

function file(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: "file-1",
    name: "notes.txt",
    path: "C:/Users/Zen/Documents/notes.txt",
    directory: "C:/Users/Zen/Documents",
    extension: "txt",
    size: 2_000,
    file_type: "Document",
    purpose: "Work",
    lifecycle: "Active",
    context: "project notes",
    risk_level: "Normal",
    hash: null,
    created_at: "2026-07-01T00:00:00Z",
    modified_at: "2026-07-12T00:00:00Z",
    scanned_at: "2026-07-12T00:00:00Z",
    last_seen_at: "2026-07-12T00:00:00Z",
    is_hidden: false,
    is_deleted: false,
    is_duplicate: false,
    suggested_action: "Keep",
    suggested_target_path: "",
    suggested_name: "",
    confidence: 0.8,
    classification_reason: "matches the project context",
    classification_status: "classified",
    matched_rules: [],
    requires_confirmation: false,
    ...overrides
  };
}

describe("File Library v4 model and interaction contracts", () => {
  it("filters only on real FileRecord fields", () => {
    const files = [
      file({ id: "image", file_type: "Image", extension: "png", size: 2_000_000, modified_at: "2026-07-10T00:00:00Z" }),
      file({ id: "review", requires_confirmation: true, is_duplicate: true, lifecycle: "Duplicate", size: 200_000_000, modified_at: "2026-05-01T00:00:00Z" })
    ];
    expect(filterLibraryFiles(files, "all", { ...emptyLibraryAdvancedFilters, fileType: "Image" })).toHaveLength(1);
    expect(filterLibraryFiles(files, "duplicate", emptyLibraryAdvancedFilters)).toEqual([files[1]]);
    expect(filterLibraryFiles(files, "all", { ...emptyLibraryAdvancedFilters, size: "large" })).toEqual([files[1]]);
    expect(filterLibraryFiles(files, "all", { ...emptyLibraryAdvancedFilters, modified: "7d" }, Date.parse("2026-07-12T00:00:00Z"))).toEqual([files[0]]);
  });

  it("sorts by real fields while keeping stable order for ties", () => {
    const files = [
      file({ id: "b", name: "Beta.txt", size: 20, modified_at: "2026-07-11T00:00:00Z" }),
      file({ id: "a", name: "alpha.txt", size: 20, modified_at: "2026-07-12T00:00:00Z" })
    ];
    expect(sortLibraryFiles(files, { key: "name", direction: "asc" }).map((item) => item.id)).toEqual(["a", "b"]);
    expect(sortLibraryFiles(files, defaultLibrarySort).map((item) => item.id)).toEqual(["a", "b"]);
    expect(sortLibraryFiles(files, { key: "size", direction: "asc" }).map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("supports single, Ctrl/Cmd additive, and Shift range selection", () => {
    const ids = ["a", "b", "c", "d"];
    expect(selectionForRowClick(ids, 1, {}).selectedIds).toEqual(["b"]);
    expect(selectionForRowClick(ids, 1, { additive: true, selectedIds: ["b"] }).selectedIds).toEqual([]);
    expect(selectionForRowClick(ids, 3, { range: true, anchorIndex: 1 }).selectedIds).toEqual(["b", "c", "d"]);
  });

  it("supports bounded keyboard movement and batch summaries", () => {
    expect(moveFocusIndex(0, 3, "ArrowUp")).toBe(0);
    expect(moveFocusIndex(0, 3, "ArrowDown")).toBe(1);
    expect(moveFocusIndex(1, 3, "End")).toBe(2);
    const summary = selectionSummary([file({ id: "a", file_type: "Document", size: 2 }), file({ id: "b", file_type: "Image", size: 3, directory: "C:/Users/Zen/Desktop" })]);
    expect(summary).toMatchObject({ count: 2, totalSize: 5, commonDirectory: null });
    expect(summary.typeCounts).toEqual([["Document", 1], ["Image", 1]]);
  });

  it("chooses honest type-specific preview states without fabricating content", () => {
    expect(filePreviewKind(file({ file_type: "Image", extension: "png" }))).toBe("image");
    expect(filePreviewKind(file({ file_type: "Document", extension: "pdf" }))).toBe("pdf");
    expect(filePreviewKind(file({ file_type: "Code", extension: "ts" }))).toBe("text");
    expect(filePreviewKind(file({ file_type: "Other", extension: "bin" }))).toBe("unsupported");
  });

  it("renders a listbox + Inspector architecture with keyboard and context-menu hooks", () => {
    const vault = readFileSync(resolve("src/views/vault/VaultView.tsx"), "utf8");
    const list = readFileSync(resolve("src/views/vault/components/FileLibraryList.tsx"), "utf8");
    const inspector = readFileSync(resolve("src/views/vault/components/FileLibraryInspector.tsx"), "utf8");
    expect(vault).toContain('role="listbox"');
    expect(list).toContain('role="option"');
    expect(vault).toContain('role="menu"');
    expect(vault).toContain('event.key === "Space"');
    expect(vault).toContain('event.key === "Enter"');
    expect(vault).toContain('event.key === "ContextMenu"');
    expect(vault).toContain('event.shiftKey && (event.key === "F10"');
    expect(vault).toContain('aria-live="polite"');
    expect(list).toContain("useVirtualizer");
    expect(inspector).toContain("libraryPreviewUnavailable");
    expect(vault).not.toContain("AssetCard");
    expect(vault).not.toContain("window.confirm");
    expect(vault).not.toContain("globalThis.confirm");
    expect(vault).not.toContain("executeMoves");
    expect(vault).not.toContain("moveCleanupCandidates");
  });
});
