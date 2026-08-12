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
import { useI18nContext, useNavigationContext } from "../../contexts/AppContexts";
import type {
  AnalysisDetector,
  AnalysisDetectorDescriptor,
  AnalysisFinding,
  AnalysisFindingPage,
  AnalysisFindingEvidence,
  AnalysisRun,
  CleanupExecutionResult,
  CleanupFindingSelection,
  OperationPreview,
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
type CleanupMutationKind = "scan" | "cancel" | "retry" | "acknowledge" | "revalidate" | "preview" | "safe_trash";
type CleanupMutationOwner = {
  id: number;
  kind: CleanupMutationKind;
  scopeEpoch: number;
  runId: string | null;
};
type AiWorkState = "idle" | "running" | "canceling";
type AiOperation = {
  id: number;
  epoch: number;
  scopeEpoch: number;
  tierEpoch: number;
  tier: CleanupTier;
  runId: string;
  cancelRequested: boolean;
};

const FINDING_PAGE_SIZE = 100;
const AI_RECHECK_BATCH_SIZE = 50;
const FINDING_ROW_HEIGHT = 238;

function isCleanupPreviewExecutable(preview: OperationPreview): boolean {
  return preview.status === "pending" && preview.is_executable === true && !preview.blocking_reason;
}

function isCleanupPreviewScopeExecutable(preview: OperationPreviewResult, expectedFindingIds: readonly string[]): boolean {
  if (preview.truncated || preview.hasMore || preview.total !== preview.previews.length || preview.previews.length !== expectedFindingIds.length) return false;
  const expectedIds = new Set(expectedFindingIds);
  if (expectedIds.size !== expectedFindingIds.length) return false;
  const previewIds = new Set(preview.previews.map((item) => item.fileId || item.file_id || ""));
  return previewIds.size === expectedIds.size
    && preview.previews.every((item) => expectedIds.has(item.fileId || item.file_id || "") && isCleanupPreviewExecutable(item));
}

export function StorageCleanupView(props: Props = {}) {
  if (props.t) return <StorageCleanupPanel {...props} t={props.t} />;
  return <StorageCleanupViewWithContext {...props} />;
}

function StorageCleanupViewWithContext(props: Omit<Props, "t" | "onError" | "onNavigate">) {
  const { t } = useI18nContext();
  const { onError, setView } = useNavigationContext();
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
  const [aiWorkState, setAiWorkState] = useState<AiWorkState>("idle");
  const isAiWorking = aiWorkState !== "idle";
  const [aiStatus, setAiStatus] = useState("");
  const [error, setError] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const findingListRef = useRef<HTMLDivElement | null>(null);
  const selectedFindingIdsRef = useRef(selectedFindingIds);
  const findingsEpoch = useRef(0);
  const scopeEpoch = useRef(0);
  const activeTierRef = useRef<CleanupTier>(activeTier);
  const activeTierEpoch = useRef(0);
  const aiOperationEpoch = useRef(0);
  const previewRequestEpoch = useRef(0);
  const previewSelectionFingerprint = useRef<string | null>(null);
  const selectionRevision = useRef(0);
  const runRef = useRef<AnalysisRun | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const scanIntentInFlight = useRef(false);
  const mutationOwnerRef = useRef<CleanupMutationOwner | null>(null);
  const mutationSequenceRef = useRef(0);
  const aiWorkStateRef = useRef<AiWorkState>("idle");
  const aiOperationRef = useRef<AiOperation | null>(null);
  const aiOperationSequenceRef = useRef(0);
  const interactionLockedRef = useRef(false);
  const scopeHydrated = useRef(Boolean(normalizeScopePaths(initialRoots ?? []).length));
  const initialRootsPropKey = useRef(scopeKey(initialRoots ?? []));
  const defaultSelectionRuns = useRef(new Set<string>());
  const mutationUnavailable = localFileMutationUnavailableCode();

  useEffect(() => {
    selectedFindingIdsRef.current = selectedFindingIds;
  }, [selectedFindingIds]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  interactionLockedRef.current = Boolean(mutationOwnerRef.current) || aiWorkState !== "idle";

  const updateAiWorkState = useCallback((nextState: AiWorkState) => {
    aiWorkStateRef.current = nextState;
    interactionLockedRef.current = Boolean(mutationOwnerRef.current) || nextState !== "idle";
    setAiWorkState(nextState);
  }, []);

  const beginMutation = useCallback((kind: CleanupMutationKind, runId: string | null = runRef.current?.id ?? null) => {
    if (mutationOwnerRef.current || aiWorkStateRef.current !== "idle") return null;
    const owner: CleanupMutationOwner = {
      id: ++mutationSequenceRef.current,
      kind,
      scopeEpoch: scopeEpoch.current,
      runId
    };
    mutationOwnerRef.current = owner;
    interactionLockedRef.current = true;
    setIsMutating(true);
    return owner;
  }, []);

  const releaseMutation = useCallback((owner: CleanupMutationOwner) => {
    if (mutationOwnerRef.current?.id !== owner.id) return false;
    mutationOwnerRef.current = null;
    interactionLockedRef.current = aiWorkStateRef.current !== "idle";
    setIsMutating(false);
    return true;
  }, []);

  useEffect(() => () => {
    if (aiOperationRef.current) aiOperationRef.current.cancelRequested = true;
    aiOperationRef.current = null;
    aiOperationEpoch.current += 1;
    mutationOwnerRef.current = null;
    scanIntentInFlight.current = false;
    requestKeyRef.current = null;
    previewRequestEpoch.current += 1;
    previewSelectionFingerprint.current = null;
    findingsEpoch.current += 1;
  }, []);

  const invalidatePreviewState = useCallback(() => {
    previewRequestEpoch.current += 1;
    setPreview(null);
    setConfirmPreviewOpen(false);
    setExecutionResult(null);
    setReviewFinding(null);
  }, []);

  const commitSelection = useCallback((update: (current: Set<string>) => Set<string>) => {
    selectionRevision.current += 1;
    invalidatePreviewState();
    setSelectedFindingIds((current) => {
      const next = update(current);
      selectedFindingIdsRef.current = next;
      return next;
    });
  }, [invalidatePreviewState]);

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
    activeTierEpoch.current += 1;
    aiOperationEpoch.current += 1;
    previewRequestEpoch.current += 1;
    selectionRevision.current += 1;
    requestKeyRef.current = null;
    scanIntentInFlight.current = false;
    defaultSelectionRuns.current.clear();
    if (aiOperationRef.current) aiOperationRef.current.cancelRequested = true;
    aiOperationRef.current = null;
    mutationOwnerRef.current = null;
    setRun(null);
    setRunDetectors([]);
    setFindings([]);
    setFindingCache({});
    setNextCursor(null);
    selectedFindingIdsRef.current = new Set();
    setSelectedFindingIds(selectedFindingIdsRef.current);
    setEvidenceByFinding({});
    setExpandedEvidence(new Set());
    setReviewFinding(null);
    setPreview(null);
    setConfirmPreviewOpen(false);
    setExecutionResult(null);
    setAiStatus("");
    setError("");
    setLoadingFindings(false);
    setIsMutating(false);
    updateAiWorkState("idle");
  }, [updateAiWorkState]);

  const applyScopeSelection = useCallback((roots: string[]) => {
    if (interactionLockedRef.current) return;
    const nextRoots = normalizeScopePaths(roots);
    if (scopeKey(selectedRoots) !== scopeKey(nextRoots)) resetReviewStateForScopeChange();
    scopeHydrated.current = true;
    setSelectedRoots(nextRoots);
    setError("");
  }, [resetReviewStateForScopeChange, selectedRoots]);

  useEffect(() => {
    if (interactionLockedRef.current) return;
    const nextKey = scopeKey(initialRoots ?? []);
    if (nextKey === initialRootsPropKey.current) return;
    initialRootsPropKey.current = nextKey;
    applyScopeSelection(initialRoots ?? []);
  }, [applyScopeSelection, aiWorkState, initialRoots, isMutating]);

  const loadFindings = useCallback(async (
    runId: string,
    tier: CleanupTier,
    cursor: string | null = null,
    append = false,
    expectedRunRevision: number | null = runRef.current?.revision ?? null
  ) => {
    if (!api.listAnalysisFindings) return;
    const epoch = ++findingsEpoch.current;
    const expectedScopeEpoch = scopeEpoch.current;
    const expectedTierEpoch = activeTierEpoch.current;
    const ownsRequest = () => expectedScopeEpoch === scopeEpoch.current
      && expectedTierEpoch === activeTierEpoch.current
      && activeTierRef.current === tier
      && epoch === findingsEpoch.current
      && runRef.current?.id === runId
      && (expectedRunRevision === null || runRef.current.revision === expectedRunRevision);
    setLoadingFindings(true);
    try {
      const page = await api.listAnalysisFindings({
        runId,
        tier,
        status: "active",
        cursor,
        limit: FINDING_PAGE_SIZE
      });
      if (!ownsRequest() || page.findings.some((finding) => finding.runId !== runId)) return;
      setFindings((current) => append ? [...current, ...page.findings] : page.findings);
      setNextCursor(page.nextCursor);
      setFindingCache((current) => {
        const next = { ...current };
        for (const finding of page.findings) next[finding.id] = finding;
        return next;
      });
      if (!append && tier === "safe" && !defaultSelectionRuns.current.has(runId)) {
        defaultSelectionRuns.current.add(runId);
        commitSelection((current) => {
          const next = new Set(current);
          for (const finding of page.findings) {
            if (isBackendDefaultSafeFinding(finding)) next.add(finding.id);
          }
          return next;
        });
      }
    } catch (loadError) {
      if (ownsRequest()) reportError(loadError);
    } finally {
      if (ownsRequest()) setLoadingFindings(false);
    }
  }, [api, commitSelection, reportError]);

  const loadRunDetails = useCallback(async (runId: string, clearFindings = true, expectedScopeEpoch = scopeEpoch.current) => {
    if (!api.getAnalysisRun || !api.listAnalysisRunDetectors) return;
    try {
      const [nextRun, nextDetectors] = await Promise.all([
        api.getAnalysisRun(runId),
        api.listAnalysisRunDetectors(runId)
      ]);
      if (expectedScopeEpoch !== scopeEpoch.current) return;
      const currentRun = runRef.current;
      if (currentRun && currentRun.id === nextRun.id && nextRun.revision < currentRun.revision) return;
      if (clearFindings || !currentRun || currentRun.id !== nextRun.id || nextRun.revision > currentRun.revision) findingsEpoch.current += 1;
      if (clearFindings) {
        setFindings([]);
        setNextCursor(null);
      }
      runRef.current = nextRun;
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
        if (candidate) {
          if (hydrationScopeEpoch !== scopeEpoch.current) return;
          await loadRunDetails(candidate.id);
        }
      } catch (loadError) {
        if (!disposed) reportError(loadError);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void hydrate().catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [api, loadRunDetails, reportError]);

  useEffect(() => {
    if (!run || !api.listAnalysisFindings || isRunInProgress(run)) return;
    void loadFindings(run.id, activeTier, null, false, run.revision).catch(() => undefined);
  }, [activeTier, api.listAnalysisFindings, loadFindings, run?.id, run?.revision, run]);

  useEffect(() => {
    const disposers: UnlistenFn[] = [];
    let disposed = false;
    async function subscribe() {
      const offRun = await api.onAnalysisRunUpdated?.((updated) => {
        if (!isCleanupRun(updated) || !run || updated.id !== run.id) return;
        if (updated.revision >= run.revision) void loadRunDetails(updated.id).catch(() => undefined);
      });
      const offFindings = await api.onAnalysisFindingsPublished?.((updated) => {
        if (run && updated.id === run.id) void loadRunDetails(updated.id).catch(() => undefined);
      });
      const offDetector = await api.onAnalysisDetectorUpdated?.((updated) => {
        if (run && updated.runId === run.id) void loadRunDetails(updated.runId, false).catch(() => undefined);
      });
      for (const disposer of [offRun, offFindings, offDetector]) {
        if (disposer) disposers.push(disposer);
      }
      if (disposed) while (disposers.length) disposers.pop()?.();
    }
    void subscribe().catch(() => undefined);
    return () => {
      disposed = true;
      while (disposers.length) disposers.pop()?.();
    };
  }, [api, loadRunDetails, run]);

  const chooseScope = useCallback(async () => {
    if (interactionLockedRef.current) return;
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
    if (interactionLockedRef.current) return;
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
    if (scanIntentInFlight.current || interactionLockedRef.current) return;
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
    previewRequestEpoch.current += 1;
    setPreview(null);
    previewSelectionFingerprint.current = null;
    setConfirmPreviewOpen(false);
    selectionRevision.current += 1;
    selectedFindingIdsRef.current = new Set();
    setSelectedFindingIds(new Set());
    setFindingCache({});
    defaultSelectionRuns.current.clear();
    scanIntentInFlight.current = true;
    const requestedScopeEpoch = scopeEpoch.current;
    const requestKey = `cleanup-${crypto.randomUUID()}`;
    requestKeyRef.current = requestKey;
    const request: StartAnalysisRunRequest = {
      scope: { kind: "approvedCleanupPaths", paths: selectedRoots },
      detectorIds: detectors.filter((detector) => detector.supportsApprovedPaths).map((detector) => detector.detectorId),
      requestKey
    };
    const mutationOwner = beginMutation("scan", null);
    if (!mutationOwner) {
      requestKeyRef.current = null;
      scanIntentInFlight.current = false;
      return;
    }
    const ownsScanIntent = () => requestedScopeEpoch === scopeEpoch.current
      && requestKeyRef.current === requestKey
      && scanIntentInFlight.current
      && mutationOwnerRef.current?.id === mutationOwner.id;
    try {
      const started = await api.startAnalysisRun(request);
      if (!ownsScanIntent()) return;
      setRun(started);
      // The start mutation is settled once the backend has created the run. Keep
      // the subsequent authoritative read separate so the user can cancel a
      // running scan without an old scan finally clearing its lock.
      releaseMutation(mutationOwner);
      await loadRunDetails(started.id, true, requestedScopeEpoch);
    } catch (startError) {
      if (ownsScanIntent()) reportError(startError);
    } finally {
      if (requestKeyRef.current === requestKey) {
        requestKeyRef.current = null;
        scanIntentInFlight.current = false;
        releaseMutation(mutationOwner);
      }
    }
  }, [api, beginMutation, detectors, loadRunDetails, reportError, releaseMutation, selectedRoots, t]);

  const cancelRun = useCallback(async () => {
    if (!run || !api.cancelAnalysisRun) return;
    if (interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    const mutationOwner = beginMutation("cancel", runId);
    if (!mutationOwner) return;
    try {
      await api.cancelAnalysisRun(runId);
      if (expectedScopeEpoch !== scopeEpoch.current || mutationOwnerRef.current?.id !== mutationOwner.id) return;
      await loadRunDetails(runId, false, expectedScopeEpoch);
    } catch (cancelError) {
      if (expectedScopeEpoch === scopeEpoch.current && mutationOwnerRef.current?.id === mutationOwner.id) reportError(cancelError);
    } finally {
      releaseMutation(mutationOwner);
    }
  }, [api, beginMutation, loadRunDetails, releaseMutation, reportError, run]);

  const retryRun = useCallback(async () => {
    if (!run || !api.retryAnalysisRun) return;
    if (interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    const mutationOwner = beginMutation("retry", runId);
    if (!mutationOwner) return;
    setError("");
    selectionRevision.current += 1;
    selectedFindingIdsRef.current = new Set();
    setSelectedFindingIds(new Set());
    previewRequestEpoch.current += 1;
    setPreview(null);
    previewSelectionFingerprint.current = null;
    setConfirmPreviewOpen(false);
    defaultSelectionRuns.current.delete(runId);
    try {
      const retried = await api.retryAnalysisRun(runId);
      if (expectedScopeEpoch !== scopeEpoch.current || mutationOwnerRef.current?.id !== mutationOwner.id) return;
      setRun(retried);
      await loadRunDetails(retried.id, true, expectedScopeEpoch);
    } catch (retryError) {
      if (expectedScopeEpoch === scopeEpoch.current && mutationOwnerRef.current?.id === mutationOwner.id) reportError(retryError);
    } finally {
      releaseMutation(mutationOwner);
    }
  }, [api, beginMutation, loadRunDetails, releaseMutation, reportError, run]);

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
    if (expandedEvidence.has(finding.id)) {
      setExpandedEvidence((current) => {
        const next = new Set(current);
        next.delete(finding.id);
        return next;
      });
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
    setExpandedEvidence((current) => {
      const next = new Set(current);
      next.add(finding.id);
      return next;
    });
  }, [api, evidenceByFinding, expandedEvidence, reportError]);

  const acknowledgeReviewFinding = useCallback(async () => {
    if (!reviewFinding || !api.getAnalysisFinding || !api.setAnalysisFindingDecision) return;
    if (interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const expectedTierEpoch = activeTierEpoch.current;
    const expectedTier = activeTierRef.current;
    const findingId = reviewFinding.id;
    const expectedRunId = runRef.current?.id;
    const mutationOwner = beginMutation("acknowledge", expectedRunId ?? null);
    if (!mutationOwner) return;
    const ownsRequest = () => expectedScopeEpoch === scopeEpoch.current
      && expectedTierEpoch === activeTierEpoch.current
      && activeTierRef.current === expectedTier
      && runRef.current?.id === expectedRunId
      && mutationOwnerRef.current?.id === mutationOwner.id;
    try {
      const current = await api.getAnalysisFinding(findingId);
      if (!ownsRequest()) return;
      if (!current || current.tier !== "review" || current.status !== "active") throw new Error("cleanup_finding_changed");
      const decision = await api.setAnalysisFindingDecision({
        findingKey: current.findingKey,
        decision: "acknowledged",
        expectedRevision: current.decisionRevision ?? 0
      });
      if (decision.decision !== "acknowledged") throw new Error("cleanup_review_not_acknowledged");
      const refreshed = await api.getAnalysisFinding(current.id);
      if (!ownsRequest()) return;
      if (!refreshed || !isFindingSelectable(refreshed)) throw new Error("cleanup_review_not_executable");
      setFindingCache((cache) => ({ ...cache, [refreshed.id]: refreshed }));
      commitSelection((selected) => new Set(selected).add(refreshed.id));
      setReviewFinding(null);
      const currentRun = runRef.current;
      if (currentRun && ownsRequest()) await loadFindings(currentRun.id, activeTierRef.current, null, false, currentRun.revision);
    } catch (reviewError) {
      if (ownsRequest()) reportError(reviewError);
    } finally {
      releaseMutation(mutationOwner);
    }
  }, [api, beginMutation, commitSelection, loadFindings, releaseMutation, reportError, reviewFinding]);

  const revalidateFinding = useCallback(async (finding: AnalysisFinding) => {
    if (!api.revalidateAnalysisFinding) return;
    if (interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const expectedTierEpoch = activeTierEpoch.current;
    const expectedTier = activeTierRef.current;
    const expectedRunId = runRef.current?.id;
    const mutationOwner = beginMutation("revalidate", expectedRunId ?? null);
    if (!mutationOwner) return;
    const ownsRequest = () => expectedScopeEpoch === scopeEpoch.current
      && expectedTierEpoch === activeTierEpoch.current
      && activeTierRef.current === expectedTier
      && runRef.current?.id === expectedRunId
      && mutationOwnerRef.current?.id === mutationOwner.id;
    try {
      const refreshed = await api.revalidateAnalysisFinding(finding.id);
      if (!ownsRequest()) return;
      setFindingCache((cache) => ({ ...cache, [refreshed.id]: refreshed }));
      commitSelection((selected) => {
        const next = new Set(selected);
        if (!isFindingSelectable(refreshed)) next.delete(refreshed.id);
        return next;
      });
      const currentRun = runRef.current;
      if (currentRun && ownsRequest()) await loadFindings(currentRun.id, activeTierRef.current, null, false, currentRun.revision);
    } catch (revalidateError) {
      if (ownsRequest()) reportError(revalidateError);
    } finally {
      releaseMutation(mutationOwner);
    }
  }, [api, beginMutation, commitSelection, loadFindings, releaseMutation, reportError]);

  const toggleFinding = useCallback((finding: AnalysisFinding) => {
    if (interactionLockedRef.current) return;
    if (finding.tier === "caution" || finding.status !== "active") return;
    if (!isFindingSelectable(finding)) {
      if (finding.tier === "review" && finding.decision !== "acknowledged") setReviewFinding(finding);
      return;
    }
    commitSelection((current) => {
      const next = new Set(current);
      if (next.has(finding.id)) next.delete(finding.id);
      else next.add(finding.id);
      return next;
    });
  }, [commitSelection]);

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
    if (!run || !api.previewCleanupOperations || !selectedFindings.length || interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    const runRevision = run.revision;
    const expectedAiOperationEpoch = aiOperationEpoch.current;
    const expectedSelectionRevision = selectionRevision.current;
    if (mutationUnavailable) {
      reportError(t("storageCleanupMutationUnavailable"));
      return;
    }
    let selections: CleanupFindingSelection[];
    try {
      selections = buildSelections();
    } catch (selectionError) {
      reportError(selectionError);
      return;
    }
    const selectionFingerprint = cleanupSelectionFingerprint(runId, selections);
    const expectedPreviewRequestEpoch = previewRequestEpoch.current + 1;
    previewRequestEpoch.current = expectedPreviewRequestEpoch;
    const mutationOwner = beginMutation("preview", runId);
    if (!mutationOwner) return;
    setError("");
    const ownsRequest = () => expectedScopeEpoch === scopeEpoch.current
      && expectedAiOperationEpoch === aiOperationEpoch.current
      && expectedSelectionRevision === selectionRevision.current
      && expectedPreviewRequestEpoch === previewRequestEpoch.current
      && runRef.current?.id === runId
      && runRef.current.revision === runRevision
      && mutationOwnerRef.current?.id === mutationOwner.id;
    try {
      const result = await api.previewCleanupOperations(runId, selections);
      if (!ownsRequest()) return;
      previewSelectionFingerprint.current = selectionFingerprint;
      setPreview(result);
    } catch (previewError) {
      if (ownsRequest()) reportError(previewError);
    } finally {
      releaseMutation(mutationOwner);
    }
  }, [api, beginMutation, buildSelections, mutationUnavailable, releaseMutation, reportError, run, selectedFindings.length, t]);

  const moveSelectedToSafeTrash = useCallback(async () => {
    if (!run || !api.moveCleanupCandidatesToSafeTrash || !preview || !selectedFindings.length || interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const runId = run.id;
    const expectedAiOperationEpoch = aiOperationEpoch.current;
    const expectedSelectionRevision = selectionRevision.current;
    const selections = (() => {
      try {
        return buildSelections();
      } catch (selectionError) {
        reportError(selectionError);
        return null;
      }
    })();
    if (!selections) return;
    if (!isCleanupPreviewScopeExecutable(preview, selections.map((selection) => selection.findingId))) return;
    const selectionFingerprint = cleanupSelectionFingerprint(runId, selections);
    if (previewSelectionFingerprint.current !== selectionFingerprint) {
      invalidatePreviewState();
      return;
    }
    const mutationOwner = beginMutation("safe_trash", runId);
    if (!mutationOwner) return;
    setError("");
    const ownsRequest = () => expectedScopeEpoch === scopeEpoch.current
      && expectedAiOperationEpoch === aiOperationEpoch.current
      && expectedSelectionRevision === selectionRevision.current
      && previewSelectionFingerprint.current === selectionFingerprint
      && runRef.current?.id === runId
      && mutationOwnerRef.current?.id === mutationOwner.id;
    try {
      const result = await api.moveCleanupCandidatesToSafeTrash(runId, selections);
      if (!ownsRequest()) return;
      setExecutionResult(result);
      selectionRevision.current += 1;
      selectedFindingIdsRef.current = new Set();
      setSelectedFindingIds(new Set());
      setPreview(null);
      previewSelectionFingerprint.current = null;
      setConfirmPreviewOpen(false);
      await loadRunDetails(runId, true, expectedScopeEpoch);
    } catch (executionError) {
      if (ownsRequest()) reportError(executionError);
    } finally {
      releaseMutation(mutationOwner);
    }
  }, [api, beginMutation, buildSelections, invalidatePreviewState, loadRunDetails, preview, releaseMutation, reportError, run, selectedFindings.length]);

  const reconcileUpdatedFindings = useCallback((updatedFindings: AnalysisFinding[]) => {
    if (!updatedFindings.length) return;
    const selectedBeforeUpdate = selectedFindingIdsRef.current;
    const selectedRevisionAffected = updatedFindings.some((finding) => selectedBeforeUpdate.has(finding.id));
    setFindingCache((cache) => {
      const next = { ...cache };
      for (const finding of updatedFindings) next[finding.id] = finding;
      return next;
    });
    const nextSelected = reconcileAuthoritativeFindingUpdates(selectedBeforeUpdate, updatedFindings);
    selectedFindingIdsRef.current = nextSelected;
    selectionRevision.current += 1;
    setSelectedFindingIds(nextSelected);
    if (selectedRevisionAffected) {
      invalidatePreviewState();
    }
  }, [invalidatePreviewState]);

  const removeSelectionsForIds = useCallback((findingIds: readonly string[]) => {
    if (!findingIds.length) return;
    const rejected = new Set(findingIds);
    const selectedBeforeFailure = selectedFindingIdsRef.current;
    const nextSelected = new Set([...selectedBeforeFailure].filter((id) => !rejected.has(id)));
    selectedFindingIdsRef.current = nextSelected;
    selectionRevision.current += 1;
    setSelectedFindingIds(nextSelected);
    invalidatePreviewState();
  }, [invalidatePreviewState]);

  const invalidateReadbackFailures = useCallback((findingIds: readonly string[]) => {
    if (!findingIds.length) return;
    const failed = new Set(findingIds);
    setFindingCache((cache) => {
      const next = { ...cache };
      for (const id of failed) delete next[id];
      return next;
    });
    removeSelectionsForIds(findingIds);
  }, [removeSelectionsForIds]);

  const changeActiveTier = useCallback((nextTier: CleanupTier) => {
    if (interactionLockedRef.current) return;
    if (nextTier === activeTierRef.current) return;
    activeTierRef.current = nextTier;
    activeTierEpoch.current += 1;
    findingsEpoch.current += 1;
    invalidatePreviewState();
    setReviewFinding(null);
    setActiveTier(nextTier);
  }, [invalidatePreviewState]);

  const recheckReviewFindings = useCallback(async () => {
    if (!run || !api.analyzeCleanupCandidatesWithAI || !api.getAISettings) {
      reportError(t("storageCleanupAIUnsupported"));
      return;
    }
    if (interactionLockedRef.current) return;
    const expectedScopeEpoch = scopeEpoch.current;
    const expectedTierEpoch = activeTierEpoch.current;
    const expectedTier = activeTierRef.current;
    const reviewRunId = run.id;
    const reviewRunRevision = run.revision;
    const operationEpoch = aiOperationEpoch.current + 1;
    aiOperationEpoch.current = operationEpoch;
    const operation: AiOperation = {
      id: ++aiOperationSequenceRef.current,
      epoch: operationEpoch,
      scopeEpoch: expectedScopeEpoch,
      tierEpoch: expectedTierEpoch,
      tier: expectedTier,
      runId: reviewRunId,
      cancelRequested: false
    };
    aiOperationRef.current = operation;
    previewRequestEpoch.current += 1;
    previewSelectionFingerprint.current = null;
    setPreview(null);
    setConfirmPreviewOpen(false);
    setExecutionResult(null);
    setReviewFinding(null);
    updateAiWorkState("running");
    setAiStatus("");
    let processed = 0;
    let skipped = 0;
    let mutationFailed = 0;
    let readbackFailed = 0;
    let total = 0;
    const ownsOperation = () => expectedScopeEpoch === scopeEpoch.current
      && expectedTierEpoch === activeTierEpoch.current
      && activeTierRef.current === expectedTier
      && operationEpoch === aiOperationEpoch.current
      && aiOperationRef.current?.id === operation.id
      && !operation.cancelRequested
      && runRef.current?.id === reviewRunId
      && runRef.current.revision >= reviewRunRevision;
    const ownsSettlement = () => expectedScopeEpoch === scopeEpoch.current
      && expectedTierEpoch === activeTierEpoch.current
      && activeTierRef.current === expectedTier
      && aiOperationRef.current?.id === operation.id
      && runRef.current?.id === reviewRunId
      && runRef.current.revision >= reviewRunRevision;
    const canceledStatus = () => replaceCopy("storageCleanupAIRecheckCanceledSummary", {
      processed,
      total,
      skipped,
      mutationFailed,
      readbackFailed
    });
    const stopAfterCancellation = () => {
      if (!operation.cancelRequested) return false;
      if (aiOperationRef.current?.id === operation.id && expectedScopeEpoch === scopeEpoch.current) {
        setAiStatus(canceledStatus());
      }
      return true;
    };
    const reconcileSettledBatch = async (
      findingIds: readonly string[],
      options: { mutationFailed: boolean }
    ) => {
      if (!ownsSettlement()) return false;
      if (!findingIds.length) return true;
      const readbacks = await Promise.allSettled(findingIds.map(async (id) => {
        if (!api.getAnalysisFinding) return null;
        return api.getAnalysisFinding(id);
      }));
      if (!ownsSettlement()) return false;
      const authoritative: AnalysisFinding[] = [];
      const failedReadbackIds: string[] = [];
      readbacks.forEach((result, index) => {
        const id = findingIds[index];
        if (result.status === "fulfilled" && result.value && isAnalysisFinding(result.value)) authoritative.push(result.value);
        else failedReadbackIds.push(id);
      });
      readbackFailed += failedReadbackIds.length;
      if (authoritative.length) reconcileUpdatedFindings(authoritative);
      if (failedReadbackIds.length) invalidateReadbackFailures(failedReadbackIds);
      if (options.mutationFailed) removeSelectionsForIds(findingIds);
      return true;
    };
    const finalizeCanceledOperation = async () => {
      if (!ownsSettlement()) return false;
      await loadRunDetails(reviewRunId, true, expectedScopeEpoch);
      if (!ownsSettlement()) return false;
      const currentRun = runRef.current;
      if (currentRun) {
        await loadFindings(currentRun.id, activeTierRef.current, null, false, currentRun.revision);
        if (!ownsSettlement()) return false;
      }
      if (ownsSettlement()) setAiStatus(canceledStatus());
      return true;
    };
    try {
      const settings = await api.getAISettings();
      if (stopAfterCancellation()) return;
      if (!ownsOperation()) return;
      if (!settings.enabled) throw new Error("cleanup_ai_disabled");
      if (!settings.cleanupAiEnabled) throw new Error("cleanup_ai_feature_disabled");
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        if (operation.cancelRequested) {
          setAiStatus(canceledStatus());
          return;
        }
        if (!ownsOperation()) return;
        setAiStatus(replaceCopy("storageCleanupAIRecheckCollecting", { count: ids.length }));
        const page: AnalysisFindingPage | undefined = await api.listAnalysisFindings?.({
          runId: reviewRunId,
          tier: "review",
          status: "active",
          cursor,
          limit: FINDING_PAGE_SIZE
        });
        if (!page) throw new Error("cleanup_findings_unavailable");
        if (stopAfterCancellation()) return;
        if (!ownsOperation()) return;
        ids.push(...page.findings.filter((finding) => finding.tier === "review" && finding.status === "active").map((finding) => finding.id));
        cursor = page.nextCursor;
      } while (cursor);
      total = ids.length;
      if (!ids.length) {
        setAiStatus(t("storageCleanupAINoTargets"));
        return;
      }
      for (let offset = 0; offset < ids.length; offset += AI_RECHECK_BATCH_SIZE) {
        if (operation.cancelRequested) {
          setAiStatus(canceledStatus());
          return;
        }
        if (!ownsOperation()) return;
        const batch = ids.slice(offset, offset + AI_RECHECK_BATCH_SIZE);
        setAiStatus(replaceCopy("storageCleanupAIRecheckWorkingProgress", { processed, total: ids.length }));
        let updatedIds: string[] = [];
        let mutationFailedForBatch = false;
        try {
          const updated = await api.analyzeCleanupCandidatesWithAI(reviewRunId, batch);
          const batchIds = new Set(batch);
          updatedIds = [...new Set(updated.map((candidate) => candidate.id).filter((id) => batchIds.has(id)))];
          processed += updatedIds.length;
          skipped += Math.max(0, batch.length - updatedIds.length);
        } catch {
          mutationFailedForBatch = true;
          mutationFailed += batch.length;
          updatedIds = [...batch];
        }
        if (!(await reconcileSettledBatch(updatedIds, { mutationFailed: mutationFailedForBatch }))) return;
        if (operation.cancelRequested) {
          await finalizeCanceledOperation();
          return;
        }
        if (!ownsOperation()) return;
        if (activeTierRef.current !== "review" || activeTierEpoch.current !== expectedTierEpoch) {
          // The durable mutation may finish after the user leaves Review; only the current tier may be reloaded below.
          continue;
        }
      }
      if (!ownsOperation()) return;
      setAiStatus(replaceCopy("storageCleanupAIRecheckDoneSummary", { total, processed, skipped, mutationFailed, readbackFailed }));
      await loadRunDetails(reviewRunId, true, expectedScopeEpoch);
      if (!ownsOperation()) return;
      const currentRun = runRef.current;
      if (currentRun) await loadFindings(currentRun.id, activeTierRef.current, null, false, currentRun.revision);
    } catch (aiError) {
      if (stopAfterCancellation()) return;
      if (ownsOperation()) reportError(aiError);
    } finally {
      if (aiOperationRef.current?.id === operation.id) {
        aiOperationRef.current = null;
        updateAiWorkState("idle");
      }
    }
  }, [api, invalidateReadbackFailures, loadFindings, loadRunDetails, reconcileUpdatedFindings, removeSelectionsForIds, reportError, replaceCopy, run, t, updateAiWorkState]);

  const cancelAiRecheck = useCallback(() => {
    const operation = aiOperationRef.current;
    if (!operation || aiWorkStateRef.current !== "running") return;
    operation.cancelRequested = true;
    aiOperationEpoch.current += 1;
    setAiStatus(t("storageCleanupAIRecheckCanceling"));
    updateAiWorkState("canceling");
  }, [t, updateAiWorkState]);

  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => findingListRef.current,
    estimateSize: () => FINDING_ROW_HEIGHT,
    overscan: 5,
    getItemKey: (index) => findings[index]?.id ?? index
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      virtualizer.measure();
      findingListRef.current?.querySelectorAll<HTMLElement>("[data-index]").forEach((element) => virtualizer.measureElement(element));
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTier, evidenceByFinding, expandedEvidence, findings, virtualizer]);
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
  const previewExecutableCount = preview?.previews.filter(isCleanupPreviewExecutable).length ?? 0;
  const previewBlockedCount = preview ? preview.previews.length - previewExecutableCount : 0;
  const previewScopeExecutable = preview
    ? isCleanupPreviewScopeExecutable(preview, selectedFindings.map((finding) => finding.id))
    : false;

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
              <Button variant="secondary" size="compact" disabled={isMutating || isAiWorking} onClick={() => void chooseScope().catch(() => undefined)}>
                <FolderOpen size={15} aria-hidden="true" />{t("storageCleanupChooseFolder")}
              </Button>
              <Button variant="primary" size="compact" disabled={!selectedRoots.length || isMutating || isAiWorking || isRunInProgress(run)} onClick={() => void startScan().catch(() => undefined)}>
                {isMutating && !run ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
                {run ? t("storageCleanupRescan") : t("storageCleanupScanScope")}
              </Button>
              {run && isRunInProgress(run) ? (
                <Button variant="secondary" size="compact" disabled={isMutating || isAiWorking || run.cancelRequested} onClick={() => void cancelRun().catch(() => undefined)}>
                  <XCircle size={15} aria-hidden="true" />{run.cancelRequested ? t("storageCleanupRunCanceling") : t("storageCleanupCancelScan")}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label={t("storageCleanupQuickScopesLabel")}>
            <Button variant="ghost" size="compact" disabled={isMutating || isAiWorking} onClick={() => void chooseQuickScope("downloads").catch(() => undefined)}>{t("storageCleanupQuickDownloads")}</Button>
            <Button variant="ghost" size="compact" disabled={isMutating || isAiWorking} onClick={() => void chooseQuickScope("desktop").catch(() => undefined)}>{t("storageCleanupQuickDesktop")}</Button>
            <Button variant="ghost" size="compact" disabled={isMutating || isAiWorking} onClick={() => void chooseQuickScope("documents").catch(() => undefined)}>{t("storageCleanupQuickDocuments")}</Button>
            <Button variant="ghost" size="compact" disabled={isMutating || isAiWorking} onClick={() => void chooseQuickScope("temp").catch(() => undefined)}>{t("storageCleanupQuickTemp")}</Button>
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
                action={<Button variant="secondary" size="compact" disabled={isMutating || isAiWorking || run.cancelRequested} onClick={() => void cancelRun().catch(() => undefined)}>{t("storageCleanupCancelScan")}</Button>}
                density="compact"
              />
            ) : null}
            {runIsPartial ? (
              <NoticeBanner
                tone="warning"
                title={t("storageCleanupRunPartialTitle")}
                action={api.retryAnalysisRun ? <Button variant="secondary" size="compact" disabled={isMutating || isAiWorking} onClick={() => void retryRun().catch(() => undefined)}><RefreshCw size={14} aria-hidden="true" />{t("storageCleanupRunRetry")}</Button> : undefined}
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
                <NoticeBanner tone="error" title={t("storageCleanupRunFailed")} action={api.retryAnalysisRun ? <Button variant="secondary" size="compact" disabled={isMutating || isAiWorking} onClick={() => void retryRun().catch(() => undefined)}>{t("storageCleanupRunRetry")}</Button> : undefined}>
                {run.errorMessage ? localizedStableError(run.errorMessage, t) : t("storageCleanupRunFailedDesc")}
              </NoticeBanner>
            ) : null}
            {runState === "canceled" ? <NoticeBanner tone="info" title={t("storageCleanupRunCanceled")} action={<Button variant="secondary" size="compact" disabled={isMutating || isAiWorking} onClick={() => void startScan().catch(() => undefined)}>{t("storageCleanupRescan")}</Button>}>{t("storageCleanupRunCanceledDesc")}</NoticeBanner> : null}
            {runDetectors.some((detector) => detector.status === "failed") ? <span className={quietText}>{t("storageCleanupDetectorFailureHint")}</span> : null}
          </section>
        ) : null}

        {!loading && !run ? (
          <StateBlock
            tone="neutral"
            title={t("storageCleanupChooseScopeEmptyTitle")}
            description={t("storageCleanupChooseScopeEmptyDesc")}
            primaryAction={<Button variant="primary" disabled={!selectedRoots.length || isMutating || isAiWorking} onClick={() => void startScan().catch(() => undefined)}><Search size={15} aria-hidden="true" />{t("storageCleanupScanScope")}</Button>}
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
                <Button variant="secondary" size="compact" disabled={aiWorkState === "canceling" || isMutating || (aiWorkState === "idle" && !run.reviewCount)} onClick={() => {
                  if (aiWorkState === "running") cancelAiRecheck();
                  else if (aiWorkState === "idle") void recheckReviewFindings().catch(() => undefined);
                }}>
                  {aiWorkState !== "idle" ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                  {aiWorkState === "running" ? t("storageCleanupAIRecheckCancel") : aiWorkState === "canceling" ? t("storageCleanupAIRecheckCanceling") : t("storageCleanupAIRecheck")}
                </Button>
              ) : null}
            </div>
            {aiStatus ? <NoticeBanner tone="info" title={t("storageCleanupAIRecheck")}>{aiStatus}</NoticeBanner> : null}
            <SegmentedControl
              value={activeTier}
              ariaLabel={t("storageCleanupFindingTabsLabel")}
              disabled={isMutating || isAiWorking}
              onChange={changeActiveTier}
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
                          index={virtualItem.index}
                          measureElement={virtualizer.measureElement}
                          style={{ transform: `translateY(${virtualItem.start}px)` }}
                          onToggle={toggleFinding}
                          onReveal={revealFinding}
                          onToggleEvidence={toggleEvidence}
                          onRevalidate={revalidateFinding}
                          interactionLocked={isMutating || isAiWorking}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {nextCursor ? <div className="flex justify-center border-t border-[var(--zc-divider)] p-3"><Button variant="secondary" size="compact" disabled={loadingFindings || isMutating || isAiWorking} onClick={() => void loadFindings(run.id, activeTierRef.current, nextCursor, true, run.revision).catch(() => undefined)}>{t("storageCleanupLoadMore")}</Button></div> : null}
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
            <Button variant="primary" disabled={isMutating || isAiWorking || Boolean(mutationUnavailable) || !api.previewCleanupOperations} onClick={() => void previewSelected().catch(() => undefined)}><Trash2 size={15} aria-hidden="true" />{t("storageCleanupMoveToSafeTrash")}</Button>
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
        onClose={() => invalidatePreviewState()}
        footer={preview ? <div className="flex flex-wrap justify-end gap-2"><Button variant="primary" disabled={isMutating || isAiWorking || Boolean(mutationUnavailable) || !previewScopeExecutable} onClick={() => setConfirmPreviewOpen(true)}>{t("storageCleanupPreviewConfirm")}</Button></div> : undefined}
      >
        {preview ? (
          <div className="grid gap-4">
            <MetricStrip ariaLabel={t("storageCleanupPreviewMetricsLabel")} density="compact" items={[{ label: t("storageCleanupPreviewItems"), value: preview.total.toLocaleString() }, { label: t("storageCleanupPreviewExecutable"), value: previewExecutableCount.toLocaleString(), tone: "green" }, { label: t("storageCleanupPreviewBlocked"), value: previewBlockedCount.toLocaleString(), tone: "amber" }]} />
            {preview.previews.slice(0, 24).map((item) => <div key={item.id} className="grid gap-1 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3"><strong className="truncate text-sm text-[var(--zc-text-primary)]">{item.old_name}</strong><span className={quietText}>{compactPath(item.source_path, 90)}</span><span className={metadataText}>{isCleanupPreviewExecutable(item) ? t("storageCleanupPreviewExecutable") : t("storageCleanupPreviewBlocked")}</span></div>)}
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
        onConfirm={() => void acknowledgeReviewFinding().catch(() => undefined)}
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
        onConfirm={() => void moveSelectedToSafeTrash().catch(() => undefined)}
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
  index,
  measureElement,
  style,
  onToggle,
  onReveal,
  onToggleEvidence,
  onRevalidate,
  interactionLocked
}: {
  finding: AnalysisFinding;
  selected: boolean;
  evidence?: AnalysisFindingEvidence[];
  evidenceExpanded: boolean;
  t: Translator;
  index: number;
  measureElement: (element: HTMLElement | null) => void;
  style: { transform: string };
  onToggle: (finding: AnalysisFinding) => void;
  onReveal: (finding: AnalysisFinding) => void;
  onToggleEvidence: (finding: AnalysisFinding) => void;
  onRevalidate: (finding: AnalysisFinding) => void;
  interactionLocked: boolean;
}) {
  const isCaution = finding.tier === "caution";
  const selectable = isFindingSelectable(finding);
  const confidence = finding.confidence === "exact" ? t("storageCleanupConfidenceExact") : finding.confidence === "estimated" ? t("storageCleanupConfidenceEstimated") : t("storageCleanupConfidenceUnknown");
  return (
    <article
      className={cn("absolute left-0 top-0 grid w-full gap-2 border-b border-[var(--zc-divider)] px-4 py-3", selected && "bg-[var(--zc-surface-selected)]")}
      ref={measureElement}
      data-index={index}
      style={style}
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
          {finding.status === "stale" ? <Button variant="secondary" size="compact" disabled={interactionLocked} onClick={() => onRevalidate(finding)}><RefreshCw size={14} aria-hidden="true" />{t("storageCleanupFindingRecheck")}</Button> : null}
        </div>
        {isCaution ? <span className="text-xs font-medium text-[var(--zc-warning-text)]">{t("storageCleanupCautionHint")}</span> : <Button variant={selected ? "secondary" : "primary"} size="compact" disabled={interactionLocked || (!selectable && !(finding.tier === "review" && finding.status === "active" && finding.decision !== "acknowledged"))} aria-pressed={selected} onClick={() => onToggle(finding)}>{selected ? <Check size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}{selected ? t("storageCleanupSelected") : finding.tier === "review" && finding.decision !== "acknowledged" ? t("storageCleanupFindingAcknowledge") : t("storageCleanupSelectForTrash")}</Button>}
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
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const path of paths) {
    const trimmed = path.trim();
    if (!trimmed) continue;
    const comparisonKey = normalizeScopePathForComparison(trimmed);
    if (!comparisonKey || seen.has(comparisonKey)) continue;
    seen.add(comparisonKey);
    normalized.push(trimmed);
  }
  return normalized;
}

function scopeKey(paths: readonly string[]): string {
  return [...new Set(
    paths
      .map((path) => normalizeScopePathForComparison(path))
      .filter(Boolean)
  )]
    .sort()
    .join("\u0000");
}

function normalizeScopePathForComparison(path: string): string {
  let normalized = path.trim().replaceAll("\\", "/");
  const lower = normalized.toLocaleLowerCase();
  if (lower.startsWith("//?/unc/")) {
    normalized = `//${normalized.slice(8)}`;
  } else if (lower.startsWith("//?/")) {
    normalized = normalized.slice(4);
  }
  if (normalized === "/") return "/";
  if (/^[a-z]:\/?$/i.test(normalized)) return `${normalized[0].toLowerCase()}:/`;
  return normalizePathLike(normalized);
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

export function reconcileAuthoritativeFindingUpdates(
  selectedIds: ReadonlySet<string>,
  updatedFindings: readonly AnalysisFinding[]
): Set<string> {
  const updates = new Map(updatedFindings.map((finding) => [finding.id, finding]));
  const next = new Set<string>();
  for (const id of selectedIds) {
    const updated = updates.get(id);
    if (!updated || isFindingSelectable(updated)) next.add(id);
  }
  return next;
}

export function cleanupSelectionFingerprint(runId: string, selections: readonly CleanupFindingSelection[]): string {
  return [runId, ...selections
    .map((selection) => [
      selection.findingId,
      selection.expectedRevision,
      selection.reviewConfirmation?.decisionRevision ?? ""
    ].join(":"))
    .sort()]
    .join("\u0000");
}

function isAnalysisFinding(value: unknown): value is AnalysisFinding {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalysisFinding>;
  return typeof candidate.id === "string"
    && typeof candidate.findingKey === "string"
    && typeof candidate.revision === "number"
    && typeof candidate.status === "string";
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
