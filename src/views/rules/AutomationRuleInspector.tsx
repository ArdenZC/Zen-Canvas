import type { ReactNode, RefObject } from "react";
import { ArrowLeft, CirclePause, Eye, Pencil, Play, Trash2 } from "lucide-react";
import type { Rule } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { buttonGhost, buttonIconDanger, buttonSecondary, cn, contentPanel } from "../../utils/tw";
import { ruleActionSummary, ruleConditionSummary, scopeSummary } from "../automation/automationModel";
import { mutedText, panelSurface } from "../shared/ui";

function InspectorItem({ icon, label, value, hint }: { icon?: ReactNode; label: string; value: string; hint?: string }) {
  return <div className={cn(contentPanel, "grid content-start gap-1 p-3")}><div className="flex items-center gap-2 text-xs text-[var(--muted)]">{icon}{label}</div><strong className="mt-1 text-sm">{value}</strong>{hint && <span className="text-xs leading-5 text-[var(--muted)]" title={hint}>{hint}</span>}</div>;
}

function Availability({ label, available, t }: { label: string; available: boolean; t: Translator }) {
  return <div className="flex items-center justify-between gap-3 rounded-[var(--zc-radius-control)] border border-[var(--zc-border)] px-3 py-2"><span>{label}</span><span className={available ? "text-[var(--zc-success-text)]" : "text-[var(--muted)]"}>{available ? t("automationAvailable") : t("automationUnavailable")}</span></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "-" : date.toLocaleString();
}

export function AutomationRuleInspector({ rule, isNarrow, editRef, onBack, onEdit, onDelete, onOpenReview, t }: {
  rule: Rule;
  isNarrow: boolean;
  editRef?: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: () => void;
  onOpenReview: () => void;
  t: Translator;
}) {
  return <section className="grid gap-5" aria-labelledby="automation-inspector-title">
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">{isNarrow && <button type="button" className={buttonSecondary} aria-label={t("automationBackToRules")} onClick={onBack}><ArrowLeft size={16} /></button>}<div className="min-w-0"><h2 id="automation-inspector-title" className="truncate text-lg font-semibold">{rule.name}</h2><p className={cn(mutedText, "mt-1")}>{rule.enabled ? t("automationEnabledDesc") : t("automationPausedDesc")}</p></div></div>
      <div className="flex shrink-0 items-center gap-1"><button ref={editRef} type="button" className={buttonGhost} aria-label={t("automationEditRule")} onClick={(event) => onEdit(event.currentTarget)}><Pencil size={15} />{t("automationEditRule")}</button><button type="button" className={buttonIconDanger} aria-label={t("deleteRule")} title={t("deleteRule")} onClick={onDelete}><Trash2 size={15} /></button></div>
    </header>

    <section className="grid gap-3" aria-labelledby="automation-rule-config-title">
      <h3 id="automation-rule-config-title" className="text-sm font-semibold">{t("automationRuleConfiguration")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <InspectorItem icon={rule.enabled ? <Play size={16} /> : <CirclePause size={16} />} label={t("automationStatus")} value={rule.enabled ? t("automationEnabled") : t("automationPaused")} hint={rule.enabled ? t("automationEnabledDesc") : t("automationPausedDesc")} />
        <InspectorItem label={t("automationWeight")} value={String(rule.weight)} hint={t("automationWeightHint")} />
        <InspectorItem label={t("automationPriority")} value={String(rule.priority)} hint={t("automationPriorityHint")} />
        <InspectorItem label={t("automationCreatedAt")} value={formatDate(rule.created_at)} />
        <InspectorItem label={t("automationUpdatedAt")} value={formatDate(rule.updated_at)} />
      </div>
    </section>

    <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-4"><h3 className="text-sm font-semibold">{t("automationLogic")}</h3><p className="rounded-[var(--zc-radius-field)] bg-[var(--zc-surface-subtle)] p-3 text-sm"><span className="text-[var(--muted)]">{t("automationWhen")}</span> {ruleConditionSummary(rule, t)}<br /><span className="text-[var(--muted)]">{t("automationThen")}</span> {ruleActionSummary(rule, t)}</p></section>
    <button type="button" className={buttonSecondary} onClick={onOpenReview}><Eye size={16} />{t("automationOpenReview")}</button>
  </section>;
}

export function CurrentEnvironment({ scope, t }: { scope: ReturnType<typeof scopeSummary>; t: Translator }) {
  const scopeValue = scope.kind === "all" ? t("automationScopeAll") : t("automationScopeRoots").replace("{count}", String(scope.roots.length));
  const scopeHint = scope.roots.join(" · ") || t("automationScopeAllHint");
  return <section className={cn(panelSurface, "grid gap-3 p-4")} aria-labelledby="automation-environment-title">
    <div><h2 id="automation-environment-title" className="text-sm font-semibold">{t("automationCurrentEnvironment")}</h2><p className={cn(mutedText, "mt-1")}>{t("automationCurrentEnvironmentDesc")}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <InspectorItem label={t("automationCurrentFileLibraryScope")} value={scopeValue} hint={`${t("automationCurrentFileLibraryScopeDesc")} ${scopeHint}`} />
      <InspectorItem label={t("automationTrigger")} value={t("automationTriggerWatchedChange")} hint={t("automationTriggerHint")} />
      <InspectorItem label={t("automationConfirmationPolicy")} value={t("automationSuggestionsOnly")} hint={t("automationPreviewRequiredHint")} />
    </div>
    <div className="grid gap-2 border-t border-[var(--zc-divider)] pt-3"><h3 className="text-sm font-semibold">{t("automationCapabilities")}</h3><p className={mutedText}>{t("automationCapabilitiesDesc")}</p><div className="grid gap-2 text-sm"><Availability label={t("automationWatchedTrigger")} available t={t} /><Availability label={t("automationManualTrigger")} available t={t} /><Availability label={t("automationScheduleTrigger")} available={false} t={t} /><Availability label={t("automationPersistedHistory")} available={false} t={t} /></div></div>
  </section>;
}
