import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import type { ConditionField, Lifecycle, Purpose, Rule, RuleCondition, RuleOperator } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { nowIso } from "../../utils/viewHelpers";
import { buttonGhost, buttonIconDanger, buttonSecondary, cn, glassButtonPrimary, inputSurface, selectSurface } from "../../utils/tw";
import { ModalPortal } from "../../components/modal/ModalPortal";
import { ConfirmDialog, mutedText, panelSurface } from "../shared/ui";
import {
  RULE_FIELD_OPTIONS,
  RULE_LIFECYCLE_OPTIONS,
  RULE_LOGIC_OPTIONS,
  RULE_PURPOSE_OPTIONS,
  buildRuleFromBuilderDraft,
  conditionInputType,
  conditionOptions,
  conditionOperatorsForField,
  createRuleCondition,
  createRuleGroup,
  normalizeConditionForField,
  parseConditionInput,
  type ConditionValidationError,
  type RuleDraftValidation
} from "../rules/ruleBuilder";
import {
  conditionFieldLabel,
  conditionOperatorLabel,
  draftActionSummary,
  draftConditionSummary,
  lifecycleLabel,
  purposeLabel,
  validateRuleDraft
} from "./automationModel";

type Draft = {
  name: string;
  rootOperator: RuleOperator;
  groups: Rule["groups"];
  purpose: Purpose;
  lifecycle: Lifecycle;
  weight: number;
  priority: number;
};

function draftFrom(rule?: Rule): Draft {
  return {
    name: rule?.name ?? "",
    rootOperator: rule?.root_operator ?? "AND",
    groups: rule?.groups.map((group) => ({ ...group, conditions: group.conditions.map((condition) => ({ ...condition })) })) ?? [createRuleGroup({ value: "" })],
    purpose: rule?.action.purpose ?? "Temporary",
    lifecycle: rule?.action.lifecycle ?? "Inbox",
    weight: rule?.weight ?? 75,
    priority: rule?.priority ?? 75
  };
}

function validationMessage(error: ConditionValidationError | undefined, t: Translator) {
  if (error === "required") return t("automationConditionRequired");
  if (error === "operator") return t("automationConditionOperatorInvalid");
  if (error === "number" || error === "nonNegative") return t("automationConditionNumberInvalid");
  if (error === "integer") return t("automationConditionInteger");
  if (error === "option") return t("automationConditionOptionInvalid");
  if (error === "boolean") return t("automationConditionBooleanInvalid");
  return "";
}

function conditionError(validation: RuleDraftValidation, groupId: string, conditionId: string) {
  return validation.conditionErrors[`${groupId}:${conditionId}`];
}

