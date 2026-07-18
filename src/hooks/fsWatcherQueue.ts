export interface FsWatchEvent {
  eventType?: string;
  event_type?: string;
  paths?: string[];
  path?: string;
  stalePaths?: string[];
  stale_paths?: string[];
  upsertPaths?: string[];
  upsert_paths?: string[];
  deleted?: boolean;
  removed?: boolean;
  isDeleted?: boolean;
}

export type FsWatchEventAction = "stale" | "upsert" | "ignore";

export type WatcherRetryAction = "stale" | "upsert" | "classify";
export type WatcherRetryState = "pending" | "processing" | "retry_wait" | "permanently_failed";

export interface WatcherRetryItem {
  path: string;
  action: WatcherRetryAction;
  attempts: number;
  generation: number;
  nextRetryAt: number;
  state: WatcherRetryState;
}

export const WATCHER_RETRY_DELAYS_MS = [250, 500, 1000, 2000] as const;
export const WATCHER_RETRY_MAX_DELAY_MS = 10_000;
export const WATCHER_MAX_ATTEMPTS = 8;

/**
 * A small stateful queue used by the React watcher adapter. Items are retained
 * until the corresponding RPC succeeds; a newer filesystem event replaces the
 * older action and invalidates its retry generation.
 */
export class WatcherRetryQueue {
  private readonly items = new Map<string, WatcherRetryItem>();
  private generation = 0;

  enqueue(path: string, action: WatcherRetryAction, now = Date.now()): WatcherRetryItem | undefined {
    const normalized = path.trim();
    if (!normalized) return undefined;
    this.generation += 1;
    const item: WatcherRetryItem = {
      path: normalized,
      action,
      attempts: 0,
      generation: this.generation,
      nextRetryAt: now,
      state: "pending"
    };
    this.items.set(normalized, item);
    return item;
  }

  takeReady(now = Date.now(), limit = WATCHER_QUEUE_BATCH_LIMIT): WatcherRetryItem[] {
    const ready = Array.from(this.items.values())
      .filter((item) => item.state !== "processing" && item.state !== "permanently_failed" && item.nextRetryAt <= now)
      .slice(0, Math.max(1, Math.floor(limit)));
    for (const item of ready) {
      const current = this.items.get(item.path);
      if (current?.generation === item.generation && current.action === item.action) {
        current.state = "processing";
      }
    }
    return ready;
  }

  markSuccess(item: WatcherRetryItem) {
    const current = this.items.get(item.path);
    if (!current || current.generation !== item.generation || current.action !== item.action) return false;
    this.items.delete(item.path);
    return true;
  }

  markFailure(item: WatcherRetryItem, now = Date.now()) {
    const current = this.items.get(item.path);
    if (!current || current.generation !== item.generation || current.action !== item.action) return false;
    current.attempts += 1;
    if (current.attempts >= WATCHER_MAX_ATTEMPTS) {
      current.state = "permanently_failed";
      current.nextRetryAt = Number.POSITIVE_INFINITY;
      return true;
    }
    const delayIndex = Math.min(current.attempts - 1, WATCHER_RETRY_DELAYS_MS.length - 1);
    const delay = Math.min(
      WATCHER_RETRY_MAX_DELAY_MS,
      WATCHER_RETRY_DELAYS_MS[delayIndex] ?? WATCHER_RETRY_MAX_DELAY_MS
    );
    current.state = "retry_wait";
    current.nextRetryAt = now + delay;
    return false;
  }

  requeue(item: WatcherRetryItem, now = Date.now()) {
    const current = this.items.get(item.path);
    if (!current || current.generation !== item.generation || current.action !== item.action) return false;
    current.state = "pending";
    current.nextRetryAt = now;
    return true;
  }

  nextRetryDelay(now = Date.now(), fallback = WATCHER_RETRY_MAX_DELAY_MS) {
    const next = Array.from(this.items.values())
      .filter((item) => item.state !== "processing" && item.state !== "permanently_failed")
      .reduce<number | null>((minimum, item) => Math.min(minimum ?? item.nextRetryAt, item.nextRetryAt), null);
    if (next === null) return null;
    return Math.max(0, Math.min(fallback, next - now));
  }

