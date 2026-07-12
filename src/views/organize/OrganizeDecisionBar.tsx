import { ArrowRight } from "lucide-react";
import type { Translator } from "../../types/ui";
import { cn, glassButtonPrimary, raisedSurface } from "../../utils/tw";
import type { OrganizeDecisionSummary } from "./organizeModel";

export function OrganizeDecisionBar({ summary, t, onPreview }: { summary: OrganizeDecisionSummary; t: Translator; onPreview: () => void }) {
  return (
    <section className={cn(raisedSurface, "sticky bottom-0 z-10 grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center")} aria-live="polite" aria-atomic="true">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--zc-text-secondary)]">
        <Count label={t("organizeDecisionAccepted")} value={summary.accepted} />
        <Count label={t("organizeDecisionKept")} value={summary.kept} />
        <Count label={t("organizeDecisionEdited")} value={summary.edited} />
        <Count label={t("organizeDecisionNeedsReview")} value={summary.needsReview} />
        <Count label={t("organizeDecisionBlocked")} value={summary.blocked} />
      </div>
      <button className={glassButtonPrimary} disabled={summary.executable === 0} onClick={onPreview}>
        {t("organizePreviewAccepted").replace("{count}", summary.executable.toLocaleString())}
        <ArrowRight size={16} />
      </button>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <span><strong className="font-semibold tabular-nums text-[var(--zc-text-primary)]">{value.toLocaleString()}</strong> {label}</span>;
}
