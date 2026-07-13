import type { FileRecord, LibraryScope, OperationLog, OperationPreview } from "../../types/domain";
import { applyPreviewNameOverride, normalizePathLike } from "../../utils/viewHelpers";

export type OrganizeDecision =
  | "undecided"
  | "accepted"
  | "kept"
  | "edited"
  | "blocked"
  | "needs-review";

export interface OrganizeDecisionRecord {
  fileId: string;
  scopeKey: string;
  signature: string;
  state: OrganizeDecision;
  editedName?: string;
}

export interface OrganizeSuggestion {
  file: FileRecord;
  preview: OperationPreview | null;
  decision: OrganizeDecision;
  editedName?: string;
  effectivePreview: OperationPreview | null;
  canAccept: boolean;
  canEdit: boolean;
  safeForBatch: boolean;
}

export interface OrganizeDecisionSummary {
  accepted: number;
  kept: number;
  edited: number;
  needsReview: number;
  blocked: number;
  executable: number;
}

export interface OperationResultSummary {
  success: number;
  skipped: number;
  failed: number;
  restorable: number;
}
export type OperationResultState = "success" | "partial" | "failed" | "canceled" | "no-changes";

export function organizeScopeKey(scope: LibraryScope): string {
  if (scope.kind === "all") return "all";
  return `${scope.kind}:${scope.roots.map(normalizePathLike).sort().join("|")}`;
}

export function organizeDecisionKey(scope: LibraryScope, fileId: string): string {
  return `${organizeScopeKey(scope)}::${fileId}`;
}

export function operationPreviewForFile(previews: readonly OperationPreview[], fileId: string) {
  return previews.find((preview) => preview.fileId === fileId || preview.file_id === fileId) ?? null;
}

export function organizeDecisionSignature(file: FileRecord, preview: OperationPreview | null): string {
  return [
    normalizePathLike(file.path),
    file.suggested_action,
    normalizePathLike(file.suggested_target_path),
    file.suggested_name.trim(),
    String(file.is_deleted || file.is_stale === true),
    preview?.id ?? "",
    preview?.operation_type ?? "",
    normalizePathLike(preview?.source_path ?? ""),
    normalizePathLike(preview?.target_path ?? ""),
    preview?.status ?? "",
    String(preview?.is_executable !== false),
    preview?.blocking_reason ?? ""
  ].join("\u001f");
}

export function initialOrganizeDecision(file: FileRecord, preview: OperationPreview | null): OrganizeDecision {
  if (file.is_deleted || file.is_stale || (preview && (preview.status !== "pending" || preview.is_executable === false || Boolean(preview.blocking_reason)))) return "blocked";
  if (
    file.risk_level === "Sensitive"
    || file.lifecycle === "Sensitive"
    || file.requires_confirmation
    || file.confidence < 0.7
    || file.is_duplicate
    || preview?.requires_confirmation
  ) return "needs-review";
  return "undecided";
}

export function buildOrganizeSuggestions(
  files: readonly FileRecord[],
  previews: readonly OperationPreview[],
  scope: LibraryScope,
  decisions: Readonly<Record<string, OrganizeDecisionRecord>>
): OrganizeSuggestion[] {
  return files.map((file) => {
    const preview = operationPreviewForFile(previews, file.id);
    const key = organizeDecisionKey(scope, file.id);
    const signature = organizeDecisionSignature(file, preview);
    const record = decisions[key]?.signature === signature ? decisions[key] : undefined;
    const decision = record?.state ?? initialOrganizeDecision(file, preview);
    const effectivePreview = preview && record?.editedName
      ? applyPreviewNameOverride(preview, record.editedName)
      : preview;
    const canAccept = Boolean(preview && preview.status === "pending" && preview.is_executable !== false && !preview.blocking_reason && decision !== "blocked");
    const canEdit = Boolean(preview?.editable_new_name && preview.status === "pending" && preview.is_executable !== false && !preview.blocking_reason && decision !== "blocked");
    return {
      file,
      preview,
      decision,
      editedName: record?.editedName,
      effectivePreview,
      canAccept,
      canEdit,
      safeForBatch: isSafeBatchSuggestion(file, preview)
    };
  });
}

