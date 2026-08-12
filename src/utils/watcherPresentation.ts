export type WatcherPresentationState =
  | "permission_required"
  | "retry_exhausted"
  | "partial"
  | "reconciliation_required"
  | "scanning"
  | "stale"
  | "healthy"
  | "unknown";

export type WatcherPresentationSeverity = "danger" | "warning" | "info" | "success" | "neutral";
export type WatcherRecommendedAction = "grant_permission" | "retry_manually" | "rescan" | "wait" | "none";

export interface WatcherPresentationInput {
  healthStatus?: string | null;
  pending?: boolean;
  needsReconciliation?: boolean;
  watcherRevision?: number;
  watcherAppliedRevision?: number;
  activeRunId?: string | null;
  lastErrorCode?: string | null;
  watcherLastErrorCode?: string | null;
  partialCoverage?: boolean;
  stale?: boolean;
}

export interface WatcherPresentation {
  state: WatcherPresentationState;
  severity: WatcherPresentationSeverity;
  labelKey:
    | "watcherStatusPermission"
    | "watcherStatusRetryExhausted"
    | "watcherStatusPartial"
    | "watcherStatusReconciling"
    | "watcherStatusSyncing"
    | "watcherStatusStale"
    | "watcherStatusHealthy"
    | "watcherStatusUnknown";
  messageKey:
    | "libraryPermissionDesc"
    | "watcherRetryExhausted"
    | "fsWatcherPartialIndexWarning"
    | "watcherReconciliationRequired"
    | "watcherStatusSyncing"
    | "watcherStaleDesc"
    | "watcherStatusHealthy"
    | "watcherStatusUnknown";
  recommendedAction: WatcherRecommendedAction;
}

export interface WatcherHealthSummary {
  permissionRequired: number;
  reconciliationRequired: number;
  partialCoverage: number;
  retryExhausted: number;
  stale: number;
}

const PRESENTATIONS: Record<WatcherPresentationState, WatcherPresentation> = {
  permission_required: {
    state: "permission_required",
    severity: "danger",
    labelKey: "watcherStatusPermission",
    messageKey: "libraryPermissionDesc",
    recommendedAction: "grant_permission"
  },
  retry_exhausted: {
    state: "retry_exhausted",
    severity: "danger",
    labelKey: "watcherStatusRetryExhausted",
    messageKey: "watcherRetryExhausted",
    recommendedAction: "retry_manually"
  },
  partial: {
    state: "partial",
    severity: "warning",
    labelKey: "watcherStatusPartial",
    messageKey: "fsWatcherPartialIndexWarning",
    recommendedAction: "rescan"
  },
  reconciliation_required: {
    state: "reconciliation_required",
    severity: "warning",
    labelKey: "watcherStatusReconciling",
    messageKey: "watcherReconciliationRequired",
    recommendedAction: "rescan"
  },
  scanning: {
    state: "scanning",
    severity: "info",
    labelKey: "watcherStatusSyncing",
    messageKey: "watcherStatusSyncing",
    recommendedAction: "wait"
  },
  stale: {
    state: "stale",
    severity: "warning",
    labelKey: "watcherStatusStale",
    messageKey: "watcherStaleDesc",
    recommendedAction: "rescan"
  },
  healthy: {
    state: "healthy",
    severity: "success",
    labelKey: "watcherStatusHealthy",
    messageKey: "watcherStatusHealthy",
    recommendedAction: "none"
  },
  unknown: {
    state: "unknown",
    severity: "neutral",
    labelKey: "watcherStatusUnknown",
    messageKey: "watcherStatusUnknown",
    recommendedAction: "none"
  }
};

function hasErrorCode(input: WatcherPresentationInput, fragment: string): boolean {
  return [input.lastErrorCode, input.watcherLastErrorCode]
    .some((code) => typeof code === "string" && code.includes(fragment));
}

/**
 * The only renderer-side interpretation of durable watcher health.
 * More specific safety states always win over activity or stale metadata.
 */
export function deriveWatcherPresentation(input: WatcherPresentationInput | null | undefined): WatcherPresentation {
  const status = input?.healthStatus ?? "";
  const hasPendingRevision = typeof input?.watcherRevision === "number"
    && typeof input.watcherAppliedRevision === "number"
    && input.watcherRevision > input.watcherAppliedRevision;
  if (status === "permission_required" || hasErrorCode(input ?? {}, "permission")) return PRESENTATIONS.permission_required;
  if (status === "retry_exhausted" || hasErrorCode(input ?? {}, "retry_exhausted")) return PRESENTATIONS.retry_exhausted;
  if (input?.partialCoverage || status === "partial" || status === "degraded") return PRESENTATIONS.partial;
  if (status === "reconciliation_required" || input?.needsReconciliation) return PRESENTATIONS.reconciliation_required;
  if (status === "scanning" || input?.activeRunId || input?.pending || hasPendingRevision) return PRESENTATIONS.scanning;
  if (status === "stale" || input?.stale) return PRESENTATIONS.stale;
  if (status === "healthy") return PRESENTATIONS.healthy;
  return PRESENTATIONS.unknown;
}

export function watcherPresentationNeedsAttention(presentation: WatcherPresentation): boolean {
  return ["permission_required", "retry_exhausted", "partial", "reconciliation_required", "stale"].includes(presentation.state);
}

export function summarizeWatcherHealth(statuses: readonly WatcherPresentationInput[]): WatcherHealthSummary {
  const summary: WatcherHealthSummary = {
    permissionRequired: 0,
    reconciliationRequired: 0,
    partialCoverage: 0,
    retryExhausted: 0,
    stale: 0
  };
  for (const status of statuses) {
    switch (deriveWatcherPresentation(status).state) {
      case "permission_required":
        summary.permissionRequired += 1;
        break;
      case "retry_exhausted":
        summary.retryExhausted += 1;
        summary.stale += 1;
        break;
      case "partial":
        summary.partialCoverage += 1;
        summary.stale += 1;
        break;
      case "reconciliation_required":
        summary.reconciliationRequired += 1;
        summary.stale += 1;
        break;
      case "stale":
        summary.stale += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}

export function watcherHealthAttentionCount(summary: WatcherHealthSummary): number {
  return summary.permissionRequired + summary.stale;
}
