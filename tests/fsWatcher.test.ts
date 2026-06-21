import { describe, expect, it } from "vitest";
import {
  classifyFsWatchEvent,
  mergeWatcherQueues,
  type FsWatchEvent
} from "../src/hooks/fsWatcherQueue";

describe("fs watcher event routing", () => {
  it("routes remove events to the stale queue", () => {
    expect(classifyFsWatchEvent({ eventType: "remove", paths: ["a.txt"] })).toBe("stale");
    expect(classifyFsWatchEvent({ deleted: true, path: "a.txt" })).toBe("stale");
  });

  it("routes modified events to the upsert queue", () => {
    expect(classifyFsWatchEvent({ eventType: "modified", paths: ["a.txt"] })).toBe("upsert");
    expect(classifyFsWatchEvent({ event_type: "changed", path: "a.txt" })).toBe("upsert");
  });

  it("ignores read-only and unknown events", () => {
    expect(classifyFsWatchEvent({ eventType: "accessed", paths: ["a.txt"] })).toBe("ignore");
    expect(classifyFsWatchEvent({ eventType: "other", paths: ["a.txt"] })).toBe("ignore");
  });

  it("lets upsert win when the same path appears in both queues", () => {
    const merged = mergeWatcherQueues(new Set(["a.txt", "stale.txt"]), new Set(["a.txt"]));

    expect(merged.stale).toEqual(["stale.txt"]);
    expect(merged.upsert).toEqual(["a.txt"]);
  });
});
