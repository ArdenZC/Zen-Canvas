import type {
  AnalysisFinding,
  AnalysisRun,
  CleanupFindingSelection,
  OperationPreview,
  OperationPreviewResult
} from "../../types/domain";
import { normalizePathLike } from "../../utils/viewHelpers";

export type CleanupTier = "safe" | "review" | "caution";
export const FINDING_PAGE_SIZE = 100;
export const AI_RECHECK_BATCH_SIZE = 50;
export const FINDING_ROW_HEIGHT = 238;

export function isCleanupPreviewExecutable(preview: OperationPreview): boolean {
  return preview.status === "pending" && preview.is_executable === true && !preview.blocking_reason;
}

export function isCleanupPreviewScopeExecutable(preview: OperationPreviewResult, expectedFindingIds: readonly string[]): boolean {
  if (preview.truncated || preview.hasMore || preview.total !== preview.previews.length || preview.previews.length !== expectedFindingIds.length) return false;
  const expectedIds = new Set(expectedFindingIds);
  if (expectedIds.size !== expectedFindingIds.length) return false;
  const previewIds = new Set(preview.previews.map((item) => item.fileId || item.file_id || ""));
  return previewIds.size === expectedIds.size
    && preview.previews.every((item) => expectedIds.has(item.fileId || item.file_id || "") && isCleanupPreviewExecutable(item));
}

export function isCleanupRun(run: AnalysisRun): boolean {
  const kind = typeof run.scope?.kind === "string" ? run.scope.kind : "";
  return kind === "approvedCleanupPaths" || kind === "approved_cleanup_paths";
}

export function normalizeScopePaths(paths: readonly string[]): string[] {
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

export function scopeKey(paths: readonly string[]): string {
  return [...new Set(
    paths
      .map((path) => normalizeScopePathForComparison(path))
      .filter(Boolean)
  )]
    .sort()
    .join("\u0000");
}

export function normalizeScopePathForComparison(path: string): string {
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

export function scopePaths(run: AnalysisRun): string[] {
  const paths = run.scope?.paths;
  return Array.isArray(paths) ? paths.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : [];
}

export function isRunInProgress(run: AnalysisRun | null): boolean {
  if (!run) return false;
  return ["queued", "running", "cancelling", "cancel_requested"].includes(run.status) || ["preparing", "running_detectors", "finalizing"].includes(run.phase);
}

export function isPartialRun(run: AnalysisRun): boolean {
  return ["partial", "completed_with_warnings", "completed_partial"].includes(run.status)
    || run.warningCount > 0
    || run.errorCount > 0
    || run.detectorsFailed > 0;
}

export function durableRunState(run: AnalysisRun): "running" | "partial" | "completed" | "failed" | "canceled" {
  if (isRunInProgress(run)) return "running";
  if (["cancelled", "canceled"].includes(run.status)) return "canceled";
  if (["failed", "error"].includes(run.status) && !run.findingsPublished) return "failed";
  if (isPartialRun(run)) return "partial";
  return "completed";
}

export function isBackendDefaultSafeFinding(finding: AnalysisFinding): boolean {
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

export function isAnalysisFinding(value: unknown): value is AnalysisFinding {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalysisFinding>;
  return typeof candidate.id === "string"
    && typeof candidate.findingKey === "string"
    && typeof candidate.revision === "number"
    && typeof candidate.status === "string";
}

export function isFindingSelectable(finding: AnalysisFinding): boolean {
  return (finding.tier === "safe" || finding.tier === "review")
    && finding.status === "active"
    && finding.executable
    && isTrashAction(finding.actionKind)
    && (finding.tier !== "review" || finding.decision === "acknowledged");
}

export function isTrashAction(actionKind: string): boolean {
  return /trash|move/i.test(actionKind);
}