function ConditionEditor({
  condition,
  error,
  t,
  onChange,
  onBlur,
  onDelete,
  deleteDisabled
}: {
  condition: RuleCondition;
  error?: ConditionValidationError;
  t: Translator;
  onChange: (next: RuleCondition) => void;
  onBlur?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const inputType = conditionInputType(condition.field);
  const options = conditionOptions(condition.field);
  const value = inputType === "boolean"
    ? condition.value === true || condition.value === "true" ? "true" : "false"
    : String(condition.value ?? "");
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <select
        className={selectSurface}
        aria-label={t("field")}
        value={condition.field}
        onChange={(event) => onChange(normalizeConditionForField(condition, event.target.value as ConditionField))}
      >
        {RULE_FIELD_OPTIONS.map((field) => <option key={field} value={field}>{conditionFieldLabel(field, t)}</option>)}
      </select>
      <select
        className={selectSurface}
        aria-label={t("operator")}
        value={condition.operator}
        onChange={(event) => onChange({ ...condition, operator: event.target.value as RuleCondition["operator"] })}
      >
        {conditionOperatorsForField(condition.field).map((operator) => <option key={operator} value={operator}>{conditionOperatorLabel(operator, t)}</option>)}
      </select>
      {inputType === "select" || inputType === "boolean" ? (
        <select
          className={selectSurface}
          aria-label={t("value")}
          aria-invalid={Boolean(error)}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange({ ...condition, value: parseConditionInput(condition.field, event.target.value) })}
        >
          {options.map((option) => <option key={option} value={option}>{condition.field === "file_type" ? t(`libraryType${option === "ArchivePackage" ? "Archive" : option}` as Parameters<Translator>[0]) : condition.field === "risk_level" ? t(`libraryRisk${option}` as Parameters<Translator>[0]) : option === "true" ? t("automationBooleanTrue") : t("automationBooleanFalse")}</option>)}
        </select>
      ) : (
        <input
          className={inputSurface}
          type={inputType === "number" ? "number" : "text"}
          min={inputType === "number" ? 0 : undefined}
          step={condition.field === "modified_at" ? 1 : inputType === "number" ? "any" : undefined}
          inputMode={inputType === "number" ? "decimal" : undefined}
          aria-label={t("value")}
          aria-invalid={Boolean(error)}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange({ ...condition, value: parseConditionInput(condition.field, event.target.value) })}
        />
      )}
      {onDelete && <button type="button" className={buttonIconDanger} disabled={deleteDisabled} aria-label={t("deleteCondition")} onClick={onDelete}><Trash2 size={15} /></button>}
      {error && <p className="col-span-full text-xs text-[var(--zc-danger-text)]" role="alert">{validationMessage(error, t)}</p>}
    </div>
  );
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
  const [touched, setTouched] = useState({ name: false, conditions: false, weight: false, priority: false });
  const [saveError, setSaveError] = useState("");
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const validation = validateRuleDraft(draft.name, draft.groups, draft.weight, draft.priority);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setAdvanced(false);
    setDiscardOpen(false);
    setSubmitAttempted(false);
    setTouched({ name: false, conditions: false, weight: false, priority: false });
    setSaveError("");
  }, [initial, open]);

  if (!open) return null;

  function requestClose() {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  function updateCondition(groupId: string, conditionId: string, next: RuleCondition) {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === groupId
        ? { ...group, conditions: group.conditions.map((condition) => condition.id === conditionId ? next : condition) }
        : group)
    }));
  }

  async function submit() {
    setSubmitAttempted(true);
    setTouched({ name: true, conditions: true, weight: true, priority: true });
    if (!validation.valid || saving) return;
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
        priority: draft.priority,
        enabled: rule?.enabled,
        now: rule?.created_at ?? now
      });
      next.priority = rule?.priority ?? draft.priority;
      next.enabled = rule?.enabled ?? false;
      next.created_at = rule?.created_at ?? next.created_at;
      next.updated_at = now;
      await onSave(next);
      onClose();
    } catch {
      setSaveError(t("automationSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const firstCondition = draft.groups[0]?.conditions[0];
  const firstError = firstCondition ? conditionError(validation, draft.groups[0].id, firstCondition.id) : undefined;

  return <>
    <ModalPortal initialFocusRef={nameRef} restoreFocus={restoreFocus} onEscape={requestClose}>
      <div className="fixed inset-0 grid place-items-center overflow-y-auto bg-[var(--zc-overlay)] p-3 backdrop-blur-sm sm:p-6">
        <section className={cn(panelSurface, "my-auto grid max-h-[min(760px,calc(100vh-24px))] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="flex items-start justify-between gap-4 border-b border-[var(--zc-divider)] p-5">
            <div><h2 id={titleId} className="text-lg font-semibold">{rule ? t("automationEditRule") : t("automationCreateRule")}</h2><p className={cn(mutedText, "mt-1")}>{t("automationEditorDesc")}</p></div>
            <button ref={closeRef} type="button" className={buttonGhost} aria-label={t("close")} onClick={requestClose}><X size={17} /></button>
          </header>
          <div className="grid gap-5 overflow-y-auto p-5">
            <section className="grid gap-3 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3" aria-live="polite">
              <strong className="text-sm">{t("automationSummaryTitle")}</strong>
              <p className="text-sm"><span className="text-[var(--muted)]">{t("automationWhen")}</span> {draftConditionSummary(draft.groups, draft.rootOperator, t)}</p>
              <p className="text-sm"><span className="text-[var(--muted)]">{t("automationThen")}</span> {draftActionSummary(draft.purpose, draft.lifecycle, t)}</p>
              <p className={mutedText}>{rule ? (rule.enabled ? t("automationEnabledDesc") : t("automationPausedDesc")) : t("automationNewRulePausedHint")}</p>
            </section>

            <section className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">{t("ruleName")}<input ref={nameRef} className={inputSurface} value={draft.name} aria-invalid={Boolean((submitAttempted || touched.name) && validation.name)} onBlur={() => setTouched((current) => ({ ...current, name: true }))} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              {(submitAttempted || touched.name) && validation.name && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{validation.name === "tooLong" ? t("automationNameTooLong") : t("automationNameRequired")}</p>}

              <button type="button" className={cn(buttonSecondary, "justify-between")} aria-expanded={advanced} aria-controls={`${titleId}-condition-editor`} onClick={() => setAdvanced((value) => !value)}>{t("automationAdvanced")}<ChevronDown size={16} className={cn("transition-transform", advanced && "rotate-180")} /></button>

              {!advanced && <div id={`${titleId}-condition-editor`} className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] p-3">
                <strong className="text-sm">{t("automationWhen")}</strong>
                {firstCondition ? <ConditionEditor condition={firstCondition} error={(submitAttempted || touched.conditions) ? firstError : undefined} t={t} onBlur={() => setTouched((current) => ({ ...current, conditions: true }))} onChange={(next) => updateCondition(draft.groups[0].id, firstCondition.id, next)} /> : <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationConditionRequired")}</p>}
                {draft.groups.length > 1 && <p className={cn(mutedText, "text-xs")}>{t("automationAdvancedSummary")}: {draftConditionSummary(draft.groups, draft.rootOperator, t)}</p>}
              </div>}

              <div className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] p-3">
                <strong className="text-sm">{t("automationThen")}</strong>
                <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-[var(--muted)]">{t("purpose")}<select className={selectSurface} value={draft.purpose} onChange={(event) => setDraft((current) => ({ ...current, purpose: event.target.value as Purpose }))}>{RULE_PURPOSE_OPTIONS.map((value) => <option key={value} value={value}>{purposeLabel(value, t)}</option>)}</select></label><label className="grid gap-1 text-xs text-[var(--muted)]">{t("lifecycle")}<select className={selectSurface} value={draft.lifecycle} onChange={(event) => setDraft((current) => ({ ...current, lifecycle: event.target.value as Lifecycle }))}>{RULE_LIFECYCLE_OPTIONS.map((value) => <option key={value} value={value}>{lifecycleLabel(value, t)}</option>)}</select></label></div>
              </div>
              <div className="rounded-[var(--zc-radius-field)] border border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] p-3 text-sm text-[var(--zc-success-text)]">{t("automationSafetyBoundary")}</div>
            </section>

            {advanced && <section id={`${titleId}-advanced-editor`} className="grid gap-3" aria-label={t("automationAdvanced")}>
              <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-[var(--muted)]">{t("rootOperator")}<select className={selectSurface} value={draft.rootOperator} onChange={(event) => setDraft((current) => ({ ...current, rootOperator: event.target.value as RuleOperator }))}>{RULE_LOGIC_OPTIONS.map((value) => <option key={value} value={value}>{t(value === "AND" ? "automationLogicAnd" : "automationLogicOr")}</option>)}</select></label><label className="grid gap-1 text-xs text-[var(--muted)]">{t("automationWeight")}<input className={inputSurface} type="number" min={0} max={100} step="any" value={Number.isFinite(draft.weight) ? draft.weight : ""} aria-invalid={Boolean((submitAttempted || touched.weight) && validation.weight)} onBlur={() => setTouched((current) => ({ ...current, weight: true }))} onChange={(event) => setDraft((current) => ({ ...current, weight: event.target.value === "" ? Number.NaN : Number(event.target.value) }))} /></label></div>
              {(submitAttempted || touched.weight) && validation.weight && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationWeightInvalid")}</p>}
              <label className="grid gap-1 text-xs text-[var(--muted)]">{t("automationPriority")}<input className={inputSurface} type="number" min={0} max={1000} step="any" value={Number.isFinite(draft.priority) ? draft.priority : ""} aria-invalid={Boolean((submitAttempted || touched.priority) && validation.priority)} onBlur={() => setTouched((current) => ({ ...current, priority: true }))} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value === "" ? Number.NaN : Number(event.target.value) }))} /></label>
              {(submitAttempted || touched.priority) && validation.priority && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{t("automationPriorityInvalid")}</p>}
              {draft.groups.map((group, groupIndex) => <div key={group.id} className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] p-3"><div className="flex items-center justify-between"><strong className="text-sm">{t("ruleGroup")} {groupIndex + 1}</strong><button type="button" className={buttonIconDanger} disabled={draft.groups.length === 1} aria-label={t("deleteGroup")} onClick={() => setDraft((current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id) }))}><Trash2 size={15} /></button></div>{group.conditions.map((condition) => <ConditionEditor key={condition.id} condition={condition} error={(submitAttempted || touched.conditions) ? conditionError(validation, group.id, condition.id) : undefined} t={t} onBlur={() => setTouched((current) => ({ ...current, conditions: true }))} onChange={(next) => updateCondition(group.id, condition.id, next)} onDelete={() => setDraft((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, conditions: item.conditions.filter((entry) => entry.id !== condition.id) } : item) }))} deleteDisabled={group.conditions.length === 1} />)}<button type="button" className={buttonSecondary} onClick={() => setDraft((current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? { ...item, conditions: [...item.conditions, createRuleCondition({ value: "" })] } : item) }))}><Plus size={15} />{t("addCondition")}</button></div>)}
              <button type="button" className={buttonSecondary} onClick={() => setDraft((current) => ({ ...current, groups: [...current.groups, createRuleGroup({ value: "" })] }))}><Plus size={15} />{t("addGroup")}</button>
            </section>}
          </div>
          <footer className="grid gap-2 border-t border-[var(--zc-divider)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><p className={cn(mutedText, "text-xs")}>{t("automationSavePauseNotice")}</p><div className="flex flex-wrap items-center justify-end gap-2">{saveError && <p className="basis-full text-xs text-[var(--zc-danger-text)]" role="alert">{saveError}</p>}<button type="button" className={buttonSecondary} disabled={saving} onClick={requestClose}>{t("cancel")}</button><button type="button" className={glassButtonPrimary} disabled={saving || !validation.valid} onClick={() => void submit()}>{saving ? t("loading") : t("saveRule")}</button></div></footer>
        </section>
      </div>
    </ModalPortal>
    <ConfirmDialog open={discardOpen} tone="warning" title={t("automationDiscardTitle")} description={t("automationDiscardDesc")} confirmLabel={t("automationDiscardAction")} cancelLabel={t("cancel")} restoreFocus={() => closeRef.current} onCancel={() => setDiscardOpen(false)} onConfirm={() => { setDiscardOpen(false); onClose(); }} />
  </>;
}
