import { useEffect, useMemo, useState } from "react";
import { desktopDir, documentDir, downloadDir, tempDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { tauriApi, type TauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
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
  "scanStorageCleanup" | "revealStorageCandidate" | "moveCleanupCandidatesToTrash"
>;

type Props = {
  initialAnalysis?: StorageAnalysis;
  initialRoots?: string[];
  api?: StorageCleanupApi;
  t?: Translator;
};

const TIER_ORDER: CleanupTier[] = ["Safe", "Review", "Caution"];
const RECENT_SCOPE_KEY = "zen-canvas.storage-cleanup.recent-roots";

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
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(initialAnalysis ?? null);
  const [selectedRoots, setSelectedRoots] = useState<string[]>(() => initialRoots ?? loadRecentRoots());
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<CleanupExecutionResult | null>(null);
  const [selectedCleanupIds, setSelectedCleanupIds] = useState<Set<string>>(
    () => new Set(defaultSelectedCleanupIds(initialAnalysis))
  );
  const [error, setError] = useState("");

  useEffect(() => {
    rememberRecentRoots(selectedRoots);
  }, [selectedRoots]);

  const sortedCandidates = useMemo(() => sortCandidatesBySize(analysis?.candidates ?? []), [analysis]);
  const groups = useMemo(() => groupCandidates(sortedCandidates), [sortedCandidates]);
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
      setSelectedRoots([selected]);
      setAnalysis(null);
      setExecutionResult(null);
      setSelectedCleanupIds(new Set());
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
      setSelectedRoots([path]);
      setAnalysis(null);
      setExecutionResult(null);
      setSelectedCleanupIds(new Set());
    } catch (scopeError) {
      const message = readableError(scopeError);
      setError(message);
      onError?.(message);
    }
  }

  async function scan() {
    if (!selectedRoots.length) {
      setError(t("storageCleanupScopeRequired"));
      return;
    }
    setIsScanning(true);
    setError("");
    setExecutionResult(null);
    try {
      const next = await api.scanStorageCleanup(selectedRoots);
      setAnalysis(next);
      setSelectedCleanupIds(new Set(defaultSelectedCleanupIds(next)));
    } catch (scanError) {
      const message = readableError(scanError);
      setError(message);
      onError?.(message);
    } finally {
      setIsScanning(false);
    }
  }

  async function reveal(path: string) {
    try {
      await api.revealStorageCandidate(path);
    } catch (revealError) {
      const message = readableError(revealError);
      setError(message);
      onError?.(message);
    }
  }

  async function moveSelectedToTrash() {
    if (!selectedCleanupIds.size || isExecuting) return;
    setIsExecuting(true);
    setError("");
    try {
      const result = await api.moveCleanupCandidatesToTrash([...selectedCleanupIds]);
      setExecutionResult(result);
      setConfirmOpen(false);
      if (selectedRoots.length) {
        const refreshed = await api.scanStorageCleanup(selectedRoots);
        setAnalysis(refreshed);
        setSelectedCleanupIds(new Set(defaultSelectedCleanupIds(refreshed)));
      }
    } catch (moveError) {
      const message = readableError(moveError);
      setError(message);
      onError?.(message);
    } finally {
      setIsExecuting(false);
    }
  }

  function toggleSafeCandidate(candidate: StorageCandidate) {
    if (!canSelectForCleanup(candidate)) return;
    setSelectedCleanupIds((current) => {
      const next = new Set(current);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.add(candidate.id);
      return next;
    });
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
              <span className={metadataText}>{t("storageCleanupProgressTodo")}</span>
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
                value={groups.Caution.length.toLocaleString()}
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

            <section className={cn(contentPanel, "grid gap-3 p-4")}>
              <div>
                <h2 className={sectionHeading}>{t("storageCleanupTopRanking")}</h2>
                <p className={sectionDescription}>{t("storageCleanupTopRankingDesc")}</p>
              </div>
              <div className="grid max-h-[min(52vh,520px)] gap-3 overflow-auto pr-1">
                {sortedCandidates.length === 0 ? (
                  <StateBlock
                    density="compact"
                    title={t("storageCleanupNoCandidates")}
                    description={t("storageCleanupNoCandidatesDesc")}
                  />
                ) : (
                  sortedCandidates.map((candidate) => (
                    <CandidateCard
                      key={`ranked-${candidate.id}`}
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

            <section className="grid gap-4 xl:grid-cols-3">
              {TIER_ORDER.map((tier) => (
                <TierSection
                  key={tier}
                  tier={tier}
                  candidates={groups[tier]}
                  selectedCleanupIds={selectedCleanupIds}
                  t={t}
                  onToggleSafeCandidate={toggleSafeCandidate}
                  onReveal={reveal}
                />
              ))}
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
                disabled={!selectedCleanupIds.size || isExecuting}
              >
                <Trash2 size={17} />
                <span>{t("storageCleanupMoveToTrash")}</span>
              </button>
            </footer>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={t("storageCleanupConfirmTrashTitle")}
        description={t("storageCleanupConfirmTrashDesc")
          .replace("{count}", selectedCleanupIds.size.toLocaleString())
          .replace("{size}", formatBytes(selectedReclaimable))}
        confirmLabel={t("storageCleanupMoveToTrash")}
        cancelLabel={t("cancel")}
        isProcessing={isExecuting}
        onConfirm={moveSelectedToTrash}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function TierSection({
  tier,
  candidates,
  selectedCleanupIds,
  t,
  onToggleSafeCandidate,
  onReveal
}: {
  tier: CleanupTier;
  candidates: StorageCandidate[];
  selectedCleanupIds: Set<string>;
  t: Translator;
  onToggleSafeCandidate: (candidate: StorageCandidate) => void;
  onReveal: (path: string) => void;
}) {
  return (
    <section className={cn(contentPanel, "grid min-h-0 gap-3 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={sectionHeading}>{tierTitle(tier, t)}</h2>
          <p className={sectionDescription}>{tierDescription(tier, t)}</p>
        </div>
        <TierBadge tier={tier} t={t} />
      </div>
      <div className="grid max-h-[min(42vh,360px)] gap-3 overflow-auto pr-1">
        {candidates.length === 0 ? (
          <StateBlock
            density="compact"
            title={t("storageCleanupNoCandidates")}
            description={t("storageCleanupNoCandidatesDesc")}
          />
        ) : (
          candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              selected={selectedCleanupIds.has(candidate.id)}
              t={t}
              onToggleSafeCandidate={onToggleSafeCandidate}
              onReveal={onReveal}
            />
          ))
        )}
      </div>
    </section>
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
          <span className={quietText} title={candidate.path}>{compactPath(candidate.path, 98)}</span>
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
        <span>{tierTitle(tier, t)}</span>
      </span>
    </ToneBadge>
  );
}

function sortCandidatesBySize(candidates: StorageCandidate[]) {
  return [...candidates].sort((left, right) => right.size - left.size || left.path.localeCompare(right.path));
}

function groupCandidates(candidates: StorageCandidate[]) {
  return candidates.reduce<Record<CleanupTier, StorageCandidate[]>>(
    (groups, candidate) => {
      groups[candidate.tier].push(candidate);
      return groups;
    },
    { Safe: [], Review: [], Caution: [] }
  );
}

function defaultSelectedCleanupIds(analysis?: StorageAnalysis | null): string[] {
  return (analysis?.candidates ?? [])
    .filter((candidate) => canSelectForCleanup(candidate) && candidate.selected_by_default)
    .map((candidate) => candidate.id);
}

function canSelectForCleanup(candidate: StorageCandidate) {
  return candidate.tier === "Safe" && candidate.trash_allowed && candidate.suggested_action === "MoveToTrash";
}

function loadRecentRoots(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SCOPE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function rememberRecentRoots(roots: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_SCOPE_KEY, JSON.stringify(roots.slice(0, 4)));
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

function tierTitle(tier: CleanupTier, t: Translator) {
  if (tier === "Safe") return t("storageCleanupSafeTier");
  if (tier === "Review") return t("storageCleanupReviewTier");
  return t("storageCleanupCautionTier");
}

function tierDescription(tier: CleanupTier, t: Translator) {
  if (tier === "Safe") return t("storageCleanupSafeTierDesc");
  if (tier === "Review") return t("storageCleanupReviewTierDesc");
  return t("storageCleanupCautionTierDesc");
}
