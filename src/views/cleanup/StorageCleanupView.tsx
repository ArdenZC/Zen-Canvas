import { useEffect, useMemo, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { desktopDir, documentDir, downloadDir, tempDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  HelpCircle,
  Loader2,
  Search,
  ShieldAlert,
  Trash2,
  XCircle
} from "lucide-react";
import { tauriApi, type TauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import {
  canSelectForCleanup,
  defaultSelectedCleanupIds,
  useStorageCleanupStore
} from "../../store/useStorageCleanupStore";
import type {
  CleanupExecutionResult,
  CleanupTier,
  StorageAnalysis,
  StorageCandidate
} from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { compactPath, readableError } from "../../utils/viewHelpers";
import { buttonSecondary, cn, glassButtonPrimary } from "../../utils/tw";
import {
  ConfirmDialog,
  IconButton,
  MetricCard,
  NoticeBanner,
  StateBlock,
  ToneBadge,
  contentPanel,
  metadataText,
  pageSurface,
  quietText,
  sectionDescription,
  sectionHeading,
  softPanel
} from "../shared/ui";

type StorageCleanupApi = Pick<
  TauriApi,
  | "startStorageCleanupScan"
  | "cancelStorageCleanupScan"
  | "getStorageCleanupScanStatus"
  | "revealStorageCandidate"
  | "moveCleanupCandidatesToSafeTrash"
> &
  Partial<
    Pick<
      TauriApi,
      | "scanStorageCleanup"
      | "onStorageCleanupProgress"
      | "onStorageCleanupCompleted"
      | "onStorageCleanupFailed"
      | "onStorageCleanupCancelled"
    >
  >;

type Props = {
  initialAnalysis?: StorageAnalysis;
  initialRoots?: string[];
  api?: StorageCleanupApi;
  t?: Translator;
};

const FILTERS: Array<CleanupTier | "All"> = ["All", "Safe", "Review", "Caution"];

export function StorageCleanupView(props: Props = {}) {
  if (props.t) return <StorageCleanupPanel {...props} t={props.t} />;
  return <StorageCleanupViewWithContext {...props} />;
}

function StorageCleanupViewWithContext(props: Omit<Props, "t">) {
  const { t, onError } = useChromeContext();
  return <StorageCleanupPanel {...props} t={t} onError={onError} />;
}

function StorageCleanupPanel({
  initialAnalysis,
  initialRoots,
  api = tauriApi,
  t,
  onError
}: Props & { t: Translator; onError?: (message: string) => void }) {
  const store = useStorageCleanupStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const analysis = initialAnalysis ?? store.analysis;
  const selectedRoots = initialRoots ?? store.selectedRoots;
  const selectedCleanupIds = initialAnalysis
    ? new Set(defaultSelectedCleanupIds(initialAnalysis))
    : store.selectedCleanupIds;
  const activeTierFilter = initialAnalysis ? "All" : store.activeTierFilter;
  const isScanning = !initialAnalysis && store.isScanning;
  const scanProgress = !initialAnalysis ? store.scanProgress : null;
  const executionResult = !initialAnalysis ? store.executionResult : null;
  const scanError = !initialAnalysis ? store.scanError : "";
  const [localError, setLocalError] = useState("");
  const error = localError || scanError;

  useEffect(() => {
    if (initialAnalysis) return undefined;
    const disposers: UnlistenFn[] = [];
    let disposed = false;
    async function wireEvents() {
      const progressOff = await api.onStorageCleanupProgress?.((payload) => {
        useStorageCleanupStore.getState().applyScanProgress(payload);
      });
      const completedOff = await api.onStorageCleanupCompleted?.((payload) => {
        useStorageCleanupStore.getState().completeScan(payload.jobId, payload.analysis);
      });
      const failedOff = await api.onStorageCleanupFailed?.((payload) => {
        useStorageCleanupStore.getState().failScan(payload.jobId, payload.message);
      });
      const cancelledOff = await api.onStorageCleanupCancelled?.((payload) => {
        useStorageCleanupStore.getState().failScan(payload.jobId, t("scanCanceled"));
      });
      for (const disposer of [progressOff, completedOff, failedOff, cancelledOff]) {
        if (disposer) disposers.push(disposer);
      }
      if (disposed) {
        while (disposers.length) disposers.pop()?.();
      }
    }
    void wireEvents();
    return () => {
      disposed = true;
      while (disposers.length) disposers.pop()?.();
    };
  }, [api, initialAnalysis, t]);

  const sortedCandidates = useMemo(() => sortCandidatesBySize(analysis?.candidates ?? []), [analysis]);
  const filteredCandidates = useMemo(
    () => sortedCandidates.filter((candidate) => activeTierFilter === "All" || candidate.tier === activeTierFilter),
    [activeTierFilter, sortedCandidates]
  );
  const tierCounts = useMemo(() => countTiers(sortedCandidates), [sortedCandidates]);
  const selectedCleanupIdsText = [...selectedCleanupIds].join(",");
  const selectedReclaimable = sortedCandidates
    .filter((candidate) => selectedCleanupIds.has(candidate.id))
    .reduce((sum, candidate) => sum + candidate.size, 0);
  const deniedCount = analysis?.denied_paths.length ?? 0;
  const warnings = analysis?.warnings ?? [];

  async function chooseScope() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("storageCleanupChooseScope")
    });
    if (typeof selected === "string" && selected.trim()) {
      useStorageCleanupStore.getState().setSelectedRoots([selected]);
      setLocalError("");
    }
  }

  async function useQuickScope(kind: "downloads" | "desktop" | "documents" | "temp") {
    try {
      const path =
        kind === "downloads"
          ? await downloadDir()
          : kind === "desktop"
            ? await desktopDir()
            : kind === "documents"
              ? await documentDir()
              : await tempDir();
      useStorageCleanupStore.getState().setSelectedRoots([path]);
      setLocalError("");
    } catch (scopeError) {
      reportError(scopeError);
    }
  }

  async function scan() {
    if (!selectedRoots.length) {
      setLocalError(t("storageCleanupScopeRequired"));
      return;
    }
    setLocalError("");
    await useStorageCleanupStore.getState().startScan(api);
  }

  async function cancelScan() {
    await useStorageCleanupStore.getState().cancelScan(api);
  }

  async function reveal(path: string) {
    try {
      await api.revealStorageCandidate(path);
    } catch (revealError) {
      reportError(revealError);
    }
  }

  async function moveSelectedToSafeTrash() {
    if (!selectedCleanupIds.size || isExecuting) return;
    setIsExecuting(true);
    setLocalError("");
    try {
      const result: CleanupExecutionResult = await api.moveCleanupCandidatesToSafeTrash([...selectedCleanupIds]);
      useStorageCleanupStore.getState().setExecutionResult(result);
      setConfirmOpen(false);
      if (!initialAnalysis && selectedRoots.length) {
        await useStorageCleanupStore.getState().startScan(api);
        useStorageCleanupStore.getState().setExecutionResult(result);
      }
    } catch (moveError) {
      reportError(moveError);
    } finally {
      setIsExecuting(false);
    }
  }

  function toggleSafeCandidate(candidate: StorageCandidate) {
    if (initialAnalysis) return;
    useStorageCleanupStore.getState().toggleCleanupCandidate(candidate);
  }

  function reportError(errorValue: unknown) {
    const message = readableError(errorValue);
    setLocalError(message);
    onError?.(message);
  }

  return (
    <>
      <div className={cn(pageSurface, "grid content-start gap-4")} data-selected-cleanup-ids={selectedCleanupIdsText}>
        <NoticeBanner tone="info" title={t("storageCleanupChooseScope")}>
          {t("storageCleanupScopeSafetyDesc")}
        </NoticeBanner>

        <section className={cn(contentPanel, "grid gap-3 p-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={sectionHeading}>{t("storageCleanupCurrentScope")}</h2>
              <p className={sectionDescription}>
                {selectedRoots.length
                  ? selectedRoots.map((root) => t("storageCleanupScopeValue").replace("{path}", root)).join(" / ")
                  : t("storageCleanupNoScopeSelected")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className={buttonSecondary} onClick={chooseScope}>
                <FolderOpen size={16} />
                <span>{t("storageCleanupChooseFolder")}</span>
              </button>
              <button className={glassButtonPrimary} onClick={scan} disabled={!selectedRoots.length || isScanning}>
                {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{t("storageCleanupScanScope")}</span>
              </button>
              {isScanning && (
                <button className={buttonSecondary} onClick={cancelScan}>
                  <XCircle size={16} />
                  <span>{t("storageCleanupCancelScan")}</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["downloads", "desktop", "documents", "temp"] as const).map((kind) => (
              <button key={kind} className={buttonSecondary} onClick={() => void useQuickScope(kind)}>
                {quickScopeLabel(kind, t)}
              </button>
            ))}
          </div>
        </section>

        {isScanning && (
          <NoticeBanner tone="info" title={t("storageCleanupLoading")}>
            <div className="grid gap-1">
              <span>{t("storageCleanupScanningDesc")}</span>
              <span className={metadataText}>
                {t("storageCleanupProgressLine")
                  .replace("{count}", (scanProgress?.scannedEntries ?? 0).toLocaleString())
                  .replace("{size}", formatBytes(scanProgress?.totalSize ?? 0))}
              </span>
              {scanProgress?.currentPath && (
                <span className={quietText} title={scanProgress.currentPath}>
                  {compactPath(scanProgress.currentPath, 110)}
                </span>
              )}
            </div>
          </NoticeBanner>
        )}

        {error && (
          <NoticeBanner tone="danger" title={t("storageCleanupLoadFailed")}>
            {error}
          </NoticeBanner>
        )}

        {!analysis ? (
          <StateBlock
            tone="info"
            title={t("storageCleanupChooseScopeEmptyTitle")}
            description={t("storageCleanupChooseScopeEmptyDesc")}
            primaryAction={
              <button className={glassButtonPrimary} onClick={chooseScope}>
                <FolderOpen size={16} />
                <span>{t("storageCleanupChooseFolder")}</span>
              </button>
            }
          />
        ) : (
          <>
            <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <MetricCard
                label={t("storageCleanupReclaimable")}
                value={formatBytes(analysis.reclaimable_estimate)}
                hint={t("storageCleanupEstimateHint")}
                tone="green"
              />
              <MetricCard
                label={t("storageCleanupReviewEstimate")}
                value={formatBytes(analysis.review_estimate)}
                hint={t("storageCleanupManualReviewHint")}
                tone="amber"
              />
              <MetricCard
                label={t("storageCleanupCautionCount")}
                value={tierCounts.Caution.toLocaleString()}
                hint={t("storageCleanupCautionHint")}
                tone="red"
              />
              <MetricCard
                label={t("storageCleanupDeniedCount")}
                value={deniedCount.toLocaleString()}
                hint={deniedCount > 0 ? t("storageCleanupDeniedLowEstimate") : t("storageCleanupDeniedNone")}
                tone="slate"
              />
            </section>

            {warnings.length > 0 && (
              <NoticeBanner tone="warning" title={t("storageCleanupScopeWarningTitle")}>
                {warnings.join(" ")}
              </NoticeBanner>
            )}

            {deniedCount > 0 && (
              <NoticeBanner tone="warning" title={t("storageCleanupDeniedTitle")}>
                {t("storageCleanupDeniedDesc").replace("{count}", deniedCount.toLocaleString())}
              </NoticeBanner>
            )}

            {executionResult && (
              <NoticeBanner tone={executionResult.failed > 0 ? "warning" : "success"} title={t("storageCleanupExecutionDone")}>
                <div className="grid gap-1">
                  <span>
                    {t("storageCleanupExecutionSummary")
                      .replace("{moved}", executionResult.moved.toLocaleString())
                      .replace("{skipped}", executionResult.skipped.toLocaleString())
                      .replace("{failed}", executionResult.failed.toLocaleString())}
                  </span>
                  <span className={metadataText}>{t("storageCleanupRestoreFromTrash")}</span>
                </div>
              </NoticeBanner>
            )}

            <section className={cn(contentPanel, "grid min-h-0 gap-3 p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className={sectionHeading}>{t("storageCleanupTopRanking")}</h2>
                  <p className={sectionDescription}>{t("storageCleanupTopRankingDesc")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter}
                      className={filter === activeTierFilter ? glassButtonPrimary : buttonSecondary}
                      onClick={() => {
                        if (!initialAnalysis) useStorageCleanupStore.getState().setActiveTierFilter(filter);
                      }}
                    >
                      <span>{filterTitle(filter, t)}</span>
                      <span>{filter === "All" ? sortedCandidates.length : tierCounts[filter]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid max-h-[min(56vh,540px)] gap-3 overflow-auto pr-1">
                {filteredCandidates.length === 0 ? (
                  <StateBlock
                    density="compact"
                    title={t("storageCleanupNoCandidates")}
                    description={t("storageCleanupNoCandidatesDesc")}
                  />
                ) : (
                  filteredCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      selected={selectedCleanupIds.has(candidate.id)}
                      t={t}
                      onToggleSafeCandidate={toggleSafeCandidate}
                      onReveal={reveal}
                    />
                  ))
                )}
              </div>
            </section>

            <footer className={cn(softPanel, "sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 p-3")}>
              <div className="min-w-0">
                <strong className="block text-sm text-[var(--ink)]">
                  {t("storageCleanupSelectedSafe").replace("{count}", selectedCleanupIds.size.toLocaleString())}
                </strong>
                <span className={quietText}>
                  {t("storageCleanupSelectedEstimate").replace("{size}", formatBytes(selectedReclaimable))}
                </span>
              </div>
              <button
                className={glassButtonPrimary}
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedCleanupIds.size || isExecuting || Boolean(initialAnalysis)}
              >
                <Trash2 size={17} />
                <span>{t("storageCleanupMoveToSafeTrash")}</span>
              </button>
            </footer>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={t("storageCleanupConfirmSafeTrashTitle")}
        description={t("storageCleanupConfirmSafeTrashDesc")
          .replace("{count}", selectedCleanupIds.size.toLocaleString())
          .replace("{size}", formatBytes(selectedReclaimable))}
        confirmLabel={t("storageCleanupMoveToSafeTrash")}
        cancelLabel={t("cancel")}
        isProcessing={isExecuting}
        onConfirm={moveSelectedToSafeTrash}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function CandidateCard({
  candidate,
  selected,
  t,
  onToggleSafeCandidate,
  onReveal
}: {
  candidate: StorageCandidate;
  selected: boolean;
  t: Translator;
  onToggleSafeCandidate: (candidate: StorageCandidate) => void;
  onReveal: (path: string) => void;
}) {
  const selectable = canSelectForCleanup(candidate);
  return (
    <article className={cn(softPanel, "grid gap-3 p-3")} data-candidate-id={candidate.id}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block truncate text-sm text-[var(--ink)]">{candidate.name}</strong>
          <span className={quietText} title={candidate.path}>{compactPath(candidate.path, 108)}</span>
        </div>
        <ToneBadge tone={tierTone(candidate.tier)}>{formatBytes(candidate.size)}</ToneBadge>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ToneBadge tone="slate">{candidate.category}</ToneBadge>
        <TierBadge tier={candidate.tier} t={t} />
        {selectable && <ToneBadge tone="green">{t("storageCleanupCanMoveToTrash")}</ToneBadge>}
      </div>
      <p className={metadataText}>{candidate.reason}</p>
      {candidate.risk_note && <p className={quietText}>{candidate.risk_note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {selectable && (
          <button
            className={selected ? glassButtonPrimary : buttonSecondary}
            onClick={() => onToggleSafeCandidate(candidate)}
            aria-pressed={selected}
          >
            <CheckCircle2 size={16} />
            <span>{selected ? t("storageCleanupSelected") : t("storageCleanupSelectForTrash")}</span>
          </button>
        )}
        <IconButton
          aria-label={t("storageCleanupReveal")}
          title={t("storageCleanupReveal")}
          onClick={() => onReveal(candidate.path)}
        >
          <FolderOpen size={16} />
        </IconButton>
        {candidate.tier === "Caution" && (
          <button className={buttonSecondary} onClick={() => onReveal(candidate.path)}>
            <HelpCircle size={16} />
            <span>{t("storageCleanupViewAdvice")}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function TierBadge({ tier, t }: { tier: CleanupTier; t: Translator }) {
  const Icon = tier === "Safe" ? CheckCircle2 : tier === "Review" ? AlertTriangle : ShieldAlert;
  return (
    <ToneBadge tone={tierTone(tier)}>
      <span className="inline-flex items-center gap-1">
        <Icon size={13} />
        <span>{filterTitle(tier, t)}</span>
      </span>
    </ToneBadge>
  );
}

function sortCandidatesBySize(candidates: StorageCandidate[]) {
  return [...candidates].sort((left, right) => right.size - left.size || left.path.localeCompare(right.path));
}

function countTiers(candidates: StorageCandidate[]) {
  return candidates.reduce<Record<CleanupTier, number>>(
    (counts, candidate) => {
      counts[candidate.tier] += 1;
      return counts;
    },
    { Safe: 0, Review: 0, Caution: 0 }
  );
}

function quickScopeLabel(kind: "downloads" | "desktop" | "documents" | "temp", t: Translator) {
  if (kind === "downloads") return t("storageCleanupQuickDownloads");
  if (kind === "desktop") return t("storageCleanupQuickDesktop");
  if (kind === "documents") return t("storageCleanupQuickDocuments");
  return t("storageCleanupQuickTemp");
}

function tierTone(tier: CleanupTier): "green" | "amber" | "red" {
  if (tier === "Safe") return "green";
  if (tier === "Review") return "amber";
  return "red";
}

function filterTitle(filter: CleanupTier | "All", t: Translator) {
  if (filter === "All") return t("storageCleanupAllFilter");
  if (filter === "Safe") return t("storageCleanupSafeTier");
  if (filter === "Review") return t("storageCleanupReviewTier");
  return t("storageCleanupCautionTier");
}
