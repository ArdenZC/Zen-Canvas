import { invokeCommand, listenTo, type EventHandler } from "./core";
import type {
  ManagedScanEvent,
  ManagedScanRequest,
  ManagedScanSnapshotDto,
  ManagedScanStartDto,
  ScanBatchPayload,
  ScanProgressPayload,
  ScanRootDto,
  ScanRunDto,
  ScanSummary,
  DedupeCompletePayload,
  DedupeProgressPayload,
  WatcherReconciliationStatus
} from "./types";
import type { UnlistenFn } from "@tauri-apps/api/event";

export const scanApi = {
  startScan(path: string, includeEntries = false, jobId: string, jobKind: "foreground" | "background", runDedupe = true): Promise<ScanSummary> {
    return invokeCommand<ScanSummary>("scan_directory", { path, includeEntries, jobId, jobKind, runDedupe });
  },
  startManagedScan(request: ManagedScanRequest): Promise<ManagedScanStartDto> {
    return invokeCommand<ManagedScanStartDto>("start_managed_scan", { request });
  },
  getManagedScanSnapshot(sessionId: string): Promise<ManagedScanSnapshotDto> {
    return invokeCommand<ManagedScanSnapshotDto>("get_managed_scan_snapshot", { sessionId });
  },
  cancelScanRun(runId: string): Promise<ScanRunDto> {
    return invokeCommand<ScanRunDto>("cancel_scan_run", { runId });
  },
  getScanRun(runId: string): Promise<ScanRunDto> {
    return invokeCommand<ScanRunDto>("get_scan_run", { runId });
  },
  listScanRuns(sessionId?: string, rootId?: string, limit = 100): Promise<ScanRunDto[]> {
    return invokeCommand<ScanRunDto[]>("list_scan_runs", { sessionId: sessionId ?? null, rootId: rootId ?? null, limit });
  },
  listScanRoots(): Promise<ScanRootDto[]> {
    return invokeCommand<ScanRootDto[]>("list_scan_roots");
  },
  getScanRootHealth(rootId?: string, path?: string): Promise<ScanRootDto> {
    return invokeCommand<ScanRootDto>("get_scan_root_health", { rootId: rootId ?? null, path: path ?? null });
  },
  retryInterruptedScan(runId: string): Promise<ManagedScanStartDto> {
    return invokeCommand<ManagedScanStartDto>("retry_interrupted_scan", { runId });
  },
  createScanJobId(jobKind: "foreground" | "background"): Promise<string> {
    return invokeCommand<string>("create_scan_job_id", { jobKind });
  },
  cancelScan(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_scan", { jobId });
  },
  cancelDedupe(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_dedupe", { jobId });
  },
  onScanProgress(handler: EventHandler<ScanProgressPayload>): Promise<UnlistenFn> {
    return listenTo("scan-progress", handler);
  },
  onScanBatch(handler: EventHandler<ScanBatchPayload>): Promise<UnlistenFn> {
    return listenTo("scan-batch", handler);
  },
  onScanComplete(handler: EventHandler<ScanSummary>): Promise<UnlistenFn> {
    return listenTo("scan-complete", handler);
  },
  onScanCanceled(handler: EventHandler<ScanSummary>): Promise<UnlistenFn> {
    return listenTo("scan-canceled", handler);
  },
  onScanError(handler: EventHandler<{ jobId: string; jobKind: "foreground" | "background"; root: string; path: string; message: string }>): Promise<UnlistenFn> {
    return listenTo("scan-error", handler);
  },
  onManagedScanEvent(handler: EventHandler<ManagedScanEvent>): Promise<UnlistenFn> {
    return listenTo("scan-run-updated", handler);
  },
  onFsEvent<T>(handler: EventHandler<T>): Promise<UnlistenFn> {
    return listenTo("fs-event", handler);
  },
  onFsWatcherWarning<T>(handler: EventHandler<T>): Promise<UnlistenFn> {
    return listenTo("fs-watcher-warning", handler);
  },
  onWatcherReconciliationStatus(handler: EventHandler<WatcherReconciliationStatus>): Promise<UnlistenFn> {
    return listenTo("watcher-reconciliation-status", handler);
  },
  onDedupeProgress(handler: EventHandler<DedupeProgressPayload>): Promise<UnlistenFn> {
    return listenTo("dedupe-progress", handler);
  },
  onDedupeComplete(handler: EventHandler<DedupeCompletePayload>): Promise<UnlistenFn> {
    return listenTo("dedupe-complete", handler);
  }
};

export type ScanApi = typeof scanApi;
