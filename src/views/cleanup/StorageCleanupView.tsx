import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { desktopDir, documentDir, downloadDir, tempDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Check,
  FileSearch,
  FolderOpen,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  XCircle
} from "lucide-react";
import { tauriApi, type TauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import type {
  AnalysisDetector,
  AnalysisDetectorDescriptor,
  AnalysisFinding,
  AnalysisFindingPage,
  AnalysisFindingEvidence,
  AnalysisRun,
  CleanupExecutionResult,
  CleanupFindingSelection,
  OperationPreviewResult,
  StartAnalysisRunRequest
} from "../../types/domain";
import type { Translator, View } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { localFileMutationUnavailableCode } from "../../utils/fileMutationCapability";
import { resolveReclaimableBytes } from "../../utils/reclaimableBytes";
import { localizedStableError, readableError, compactPath, normalizePathLike } from "../../utils/viewHelpers";
import { cn } from "../../utils/tw";
import {
  Button,
  ConfirmDialog,
  DurableTaskStatus,
  MetricStrip,
  NoticeBanner,
  SegmentedControl,
  SideSheet,
  StateBlock,
  ToneBadge,
  contentPanel,
  metadataText,
  pageSurface,
  quietText,
  sectionDescription,
  sectionHeading
} from "../shared/ui";

type CleanupApi = Partial<Pick<
  TauriApi,
  | "listAnalysisDetectors"
  | "startAnalysisRun"
  | "cancelAnalysisRun"
  | "retryAnalysisRun"
  | "getAnalysisRun"
  | "getActiveAnalysisRun"
  | "listAnalysisRuns"
  | "listAnalysisRunDetectors"
  | "listAnalysisFindings"
  | "getAnalysisFinding"
  | "listAnalysisFindingEvidence"
  | "setAnalysisFindingDecision"
  | "revalidateAnalysisFinding"
  | "previewCleanupOperations"
  | "moveCleanupCandidatesToSafeTrash"
  | "revealInFolder"
  | "getAISettings"
  | "analyzeCleanupCandidatesWithAI"
  | "onAnalysisRunUpdated"
  | "onAnalysisFindingsPublished"
  | "onAnalysisDetectorUpdated"
>>;

type Props = {
  initialRoots?: string[];
  api?: CleanupApi;
  t?: Translator;
  onError?: (message: string) => void;
  onNavigate?: (view: View) => void;
};

type CleanupTier = "safe" | "review" | "caution";

const FINDING_PAGE_SIZE = 100;
const AI_RECHECK_BATCH_SIZE = 50;
const FINDING_ROW_HEIGHT = 238;

export function StorageCleanupView(props: Props = {}) {
  if (props.t) return <StorageCleanupPanel {...props} t={props.t} />;
  return <StorageCleanupViewWithContext {...props} />;
}

function StorageCleanupViewWithContext(props: Omit<Props, "t" | "onError" | "onNavigate">) {
  const { t, onError, setView } = useChromeContext();
  return <StorageCleanupPanel {...props} t={t} onError={onError} onNavigate={setView} />;
}

function StorageCleanupPanel({
  initialRoots,
  api = tauriApi,
  t,
  onError,
  onNavigate
}: Props & { t: Translator }) {
  const [selectedRoots, setSelectedRoots] = useState<string[]>(() => normalizeScopePaths(initialRoots ?? []));
  const [detectors, setDetectors] = useState<AnalysisDetectorDescriptor[]>([]);
  const [, setRuns] = useState<AnalysisRun[]>([]);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [runDetectors, setRunDetectors] = useState<AnalysisDetector[]>([]);
  const [findings, setFindings] = useState<AnalysisFinding[]>([]);
  const [findingCache, setFindingCache] = useState<Record<string, AnalysisFinding>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<CleanupTier>("safe");
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(() => new Set());
  const [evidenceByFinding, setEvidenceByFinding] = useState<Record<string, AnalysisFindingEvidence[]>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(() => new Set());
  const [reviewFinding, setReviewFinding] = useState<AnalysisFinding | null>(null);
  const [preview, setPreview] = useState<OperationPreviewResult | null>(null);
  const [confirmPreviewOpen, setConfirmPreviewOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<CleanupExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isAiWorking, setIsAiWorking] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [error, setError] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const findingListRef = useRef<HTMLDivElement | null>(null);
  const findingsEpoch = useRef(0);
  const scopeEpoch = useRef(0);
  const requestKeyRef = useRef<string | null>(null);
  const scanIntentInFlight = useRef(false);
  const aiCancelRequested = useRef(false);
  const scopeHydrated = useRef(Boolean(normalizeScopePaths(initialRoots ?? []).length));
  const initialRootsPropKey = useRef(scopeKey(initialRoots ?? []));
  const defaultSelectionRuns = useRef(new Set<string>());
  const mutationUnavailable = localFileMutationUnavailableCode();

  useEffect(() => () => {
    aiCancelRequested.current = true;
  }, []);

  const reportError = useCallback((value: unknown) => {
    const raw = readableError(value);
    const message = localizedStableError(raw, t);
    setError(message);
    onError?.(message);
  }, [onError, t]);

  const replaceCopy = useCallback((key: Parameters<Translator>[0], replacements: Record<string, string | number> = {}) => {
    return Object.entries(replacements).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      t(key)
    );
  }, [t]);

  const resetReviewStateForScopeChange = useCallback(() => {
    scopeEpoch.current += 1;
    findingsEpoch.current += 1;
    requestKeyRef.current = null;
    defaultSelectionRuns.current.clear();
    aiCancelRequested.current = true;
    setRun(null);
    setRunDetectors([]);
    setFindings([]);
    setFindingCache({});
    setNextCursor(null);
    setSelectedFindingIds(new Set());
    setEvidenceByFinding({});
    setExpandedEvidence(new Set());
    setReviewFinding(null);
    setPreview(null);
    setConfirmPreviewOpen(false);
    setExecutionResult(null);
    setAiStatus("");
    setError("");
    setLoadingFindings(false);
  }, []);

  const applyScopeSelection = useCallback((roots: string[]) => {
    const nextRoots = normalizeScopePaths(roots);
    if (scopeKey(selectedRoots) !== scopeKey(nextRoots)) resetReviewStateForScopeChange();
    scopeHydrated.current = true;
    setSelectedRoots(nextRoots);
    setError("");
  }, [resetReviewStateForScopeChange, selectedRoots]);

  useEffect(() => {
    const nextKey = scopeKey(initialRoots ?? []);
    if (nextKey === initialRootsPropKey.current) return;
    initialRootsPropKey.current = nextKey;
    applyScopeSelection(initialRoots ?? []);
  }, [applyScopeSelection, initialRoots]);

  const loadFindings = useCallback(async (runId: string, tier: CleanupTier, cursor: string | null = null, append = false) => {
    if (!api.listAnalysisFindings) return;
    const epoch = ++findingsEpoch.current;
    setLoadingFindings(true);
    try {
      const page = await api.listAnalysisFindings({
        runId,
        tier,
        status: "active",
        cursor,
        limit: FINDING_PAGE_SIZE
      });
      if (epoch !== findingsEpoch.current) return;
      setFindings((current) => append ? [...current, ...page.findings] : page.findings);
      setNextCursor(page.nextCursor);
      setFindingCache((current) => {
        const next = { ...current };
        for (const finding of page.findings) next[finding.id] = finding;
        return next;
      });
      if (!append && tier === "safe" && !defaultSelectionRuns.current.has(runId)) {
        defaultSelectionRuns.current.add(runId);
        setSelectedFindingIds((current) => {
          const next = new Set(current);
          for (const finding of page.findings) {
            if (isBackendDefaultSafeFinding(finding)) next.add(finding.id);
          }
          return next;
        });
      }
    } catch (loadError) {
      if (epoch === findingsEpoch.current) reportError(loadError);
    } finally {
      if (epoch === findingsEpoch.current) setLoadingFindings(false);
    }
  }, [api, reportError]);

  const loadRunDetails = useCallback(async (runId: string, clearFindings = true, expectedScopeEpoch = scopeEpoch.current, expectedScopeKey?: string) => {
    if (!api.getAnalysisRun || !api.listAnalysisRunDetectors) return;
    try {
      const [nextRun, nextDetectors] = await Promise.all([
        api.getAnalysisRun(runId),
        api.listAnalysisRunDetectors(runId)
      ]);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      if (expectedScopeKey && scopeKey(scopePaths(nextRun)) !== expectedScopeKey) return;
      if (clearFindings) {
        findingsEpoch.current += 1;
        setFindings([]);
        setNextCursor(null);
      }
      setRun((current) => current && current.id === nextRun.id && nextRun.revision < current.revision ? current : nextRun);
      setRunDetectors(nextDetectors);
      setRuns((current) => {
        const withoutCurrent = current.filter((item) => item.id !== nextRun.id);
        return [nextRun, ...withoutCurrent].slice(0, 20);
      });
      if (!scopeHydrated.current) {
        const paths = scopePaths(nextRun);
        if (paths.length) {
          scopeHydrated.current = true;
          setSelectedRoots(paths);
        }
      }
    } catch (loadError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(loadError);
    }
  }, [api, reportError]);

  useEffect(() => {
    let disposed = false;
    const hydrationScopeEpoch = scopeEpoch.current;
    async function hydrate() {
      if (!api.listAnalysisDetectors || !api.listAnalysisRuns) {
        setUnsupported(true);
        setLoading(false);
        return;
      }
      try {
        const activePromise = api.getActiveAnalysisRun ? api.getActiveAnalysisRun() : Promise.resolve(null);
        const [availableDetectors, listedRuns, activeRun] = await Promise.all([
          api.listAnalysisDetectors(),
          api.listAnalysisRuns(20),
          activePromise
        ]);
        if (disposed || hydrationScopeEpoch !== scopeEpoch.current) return;
        setDetectors(availableDetectors);
        const cleanupRuns = listedRuns.filter(isCleanupRun);
        setRuns(cleanupRuns);
        const candidates = (activeRun && isCleanupRun(activeRun)
          ? [activeRun, ...cleanupRuns.filter((listedRun) => listedRun.id !== activeRun.id)]
          : cleanupRuns)
          .slice()
          .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);
        const requestedScopeKey = scopeKey(initialRoots ?? []);
        const candidate = requestedScopeKey
          ? candidates.find((listedRun) => scopeKey(scopePaths(listedRun)) === requestedScopeKey) ?? null
          : candidates[0] ?? null;
        if (candidate) await loadRunDetails(candidate.id, true, hydrationScopeEpoch, requestedScopeKey || undefined);
      } catch (loadError) {
        if (!disposed) reportError(loadError);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      disposed = true;
    };
  }, [api, loadRunDetails, reportError]);

  useEffect(() => {
    if (!run || !api.listAnalysisFindings || isRunInProgress(run)) return;
    void loadFindings(run.id, activeTier);
  }, [activeTier, api.listAnalysisFindings, loadFindings, run?.id, run?.revision, run]);

  useEffect(() => {
    const disposers: UnlistenFn[] = [];
    let disposed = false;
    async function subscribe() {
      const offRun = await api.onAnalysisRunUpdated?.((updated) => {
        if (!isCleanupRun(updated) || !run || updated.id !== run.id) return;
        if (updated.revision >= run.revision) void loadRunDetails(updated.id);
      });
      const offFindings = await api.onAnalysisFindingsPublished?.((updated) => {
        if (run && updated.id === run.id) void loadRunDetails(updated.id);
      });
      const offDetector = await api.onAnalysisDetectorUpdated?.((updated) => {
        if (run && updated.runId === run.id) void loadRunDetails(updated.runId, false);
      });
      for (const disposer of [offRun, offFindings, offDetector]) {
        if (disposer) disposers.push(disposer);
      }
      if (disposed) while (disposers.length) disposers.pop()?.();
    }
    void subscribe();
    return () => {
      disposed = true;
      while (disposers.length) disposers.pop()?.();
    };
  }, [api, loadRunDetails, run]);

  const chooseScope = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: t("storageCleanupChooseScope") });
      if (typeof selected === "string" && selected.trim()) {
        applyScopeSelection([selected]);
      }
    } catch (scopeError) {
      reportError(scopeError);
    }
  }, [applyScopeSelection, reportError, t]);

  const chooseQuickScope = useCallback(async (kind: "downloads" | "desktop" | "documents" | "temp") => {
    try {
      const path = kind === "downloads"
        ? await downloadDir()
        : kind === "desktop"
          ? await desktopDir()
          : kind === "documents"
            ? await documentDir()
            : await tempDir();
      applyScopeSelection([path]);
    } catch (scopeError) {
      reportError(scopeError);
    }
  }, [applyScopeSelection, reportError]);

  const startScan = useCallback(async () => {
    if (scanIntentInFlight.current || isAiWorking) return;
    if (!selectedRoots.length) {
      setError(t("storageCleanupScopeRequired"));
      return;
    }
    if (!api.startAnalysisRun) {
      setUnsupported(true);
      return;
    }
    setError("");
    setExecutionResult(null);
    setPreview(null);
    setConfirmPreviewOpen(false);
    setSelectedFindingIds(new Set());
    setFindingCache({});
    defaultSelectionRuns.current.clear();
    scanIntentInFlight.current = true;
    const requestedScopeEpoch = scopeEpoch.current;
    requestKeyRef.current = `cleanup-${crypto.randomUUID()}`;
    const request: StartAnalysisRunRequest = {
      scope: { kind: "approvedCleanupPaths", paths: selectedRoots },
      detectorIds: detectors.filter((detector) => detector.supportsApprovedPaths).map((detector) => detector.detectorId),
      requestKey: requestKeyRef.current
    };
    setIsMutating(true);
    try {
      const started = await api.startAnalysisRun(request);
      if (requestedScopeEpoch !== scopeEpoch.current) return;
      setRun(started);
      await loadRunDetails(started.id, true, requestedScopeEpoch);
    } catch (startError) {
      reportError(startError);
    } finally {
      requestKeyRef.current = null;
      scanIntentInFlight.current = false;
      setIsMutating(false);
    }
  }, [api, detectors, isAiWorking, loadRunDetails, reportError, selectedRoots, t]);

  const cancelRun = useCallback(async () => {
    if (!run || !api.cancelAnalysisRun) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    setIsMutating(true);
    try {
      await api.cancelAnalysisRun(runId);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      await loadRunDetails(runId, false, expectedScopeEpoch);
    } catch (cancelError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(cancelError);
    } finally {
      setIsMutating(false);
    }
  }, [api, loadRunDetails, reportError, run]);

  const retryRun = useCallback(async () => {
    if (!run || !api.retryAnalysisRun) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    setIsMutating(true);
    setError("");
    setSelectedFindingIds(new Set());
    setPreview(null);
    setConfirmPreviewOpen(false);
    defaultSelectionRuns.current.delete(runId);
    try {
      const retried = await api.retryAnalysisRun(runId);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      setRun(retried);
      await loadRunDetails(retried.id, true, expectedScopeEpoch);
    } catch (retryError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(retryError);
    } finally {
      setIsMutating(false);
    }
  }, [api, loadRunDetails, reportError, run]);

  const revealFinding = useCallback(async (finding: AnalysisFinding) => {
    if (!finding.pathSnapshot || !api.revealInFolder) return;
    try {
      await api.revealInFolder(finding.pathSnapshot);
    } catch (revealError) {
      reportError(revealError);
    }
  }, [api, reportError]);

  const toggleEvidence = useCallback(async (finding: AnalysisFinding) => {
    const expectedScopeEpoch = scopeEpoch.current;
    const next = new Set(expandedEvidence);
    if (next.has(finding.id)) {
      next.delete(finding.id);
      setExpandedEvidence(next);
      return;
    }
    if (!evidenceByFinding[finding.id] && api.listAnalysisFindingEvidence) {
      try {
        const evidence = await api.listAnalysisFindingEvidence(finding.id);
        if (expectedScopeEpoch !== scopeEpoch.current) return;
        setEvidenceByFinding((current) => ({ ...current, [finding.id]: evidence }));
      } catch (evidenceError) {
        if (expectedScopeEpoch === scopeEpoch.current) reportError(evidenceError);
        return;
      }
    }
    if (expectedScopeEpoch !== scopeEpoch.current) return;
    next.add(finding.id);
    setExpandedEvidence(next);
  }, [api, evidenceByFinding, expandedEvidence, reportError]);

  const acknowledgeReviewFinding = useCallback(async () => {
    if (!reviewFinding || !api.getAnalysisFinding || !api.setAnalysisFindingDecision) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const findingId = reviewFinding.id;
    const runId = run?.id;
    setIsMutating(true);
    try {
      const current = await api.getAnalysisFinding(findingId);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      if (!current || current.tier !== "review" || current.status !== "active") throw new Error("cleanup_finding_changed");
      const decision = await api.setAnalysisFindingDecision({
        findingKey: current.findingKey,
        decision: "acknowledged",
        expectedRevision: current.decisionRevision ?? 0
      });
      if (decision.decision !== "acknowledged") throw new Error("cleanup_review_not_acknowledged");
      const refreshed = await api.getAnalysisFinding(current.id);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      if (!refreshed || !isFindingSelectable(refreshed)) throw new Error("cleanup_review_not_executable");
      setFindingCache((cache) => ({ ...cache, [refreshed.id]: refreshed }));
      setSelectedFindingIds((selected) => new Set(selected).add(refreshed.id));
      setReviewFinding(null);
      if (runId) await loadFindings(runId, activeTier);
    } catch (reviewError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(reviewError);
    } finally {
      setIsMutating(false);
    }
  }, [activeTier, api, loadFindings, reportError, reviewFinding, run]);

  const revalidateFinding = useCallback(async (finding: AnalysisFinding) => {
    if (!api.revalidateAnalysisFinding) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run?.id;
    setIsMutating(true);
    try {
      const refreshed = await api.revalidateAnalysisFinding(finding.id);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      setFindingCache((cache) => ({ ...cache, [refreshed.id]: refreshed }));
      setSelectedFindingIds((selected) => {
        const next = new Set(selected);
        if (!isFindingSelectable(refreshed)) next.delete(refreshed.id);
        return next;
      });
      if (runId) await loadFindings(runId, activeTier);
    } catch (revalidateError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(revalidateError);
    } finally {
      setIsMutating(false);
    }
  }, [activeTier, api, loadFindings, reportError, run]);

  const toggleFinding = useCallback((finding: AnalysisFinding) => {
    if (finding.tier === "caution" || finding.status !== "active") return;
    if (!isFindingSelectable(finding)) {
      if (finding.tier === "review" && finding.decision !== "acknowledged") setReviewFinding(finding);
      return;
    }
    setSelectedFindingIds((current) => {
      const next = new Set(current);
      if (next.has(finding.id)) next.delete(finding.id);
      else next.add(finding.id);
      return next;
    });
  }, []);

  const selectedFindings = useMemo(
    () => [...selectedFindingIds].map((id) => findingCache[id]).filter((finding): finding is AnalysisFinding => Boolean(finding)),
    [findingCache, selectedFindingIds]
  );
  const selectedBytes = useMemo(
    () => selectedFindings.reduce((sum, finding) => sum + resolveReclaimableBytes({
      exact: finding.exactReclaimableBytes,
      potential: finding.potentialReclaimableBytes,
      legacy: finding.sizeBytes
    }).bytes, 0),
    [selectedFindings]
  );
  const runReclaimable = useMemo(
    () => resolveReclaimableBytes({ exact: run?.exactReclaimableBytes, potential: run?.potentialReclaimableBytes }),
    [run]
  );

  const buildSelections = useCallback((): CleanupFindingSelection[] => {
    if (!selectedFindings.length) return [];
    return selectedFindings.map((finding) => {
      if (!isFindingSelectable(finding)) throw new Error("cleanup_selection_not_executable");
      const selection: CleanupFindingSelection = { findingId: finding.id, expectedRevision: finding.revision };
      if (finding.tier === "review") {
        if (finding.decision !== "acknowledged" || finding.decisionRevision == null) throw new Error("cleanup_review_confirmation_required");
        selection.reviewConfirmation = { decisionRevision: finding.decisionRevision };
      }
      return selection;
    });
  }, [selectedFindings]);

  const previewSelected = useCallback(async () => {
    if (!run || !api.previewCleanupOperations || !selectedFindings.length) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    if (mutationUnavailable) {
      reportError(t("storageCleanupMutationUnavailable"));
      return;
    }
    setIsMutating(true);
    setError("");
    try {
      const result = await api.previewCleanupOperations(runId, buildSelections());
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      setPreview(result);
    } catch (previewError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(previewError);
    } finally {
      setIsMutating(false);
    }
  }, [api, buildSelections, mutationUnavailable, reportError, run, selectedFindings.length, t]);

  const moveSelectedToSafeTrash = useCallback(async () => {
    if (!run || !api.moveCleanupCandidatesToSafeTrash || !preview || !selectedFindings.length) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    setIsMutating(true);
    setError("");
    try {
      const result = await api.moveCleanupCandidatesToSafeTrash(runId, buildSelections());
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      setExecutionResult(result);
      setSelectedFindingIds(new Set());
      setPreview(null);
      setConfirmPreviewOpen(false);
      await loadRunDetails(runId, true, expectedScopeEpoch);
    } catch (executionError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(executionError);
    } finally {
      setIsMutating(false);
    }
  }, [api, buildSelections, loadRunDetails, preview, reportError, run, selectedFindings.length]);

  const recheckReviewFindings = useCallback(async () => {
    if (!run || !api.analyzeCleanupCandidatesWithAI || !api.getAISettings) {
      reportError(t("storageCleanupAIUnsupported"));
      return;
    }
    if (isAiWorking) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const reviewRunId = run.id;
    aiCancelRequested.current = false;
    setIsAiWorking(true);
    setAiStatus("");
    try {
      const settings = await api.getAISettings();
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      if (!settings.enabled) throw new Error("cleanup_ai_disabled");
      if (!settings.cleanupAiEnabled) throw new Error("cleanup_ai_feature_disabled");
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        if (expectedScopeEpoch !== scopeEpoch.current) return;
        if (aiCancelRequested.current) {
          setAiStatus(t("storageCleanupAIRecheckCanceled"));
          return;
        }
        setAiStatus(replaceCopy("storageCleanupAIRecheckCollecting", { count: ids.length }));
        const page: AnalysisFindingPage | undefined = await api.listAnalysisFindings?.({
          runId: reviewRunId,
          tier: "review",
          status: "active",
          cursor,
          limit: FINDING_PAGE_SIZE
        });
        if (!page) throw new Error("cleanup_findings_unavailable");
        ids.push(...page.findings.filter((finding) => finding.tier === "review" && finding.status === "active").map((finding) => finding.id));
        cursor = page.nextCursor;
      } while (cursor);
      if (!ids.length) {
        setAiStatus(t("storageCleanupAINoTargets"));
        return;
      }
      let processed = 0;
      let skipped = 0;
      let failed = 0;
      for (let offset = 0; offset < ids.length; offset += AI_RECHECK_BATCH_SIZE) {
        if (expectedScopeEpoch !== scopeEpoch.current) return;
        if (aiCancelRequested.current) {
          setAiStatus(replaceCopy("storageCleanupAIRecheckCanceledSummary", { processed, total: ids.length, skipped, failed }));
          return;
        }
        const batch = ids.slice(offset, offset + AI_RECHECK_BATCH_SIZE);
        setAiStatus(replaceCopy("storageCleanupAIRecheckWorkingProgress", { processed, total: ids.length }));
        try {
          const updated = await api.analyzeCleanupCandidatesWithAI(reviewRunId, batch);
          processed += updated.length;
          skipped += Math.max(0, batch.length - updated.length);
        } catch {
          failed += batch.length;
        }
      }
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      setAiStatus(replaceCopy("storageCleanupAIRecheckDoneSummary", { total: ids.length, processed, skipped, failed }));
      await loadRunDetails(reviewRunId, true, expectedScopeEpoch);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      await loadFindings(reviewRunId, activeTier);
    } catch (aiError) {
      if (expectedScopeEpoch === scopeEpoch.current) reportError(aiError);
    } finally {
      setIsAiWorking(false);
    }
  }, [activeTier, api, isAiWorking, loadFindings, loadRunDetails, reportError, replaceCopy, run, t]);

  const cancelAiRecheck = useCallback(() => {
    aiCancelRequested.current = true;
    setAiStatus(t("storageCleanupAIRecheckCanceling"));
  }, [t]);

  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => findingListRef.current,
    estimateSize: () => FINDING_ROW_HEIGHT,
    overscan: 5
  });
  const virtualItems = virtualizer.getVirtualItems();
  const renderedVirtualItems = virtualItems.length
    ? virtualItems
    : findings.slice(0, 20).map((_, index) => ({ index, start: index * FINDING_ROW_HEIGHT, size: FINDING_ROW_HEIGHT, key: findings[index]?.id ?? index }));

  const onFindingListKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
      event.preventDefault();
    }
  }, []);

  const runState = run ? durableRunState(run) : "idle";
  const runIsPartial = Boolean(run && isPartialRun(run));
  const runScope = run ? scopePaths(run) : selectedRoots;
  const canReviewFindings = Boolean(run && !isRunInProgress(run) && run.findingsPublished > 0);

  return (
    <>
      <div className={cn(pageSurface, "grid content-start gap-4")} data-cleanup-authority="analysis-run-finding">
        <NoticeBanner tone="info" title={t("storageCleanupSafetyTitle")}>
          {t("storageCleanupSafetyDesc")}
        </NoticeBanner>

        <section className={cn(contentPanel, "grid gap-3 p-4")} data-cleanup-scope>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={sectionHeading}>{t("storageCleanupCurrentScope")}</h2>
              <p className={sectionDescription}>
                {selectedRoots.length
                  ? selectedRoots.map((root) => replaceCopy("storageCleanupScopeValue", { path: root })).join(" / ")
                  : t("storageCleanupNoScopeSelected")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="compact" onClick={() => void chooseScope()}>
                <FolderOpen size={15} aria-hidden="true" />{t("storageCleanupChooseFolder")}
              </Button>
              <Button variant="primary" size="compact" disabled={!selectedRoots.length || isMutating || isAiWorking || isRunInProgress(run)} onClick={() => void startScan()}>
                {isMutating && !run ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
                {run ? t("storageCleanupRescan") : t("storageCleanupScanScope")}
              </Button>
              {run && isRunInProgress(run) ? (
                <Button variant="secondary" size="compact" disabled={isMutating || run.cancelRequested} onClick={() => void cancelRun()}>
                  <XCircle size={15} aria-hidden="true" />{run.cancelRequested ? t("storageCleanupRunCanceling") : t("storageCleanupCancelScan")}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label={t("storageCleanupQuickScopesLabel")}>
            <Button variant="ghost" size="compact" onClick={() => void chooseQuickScope("downloads")}>{t("storageCleanupQuickDownloads")}</Button>
            <Button variant="ghost" size="compact" onClick={() => void chooseQuickScope("desktop")}>{t("storageCleanupQuickDesktop")}</Button>
            <Button variant="ghost" size="compact" onClick={() => void chooseQuickScope("documents")}>{t("storageCleanupQuickDocuments")}</Button>
            <Button variant="ghost" size="compact" onClick={() => void chooseQuickScope("temp")}>{t("storageCleanupQuickTemp")}</Button>
          </div>
        </section>

        {unsupported ? (
          <StateBlock tone="warning" title={t("storageCleanupDurableUnavailableTitle")} description={t("storageCleanupDurableUnavailableDesc")} />
        ) : null}
        {error ? <NoticeBanner tone="error" title={t("storageCleanupLoadFailed")} action={<Button variant="ghost" size="compact" onClick={() => setError("")}>{t("close")}</Button>}>{error}</NoticeBanner> : null}

        {loading ? <DurableTaskStatus state="running" title={t("storageCleanupDurableLoading")} description={t("storageCleanupDurableLoadingDesc")} density="compact" /> : null}

        {run ? (
          <section className="grid gap-3" data-analysis-run-id={run.id}>
            <MetricStrip
              ariaLabel={t("storageCleanupRunMetricsLabel")}
              density="compact"
              items={[
                { label: t("storageCleanupSafeTier"), value: run.safeCount.toLocaleString(), tone: "green" },
                { label: t("storageCleanupReviewTier"), value: run.reviewCount.toLocaleString(), tone: "amber" },
                { label: t("storageCleanupCautionTier"), value: run.cautionCount.toLocaleString(), tone: "red" },
                { label: t("storageCleanupReclaimable"), value: formatBytes(runReclaimable.bytes), hint: runReclaimable.estimated ? t("storageCleanupEstimateHint") : undefined }
              ]}
            />
            {isRunInProgress(run) ? (
              <DurableTaskStatus
                state="running"
                title={run.cancelRequested ? t("storageCleanupRunCanceling") : t("storageCleanupRunRunning")}
                description={replaceCopy("storageCleanupRunScope", { scope: runScope.map((path) => compactPath(path, 80)).join(" / ") || t("storageCleanupNoScopeSelected") })}
                progress={{
                  label: replaceCopy("storageCleanupDetectorProgress", { completed: run.detectorsCompleted, total: Math.max(run.detectorsTotal, 1) }),
                  value: run.detectorsCompleted,
                  max: Math.max(run.detectorsTotal, 1),
                  indeterminate: run.detectorsTotal === 0
                }}
                action={<Button variant="secondary" size="compact" disabled={isMutating || run.cancelRequested} onClick={() => void cancelRun()}>{t("storageCleanupCancelScan")}</Button>}
                density="compact"
              />
            ) : null}
            {runIsPartial ? (
              <NoticeBanner
                tone="warning"
                title={t("storageCleanupRunPartialTitle")}
                action={api.retryAnalysisRun ? <Button variant="secondary" size="compact" disabled={isMutating} onClick={() => void retryRun()}><RefreshCw size={14} aria-hidden="true" />{t("storageCleanupRunRetry")}</Button> : undefined}
              >
                {replaceCopy("storageCleanupRunPartialDesc", { warnings: run.warningCount, errors: run.errorCount, failed: run.detectorsFailed })}
              </NoticeBanner>
            ) : null}
            {!isRunInProgress(run) && !runIsPartial && runState === "completed" ? (
              <NoticeBanner tone="success" title={t("storageCleanupRunCompleted")}>
                {replaceCopy("storageCleanupRunCompletedDesc", { detectors: run.detectorsCompleted, findings: run.findingsPublished })}
              </NoticeBanner>
            ) : null}
            {runState === "failed" ? (
              <NoticeBanner tone="error" title={t("storageCleanupRunFailed")} action={api.retryAnalysisRun ? <Button variant="secondary" size="compact" disabled={isMutating} onClick={() => void retryRun()}>{t("storageCleanupRunRetry")}</Button> : undefined}>
                {run.errorMessage ? localizedStableError(run.errorMessage, t) : t("storageCleanupRunFailedDesc")}
              </NoticeBanner>
            ) : null}
            {runState === "canceled" ? <NoticeBanner tone="info" title={t("storageCleanupRunCanceled")} action={<Button variant="secondary" size="compact" disabled={isMutating || isAiWorking} onClick={() => void startScan()}>{t("storageCleanupRescan")}</Button>}>{t("storageCleanupRunCanceledDesc")}</NoticeBanner> : null}
            {runDetectors.some((detector) => detector.status === "failed") ? <span className={quietText}>{t("storageCleanupDetectorFailureHint")}</span> : null}
          </section>
        ) : null}

        {!loading && !run ? (
          <StateBlock
            tone="neutral"
            title={t("storageCleanupChooseScopeEmptyTitle")}
            description={t("storageCleanupChooseScopeEmptyDesc")}
            primaryAction={<Button variant="primary" disabled={!selectedRoots.length || isMutating || isAiWorking} onClick={() => void startScan()}><Search size={15} aria-hidden="true" />{t("storageCleanupScanScope")}</Button>}
          />
        ) : null}

        {run && canReviewFindings ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={sectionHeading}>{t("storageCleanupFindingsTitle")}</h2>
                <p className={sectionDescription}>{t("storageCleanupFindingsDescription")}</p>
              </div>
              {activeTier === "review" && api.analyzeCleanupCandidatesWithAI ? (
                <Button variant="secondary" size="compact" disabled={!isAiWorking && !run.reviewCount} onClick={() => isAiWorking ? cancelAiRecheck() : void recheckReviewFindings()}>
                  {isAiWorking ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                  {isAiWorking ? t("storageCleanupAIRecheckCancel") : t("storageCleanupAIRecheck")}
                </Button>
              ) : null}
            </div>
            {aiStatus ? <NoticeBanner tone="info" title={t("storageCleanupAIRecheck")}>{aiStatus}</NoticeBanner> : null}
            <SegmentedControl
              value={activeTier}
              ariaLabel={t("storageCleanupFindingTabsLabel")}
              onChange={setActiveTier}
              options={[
                { value: "safe", label: replaceCopy("storageCleanupTierTab", { label: t("storageCleanupSafeTier"), count: run.safeCount }) },
                { value: "review", label: replaceCopy("storageCleanupTierTab", { label: t("storageCleanupReviewTier"), count: run.reviewCount }) },
                { value: "caution", label: replaceCopy("storageCleanupTierTab", { label: t("storageCleanupCautionTier"), count: run.cautionCount }) }
              ]}
            />
            <section className="min-h-0 overflow-hidden rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)]" data-cleanup-findings>
              {loadingFindings && !findings.length ? <DurableTaskStatus state="running" title={t("storageCleanupFindingsLoading")} description={t("storageCleanupFindingsLoadingDesc")} density="compact" /> : null}
              {!loadingFindings && !findings.length ? <StateBlock tone={activeTier === "caution" ? "info" : "neutral"} title={t("storageCleanupNoFindingsTitle")} description={t("storageCleanupNoFindingsDesc")} density="compact" /> : null}
              {findings.length ? (
                <div ref={findingListRef} className="max-h-[min(62vh,720px)] overflow-auto outline-none" role="list" aria-label={t("storageCleanupFindingsListLabel")} tabIndex={0} onKeyDown={onFindingListKeyDown}>
                  <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                    {renderedVirtualItems.map((virtualItem) => {
                      const finding = findings[virtualItem.index];
                      return (
                        <FindingRow
                          key={finding.id}
                          finding={finding}
                          selected={selectedFindingIds.has(finding.id)}
                          evidence={evidenceByFinding[finding.id]}
                          evidenceExpanded={expandedEvidence.has(finding.id)}
                          t={t}
                          style={{ transform: `translateY(${virtualItem.start}px)` }}
                          onToggle={toggleFinding}
                          onReveal={revealFinding}
                          onToggleEvidence={toggleEvidence}
                          onRevalidate={revalidateFinding}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {nextCursor ? <div className="flex justify-center border-t border-[var(--zc-divider)] p-3"><Button variant="secondary" size="compact" disabled={loadingFindings} onClick={() => void loadFindings(run.id, activeTier, nextCursor, true)}>{t("storageCleanupLoadMore")}</Button></div> : null}
            </section>
          </>
        ) : null}

        {run && !isRunInProgress(run) && !run.findingsPublished ? <StateBlock tone="info" title={t("storageCleanupNoFindingsTitle")} description={t("storageCleanupNoFindingsDesc")} density="compact" /> : null}

        {run && selectedFindingIds.size ? (
          <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface-floating)] px-4 py-3 shadow-[var(--zc-shadow-raised)]" data-cleanup-selection-summary>
            <div className="min-w-0">
              <strong className="block text-sm text-[var(--zc-text-primary)]">{replaceCopy("storageCleanupSelectionSummary", { count: selectedFindingIds.size, size: formatBytes(selectedBytes) })}</strong>
              <span className={metadataText}>{t("storageCleanupSelectionSafety")}</span>
            </div>
            <Button variant="primary" disabled={isMutating || Boolean(mutationUnavailable) || !api.previewCleanupOperations} onClick={() => void previewSelected()}><Trash2 size={15} aria-hidden="true" />{t("storageCleanupMoveToSafeTrash")}</Button>
          </footer>
        ) : null}

        {executionResult ? (
          <NoticeBanner tone={executionResult.failed > 0 ? "warning" : "success"} title={t("storageCleanupExecutionDone")} action={<Button variant="secondary" size="compact" onClick={() => onNavigate?.("restore")}><History size={14} aria-hidden="true" />{t("storageCleanupExecutionHistory")}</Button>}>
            {replaceCopy("storageCleanupExecutionSummary", { moved: executionResult.moved, skipped: executionResult.skipped, failed: executionResult.failed })}
          </NoticeBanner>
        ) : null}
      </div>

      <SideSheet
        open={Boolean(preview)}
        title={t("storageCleanupPreviewReadyTitle")}
        description={t("storageCleanupPreviewReadyDesc")}
        closeLabel={t("close")}
        onClose={() => setPreview(null)}
        footer={preview ? <div className="flex flex-wrap justify-end gap-2"><Button variant="primary" disabled={isMutating || Boolean(mutationUnavailable)} onClick={() => setConfirmPreviewOpen(true)}>{t("storageCleanupPreviewConfirm")}</Button></div> : undefined}
      >
        {preview ? (
          <div className="grid gap-4">
            <MetricStrip ariaLabel={t("storageCleanupPreviewMetricsLabel")} density="compact" items={[{ label: t("storageCleanupPreviewItems"), value: preview.total.toLocaleString() }, { label: t("storageCleanupPreviewExecutable"), value: preview.previews.filter((item) => item.is_executable !== false).length.toLocaleString(), tone: "green" }, { label: t("storageCleanupPreviewBlocked"), value: preview.previews.filter((item) => item.is_executable === false).length.toLocaleString(), tone: "amber" }]} />
            {preview.previews.slice(0, 24).map((item) => <div key={item.id} className="grid gap-1 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3"><strong className="truncate text-sm text-[var(--zc-text-primary)]">{item.old_name}</strong><span className={quietText}>{compactPath(item.source_path, 90)}</span><span className={metadataText}>{item.is_executable === false ? t("storageCleanupPreviewBlocked") : t("storageCleanupPreviewExecutable")}</span></div>)}
            {preview.truncated || preview.hasMore ? <NoticeBanner tone="info">{replaceCopy("storageCleanupPreviewTruncated", { shown: Math.min(preview.previews.length, 24), total: preview.total })}</NoticeBanner> : null}
          </div>
        ) : null}
      </SideSheet>

      <ConfirmDialog
        open={Boolean(reviewFinding)}
        tone="warning"
        title={t("storageCleanupReviewConfirmTitle")}
        description={reviewFinding ? replaceCopy("storageCleanupReviewConfirmDesc", { name: reviewFinding.title }) : undefined}
        emphasis={t("storageCleanupReviewConfirmEmphasis")}
        confirmLabel={t("storageCleanupReviewConfirmAction")}
        cancelLabel={t("cancel")}
        isProcessing={isMutating}
        onConfirm={() => void acknowledgeReviewFinding()}
        onCancel={() => setReviewFinding(null)}
      />

      <ConfirmDialog
        open={confirmPreviewOpen && Boolean(preview)}
        tone="warning"
        title={t("storageCleanupConfirmSafeTrashTitle")}
        description={replaceCopy("storageCleanupConfirmSafeTrashDesc", { count: selectedFindingIds.size, size: formatBytes(selectedBytes) })}
        emphasis={t("storageCleanupConfirmSafeTrashEmphasis")}
        confirmLabel={t("storageCleanupMoveToSafeTrash")}
        cancelLabel={t("cancel")}
        isProcessing={isMutating}
        onConfirm={() => void moveSelectedToSafeTrash()}
        onCancel={() => setConfirmPreviewOpen(false)}
      />
    </>
  );
}

function FindingRow({
  finding,
  selected,
  evidence,
  evidenceExpanded,
  t,
  style,
  onToggle,
  onReveal,
  onToggleEvidence,
  onRevalidate
}: {
  finding: AnalysisFinding;
  selected: boolean;
  evidence?: AnalysisFindingEvidence[];
  evidenceExpanded: boolean;
  t: Translator;
  style: { transform: string };
  onToggle: (finding: AnalysisFinding) => void;
  onReveal: (finding: AnalysisFinding) => void;
  onToggleEvidence: (finding: AnalysisFinding) => void;
  onRevalidate: (finding: AnalysisFinding) => void;
}) {
  const isCaution = finding.tier === "caution";
  const selectable = isFindingSelectable(finding);
  const confidence = finding.confidence === "exact" ? t("storageCleanupConfidenceExact") : finding.confidence === "estimated" ? t("storageCleanupConfidenceEstimated") : t("storageCleanupConfidenceUnknown");
  return (
    <article
      className={cn("absolute left-0 top-0 grid w-full gap-2 border-b border-[var(--zc-divider)] px-4 py-3", selected && "bg-[var(--zc-surface-selected)]")}
      style={{ ...style, minHeight: FINDING_ROW_HEIGHT }}
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
          {finding.status === "stale" ? <Button variant="secondary" size="compact" onClick={() => onRevalidate(finding)}><RefreshCw size={14} aria-hidden="true" />{t("storageCleanupFindingRecheck")}</Button> : null}
        </div>
        {isCaution ? <span className="text-xs font-medium text-[var(--zc-warning-text)]">{t("storageCleanupCautionHint")}</span> : <Button variant={selected ? "secondary" : "primary"} size="compact" disabled={!selectable && !(finding.tier === "review" && finding.status === "active" && finding.decision !== "acknowledged")} aria-pressed={selected} onClick={() => onToggle(finding)}>{selected ? <Check size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}{selected ? t("storageCleanupSelected") : finding.tier === "review" && finding.decision !== "acknowledged" ? t("storageCleanupFindingAcknowledge") : t("storageCleanupSelectForTrash")}</Button>}
      </div>
      {evidenceExpanded ? <div className="grid gap-2 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3" data-finding-evidence><strong className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--zc-text-tertiary)]">{t("storageCleanupFindingEvidence")}</strong>{evidence?.length ? evidence.map((item) => <div key={item.id} className="text-xs leading-5 text-[var(--zc-text-secondary)]">{item.evidenceKind}{item.pathSnapshot ? ` · ${compactPath(item.pathSnapshot, 100)}` : ""}</div>) : <span className={quietText}>{t("storageCleanupFindingEvidenceEmpty")}</span>}</div> : null}
    </article>
  );
}

function isCleanupRun(run: AnalysisRun): boolean {
  const kind = typeof run.scope?.kind === "string" ? run.scope.kind : "";
  return kind === "approvedCleanupPaths" || kind === "approved_cleanup_paths";
}

function normalizeScopePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
}

function scopeKey(paths: readonly string[]): string {
  return normalizeScopePaths(paths).map(normalizeScopePathForComparison).sort().join("\u0000");
}

function normalizeScopePathForComparison(path: string): string {
  const normalizedSeparators = path.trim().replaceAll("\\", "/").replace(/^\/\/\?\//, "");
  if (normalizedSeparators === "/") return "/";
  if (/^[a-z]:\/?$/i.test(normalizedSeparators)) return `${normalizedSeparators[0].toLowerCase()}:/`;
  return normalizePathLike(normalizedSeparators);
}

function scopePaths(run: AnalysisRun): string[] {
  const paths = run.scope?.paths;
  return Array.isArray(paths) ? paths.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : [];
}

function isRunInProgress(run: AnalysisRun | null): boolean {
  if (!run) return false;
  return ["queued", "running", "cancelling", "cancel_requested"].includes(run.status) || ["preparing", "running_detectors", "finalizing"].includes(run.phase);
}

function isPartialRun(run: AnalysisRun): boolean {
  return ["partial", "completed_with_warnings", "completed_partial"].includes(run.status)
    || run.warningCount > 0
    || run.errorCount > 0
    || run.detectorsFailed > 0;
}

function durableRunState(run: AnalysisRun): "running" | "partial" | "completed" | "failed" | "canceled" {
  if (isRunInProgress(run)) return "running";
  if (["cancelled", "canceled"].includes(run.status)) return "canceled";
  if (["failed", "error"].includes(run.status) && !run.findingsPublished) return "failed";
  if (isPartialRun(run)) return "partial";
  return "completed";
}

function isBackendDefaultSafeFinding(finding: AnalysisFinding): boolean {
  return finding.tier === "safe" && finding.status === "active" && finding.executable && !finding.requiresConfirmation && isTrashAction(finding.actionKind);
}

function isFindingSelectable(finding: AnalysisFinding): boolean {
  return (finding.tier === "safe" || finding.tier === "review")
    && finding.status === "active"
    && finding.executable
    && isTrashAction(finding.actionKind)
    && (finding.tier !== "review" || finding.decision === "acknowledged");
}

function isTrashAction(actionKind: string): boolean {
  return /trash|move/i.test(actionKind);
}

function tierLabel(tier: string, t: Translator): string {
  if (tier === "safe") return t("storageCleanupSafeTier");
  if (tier === "review") return t("storageCleanupReviewTier");
  return t("storageCleanupCautionTier");
}
