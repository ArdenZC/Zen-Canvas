import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FolderOpen,
  HelpCircle,
  ListChecks,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import { tauriApi, type TauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import type {
  CleanupPreviewItem,
  CleanupTier,
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
  "scanStorageCleanup" | "revealStorageCandidate" | "previewCleanupCandidates"
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
  const { t, onError } = useChromeContext();
  return <StorageCleanupPanel {...props} t={t} onError={onError} />;
}

function StorageCleanupPanel({
  initialAnalysis,
  api = tauriApi,
  t,
  onError
}: Props & { t: Translator; onError?: (message: string) => void }) {
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(initialAnalysis ?? null);
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [selectedCleanupIds, setSelectedCleanupIds] = useState<Set<string>>(
    () => new Set(defaultSelectedCleanupIds(initialAnalysis))
  );
  const [previewItems, setPreviewItems] = useState<CleanupPreviewItem[]>([]);
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
      setPreviewItems([]);
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

  async function generateCleanupPreview() {
    if (!selectedCleanupIds.size) return;
    setIsGeneratingPreview(true);
    setError("");
    try {
      const items = await api.previewCleanupCandidates([...selectedCleanupIds]);
      setPreviewItems(items);
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
            <div className="max-h-[min(34vh,300px)] overflow-auto pr-1">
              <div className="grid min-w-[720px] grid-cols-[minmax(140px,1.1fr)_minmax(220px,2fr)_110px_140px_96px] gap-3 border-b border-[var(--line)] px-2 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--quiet)]">
                <span>{t("storageCleanupName")}</span>
                <span>{t("storageCleanupPath")}</span>
                <span>{t("storageCleanupSize")}</span>
                <span>{t("storageCleanupCategory")}</span>
                <span>{t("storageCleanupTier")}</span>
              </div>
              {rankedCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="grid min-w-[720px] grid-cols-[minmax(140px,1.1fr)_minmax(220px,2fr)_110px_140px_96px] gap-3 border-b border-[var(--line-dark)] px-2 py-2 text-sm last:border-b-0"
                >
                  <strong className="truncate text-[var(--ink)]">{candidate.name}</strong>
                  <span className="truncate text-[var(--muted)]" title={candidate.path}>{compactPath(candidate.path, 82)}</span>
                  <span className="tabular-nums text-[var(--ink)]">{formatBytes(candidate.size)}</span>
                  <span className="truncate text-[var(--muted)]">{candidate.category}</span>
                  <TierBadge tier={candidate.tier} t={t} />
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

          {previewItems.length > 0 && (
            <section className={cn(contentPanel, "grid gap-3 p-4")}>
              <div>
                <h2 className={sectionHeading}>{t("storageCleanupPreviewTitle")}</h2>
                <p className={sectionDescription}>{t("storageCleanupPreviewDesc")}</p>
              </div>
              <div className="max-h-[min(28vh,240px)] overflow-auto pr-1">
                {previewItems.map((item) => (
                  <div key={item.id} className="grid gap-1 border-b border-[var(--line-dark)] py-2 last:border-b-0">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <strong className="truncate text-sm text-[var(--ink)]">{item.name}</strong>
                      <ToneBadge tone="green">{formatBytes(item.size)}</ToneBadge>
                    </div>
                    <span className={quietText}>{compactPath(item.path, 110)}</span>
                    {item.blocking_reason && <span className={metadataText}>{item.blocking_reason}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

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
              onClick={generateCleanupPreview}
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
  return (analysis?.candidates ?? []).filter(canSelectForCleanup).map((candidate) => candidate.id);
}

function canSelectForCleanup(candidate: StorageCandidate) {
  return candidate.tier === "Safe" && candidate.trash_allowed && candidate.suggested_action === "MoveToTrash";
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
