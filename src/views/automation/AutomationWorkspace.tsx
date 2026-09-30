import { lazy, Suspense, useEffect, useState } from "react";
import { tauriApi } from "../../api/tauriApi";
import type { ScanRootDto } from "../../api/types";
import { useI18nContext, useNavigationContext } from "../../contexts/AppContexts";
import { useOrganizationPlanStore } from "../../store/useOrganizationPlanStore";
import type { AutomationIntent } from "../../types/automation";
import { warningSurface } from "../../utils/tw";
import { Button, ConfirmDialog, panelSurface, pageSurface } from "../shared/ui";
import { AutomationIntentEditor } from "./AutomationIntentEditor";
import { useAutomationIntents } from "./useAutomationIntents";

const RulesView = lazy(() => import("../rules/RulesView").then((module) => ({ default: module.RulesView })));
export function AutomationWorkspace() {
  const { t } = useI18nContext();
  const { setView } = useNavigationContext();
  const state = useAutomationIntents();
  const [advanced, setAdvanced] = useState(false);
  const [editor, setEditor] = useState<AutomationIntent | "new" | null>(null);
  const [archiving, setArchiving] = useState<AutomationIntent | null>(null);
  const [roots, setRoots] = useState<ScanRootDto[]>([]);
  const [openError, setOpenError] = useState(false);
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    void tauriApi.listScanRoots().then((items) => { if (!cancelled) setRoots(items); }).catch(() => { if (!cancelled) setRoots([]); });
    return () => { cancelled = true; };
  }, [editor]);
  const openPlan = async (planId: string) => {
    setOpenError(false);
    await useOrganizationPlanStore.getState().openPlan(planId);
    const owner = useOrganizationPlanStore.getState();
    if (owner.activePlan?.id === planId && owner.activePlanState === "loaded") setView("organize");
    else setOpenError(true);
  };
  return <div className={`${pageSurface} space-y-5 p-4 sm:p-6`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("automationIntents")}</h2>
      <div className="flex gap-2" role="group" aria-label={t("automationIntentWorkspaceTitle")}><Button aria-pressed={!advanced} onClick={() => setAdvanced(false)}>{t("automationIntents")}</Button><Button aria-pressed={advanced} onClick={() => setAdvanced(true)}>{t("automationAdvancedRules")}</Button></div>
    </div>
    {advanced ? <Suspense fallback={<p>{t("loading")}</p>}><RulesView /></Suspense> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm opacity-70">{t("automationFixedPolicy")}</p><div className="flex gap-2"><Button disabled={Boolean(state.busy)} onClick={() => void state.reload()}>{t("automationReload")}</Button><Button variant="primary" disabled={Boolean(state.busy)} onClick={() => setEditor("new")}>{t("automationCreateIntent")}</Button></div></div>
      {(state.error || openError) && <p role="alert" className={`${warningSurface} rounded-xl p-3`}>{t(openError ? "automationOpenFailed" : state.error === "revision" ? "automationRevisionConflict" : "automationActionFailed")}</p>}
      {state.loading ? <p role="status">{t("loading")}</p> : state.intents.length === 0 ? <div className={`${panelSurface} p-8`}><h2 className="font-semibold">{t("automationIntentEmptyTitle")}</h2><p className="mt-2 text-sm opacity-70">{t("automationEmptyDescription")}</p></div> : <div className="space-y-3">{state.intents.map((intent) => {
        const run = state.runs.find((item) => item.intentId === intent.id);
        const isPending = state.busy === intent.id;
        return <article key={intent.id} className={`${panelSurface} space-y-3 p-4`}>
          <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{intent.title}</h2><p className="text-sm opacity-70">{t("automationManual")} · {t(intent.enabled ? "automationIntentEnabled" : "automationIntentPaused")}</p></div>
            <div className="flex flex-wrap gap-2"><Button disabled={Boolean(state.busy)} onClick={() => setEditor(intent)}>{t("automationEditIntent")}</Button><Button disabled={Boolean(state.busy)} onClick={() => void state.toggle(intent)}>{t(intent.enabled ? "automationPause" : "automationEnable")}</Button><Button disabled={Boolean(state.busy)} onClick={() => setArchiving(intent)}>{t("automationArchive")}</Button><Button variant="primary" disabled={!intent.enabled || Boolean(state.busy)} onClick={() => void state.run(intent)}>{t(isPending ? "automationGenerating" : "automationGeneratePlan")}</Button></div>
          </div>
          <p className="text-sm">{t("automationIntentScope")}: {t(intent.scopeQuery.scope.kind === "all_enabled_roots" ? "automationAllRoots" : "automationSelectedRoots")}{intent.scopeQuery.scope.kind === "roots" ? ` (${intent.scopeQuery.scope.scanRootIds.length})` : ""}{intent.scopeQuery.text ? ` · ${intent.scopeQuery.text}` : ""}</p>
          {isPending && <p role="status">{t("automationPendingDescription")}</p>}
          {run && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/10"><div className="space-y-1"><p className="text-sm font-medium">{t("automationLatestRun")}: {t(run.status === "blocked" ? "automationRunBlocked" : run.status === "failed" ? "automationIntentRunFailed" : run.requiresPlanRefresh ? "automationRunAnalysisQueued" : "automationRunReady")}</p><p className="text-sm opacity-70">{new Date(run.createdAt * 1000).toLocaleString()} · {t("automationReviewRequired")}</p>
            {run.analysisBlockerCode && <p className="text-sm">{t(run.analysisBlockerCode === "managed_scope_missing" ? "automationManagedScopeMissing" : "automationAnalysisBlocked")}</p>}
            {run.errorCode === "automation_scope_unavailable" && <p className="text-sm">{t("automationScopeBlocked")}</p>}
            {run.requiresPlanRefresh && <p className="text-sm opacity-70">{t("automationRefreshInOrganize")}</p>}</div>
            {run.resultPlanId && <Button disabled={Boolean(state.busy)} onClick={() => void openPlan(run.resultPlanId!)}>{t("automationOpenPlan")}</Button>}
          </div>}
        </article>;
      })}</div>}
    </>}
    {editor && <AutomationIntentEditor intent={editor === "new" ? undefined : editor} roots={roots} t={t} busy={Boolean(state.busy)} onSave={(draft) => state.save(draft, editor === "new" ? undefined : editor)} onClose={() => setEditor(null)} />}
    {archiving && <ConfirmDialog open isProcessing={Boolean(state.busy)} title={t("automationArchive")} description={t("automationArchiveDescription")} confirmLabel={t("automationArchive")} cancelLabel={t("cancel")} onConfirm={() => { void state.archive(archiving).then((saved) => { if (saved) setArchiving(null); }); }} onCancel={() => setArchiving(null)} />}
  </div>;
}
