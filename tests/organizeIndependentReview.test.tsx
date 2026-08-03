// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { useFileLibraryQueryStore, useFileLibraryResultStore, useFileLibrarySelectionStore } from "../src/store/useFileLibraryV2Store";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import type { OrganizationPlan, OrganizationPlanGroupSummary, OrganizationPlanItem } from "../src/types/domain";
import { OrganizeSuggestionsView } from "../src/views/organize/OrganizeSuggestionsView";

const apiMocks = vi.hoisted(() => ({
  queryOrganizationPlanGroupItems: vi.fn(),
  queryOrganizationPlanGroups: vi.fn(),
  updateOrganizationPlanGroupDecision: vi.fn(),
  updateOrganizationPlanDecisions: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    queryOrganizationPlanGroupItems: apiMocks.queryOrganizationPlanGroupItems,
    queryOrganizationPlanGroups: apiMocks.queryOrganizationPlanGroups,
    updateOrganizationPlanGroupDecision: apiMocks.updateOrganizationPlanGroupDecision,
    updateOrganizationPlanDecisions: apiMocks.updateOrganizationPlanDecisions
  }
}));

const t = makeTranslator("zh");
const chrome = { t, setView: vi.fn(), language: "zh", view: "organize" } as unknown as ChromeContextValue;
let root: Root;
let container: HTMLDivElement;
const nativeGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const nativeClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const nativeOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const nativeOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

const plan: OrganizationPlan = {
  id: "plan-review",
  title: "Review plan",
  status: "ready",
  sourceKind: "explicit",
  sourceQueryFingerprint: null,
  sourceSnapshotRevision: 4,
  requestedCount: 1,
  materializedCount: 1,
  plannerVersion: 1,
  revision: 5,
  activeExecutionId: null,
  activeOperationBatchId: null,
  lastErrorCode: null,
  lastErrorDetail: null,
  createdAt: 1,
  updatedAt: 1,
  readyAt: 1,
  completedAt: null,
  effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 1, blocked: 0 },
  summary: { undecided: 1, accepted: 0, kept: 0, edited: 0, needsAnalysis: 0, needsReview: 1, pendingReview: 1, reviewed: 0, ready: 0, blocked: 0, stale: 0, executing: 0, executed: 0, failed: 0, skipped: 0, remainingExecutable: 0 }
};

const reviewItem: OrganizationPlanItem = {
  id: "item-review",
  planId: plan.id,
  ordinal: 0,
  fileIdSnapshot: "file-review",
  sourcePathSnapshot: "C:/Inbox/report.txt",
  sourceNameSnapshot: "report.txt",
  sourceSizeSnapshot: 120,
  sourceMtimeSnapshot: 1,
  sourceIsDirSnapshot: false,
  proposalFingerprint: "proposal-review",
  proposalKind: "move",
  proposedTargetDirectory: "C:/Documents",
  proposedName: "report.txt",
  proposedTargetPath: "C:/Documents/report.txt",
  decision: "undecided",
  editedName: null,
  validity: "needs_review",
  reviewState: "needs_review",
  effectiveReadiness: "requires-decision",
  confidence: 0.7,
  riskLevel: "Normal",
  requiresConfirmation: true,
  blockingCode: null,
  blockingDetail: null,
  authoritativePreviewId: "preview-review",
  reviewReasons: ["low_confidence", "requires_confirmation"],
  availableActions: ["accept_suggestion", "edit_name", "view_preview", "keep", "defer"],
  operationLogId: null,
  executionId: null,
  revision: 2,
  createdAt: 1,
  updatedAt: 1
};

const reviewGroup: OrganizationPlanGroupSummary = {
  groupId: "group-review",
  planId: plan.id,
  label: "C:/Documents · move",
  targetDirectory: "C:/Documents",
  proposalKind: "move",
  readiness: "requires-decision",
  riskLevel: "Normal",
  itemCount: 1,
  totalBytes: 120,
  acceptedCount: 0,
  excludedCount: 0,
  staleCount: 0,
  conflictCount: 0,
  confidenceBand: "medium",
  reviewReasonCounts: [{ reason: "low_confidence", count: 1 }, { reason: "requires_confirmation", count: 1 }],
  availableActions: ["accept_suggestion", "edit_name", "keep", "defer"],
  groupActions: { canAcceptAll: false, canKeepAll: true, canClearAll: false },
  projectionFingerprint: "fp-review",
  sampleItems: [{ itemId: reviewItem.id, sourceName: reviewItem.sourceNameSnapshot, sourcePath: reviewItem.sourcePathSnapshot, proposedName: reviewItem.proposedName, decision: reviewItem.decision, validity: reviewItem.validity }],
  revision: plan.revision
};

