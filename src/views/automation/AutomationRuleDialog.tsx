import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import type { Lifecycle, Purpose, Rule, RuleCondition, RuleOperator } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { nowIso, readableError } from "../../utils/viewHelpers";
import { buttonGhost, buttonIconDanger, buttonSecondary, cn, glassButtonPrimary, inputSurface, selectSurface } from "../../utils/tw";
import { ModalPortal } from "../../components/modal/ModalPortal";
import { ConfirmDialog, mutedText, panelSurface } from "../shared/ui";
import {
  RULE_FIELD_OPTIONS,
  RULE_LIFECYCLE_OPTIONS,
  RULE_LOGIC_OPTIONS,
  RULE_OPERATOR_OPTIONS,
  RULE_PURPOSE_OPTIONS,
  buildRuleFromBuilderDraft,
  createRuleCondition,
  createRuleGroup
} from "../rules/ruleBuilder";
import { conditionFieldLabel, conditionOperatorLabel, lifecycleLabel, purposeLabel, validateRuleDraft } from "./automationModel";

type Draft = {
  name: string;
  rootOperator: RuleOperator;
  groups: Rule["groups"];
  purpose: Purpose;
  lifecycle: Lifecycle;
  weight: number;
};

function draftFrom(rule?: Rule): Draft {
  return {
    name: rule?.name ?? "",
    rootOperator: rule?.root_operator ?? "AND",
    groups: rule?.groups.map((group) => ({ ...group, conditions: group.conditions.map((condition) => ({ ...condition })) })) ?? [createRuleGroup({ value: "" })],
    purpose: rule?.action.purpose ?? "Temporary",
    lifecycle: rule?.action.lifecycle ?? "Inbox",
    weight: rule?.weight ?? 75
  };
}