export function isSafeBatchSuggestion(file: FileRecord, preview: OperationPreview | null): boolean {
  return Boolean(
    preview
    && preview.status === "pending"
    && preview.is_executable !== false
    && !preview.requires_confirmation
    && !preview.blocking_reason
    && preview.target_path.trim()
    && file.risk_level === "Normal"
    && file.lifecycle !== "Sensitive"
    && file.confidence >= 0.8
    && !file.requires_confirmation
    && !file.is_duplicate
    && !file.is_deleted
    && !file.is_stale
  );
}

export function canSetOrganizeDecision(
  suggestion: OrganizeSuggestion,
  state: OrganizeDecision,
  editedName?: string
): boolean {
  if (suggestion.decision === "blocked" || (suggestion.preview && (suggestion.preview.status !== "pending" || suggestion.preview.is_executable === false || Boolean(suggestion.preview.blocking_reason)))) {
    return state === "blocked";
  }
  if (state === "accepted") return suggestion.canAccept;
  if (state === "edited") return suggestion.canEdit && validateOrganizeFileName(editedName ?? "") === null;
  return state === "kept" || state === "undecided" || state === "needs-review";
}

export function summarizeOrganizeDecisions(suggestions: readonly OrganizeSuggestion[]): OrganizeDecisionSummary {
  const summary: OrganizeDecisionSummary = { accepted: 0, kept: 0, edited: 0, needsReview: 0, blocked: 0, executable: 0 };
  for (const suggestion of suggestions) {
    if (suggestion.decision === "accepted") summary.accepted += 1;
    if (suggestion.decision === "kept") summary.kept += 1;
    if (suggestion.decision === "edited") summary.edited += 1;
    if (suggestion.decision === "needs-review") summary.needsReview += 1;
    if (suggestion.decision === "blocked") summary.blocked += 1;
    if (
      (suggestion.decision === "accepted" || suggestion.decision === "edited")
      && suggestion.effectivePreview?.status === "pending"
      && suggestion.effectivePreview?.is_executable !== false
      && !suggestion.effectivePreview?.blocking_reason
    ) summary.executable += 1;
  }
  return summary;
}

export function previewIdsForOrganizeDecisions(suggestions: readonly OrganizeSuggestion[]): Set<string> {
  return new Set(suggestions
    .filter((suggestion) => suggestion.decision === "accepted" || suggestion.decision === "edited")
    .filter((suggestion) => suggestion.effectivePreview?.status === "pending" && suggestion.effectivePreview?.is_executable !== false && !suggestion.effectivePreview?.blocking_reason)
    .map((suggestion) => suggestion.effectivePreview?.id)
    .filter((id): id is string => Boolean(id)));
}

export function validateOrganizeFileName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "empty";
  if (
    trimmed === "."
    || trimmed === ".."
    || trimmed.includes("..")
    || name.endsWith(".")
    || name.endsWith(" ")
    || /[\u0000-\u001f/\\<>:"|?*]/.test(trimmed)
  ) return "unsafe";
  const stem = trimmed.split(".")[0]?.toLowerCase() ?? "";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(stem)) return "reserved";
  return null;
}

export function shouldIgnoreOrganizeShortcut(event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "target">) {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  return typeof HTMLElement !== "undefined" && target instanceof HTMLElement && (
    target.isContentEditable
    || target.matches("input, textarea, select, button, [role='textbox']")
  );
}

export function organizeSpaceAction(batchMode: boolean): "accept" | "toggle-batch" {
  return batchMode ? "toggle-batch" : "accept";
}

export function summarizeOperationLogs(logs: readonly OperationLog[]): OperationResultSummary {
  return {
    success: logs.filter((log) => log.status === "success").length,
    skipped: logs.filter((log) => log.status === "skipped").length,
    failed: logs.filter((log) => log.status === "failed").length,
    restorable: logs.filter((log) => log.status === "success" && (log.can_restore || log.can_undo)).length
  };
}

export function operationResultState(summary: OperationResultSummary, apiFailed = false): OperationResultState {
  if (apiFailed && summary.success === 0) return "failed";
  if (summary.success > 0 && (summary.failed > 0 || summary.skipped > 0)) return "partial";
  if (summary.success > 0) return "success";
  if (summary.failed > 0) return "failed";
  if (summary.skipped > 0) return "canceled";
  return "no-changes";
}

export function effectiveTargetPath(suggestion: OrganizeSuggestion): string {
  return suggestion.effectivePreview?.target_path || suggestion.file.suggested_target_path || "";
}
