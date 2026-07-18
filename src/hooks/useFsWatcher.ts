import { useEffect, useRef } from "react";
import { tauriApi } from "../api/tauriApi";
import { makeTranslator } from "../i18n";
import { useAppStore } from "../store/useAppStore";
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
    let queue = Promise.resolve();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const retryQueue = new WatcherRetryQueue();

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
              if (!disposed) {
                onError?.(exhausted ? watcherRetryExhaustedMessage() : message);
              }
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
          if (changed && !disposed) {
            await onRefreshData();
          }
        })
        .catch((error) => {
          if (!disposed) {
            onError?.(readableError(error));
          }
        })
        .finally(() => {
          if (!disposed && retryQueue.hasReadyOrWaiting()) {
            scheduleFlush();
          }
        });
    };

    const scheduleFlush = () => {
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
      }
      const retryDelay = retryQueue.nextRetryDelay();
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        flushQueues();
      }, retryDelay === 0 ? WATCHER_FLUSH_DELAY_MS : retryDelay ?? WATCHER_FLUSH_DELAY_MS);
    };

    const unlistenPromise = tauriApi.onFsEvent<FsWatchEvent>((payload) => {
      if (!payload) return;

      const snapshot = watcherQueueSnapshotFromEvent(payload);
      if (!snapshot.stale.length && !snapshot.upsert.length) return;

      for (const path of snapshot.stale) {
        retryQueue.enqueue(path, "stale");
      }
      for (const path of snapshot.upsert) {
        retryQueue.enqueue(path, "upsert");
      }
      scheduleFlush();
    });
    const warningUnlistenPromise = tauriApi.onFsWatcherWarning<FsWatcherWarningEvent>((payload) => {
      if (!payload || disposed) return;
      onError?.(watcherPartialIndexWarningMessage());
    });

    return () => {
      disposed = true;
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
      }
      void unlistenPromise.then((unlisten) => unlisten());
      void warningUnlistenPromise.then((unlisten) => unlisten());
    };
  }, [enabled, onError, onRefreshData]);
}

function watcherPartialIndexWarningMessage() {
  return makeTranslator(useAppStore.getState().language)("fsWatcherPartialIndexWarning");
}

function watcherRetryExhaustedMessage() {
  return makeTranslator(useAppStore.getState().language)("watcherRetryExhausted");
}
