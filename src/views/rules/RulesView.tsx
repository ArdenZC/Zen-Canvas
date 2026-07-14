import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Activity, ArrowLeft, CirclePause, Eye, Pencil, Play, Plus, RefreshCw, ShieldCheck, Trash2, Zap } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext, useRulesContext } from "../../contexts/AppContexts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAppStore } from "../../store/useAppStore";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import type { Rule } from "../../types/domain";
import { readableError } from "../../utils/viewHelpers";
import { buttonGhost, buttonIconDanger, buttonSecondary, cn, contentPanel, emptyState, glassButtonPrimary } from "../../utils/tw";
import { AutomationRuleDialog } from "../automation/AutomationRuleDialog";
import { automationOverview, ruleActionSummary, ruleConditionSummary, scopeSummary, type AutomationRunState } from "../automation/automationModel";
import { ConfirmDialog, mutedText, pageSurface, panelSurface, toggleSwitch } from "../shared/ui";

type Confirmation = { kind: "delete"; rule: Rule } | { kind: "run" } | null;

export function RulesView() {
  const { t, setView, onError } = useChromeContext();
  const { rules, saveRule, toggleRuleEnabled, deleteRule } = useRulesContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const needsReview = useFileLibraryStore((state) => state.organizeQueueTotal);
  const isLoadingReview = useFileLibraryStore((state) => state.isLoadingOrganizeQueue);
  const userRules = useMemo(() => rules.filter((rule) => rule.source === "user"), [rules]);
  const overview = useMemo(() => automationOverview(rules, needsReview), [needsReview, rules]);
  const [activeId, setActiveId] = useState("");
  const [editorRule, setEditorRule] = useState<Rule | "new" | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [runState, setRunState] = useState<AutomationRunState>({ kind: "idle" });
  const [narrowPane, setNarrowPane] = useState<"list" | "details">("list");
  const [busyRuleId, setBusyRuleId] = useState("");
  const isNarrow = useMediaQuery("(max-width: 980px)");
  const listRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLButtonElement | null>(null);
  const editRef = useRef<HTMLButtonElement | null>(null);
  const generationRef = useRef(0);
  const activeRule = userRules.find((rule) => rule.id === activeId) ?? userRules[0];
  const scopeInfo = scopeSummary(scope);

  useEffect(() => {
    if (!activeId || !userRules.some((rule) => rule.id === activeId)) setActiveId(userRules[0]?.id ?? "");
  }, [activeId, userRules]);

  useEffect(() => () => { generationRef.current += 1; }, []);
  useEffect(() => { if (!isNarrow) setNarrowPane("list"); }, [isNarrow]);
  useEffect(() => {
    if (!isNarrow || narrowPane !== "details" || editorRule !== null || confirmation) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      returnToList();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [confirmation, editorRule, isNarrow, narrowPane]);

  function selectRule(rule: Rule) {
    setActiveId(rule.id);
    if (isNarrow) setNarrowPane("details");
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!userRules.length) return;
    const current = Math.max(0, userRules.findIndex((rule) => rule.id === activeRule?.id));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      selectRule(userRules[(current + delta + userRules.length) % userRules.length]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeRule) selectRule(activeRule);
    } else if (event.key === " ") {
      event.preventDefault();
      if (activeRule) void toggle(activeRule, !activeRule.enabled);
    }
  }

  async function toggle(rule: Rule, enabled: boolean) {
    if (busyRuleId) return;
    setBusyRuleId(rule.id);
    try {
      await toggleRuleEnabled(rule, enabled);
    } catch (error) {
      onError(readableError(error));
    } finally {
      setBusyRuleId("");
    }
  }

  async function save(next: Rule) {
    await saveRule(next);
    setActiveId(next.id);
  }

  async function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === "delete") {
      const id = confirmation.rule.id;
      await deleteRule(confirmation.rule);
      setConfirmation(null);
      if (activeId === id) setActiveId("");
      return;
    }
    setConfirmation(null);
    await reapplyRulesToCurrentScope();
  }

  async function reapplyRulesToCurrentScope() {
    const generation = ++generationRef.current;
    setRunState({ kind: "running" });
    try {
      const summary = await tauriApi.executeRulesForScope(scope, rules, "all_changed_or_rule_changed");
      await Promise.all([
        useFileLibraryStore.getState().loadOrganizeQueue(scope),
        useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery)
      ]);
      if (generation !== generationRef.current) return;
      setRunState({ kind: "completed", ...summary });
    } catch (error) {
      if (generation !== generationRef.current) return;
      setRunState({ kind: "failed", message: readableError(error) });
    }
  }

  function returnToList() {
    setNarrowPane("list");
    requestAnimationFrame(() => listRef.current?.focus());
  }

  return <>
    <div className={pageSurface}>
      <div className="mx-auto grid w-full max-w-[1480px] content-start gap-5 pb-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2"><Zap size={20} className="text-[var(--zc-primary)]" /><h1 className="text-xl font-semibold">{t("automationWorkspaceTitle")}</h1></div><p className={cn(mutedText, "mt-1 max-w-3xl")}>{t("automationWorkspaceDesc")}</p></div>
          <button ref={createRef} type="button" className={glassButtonPrimary} onClick={() => setEditorRule("new")}><Plus size={16} />{t("automationCreateRule")}</button>
        </header>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            [t("automationTotal"), overview.total],
            [t("automationEnabled"), overview.enabled],
            [t("automationPaused"), overview.paused],
            [t("automationNeedsReview"), isLoadingReview ? "…" : overview.needsReview]
          ].map(([label, value]) => <div key={String(label)} className={cn(contentPanel, "p-3")}><span className="block text-xs text-[var(--muted)]">{label}</span><strong className="mt-1 block text-lg tabular-nums">{value}</strong></div>)}
        </div>

        <section className={cn(panelSurface, "grid gap-4 p-4 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]")}>
          <div className={cn("grid min-w-0 content-start gap-3", isNarrow && narrowPane === "details" && "hidden")}>
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">{t("automationRules")}</h2><p className={mutedText}>{t("automationRulesDesc")}</p></div><span className="text-xs tabular-nums text-[var(--muted)]">{userRules.length}</span></div>
            {userRules.length ? <div ref={listRef} role="listbox" aria-label={t("automationRules")} tabIndex={0} className="grid gap-1 outline-none" onKeyDown={handleListKeyDown}>
              {userRules.map((rule) => {
                const active = rule.id === activeRule?.id;
                return <div key={rule.id} role="option" aria-selected={active} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--zc-radius-field)] border px-3 py-3 transition-colors", active ? "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)]" : "border-transparent hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-hover)]")} onClick={() => selectRule(rule)}>
                  <button type="button" className="min-w-0 text-left" tabIndex={-1} onClick={() => selectRule(rule)}><strong className="block truncate text-sm">{rule.name}</strong><span className="mt-1 block truncate text-xs text-[var(--muted)]">{rule.enabled ? t("automationRunning") : t("automationPaused")}: {ruleConditionSummary(rule, t)}</span></button>
                  <button type="button" role="switch" aria-checked={rule.enabled} aria-label={rule.enabled ? t("disableRule") : t("enableRule")} className={toggleSwitch(rule.enabled)} disabled={busyRuleId === rule.id} onClick={(event) => { event.stopPropagation(); void toggle(rule, !rule.enabled); }}><i /></button>
                </div>;
              })}
            </div> : <div className={cn(emptyState, "grid gap-3")}><div><strong className="block">{t("automationEmptyTitle")}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{t("automationEmptyDesc")}</span></div><button type="button" className={glassButtonPrimary} onClick={() => setEditorRule("new")}><Plus size={16} />{t("createFirstRule")}</button></div>}

            <section className="mt-2 grid gap-3 border-t border-[var(--zc-divider)] pt-4">
              <div className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--zc-success-text)]" /><div><strong className="text-sm">{t("automationSafetyTitle")}</strong><p className={mutedText}>{t("automationSafetyBoundary")}</p></div></div>
              <button type="button" className={buttonSecondary} onClick={() => setConfirmation({ kind: "run" })} disabled={runState.kind === "running" || overview.enabled === 0}><RefreshCw size={15} className={cn(runState.kind === "running" && "animate-spin")} />{t("automationRunNow")}</button>
              <RunFeedback state={runState} t={t} />
            </section>
          </div>

          <div className={cn("min-w-0", isNarrow && narrowPane === "list" && "hidden")}>
            {activeRule ? <section className="grid gap-5" aria-labelledby="automation-inspector-title">
              <header className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">{isNarrow && <button type="button" className={buttonSecondary} aria-label={t("automationBackToRules")} onClick={returnToList}><ArrowLeft size={16} /></button>}<div className="min-w-0"><h2 id="automation-inspector-title" className="truncate text-lg font-semibold">{activeRule.name}</h2><p className={cn(mutedText, "mt-1")}>{activeRule.enabled ? t("automationRunningDesc") : t("automationPausedDesc")}</p></div></div>
                <div className="flex shrink-0 items-center gap-1"><button ref={editRef} type="button" className={buttonGhost} onClick={() => setEditorRule(activeRule)}><Pencil size={15} />{t("automationEditRule")}</button><button type="button" className={buttonIconDanger} aria-label={t("deleteRule")} title={t("deleteRule")} onClick={() => setConfirmation({ kind: "delete", rule: activeRule })}><Trash2 size={15} /></button></div>
              </header>

              <div className="grid gap-3 sm:grid-cols-2">
                <InspectorItem icon={<Activity size={16} />} label={t("automationTrigger")} value={t("automationTriggerWatchedChange")} hint={t("automationTriggerHint")} />
                <InspectorItem icon={activeRule.enabled ? <Play size={16} /> : <CirclePause size={16} />} label={t("automationStatus")} value={activeRule.enabled ? t("automationRunning") : t("automationPaused")} hint={activeRule.enabled ? t("automationRunningDesc") : t("automationPausedDesc")} />
                <InspectorItem label={t("automationScope")} value={scopeInfo.kind === "all" ? t("automationScopeAll") : t("automationScopeRoots").replace("{count}", String(scopeInfo.roots.length))} hint={scopeInfo.roots.join(" · ") || t("automationScopeAllHint")} />
                <InspectorItem label={t("automationConfirmationPolicy")} value={t("automationSuggestionsOnly")} hint={t("automationPreviewRequiredHint")} />
              </div>

              <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-4"><h3 className="text-sm font-semibold">{t("automationLogic")}</h3><p className="rounded-[var(--zc-radius-field)] bg-[var(--zc-surface-subtle)] p-3 text-sm"><span className="text-[var(--muted)]">{t("automationWhen")}</span> {ruleConditionSummary(activeRule, t)}<br /><span className="text-[var(--muted)]">{t("automationThen")}</span> {ruleActionSummary(activeRule, t)}</p></section>
              <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-4"><h3 className="text-sm font-semibold">{t("automationAvailability")}</h3><div className="grid gap-2 text-sm"><Availability label={t("automationWatchedTrigger")} available t={t} /><Availability label={t("automationManualTrigger")} available t={t} /><Availability label={t("automationScheduleTrigger")} available={false} t={t} /><Availability label={t("automationPersistedHistory")} available={false} t={t} /></div></section>
              <button type="button" className={buttonSecondary} onClick={() => setView("organize")}><Eye size={16} />{t("automationOpenReview")}</button>
            </section> : <div className={emptyState}>{t("automationNoSelection")}</div>}
          </div>
        </section>
      </div>
    </div>

    <AutomationRuleDialog open={editorRule !== null} rule={editorRule && editorRule !== "new" ? editorRule : undefined} t={t} restoreFocus={() => editorRule === "new" ? createRef.current : editRef.current} onClose={() => setEditorRule(null)} onSave={save} />
    <ConfirmDialog open={Boolean(confirmation)} tone={confirmation?.kind === "delete" ? "danger" : "warning"} title={confirmation?.kind === "delete" ? t("confirmDeleteRuleTitle") : t("confirmReapplyRulesTitle")} description={confirmation?.kind === "delete" ? t("automationDeleteDesc") : t("automationRunConfirmDesc")} emphasis={confirmation?.kind === "delete" ? t("automationDeleteHistorySafe") : t("automationSafetyBoundary")} confirmLabel={confirmation?.kind === "delete" ? t("deleteRule") : t("automationRunNow")} cancelLabel={t("cancel")} isProcessing={runState.kind === "running"} onCancel={() => setConfirmation(null)} onConfirm={() => void confirmAction()} />
  </>;
}

