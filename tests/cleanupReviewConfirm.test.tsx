// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { resetStorageCleanupStoreForTest, useStorageCleanupStore } from "../src/store/useStorageCleanupStore";
import type { StorageAnalysis } from "../src/types/domain";
import { StorageCleanupView } from "../src/views/cleanup/StorageCleanupView";

const reviewAnalysis: StorageAnalysis = {
  total_size: 100,
  reclaimable_estimate: 0,
  review_estimate: 100,
  denied_paths: [],
  warnings: [],
  candidates: [{
    id: "review-cache",
    path: "C:/Users/Zen/Downloads/review-cache",
    name: "review-cache",
    size: 100,
    tier: "Review",
    category: "Downloads",
    reason: "This folder may contain user-owned files.",
    suggested_action: "MoveToTrash",
    risk_note: "Review the location before cleanup.",
    trash_allowed: true,
    selected_by_default: false
  }]
};

describe("cleanup review confirmation", () => {
  let root: Root;
  const nativeGetClientRects = HTMLElement.prototype.getClientRects;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="app-shell-content"></div><div id="test-root"></div>';
    HTMLElement.prototype.getClientRects = () => [{ width: 120, height: 40, top: 0, left: 0, right: 120, bottom: 40, x: 0, y: 0, toJSON() { return {}; } }] as unknown as DOMRectList;
    resetStorageCleanupStoreForTest();
    useStorageCleanupStore.setState({
      analysis: reviewAnalysis,
      displayedJobId: "job-1",
      selectedRoots: ["C:/Users/Zen/Downloads"]
    });
    root = createRoot(document.getElementById("test-root")!);
  });

  afterEach(() => {
    act(() => root.unmount());
    resetStorageCleanupStoreForTest();
    resetModalInfrastructureForTests();
    HTMLElement.prototype.getClientRects = nativeGetClientRects;
    document.body.innerHTML = "";
  });

  it("uses an application dialog before a Review candidate enters Safe Trash", async () => {
    await act(async () => root.render(createElement(StorageCleanupView as unknown as (props: Record<string, unknown>) => React.ReactElement, {
      api: {
        startStorageCleanupScan: async () => "job-1",
        cancelStorageCleanupScan: async () => undefined,
        getStorageCleanupScanStatus: async () => ({ jobId: "job-1", status: "running", progress: null }),
        revealStorageCandidate: async () => undefined,
        moveCleanupCandidatesToSafeTrash: async () => ({ moved: 0, skipped: 0, failed: 0, logs: [] })
      },
      t: makeTranslator("zh")
    })));

    const select = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("选择移到回收站"));
    expect(select).toBeTruthy();
    await act(async () => select?.click());
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("安全回收站");

    const cancel = [...dialog!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "取消");
    await act(async () => cancel?.click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(useStorageCleanupStore.getState().selectedCleanupIds).toEqual(new Set());

    await act(async () => select?.click());
    const confirm = [...document.querySelector('[role="alertdialog"]')!.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("选择移到回收站"));
    await act(async () => confirm?.click());
    expect(useStorageCleanupStore.getState().selectedCleanupIds).toEqual(new Set(["review-cache"]));
  });
});
