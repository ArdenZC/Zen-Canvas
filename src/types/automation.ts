import type { FileQuerySpecV2 } from "./domain";

export type AutomationScopeQuery = FileQuerySpecV2 & {
  scope: { kind: "all_enabled_roots" } | { kind: "roots"; scanRootIds: string[] };
};
export type AutomationTrigger =
  | { version: 2; kind: "manual" }
  | { version: 2; kind: "managed_scope_change" }
  | { version: 2; kind: "schedule"; timeZone: string; localTime: string; weekdays: number[] };
export interface AutomationIntentDraft {
  title: string;
  workflowKind: "organize_plan";
  scopeQuery: AutomationScopeQuery;
  trigger: AutomationTrigger;
  policy: { version: 1; review: "required"; autoExecute: false };
  enabled: boolean;
}
export interface AutomationIntent extends AutomationIntentDraft {
  id: string;
  revision: number;
  scopeFingerprint: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  triggerState?: { nextDueAt: number | null; pendingEventDueAt: number | null; lastErrorCode: string | null } | null;
}
export interface AutomationRun {
  id: string;
  requestKey: string;
  intentId: string;
  intentRevision: number;
  triggerKind: AutomationTrigger["kind"];
  triggerContext?: Record<string, unknown>;
  scopeFingerprint: string;
  librarySnapshotRevision: number | null;
  status: "completed" | "blocked" | "failed";
  resultPlanId: string | null;
  queuedAnalysisCount: number;
  requiresPlanRefresh: boolean;
  analysisBlockerCode: string | null;
  errorCode: string | null;
  createdAt: number;
  completedAt: number;
}
export interface RunAutomationIntentRequest {
  version: 1;
  intentId: string;
  expectedIntentRevision: number;
  requestKey: string;
}
