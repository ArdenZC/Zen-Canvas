// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { automationApi } from "../src/api/automationApi";
import { defaultFileLibraryQuerySpec, useFileLibraryQueryStore } from "../src/store/useFileLibraryV2Store";
import { useAppStore } from "../src/store/useAppStore";
import { AutomationWorkspace } from "../src/views/automation/AutomationWorkspace";
import type { AutomationIntent, AutomationRun } from "../src/types/automation";

const mocks = vi.hoisted(() => ({ setView: vi.fn(), openPlan: vi.fn(), language: "en" as "en" | "zh", owner: { activePlan: { id: "plan" }, activePlanState: "loaded" } }));
vi.mock("../src/contexts/AppContexts", async () => {
  const { makeTranslator } = await import("../src/i18n");
  return { useI18nContext: () => ({ t: makeTranslator(mocks.language) }), useNavigationContext: () => ({ setView: mocks.setView }) };
});
vi.mock("../src/views/rules/RulesView", () => ({ RulesView: () => <div>Existing Rules workspace</div> }));
vi.mock("../src/store/useOrganizationPlanStore", () => ({ useOrganizationPlanStore: { getState: () => ({ ...mocks.owner, openPlan: mocks.openPlan }) } }));
vi.mock("../src/api/automationApi", () => ({ automationApi: Object.fromEntries(["listAutomationIntents", "listAutomationRuns", "createAutomationIntent", "updateAutomationIntent", "setAutomationIntentEnabled", "archiveAutomationIntent", "runAutomationIntentManual", "onAutomationUpdated"].map((name) => [name, vi.fn()])) }));

const intent: AutomationIntent = { id: "intent", revision: 1, title: "Review documents", workflowKind: "organize_plan", scopeQuery: { ...defaultFileLibraryQuerySpec, scope: { kind: "all_enabled_roots" } }, scopeFingerprint: "fingerprint", trigger: { version: 2, kind: "manual" }, policy: { version: 1, review: "required", autoExecute: false }, enabled: true, createdAt: 1, updatedAt: 1, archivedAt: null };
const run: AutomationRun = { id: "run", requestKey: "key", intentId: intent.id, intentRevision: 1, triggerKind: "manual", scopeFingerprint: "fingerprint", librarySnapshotRevision: 5, status: "completed", resultPlanId: "plan", queuedAnalysisCount: 0, requiresPlanRefresh: false, analysisBlockerCode: null, errorCode: null, createdAt: 1, completedAt: 1 };
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === label)!;
const click = async (label: string) => { await act(async () => button(label).click()); };
const input = async (index: number, value: string) => { await act(async () => {
  const node = document.querySelectorAll<HTMLInputElement>('input:not([type="radio"]):not([type="checkbox"])')[index];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
  node.dispatchEvent(new InputEvent("input", { bubbles: true }));
}); };

