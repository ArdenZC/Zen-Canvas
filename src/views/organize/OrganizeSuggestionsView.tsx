import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronRight, CircleMinus, Edit3, History, ListRestart, LoaderCircle, MoreHorizontal, Play, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useFileLibraryQueryStore, useFileLibraryResultStore, useFileLibrarySelectionStore } from "../../store/useFileLibraryV2Store";
import { useOrganizationPlanStore } from "../../store/useOrganizationPlanStore";
import type { OrganizationPlanGroupSummary, OrganizationPlanItem, OrganizationPlanStatus, LibrarySelectionV1 } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { readableError } from "../../utils/viewHelpers";
import { validateOrganizeFileNameForOriginal } from "./organizeModel";
import { buttonGhost, cn, inputSurface } from "../../utils/tw";
import {
  Button,
  ConfirmDialog,
  DurableTaskStatus,
  MetricStrip,
  NoticeBanner,
  SegmentedControl,
  SideSheet,
  StateBlock,
  pageFrame
} from "../shared/ui";

const GROUP_ROW_HEIGHT = 174;
const GROUP_PAGE_SIZE = 100;

type ReviewTab = "plan" | "decision" | "blocked";

export function OrganizeSuggestionsView() {
  const { setView, t } = useChromeContext();
  const plans = useOrganizationPlanStore((state) => state.plans);
  const plan = useOrganizationPlanStore((state) => state.activePlan);
  const groups = useOrganizationPlanStore((state) => state.groups);
  const groupHasMore = useOrganizationPlanStore((state) => state.groupHasMore);
  const groupNextCursor = useOrganizationPlanStore((state) => state.groupNextCursor);
  const dryRun = useOrganizationPlanStore((state) => state.dryRun);
  const executionResult = useOrganizationPlanStore((state) => state.executionResult);
  const isLoading = useOrganizationPlanStore((state) => state.isLoading);
  const isMutating = useOrganizationPlanStore((state) => state.isMutating);
  const error = useOrganizationPlanStore((state) => state.error);
  const loadPlans = useOrganizationPlanStore((state) => state.loadPlans);
  const createPlan = useOrganizationPlanStore((state) => state.createPlan);
  const openPlan = useOrganizationPlanStore((state) => state.openPlan);
  const loadNextGroupPage = useOrganizationPlanStore((state) => state.loadNextGroupPage);
  const updateGroupDecision = useOrganizationPlanStore((state) => state.updateGroupDecision);
  const updateDecision = useOrganizationPlanStore((state) => state.updateDecision);
  const refreshPlan = useOrganizationPlanStore((state) => state.refreshPlan);
  const analyzeMissing = useOrganizationPlanStore((state) => state.analyzeMissing);
  const createDryRun = useOrganizationPlanStore((state) => state.createDryRun);
  const executeDryRun = useOrganizationPlanStore((state) => state.executeDryRun);
  const cancelPlan = useOrganizationPlanStore((state) => state.cancelPlan);
  const librarySelection = useFileLibrarySelectionStore((state) => state.selection);
  const querySpec = useFileLibraryQueryStore((state) => state.spec);
  const queryFingerprint = useFileLibraryQueryStore((state) => state.fingerprint);
  const querySnapshotRevision = useFileLibraryQueryStore((state) => state.snapshotRevision);
  const totalCount = useFileLibraryResultStore((state) => state.totalCount);
  const [activeTab, setActiveTab] = useState<ReviewTab>("plan");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<OrganizationPlanItem[]>([]);
  const [groupItemsCursor, setGroupItemsCursor] = useState<string | null>(null);
  const [groupItemsHasMore, setGroupItemsHasMore] = useState(false);
  const [groupItemsLoading, setGroupItemsLoading] = useState(false);
  const [groupItemsError, setGroupItemsError] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [confirmExecution, setConfirmExecution] = useState(false);
  const [confirmItemAcceptance, setConfirmItemAcceptance] = useState<OrganizationPlanItem | null>(null);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [reviewActionNeedsRefresh, setReviewActionNeedsRefresh] = useState(false);
  const groupListRef = useRef<HTMLDivElement | null>(null);
  const groupRequestEpoch = useRef(0);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!plan && plans[0]) void openPlan(plans[0].id);
  }, [openPlan, plan, plans]);

  const activeGroup = groups.find((group) => group.groupId === activeGroupId) ?? null;

  const visibleGroups = useMemo(() => groups.filter((group) => {
    if (activeTab === "plan") return group.readiness === "ready" || group.readiness === "reviewed";
    if (activeTab === "decision") return group.readiness === "requires-decision";
    return group.readiness === "blocked";
  }), [activeTab, groups]);

  const activeItem = groupItems.find((item) => item.id === activeItemId) ?? null;
  const canReview = Boolean(plan && ["ready", "partially_completed"].includes(plan.status));
  const canDryRun = Boolean(plan && ["ready", "partially_completed"].includes(plan.status) && plan.summary.remainingExecutable > 0);
  const needsAnalysisCount = plan?.summary.needsAnalysis ?? 0;

  const virtualizer = useVirtualizer({
    count: visibleGroups.length,
    getScrollElement: () => groupListRef.current,
    estimateSize: () => GROUP_ROW_HEIGHT,
    overscan: 6
  });
  const virtualRows = virtualizer.getVirtualItems();
  const mountedActiveId = virtualRows.some((row) => visibleGroups[row.index]?.groupId === activeGroupId)
    ? `organization-group-${activeGroupId}`
    : undefined;

  const loadGroupItems = useCallback(async (groupId: string, cursor: string | null = null, append = false) => {
    if (!plan) return;
    const epoch = ++groupRequestEpoch.current;
    setGroupItemsLoading(true);
    setGroupItemsError(null);
    try {
      const page = await tauriApi.queryOrganizationPlanGroupItems({
        planId: plan.id,
        groupId,
        cursor,
        pageSize: GROUP_PAGE_SIZE
      });
      if (epoch !== groupRequestEpoch.current) return;
      setGroupItems((current) => append ? [...current, ...page.items] : page.items);
      setGroupItemsCursor(page.nextCursor);
      setGroupItemsHasMore(page.hasMore);
      setActiveItemId((current) => page.items.some((item) => item.id === current) ? current : page.items[0]?.id ?? null);
      setGroupItemsLoading(false);
    } catch {
      if (epoch !== groupRequestEpoch.current) return;
      setGroupItemsLoading(false);
      setGroupItemsError(t("organizeLoadFailedDesc"));
    }
  }, [plan, t]);

  useEffect(() => {
    if (!activeGroup) {
      groupRequestEpoch.current += 1;
      setGroupItems([]);
      setGroupItemsCursor(null);
      setGroupItemsHasMore(false);
      setGroupItemsError(null);
      setActiveItemId(null);
      return;
    }
    void loadGroupItems(activeGroup.groupId);
  }, [activeGroup?.groupId, loadGroupItems]);

  useEffect(() => {
    if (activeGroupId && !groups.some((group) => group.groupId === activeGroupId)) setActiveGroupId(null);
  }, [activeGroupId, groups]);

  useEffect(() => {
    if (activeGroupId && !visibleGroups.some((group) => group.groupId === activeGroupId)) setActiveGroupId(null);
  }, [activeGroupId, visibleGroups]);

  useEffect(() => {
    if (visibleGroups.length || !groupHasMore || !groupNextCursor || isLoading) return;
    void loadNextGroupPage();
  }, [groupHasMore, groupNextCursor, isLoading, loadNextGroupPage, visibleGroups.length]);

  useEffect(() => {
    const last = virtualRows.at(-1);
    if (last && groupHasMore && groupNextCursor && last.index >= visibleGroups.length - 8 && !isLoading) {
      void loadNextGroupPage();
    }
  }, [groupHasMore, groupNextCursor, isLoading, loadNextGroupPage, visibleGroups.length, virtualRows]);

  function planSource(): { source: LibrarySelectionV1; expectedCount: number } | null {
    if (librarySelection?.kind === "explicit") {
      return { source: librarySelection, expectedCount: librarySelection.fileIds.length };
    }
    if (librarySelection?.kind === "all_matching" && totalCount !== null) {
      return { source: librarySelection, expectedCount: totalCount };
    }
    if (queryFingerprint && querySnapshotRevision !== null && totalCount !== null) {
      return {
        source: {
          kind: "all_matching",
          query: querySpec,
          queryFingerprint,
          snapshotRevision: querySnapshotRevision,
          excludedFileIds: []
        },
        expectedCount: totalCount
      };
    }
    return null;
  }

  async function handleCreatePlan() {
    const source = planSource();
    if (!source) {
      setView("library");
      return;
    }
    await createPlan(source.source, source.expectedCount, planTitle);
    setPlanTitle("");
  }

  function handleGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!visibleGroups.length || event.ctrlKey || event.metaKey || event.altKey) return;
    const index = Math.max(0, visibleGroups.findIndex((group) => group.groupId === activeGroupId));
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(visibleGroups.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visibleGroups.length - 1;
    else if (event.key === "PageDown") nextIndex = Math.min(visibleGroups.length - 1, index + 5);
    else if (event.key === "PageUp") nextIndex = Math.max(0, index - 5);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveGroupId(visibleGroups[index]?.groupId ?? null);
      return;
    } else return;
    event.preventDefault();
    const next = visibleGroups[nextIndex];
    setActiveGroupId(next.groupId);
    virtualizer.scrollToIndex(nextIndex, { align: "auto" });
  }

  async function handleGroupDecision(group: OrganizationPlanGroupSummary, decision: "accepted" | "kept" | "undecided") {
    if (!canReview) return;
    if (decision === "accepted" && group.readiness !== "ready") return;
    setReviewActionError(null);
    setReviewActionNeedsRefresh(false);
    try {
      await updateGroupDecision(group, decision);
    } catch (error) {
      setReviewActionError(organizeActionError(error, t));
      setReviewActionNeedsRefresh(isOrganizationGroupChangedError(error));
    }
  }

  async function handleItemDecision(item: OrganizationPlanItem, decision: "accepted" | "kept" | "edited" | "undecided", name?: string): Promise<boolean> {
    if (!canReview) return false;
    setEditError(null);
    try {
      await updateDecision(item, decision, name);
      if (activeGroup) await loadGroupItems(activeGroup.groupId);
      return true;
    } catch (error) {
      setEditError(organizeActionError(error, t));
      return false;
    }
  }

  function requestItemAcceptance(item: OrganizationPlanItem) {
    if (!canReview || !item.availableActions.includes("accept_suggestion")) return;
    setEditError(null);
    if (item.validity === "needs_review") {
      setConfirmItemAcceptance(item);
      return;
    }
    void handleItemDecision(item, "accepted");
  }

  async function saveEditedName() {
    if (!activeItem) return;
    const validation = validateOrganizeFileNameForOriginal(activeItem.sourceNameSnapshot, editedName);
    if (validation) {
      setEditError(nameErrorCopy(validation, t));
      return;
    }
    if (await handleItemDecision(activeItem, "edited", editedName.trim())) setEditingItemId(null);
  }

  async function reviewExecution() {
    if (dryRun) {
      setConfirmExecution(true);
      return;
    }
    try {
      await createDryRun();
    } catch {
      setReviewActionError(t("organizeLoadFailedDesc"));
    }
  }

  function openGroup(group: OrganizationPlanGroupSummary) {
    setActiveGroupId(group.groupId);
    setEditError(null);
    setGroupItemsError(null);
  }

  return (
    <div className={cn(pageFrame, "gap-3") }>
      {!plan && !isLoading ? (
        <section className="grid min-h-0 flex-1 place-items-center">
          <div className="grid w-full max-w-xl gap-4 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] p-6 shadow-[var(--zc-shadow-soft)]">
            <div>
              <h2 className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("organizeNoPlanTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--zc-text-secondary)]">{t("organizeNoPlanDescription")}</p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-[var(--zc-text-secondary)]" htmlFor="organization-plan-title">{t("organizePlanTitleLabel")}</label>
              <input id="organization-plan-title" className={cn(inputSurface, "min-h-[var(--zc-control-height-default)] px-3 text-sm")} value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} placeholder={t("organizePlanTitlePlaceholder")} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void handleCreatePlan()}><Plus size={15} aria-hidden="true" />{t("organizeCreatePlanAction")}</Button>
              <Button variant="secondary" onClick={() => setView("library")}>{t("fileLibrary")}</Button>
            </div>
          </div>
        </section>
      ) : null}

      {plan ? (
        <>
          <section className="grid shrink-0 gap-3 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] p-3 shadow-[var(--zc-shadow-soft)]" data-organize-plan-header>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="sr-only" htmlFor="organization-plan-selector">{t("organizePlanSelectorLabel")}</label>
                <select id="organization-plan-selector" className={cn(inputSurface, "min-h-[var(--zc-control-height-compact)] max-w-full min-w-56 px-2 text-sm")} value={plan.id} onChange={(event) => void openPlan(event.target.value)} aria-label={t("organizePlanSelectorLabel")}>
                  {plans.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <p className="mt-1 text-xs text-[var(--zc-text-secondary)]">{t("organizePlanStatusLine").replace("{status}", planStatusLabel(plan.status, t)).replace("{count}", plan.materializedCount.toLocaleString())}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <details className="relative">
                  <summary className={cn(buttonGhost, "cursor-pointer list-none")}>{t("organizePlanActions")} <MoreHorizontal size={14} aria-hidden="true" /></summary>
                  <div className="absolute right-0 z-20 mt-1 grid min-w-52 gap-1 rounded-[var(--zc-radius-field)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-1 shadow-[var(--zc-shadow-floating)]" role="menu">
                    <Button variant="ghost" size="compact" className="justify-start" disabled={isMutating || !["stale", "ready", "partially_completed"].includes(plan.status)} onClick={() => void refreshPlan()}><RefreshCw size={14} aria-hidden="true" />{t("organizePlanRefresh")}</Button>
                    <Button variant="ghost" size="compact" className="justify-start" disabled={isMutating || !needsAnalysisCount} onClick={() => void analyzeMissing()}><Sparkles size={14} aria-hidden="true" />{t("organizePlanAnalyze")}</Button>
                    <Button variant="ghost" size="compact" className="justify-start" disabled={isMutating || !canReview} onClick={() => void cancelPlan()}><X size={14} aria-hidden="true" />{t("organizePlanCancel")}</Button>
                  </div>
                </details>
                <Button variant="secondary" size="compact" onClick={() => setView("restore")}><History size={14} aria-hidden="true" />{t("organizeViewHistory")}</Button>
              </div>
            </div>
            <MetricStrip
              ariaLabel={t("organizePlanMetricLabel")}
              density="compact"
              items={[
                { label: t("organizePlanMetricFiles"), value: plan.materializedCount.toLocaleString() },
                { label: t("organizePlanMetricAccepted"), value: (plan.summary.accepted + plan.summary.edited).toLocaleString(), tone: "green" },
                { label: t("organizePlanMetricReview"), value: plan.effectiveSummary.pendingReview.toLocaleString(), tone: "amber" },
                { label: t("organizePlanMetricBlocked"), value: plan.effectiveSummary.blocked.toLocaleString(), tone: "red" }
              ]}
            />
          </section>

          {error ? <NoticeBanner tone="error" title={t("organizeLoadFailedTitle")} action={<Button variant="secondary" size="compact" onClick={() => void openPlan(plan.id)}>{t("organizePlanRefresh")}</Button>}>{t("organizeLoadFailedDesc")}</NoticeBanner> : null}
          {reviewActionError ? <NoticeBanner tone="warning" title={t("organizeGroupActionFailed")} action={reviewActionNeedsRefresh ? <Button variant="secondary" size="compact" onClick={() => { setReviewActionError(null); setReviewActionNeedsRefresh(false); void refreshPlan(); }}>{t("organizePlanRefresh")}</Button> : <Button variant="ghost" size="compact" onClick={() => setReviewActionError(null)}>{t("close")}</Button>}>{reviewActionError}</NoticeBanner> : null}

          <SegmentedControl
            value={activeTab}
            ariaLabel={t("organizePlanTabsLabel")}
            onChange={setActiveTab}
            options={[
              { value: "plan", label: t("organizePlanTab") },
              { value: "decision", label: t("organizeNeedsDecisionTab") },
              { value: "blocked", label: t("organizeCannotProcessTab") }
            ]}
          />

          <section className="min-h-0 flex-1 overflow-hidden rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] max-[1100px]:min-h-[320px]" data-organize-groups>
            {isLoading && !groups.length ? <DurableTaskStatus state="running" title={t("organizeGroupLoading")} description={t("organizeLoadingSuggestionsDesc")} density="compact" /> : null}
            {!isLoading && !visibleGroups.length && groupHasMore && groupNextCursor ? <StateBlock tone="info" title={t("organizeGroupLoading")} description={t("organizeLoadingSuggestionsDesc")} primaryAction={<Button variant="secondary" size="compact" onClick={() => void loadNextGroupPage()}>{t("organizeGroupLoadMore")}</Button>} density="compact" /> : null}
            {!isLoading && !visibleGroups.length && (!groupHasMore || !groupNextCursor) ? <StateBlock tone={activeTab === "blocked" ? "info" : "neutral"} title={emptyTabTitle(activeTab, t)} description={emptyTabDescription(activeTab, t)} density="compact" /> : null}
            {visibleGroups.length ? (
              <div ref={groupListRef} className="h-full overflow-auto outline-none" role="listbox" tabIndex={0} aria-label={t("organizeGroupListLabel")} aria-activedescendant={mountedActiveId} onKeyDown={handleGroupKeyDown}>
                <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                  {virtualRows.map((virtualRow) => {
                    const group = visibleGroups[virtualRow.index];
                    const active = group.groupId === activeGroupId;
                    return (
                      <div
                        key={group.groupId}
                        id={`organization-group-${group.groupId}`}
                        role="option"
                        aria-selected={active}
                        data-organize-group-row={group.groupId}
                        className={cn("absolute left-0 top-0 grid w-full gap-2 border-b border-[var(--zc-divider)] px-4 py-3 text-left transition-[background,border-color]", active && "bg-[var(--zc-surface-selected)]")}
                        style={{ minHeight: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                        onClick={() => openGroup(group)}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <strong className="block truncate text-sm text-[var(--zc-text-primary)]">{group.targetDirectory ?? t("organizeGroupNoDestination")}</strong>
                            <p className="mt-1 truncate text-xs text-[var(--zc-text-secondary)]">{proposalKindLabel(group.proposalKind, t)} · {readinessLabel(group.readiness, t)} · {confidenceLabel(group.confidenceBand, t)}</p>
                          </div>
                          <ChevronRight size={16} className="mt-1 shrink-0 text-[var(--zc-text-tertiary)]" aria-hidden="true" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-[var(--zc-text-secondary)]">
                          <span>{t("organizeGroupFiles").replace("{count}", group.itemCount.toLocaleString())}</span>
                          <span>{t("organizeGroupBytes").replace("{size}", formatBytes(group.totalBytes))}</span>
                          <span>{riskLabel(group.riskLevel, t)}</span>
                          {group.acceptedCount ? <span>{t("organizeGroupAccepted").replace("{count}", group.acceptedCount.toLocaleString())}</span> : null}
                          {group.excludedCount ? <span>{t("organizeGroupExcluded").replace("{count}", group.excludedCount.toLocaleString())}</span> : null}
                          {group.staleCount || group.conflictCount ? <span className="text-[var(--zc-warning-text)]">{t("organizeGroupIssues").replace("{stale}", group.staleCount.toLocaleString()).replace("{conflicts}", group.conflictCount.toLocaleString())}</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-xs text-[var(--zc-text-tertiary)]">{groupReason(group, t)}</span>
                          <div className="flex shrink-0 flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            {group.readiness === "ready" ? <Button variant="secondary" size="compact" disabled={isMutating || !canReview} onClick={() => void handleGroupDecision(group, "accepted")}><Check size={13} aria-hidden="true" />{t("organizeGroupInclude")}</Button> : null}
                            {group.readiness !== "blocked" ? <Button variant="ghost" size="compact" disabled={isMutating || !canReview} onClick={() => void handleGroupDecision(group, "kept")}><CircleMinus size={13} aria-hidden="true" />{t("organizeGroupKeep")}</Button> : null}
                            <Button variant="ghost" size="compact" onClick={() => openGroup(group)}>{t("organizeGroupReview")}</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <footer className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface-floating)] px-4 py-3 shadow-[var(--zc-shadow-raised)]" data-organize-review-action>
            <span className="text-xs leading-5 text-[var(--zc-text-secondary)]">{t("organizeReviewExecutionHint")}</span>
            <Button variant="primary" disabled={isMutating || !canDryRun} onClick={() => void reviewExecution()}><Play size={15} aria-hidden="true" />{dryRun ? t("organizeDryRunAction") : t("organizeReviewExecution")}</Button>
          </footer>

          {dryRun ? (
            <DurableTaskStatus
              state="completed"
              title={t("organizeDryRunTitle")}
              description={t("organizeDryRunDesc").replace("{executable}", dryRun.executableCount.toLocaleString()).replace("{blocked}", dryRun.blockedCount.toLocaleString()).replace("{stale}", dryRun.staleCount.toLocaleString())}
              action={<Button variant="secondary" onClick={() => setConfirmExecution(true)}>{t("organizeDryRunAction")}</Button>}
              density="compact"
            />
          ) : null}

          {executionResult ? <NoticeBanner tone={executionResult.failedCount ? "warning" : "success"} title={executionResult.failedCount ? t("organizeResultPartialTitle") : t("organizeResultSuccessTitle")} action={<Button variant="secondary" size="compact" onClick={() => setView("restore")}>{t("organizeViewHistory")}</Button>}>{t("organizeResultSummary").replace("{success}", executionResult.succeededCount.toLocaleString()).replace("{skipped}", executionResult.skippedCount.toLocaleString()).replace("{failed}", executionResult.failedCount.toLocaleString())}</NoticeBanner> : null}
        </>
      ) : null}

      <SideSheet
        open={Boolean(activeGroup)}
        title={activeGroup ? (activeGroup.targetDirectory ?? t("organizeGroupNoDestination")) : t("organizeGroupDetails")}
        description={activeGroup ? `${t("organizeGroupFiles").replace("{count}", activeGroup.itemCount.toLocaleString())} · ${proposalKindLabel(activeGroup.proposalKind, t)}` : undefined}
        closeLabel={t("close")}
        restoreFocus={() => groupListRef.current}
        onClose={() => setActiveGroupId(null)}
        footer={activeGroup ? (
          <div className="flex flex-wrap justify-end gap-2">
            {activeGroup.readiness === "ready" ? <Button variant="secondary" disabled={isMutating || !canReview} onClick={() => void handleGroupDecision(activeGroup, "accepted")}><Check size={14} aria-hidden="true" />{t("organizeGroupInclude")}</Button> : null}
            {activeGroup.readiness !== "blocked" ? <Button variant="ghost" disabled={isMutating || !canReview} onClick={() => void handleGroupDecision(activeGroup, "kept")}><CircleMinus size={14} aria-hidden="true" />{t("organizeGroupKeep")}</Button> : null}
          </div>
        ) : undefined}
      >
        {activeGroup ? (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--zc-text-tertiary)]">{t("organizeGroupDestination")}</span>
              <span className="break-all text-sm text-[var(--zc-text-primary)]">{activeGroup.targetDirectory ?? t("organizeGroupNoDestination")}</span>
              <span className="text-xs text-[var(--zc-text-secondary)]">{groupReason(activeGroup, t)}</span>
              {activeGroup.readiness === "requires-decision" ? <p className="text-xs leading-5 text-[var(--zc-warning-text)]">{t("organizeGroupDecisionHint")}</p> : null}
              <div className="flex flex-wrap gap-2 text-xs text-[var(--zc-text-secondary)]"><span>{riskLabel(activeGroup.riskLevel, t)}</span><span>{confidenceLabel(activeGroup.confidenceBand, t)}</span><span>{readinessLabel(activeGroup.readiness, t)}</span></div>
            </div>
            {groupItemsError ? <NoticeBanner tone="error" title={t("organizeLoadFailedTitle")}>{groupItemsError}</NoticeBanner> : null}
            {editError ? <NoticeBanner tone="warning" title={t("organizeGroupActionFailed")}>{editError}</NoticeBanner> : null}
            <section className="grid gap-2" aria-label={t("organizeGroupItemListLabel")}>
              <h3 className="text-sm font-semibold text-[var(--zc-text-primary)]">{t("organizeGroupSamples")}</h3>
              {groupItemsLoading && !groupItems.length ? <p className="text-sm text-[var(--zc-text-secondary)]">{t("organizeGroupLoading")}</p> : null}
              {!groupItemsLoading && !groupItems.length ? <p className="text-sm text-[var(--zc-text-secondary)]">{t("organizeGroupNoItems")}</p> : null}
              <div className="grid gap-2" role="listbox" aria-label={t("organizeGroupItemListLabel")}>
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("grid min-w-0 gap-1 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface)] p-3 text-left hover:border-[var(--zc-control-border-hover)] hover:bg-[var(--zc-surface-hover)]", item.id === activeItemId && "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)]")}
                    role="option"
                    aria-selected={item.id === activeItemId}
                    onClick={() => { setActiveItemId(item.id); setEditingItemId(null); }}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2"><strong className="truncate text-sm text-[var(--zc-text-primary)]">{item.sourceNameSnapshot}</strong><span className="shrink-0 text-xs text-[var(--zc-text-secondary)]">{decisionLabel(item.decision, t)}</span></span>
                    <span className="truncate text-xs text-[var(--zc-text-tertiary)]">{item.sourcePathSnapshot}</span>
                    <span className="truncate text-xs text-[var(--zc-text-secondary)]">{t("organizeGroupItemTo")}: {item.proposedTargetPath}</span>
                  </button>
                ))}
              </div>
              {groupItemsHasMore && groupItemsCursor ? <Button variant="ghost" size="compact" disabled={groupItemsLoading} onClick={() => void loadGroupItems(activeGroup.groupId, groupItemsCursor, true)}>{groupItemsLoading ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{t("organizeGroupLoadMore")}</Button> : null}
            </section>
            {activeItem ? (
              <section className="grid gap-3 border-t border-[var(--zc-divider)] pt-4" aria-label={t("organizeGroupDetails")}>
                <div className="grid gap-2 text-sm"><div><span className="text-xs text-[var(--zc-text-tertiary)]">{t("organizeGroupItemFrom")}</span><p className="mt-1 break-all text-[var(--zc-text-secondary)]">{activeItem.sourcePathSnapshot}</p></div><div><span className="text-xs text-[var(--zc-text-tertiary)]">{t("organizeGroupItemTo")}</span><p className="mt-1 break-all text-[var(--zc-text-secondary)]">{activeItem.proposedTargetPath}</p></div></div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="compact"
                    disabled={!canReview || !activeItem.availableActions.includes("accept_suggestion") || isMutating}
                    title={itemAcceptUnavailableReason(activeItem, t)}
                    onClick={() => requestItemAcceptance(activeItem)}
                  ><Check size={14} aria-hidden="true" />{activeItem.availableActions.includes("accept_suggestion") ? t("organizeGroupItemAccept") : t("organizeGroupItemAcceptUnavailable")}</Button>
                  <Button variant="ghost" size="compact" disabled={!canReview || !activeItem.availableActions.includes("keep") || isMutating} onClick={() => void handleItemDecision(activeItem, "kept")}><CircleMinus size={14} aria-hidden="true" />{t("organizeGroupItemKeep")}</Button>
                  <Button variant="ghost" size="compact" disabled={!canReview || !activeItem.availableActions.includes("edit_name") || isMutating} onClick={() => { setEditedName(activeItem.editedName ?? activeItem.proposedName); setEditingItemId(activeItem.id); setEditError(null); }}><Edit3 size={14} aria-hidden="true" />{t("organizeGroupItemEdit")}</Button>
                  <Button variant="ghost" size="compact" disabled={!canReview || !activeItem.availableActions.includes("clear_decision") || isMutating} onClick={() => void handleItemDecision(activeItem, "undecided")}><ListRestart size={14} aria-hidden="true" />{t("organizeGroupItemClear")}</Button>
                </div>
                {activeItem.reviewReasons.length ? <p className="text-xs leading-5 text-[var(--zc-warning-text)]">{t("organizeItemReviewReasonLabel")}: {activeItem.reviewReasons.map((reason) => reviewReasonLabel(reason, t)).join(" · ")}</p> : null}
                {editingItemId === activeItem.id ? <div className="grid gap-2 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] p-3"><label className="text-xs font-medium text-[var(--zc-text-secondary)]" htmlFor="organization-group-edited-name">{t("organizeEditTargetName")}</label><input id="organization-group-edited-name" className={cn(inputSurface, "min-h-[var(--zc-control-height-default)] px-2")} value={editedName} onChange={(event) => setEditedName(event.target.value)} autoFocus /><div className="flex flex-wrap gap-2"><Button variant="secondary" size="compact" onClick={() => void saveEditedName()}>{t("save")}</Button><Button variant="ghost" size="compact" onClick={() => setEditingItemId(null)}>{t("cancel")}</Button></div></div> : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </SideSheet>

      <ConfirmDialog
        open={Boolean(confirmItemAcceptance)}
        tone="warning"
        title={t("organizeItemAcceptReviewTitle")}
        description={confirmItemAcceptance ? replaceCopy(t("organizeItemAcceptReviewDesc"), {
          reason: confirmItemAcceptance.reviewReasons.map((reason) => reviewReasonLabel(reason, t)).join(" · ") || t("organizeReasonFromAnalysis"),
          target: confirmItemAcceptance.proposedTargetPath
        }) : ""}
        confirmLabel={t("organizeItemAcceptReviewConfirm")}
        cancelLabel={t("cancel")}
        isProcessing={isMutating}
        onCancel={() => setConfirmItemAcceptance(null)}
        onConfirm={() => {
          const item = confirmItemAcceptance;
          setConfirmItemAcceptance(null);
          if (item) void handleItemDecision(item, "accepted");
        }}
      />

      <ConfirmDialog
        open={confirmExecution}
        tone="warning"
        title={dryRun?.items.some((item) => item.riskLevel !== "Normal" || item.requiresConfirmation) ? t("organizeExecuteRiskConfirmTitle") : t("organizeExecuteNormalConfirmTitle")}
        description={dryRun ? t("organizeExecuteConfirmDesc").replace("{count}", dryRun.executableCount.toLocaleString()) : ""}
        confirmLabel={t("organizeExecuteConfirmAction").replace("{count}", (dryRun?.executableCount ?? 0).toLocaleString())}
        cancelLabel={t("cancel")}
        isProcessing={isMutating}
        onCancel={() => setConfirmExecution(false)}
        onConfirm={() => { setConfirmExecution(false); void executeDryRun(); }}
      />
    </div>
  );
}

function planStatusLabel(status: OrganizationPlanStatus, t: Translator): string {
  if (status === "draft") return t("organizePlanStatusDraft");
  if (status === "building") return t("organizePlanStatusBuilding");
  if (status === "ready") return t("organizePlanStatusReady");
  if (status === "stale") return t("organizePlanStatusStale");
  if (status === "executing") return t("organizePlanStatusExecuting");
  if (status === "partially_completed") return t("organizePlanStatusPartial");
  if (status === "completed") return t("organizePlanStatusCompleted");
  if (status === "cancelled") return t("organizePlanStatusCancelled");
  if (status === "failed") return t("organizePlanStatusFailed");
  return t("organizePlanStatusUnknown");
}

function proposalKindLabel(kind: string, t: Translator): string {
  if (kind === "move") return t("organizeGroupProposalMove");
  if (kind === "rename") return t("organizeGroupProposalRename");
  if (kind === "move_rename") return t("organizeGroupProposalMoveRename");
  if (kind === "keep") return t("organizeGroupProposalKeep");
  if (kind === "blocked") return t("organizeGroupProposalBlocked");
  return t("organizeGroupProposalUnknown");
}

function readinessLabel(readiness: OrganizationPlanGroupSummary["readiness"], t: Translator): string {
  if (readiness === "ready") return t("organizeGroupReadinessReady");
  if (readiness === "requires-decision") return t("organizeGroupReadinessDecision");
  if (readiness === "reviewed") return t("organizeGroupReadinessReviewed");
  return t("organizeGroupReadinessBlocked");
}

function riskLabel(risk: string, t: Translator): string {
  if (risk === "Normal") return t("organizeRiskNormal");
  if (risk === "Sensitive") return t("organizeRiskSensitive");
  if (risk === "System") return t("organizeRiskSystem");
  if (risk === "Caution") return t("organizeRiskCaution");
  return t("organizeRiskUnknown");
}

function confidenceLabel(confidence: string, t: Translator): string {
  if (confidence === "high") return t("organizeConfidenceHigh");
  if (confidence === "medium") return t("organizeConfidenceMedium");
  if (confidence === "low") return t("organizeConfidenceLow");
  return t("organizeConfidenceMixed");
}

function decisionLabel(decision: OrganizationPlanItem["decision"], t: Translator): string {
  if (decision === "accepted") return t("organizeDecisionAccepted");
  if (decision === "kept") return t("organizeDecisionKept");
  if (decision === "edited") return t("organizeDecisionEdited");
  return t("organizeDecisionUndecided");
}

function groupReason(group: OrganizationPlanGroupSummary, t: Translator): string {
  if (group.reviewReasonCounts.length) {
    return group.reviewReasonCounts
      .slice(0, 3)
      .map(({ reason, count }) => `${reviewReasonLabel(reason, t)} (${count})`)
      .join(" · ");
  }
  if (group.readiness === "blocked" && group.proposalKind === "keep") return t("organizeGroupReasonAnalysis");
  if (group.readiness === "blocked") return t("organizeGroupReasonBlocked");
  return t("organizeReasonFromAnalysis");
}

function reviewReasonLabel(reason: string, t: Translator): string {
  const labels: Record<string, Parameters<Translator>[0]> = {
    low_confidence: "organizeReviewReasonLowConfidence",
    sensitive_file: "organizeReviewReasonSensitiveFile",
    non_normal_risk: "organizeReviewReasonNonNormalRisk",
    possible_duplicate: "organizeReviewReasonPossibleDuplicate",
    requires_confirmation: "organizeReviewReasonRequiresConfirmation",
    target_directory_creation: "organizeReviewReasonTargetDirectoryCreation",
    target_collision: "organizeReviewReasonTargetCollision",
    source_changed: "organizeReviewReasonSourceChanged",
    proposal_changed: "organizeReviewReasonProposalChanged",
    managed_scope_changed: "organizeReviewReasonManagedScopeChanged",
    missing_preview: "organizeReviewReasonMissingPreview",
    unsupported_operation: "organizeReviewReasonUnsupportedOperation",
    unsafe_filename: "organizeReviewReasonUnsafeFilename",
    extension_change_blocked: "organizeReviewReasonExtensionBlocked"
  };
  return t(labels[reason] ?? "organizeReviewReasonUnknown");
}

function itemAcceptUnavailableReason(item: OrganizationPlanItem, t: Translator): string {
  if (item.validity === "stale") return t("organizeItemAcceptUnavailableChanged");
  if (item.validity === "blocked") return t("organizeItemAcceptUnavailableBlocked");
  if (!item.authoritativePreviewId || !item.availableActions.includes("view_preview")) return t("organizeItemAcceptUnavailablePreview");
  if (item.availableActions.includes("accept_suggestion")) return t("organizeItemAcceptReviewHint");
  return t("organizeItemAcceptUnavailableState");
}

function organizeActionError(error: unknown, t: Translator): string {
  const message = readableError(error);
  if (message.includes("organization_item_accept_not_available")) return t("organizeItemAcceptUnavailableBackend");
  if (message.includes("organization_item_edit_not_available")) return t("organizeItemEditUnavailableBackend");
  if (message.includes("organization_group_not_fully_safe")) return t("organizeGroupNotFullySafe");
  if (message.includes("organization_group_changed")) return t("organizeGroupChanged");
  return t("organizeGroupActionFailed");
}

function isOrganizationGroupChangedError(error: unknown): boolean {
  const message = readableError(error);
  return message.includes("organization_group_changed") || message.includes("organization_group_not_fully_safe");
}

function emptyTabTitle(tab: ReviewTab, t: Translator): string {
  if (tab === "decision") return t("organizeNoDecisionGroupsTitle");
  if (tab === "blocked") return t("organizeNoBlockedGroupsTitle");
  return t("organizeNoReadyGroupsTitle");
}

function emptyTabDescription(tab: ReviewTab, t: Translator): string {
  if (tab === "decision") return t("organizeNoDecisionGroupsDescription");
  if (tab === "blocked") return t("organizeNoBlockedGroupsDescription");
  return t("organizeNoReadyGroupsDescription");
}

function nameErrorCopy(error: "empty" | "reserved" | "unsafe" | "extension", t: Translator): string {
  if (error === "empty") return t("organizeNameErrorEmpty");
  if (error === "reserved") return t("organizeNameErrorReserved");
  if (error === "extension") return t("organizeNameErrorExtension");
  return t("organizeNameErrorUnsafe");
}

function replaceCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)), template);
}
