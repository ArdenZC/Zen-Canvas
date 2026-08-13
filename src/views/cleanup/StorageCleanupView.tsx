import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { desktopDir, documentDir, downloadDir, tempDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, History, LoaderCircle, RefreshCw, Search, Sparkles, Trash2, XCircle } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useI18nContext, useNavigationContext } from "../../contexts/AppContexts";
import type {
  AnalysisDetector,
  AnalysisDetectorDescriptor,
  AnalysisFinding,
  AnalysisFindingEvidence,
  AnalysisFindingPage,
  AnalysisRun,
  CleanupExecutionResult,
  OperationPreview,
  OperationPreviewResult,
  StartAnalysisRunRequest
} from "../../types/domain";
import type { Translator, View } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { localFileMutationUnavailableCode } from "../../utils/fileMutationCapability";
import { localizedStableError, readableError, compactPath } from "../../utils/viewHelpers";
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
  contentPanel,
  metadataText,
  pageSurface,
  quietText,
  sectionDescription,
  sectionHeading
} from "../shared/ui";
import {
  AI_RECHECK_BATCH_SIZE,
  FINDING_PAGE_SIZE,
  FINDING_ROW_HEIGHT,
  durableRunState,
  isAnalysisFinding,
  isCleanupPreviewExecutable,
  isCleanupPreviewScopeExecutable,
  isFindingSelectable,
  isPartialRun,
  isRunInProgress,
  cleanupSelectionFingerprint,
  normalizeScopePaths,
  scopeKey,
  scopePaths,
  type CleanupTier
} from "./cleanupModel";
export { cleanupSelectionFingerprint, reconcileAuthoritativeFindingUpdates } from "./cleanupModel";
import { FindingRow, tierLabel } from "./FindingRow";
import type { CleanupApi, CleanupMutationKind, CleanupMutationOwner } from "./cleanupControllerTypes";
import { useCleanupAnalysisController } from "./useCleanupAnalysisController";
import { useCleanupExecutionController } from "./useCleanupExecutionController";
import { useCleanupSelectionController } from "./useCleanupSelectionController";

type Props = {
  initialRoots?: string[];
  api?: CleanupApi;
  t?: Translator;
  onError?: (message: string) => void;
  onNavigate?: (view: View) => void;
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
  const findingsEpoch = useRef(0);
  const scopeEpoch = useRef(0);
  const activeTierRef = useRef<CleanupTier>(activeTier);
  const activeTierEpoch = useRef(0);
  const aiOperationEpoch = useRef(0);
  const previewRequestEpoch = useRef(0);
  const previewSelectionFingerprint = useRef<string | null>(null);
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

  const {
    selectedFindingIds,
    selectionRevision,
    selectedFindings,
    selectedBytes,
    runReclaimable,
    commitSelection,
    resetSelection,
    selectBackendDefaultSafeFindings,
    buildSelections,
    reconcileUpdatedFindings,
    removeSelectionsForIds
  } = useCleanupSelectionController({ findingCache, setFindingCache, run, invalidatePreviewState });

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
    resetSelection();
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
  }, [resetSelection, updateAiWorkState]);

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

  const { loadFindings, loadRunDetails } = useCleanupAnalysisController({
    api,
    initialRoots,
    run,
    activeTier,
    activeTierRef,
    activeTierEpoch,
    findingsEpoch,
    scopeEpoch,
    runRef,
    scopeHydrated,
    defaultSelectionRuns,
    setDetectors,
    setRuns,
    setRun,
    setRunDetectors,
    setFindings,
    setFindingCache,
    setNextCursor,
    setSelectedRoots,
    setLoading,
    setLoadingFindings,
    setUnsupported,
    selectBackendDefaultSafeFindings,
    reportError
  });

  const { previewSelected, moveSelectedToSafeTrash } = useCleanupExecutionController({
    api,
    run,
    runRef,
    selectedFindings,
    selectionRevision,
    buildSelections,
    resetSelection,
    preview,
    setPreview,
    setConfirmPreviewOpen,
    setExecutionResult,
    setError,
    scopeEpoch,
    aiOperationEpoch,
    previewRequestEpoch,
    previewSelectionFingerprint,
    mutationOwnerRef,
    interactionLockedRef,
    mutationUnavailable,
    beginMutation,
    releaseMutation,
    invalidatePreviewState,
    loadRunDetails,
    reportError,
    t
  });

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
    resetSelection();
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
  }, [api, beginMutation, detectors, loadRunDetails, reportError, releaseMutation, resetSelection, selectedRoots, t]);

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
    resetSelection();
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
  }, [api, beginMutation, loadRunDetails, releaseMutation, reportError, resetSelection, run]);

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
                          tierLabel={tierLabel}
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