const readyItem: OrganizationPlanItem = {
  ...reviewItem,
  id: "item-ready",
  validity: "ready",
  reviewState: "ready",
  effectiveReadiness: "ready",
  confidence: 0.95,
  requiresConfirmation: false,
  reviewReasons: [],
  availableActions: ["accept_suggestion", "edit_name", "view_preview", "keep"]
};

const readyGroup: OrganizationPlanGroupSummary = {
  ...reviewGroup,
  groupId: "group-ready",
  label: "C:/Documents · move · ready",
  readiness: "ready",
  confidenceBand: "high",
  reviewReasonCounts: [],
  availableActions: ["accept_suggestion", "edit_name", "keep"],
  groupActions: { canAcceptAll: true, canKeepAll: true, canClearAll: false },
  sampleItems: [{ ...reviewGroup.sampleItems[0], itemId: readyItem.id, decision: readyItem.decision, validity: readyItem.validity }]
};

const reviewedItem: OrganizationPlanItem = {
  ...reviewItem,
  decision: "accepted",
  reviewState: "reviewed",
  effectiveReadiness: "reviewed",
  revision: 3,
  availableActions: ["edit_name", "view_preview", "keep", "clear_decision"]
};

const reviewedGroup: OrganizationPlanGroupSummary = {
  ...reviewGroup,
  groupId: "group-reviewed",
  readiness: "reviewed",
  acceptedCount: 1,
  availableActions: ["edit_name", "keep", "clear_decision"],
  groupActions: { canAcceptAll: false, canKeepAll: true, canClearAll: true },
  sampleItems: [{ ...reviewGroup.sampleItems[0], itemId: reviewedItem.id, decision: "accepted", validity: "needs_review" }]
};

function updatedPlan(): OrganizationPlan {
  return { ...plan, revision: 6, effectiveSummary: { ready: 0, reviewed: 1, pendingReview: 0, blocked: 0 }, summary: { ...plan.summary, undecided: 0, accepted: 1, needsReview: 1, pendingReview: 0, reviewed: 1, remainingExecutable: 1 } };
}

function updatedItem(): OrganizationPlanItem {
  return { ...reviewItem, decision: "accepted", reviewState: "reviewed", revision: 3, availableActions: ["edit_name", "view_preview", "keep", "clear_decision"] };
}

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`Button not found: ${text}`);
  return found;
}

