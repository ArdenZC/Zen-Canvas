import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { FileRecord, LibraryScope, OperationPreview } from "../src/types/domain";
import { useOrganizeDecisionStore } from "../src/store/useOrganizeDecisionStore";
import {
  buildOrganizeSuggestions,
  isSafeBatchSuggestion,
  previewIdsForOrganizeDecisions,
  validateOrganizeFileName
} from "../src/views/organize/organizeModel";

const scope: LibraryScope = { kind: "all" };

describe("Organize Suggestions decision workbench", () => {
  beforeEach(() => useOrganizeDecisionStore.setState({ decisions: {} }));

  it("separates selection from an explicit decision and preserves it within a scope", () => {
    const item = file();
    const operation = preview();
    const store = useOrganizeDecisionStore.getState();
    store.syncSuggestions(scope, [item], [operation]);
    expect(buildOrganizeSuggestions([item], [operation], scope, useOrganizeDecisionStore.getState().decisions)[0].decision).toBe("undecided");
    expect(store.setDecision(scope, item, operation, "accepted")).toBe(true);
    expect(buildOrganizeSuggestions([item], [operation], scope, useOrganizeDecisionStore.getState().decisions)[0].decision).toBe("accepted");
    expect(buildOrganizeSuggestions([item], [operation], { kind: "current_scan", roots: ["C:/Data"] }, useOrganizeDecisionStore.getState().decisions)[0].decision).toBe("undecided");
  });

  it("resets a saved decision when authoritative preview semantics change", () => {
    const item = file();
    const store = useOrganizeDecisionStore.getState();
    store.syncSuggestions(scope, [item], [preview()]);
    store.setDecision(scope, item, preview(), "accepted");
    store.syncSuggestions(scope, [item], [preview({ id: "preview-new", target_path: "C:/Data/New/file.txt" })]);
    expect(buildOrganizeSuggestions([item], [preview({ id: "preview-new", target_path: "C:/Data/New/file.txt" })], scope, useOrganizeDecisionStore.getState().decisions)[0].decision).toBe("undecided");
  });

  it("blocks sensitive items and only batch-accepts strict safe suggestions", () => {
    const sensitive = file({ risk_level: "Sensitive", lifecycle: "Sensitive" });
    expect(buildOrganizeSuggestions([sensitive], [preview()], scope, {})[0].decision).toBe("needs-review");
    expect(isSafeBatchSuggestion(sensitive, preview())).toBe(false);
    expect(isSafeBatchSuggestion(file({ confidence: 0.9 }), preview())).toBe(true);
    expect(isSafeBatchSuggestion(file({ confidence: 0.9 }), preview({ requires_confirmation: true }))).toBe(false);
  });

  it("only sends accepted or edited authoritative preview ids forward", () => {
    const item = file();
    const operation = preview();
    const store = useOrganizeDecisionStore.getState();
    store.syncSuggestions(scope, [item], [operation]);
    store.setDecision(scope, item, operation, "accepted");
    expect([...previewIdsForOrganizeDecisions(buildOrganizeSuggestions([item], [operation], scope, useOrganizeDecisionStore.getState().decisions))]).toEqual(["preview-1"]);
  });

  it("rejects unsafe and reserved destination names", () => {
    expect(validateOrganizeFileName("report.txt")).toBeNull();
    expect(validateOrganizeFileName("../report.txt")).toBe("unsafe");
    expect(validateOrganizeFileName("CON.txt")).toBe("reserved");
    expect(validateOrganizeFileName("folder/report.txt")).toBe("unsafe");
  });

  it("keeps the Hub as a thin route and removes engineering controls from the user surface", () => {
    const hub = fs.readFileSync(path.join(process.cwd(), "src/views/hub/HubView.tsx"), "utf8");
    const view = fs.readFileSync(path.join(process.cwd(), "src/views/organize/OrganizeSuggestionsView.tsx"), "utf8");
    expect(hub).toContain("OrganizeSuggestionsView");
    expect(view).toContain("pendingOnly: true");
    expect(view).toContain("allowOverwriteUserCorrections: false");
    expect(view).not.toMatch(/temperature|top_p|modelName|endpoint/i);
    expect(view).not.toContain("window.confirm");
  });
});

function file(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: "file-1", name: "file.txt", path: "C:/Data/file.txt", directory: "C:/Data", extension: "txt", size: 128,
    file_type: "Document", purpose: "Work", lifecycle: "Active", context: "", risk_level: "Normal", hash: null,
    created_at: "2026-07-01T00:00:00Z", modified_at: "2026-07-01T00:00:00Z", scanned_at: "2026-07-01T00:00:00Z", last_seen_at: "2026-07-01T00:00:00Z",
    is_hidden: false, is_deleted: false, is_duplicate: false, suggested_action: "Move", suggested_target_path: "C:/Data/Work/file.txt", suggested_name: "file.txt",
    confidence: 0.9, classification_reason: "work context", classification_status: "classified", matched_rules: [], requires_confirmation: false,
    ...overrides
  };
}

function preview(overrides: Partial<OperationPreview> = {}): OperationPreview {
  return {
    id: "preview-1", fileId: "file-1", operation_type: "move", source_path: "C:/Data/file.txt", target_path: "C:/Data/Work/file.txt",
    old_name: "file.txt", new_name: "file.txt", status: "pending", risk_level: "Normal", confidence: 0.9,
    requires_confirmation: false, reason: "work context", is_executable: true, editable_new_name: true,
    ...overrides
  };
}
