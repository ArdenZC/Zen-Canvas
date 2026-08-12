// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatcherReconciliationStatus } from "../src/api/tauriApi";
import { makeTranslator } from "../src/i18n";
import type { ScanRootSetting } from "../src/types/domain";
import { FileSourcesSettingsSection } from "../src/views/settings/sections/FileSourcesSettingsSection";

const t = makeTranslator("zh");
const rootSetting: ScanRootSetting = {
  id: "scan-root-a",
  path: "C:/Managed",
  label: "Managed",
  enabled: true,
  createdAt: "2026-08-02T00:00:00.000Z"
};

function watcherStatus(overrides: Partial<WatcherReconciliationStatus> = {}): WatcherReconciliationStatus {
  return {
    scanRootId: rootSetting.id,
    path: rootSetting.path,
    rootRevision: 3,
    watcherRevision: 3,
    watcherAppliedRevision: 3,
    pending: false,
    needsReconciliation: false,
    healthStatus: "healthy",
    activeRunId: null,
    lastEventAt: 1,
    lastAppliedAt: 1,
    lastErrorCode: null,
    lastErrorMessage: null,
    timestamp: 1,
    ...overrides
  };
}

let root: Root;
let container: HTMLDivElement;

function renderStatus(status: WatcherReconciliationStatus) {
  act(() => {
    root.render(createElement(FileSourcesSettingsSection, {
      t,
      defaultScanFolders: [rootSetting],
      watcherRootStatuses: { [rootSetting.id]: status },
      organizeRootMode: "current_folder",
      organizeRootPath: null,
      onAddScanFolder: vi.fn(),
      onSetScanRootEnabled: vi.fn(),
      onScanRootNow: vi.fn(),
      onRequestDelete: vi.fn(),
      onOrganizeRootMode: vi.fn(),
      onOrganizeRootPath: vi.fn(),
      onChooseOrganizeRootPath: vi.fn()
    }));
  });
}

describe("mounted watcher health language priority", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ["permission wins over reconciliation and retry", watcherStatus({ healthStatus: "permission_required", pending: true, needsReconciliation: true, lastErrorCode: "watcher_reconciliation_retry_exhausted" }), "需要权限"],
    ["retry exhaustion wins over reconciliation", watcherStatus({ healthStatus: "reconciliation_required", pending: true, needsReconciliation: true, lastErrorCode: "watcher_reconciliation_retry_exhausted" }), "重试次数已用尽"],
    ["partial wins over reconciliation and syncing", watcherStatus({ healthStatus: "degraded", pending: true, needsReconciliation: true, activeRunId: "run-1" }), "覆盖不完整"],
    ["reconciliation wins over syncing", watcherStatus({ healthStatus: "reconciliation_required", pending: true, needsReconciliation: true, activeRunId: "run-1" }), "正在校准索引"],
    ["partial wins over syncing", watcherStatus({ healthStatus: "partial", activeRunId: "run-1" }), "覆盖不完整"],
    ["pending is presented as syncing when reconciliation is not required", watcherStatus({ pending: true, activeRunId: "run-1" }), "正在同步变化"],
    ["syncing is shown before healthy", watcherStatus({ healthStatus: "scanning", activeRunId: "run-1" }), "正在同步变化"],
    ["stale is distinct from a healthy root", watcherStatus({ healthStatus: "stale" }), "需要重新同步"],
    ["unknown is shown when the backend has no health state", watcherStatus({ healthStatus: "unknown" }), "状态读取中"],
    ["healthy is shown when no attention state exists", watcherStatus(), "已同步"]
  ])("uses the stable priority when %s", (_name, status, expected) => {
    renderStatus(status);
    expect(container.textContent).toContain(expected);
  });
});
