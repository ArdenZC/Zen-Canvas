import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { tauriApi } from "../api/tauriApi";
import type { Rule } from "../types/domain";
import { readableError } from "../utils/viewHelpers";
import {
  classifyFsWatchEvent,
  eventPaths,
  mergeWatcherQueues,
  type FsWatchEvent
} from "./fsWatcherQueue";

interface FsWatcherOptions {
  onRefreshData: () => Promise<void>;
  onError?: (message: string) => void;
  rules?: Rule[];
}

const WATCHER_FLUSH_DELAY_MS = 500;
const WATCHER_CLASSIFY_LIMIT = 500;
const EMPTY_RULES: Rule[] = [];

export function useFsWatcher({ onRefreshData, onError, rules = EMPTY_RULES }: FsWatcherOptions) {
  useEffect(() => {
    let disposed = false;
    let queue = Promise.resolve();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let staleQueue = new Set<string>();
    let upsertQueue = new Set<string>();

    const flushQueues = () => {
      queue = queue
        .then(async () => {
          const snapshot = mergeWatcherQueues(staleQueue, upsertQueue);
          staleQueue = new Set();
          upsertQueue = new Set();

          let changed = false;
          if (snapshot.stale.length > 0) {
            changed = (await tauriApi.markFilesStaleByPaths(snapshot.stale)) > 0 || changed;
          }
          let upserted = 0;
          if (snapshot.upsert.length > 0) {
            upserted = await tauriApi.upsertFilesByPaths(snapshot.upsert);
            changed = upserted > 0 || changed;
          }
          if (upserted > 0 && snapshot.upsert.length > 0) {
            try {
              const summary = await tauriApi.executeRulesForPaths(
                snapshot.upsert.slice(0, WATCHER_CLASSIFY_LIMIT),
                rules
              );
              changed = summary.updated > 0 || changed;
            } catch (error) {
              if (!disposed) {
                onError?.(readableError(error));
              }
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
        });
    };

    const scheduleFlush = () => {
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
      }
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        flushQueues();
      }, WATCHER_FLUSH_DELAY_MS);
    };

    const unlistenPromise = listen<FsWatchEvent>("fs-event", (event) => {
      const payload = event.payload;
      if (!payload) return;

      const paths = eventPaths(payload);
      if (!paths.length) return;
      const action = classifyFsWatchEvent(payload);
      if (action === "ignore") return;

      for (const path of paths) {
        if (action === "stale") {
          staleQueue.add(path);
        } else {
          upsertQueue.add(path);
          staleQueue.delete(path);
        }
      }
      scheduleFlush();
    });

    return () => {
      disposed = true;
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
      }
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onError, onRefreshData, rules]);
}
