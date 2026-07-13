import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryScope, OperationLog, OperationPreview } from "../src/types/domain";
import { operationConfirmationTone, operationNeedsCleanupConfirmation, previewsForExecutionIntent, resolveExecutableSelectedPreviews, selectionForPreviewGroup, useOperationQueueStore } from "../src/store/useOperationQueueStore";
import { useFileLibraryStore } from "../src/store/useFileLibraryStore";
import { useRulesStore } from "../src/store/useRulesStore";
import { useAppStore } from "../src/store/useAppStore";
import { useOrganizeDecisionStore } from "../src/store/useOrganizeDecisionStore";

const apiMocks = vi.hoisted(() => ({
  executeRulesForScope: vi.fn(),
  getOperationPreviewsForScope: vi.fn(),
  getOperationLogs: vi.fn(),
  onOperationProgress: vi.fn(),
  executeMoves: vi.fn(),
  restoreMoves: vi.fn(),
  cancelOperations: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    executeRulesForScope: apiMocks.executeRulesForScope,
    getOperationPreviewsForScope: apiMocks.getOperationPreviewsForScope,
    getOperationLogs: apiMocks.getOperationLogs,
    onOperationProgress: apiMocks.onOperationProgress,
    executeMoves: apiMocks.executeMoves,
    restoreMoves: apiMocks.restoreMoves,
    cancelOperations: apiMocks.cancelOperations
  }
}));

function preview(id: string, selectedByDefault: boolean, fileId = `file-${id}`): OperationPreview {
  return {
    id,
    fileId,
    operation_type: "move",
    source_path: `F:/Downloads/${id}.txt`,
    target_path: `F:/Downloads/ZenCanvas/${id}.txt`,
    old_name: `${id}.txt`,
    new_name: `${id}.txt`,
    status: "pending",
    risk_level: "Normal",
    confidence: 0.9,
    requires_confirmation: !selectedByDefault,
    reason: "test",
    selected_by_default: selectedByDefault,
    is_executable: true,
    editable_new_name: true
  };
}

