import { ChevronDown, FolderOpen, LoaderCircle, Play, RefreshCw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { tauriApi } from "../../../api/tauriApi";
import { useChromeContext } from "../../../contexts/AppContexts";
import { useDedupeStore } from "../../../store/useDedupeStore";
import type { DedupeGroupMember } from "../../../types/domain";
import { buttonGhost, buttonSubtle, cn, glassButtonPrimary, raisedSurface, successSurface, warningSurface } from "../../../utils/tw";
import { quietText } from "../../shared/ui";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let index = -1;
  do {
    amount /= 1024;
    index += 1;
  } while (amount >= 1024 && index < units.length - 1);
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[index]}`;
}

export function DuplicateGroupsPanel() {
  const { t, onError } = useChromeContext();
  const activeRun = useDedupeStore((state) => state.activeRun);
  const recentRuns = useDedupeStore((state) => state.recentRuns);
  const groups = useDedupeStore((state) => state.groups);
  const groupsHasMore = useDedupeStore((state) => state.groupsHasMore);
  const isHydrating = useDedupeStore((state) => state.isHydrating);
  const isLoadingGroups = useDedupeStore((state) => state.isLoadingGroups);
  const error = useDedupeStore((state) => state.error);
  const hydrate = useDedupeStore((state) => state.hydrate);
  const start = useDedupeStore((state) => state.start);
  const cancel = useDedupeStore((state) => state.cancel);
  const retry = useDedupeStore((state) => state.retry);
  const loadGroups = useDedupeStore((state) => state.loadGroups);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, DedupeGroupMember[]>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
    void loadGroups(true);
  }, [hydrate, loadGroups]);

  async function runAction(action: string, callback: () => Promise<unknown>) {
    setBusyAction(action);
    try {
      await callback();
      await loadGroups(true);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleGroup(groupId: string) {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      return;
    }
    setExpandedGroupId(groupId);
    if (members[groupId]) return;
    try {
      const next = await tauriApi.listDuplicateGroupMembers(groupId);
      setMembers((current) => ({ ...current, [groupId]: next }));
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const latestTerminalRun = recentRuns.find((run) => !["queued", "running", "cancelling"].includes(run.status));
  const canStart = !activeRun;

  return (
    <section className={cn(raisedSurface, "grid shrink-0 gap-3 p-4")} aria-labelledby="duplicate-groups-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="duplicate-groups-title" className="m-0 text-base font-semibold text-[var(--zc-text-primary)]">{t("duplicateGroupsTitle")}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--zc-text-secondary)]">{t("duplicateGroupsDescription")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeRun ? <button type="button" className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} disabled={busyAction !== null} onClick={() => void runAction("cancel", () => cancel(activeRun.id))}><Square size={14} />{t("duplicateGroupsCancel")}</button> : null}
          {!activeRun ? <button type="button" className={cn(glassButtonPrimary, "min-h-9 px-3 py-1.5 text-xs")} disabled={!canStart || busyAction !== null} onClick={() => void runAction("start", () => start())}><Play size={14} />{t("duplicateGroupsStart")}</button> : null}
          {!activeRun && latestTerminalRun && ["failed", "interrupted", "cancelled", "completed_with_warnings"].includes(latestTerminalRun.status) ? <button type="button" className={cn(buttonGhost, "min-h-9 px-3 py-1.5 text-xs")} disabled={busyAction !== null} onClick={() => void runAction("retry", () => retry(latestTerminalRun.id))}><RefreshCw size={14} />{t("duplicateGroupsRetry")}</button> : null}
        </div>
      </div>

      <p className={quietText}>{t("duplicateGroupsReadOnlyHint")}</p>
      <p className={quietText}>{t("duplicateGroupsEmptyFilesNote")}</p>
      {error ? <div className={cn(warningSurface, "text-sm")} role="alert">{error}</div> : null}
      {activeRun ? <div className={cn(successSurface, "grid gap-1 text-sm")} aria-live="polite">
        <span>{t("duplicateGroupsRunStatus").replace("{status}", activeRun.status).replace("{phase}", activeRun.phase)}</span>
        <span>{t("duplicateGroupsProgress").replace("{processed}", String(activeRun.processedFiles)).replace("{total}", String(activeRun.candidateFiles))}</span>
        <span>{t("duplicateGroupsBytes").replace("{processed}", formatBytes(activeRun.processedBytes)).replace("{total}", formatBytes(activeRun.totalBytes))}</span>
      </div> : latestTerminalRun ? <div className={cn(successSurface, "text-sm")} aria-live="polite">{t("duplicateGroupsLatestRun").replace("{status}", latestTerminalRun.status).replace("{phase}", latestTerminalRun.phase)}</div> : null}

      <div className="grid gap-2" aria-busy={isHydrating || isLoadingGroups}>
        {isHydrating || isLoadingGroups ? <div className="flex items-center gap-2 text-sm text-[var(--zc-text-secondary)]"><LoaderCircle size={15} className="animate-spin" />{t("duplicateGroupsLoading")}</div> : null}
        {!isHydrating && !isLoadingGroups && groups.length === 0 ? <p className={quietText}>{t("duplicateGroupsEmpty")}</p> : null}
        {groups.map((group) => {
          const expanded = expandedGroupId === group.id;
          const groupMembers = members[group.id] ?? [];
          return <div key={group.id} className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3">
            <button type="button" className="flex min-w-0 items-start justify-between gap-3 text-left" aria-expanded={expanded} onClick={() => void toggleGroup(group.id)}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--zc-text-primary)]">{group.representativePaths[0] ?? group.fullHash}</span>
                <span className="mt-1 block text-xs text-[var(--zc-text-secondary)]">{t("duplicateGroupsSummary").replace("{groups}", "1").replace("{members}", String(group.memberCount)).replace("{bytes}", formatBytes(group.potentialReclaimableBytes))}</span>
                <span className="mt-1 block text-xs text-[var(--zc-text-secondary)]">{t("duplicateGroupsReclaimable").replace("{confidence}", group.reclaimableConfidence === "exact" ? t("duplicateGroupsExact") : t("duplicateGroupsEstimated")).replace("{exact}", group.exactReclaimableBytes === null ? "—" : formatBytes(group.exactReclaimableBytes)).replace("{potential}", formatBytes(group.potentialReclaimableBytes))}</span>
              </span>
              <ChevronDown size={16} className={cn("shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </button>
            {expanded ? <div className="grid gap-2 border-t border-[var(--zc-divider)] pt-2">
              {groupMembers.map((member) => <div key={member.fileId} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-[var(--zc-text-secondary)]" title={member.pathSnapshot}>
                  <span className="block truncate">{member.pathSnapshot}</span>
                  <span className="block text-[var(--zc-text-muted)]">{t("duplicateGroupsIdentity").replace("{status}", `${member.identityStatus}${member.isHardlinkAlias ? ` · ${t("duplicateGroupsHardlinkAlias")}` : ""}`)}</span>
                </span>
                <button type="button" className={cn(buttonGhost, "min-h-8 shrink-0 px-2 py-1 text-xs")} onClick={() => void tauriApi.revealInFolder(member.pathSnapshot)}><FolderOpen size={13} />{t("duplicateGroupsReveal")}</button>
              </div>)}
            </div> : null}
          </div>;
        })}
        {groupsHasMore && groups.length > 0 ? <button type="button" className={cn(buttonGhost, "justify-self-start px-2 py-1 text-xs")} disabled={isLoadingGroups} onClick={() => void loadGroups(false)}>{t("duplicateGroupsMore")}</button> : null}
      </div>
    </section>
  );
}
