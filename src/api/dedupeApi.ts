import { invokeCommand, listenTo, type EventHandler } from "./core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { DedupeGroup, DedupeGroupMember, DedupeGroupPage, DedupeRun, StartDedupeRunRequest } from "../types/domain";
import type { DedupeProgressPayload } from "./types";

export const dedupeApi = {
  startDedupeRun(request: StartDedupeRunRequest): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("start_dedupe_run", { request });
  },
  retryDedupeRun(runId: string): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("retry_dedupe_run", { runId });
  },
  cancelDedupeRun(runId: string): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("cancel_dedupe_run", { runId });
  },
  getDedupeRun(runId: string): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("get_dedupe_run", { runId });
  },
  listDedupeRuns(limit = 20): Promise<DedupeRun[]> {
    return invokeCommand<DedupeRun[]>("list_dedupe_runs", { limit });
  },
  getActiveDedupeRun(): Promise<DedupeRun | null> {
    return invokeCommand<DedupeRun | null>("get_active_dedupe_run");
  },
  listDuplicateGroups(cursor?: string | null, limit = 50): Promise<DedupeGroupPage> {
    return invokeCommand<DedupeGroupPage>("list_duplicate_groups", { cursor: cursor ?? null, limit });
  },
  getDuplicateGroup(groupId: string): Promise<DedupeGroup | null> {
    return invokeCommand<DedupeGroup | null>("get_duplicate_group", { groupId });
  },
  listDuplicateGroupMembers(groupId: string): Promise<DedupeGroupMember[]> {
    return invokeCommand<DedupeGroupMember[]>("list_duplicate_group_members", { groupId });
  },
  getFileDuplicateMembership(fileId: string): Promise<DedupeGroup[]> {
    return invokeCommand<DedupeGroup[]>("get_file_duplicate_membership", { fileId });
  },
  onDedupeRunUpdated(handler: EventHandler<DedupeRun>): Promise<UnlistenFn> {
    return listenTo("dedupe-run-updated", handler);
  }
};

export type DedupeApi = typeof dedupeApi;
