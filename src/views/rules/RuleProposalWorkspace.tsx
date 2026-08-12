import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Loader2,
  Pencil,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2
} from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useI18nContext } from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { resolveLegacyLibraryScope } from "../../store/useFileLibraryV2Store";
import { useRuleProposalStore } from "../../store/useRuleProposalStore";
import type { AISettings, Rule, RuleProposal } from "../../types/domain";
import { buttonGhost, buttonSecondary, cn, contentPanel, glassButtonPrimary, inputSurface, selectSurface } from "../../utils/tw";
import { readableError } from "../../utils/viewHelpers";
import { isBrowserMockEnabled } from "../../utils/runtimeMode";
import { ConfirmDialog, mutedText, panelSurface } from "../shared/ui";

interface Props {
  rules: Rule[];
  onOpenManualBuilder: (trigger: HTMLElement) => void;
  onEditCandidate: (proposal: RuleProposal, trigger: HTMLElement) => void;
  onApplied?: () => void;
  embedded?: boolean;
}

export function RuleProposalWorkspace({ rules, onOpenManualBuilder, onEditCandidate, onApplied, embedded = false }: Props) {
  const { t } = useI18nContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const proposals = useRuleProposalStore((state) => state.proposals);
  const activeId = useRuleProposalStore((state) => state.activeId);
  const impact = useRuleProposalStore((state) => state.impact);
  const busy = useRuleProposalStore((state) => state.busy);
  const generationOwner = useRuleProposalStore((state) => state.generationOwner);
  const error = useRuleProposalStore((state) => state.error);
  const load = useRuleProposalStore((state) => state.load);
  const select = useRuleProposalStore((state) => state.select);
  const generate = useRuleProposalStore((state) => state.generate);
  const regenerate = useRuleProposalStore((state) => state.regenerate);
  const cancelActiveGeneration = useRuleProposalStore((state) => state.cancelActiveGeneration);
  const cancel = useRuleProposalStore((state) => state.cancel);
  const preview = useRuleProposalStore((state) => state.preview);
  const resolveExact = useRuleProposalStore((state) => state.resolveExact);
  const apply = useRuleProposalStore((state) => state.apply);
  const deleteProposal = useRuleProposalStore((state) => state.deleteProposal);
  const clearError = useRuleProposalStore((state) => state.clearError);
  const [prompt, setPrompt] = useState("");
  const [intent, setIntent] = useState<"create" | "update">("create");
  const [targetRuleId, setTargetRuleId] = useState("");
  const [provider, setProvider] = useState<AISettings | null>(null);
  const [providerError, setProviderError] = useState("");
  const [confirmApply, setConfirmApply] = useState(false);
  const active = proposals.find((proposal) => proposal.id === activeId) ?? proposals[0] ?? null;
  const targetRule = rules.find((rule) => rule.id === targetRuleId);
  const providerLabel = provider
    ? `${provider.preset} · ${provider.model || "—"}`
    : "—";

  useEffect(() => {
    void load();
    let cancelled = false;
    tauriApi.getAISettings()
      .then((settings) => { if (!cancelled) setProvider(settings); })
      .catch((reason) => { if (!cancelled) setProviderError(readableError(reason)); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (intent === "update" && !targetRuleId) setTargetRuleId(rules[0]?.id ?? "");
  }, [intent, rules, targetRuleId]);

  const canGenerate = prompt.trim().length > 0
    && prompt.trim().length <= 4_000
    && (intent === "create" || Boolean(targetRule));
  const canPreview = active?.status === "ready" && active.validation.permissionClass !== "deny";
  const canApply = canPreview
    && impact?.proposalId === active?.id
    && impact.impactState === "exact"
    && impact.permissionClass !== "deny";
  const terminalDelete = active
    && ["applied", "cancelled", "invalid", "failed"].includes(active.status);
  const currentTarget = active?.targetRuleId
    ? rules.find((rule) => rule.id === active.targetRuleId)
    : undefined;

  async function submitGeneration() {
    if (!canGenerate) return;
    clearError();
    await generate(prompt.trim(), intent === "update" ? targetRule : undefined);
  }

  async function runPreview() {
    if (!active) return;
    const durableScope = await resolveLegacyLibraryScope(scope);
    await preview(active, durableScope);
  }

  return (
    <section className={cn(!embedded && panelSurface, "grid gap-4", embedded ? "p-0" : "p-4")} aria-labelledby="rule-proposal-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-[var(--zc-primary)]" />
            <h2 id="rule-proposal-title" className="text-sm font-semibold">{t("ruleProposalTitle")}</h2>
          </div>
          <p className={cn(mutedText, "mt-1")}>{t("ruleProposalSubtitle")}</p>
        </div>
        <button type="button" className={buttonSecondary} onClick={(event) => onOpenManualBuilder(event.currentTarget)}>
          <Pencil size={15} />{t("ruleProposalManualBuilder")}
        </button>
      </div>

      <div className={cn(contentPanel, "grid gap-3 p-3")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Bot size={15} aria-hidden="true" />
          <span>{providerLabel}</span>
          <span className="text-[var(--muted)]">·</span>
          <span className="inline-flex items-center gap-1 text-[var(--zc-success-text)]">
            <ShieldCheck size={14} />{t("ruleProposalPrivacy")}
          </span>
        </div>
        {provider && !provider.enabled && (
          <p
            className="text-sm text-[var(--zc-warning-text)]"
            data-proposal-status="provider-disabled"
            aria-live="polite"
          >
            {t("ruleProposalProviderOff")}
          </p>
        )}
        {providerError && <p className="text-xs text-[var(--zc-danger-text)]" role="alert">{providerError}</p>}
        <div className="grid gap-2 md:grid-cols-[170px_minmax(0,1fr)]">
          <select
            className={selectSurface}
            aria-label={t("ruleProposalIntent")}
            value={intent}
            onChange={(event) => setIntent(event.target.value as "create" | "update")}
          >
            <option value="create">{t("ruleProposalCreate")}</option>
            <option value="update">{t("ruleProposalUpdate")}</option>
          </select>
          {intent === "update" && (
            <select
              className={selectSurface}
              aria-label={t("ruleProposalTarget")}
              value={targetRuleId}
              onChange={(event) => setTargetRuleId(event.target.value)}
            >
              {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
            </select>
          )}
        </div>
        <textarea
          className={cn(inputSurface, "min-h-24 resize-y")}
          maxLength={4_000}
          aria-label={t("ruleProposalTitle")}
          placeholder={t("ruleProposalPrompt")}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn(mutedText, "text-xs")}>{t("ruleProposalExamples")}</p>
          <span className="text-xs tabular-nums text-[var(--muted)]">{prompt.length}/4000</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={glassButtonPrimary}
            disabled={!canGenerate || busy}
            onClick={() => void submitGeneration()}
          >
            {generationOwner ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {t("ruleProposalGenerate")}
          </button>
          {generationOwner && (
            <button type="button" className={buttonSecondary} onClick={() => void cancelActiveGeneration()}>
              <Square size={14} />{t("ruleProposalCancel")}
            </button>
          )}
        </div>
        {generationOwner && (
          <p className={mutedText} data-proposal-status="generating" aria-live="polite">
            {t("ruleProposalGenerating")}
          </p>
        )}
        {isBrowserMockEnabled() && <p className={mutedText}>{t("ruleProposalBrowserMock")}</p>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--zc-danger-border)] bg-[var(--zc-danger-bg)] p-3 text-sm text-[var(--zc-danger-text)]" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
        <div className="grid content-start gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("ruleProposalHistory")}</h3>
            <span className="text-xs tabular-nums text-[var(--muted)]">{proposals.length}</span>
          </div>
          {proposals.length === 0 ? <p className={cn(contentPanel, "p-3 text-sm text-[var(--muted)]")}>{t("ruleProposalEmpty")}</p> : (
            <ul className="grid max-h-80 gap-2 overflow-auto" aria-label={t("ruleProposalHistory")}>
              {proposals.map((proposal) => (
                <li key={proposal.id}>
                  <button
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-3 text-left",
                      proposal.id === active?.id
                        ? "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)]"
                        : "border-[var(--zc-divider)] bg-[var(--zc-panel)]"
                    )}
                    onClick={() => void select(proposal.id)}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{proposal.candidate?.name ?? proposal.prompt}</strong>
                      <span className="mt-1 block text-xs text-[var(--muted)]">{proposal.status} · r{proposal.revision}</span>
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(contentPanel, "grid min-w-0 content-start gap-3 p-4")} aria-live="polite">
          {!active ? <p className={mutedText}>{t("ruleProposalEmpty")}</p> : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {active.status === "applied" ? <CheckCircle2 size={16} className="text-[var(--zc-success-text)]" /> : <FileSearch size={16} />}
                    <h3 className="font-semibold">{active.candidate?.name ?? active.prompt}</h3>
                  </div>
                  <p className={cn(mutedText, "mt-1 text-xs")}>
                    {active.providerPreset ?? "manual"} · {active.model ?? "—"} · {active.candidateOrigin === "manual" ? t("ruleProposalManualCandidate") : active.candidateOrigin ?? "provider"} · {active.validation.permissionClass}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--zc-divider)] px-2 py-1 text-xs">{active.status}</span>
              </div>

              {active.summary && <p className="whitespace-pre-wrap text-sm">{active.summary}</p>}
              {active.candidateOrigin === "manual" && <p className="rounded-lg bg-[var(--zc-warning-soft)] p-3 text-sm text-[var(--zc-warning-text)]">{t("ruleProposalManualCandidate")}</p>}
              {active.status === "applied" && (
                <p className="rounded-lg bg-[var(--zc-success-soft)] p-3 text-sm text-[var(--zc-success-text)]">{t("ruleProposalApplied")}</p>
              )}
              {active.clarifications.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {active.clarifications.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                </ul>
              )}
              {!active.candidate && active.status !== "applied" && <p className={mutedText}>{t("ruleProposalNoCandidate")}</p>}
              {active.candidate && (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">{t("ruleProposalValidation")}</strong>
                    <button type="button" className={buttonGhost} onClick={(event) => onEditCandidate(active, event.currentTarget)}>
                      <Pencil size={14} />{t("ruleProposalEdit")}
                    </button>
                  </div>
                  <div className="grid gap-2 text-sm">
                    {active.candidate.groups.map((group) => (
                      <div key={group.id} className="rounded-lg border border-[var(--zc-divider)] p-2">
                        <span className="text-xs font-semibold">{group.operator}</span>
                        {group.conditions.map((condition) => (
                          <p key={condition.id} className="mt-1 break-words font-mono text-xs">
                            {condition.field} {condition.operator} {JSON.stringify(condition.value)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                  {[...active.validation.codes, ...active.validation.warnings].map((code) => (
                    <p key={code} className="text-xs text-[var(--zc-warning-text)]">{code}</p>
                  ))}
                </div>
              )}

              {impact?.proposalId === active.id && (
                <div className="grid gap-2 rounded-lg border border-[var(--zc-divider)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">
                      {impact.matchedCount?.toLocaleString() ?? "—"} {t("ruleProposalMatched")}
                    </strong>
                    <span className="text-xs">{impact.impactState}</span>
                  </div>
                  <dl className="grid gap-1 text-xs text-[var(--zc-text-secondary)] sm:grid-cols-2">
                    <div><dt className="font-semibold">{t("ruleProposalScopeHealth")}</dt><dd>{impact.scopeHealth.state}</dd></div>
                    <div><dt className="font-semibold">{t("ruleProposalPermissionClass")}</dt><dd>{impact.permissionClass}</dd></div>
                    <div><dt className="font-semibold">{t("ruleProposalRisk")}</dt><dd>{impact.riskSummary.length ? impact.riskSummary.join(" · ") : t("ruleProposalNo")}</dd></div>
                    <div><dt className="font-semibold">{t("ruleProposalConfirmation")}</dt><dd>{impact.requiresConfirmation ? t("ruleProposalYes") : t("ruleProposalNo")}</dd></div>
                    <div><dt className="font-semibold">{t("ruleProposalBroadMatch")}</dt><dd>{impact.broadMatch ? t("ruleProposalYes") : t("ruleProposalNo")}</dd></div>
                    <div><dt className="font-semibold">{t("ruleProposalConflictState")}</dt><dd>{impact.conflictAnalysisState === "complete_candidate_list" ? t("ruleProposalComplete") : t("ruleProposalBoundedSample")}</dd></div>
                  </dl>
                  {impact.impactState === "deferred" && <p className={mutedText}>{t("ruleProposalDeferred")}</p>}
                  {impact.sampleRows.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold">{t("ruleProposalSamples")} (≤20)</p>
                      <ul className="grid max-h-40 gap-1 overflow-auto text-xs">
                        {impact.sampleRows.map((sample) => (
                          <li key={sample.fileId} className="grid gap-1 rounded bg-[var(--zc-panel)] px-2 py-1">
                            <span className="flex justify-between gap-3"><span className="truncate">{sample.name}</span><span className="shrink-0 tabular-nums">{sample.size.toLocaleString()} B</span></span>
                            <span className="break-words text-[var(--muted)]">{sample.beforeAction} → {sample.afterAction ?? "—"} · {sample.beforePurpose ?? "—"} → {sample.afterPurpose ?? "—"} · winner {sample.beforeWinnerRule ?? "—"} → {sample.afterWinnerRule ?? "—"} · runner {sample.beforeRunnerRule ?? "—"} → {sample.afterRunnerRule ?? "—"}</span>
                            {sample.afterReason ? <span className="break-words text-[var(--muted)]">{sample.beforeReason ?? "—"} → {sample.afterReason}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {impact.conflicts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold">{t("ruleProposalConflicts")}</p>
                      {impact.conflicts.map((conflict) => <p key={conflict.ruleId} className="text-xs text-[var(--zc-warning-text)]">{conflict.name}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[var(--zc-divider)] pt-3">
                {canPreview && (
                  <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void runPreview()}>
                    <FileSearch size={14} />{t("ruleProposalPreview")}
                  </button>
                )}
                {impact?.proposalId === active.id && impact.impactState === "deferred" && (
                  <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void resolveExact(active)}>
                    <Loader2 size={14} className={busy ? "animate-spin" : ""} />{t("ruleProposalExact")}
                  </button>
                )}
                <button type="button" className={glassButtonPrimary} disabled={!canApply || busy} onClick={() => setConfirmApply(true)}>
                  <CheckCircle2 size={14} />{t("ruleProposalApply")}
                </button>
                {["needs_clarification", "invalid", "failed", "stale"].includes(active.status) && (
                  <button type="button" className={buttonSecondary} disabled={busy || !prompt.trim()} onClick={() => void regenerate(active, prompt.trim(), currentTarget)}>
                    <Sparkles size={14} />{t("ruleProposalRegenerate")}
                  </button>
                )}
                {!["applied", "cancelled"].includes(active.status) && active.status !== "generating" && (
                  <button type="button" className={buttonGhost} disabled={busy} onClick={() => void cancel(active)}>
                  <Square size={14} />{t("ruleProposalCancel")}
                  </button>
                )}
                {terminalDelete && (
                  <button type="button" className={buttonGhost} disabled={busy} onClick={() => void deleteProposal(active)}>
                    <Trash2 size={14} />{t("ruleProposalDelete")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmApply}
        tone="warning"
        title={t("ruleProposalApplyTitle")}
        description={t("ruleProposalApplyDescription")}
        emphasis={t("ruleProposalApplySafety")}
        confirmLabel={t("ruleProposalApply")}
        cancelLabel={t("ruleProposalCancel")}
        isProcessing={busy}
        onCancel={() => setConfirmApply(false)}
        onConfirm={() => {
          if (!active) return;
          void apply(active).then(() => {
            setConfirmApply(false);
            onApplied?.();
          });
        }}
      />
    </section>
  );
}