describe("operation queue store callbacks", () => {
  beforeEach(() => {
    apiMocks.executeRulesForScope.mockReset().mockResolvedValue({
      scanned: 0,
      updated: 0,
      skipped: 0,
      needsConfirmation: 0
    });
    apiMocks.getOperationPreviewsForScope.mockReset().mockResolvedValue({
      previews: [],
      total: 0,
      limit: 1000,
      offset: 0,
      truncated: false,
      hasMore: false
    });
    apiMocks.getOperationLogs.mockReset().mockResolvedValue([]);
    apiMocks.onOperationProgress.mockReset().mockResolvedValue(() => {});
    apiMocks.executeMoves.mockReset().mockResolvedValue({ logs: [], batchId: "batch-test" });
    vi.unstubAllGlobals();
    useOperationQueueStore.setState({
      previewNameOverrides: {},
      previews: [],
      displayPreviews: [],
      previewActionCount: 0,
      selectedOperationIds: new Set(),
      previewScope: null,
      previewTotal: 0,
      previewLimit: 0,
      previewOffset: 0,
      previewTruncated: false,
      previewHasMore: false,
      lastExecutionLogs: [],
      executionIntent: null,
      executionError: "",
      previewRequestId: 0
    });
    useRulesStore.setState({ rules: [] });
    useOrganizeDecisionStore.setState({ decisions: {} });
    useAppStore.setState({ language: "en" });
    useFileLibraryStore.setState({
      scope: { kind: "current_scan", roots: [] },
      refresh: vi.fn(async () => {})
    });
  });

  it("keeps onRenamePreview stable across store updates", () => {
    const first = useOperationQueueStore.getState().onRenamePreview;

    useOperationQueueStore.getState().syncPreviews([]);

    expect(useOperationQueueStore.getState().onRenamePreview).toBe(first);
  });

  it("loads dispatch previews from the full active scope after rule execution", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };
    const refresh = vi.fn(async () => {});
    const confirm = vi.fn(() => true);
    const previews = [preview("selected", true), preview("manual", false)];
    apiMocks.executeRulesForScope.mockResolvedValue({
      scanned: 60,
      updated: 60,
      skipped: 0,
      needsConfirmation: 1
    });
    apiMocks.getOperationPreviewsForScope.mockResolvedValue({
      previews,
      total: 60,
      limit: 1000,
      offset: 0,
      truncated: false,
      hasMore: false
    });
    vi.stubGlobal("confirm", confirm);
    useFileLibraryStore.setState({
      scope,
      refresh,
      organizeQueue: [{ matched_rules: ["ai:deepseek:model"] }] as never
    });

    await useOperationQueueStore.getState().runDispatch(true);

    expect(confirm).not.toHaveBeenCalled();
    expect(apiMocks.executeRulesForScope).toHaveBeenCalledWith(scope, [], "inbox_only");
    expect(refresh).toHaveBeenCalledOnce();
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledWith(scope);
    expect(useOperationQueueStore.getState().displayPreviews).toEqual(previews);
    expect(useOperationQueueStore.getState().selectedOperationIds).toEqual(new Set(["selected"]));
    expect(useOperationQueueStore.getState().previewScope).toEqual(scope);
    expect(useOperationQueueStore.getState().previewTotal).toBe(60);
  });

  it("does not run automatic rules when dispatch confirmation is canceled", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };
    const refresh = vi.fn(async () => {});
    vi.stubGlobal("confirm", vi.fn(() => false));
    useFileLibraryStore.setState({ scope, refresh });

    const result = await useOperationQueueStore.getState().runDispatch(false);

    expect(apiMocks.executeRulesForScope).not.toHaveBeenCalled();
    expect(apiMocks.getOperationPreviewsForScope).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it("refreshes previews for a scope without executing operations", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };
    const previews = [preview("ai-preview", true)];
    apiMocks.getOperationPreviewsForScope.mockResolvedValue({
      previews,
      total: 1,
      limit: 1000,
      offset: 0,
      truncated: false,
      hasMore: false
    });

    const result = await useOperationQueueStore.getState().refreshPreviewsForScope(scope);

    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledWith(scope);
    expect(apiMocks.executeMoves).not.toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(useOperationQueueStore.getState().displayPreviews).toEqual(previews);
    expect(useOperationQueueStore.getState().previewScope).toEqual(scope);
  });

  it("loads additional preview pages without dropping existing selections", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };
    const first = preview("first", true);
    const second = preview("second", true);
    const third = preview("third", true);

    useOperationQueueStore.getState().setPreviewResult({
      previews: [first, second],
      total: 3,
      limit: 2,
      offset: 0,
      truncated: true,
      hasMore: true
    }, scope);
    apiMocks.getOperationPreviewsForScope.mockResolvedValueOnce({
      previews: [third],
      total: 3,
      limit: 2,
      offset: 2,
      truncated: false,
      hasMore: false
    });

    await useOperationQueueStore.getState().loadMorePreviews();

    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledWith(scope, undefined, 2, 2);
    expect(useOperationQueueStore.getState().displayPreviews.map((item) => item.id)).toEqual([
      "first",
      "second",
      "third"
    ]);
    expect(useOperationQueueStore.getState().selectedOperationIds).toEqual(
      new Set(["first", "second", "third"])
    );
    expect(useOperationQueueStore.getState().previewTruncated).toBe(false);
  });

  it("does not execute duplicate or cleanup previews until the user confirms", async () => {
    const duplicate = {
      ...preview("duplicate", true),
      is_duplicate: true,
      suggested_action: "Move" as const
    };
    useOperationQueueStore.setState({
      displayPreviews: [duplicate],
      selectedOperationIds: new Set([duplicate.id])
    });
    vi.stubGlobal("confirm", vi.fn(() => false));

    await useOperationQueueStore.getState().executeSelected(false);

    expect(operationNeedsCleanupConfirmation(duplicate)).toBe(true);
    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(apiMocks.executeMoves).not.toHaveBeenCalled();
  });

  it("executes duplicate or cleanup previews after the user confirms", async () => {
    const cleanup = {
      ...preview("cleanup", true),
      suggested_action: "DeleteCandidate" as const
    };
    useOperationQueueStore.setState({
      displayPreviews: [cleanup],
      selectedOperationIds: new Set([cleanup.id])
    });
    vi.stubGlobal("confirm", vi.fn(() => true));

    await useOperationQueueStore.getState().executeSelected(true);

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(apiMocks.executeMoves).toHaveBeenCalledWith([cleanup]);
  });

  it("only executes trash previews after explicit app-level confirmation", async () => {
    const trash = {
      ...preview("trash", true),
      operation_type: "move_to_trash" as const,
      target_path: "Recycle Bin",
      requires_confirmation: true,
      suggested_action: "DeleteCandidate" as const,
      editable_new_name: false,
      will_create_parent: false
    };
    useOperationQueueStore.setState({
      displayPreviews: [trash],
      selectedOperationIds: new Set([trash.id])
    });
    vi.stubGlobal("confirm", vi.fn(() => true));

    await useOperationQueueStore.getState().executeSelected(true);

    expect(operationNeedsCleanupConfirmation(trash)).toBe(true);
    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(apiMocks.executeMoves).toHaveBeenCalledWith([trash]);
  });

  it("classifies every explicit risk field as requiring stronger confirmation", () => {
    expect(operationNeedsCleanupConfirmation({ ...preview("confirm", true), requires_confirmation: true })).toBe(true);
    expect(operationNeedsCleanupConfirmation({ ...preview("sensitive", true), risk_level: "Sensitive" })).toBe(true);
    expect(operationNeedsCleanupConfirmation({ ...preview("system", true), risk_level: "System" })).toBe(true);
    expect(operationNeedsCleanupConfirmation({ ...preview("low", true), confidence: 0.6 })).toBe(true);
    expect(operationNeedsCleanupConfirmation({ ...preview("parent", true), will_create_parent: true })).toBe(true);
  });

  it("classifies normal, warning, and trash confirmation tones with trash taking priority", () => {
    const normal = { ...preview("normal-tone", true), requires_confirmation: false };
    const sensitive = { ...normal, id: "sensitive-tone", risk_level: "Sensitive" as const };
    const duplicate = { ...normal, id: "duplicate-tone", is_duplicate: true };
    const system = { ...normal, id: "system-tone", risk_level: "System" as const };
    const requiresConfirmation = { ...normal, id: "confirm-tone", requires_confirmation: true };
    const trash = { ...normal, id: "trash-tone", operation_type: "move_to_trash" as const };
    expect(operationConfirmationTone([normal])).toBe("default");
    expect(operationConfirmationTone([sensitive])).toBe("warning");
    expect(operationConfirmationTone([duplicate])).toBe("warning");
    expect(operationConfirmationTone([system])).toBe("warning");
    expect(operationConfirmationTone([requiresConfirmation])).toBe("warning");
    expect(operationConfirmationTone([trash])).toBe("danger");
    expect(operationConfirmationTone([sensitive, trash])).toBe("danger");
  });

  it("never sends blocked previews to the backend", async () => {
    const allowed = preview("allowed", true);
    const blocked = { ...preview("blocked", true), is_executable: false, blocking_reason: "source changed" };
    useOperationQueueStore.setState({
      displayPreviews: [allowed, blocked],
      selectedOperationIds: new Set([allowed.id, blocked.id])
    });

    await useOperationQueueStore.getState().executeSelected(true);

    expect(apiMocks.executeMoves).toHaveBeenCalledWith([allowed]);
  });

  it("applies the final whitelist, availability, blocking, and name-validity intersection before execution", async () => {
    const allowed = preview("intersection-allowed", true);
    const blocked = { ...preview("intersection-blocked", true), is_executable: false, blocking_reason: "protected" };
    const invalid = { ...preview("intersection-invalid", true), new_name: "bad?.txt" };
    const unavailable = { ...preview("intersection-unavailable", true), status: "failed" as const };
    const outside = preview("intersection-outside", true);
    useOperationQueueStore.setState({ displayPreviews: [allowed, blocked, invalid, unavailable, outside] });
    useOperationQueueStore.getState().startOrganizePreviewSession("all", new Set([allowed.id, blocked.id, invalid.id, unavailable.id]));
    useOperationQueueStore.setState({ selectedOperationIds: new Set([allowed.id, blocked.id, invalid.id, unavailable.id, outside.id, "missing-preview"]) });

    await useOperationQueueStore.getState().executeSelected(true);

    expect(apiMocks.executeMoves).toHaveBeenCalledOnce();
    expect(apiMocks.executeMoves).toHaveBeenCalledWith([allowed]);
  });

  it("does not execute a preview with an invalid edited file name", async () => {
    const invalid = preview("invalid", true);
    useOperationQueueStore.setState({ previews: [invalid], displayPreviews: [invalid], selectedOperationIds: new Set([invalid.id]) });
    useOperationQueueStore.getState().onRenamePreview(invalid.id, "unsafe ");
    expect(useOperationQueueStore.getState().displayPreviews[0].new_name).toBe("unsafe ");
    await useOperationQueueStore.getState().executeSelected(true);
    expect(apiMocks.executeMoves).not.toHaveBeenCalled();
  });

  it("does not newly group-select invalid names but can deselect an already invalid item", () => {
    const valid = preview("group-valid", true);
    const invalid = { ...preview("group-invalid", true), new_name: "bad?.txt" };
    expect(selectionForPreviewGroup(new Set(), [valid, invalid], true, null)).toEqual(new Set([valid.id]));
    expect(selectionForPreviewGroup(new Set([valid.id, invalid.id]), [valid, invalid], false, null)).toEqual(new Set());
  });

  it("enforces an organize execution whitelist against injected selections", async () => {
    const accepted = preview("accepted", true);
    const kept = preview("kept", true);
    useOperationQueueStore.setState({ displayPreviews: [accepted, kept] });
    useOperationQueueStore.getState().startOrganizePreviewSession("all", new Set([accepted.id]));
    useOperationQueueStore.setState({ selectedOperationIds: new Set([accepted.id, kept.id]) });

    await useOperationQueueStore.getState().executeSelected(true);

    expect(apiMocks.executeMoves).toHaveBeenCalledWith([accepted]);
  });

  it("shows and counts only previews allowed by an organize session", () => {
    const accepted = preview("accepted", true);
    const kept = preview("kept", true);
    const visible = previewsForExecutionIntent([accepted, kept], { source: "organize", scopeKey: "all", allowedPreviewIds: new Set([accepted.id]), initialAllowedCount: 1, sessionId: "test" });
    expect(visible).toEqual([accepted]);
  });

  it("group selection cannot add previews outside the organize whitelist", () => {
    const accepted = preview("accepted-group", true);
    const kept = preview("kept-group", true);
    const intent = { source: "organize" as const, scopeKey: "all", allowedPreviewIds: new Set([accepted.id]), initialAllowedCount: 1, sessionId: "group" };
    expect(selectionForPreviewGroup(new Set(), [accepted, kept], true, intent)).toEqual(new Set([accepted.id]));
  });

  it("syncs a valid Preview rename back to the organize edited decision", () => {
    const operation = preview("rename-sync", true);
    useOrganizeDecisionStore.setState({ decisions: { [`all::${operation.fileId}`]: { fileId: operation.fileId, scopeKey: "all", signature: "stable", state: "accepted" } } });
    useOperationQueueStore.setState({ previews: [operation], displayPreviews: [operation] });
    useOperationQueueStore.getState().startOrganizePreviewSession("all", new Set([operation.id]));

    useOperationQueueStore.getState().onRenamePreview(operation.id, "renamed.txt");

    expect(useOrganizeDecisionStore.getState().decisions[`all::${operation.fileId}`]).toMatchObject({ state: "edited", editedName: "renamed.txt" });
    expect(useOperationQueueStore.getState().displayPreviews[0].new_name).toBe("renamed.txt");
  });

  it("keeps repeated Preview rename synchronization idempotent", () => {
    const operation = preview("rename-idempotent", true);
    useOrganizeDecisionStore.setState({ decisions: { [`all::${operation.fileId}`]: { fileId: operation.fileId, scopeKey: "all", signature: "stable", state: "accepted" } } });
    useOperationQueueStore.setState({ previews: [operation], displayPreviews: [operation] });
    useOperationQueueStore.getState().startOrganizePreviewSession("all", new Set([operation.id]));
    useOperationQueueStore.getState().onRenamePreview(operation.id, "renamed.txt");
    const overrides = useOperationQueueStore.getState().previewNameOverrides;
    const decisions = useOrganizeDecisionStore.getState().decisions;
    useOperationQueueStore.getState().onRenamePreview(operation.id, "renamed.txt");
    expect(useOperationQueueStore.getState().previewNameOverrides).toBe(overrides);
    expect(useOrganizeDecisionStore.getState().decisions).toBe(decisions);
  });

  it("keeps general Preview renames in the operation override without creating organize decisions", () => {
    const operation = preview("general-rename", true);
    useOperationQueueStore.setState({ previews: [operation], displayPreviews: [operation], executionIntent: { source: "general" } });
    useOperationQueueStore.getState().onRenamePreview(operation.id, "general.txt");
    expect(useOperationQueueStore.getState().displayPreviews[0].new_name).toBe("general.txt");
    expect(useOrganizeDecisionStore.getState().decisions).toEqual({});
  });

  it("drops stale organize preview ids after authoritative refresh", () => {
    const oldPreview = preview("old", true);
    const replacement = preview("replacement", true);
    useOperationQueueStore.setState({ previews: [oldPreview], displayPreviews: [oldPreview] });
    useOperationQueueStore.getState().startOrganizePreviewSession("all", new Set([oldPreview.id]));

    useOperationQueueStore.getState().setPreviewResult({ previews: [replacement], total: 1, limit: 1000, offset: 0, truncated: false, hasMore: false }, { kind: "all" });

    expect(useOperationQueueStore.getState().selectedOperationIds).toEqual(new Set());
    expect(useOperationQueueStore.getState().executionIntent).toMatchObject({ source: "organize", allowedPreviewIds: new Set() });
  });

  it("clears an organize whitelist when the preview scope changes", () => {
    const operation = preview("scope-a", true);
    useOperationQueueStore.getState().startOrganizePreviewSession("roots:a:/", new Set([operation.id]));
    useOperationQueueStore.getState().setPreviewResult(previewResult([operation]), { kind: "roots", roots: ["B:/"] });
    expect(useOperationQueueStore.getState().executionIntent).toBeNull();
    expect(useOperationQueueStore.getState().selectedOperationIds).toEqual(new Set([operation.id]));
  });

  it("continues past 100 unrelated previews and finds a target on the second page", async () => {
    const wanted = preview("wanted", true);
    const unrelated = Array.from({ length: 100 }, (_, index) => preview(`unrelated-${index}`, true));
    apiMocks.getOperationPreviewsForScope
      .mockResolvedValueOnce(previewResult(unrelated, true, 0, 101))
      .mockResolvedValueOnce(previewResult([wanted], false, 100, 101));

    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set([wanted.fileId]));

    expect(result?.previews).toEqual([wanted]);
    expect(result?.truncated).toBe(false);
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledTimes(2);
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenNthCalledWith(2, { kind: "all" }, undefined, 100, 100);
    expect(useOperationQueueStore.getState().previews).toEqual([wanted]);
  });

  it("stops a repeated preview page without looping", async () => {
    const unrelated = preview("repeat", true);
    apiMocks.getOperationPreviewsForScope.mockResolvedValue(previewResult([unrelated], true, 0, 10));
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["missing"]));
    expect(result?.previews).toEqual([]);
    expect(result?.truncated).toBe(true);
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledTimes(2);
  });

  it("stops safely on an empty page", async () => {
    apiMocks.getOperationPreviewsForScope.mockResolvedValue(previewResult([], true, 0, 10));
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["missing"]));
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledOnce();
    expect(result?.truncated).toBe(false);
  });

  it("stops when an authoritative next offset does not advance", async () => {
    apiMocks.getOperationPreviewsForScope.mockResolvedValue({ ...previewResult([preview("stalled", true)], true, 0, 10), nextOffset: 0 });
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["missing"]));
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledOnce();
    expect(result?.truncated).toBe(true);
  });

  it("stops immediately after finding every target even when hasMore is true", async () => {
    const wanted = preview("complete", true);
    apiMocks.getOperationPreviewsForScope.mockResolvedValue(previewResult([wanted], true, 0, 200));
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set([wanted.fileId]));
    expect(result?.previews).toEqual([wanted]);
    expect(result?.truncated).toBe(false);
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledOnce();
  });

  it("does not truncate when the backend naturally completes with targets still absent", async () => {
    apiMocks.getOperationPreviewsForScope.mockResolvedValue(previewResult([preview("unrelated-natural", true)], false, 0, 1));
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["missing"]));
    expect(result?.truncated).toBe(false);
  });

  it("marks a missing-target scan truncated at the page safety limit", async () => {
    apiMocks.getOperationPreviewsForScope.mockImplementation((_scope, _action, _limit, offset) =>
      Promise.resolve(previewResult([preview(`page-${offset}`, true)], true, offset, 10_000))
    );
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["missing"]));
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledTimes(24);
    expect(result?.truncated).toBe(true);
  });

  it("marks a missing-target scan truncated at the entry safety limit", async () => {
    const oversizedPage = Array.from({ length: 12_000 }, (_, index) => preview(`entry-${index}`, true));
    apiMocks.getOperationPreviewsForScope.mockResolvedValue(previewResult(oversizedPage, true, 0, 20_000));
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["missing"]));
    expect(apiMocks.getOperationPreviewsForScope).toHaveBeenCalledOnce();
    expect(result?.truncated).toBe(true);
  });

  it("deduplicates preview ids while preserving first-seen backend order", async () => {
    const first = preview("first-target", true, "file-first");
    const second = preview("second-target", true, "file-second");
    apiMocks.getOperationPreviewsForScope
      .mockResolvedValueOnce(previewResult([first], true, 0, 2))
      .mockResolvedValueOnce(previewResult([first, second], false, 1, 2));
    const result = await useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "all" }, new Set(["file-first", "file-second"]));
    expect(result?.previews.map((item) => item.id)).toEqual([first.id, second.id]);
  });

  it("resolves the exact executable selection shared by UI and store", () => {
    const allowed = preview("allowed-count", true);
    const invalid = { ...preview("invalid-count", true), new_name: "bad?name.txt" };
    const blocked = { ...preview("blocked-count", true), is_executable: false };
    const outside = preview("outside-count", true);
    const intent = { source: "organize" as const, scopeKey: "all", allowedPreviewIds: new Set([allowed.id, invalid.id, blocked.id]), initialAllowedCount: 3, sessionId: "count" };
    const result = resolveExecutableSelectedPreviews([allowed, invalid, blocked, outside], new Set([allowed.id, invalid.id, blocked.id, outside.id, "stale"]), intent);
    expect(result.operations).toEqual([allowed]);
    expect(result).toMatchObject({ selectedCount: 5, excludedCount: 4, outsideWhitelistCount: 1, blockedCount: 1, invalidNameCount: 1, unavailableCount: 1 });
    expect(result.excludedCount).toBe(result.outsideWhitelistCount + result.blockedCount + result.invalidNameCount + result.unavailableCount);
    expect(resolveExecutableSelectedPreviews([{ ...invalid, new_name: "valid.txt" }], new Set([invalid.id]), null).operations).toHaveLength(1);
  });

  it("does not let a late old-scope preview request overwrite a newer scope", async () => {
    const first = deferred<ReturnType<typeof previewResult>>();
    const second = deferred<ReturnType<typeof previewResult>>();
    apiMocks.getOperationPreviewsForScope.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldRequest = useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "roots", roots: ["A:/"] }, new Set(["file-old"]));
    const newRequest = useOperationQueueStore.getState().refreshPreviewsForFiles({ kind: "roots", roots: ["B:/"] }, new Set(["file-new"]));
    second.resolve(previewResult([preview("new", true, "file-new")]));
    await newRequest;
    first.resolve(previewResult([preview("old", true, "file-old")]));
    expect(await oldRequest).toBeNull();
    expect(useOperationQueueStore.getState().previews.map((item) => item.id)).toEqual(["new"]);
  });

  it("keeps exact partial execution results for the result view", async () => {
    const logs = [log("ok", "success", true), log("skip", "skipped"), log("bad", "failed")];
    const operation = preview("mixed", true);
    apiMocks.executeMoves.mockResolvedValue({ logs, batch_id: "batch-mixed" });
    useOperationQueueStore.setState({ displayPreviews: [operation], selectedOperationIds: new Set([operation.id]) });

    const result = await useOperationQueueStore.getState().executeSelected(true);

    expect(result).toEqual(logs);
    expect(useOperationQueueStore.getState().lastExecutionLogs).toEqual(logs);
    expect(useOperationQueueStore.getState().operationLogs.slice(0, 3)).toEqual(logs);
  });

  it("keeps an API execution failure as an in-page error state", async () => {
    const operation = preview("api-error", true);
    apiMocks.executeMoves.mockRejectedValue(new Error("backend unavailable"));
    useOperationQueueStore.setState({ displayPreviews: [operation], selectedOperationIds: new Set([operation.id]) });
    expect(await useOperationQueueStore.getState().executeSelected(true)).toEqual([]);
    expect(useOperationQueueStore.getState().executionError).toContain("backend unavailable");
    expect(useOperationQueueStore.getState().lastExecutionLogs).toEqual([]);
  });

  it("clears previous execution results when a new organize session starts", () => {
    useOperationQueueStore.setState({ lastExecutionLogs: [log("old-result", "success", true)], executionError: "old error" });
    useOperationQueueStore.getState().startOrganizePreviewSession("all", new Set(["new-preview"]));
    expect(useOperationQueueStore.getState().lastExecutionLogs).toEqual([]);
    expect(useOperationQueueStore.getState().executionError).toBe("");
  });
});

function log(id: string, status: OperationLog["status"], canRestore = false): OperationLog {
  return {
    id, batch_id: "batch-mixed", operation_type: "move", source_path: `F:/Downloads/${id}.txt`, target_path: `F:/Work/${id}.txt`,
    old_name: `${id}.txt`, new_name: `${id}.txt`, status, error_message: status === "failed" ? "permission denied" : null,
    created_at: "2026-07-12T00:00:00Z", can_undo: canRestore, path_before: `F:/Downloads/${id}.txt`, path_after: `F:/Work/${id}.txt`,
    name_before: `${id}.txt`, name_after: `${id}.txt`, can_restore: canRestore, restored_at: null, restore_status: "not_restored", restore_error: null
  };
}

function previewResult(previews: OperationPreview[], hasMore = false, offset = 0, total = previews.length) {
  return { previews, total, limit: previews.length || 100, offset, truncated: hasMore, hasMore };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
