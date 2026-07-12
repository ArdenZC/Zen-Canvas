import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { FileRecord, LibraryScope, OperationPreview } from "../src/types/domain";
import { useOrganizeDecisionStore } from "../src/store/useOrganizeDecisionStore";
import {
  buildOrganizeSuggestions,
  isSafeBatchSuggestion,
  previewIdsForOrganizeDecisions,
  operationResultState,
  organizeSpaceAction,
  summarizeOperationLogs,
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

  it("keeps a preview rename in the organize decision as the single edited state", () => {
    const item = file();
    const operation = preview();
    const store = useOrganizeDecisionStore.getState();
    store.syncSuggestions(scope, [item], [operation]);
    store.setDecision(scope, item, operation, "accepted");
    expect(useOrganizeDecisionStore.getState().setEditedNameForPreview("all", operation, "renamed.txt")).toBe(true);
    expect(buildOrganizeSuggestions([item], [operation], scope, useOrganizeDecisionStore.getState().decisions)[0]).toMatchObject({ decision: "edited", editedName: "renamed.txt" });
    expect(useOrganizeDecisionStore.getState().setEditedNameForPreview("all", operation, "../unsafe.txt")).toBe(false);
  });

  it("blocks sensitive items and only batch-accepts strict safe suggestions", () => {
    const sensitive = file({ risk_level: "Sensitive", lifecycle: "Sensitive" });
    expect(buildOrganizeSuggestions([sensitive], [preview()], scope, {})[0].decision).toBe("needs-review");
    expect(isSafeBatchSuggestion(sensitive, preview())).toBe(false);
    expect(isSafeBatchSuggestion(file({ confidence: 0.9 }), preview())).toBe(true);
    expect(isSafeBatchSuggestion(file({ confidence: 0.9 }), preview({ requires_confirmation: true }))).toBe(false);
  });

  it("only sends accepted or edited authoritative preview ids forward", () => {
    const files = [
      file({ id: "accepted" }), file({ id: "edited" }), file({ id: "kept" }), file({ id: "undecided" }),
      file({ id: "review", is_duplicate: true }), file({ id: "blocked", is_deleted: true })
    ];
    const operations = files.map((item) => preview({ id: `preview-${item.id}`, fileId: item.id }));
    const store = useOrganizeDecisionStore.getState();
    store.syncSuggestions(scope, files, operations);
    store.setDecision(scope, files[0], operations[0], "accepted");
    store.setDecision(scope, files[1], operations[1], "edited", "edited.txt");
    store.setDecision(scope, files[2], operations[2], "kept");
    expect([...previewIdsForOrganizeDecisions(buildOrganizeSuggestions(files, operations, scope, useOrganizeDecisionStore.getState().decisions))]).toEqual(["preview-accepted", "preview-edited"]);
  });

  it("rejects unsafe and reserved destination names", () => {
    expect(validateOrganizeFileName("report.txt")).toBeNull();
    expect(validateOrganizeFileName("../report.txt")).toBe("unsafe");
    expect(validateOrganizeFileName("CON.txt")).toBe("reserved");
    expect(validateOrganizeFileName("folder/report.txt")).toBe("unsafe");
  });

  it("maps Space to acceptance normally and checkbox toggling in batch mode", () => {
    expect(organizeSpaceAction(false)).toBe("accept");
    expect(organizeSpaceAction(true)).toBe("toggle-batch");
  });

  it("distinguishes complete, partial, failed, canceled, and empty execution results", () => {
    expect(operationResultState({ success: 2, skipped: 0, failed: 0, restorable: 0 })).toBe("success");
    expect(operationResultState({ success: 1, skipped: 1, failed: 0, restorable: 0 })).toBe("partial");
    expect(operationResultState({ success: 0, skipped: 0, failed: 2, restorable: 0 })).toBe("failed");
    expect(operationResultState({ success: 0, skipped: 2, failed: 0, restorable: 0 })).toBe("canceled");
    expect(operationResultState({ success: 0, skipped: 0, failed: 0, restorable: 0 })).toBe("no-changes");
    expect(operationResultState({ success: 0, skipped: 0, failed: 0, restorable: 0 }, true)).toBe("failed");
  });

  it("reports restorable results only from successful reversible logs", () => {
    const logs = [operationLog("restorable", "success", true), operationLog("fixed", "success", false), operationLog("failed", "failed", true)];
    expect(summarizeOperationLogs(logs)).toEqual({ success: 2, skipped: 0, failed: 1, restorable: 1 });
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

function operationLog(id: string, status: "success" | "failed" | "skipped", canRestore: boolean) {
  return { id, batch_id: "batch", operation_type: "move", source_path: "C:/a", target_path: "C:/b", old_name: "a", new_name: "b", status, error_message: null, created_at: "2026-07-12T00:00:00Z", can_undo: canRestore, path_before: "C:/a", path_after: "C:/b", name_before: "a", name_after: "b", can_restore: canRestore, restored_at: null, restore_status: "not_restored" as const, restore_error: null };
}
