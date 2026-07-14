import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { isUsableFocusTarget } from "../../components/modal/ModalPortal";
import { useChromeContext, useRulesContext } from "../../contexts/AppContexts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAppStore } from "../../store/useAppStore";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import type { Rule } from "../../types/domain";
import { buttonSecondary, cn, contentPanel, emptyState, glassButtonPrimary } from "../../utils/tw";
import { AutomationRuleDialog } from "../automation/AutomationRuleDialog";
import {
  acceptsAutomationRunResult,
  automationOverview,
  createAutomationRunContext,
  enabledRulesVersion,
  libraryScopeSignature,
  scopeSummary,
  type AutomationRunContext,
  type AutomationRunState
} from "../automation/automationModel";
import { ConfirmDialog, mutedText, pageSurface, panelSurface } from "../shared/ui";
import { AutomationRuleInspector, CurrentEnvironment } from "./AutomationRuleInspector";
import { AutomationRuleList, focusRuleContent } from "./AutomationRuleList";
import { AutomationRunFeedback } from "./AutomationRunFeedback";

type Confirmation = { kind: "delete"; rule: Rule } | { kind: "run" } | null;

export function RulesView() {
  const { t, setView } = useChromeContext();
  const { rules, saveRule, toggleRuleEnabled, deleteRule } = useRulesContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const needsReview = useFileLibraryStore((state) => state.organizeQueueTotal);
  const isLoadingReview = useFileLibraryStore((state) => state.isLoadingOrganizeQueue);
  const userRules = useMemo(() => rules.filter((rule) => rule.source === "user"), [rules]);
  const enabledUserRules = useMemo(() => userRules.filter((rule) => rule.enabled), [userRules]);
  const overview = useMemo(() => automationOverview(userRules, needsReview), [needsReview, userRules]);
  const scopeSignature = useMemo(() => libraryScopeSignature(scope), [scope]);
  const currentEnabledRuleVersion = useMemo(() => enabledRulesVersion(enabledUserRules), [enabledUserRules]);
  const ruleMutationSignature = useMemo(() => JSON.stringify(userRules), [userRules]);
  const [activeId, setActiveId] = useState("");
  const [editorRule, setEditorRule] = useState<Rule | "new" | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [runState, setRunState] = useState<AutomationRunState>({ kind: "idle" });
  const [narrowPane, setNarrowPane] = useState<"list" | "details">("list");
  const [busyRuleIds, setBusyRuleIds] = useState<Set<string>>(() => new Set());
  const [toggleErrorIds, setToggleErrorIds] = useState<Set<string>>(() => new Set());
  const isNarrow = useMediaQuery("(max-width: 1179px)");
  const listRef = useRef<HTMLUListElement | null>(null);
  const createRef = useRef<HTMLButtonElement | null>(null);
  const emptyCreateRef = useRef<HTMLButtonElement | null>(null);
  const editRef = useRef<HTMLButtonElement | null>(null);
  const workspaceTitleRef = useRef<HTMLHeadingElement | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const editorWasOpenRef = useRef(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const runContextRef = useRef<AutomationRunContext | null>(null);
  const scopeSignatureRef = useRef(scopeSignature);
  const enabledRuleVersionRef = useRef(currentEnabledRuleVersion);
  scopeSignatureRef.current = scopeSignature;
  enabledRuleVersionRef.current = currentEnabledRuleVersion;
  const activeRule = userRules.find((rule) => rule.id === activeId) ?? userRules[0];

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; generationRef.current += 1; runContextRef.current = null; };
  }, []);

  useEffect(() => {
    if (!activeId || !userRules.some((rule) => rule.id === activeId)) setActiveId(userRules[0]?.id ?? "");
  }, [activeId, userRules]);

  useEffect(() => {
    const wasOpen = editorWasOpenRef.current;
    editorWasOpenRef.current = editorRule !== null;
    if (!wasOpen || editorRule !== null) return;
    const frame = requestAnimationFrame(() => restoreAutomationFocus()?.focus());
    return () => cancelAnimationFrame(frame);
  }, [activeId, editorRule, userRules.length]);

  useEffect(() => {
    generationRef.current += 1;
    setRunState((current) => current.kind === "running" || current.kind === "completed"
      ? { kind: "stale", context: current.context }
      : current);
  }, [ruleMutationSignature, scopeSignature]);

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
  }, [confirmation, editorRule, isNarrow, narrowPane, activeId]);

  function selectRule(rule: Rule) {
    setActiveId(rule.id);
    if (isNarrow) setNarrowPane("details");
  }

  function focusRule(rule: Rule) {
    setActiveId(rule.id);
  }

  function openRuleEditor(next: Rule | "new", trigger?: HTMLElement | null) {
    dialogTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setEditorRule(next);
  }

  function restoreAutomationFocus() {
    const currentRow = activeId
      ? Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-rule-row-content]") ?? [])
        .find((button) => button.dataset.ruleId === activeId) ?? null
      : null;
    return [dialogTriggerRef.current, currentRow, emptyCreateRef.current, createRef.current, workspaceTitleRef.current]
      .find((element) => isUsableFocusTarget(element, true)) ?? null;
  }

  async function toggle(rule: Rule, enabled: boolean) {
    if (busyRuleIds.has(rule.id)) return;
    setBusyRuleIds((current) => new Set(current).add(rule.id));
    setToggleErrorIds((current) => {
      const next = new Set(current);
      next.delete(rule.id);
      return next;
    });
    try {
      await toggleRuleEnabled(rule, enabled);
    } catch {
      setToggleErrorIds((current) => new Set(current).add(rule.id));
    } finally {
      setBusyRuleIds((current) => {
        const next = new Set(current);
        next.delete(rule.id);
        return next;
      });
    }
  }

  async function save(next: Rule) {
    await saveRule(next);
    setActiveId(next.id);
  }

  async function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === "delete") {
      if (deleteBusy) return;
      const { rule } = confirmation;
      const index = userRules.findIndex((item) => item.id === rule.id);
      const focusId = userRules[index + 1]?.id ?? userRules[index - 1]?.id ?? "";
      setDeleteBusy(true);
      setDeleteError("");
      try {
        const deleted = await deleteRule(rule);
        if (!deleted) {
          setDeleteError(t("ruleDeleteFailed"));
          return;
        }
        setConfirmation(null);
        setDeleteError("");
        setActiveId(focusId);
        if (isNarrow) setNarrowPane("list");
        requestAnimationFrame(() => {
          if (focusId && focusRuleContent(listRef, focusId)) return;
          (emptyCreateRef.current ?? createRef.current)?.focus();
        });
      } catch {
        setDeleteError(t("ruleDeleteFailed"));
      } finally {
        setDeleteBusy(false);
      }
      return;
    }
    setConfirmation(null);
    await reapplyRulesToCurrentScope();
  }

  function runResultIsCurrent(context: AutomationRunContext) {
    return acceptsAutomationRunResult(context, mountedRef.current, generationRef.current, scopeSignatureRef.current, enabledRuleVersionRef.current);
  }

  function markStaleIfCurrent(context: AutomationRunContext) {
    if (mountedRef.current && runContextRef.current?.generationId === context.generationId) {
      setRunState((current) => current.kind === "stale" || current.kind === "running" || current.kind === "completed"
        ? { kind: "stale", context }
        : current);
    }
  }

  async function reapplyRulesToCurrentScope() {
    const generationId = generationRef.current + 1;
    generationRef.current = generationId;
    const context = createAutomationRunContext(generationId, scope, enabledUserRules);
    runContextRef.current = context;
    setRunState({ kind: "running", context });
    try {
      const summary = await tauriApi.executeRulesForScope(scope, enabledUserRules, "all_changed_or_rule_changed");
      if (!runResultIsCurrent(context)) {
        markStaleIfCurrent(context);
        return;
      }
      await Promise.all([
        useFileLibraryStore.getState().loadOrganizeQueue(scope),
        useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery)
      ]);
      if (!runResultIsCurrent(context)) {
        markStaleIfCurrent(context);
        return;
      }
      setRunState({ kind: "completed", context, ...summary });
    } catch {
      if (runResultIsCurrent(context)) setRunState({ kind: "failed", context, message: t("automationRunFailed") });
    }
  }

  function returnToList() {
    setNarrowPane("list");
    requestAnimationFrame(() => {
      if (activeId && focusRuleContent(listRef, activeId)) return;
      (emptyCreateRef.current ?? createRef.current)?.focus();
    });
  }

  return <>
    <div className={pageSurface}>
      <div className="mx-auto grid w-full max-w-[1480px] content-start gap-5 pb-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2"><Zap size={18} className="text-[var(--zc-primary)]" /><h2 ref={workspaceTitleRef} tabIndex={-1} className="text-lg font-semibold">{t("automationRules")}</h2></div><p className={cn(mutedText, "mt-1 max-w-3xl")}>{t("automationRulesDesc")}</p></div>
          <button ref={createRef} type="button" className={userRules.length ? glassButtonPrimary : buttonSecondary} onClick={(event) => openRuleEditor("new", event.currentTarget)}><Plus size={16} />{t("automationCreateRule")}</button>
        </header>

        <div className="grid grid-cols-2 gap-2 min-[1180px]:grid-cols-4">
          {[
            [t("automationTotal"), overview.total],
            [t("automationEnabled"), overview.enabled],
            [t("automationPaused"), overview.paused],
            [t("automationNeedsReview"), isLoadingReview ? "…" : overview.needsReview]
          ].map(([label, value]) => <div key={String(label)} className={cn(contentPanel, "p-3")}><span className="block text-xs text-[var(--muted)]">{label}</span><strong className="mt-1 block text-lg tabular-nums">{value}</strong></div>)}
        </div>
        <p className={cn(mutedText, "-mt-3 text-xs")}>{t("automationNeedsReviewHint")}</p>

        <section className={cn(panelSurface, "grid gap-4 p-4 min-[1180px]:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]")}>
          <div className={cn("grid min-w-0 content-start gap-3", isNarrow && narrowPane === "details" && "hidden")}>
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">{t("automationRules")}</h2><p className={mutedText}>{t("automationRulesDesc")}</p></div><span className="text-xs tabular-nums text-[var(--muted)]">{userRules.length}</span></div>
             {userRules.length ? <AutomationRuleList rules={userRules} activeId={activeRule?.id ?? ""} busyRuleIds={busyRuleIds} toggleErrorIds={toggleErrorIds} listRef={listRef} onSelect={selectRule} onFocus={focusRule} onToggle={(rule, enabled) => void toggle(rule, enabled)} t={t} /> : <div className={cn(emptyState, "grid gap-3")}><div><strong className="block">{t("automationEmptyTitle")}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{t("automationEmptyDesc")}</span></div><button ref={emptyCreateRef} type="button" className={glassButtonPrimary} onClick={(event) => openRuleEditor("new", event.currentTarget)}><Plus size={16} />{t("createFirstRule")}</button></div>}

            <section className="mt-2 grid gap-3 border-t border-[var(--zc-divider)] pt-4">
              <div className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--zc-success-text)]" /><div><strong className="text-sm">{t("automationSafetyTitle")}</strong><p className={mutedText}>{t("automationSafetyBoundary")}</p></div></div>
              <p className={cn(mutedText, "text-xs")}>{t("automationManualRuleSet")}</p>
              <button type="button" className={buttonSecondary} onClick={() => setConfirmation({ kind: "run" })} disabled={runState.kind === "running" || overview.enabled === 0}><RefreshCw size={15} className={cn(runState.kind === "running" && "animate-spin")} />{runState.kind === "stale" ? t("automationRegenerateSuggestions") : t("automationRunNow")}</button>
              {overview.enabled === 0 && <p className={mutedText}>{t("automationNoEnabledRules")}</p>}
              <AutomationRunFeedback state={runState} t={t} onRegenerate={() => setConfirmation({ kind: "run" })} />
            </section>
          </div>

          <div className={cn("min-w-0", isNarrow && narrowPane === "list" && "hidden")}>
              {activeRule ? <AutomationRuleInspector rule={activeRule} isNarrow={isNarrow} editRef={editRef} onBack={returnToList} onEdit={(trigger) => openRuleEditor(activeRule, trigger)} onDelete={() => { setDeleteError(""); setConfirmation({ kind: "delete", rule: activeRule }); }} onOpenReview={() => setView("organize")} t={t} /> : <div className={emptyState}>{t("automationNoSelection")}</div>}
          </div>
        </section>

        <CurrentEnvironment scope={scopeSummary(scope)} t={t} />
      </div>
    </div>

    <AutomationRuleDialog open={editorRule !== null} rule={editorRule && editorRule !== "new" ? editorRule : undefined} t={t} restoreFocus={restoreAutomationFocus} onClose={() => setEditorRule(null)} onSave={save} />
    <ConfirmDialog open={Boolean(confirmation)} tone={confirmation?.kind === "delete" ? "danger" : "warning"} title={confirmation?.kind === "delete" ? t("confirmDeleteRuleTitle") : t("confirmReapplyRulesTitle")} description={confirmation?.kind === "delete" ? t("automationDeleteDesc") : t("automationRunConfirmDesc").replace("{count}", String(enabledUserRules.length))} emphasis={confirmation?.kind === "delete" ? t("automationDeleteHistorySafe") : t("automationSafetyBoundary")} errorMessage={confirmation?.kind === "delete" ? deleteError : undefined} confirmLabel={confirmation?.kind === "delete" ? t("deleteRule") : (runState.kind === "stale" ? t("automationRegenerateSuggestions") : t("automationRunNow"))} cancelLabel={t("cancel")} isProcessing={confirmation?.kind === "delete" ? deleteBusy : runState.kind === "running"} onCancel={() => { if (!deleteBusy) { setDeleteError(""); setConfirmation(null); } }} onConfirm={() => void confirmAction()} />
  </>;
}