  hasReadyOrWaiting() {
    return Array.from(this.items.values()).some((item) => item.state !== "permanently_failed");
  }

  itemsForTest() {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }
}

export interface WatcherQueueSnapshot {
  stale: string[];
  upsert: string[];
}

export const WATCHER_QUEUE_BATCH_LIMIT = 500;

export function classifyFsWatchEvent(payload: FsWatchEvent): FsWatchEventAction {
  if (isRemoveEvent(payload)) return "stale";
  if (isUpsertEvent(payload)) return "upsert";
  return "ignore";
}

export function eventPaths(payload: FsWatchEvent): string[] {
  const paths = Array.isArray(payload.paths) ? payload.paths : payload.path ? [payload.path] : [];
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
}

export function mergeWatcherQueues(
  staleQueue: Set<string>,
  upsertQueue: Set<string>
): WatcherQueueSnapshot {
  const stale = Array.from(staleQueue);
  const staleSet = new Set(stale);
  const upsert = Array.from(upsertQueue).filter((path) => !staleSet.has(path));

  return { stale, upsert };
}

export function takeWatcherQueueBatch(
  staleQueue: Set<string>,
  upsertQueue: Set<string>,
  limit = WATCHER_QUEUE_BATCH_LIMIT
): WatcherQueueSnapshot {
  const boundedLimit = Math.max(1, Math.floor(limit));
  const stale: string[] = [];
  const upsert: string[] = [];

  const initialUpsertLimit = Math.ceil(boundedLimit / 2);
  takeUpsertFromQueue(upsertQueue, staleQueue, upsert, initialUpsertLimit);
  takeFromQueue(staleQueue, stale, boundedLimit - upsert.length);
  takeUpsertFromQueue(upsertQueue, staleQueue, upsert, boundedLimit - stale.length - upsert.length);

  return { stale, upsert };
}

export function watcherQueueSnapshotFromEvent(payload: FsWatchEvent): WatcherQueueSnapshot {
  const explicitStale = normalizePathList(payload.stalePaths ?? payload.stale_paths);
  const explicitUpsert = normalizePathList(payload.upsertPaths ?? payload.upsert_paths);

  if (explicitStale.length > 0 || explicitUpsert.length > 0) {
    return mergeWatcherQueues(new Set(explicitStale), new Set(explicitUpsert));
  }

  const paths = eventPaths(payload);
  const action = classifyFsWatchEvent(payload);
  if (action === "stale") {
    return { stale: paths, upsert: [] };
  }
  if (action === "upsert") {
    return { stale: [], upsert: paths };
  }
  return { stale: [], upsert: [] };
}

function isRemoveEvent(payload: FsWatchEvent): boolean {
  const eventType = eventTypeText(payload);
  return (
    eventType.includes("remove") ||
    eventType.includes("delete") ||
    payload.deleted === true ||
    payload.removed === true ||
    payload.isDeleted === true
  );
}

function isUpsertEvent(payload: FsWatchEvent): boolean {
  const eventType = eventTypeText(payload);
  return (
    eventType.includes("create") ||
    eventType.includes("modif") ||
    eventType.includes("rename") ||
    eventType.includes("change")
  );
}

function eventTypeText(payload: FsWatchEvent): string {
  return String(payload.eventType ?? payload.event_type ?? "").toLowerCase();
}

function normalizePathList(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  return Array.from(
    new Set(paths.filter((path): path is string => typeof path === "string").map((path) => path.trim()).filter(Boolean))
  );
}

function takeFromQueue(queue: Set<string>, target: string[], count: number) {
  if (count <= 0) return;
  let taken = 0;
  for (const path of queue) {
    target.push(path);
    queue.delete(path);
    taken += 1;
    if (taken >= count) return;
  }
}

function takeUpsertFromQueue(
  upsertQueue: Set<string>,
  staleQueue: Set<string>,
  target: string[],
  count: number
) {
  if (count <= 0) return;
  let taken = 0;
  for (const path of upsertQueue) {
    upsertQueue.delete(path);
    if (staleQueue.has(path)) {
      continue;
    }
    target.push(path);
    taken += 1;
    if (taken >= count) return;
  }
}
