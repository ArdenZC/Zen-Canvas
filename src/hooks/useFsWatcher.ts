import { useEffect, useRef } from "react";
import { tauriApi, type WatcherReconciliationStatus } from "../api/tauriApi";
import { makeTranslator } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { useWatcherStatusStore } from "../store/useWatcherStatusStore";
import type { Rule } from "../types/domain";
import { readableError } from "../utils/viewHelpers";
import {
  WatcherRetryQueue,
  WATCHER_QUEUE_BATCH_LIMIT,
  watcherQueueSnapshotFromEvent,
  type FsWatchEvent
} from "./fsWatcherQueue";

interface FsWatcherOptions {
  onRefreshData: () => Promise<void>;
  onError?: (message: string) => void;
  rules?: Rule[];
  enabled?: boolean;
}

interface FsWatcherWarningEvent {
  message: string;
  path?: string | null;
  limit?: number | null;
}

const WATCHER_FLUSH_DELAY_MS = 500;
const WATCHER_CLASSIFY_LIMIT = 500;
const EMPTY_RULES: Rule[] = [];

export function useFsWatcher({
  onRefreshData,
  onError,
  rules = EMPTY_RULES,
  enabled = true
}: FsWatcherOptions) {
  const rulesRef = useRef(rules);

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let statusRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let unlistenStatus: (() => void) | undefined;
    let unlistenWarning: (() => void) | undefined;
    let unlistenFs: (() => void) | undefined;
    let unlistenLegacyWarning: (() => void) | undefined;
    const knownRootRevisions = new Map<string, number>();

    const refreshProjection = () => {
      if (statusRefreshTimer !== undefined) clearTimeout(statusRefreshTimer);
      statusRefreshTimer = setTimeout(() => {
        statusRefreshTimer = undefined;
        if (!disposed) void onRefreshData().catch((error) => onError?.(readableError(error)));
      }, 100);
    };

    const warningHandler = (payload: FsWatcherWarningEvent | WatcherReconciliationStatus) => {
      if (disposed) return;
      const status = payload as WatcherReconciliationStatus;
      if (status.healthStatus === "permission_required") {
        onError?.(watcherPermissionMessage());
      } else if (status.healthStatus === "reconciliation_required" || status.needsReconciliation) {
        onError?.(watcherReconciliationMessage());
      } else {
        onError?.(watcherPartialIndexWarningMessage());
      }
    };

    const registerLegacyAdapter = () => {
      if (disposed) return;
      const retryQueue = new WatcherRetryQueue();
      let queue = Promise.resolve();
      let flushTimer: ReturnType<typeof setTimeout> | undefined;

      const flushQueues = () => {
        queue = queue
          .then(async () => {
            const batch = retryQueue.takeReady(Date.now(), WATCHER_QUEUE_BATCH_LIMIT);
            if (!batch.length) return;
            let changed = false;
            const stale = batch.filter((item) => item.action === "stale");
            const upsert = batch.filter((item) => item.action === "upsert");
            const classify = batch.filter((item) => item.action === "classify");

            const reportFailure = (items: typeof batch, error: unknown) => {
              const message = readableError(error);
              for (const item of items) {
                const exhausted = retryQueue.markFailure(item);
                if (!disposed) onError?.(exhausted ? watcherRetryExhaustedMessage() : message);
              }
            };

            if (stale.length > 0) {
              try {
                changed = (await tauriApi.markFilesStaleByPaths(stale.map((item) => item.path))) > 0 || changed;
                stale.forEach((item) => retryQueue.markSuccess(item));
              } catch (error) {
                reportFailure(stale, error);
              }
            }
            let upserted = 0;
            if (upsert.length > 0) {
              try {
                upserted = await tauriApi.upsertFilesByPaths(upsert.map((item) => item.path));
                changed = upserted > 0 || changed;
                upsert.forEach((item) => retryQueue.markSuccess(item));
                if (upserted > 0) {
                  for (const item of upsert) {
                    const classification = retryQueue.enqueue(item.path, "classify");
                    if (classification) classify.push(classification);
                  }
                }
              } catch (error) {
                reportFailure(upsert, error);
              }
            }
            if (classify.length > 0) {
              try {
                const summary = await tauriApi.executeRulesForPaths(
                  classify.slice(0, WATCHER_CLASSIFY_LIMIT).map((item) => item.path),
                  rulesRef.current
                );
                changed = summary.updated > 0 || changed;
                classify.forEach((item) => retryQueue.markSuccess(item));
              } catch (error) {
                reportFailure(classify, error);
              }
            }
            if (changed && !disposed) await onRefreshData();
          })
          .catch((error) => {
            if (!disposed) onError?.(readableError(error));
          })
          .finally(() => {
            if (!disposed && retryQueue.hasReadyOrWaiting()) scheduleFlush();
          });
      };

      const scheduleFlush = () => {
        if (flushTimer !== undefined) clearTimeout(flushTimer);
        const retryDelay = retryQueue.nextRetryDelay();
        flushTimer = setTimeout(() => {
          flushTimer = undefined;
          flushQueues();
        }, retryDelay === 0 ? WATCHER_FLUSH_DELAY_MS : retryDelay ?? WATCHER_FLUSH_DELAY_MS);
      };

      void tauriApi.onFsEvent<FsWatchEvent>((payload) => {
        if (!payload || disposed) return;
        const snapshot = watcherQueueSnapshotFromEvent(payload);
        if (!snapshot.stale.length && !snapshot.upsert.length) return;
        snapshot.stale.forEach((path) => retryQueue.enqueue(path, "stale"));
        snapshot.upsert.forEach((path) => retryQueue.enqueue(path, "upsert"));
        scheduleFlush();
      }).then((unlisten) => {
        if (disposed) unlisten();
        else unlistenFs = unlisten;
      });
      void tauriApi.onFsWatcherWarning<FsWatcherWarningEvent>((payload) => warningHandler(payload)).then((unlisten) => {
        if (disposed) unlisten();
        else unlistenLegacyWarning = unlisten;
      });
    };

    const registerBackendProjection = () => {
      if (typeof tauriApi.listScanRoots === "function") {
        void tauriApi.listScanRoots().then((roots) => {
          if (disposed) return;
          let pending = false;
          for (const root of roots) {
            knownRootRevisions.set(root.id, root.revision);
            pending = pending || root.needsReconciliation || root.watcherRevision > root.watcherAppliedRevision;
          }
          useWatcherStatusStore.getState().hydrate(roots);
          if (pending) refreshProjection();
        }).catch((error) => {
          if (!disposed) onError?.(readableError(error));
        });
      }
      void tauriApi.onWatcherReconciliationStatus((payload) => {
        if (!payload || disposed) return;
        useWatcherStatusStore.getState().upsert(payload);
        const previousRevision = knownRootRevisions.get(payload.scanRootId);
        if (previousRevision !== undefined && payload.rootRevision <= previousRevision) return;
        const hasRevisionGap = previousRevision !== undefined && payload.rootRevision > previousRevision + 1;
        knownRootRevisions.set(payload.scanRootId, payload.rootRevision);
        if (payload.healthStatus === "permission_required") onError?.(watcherPermissionMessage());
        else if (payload.pending || payload.needsReconciliation) onError?.(watcherReconciliationMessage());
        if (hasRevisionGap) refreshProjection();
        refreshProjection();
      }).then((unlisten) => {
        if (disposed) unlisten();
        else unlistenStatus = unlisten;
      });
      void tauriApi.onFsWatcherWarning<FsWatcherWarningEvent>((payload) => warningHandler(payload)).then((unlisten) => {
        if (disposed) unlisten();
        else unlistenWarning = unlisten;
      });
    };

    if (typeof tauriApi.getRuntimeCapabilities !== "function") {
      registerLegacyAdapter();
    } else {
      void tauriApi.getRuntimeCapabilities().then((capabilities) => {
        if (disposed) return;
        if (capabilities.backendWatcherReconciliation !== false) registerBackendProjection();
        else registerLegacyAdapter();
      }).catch((error) => {
        if (!disposed) onError?.(readableError(error));
      });
    }

    return () => {
      disposed = true;
      if (statusRefreshTimer !== undefined) clearTimeout(statusRefreshTimer);
      unlistenStatus?.();
      unlistenWarning?.();
      unlistenFs?.();
      unlistenLegacyWarning?.();
    };
  }, [enabled, onError, onRefreshData]);
}

function watcherPartialIndexWarningMessage() {
  return makeTranslator(useAppStore.getState().language)("fsWatcherPartialIndexWarning");
}

function watcherRetryExhaustedMessage() {
  return makeTranslator(useAppStore.getState().language)("watcherRetryExhausted");
}

function watcherReconciliationMessage() {
  return makeTranslator(useAppStore.getState().language)("watcherRetryExhausted");
}

function watcherPermissionMessage() {
  return makeTranslator(useAppStore.getState().language)("libraryPermissionDesc");
}
