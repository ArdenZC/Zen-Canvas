// Browser presentation fixture only; native commands remain authoritative.
import type { ScanRootDto } from "./types";
import type { AutomationIntent, AutomationIntentDraft, AutomationRun, RunAutomationIntentRequest } from "../types/automation";
import type { OrganizationPlan } from "../types/domain";

type Owners = {
  roots: () => ScanRootDto[];
  fingerprint: (query: AutomationIntentDraft["scopeQuery"]) => string;
  snapshotRevision: () => number;
  createPlan: (intent: AutomationIntent, revision: number, runId: string) => OrganizationPlan;
};
export function createAutomationMock(owners: Owners) {
  const intents = new Map<string, AutomationIntent>();
  const runs = new Map<string, AutomationRun>();
  const copy = <T,>(value: T): T => structuredClone(value);
  const load = (id: string) => {
    const intent = intents.get(id);
    if (!intent) throw new Error("automation_intent_not_found");
    return intent;
  };
  const cas = (id: string, revision: number) => {
    const intent = load(id);
    if (intent.archivedAt) throw new Error("automation_intent_archived");
    if (intent.revision !== revision) throw new Error("automation_intent_revision_conflict");
    return intent;
  };
  const canonical = (draft: AutomationIntentDraft) => {
    if (draft.workflowKind !== "organize_plan" || draft.trigger.kind !== "manual" || draft.trigger.version !== 1 || draft.policy.version !== 1 || draft.policy.review !== "required" || draft.policy.autoExecute !== false) throw new Error("automation_contract_invalid");
    if (!draft.title.trim() || draft.title.trim().length > 120) throw new Error("automation_title_invalid");
    const query = copy(draft.scopeQuery);
    if (query.scope.kind !== "all_enabled_roots" && query.scope.kind !== "roots") throw new Error("automation_scope_invalid");
    if (query.scope.kind === "roots") {
      query.scope.scanRootIds = [...new Set(query.scope.scanRootIds)].sort();
      if (!query.scope.scanRootIds.length) throw new Error("automation_scope_invalid");
      for (const id of query.scope.scanRootIds) {
        const root = owners.roots().find((item) => item.id === id);
        if (!root?.enabled || root.healthStatus !== "healthy") throw new Error("automation_scope_unavailable");
      }
    }
    query.text = query.text?.trim() || null;
    return { ...copy(draft), title: draft.title.trim(), scopeQuery: query };
  };
  return (command: string, args?: Record<string, unknown>): unknown => {
    switch (command) {
      case "list_automation_intents": return copy([...intents.values()].filter((item) => !item.archivedAt).reverse());
      case "get_automation_intent": return copy(load(String(args?.intentId)));
      case "list_automation_runs": return copy([...runs.values()].filter((item) => !args?.intentId || item.intentId === args.intentId).reverse());
      case "create_automation_intent": {
        const draft = canonical(args?.draft as AutomationIntentDraft);
        const now = Math.floor(Date.now() / 1000);
        const intent: AutomationIntent = { ...draft, id: crypto.randomUUID(), revision: 1, scopeFingerprint: owners.fingerprint(draft.scopeQuery), createdAt: now, updatedAt: now, archivedAt: null };
        intents.set(intent.id, intent); return copy(intent);
      }
      case "update_automation_intent": {
        const request = args?.request as { intentId: string; expectedRevision: number; draft: AutomationIntentDraft };
        const old = cas(request.intentId, request.expectedRevision);
        const draft = canonical(request.draft);
        const intent = { ...old, ...draft, revision: old.revision + 1, scopeFingerprint: owners.fingerprint(draft.scopeQuery), updatedAt: Math.floor(Date.now() / 1000) };
        intents.set(intent.id, intent); return copy(intent);
      }
      case "set_automation_intent_enabled":
      case "archive_automation_intent": {
        const request = args?.request as { intentId: string; expectedRevision: number; enabled: boolean };
        const old = cas(request.intentId, request.expectedRevision);
        const intent = { ...old, enabled: command === "archive_automation_intent" ? false : request.enabled, revision: old.revision + 1, updatedAt: Math.floor(Date.now() / 1000), archivedAt: command === "archive_automation_intent" ? Math.floor(Date.now() / 1000) : null };
        intents.set(intent.id, intent); return copy(intent);
      }
      case "run_automation_intent_manual": {
        const request = args?.request as RunAutomationIntentRequest;
        const intent = cas(request.intentId, request.expectedIntentRevision);
        if (!intent.enabled || request.version !== 1 || !request.requestKey) throw new Error("automation_request_invalid");
        const previous = runs.get(request.requestKey);
        if (previous) {
          if (previous.intentId !== intent.id || previous.intentRevision !== intent.revision) throw new Error("automation_request_key_conflict");
          return copy(previous);
        }
        const now = Math.floor(Date.now() / 1000);
        const run: AutomationRun = { id: crypto.randomUUID(), requestKey: request.requestKey, intentId: intent.id, intentRevision: intent.revision, triggerKind: "manual", scopeFingerprint: intent.scopeFingerprint, librarySnapshotRevision: null, status: "blocked", resultPlanId: null, queuedAnalysisCount: 0, requiresPlanRefresh: false, analysisBlockerCode: null, errorCode: null, createdAt: now, completedAt: now };
        try {
          canonical(intent);
          const revision = owners.snapshotRevision();
          run.librarySnapshotRevision = revision;
          const plan = owners.createPlan(intent, revision, run.id);
          run.resultPlanId = plan.id;
          run.requiresPlanRefresh = plan.summary.needsAnalysis > 0;
          const presentation = new URLSearchParams(globalThis.location?.search ?? "").get("pm02a-analysis");
          run.status = run.requiresPlanRefresh && presentation !== "queued" ? "blocked" : "completed";
          run.queuedAnalysisCount = run.requiresPlanRefresh && presentation === "queued" ? plan.summary.needsAnalysis : 0;
          run.analysisBlockerCode = run.status === "blocked" ? "managed_cloud_ai_consent_required" : null;
        } catch { run.errorCode = "automation_scope_unavailable"; }
        runs.set(request.requestKey, run); return copy(run);
      }
      default: throw new Error("automation_mock_command_unknown");
    }
  };
}