function InspectorItem({ icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className={cn(contentPanel, "grid content-start gap-1 p-3")}><div className="flex items-center gap-2 text-xs text-[var(--muted)]">{icon}{label}</div><strong className="mt-1 text-sm">{value}</strong><span className="text-xs leading-5 text-[var(--muted)]" title={hint}>{hint}</span></div>;
}

function Availability({ label, available, t }: { label: string; available: boolean; t: ReturnType<typeof useChromeContext>["t"] }) {
  return <div className="flex items-center justify-between gap-3 rounded-[var(--zc-radius-control)] border border-[var(--zc-border)] px-3 py-2"><span>{label}</span><span className={available ? "text-[var(--zc-success-text)]" : "text-[var(--muted)]"}>{available ? t("automationAvailable") : t("automationUnavailable")}</span></div>;
}

function RunFeedback({ state, t }: { state: AutomationRunState; t: ReturnType<typeof useChromeContext>["t"] }) {
  if (state.kind === "idle") return <p className={mutedText}>{t("automationNoPersistedRun")}</p>;
  if (state.kind === "running") return <p className={mutedText} role="status">{t("automationRunInProgress")}</p>;
  if (state.kind === "failed") return <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationRunFailed")}: {state.message}</p>;
  return <p className={mutedText} role="status">{t("automationRunComplete").replace("{updated}", String(state.updated)).replace("{scanned}", String(state.scanned)).replace("{skipped}", String(state.skipped))}{state.warning ? ` · ${state.warning}` : ""}</p>;
}
