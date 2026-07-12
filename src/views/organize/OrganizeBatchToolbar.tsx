import type { Translator } from "../../types/ui";
import { buttonGhost, buttonSecondary, cn } from "../../utils/tw";

export function OrganizeBatchToolbar({
  selectedCount,
  safeCount,
  t,
  onAcceptSafe,
  onKeep,
  onClear,
  onExit
}: {
  selectedCount: number;
  safeCount: number;
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
      <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} disabled={!selectedCount} onClick={onKeep}>{t("organizeBatchKeep").replace("{count}", selectedCount.toLocaleString())}</button>
      <button className={cn(buttonGhost, "min-h-8 px-3 py-1.5 text-xs")} disabled={!selectedCount} onClick={onClear}>{t("organizeBatchClear")}</button>
      <button className={cn(buttonGhost, "min-h-8 px-3 py-1.5 text-xs")} onClick={onExit}>{t("organizeBatchExit")}</button>
    </div>
  );
}
