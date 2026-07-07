import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  HelpCircle,
  ListChecks,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import { tauriApi, type TauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import type {
  CleanupTier,
  LibraryScope,
  StorageAnalysis,
  StorageCandidate
} from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { compactPath, readableError } from "../../utils/viewHelpers";
import { buttonSecondary, cn, glassButtonPrimary } from "../../utils/tw";
import {
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
  "scanStorageCleanup" | "revealStorageCandidate" | "previewCleanupOperations"
>;

type Props = {
  initialAnalysis?: StorageAnalysis;
  api?: StorageCleanupApi;
  t?: Translator;
};

const TIER_ORDER: CleanupTier[] = ["Safe", "Review", "Caution"];
const TOP_CANDIDATE_LIMIT = 8;

export function StorageCleanupView(props: Props = {}) {
  if (props.t) return <StorageCleanupPanel {...props} t={props.t} />;
  return <StorageCleanupViewWithContext {...props} />;
}

function StorageCleanupViewWithContext(props: Omit<Props, "t">) {
  const { t, onError, setView } = useChromeContext();
  return <StorageCleanupPanel {...props} t={t} onError={onError} setView={setView} />;
}

function StorageCleanupPanel({
  initialAnalysis,
  api = tauriApi,
  t,
  onError,
  setView
}: Props & { t: Translator; onError?: (message: string) => void; setView?: (view: "preview") => void }) {
  const setPreviewResult = useOperationQueueStore((state) => state.setPreviewResult);
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(initialAnalysis ?? null);
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [selectedCleanupIds, setSelectedCleanupIds] = useState<Set<string>>(
    () => new Set(defaultSelectedCleanupIds(initialAnalysis))
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialAnalysis) return;
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const candidates = analysis?.candidates ?? [];
  const groups = useMemo(() => groupCandidates(candidates), [candidates]);
  const rankedCandidates = useMemo(
    () => [...candidates].sort((left, right) => right.size - left.size).slice(0, TOP_CANDIDATE_LIMIT),
    [candidates]
  );
  const selectedCleanupIdsText = [...selectedCleanupIds].join(",");
  const selectedReclaimable = candidates
    .filter((candidate) => selectedCleanupIds.has(candidate.id))
    .reduce((sum, candidate) => sum + candidate.size, 0);
  const deniedCount = analysis?.denied_paths.length ?? 0;

  async function scan() {
    setIsScanning(true);
    setError("");
    try {
      const next = await api.scanStorageCleanup();
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

  async function generateCleanupList() {
    if (!selectedCleanupIds.size) return;
    setIsGeneratingPreview(true);
    setError("");
    try {
      const result = await api.previewCleanupOperations([...selectedCleanupIds]);
      setPreviewResult(result, cleanupPreviewScope(candidates, selectedCleanupIds));
      if (setView) setView("preview");
    } catch (previewError) {
      const message = readableError(previewError);
      setError(message);
      onError?.(message);
    } finally {
      setIsGeneratingPreview(false);
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
    <div className={cn(pageSurface, "grid content-start gap-4")} data-selected-cleanup-ids={selectedCleanupIdsText}>
      <NoticeBanner
        tone="info"
        title={t("storageCleanupSafetyTitle")}
        action={
          <button className={buttonSecondary} onClick={scan} disabled={isScanning}>
            <RefreshCw size={16} className={isScanning ? "animate-spin" : ""} />
            <span>{t("storageCleanupRescan")}</span>
          </button>
        }
      >
        {t("storageCleanupSafetyDesc")}
      </NoticeBanner>

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
          title={t("storageCleanupLoading")}
          description={t("storageCleanupLoadingDesc")}
          primaryAction={
            <button className={glassButtonPrimary} onClick={scan} disabled={isScanning}>
              <RefreshCw size={16} className={isScanning ? "animate-spin" : ""} />
              <span>{t("storageCleanupRescan")}</span>
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

          {deniedCount > 0 && (
            <NoticeBanner tone="warning" title={t("storageCleanupDeniedTitle")}>
              {t("storageCleanupDeniedDesc").replace("{count}", deniedCount.toLocaleString())}
            </NoticeBanner>
          )}

          <section className={cn(contentPanel, "grid gap-3 p-4")}>
            <div>
              <h2 className={sectionHeading}>{t("storageCleanupTopRanking")}</h2>
              <p className={sectionDescription}>{t("storageCleanupTopRankingDesc")}</p>
            </div>
            <div className="grid max-h-[min(36vh,320px)] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
              {rankedCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={cn(softPanel, "grid min-w-0 gap-2 p-3")}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <strong className="min-w-0 truncate text-sm text-[var(--ink)]">{candidate.name}</strong>
                    <ToneBadge tone={tierTone(candidate.tier)}>{formatBytes(candidate.size)}</ToneBadge>
                  </div>
                  <span className={quietText} title={candidate.path}>{compactPath(candidate.path, 78)}</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <ToneBadge tone="slate">{candidate.category}</ToneBadge>
                    <TierBadge tier={candidate.tier} t={t} />
                  </div>
                </div>
              ))}
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
              onClick={generateCleanupList}
              disabled={!selectedCleanupIds.size || isGeneratingPreview}
            >
              <ListChecks size={17} />
              <span>{t("storageCleanupGeneratePreview")}</span>
            </button>
          </footer>
        </>
      )}
    </div>
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
          <span className={quietText} title={candidate.path}>{compactPath(candidate.path, 86)}</span>
        </div>
        <ToneBadge tone={tierTone(candidate.tier)}>{formatBytes(candidate.size)}</ToneBadge>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ToneBadge tone="slate">{candidate.category}</ToneBadge>
        <TierBadge tier={candidate.tier} t={t} />
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
            <span>{t("storageCleanupAddToPreview")}</span>
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

function cleanupPreviewScope(candidates: StorageCandidate[], selectedCleanupIds: Set<string>): LibraryScope {
  return {
    kind: "roots",
    roots: candidates
      .filter((candidate) => selectedCleanupIds.has(candidate.id))
      .map((candidate) => candidate.path)
  };
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
