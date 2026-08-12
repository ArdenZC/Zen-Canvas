// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import type { OrganizationPlan, OrganizationPlanDryRun } from "../src/types/domain";
import { organizationExecutionBatchSummary, OrganizeSuggestionsView } from "../src/views/organize/OrganizeSuggestionsView";

vi.mock("../src/api/tauriApi", () => ({ tauriApi: {} }));

const t = makeTranslator("zh");
const chrome = { t, setView: vi.fn(), language: "zh", view: "organize" } as unknown as ChromeContextValue;
let root: Root;
let container: HTMLDivElement;

const plan = {
  id: "plan-batch",
  title: "Batch plan",
  status: "ready",
  materializedCount: 10_000,
  summary: { remainingExecutable: 10_000 }
} as unknown as OrganizationPlan;

function dryRun(executableCount: number, executionBatchLimit: number): OrganizationPlanDryRun {
  return {
    planId: plan.id,
    planRevision: 4,
    selectedCount: executableCount,
    executableCount,
    blockedCount: 0,
    staleCount: 0,
    totalBytes: executableCount,
    operationKinds: ["move"],
    items: [],
    executionBatchLimit,
    dryRunFingerprint: "dry-run-batch"
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Organization execution batch disclosure", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>';
    container = document.getElementById("test-root") as HTMLDivElement;
    root = createRoot(container);
    useOrganizationPlanStore.setState({
      plans: [plan],
      activePlan: plan,
      groups: [],
      groupNextCursor: null,
      groupHasMore: false,
      dryRun: dryRun(10_000, 1_000),
      dryRunSelection: { allAccepted: true, itemIds: [] },
      executionResult: null,
      isLoading: false,
      isMutating: false,
      error: null,
      loadPlans: vi.fn(async () => undefined),
      openPlan: vi.fn(async () => undefined),
      executeDryRun: vi.fn(async () => { throw new Error("should not execute before confirmation"); })
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("derives the first batch and remaining count from the backend limit", () => {
    expect(organizationExecutionBatchSummary(10_000, 1_000)).toEqual({ batchCount: 1_000, remainingCount: 9_000, isBatched: true });
    expect(organizationExecutionBatchSummary(500, 1_000)).toEqual({ batchCount: 500, remainingCount: 0, isBatched: false });
    expect(organizationExecutionBatchSummary(10_000, 250)).toEqual({ batchCount: 250, remainingCount: 9_750, isBatched: true });
  });

  it("shows and confirms only the capped first batch for a 10,000-item dry run", async () => {
    const executeDryRun = vi.fn(async () => ({}) as never);
    useOrganizationPlanStore.setState({ executeDryRun });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();

    const reviewButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("查看并确认执行"));
    expect(reviewButton).toBeDefined();
    await act(async () => reviewButton?.click());

    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("本批将先执行 1,000 项");
    expect(dialog?.textContent).toContain("后续 9,000 项");
    const confirmButton = [...(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => button.textContent?.includes("执行 1,000 项"));
    expect(confirmButton).toBeDefined();

    await act(async () => confirmButton?.click());
    expect(executeDryRun).toHaveBeenCalledOnce();
  });

  it("uses ordinary confirmation copy when the executable count fits in one backend batch", async () => {
    useOrganizationPlanStore.setState({ dryRun: dryRun(500, 1_000) });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    const reviewButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("查看并确认执行"));
    await act(async () => reviewButton?.click());

    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("将执行 500 项已选择");
    expect(dialog?.textContent).not.toContain("后续");
    expect(dialog?.textContent).toContain("执行 500 项");
  });

  it("keeps the confirmed batch context after execution clears the dry run", async () => {
    const result = {
      plan,
      executionId: "execution-batch",
      operationBatchId: "operation-batch",
      attemptedCount: 1_000,
      succeededCount: 1_000,
      failedCount: 0,
      skippedCount: 0
    } as never;
    const executeDryRun = vi.fn(async () => {
      useOrganizationPlanStore.setState({ dryRun: null, dryRunSelection: null, executionResult: result });
      return { applied: true as const, value: result };
    });
    useOrganizationPlanStore.setState({ executeDryRun });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(OrganizeSuggestionsView) })));
    await flush();
    const reviewButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("查看并确认执行"));
    await act(async () => reviewButton?.click());
    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]');
    const confirmButton = [...(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => button.textContent?.includes("执行 1,000 项"));
    await act(async () => confirmButton?.click());
    await flush();

    expect(executeDryRun).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("尚有 9,000 项");
  });
});
