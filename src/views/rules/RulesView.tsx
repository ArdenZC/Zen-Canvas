import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { isUsableFocusTarget } from "../../components/modal/ModalPortal";
import { useChromeContext, useRulesContext } from "../../contexts/AppContexts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAppStore } from "../../store/useAppStore";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { resolveLegacyLibraryScope } from "../../store/useFileLibraryV2Store";
import { useRulesStore } from "../../store/useRulesStore";
import type { Rule, RuleDraftV2, RuleProposal } from "../../types/domain";
import { buttonSecondary, cn, emptyState, glassButtonPrimary } from "../../utils/tw";
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
import { ConfirmDialog, MetricStrip, mutedText, pageSurface, panelSurface, SideSheet, Button } from "../shared/ui";
import { AutomationRuleInspector, CurrentEnvironment } from "./AutomationRuleInspector";
import { AutomationRuleList, focusRuleContent } from "./AutomationRuleList";
import { AutomationRunFeedback } from "./AutomationRunFeedback";
import { RuleProposalWorkspace } from "./RuleProposalWorkspace";
import { useRuleProposalStore } from "../../store/useRuleProposalStore";

type Confirmation = { kind: "delete"; rule: Rule } | { kind: "run" } | null;

export function RulesView() {
  const { t, setView } = useChromeContext();
  const { rules, saveRule, toggleRuleEnabled, deleteRule } = useRulesContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const catalogRevision = useRulesStore((state) => state.catalogRevision);
  const needsReview = useFileLibraryStore((state) => state.stats.needsConfirmation);
  const userRules = useMemo(() => rules.filter((rule) => rule.source === "user"), [rules]);
  const enabledUserRules = useMemo(() => userRules.filter((rule) => rule.enabled), [userRules]);
  const overview = useMemo(() => automationOverview(userRules, needsReview), [needsReview, userRules]);
  const scopeSignature = useMemo(() => libraryScopeSignature(scope), [scope]);
  const currentEnabledRuleVersion = useMemo(() => enabledRulesVersion(enabledUserRules), [enabledUserRules]);
  const ruleMutationSignature = useMemo(() => JSON.stringify(userRules), [userRules]);
  const [activeId, setActiveId] = useState("");
  const [editorRule, setEditorRule] = useState<Rule | "new" | null>(null);
  const [proposalEditor, setProposalEditor] = useState<RuleProposal | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [runState, setRunState] = useState<AutomationRunState>({ kind: "idle" });
  const [createRuleMode, setCreateRuleMode] = useState<"choice" | "proposal" | null>(null);
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
  const createChoiceTriggerRef = useRef<HTMLElement | null>(null);
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
    const createOrigin = createRuleMode !== null ? createChoiceTriggerRef.current : null;
    setCreateRuleMode(null);
    setProposalEditor(null);
    dialogTriggerRef.current = createOrigin ?? trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setEditorRule(next);
  }

  function openProposalEditor(proposal: RuleProposal, trigger?: HTMLElement | null) {
    if (!proposal.candidate) return;
    const createOrigin = createRuleMode !== null ? createChoiceTriggerRef.current : null;
    setCreateRuleMode(null);
    dialogTriggerRef.current = createOrigin ?? trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setProposalEditor(proposal);
    setEditorRule(candidateAsRule(proposal));
  }

  function restoreAutomationFocus() {
    const currentRow = activeId
      ? Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-rule-row-content]") ?? [])
        .find((button) => button.dataset.ruleId === activeId) ?? null
      : null;
    return [dialogTriggerRef.current, currentRow, emptyCreateRef.current, createRef.current, workspaceTitleRef.current]
      .find((element) => isUsableFocusTarget(element, true)) ?? null;
  }

  function openCreateChoice(trigger: HTMLElement) {
    createChoiceTriggerRef.current = trigger;
    setCreateRuleMode("choice");
  }

  function restoreCreateChoiceFocus() {
    return [createChoiceTriggerRef.current, createRef.current, emptyCreateRef.current, workspaceTitleRef.current]
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
    if (proposalEditor) {
      await useRuleProposalStore.getState().replaceCandidate(
        proposalEditor,
        ruleDraftV2(next)
      );
      setProposalEditor(null);
      return;
    }
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
      const durableScope = await resolveLegacyLibraryScope(scope);
      const { summary } = await tauriApi.executeRulesForScopeV2(
        durableScope,
        catalogRevision,
        "all_changed_or_rule_changed",
        true
      );
      if (!runResultIsCurrent(context)) {
        markStaleIfCurrent(context);
        return;
      }
      await Promise.all([
        useFileLibraryStore.getState().loadStats(scope),
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
          <div><div className="flex items-center gap-2"><Zap size={18} className="text-[var(--zc-primary)]" /><h2 ref={workspaceTitleRef} tabIndex={-1} className="text-lg font-semibold">{t("automationRuleLibrary")}</h2></div><p className={cn(mutedText, "mt-1 max-w-3xl")}>{t("automationRulesDesc")}</p></div>
          <button ref={createRef} type="button" className={userRules.length ? glassButtonPrimary : buttonSecondary} onClick={(event) => openCreateChoice(event.currentTarget)}><Plus size={16} />{t("automationCreateRule")}</button>
        </header>

        <MetricStrip
          ariaLabel={t("automationRuleSummary")}
          density="compact"
          items={[
            { label: t("automationTotal"), value: overview.total.toLocaleString() },
            { label: t("automationEnabled"), value: overview.enabled.toLocaleString(), tone: "green" },
            { label: t("automationPaused"), value: overview.paused.toLocaleString(), tone: "slate" }
          ]}
        />

        <section className={cn(panelSurface, "grid gap-4 p-4 min-[1180px]:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]")}>
          <div className={cn("grid min-w-0 content-start gap-3", isNarrow && narrowPane === "details" && "hidden")}>
            <div className="flex items-center justify-end"><span className="text-xs tabular-nums text-[var(--muted)]">{userRules.length}</span></div>
             {userRules.length ? <AutomationRuleList rules={userRules} activeId={activeRule?.id ?? ""} busyRuleIds={busyRuleIds} toggleErrorIds={toggleErrorIds} listRef={listRef} onSelect={selectRule} onFocus={focusRule} onToggle={(rule, enabled) => void toggle(rule, enabled)} t={t} /> : <div className={cn(emptyState, "grid gap-3")}><div><strong className="block">{t("automationEmptyTitle")}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{t("automationEmptyDesc")}</span></div><button ref={emptyCreateRef} type="button" className={glassButtonPrimary} onClick={(event) => openCreateChoice(event.currentTarget)}><Plus size={16} />{t("createFirstRule")}</button></div>}

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

    <SideSheet
      open={createRuleMode !== null}
      title={createRuleMode === "proposal" ? t("automationProposalWorkspaceTitle") : t("automationCreateRule")}
      description={createRuleMode === "proposal" ? t("automationProposalWorkspaceDesc") : t("automationCreateRuleChoiceDesc")}
      closeLabel={t("close")}
      modalId="automation-create-rule"
      restoreFocus={restoreCreateChoiceFocus}
      onClose={() => setCreateRuleMode(null)}
    >
      {createRuleMode === "proposal" ? (
        <RuleProposalWorkspace
          embedded
          rules={userRules}
          onApplied={() => setCreateRuleMode(null)}
          onOpenManualBuilder={(trigger) => openRuleEditor("new", trigger)}
          onEditCandidate={(proposal, trigger) => openProposalEditor(proposal, trigger)}
        />
      ) : (
        <div className="grid gap-3">
          <Button variant="secondary" className="w-full justify-start gap-3 whitespace-normal text-left" onClick={() => setCreateRuleMode("proposal")}>
            <Zap size={17} aria-hidden="true" />
            <span className="grid min-w-0 gap-1"><strong>{t("automationCreateRuleNaturalLanguage")}</strong><span className="text-xs font-normal text-[var(--muted)]">{t("automationCreateRuleNaturalLanguageDesc")}</span></span>
          </Button>
          <Button variant="secondary" className="w-full justify-start gap-3 whitespace-normal text-left" onClick={(event) => openRuleEditor("new", event.currentTarget)}>
            <Plus size={17} aria-hidden="true" />
            <span className="grid min-w-0 gap-1"><strong>{t("automationCreateRuleManual")}</strong><span className="text-xs font-normal text-[var(--muted)]">{t("automationCreateRuleManualDesc")}</span></span>
          </Button>
        </div>
      )}
    </SideSheet>

    <AutomationRuleDialog open={editorRule !== null} rule={editorRule && editorRule !== "new" ? editorRule : undefined} t={t} restoreFocus={restoreAutomationFocus} onClose={() => { setEditorRule(null); setProposalEditor(null); }} onSave={save} />
    <ConfirmDialog open={Boolean(confirmation)} tone={confirmation?.kind === "delete" ? "danger" : "warning"} title={confirmation?.kind === "delete" ? t("confirmDeleteRuleTitle") : t("confirmReapplyRulesTitle")} description={confirmation?.kind === "delete" ? t("automationDeleteDesc") : t("automationRunConfirmDesc").replace("{count}", String(enabledUserRules.length))} emphasis={confirmation?.kind === "delete" ? t("automationDeleteHistorySafe") : t("automationSafetyBoundary")} errorMessage={confirmation?.kind === "delete" ? deleteError : undefined} confirmLabel={confirmation?.kind === "delete" ? t("deleteRule") : (runState.kind === "stale" ? t("automationRegenerateSuggestions") : t("automationRunNow"))} cancelLabel={t("cancel")} isProcessing={confirmation?.kind === "delete" ? deleteBusy : runState.kind === "running"} onCancel={() => { if (!deleteBusy) { setDeleteError(""); setConfirmation(null); } }} onConfirm={() => void confirmAction()} />
  </>;
}

function candidateAsRule(proposal: RuleProposal): Rule {
  const candidate = proposal.candidate;
  if (!candidate) throw new Error("rule_proposal_candidate_missing");
  return {
    id: `proposal-candidate-${proposal.id}`,
    name: candidate.name,
    source: "user",
    enabled: false,
    priority: candidate.priority,
    weight: candidate.weight,
    root_operator: candidate.rootOperator,
    groups: candidate.groups,
    action: candidate.action,
    created_at: "",
    updated_at: ""
  };
}

function ruleDraftV2(rule: Rule): RuleDraftV2 {
  return {
    name: rule.name,
    priority: rule.priority,
    weight: rule.weight,
    rootOperator: rule.root_operator === "OR" ? "OR" : "AND",
    groups: rule.groups.map((group) => ({
      operator: group.operator === "OR" ? "OR" : "AND",
      conditions: group.conditions.map((condition) => ({
        field: condition.field as Exclude<typeof condition.field, "unknown">,
        operator: condition.operator as Exclude<typeof condition.operator, "unknown">,
        value: condition.value
      }))
    })),
    action: {
      purpose: rule.action.purpose,
      lifecycle: rule.action.lifecycle,
      context: rule.action.context,
      riskLevel: rule.action.risk_level,
      suggestedAction: rule.action.suggested_action,
      targetTemplate: rule.action.target_template,
      renameTemplate: rule.action.rename_template
    }
  };
}