export function AutomationRuleDialog({ open, rule, t, restoreFocus, onClose, onSave }: {
  open: boolean;
  rule?: Rule;
  t: Translator;
  restoreFocus?: () => HTMLElement | null;
  onClose: () => void;
  onSave: (rule: Rule) => Promise<void>;
}) {
  const initial = useMemo(() => draftFrom(rule), [rule]);
  const [draft, setDraft] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ name: false, conditions: false });
  const [saveError, setSaveError] = useState("");
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const errors = validateRuleDraft(draft.name, draft.groups);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setAdvanced(false);
    setDiscardOpen(false);
    setSubmitAttempted(false);
    setTouched({ name: false, conditions: false });
    setSaveError("");
  }, [initial, open]);

  if (!open) return null;

  function requestClose() {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  function updateCondition(groupId: string, conditionId: string, patch: Partial<RuleCondition>) {
    setDraft((current) => ({ ...current, groups: current.groups.map((group) => group.id === groupId ? { ...group, conditions: group.conditions.map((condition) => condition.id === conditionId ? { ...condition, ...patch } : condition) } : group) }));
  }

  async function submit() {
    setSubmitAttempted(true);
    if (errors.name || errors.conditions || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const now = nowIso();
      const next = buildRuleFromBuilderDraft({
        id: rule?.id,
        name: draft.name,
        rootOperator: draft.rootOperator,
        groups: draft.groups,
        purpose: draft.purpose,
        lifecycle: draft.lifecycle,
        weight: draft.weight,
        now: rule?.created_at ?? now
      });
      next.enabled = rule?.enabled ?? true;
      next.priority = rule?.priority ?? next.priority;
      next.created_at = rule?.created_at ?? next.created_at;
      next.updated_at = now;
      await onSave(next);
      onClose();
    } catch (error) {
      setSaveError(readableError(error));
    } finally {
      setSaving(false);
    }
  }

  return <>
    <ModalPortal initialFocusRef={nameRef} restoreFocus={restoreFocus} onEscape={requestClose}>
      <div className="fixed inset-0 grid place-items-center overflow-y-auto bg-[var(--zc-overlay)] p-3 backdrop-blur-sm sm:p-6">
        <section className={cn(panelSurface, "my-auto grid max-h-[min(760px,calc(100vh-24px))] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="flex items-start justify-between gap-4 border-b border-[var(--zc-divider)] p-5">
            <div><h2 id={titleId} className="text-lg font-semibold">{rule ? t("automationEditRule") : t("automationCreateRule")}</h2><p className={cn(mutedText, "mt-1")}>{t("automationEditorDesc")}</p></div>
            <button ref={closeRef} type="button" className={buttonGhost} aria-label={t("close")} onClick={requestClose}><X size={17} /></button>
          </header>
          <div className="grid gap-5 overflow-y-auto p-5">
            <section className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">{t("ruleName")}<input ref={nameRef} className={inputSurface} value={draft.name} aria-invalid={(submitAttempted || touched.name) && Boolean(errors.name)} onBlur={() => setTouched((current) => ({ ...current, name: true }))} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              {(submitAttempted || touched.name) && errors.name && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationNameRequired")}</p>}
              <div className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] p-3">
                <strong className="text-sm">{t("automationWhen")}</strong>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr]">
                  <select className={selectSurface} aria-label={t("field")} value={draft.groups[0]?.conditions[0]?.field} onChange={(event) => updateCondition(draft.groups[0].id, draft.groups[0].conditions[0].id, { field: event.target.value as RuleCondition["field"] })}>{RULE_FIELD_OPTIONS.map((value) => <option key={value} value={value}>{conditionFieldLabel(value, t)}</option>)}</select>
                  <select className={selectSurface} aria-label={t("operator")} value={draft.groups[0]?.conditions[0]?.operator} onChange={(event) => updateCondition(draft.groups[0].id, draft.groups[0].conditions[0].id, { operator: event.target.value as RuleCondition["operator"] })}>{RULE_OPERATOR_OPTIONS.map((value) => <option key={value} value={value}>{conditionOperatorLabel(value, t)}</option>)}</select>
                  <input className={inputSurface} aria-label={t("value")} aria-invalid={(submitAttempted || touched.conditions) && Boolean(errors.conditions)} value={String(draft.groups[0]?.conditions[0]?.value ?? "")} onBlur={() => setTouched((current) => ({ ...current, conditions: true }))} onChange={(event) => updateCondition(draft.groups[0].id, draft.groups[0].conditions[0].id, { value: event.target.value })} />
                </div>
                {(submitAttempted || touched.conditions) && errors.conditions && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationConditionRequired")}</p>}
              </div>
              <div className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] p-3">
                <strong className="text-sm">{t("automationThen")}</strong>
                <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-[var(--muted)]">{t("purpose")}<select className={selectSurface} value={draft.purpose} onChange={(event) => setDraft((current) => ({ ...current, purpose: event.target.value as Purpose }))}>{RULE_PURPOSE_OPTIONS.map((value) => <option key={value} value={value}>{purposeLabel(value, t)}</option>)}</select></label><label className="grid gap-1 text-xs text-[var(--muted)]">{t("lifecycle")}<select className={selectSurface} value={draft.lifecycle} onChange={(event) => setDraft((current) => ({ ...current, lifecycle: event.target.value as Lifecycle }))}>{RULE_LIFECYCLE_OPTIONS.map((value) => <option key={value} value={value}>{lifecycleLabel(value, t)}</option>)}</select></label></div>
              </div>
              <div className="rounded-[var(--zc-radius-field)] border border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] p-3 text-sm text-[var(--zc-success-text)]">{t("automationSafetyBoundary")}</div>
            </section>

            <section className="grid gap-3">
              <button type="button" className={cn(buttonSecondary, "justify-between")} aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>{t("automationAdvanced")}<ChevronDown size={16} className={cn("transition-transform", advanced && "rotate-180")} /></button>
              {advanced && <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-[var(--muted)]">{t("rootOperator")}<select className={selectSurface} value={draft.rootOperator} onChange={(event) => setDraft((current) => ({ ...current, rootOperator: event.target.value as RuleOperator }))}>{RULE_LOGIC_OPTIONS.map((value) => <option key={value} value={value}>{t(value === "AND" ? "automationLogicAnd" : "automationLogicOr")}</option>)}</select></label><label className="grid gap-1 text-xs text-[var(--muted)]">{t("weight")}<input className={inputSurface} type="number" min={0} max={100} value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: Number(event.target.value) }))} /></label></div>
                {draft.groups.map((group, groupIndex) => <div key={group.id} className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] p-3"><div className="flex items-center justify-between"><strong className="text-sm">{t("ruleGroup")} {groupIndex + 1}</strong><button type="button" className={buttonIconDanger} disabled={draft.groups.length === 1} aria-label={t("deleteGroup")} onClick={() => setDraft((current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id) }))}><Trash2 size={15} /></button></div>{group.conditions.map((condition) => <div key={condition.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]"><select className={selectSurface} value={condition.field} onChange={(event) => updateCondition(group.id, condition.id, { field: event.target.value as RuleCondition["field"] })}>{RULE_FIELD_OPTIONS.map((value) => <option key={value} value={value}>{conditionFieldLabel(value, t)}</option>)}</select><select className={selectSurface} value={condition.operator} onChange={(event) => updateCondition(group.id, condition.id, { operator: event.target.value as RuleCondition["operator"] })}>{RULE_OPERATOR_OPTIONS.map((value) => <option key={value} value={value}>{conditionOperatorLabel(value, t)}</option>)}</select><input className={inputSurface} value={String(condition.value)} onChange={(event) => updateCondition(group.id, condition.id, { value: event.target.value })} /><button type="button" className={buttonIconDanger} disabled={group.conditions.length === 1} aria-label={t("deleteCondition")} onClick={() => setDraft((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, conditions: item.conditions.filter((entry) => entry.id !== condition.id) } : item) }))}><Trash2 size={15} /></button></div>)}<button type="button" className={buttonSecondary} onClick={() => setDraft((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, conditions: [...item.conditions, createRuleCondition({ value: "" })] } : item) }))}><Plus size={15} />{t("addCondition")}</button></div>)}
                <button type="button" className={buttonSecondary} onClick={() => setDraft((current) => ({ ...current, groups: [...current.groups, createRuleGroup({ value: "" })] }))}><Plus size={15} />{t("addGroup")}</button>
              </div>}
            </section>
          </div>
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--zc-divider)] p-4">{saveError && <p className="mr-auto text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationSaveFailed")}: {saveError}</p>}<button type="button" className={buttonSecondary} disabled={saving} onClick={requestClose}>{t("cancel")}</button><button type="button" className={glassButtonPrimary} disabled={saving || Boolean(errors.name || errors.conditions)} onClick={() => void submit()}>{saving ? t("loading") : t("saveRule")}</button></footer>
        </section>
      </div>
    </ModalPortal>
    <ConfirmDialog open={discardOpen} tone="warning" title={t("automationDiscardTitle")} description={t("automationDiscardDesc")} confirmLabel={t("automationDiscardAction")} cancelLabel={t("cancel")} restoreFocus={() => closeRef.current} onCancel={() => setDiscardOpen(false)} onConfirm={() => { setDiscardOpen(false); onClose(); }} />
  </>;
}
