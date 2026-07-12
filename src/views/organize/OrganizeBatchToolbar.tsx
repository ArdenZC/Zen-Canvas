import type { Translator } from "../../types/ui";
import { buttonGhost, buttonSecondary, cn } from "../../utils/tw";

export function OrganizeBatchToolbar({
  selectedCount,
  safeCount,
  keepableCount,
  clearableCount,
  blockedCount,
  needsReviewCount,
  t,
  onAcceptSafe,
  onKeep,
  onClear,
  onExit
}: {
  selectedCount: number;
  safeCount: number;
  keepableCount: number;
  clearableCount: number;
  blockedCount: number;
  needsReviewCount: number;
  t: Translator;
  onAcceptSafe: () => void;
  onKeep: () => void;
  onClear: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-3 py-2" role="toolbar" aria-label={t("organizeBatchMode")}>
      <strong className="mr-auto text-xs text-[var(--zc-text-primary)]">{t("organizeBatchSelected").replace("{count}", selectedCount.toLocaleString())}</strong>
      <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} disabled={!safeCount} onClick={onAcceptSafe}>{t("organizeBatchAcceptSafe").replace("{count}", safeCount.toLocaleString())}</button>
      <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} disabled={!keepableCount} onClick={onKeep}>{t("organizeBatchKeep").replace("{count}", keepableCount.toLocaleString())}</button>
      <button className={cn(buttonGhost, "min-h-8 px-3 py-1.5 text-xs")} disabled={!clearableCount} onClick={onClear}>{t("organizeBatchClear").replace("{count}", clearableCount.toLocaleString())}</button>
      {blockedCount ? <span className="text-xs text-[var(--zc-warning-text)]">{t("organizeBatchBlocked").replace("{count}", blockedCount.toLocaleString())}</span> : null}
      {needsReviewCount ? <span className="text-xs text-[var(--zc-warning-text)]">{t("organizeBatchNeedsReview").replace("{count}", needsReviewCount.toLocaleString())}</span> : null}
      <button className={cn(buttonGhost, "min-h-8 px-3 py-1.5 text-xs")} onClick={onExit}>{t("organizeBatchExit")}</button>
    </div>
  );
}
