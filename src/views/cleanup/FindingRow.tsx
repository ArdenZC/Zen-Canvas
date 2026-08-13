import { Check, FileSearch, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import type { AnalysisFinding, AnalysisFindingEvidence } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { compactPath } from "../../utils/viewHelpers";
import { cn } from "../../utils/tw";
import { Button, ToneBadge, metadataText, quietText } from "../shared/ui";
import { isFindingSelectable, type CleanupTier } from "./cleanupModel";

export function FindingRow({
  finding,
  selected,
  evidence,
  evidenceExpanded,
  t,
  index,
  measureElement,
  style,
  onToggle,
  onReveal,
  onToggleEvidence,
  onRevalidate,
  interactionLocked,
  tierLabel
}: {
  finding: AnalysisFinding;
  selected: boolean;
  evidence?: AnalysisFindingEvidence[];
  evidenceExpanded: boolean;
  t: Translator;
  index: number;
  measureElement: (element: HTMLElement | null) => void;
  style: { transform: string };
  onToggle: (finding: AnalysisFinding) => void;
  onReveal: (finding: AnalysisFinding) => void;
  onToggleEvidence: (finding: AnalysisFinding) => void;
  onRevalidate: (finding: AnalysisFinding) => void;
  interactionLocked: boolean;
  tierLabel: (tier: string, t: Translator) => string;
}) {
  const isCaution = finding.tier === "caution";
  const selectable = isFindingSelectable(finding);
  const confidence = finding.confidence === "exact" ? t("storageCleanupConfidenceExact") : finding.confidence === "estimated" ? t("storageCleanupConfidenceEstimated") : t("storageCleanupConfidenceUnknown");
  return (
    <article
      className={cn("absolute left-0 top-0 grid w-full gap-2 border-b border-[var(--zc-divider)] px-4 py-3", selected && "bg-[var(--zc-surface-selected)]")}
      ref={measureElement}
      data-index={index}
      style={style}
      data-analysis-finding-id={finding.id}
      data-tier={finding.tier}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate text-sm text-[var(--zc-text-primary)]">{finding.title || finding.category}</strong>
            <ToneBadge tone={finding.tier === "safe" ? "success" : finding.tier === "review" ? "warning" : "danger"}>{tierLabel(finding.tier, t)}</ToneBadge>
            {selected ? <ToneBadge tone="info">{t("storageCleanupSelected")}</ToneBadge> : null}
          </div>
          <p className="mt-1 truncate text-xs text-[var(--zc-text-secondary)]" title={finding.pathSnapshot ?? undefined}>{finding.pathSnapshot ? compactPath(finding.pathSnapshot, 120) : t("storageCleanupPathUnavailable")}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--zc-text-primary)]">{formatBytes(finding.sizeBytes)}</span>
      </div>
      <div className="grid gap-1 text-sm leading-6 text-[var(--zc-text-secondary)]">
        <span><strong className="font-medium text-[var(--zc-text-primary)]">{t("storageCleanupFindingWhy")}:</strong> {finding.reason}</span>
        {finding.riskNote ? <span className="text-[var(--zc-warning-text)]"><strong className="font-medium">{t("storageCleanupFindingRisk")}:</strong> {finding.riskNote}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--zc-text-secondary)]">
        <span>{t("storageCleanupFindingConfidence")}: {confidence}</span>
        <span>{finding.executable ? t("storageCleanupFindingExecutable") : t("storageCleanupFindingBlocked")}</span>
        <span>{finding.category}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {finding.pathSnapshot ? <Button variant="ghost" size="compact" onClick={() => onReveal(finding)}><FolderOpen size={14} aria-hidden="true" />{t("storageCleanupReveal")}</Button> : null}
          <Button variant="ghost" size="compact" onClick={() => onToggleEvidence(finding)}><FileSearch size={14} aria-hidden="true" />{evidenceExpanded ? t("storageCleanupFindingHideEvidence") : t("storageCleanupFindingEvidence")}</Button>
          {finding.status === "stale" ? <Button variant="secondary" size="compact" disabled={interactionLocked} onClick={() => onRevalidate(finding)}><RefreshCw size={14} aria-hidden="true" />{t("storageCleanupFindingRecheck")}</Button> : null}
        </div>
        {isCaution ? <span className="text-xs font-medium text-[var(--zc-warning-text)]">{t("storageCleanupCautionHint")}</span> : <Button variant={selected ? "secondary" : "primary"} size="compact" disabled={interactionLocked || (!selectable && !(finding.tier === "review" && finding.status === "active" && finding.decision !== "acknowledged"))} aria-pressed={selected} onClick={() => onToggle(finding)}>{selected ? <Check size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}{selected ? t("storageCleanupSelected") : finding.tier === "review" && finding.decision !== "acknowledged" ? t("storageCleanupFindingAcknowledge") : t("storageCleanupSelectForTrash")}</Button>}
      </div>
      {evidenceExpanded ? <div className="grid gap-2 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3" data-finding-evidence><strong className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--zc-text-tertiary)]">{t("storageCleanupFindingEvidence")}</strong>{evidence?.length ? evidence.map((item) => <div key={item.id} className="text-xs leading-5 text-[var(--zc-text-secondary)]">{item.evidenceKind}{item.pathSnapshot ? ` · ${compactPath(item.pathSnapshot, 100)}` : ""}</div>) : <span className={quietText}>{t("storageCleanupFindingEvidenceEmpty")}</span>}</div> : null}
    </article>
  );
}

export function tierLabel(tier: string, t: Translator): string {
  if (tier === "safe") return t("storageCleanupSafeTier");
  if (tier === "review") return t("storageCleanupReviewTier");
  return t("storageCleanupCautionTier");
}