async function flush() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe("Organize independent review behavior", () => {
  let acceptedReview = false;

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>';
    container = document.getElementById("test-root") as HTMLDivElement;
    root = createRoot(container);
    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() { return {}; } }) as DOMRect;
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
    useFileLibraryQueryStore.setState({ fingerprint: "query", snapshotRevision: 1 });
    useFileLibraryResultStore.setState({ totalCount: 1 });
    useFileLibrarySelectionStore.setState({ selection: null, focusedId: "", anchorIndex: -1 });
    useOrganizationPlanStore.setState({
      plans: [plan],
      activePlan: plan,
      groups: [reviewGroup],
      groupHasMore: false,
      groupNextCursor: null,
      isLoading: false,
      isMutating: false,
      error: null,
      dryRun: null,
      executionResult: null,
      loadPlans: vi.fn(async () => undefined),
      openPlan: vi.fn(async () => undefined),
      refreshPlan: vi.fn(async () => ({ applied: true as const, value: plan }))
    });
    acceptedReview = false;
    apiMocks.queryOrganizationPlanGroupItems.mockImplementation(async (request: { groupId?: string }) => ({
      planId: plan.id,
      groupId: request?.groupId ?? reviewGroup.groupId,
      planRevision: acceptedReview ? 6 : 5,
      items: request?.groupId === reviewedGroup.groupId ? [reviewedItem] : request?.groupId === readyGroup.groupId ? [readyItem] : [reviewItem],
      nextCursor: null,
      hasMore: false
    }));
    apiMocks.queryOrganizationPlanGroups.mockImplementation(async () => ({ planId: plan.id, planRevision: acceptedReview ? 6 : 5, groups: acceptedReview ? [reviewedGroup] : [reviewGroup], effectiveSummary: acceptedReview ? { ready: 0, reviewed: 1, pendingReview: 0, blocked: 0 } : plan.effectiveSummary, nextCursor: null, hasMore: false }));
    apiMocks.updateOrganizationPlanGroupDecision.mockResolvedValue({ plan, group: reviewGroup });
    apiMocks.updateOrganizationPlanDecisions.mockImplementation(async () => {
      acceptedReview = true;
      return updatedPlan();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    HTMLElement.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
    if (nativeClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", nativeClientHeight);
    else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    if (nativeOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", nativeOffsetHeight);
    else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    if (nativeOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", nativeOffsetWidth);
    else delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("keeps group acceptance out of requires-decision when the backend action intersection is unavailable and confirms a single ordinary item mutation", async () => {
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("需要我决定").click());
    await flush();

    expect(container.textContent).toContain("置信度较低 (1)");
    expect(container.textContent).toContain("需要确认 (1)");
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("纳入整组"))).toBe(false);
    await act(async () => container.querySelector<HTMLElement>(`[data-organize-group-row="${reviewGroup.groupId}"]`)?.click());
    await flush();

    const accept = button("接受此建议");
    expect(accept.disabled).toBe(false);
    await act(async () => accept.click());
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("置信度较低");
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("C:/Documents/report.txt");
    expect(apiMocks.updateOrganizationPlanDecisions).not.toHaveBeenCalled();

    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((item) => item.textContent?.includes("确认接受建议"));
    expect(confirm).toBeTruthy();
    await act(async () => confirm?.click());
    await flush();

    expect(apiMocks.updateOrganizationPlanDecisions).toHaveBeenCalledWith({
      planId: plan.id,
      expectedPlanRevision: plan.revision,
      mutations: [{ itemId: reviewItem.id, expectedItemRevision: reviewItem.revision, decision: "accepted", editedFilename: null }]
    });
    expect(apiMocks.updateOrganizationPlanDecisions.mock.calls[0]?.[0]?.safeBatch).not.toBe(true);
    expect(container.textContent).toContain("没有需要你决定的分组");
    expect(container.textContent).toContain("待你决定0");
    const dryRun = button("检查执行");
    expect(dryRun.disabled).toBe(false);
    expect(useOrganizationPlanStore.getState().groups[0]?.readiness).toBe("reviewed");
  });

  it("requires confirmation before accepting a requires-decision group", async () => {
    const reviewActionGroup: OrganizationPlanGroupSummary = {
      ...reviewGroup,
      groupActions: { canAcceptAll: true, canKeepAll: true, canClearAll: false }
    };
    useOrganizationPlanStore.setState({ groups: [reviewActionGroup] });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("需要我决定").click());
    await flush();

    await act(async () => button("纳入整组").click());
    await flush();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("确认接受整组建议");
    expect(apiMocks.updateOrganizationPlanGroupDecision).not.toHaveBeenCalled();

    await act(async () => button("确认接受整组").click());
    await flush();
    expect(apiMocks.updateOrganizationPlanGroupDecision).toHaveBeenCalledWith({
      planId: plan.id,
      groupId: reviewActionGroup.groupId,
      expectedPlanRevision: plan.revision,
      expectedProjectionFingerprint: reviewActionGroup.projectionFingerprint,
      expectedItemCount: reviewActionGroup.itemCount,
      decision: "accepted"
    });
  });

  it("keeps group acceptance available for a ready group and refreshes the plan after group acceptance", async () => {
    useOrganizationPlanStore.setState({ groups: [readyGroup] });
    apiMocks.queryOrganizationPlanGroupItems.mockResolvedValue({ planId: plan.id, groupId: readyGroup.groupId, planRevision: plan.revision, items: [readyItem], nextCursor: null, hasMore: false });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    const include = button("纳入整组");
    expect(include.disabled).toBe(false);
    await act(async () => include.click());
    await flush();

    expect(apiMocks.updateOrganizationPlanGroupDecision).toHaveBeenCalledWith({
      planId: plan.id,
      groupId: readyGroup.groupId,
      expectedPlanRevision: plan.revision,
      expectedProjectionFingerprint: readyGroup.projectionFingerprint,
      expectedItemCount: readyGroup.itemCount,
      decision: "accepted"
    });
    expect(useOrganizationPlanStore.getState().openPlan).toHaveBeenCalledWith(plan.id);
  });

  it("uses the backend group action intersection for mixed and keep groups", async () => {
    const mixedGroup: OrganizationPlanGroupSummary = {
      ...readyGroup,
      groupId: "group-mixed",
      groupActions: { canAcceptAll: false, canKeepAll: false, canClearAll: false }
    };
    useOrganizationPlanStore.setState({ groups: [mixedGroup] });
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("纳入整组"))).toBe(false);
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("全部保留原位"))).toBe(false);
    act(() => root.unmount());
    root = createRoot(container);

    const keepGroup: OrganizationPlanGroupSummary = {
      ...readyGroup,
      groupId: "group-keep",
      proposalKind: "keep",
      groupActions: { canAcceptAll: false, canKeepAll: true, canClearAll: false }
    };
    const keepItem: OrganizationPlanItem = { ...readyItem, id: "item-keep", proposalKind: "keep", availableActions: ["keep"] };
    useOrganizationPlanStore.setState({ groups: [keepGroup] });
    apiMocks.queryOrganizationPlanGroupItems.mockResolvedValue({ planId: plan.id, groupId: keepGroup.groupId, planRevision: plan.revision, items: [keepItem], nextCursor: null, hasMore: false });
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("纳入整组"))).toBe(false);
    expect(container.textContent).toContain("无需移动");
  });

  it("keeps an unavailable group action from refreshing or showing optimistic success", async () => {
    useOrganizationPlanStore.setState({ groups: [readyGroup] });
    apiMocks.queryOrganizationPlanGroupItems.mockResolvedValue({ planId: plan.id, groupId: readyGroup.groupId, planRevision: plan.revision, items: [readyItem], nextCursor: null, hasMore: false });
    apiMocks.updateOrganizationPlanGroupDecision.mockRejectedValueOnce(new Error("organization_group_action_not_available"));
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("纳入整组").click());
    await flush();
    expect(container.textContent).toContain("该整组操作当前不可用，请查看分组详情。");
    expect(useOrganizationPlanStore.getState().openPlan).not.toHaveBeenCalled();
    expect(useOrganizationPlanStore.getState().refreshPlan).not.toHaveBeenCalled();
  });

  it("keeps reviewed groups in the plan tab and out of the decision tab", async () => {
    const reviewedPlan: OrganizationPlan = {
      ...plan,
      revision: 6,
      effectiveSummary: { ready: 0, reviewed: 1, pendingReview: 0, blocked: 0 },
      summary: { ...plan.summary, undecided: 0, accepted: 1, pendingReview: 0, reviewed: 1, remainingExecutable: 1 }
    };
    acceptedReview = true;
    useOrganizationPlanStore.setState({ plans: [reviewedPlan], activePlan: reviewedPlan, groups: [reviewedGroup] });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    expect(container.querySelector(`[data-organize-group-row="${reviewedGroup.groupId}"]`)).toBeTruthy();
    expect(container.textContent).toContain("已复核");
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("纳入整组"))).toBe(false);
    await act(async () => button("需要我决定").click());
    await flush();
    expect(container.textContent).toContain("没有需要你决定的分组");
    expect(container.querySelector(`[data-organize-group-row="${reviewedGroup.groupId}"]`)).toBeNull();
  });

  it("renders an unavailable acceptance action when the item has no authoritative preview", async () => {
    const noPreview = { ...reviewItem, authoritativePreviewId: null, availableActions: ["keep", "defer"], reviewReasons: ["unknown_backend_reason"] };
    apiMocks.queryOrganizationPlanGroupItems.mockResolvedValue({ planId: plan.id, groupId: reviewGroup.groupId, planRevision: 5, items: [noPreview], nextCursor: null, hasMore: false });
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("需要我决定").click());
    await act(async () => container.querySelector<HTMLElement>(`[data-organize-group-row="${reviewGroup.groupId}"]`)?.click());
    await flush();
    const unavailable = button("当前不能接受");
    expect(unavailable.disabled).toBe(true);
    expect(unavailable.title).toContain("权威预览");
    expect(container.textContent).toContain("需要进一步复核");
  });

  it("does not offer acceptance for a collision item while keeping the edit action", async () => {
    const collisionItem: OrganizationPlanItem = {
      ...reviewItem,
      validity: "blocked",
      reviewState: "blocked",
      blockingCode: "target_collision",
      reviewReasons: ["target_collision"],
      availableActions: ["edit_name", "view_preview", "keep"]
    };
    const collisionGroup: OrganizationPlanGroupSummary = {
      ...reviewGroup,
      groupId: "group-collision",
      readiness: "blocked",
      reviewReasonCounts: [{ reason: "target_collision", count: 1 }],
      availableActions: ["edit_name", "keep"],
      groupActions: { canAcceptAll: false, canKeepAll: true, canClearAll: false },
      sampleItems: [{ ...reviewGroup.sampleItems[0], itemId: collisionItem.id, validity: "blocked" }]
    };
    useOrganizationPlanStore.setState({ groups: [collisionGroup] });
    apiMocks.queryOrganizationPlanGroups.mockResolvedValue({ planId: plan.id, planRevision: plan.revision, groups: [collisionGroup], effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 1 }, nextCursor: null, hasMore: false });
    apiMocks.queryOrganizationPlanGroupItems.mockResolvedValue({ planId: plan.id, groupId: collisionGroup.groupId, planRevision: plan.revision, items: [collisionItem], nextCursor: null, hasMore: false });
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("暂不可处理").click());
    await act(async () => container.querySelector<HTMLElement>(`[data-organize-group-row="${collisionGroup.groupId}"]`)?.click());
    await flush();
    const unavailable = button("当前不能接受");
    expect(unavailable.disabled).toBe(true);
    expect(button("调整文件名").disabled).toBe(false);
    expect(apiMocks.updateOrganizationPlanDecisions).not.toHaveBeenCalled();
  });

  it("shows a localized backend eligibility error without optimistic acceptance", async () => {
    apiMocks.updateOrganizationPlanDecisions.mockRejectedValueOnce(new Error("organization_item_accept_not_available"));
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("需要我决定").click());
    await act(async () => container.querySelector<HTMLElement>(`[data-organize-group-row="${reviewGroup.groupId}"]`)?.click());
    await flush();
    await act(async () => button("接受此建议").click());
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((item) => item.textContent?.includes("确认接受建议"));
    await act(async () => confirm?.click());
    await flush();
    expect(apiMocks.updateOrganizationPlanDecisions).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("建议已不可用，状态没有被本地接受");
    expect(container.querySelector(`[data-organize-group-row="${reviewGroup.groupId}"]`)).toBeTruthy();
  });

  it("shows a localized group-change error with an explicit refresh and no retry", async () => {
    useOrganizationPlanStore.setState({ groups: [readyGroup] });
    apiMocks.queryOrganizationPlanGroups.mockResolvedValue({ planId: plan.id, planRevision: plan.revision, groups: [readyGroup], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false });
    apiMocks.queryOrganizationPlanGroupItems.mockResolvedValue({ planId: plan.id, groupId: readyGroup.groupId, planRevision: plan.revision, items: [readyItem], nextCursor: null, hasMore: false });
    apiMocks.updateOrganizationPlanGroupDecision.mockRejectedValueOnce(new Error("organization_group_changed"));

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("纳入整组").click());
    await flush();

    expect(apiMocks.updateOrganizationPlanGroupDecision).toHaveBeenCalledOnce();
    expect(useOrganizationPlanStore.getState().openPlan).not.toHaveBeenCalled();
    expect(container.textContent).toContain("此分组中的文件或建议已经变化，请刷新后重新确认。");
    const refresh = button("刷新当前事实");
    expect(refresh).toBeTruthy();
    await act(async () => refresh.click());
    expect(useOrganizationPlanStore.getState().refreshPlan).toHaveBeenCalledOnce();
    expect(apiMocks.updateOrganizationPlanGroupDecision).toHaveBeenCalledOnce();
  });

  it("does not continue a mounted Plan A item mutation after the user switches to Plan B", async () => {
    const planB: OrganizationPlan = { ...plan, id: "plan-b", title: "Plan B", revision: 9 };
    const groupB: OrganizationPlanGroupSummary = { ...readyGroup, planId: planB.id, groupId: "group-b", revision: planB.revision };
    let resolveMutation: (value: OrganizationPlan) => void = () => undefined;
    apiMocks.updateOrganizationPlanDecisions.mockImplementation(() => new Promise<OrganizationPlan>((resolve) => { resolveMutation = resolve; }));

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    await act(async () => button("需要我决定").click());
    await act(async () => container.querySelector<HTMLElement>(`[data-organize-group-row="${reviewGroup.groupId}"]`)?.click());
    await flush();
    await act(async () => button("接受此建议").click());
    await act(async () => button("确认接受建议").click());
    await flush();

    useOrganizationPlanStore.setState({ activePlan: planB, plans: [plan, planB], groups: [groupB], groupNextCursor: null, groupHasMore: false, isMutating: false });
    resolveMutation(updatedPlan());
    await flush();

    expect(apiMocks.queryOrganizationPlanGroups).not.toHaveBeenCalledWith({ planId: plan.id, pageSize: 100, cursor: null });
    expect(useOrganizationPlanStore.getState().activePlan?.id).toBe(planB.id);
    expect(container.textContent).not.toContain("建议或安全预览加载失败，请重试。");
  });
});
