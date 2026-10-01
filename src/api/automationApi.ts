import { invokeCommand } from "./core";
import type { AutomationIntent, AutomationIntentDraft, AutomationRun, RunAutomationIntentRequest } from "../types/automation";

export const automationApi = {
  listAutomationIntents: (): Promise<AutomationIntent[]> => invokeCommand("list_automation_intents"),
  getAutomationIntent: (intentId: string): Promise<AutomationIntent> => invokeCommand("get_automation_intent", { intentId }),
  listAutomationRuns: (intentId?: string): Promise<AutomationRun[]> => invokeCommand("list_automation_runs", { intentId: intentId ?? null }),
  createAutomationIntent: (draft: AutomationIntentDraft): Promise<AutomationIntent> => invokeCommand("create_automation_intent", { draft }),
  updateAutomationIntent: (request: { intentId: string; expectedRevision: number; draft: AutomationIntentDraft }): Promise<AutomationIntent> => invokeCommand("update_automation_intent", { request }),
  setAutomationIntentEnabled: (request: { intentId: string; expectedRevision: number; enabled: boolean }): Promise<AutomationIntent> => invokeCommand("set_automation_intent_enabled", { request }),
  archiveAutomationIntent: (request: { intentId: string; expectedRevision: number }): Promise<AutomationIntent> => invokeCommand("archive_automation_intent", { request }),
  runAutomationIntentManual: (request: RunAutomationIntentRequest): Promise<AutomationRun> => invokeCommand("run_automation_intent_manual", { request })
};
