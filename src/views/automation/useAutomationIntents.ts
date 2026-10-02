import { useCallback, useEffect, useRef, useState } from "react";
import { automationApi } from "../../api/automationApi";
import type { AutomationIntent, AutomationIntentDraft, AutomationRun, RunAutomationIntentRequest } from "../../types/automation";

// Action-driven only. Receipt retries retain their key until a definite response.
export function useAutomationIntents() {
  const [intents, setIntents] = useState<AutomationIntent[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const retryRequests = useRef(new Map<string, RunAutomationIntentRequest>());
  const load = useCallback(async () => {
    const [nextIntents, nextRuns] = await Promise.all([automationApi.listAutomationIntents(), automationApi.listAutomationRuns()]);
    if (mounted.current) { setIntents(nextIntents); setRuns(nextRuns); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load().catch(() => { if (mounted.current) setError("load"); }).finally(() => { if (mounted.current) setLoading(false); });
    let disposed=false;
    let unlisten:(()=>void)|undefined;
    void automationApi.onAutomationUpdated(() => { void load().catch(() => { if (mounted.current) setError("load"); }); }).then((stop)=>{if(disposed)stop();else unlisten=stop;}).catch(()=>{ /* Explicit Reload remains available if event transport is unavailable. */ });
    return () => { disposed=true; unlisten?.(); mounted.current = false; };
  }, [load]);
  const act = useCallback(async (id: string, operation: () => Promise<unknown>) => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(id); setError(null);
    try { await operation(); await load(); return true; }
    catch (cause) {
      const text = String(cause);
      if (mounted.current) setError(text.includes("revision") ? "revision" : "action");
      // Re-read CAS state, but leave the editor open so the user can review changes.
      try { await load(); } catch { /* Original action failure remains visible. */ }
      return false;
    } finally { inFlight.current = false; if (mounted.current) setBusy(null); }
  }, [load]);
  return {
    intents, runs, loading, busy, error,
    reload: () => act("reload", load),
    save: (draft: AutomationIntentDraft, intent?: AutomationIntent) => act("save", () => intent
      ? automationApi.updateAutomationIntent({ intentId: intent.id, expectedRevision: intent.revision, draft })
      : automationApi.createAutomationIntent(draft)),
    toggle: (intent: AutomationIntent) => act(intent.id, () => automationApi.setAutomationIntentEnabled({ intentId: intent.id, expectedRevision: intent.revision, enabled: !intent.enabled })),
    archive: (intent: AutomationIntent) => act(intent.id, () => automationApi.archiveAutomationIntent({ intentId: intent.id, expectedRevision: intent.revision })),
    run: (intent: AutomationIntent) => act(intent.id, async () => {
      const identity = `${intent.id}:${intent.revision}`;
      const request = retryRequests.current.get(identity) ?? { version: 1, intentId: intent.id, expectedIntentRevision: intent.revision, requestKey: crypto.randomUUID() };
      retryRequests.current.set(identity, request);
      await automationApi.runAutomationIntentManual(request);
      retryRequests.current.delete(identity);
    })
  };
}