describe("PM-02A Intent-first workspace", () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(automationApi.onAutomationUpdated).mockResolvedValue(() => undefined);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
    mocks.language = "en";
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="app-shell-content"><div id="test-root"></div></div>';
    root = createRoot(document.getElementById("test-root")!);
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([]);
    vi.mocked(automationApi.listAutomationRuns).mockResolvedValue([]);
    useFileLibraryQueryStore.setState({ spec: defaultFileLibraryQuerySpec });
    useAppStore.setState({ view: "scanner", automationSurface: "intents" });
  });
  afterEach(() => { act(() => root.unmount()); resetModalInfrastructureForTests(); document.body.innerHTML = ""; });
  const render = async () => { await act(async () => root.render(<AutomationWorkspace />)); };
  it("shows an empty state, creates a fixed-policy reusable query and restores keyboard focus", async () => {
    await render(); expect(document.body.textContent).toContain("Create your first automation intent");
    const origin = button("Create intent"); origin.focus(); await click("Create intent");
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement?.tagName).toBe("INPUT");
    await input(0, "Review docs"); await input(1, "annual");
    vi.mocked(automationApi.createAutomationIntent).mockResolvedValue(intent);
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([intent]);
    await act(async () => document.querySelector<HTMLFormElement>("form")!.requestSubmit());
    expect(automationApi.createAutomationIntent).toHaveBeenCalledWith(expect.objectContaining({ title: "Review docs", scopeQuery: expect.objectContaining({ text: "annual", scope: { kind: "all_enabled_roots" } }), trigger: { version: 2, kind: "manual" }, policy: { version: 1, review: "required", autoExecute: false } }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(origin);
  });
  it("rejects current-scan reuse and requires roots for a selected scope", async () => {
    await render(); await click("Create intent"); await input(0, "Scope test");
    useFileLibraryQueryStore.setState({ spec: { ...defaultFileLibraryQuerySpec, scope: { kind: "current_scan", scanSessionId: "temporary" } } });
    await click("Use current Library filters"); expect(document.body.textContent).toContain("current scan is temporary");
    await act(async () => document.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click());
    expect(button("Save").disabled).toBe(true);
    expect(automationApi.createAutomationIntent).not.toHaveBeenCalled();
  });
  it("pauses and enables through CAS, with stale conflicts retaining the editor", async () => {
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([intent]); await render();
    vi.mocked(automationApi.setAutomationIntentEnabled).mockResolvedValue({ ...intent, enabled: false, revision: 2 });
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([{ ...intent, enabled: false, revision: 2 }]);
    await click("Pause"); expect(automationApi.setAutomationIntentEnabled).toHaveBeenCalledWith({ intentId: "intent", expectedRevision: 1, enabled: false });
    expect(button("Generate plan").disabled).toBe(true);
    await click("Enable"); expect(automationApi.setAutomationIntentEnabled).toHaveBeenLastCalledWith({ intentId: "intent", expectedRevision: 2, enabled: true });
    await click("Edit intent"); await input(0, "Changed");
    vi.mocked(automationApi.updateAutomationIntent).mockRejectedValue(new Error("automation_intent_revision_conflict"));
    await act(async () => document.querySelector<HTMLFormElement>("form")!.requestSubmit());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull(); expect(document.body.textContent).toContain("intent changed during another action");
  });
  it("suppresses duplicate clicks and reuses the request key after an uncertain response", async () => {
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([intent]); await render();
    let reject!: (reason: Error) => void;
    vi.mocked(automationApi.runAutomationIntentManual).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await act(async () => { button("Generate plan").click(); button("Generate plan")?.click(); });
    expect(automationApi.runAutomationIntentManual).toHaveBeenCalledTimes(1); expect(document.body.textContent).toContain("Generating a plan from the current index");
    await act(async () => reject(new Error("transport lost")));
    const first = vi.mocked(automationApi.runAutomationIntentManual).mock.calls[0][0];
    vi.mocked(automationApi.runAutomationIntentManual).mockResolvedValue(run);
    vi.mocked(automationApi.listAutomationRuns).mockResolvedValue([run]); await click("Generate plan");
    expect(automationApi.runAutomationIntentManual).toHaveBeenLastCalledWith(first);
    expect(document.body.textContent).toContain("Plan generated");
    await click("Open plan"); expect(mocks.openPlan).toHaveBeenCalledWith("plan"); expect(mocks.setView).toHaveBeenCalledWith("organize");
  });
  it("keeps Intents as the default, opens Advanced Policies explicitly, preserves focus and resets on ordinary re-entry", async () => {
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([intent]);
    vi.mocked(automationApi.listAutomationRuns).mockResolvedValue([{ ...run, requiresPlanRefresh: true, queuedAnalysisCount: 1 }]); await render();
    expect(button("Intents").getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).toContain("Analysis requested"); expect(document.body.textContent).toContain("Refresh the plan in Organize");
    vi.mocked(automationApi.listAutomationRuns).mockResolvedValue([{ ...run, status: "blocked", requiresPlanRefresh: true, analysisBlockerCode: "managed_cloud_ai_consent_required" }]); await click("Refresh");
    expect(document.body.textContent).toContain("Needs attention"); expect(document.body.textContent).toContain("cloud consent settings");
    vi.mocked(automationApi.listAutomationRuns).mockResolvedValue([{ ...run, status: "blocked", requiresPlanRefresh: true, analysisBlockerCode: "automation_analysis_admission_unconfirmed" }]); await click("Refresh");
    expect(document.body.textContent).toContain("Analysis admission is unconfirmed");
    const advanced = button("Advanced Policies");
    advanced.focus();
    await click("Advanced Policies");
    expect(document.body.textContent).toContain("deterministic Rule Repository V2 policies");
    expect(document.body.textContent).toContain("Existing Rules workspace");
    expect(advanced.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(advanced);
    button("Intents").focus();
    await click("Intents");
    expect(button("Intents").getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(button("Intents"));
    await click("Advanced Policies");
    await act(async () => useAppStore.getState().setView("automation"));
    expect(useAppStore.getState().view).toBe("automation");
    expect(useAppStore.getState().automationSurface).toBe("intents");
    expect(button("Intents").getAttribute("aria-pressed")).toBe("true");
    expect(automationApi.createAutomationIntent).not.toHaveBeenCalled();
    expect(automationApi.updateAutomationIntent).not.toHaveBeenCalled();
    expect(automationApi.archiveAutomationIntent).not.toHaveBeenCalled();
    expect(automationApi.runAutomationIntentManual).not.toHaveBeenCalled();
  });
  it("renders bilingual fixed-policy copy with no automatic-execution controls", async () => {
    mocks.language = "zh"; await render(); expect(document.body.textContent).toContain("自动文件更改：绝不");
    expect(document.body.textContent).toContain("必须审核");
    expect(document.body.textContent).toContain("高级策略");
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(makeTranslator("en")("automationFixedPolicy")).toContain("Automatic file changes: Never");
  });
  it("PM-02B edits a weekday schedule with explicit zone and retains manual Run now", async () => {
    await render(); await click("Create intent"); await input(0,"Scheduled review");
    const choose = async (index: number, value: string) => act(async () => {
      const select=document.querySelectorAll<HTMLSelectElement>("select")[index];
      select.value=value; select.dispatchEvent(new Event("change",{bubbles:true}));
    });
    await choose(0,"schedule"); await choose(1,"weekdays");
    await input(3,"America/Los_Angeles");
    const scheduled={...intent,trigger:{version:2 as const,kind:"schedule" as const,timeZone:"America/Los_Angeles",localTime:"09:00",weekdays:[1,2,3,4,5]}};
    vi.mocked(automationApi.createAutomationIntent).mockResolvedValue(scheduled);
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([scheduled]);
    await act(async()=>document.querySelector<HTMLFormElement>("form")!.requestSubmit());
    expect(automationApi.createAutomationIntent).toHaveBeenCalledWith(expect.objectContaining({trigger:scheduled.trigger}));
    vi.mocked(automationApi.runAutomationIntentManual).mockResolvedValue(run);
    await click("Generate plan"); expect(automationApi.runAutomationIntentManual).toHaveBeenCalled();
  });
  it("PM-02B projects review skip/source and deferred state from backend events", async () => {
    let changed!:()=>void; const unlisten=vi.fn();
    vi.mocked(automationApi.onAutomationUpdated).mockImplementation(async handler=>{changed=handler;return unlisten;});
    const eventIntent={...intent,trigger:{version:2 as const,kind:"managed_scope_change" as const},triggerState:{nextDueAt:null,pendingEventDueAt:100,lastErrorCode:"automation_resource_deferred"}};
    vi.mocked(automationApi.listAutomationIntents).mockResolvedValue([eventIntent]);
    await render(); expect(document.body.textContent).toContain("waiting for existing background resource admission");
    vi.mocked(automationApi.listAutomationRuns).mockResolvedValue([{...run,triggerKind:"managed_scope_change",status:"blocked",errorCode:"automation_review_pending"}]);
    await act(async()=>changed());
    expect(document.body.textContent).toContain(makeTranslator("en")("automationReviewPendingSkip"));
    expect(document.body.textContent).toContain(makeTranslator("en")("automationFilesChanged"));
    expect(automationApi.runAutomationIntentManual).not.toHaveBeenCalled();
    await act(async()=>root.render(null)); expect(unlisten).toHaveBeenCalledTimes(1);
  });

});
