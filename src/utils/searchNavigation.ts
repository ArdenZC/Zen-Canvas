import type { View } from "../types/ui";

export type SearchSettingsTarget = "search-scope" | "global-index" | "appearance" | "ai";

const SETTINGS_SECTION_BY_TARGET: Record<SearchSettingsTarget, string> = {
  "search-scope": "settings-search",
  "global-index": "settings-global-index",
  appearance: "settings-appearance",
  ai: "settings-ai"
};

const SETTINGS_TARGET_BY_SECTION: Record<string, SearchSettingsTarget> = {
  "settings-search-scope": "search-scope",
  "settings-search": "search-scope",
  "settings-global-index": "global-index",
  "settings-appearance": "appearance",
  "settings-ai": "ai"
};

export interface SearchNavigatePayload {
  view: unknown;
  fileId: unknown;
  nonce?: unknown;
  sessionId?: unknown;
  revision?: unknown;
  settingsTarget?: unknown;
}

export interface PendingSearchNavigation {
  nonce: number;
  view: View;
  selectedFileId: string;
  sessionId: number | null;
  revision: number | null;
}

export function settingsTargetForSection(sectionId: string | null | undefined): SearchSettingsTarget | null {
  if (!sectionId) return null;
  return SETTINGS_TARGET_BY_SECTION[sectionId] ?? null;
}

export function settingsSectionForTarget(target: unknown): string | null {
  return isSearchSettingsTarget(target)
    ? SETTINGS_SECTION_BY_TARGET[target]
    : null;
}

export function isSearchSettingsTarget(value: unknown): value is SearchSettingsTarget {
  return value === "search-scope"
    || value === "global-index"
    || value === "appearance"
    || value === "ai";
}

function isOptionalRevision(value: unknown) {
  return value === undefined
    || value === null
    || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

const VALID_VIEWS = new Set<View>([
  "scanner", "cleanup", "organize", "library", "preview", "rules", "restore", "settings"
]);

function isOptionalFileId(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.length > 0);
}

function isValidSearchNavigatePayload(payload: SearchNavigatePayload) {
  if (!isOptionalRevision(payload.sessionId)
    || !isOptionalRevision(payload.revision)
    || !isOptionalFileId(payload.fileId)
    || typeof payload.view !== "string"
    || !VALID_VIEWS.has(payload.view as View)) return false;
  if (payload.settingsTarget !== undefined
    && payload.settingsTarget !== null
    && !isSearchSettingsTarget(payload.settingsTarget)) return false;
  return payload.settingsTarget == null
    ? true
    : payload.view === "settings" && payload.fileId == null;
}

function matchesOptionalContext(payloadValue: unknown, pendingValue: number | null | undefined) {
  const normalized = payloadValue == null ? null : payloadValue;
  return normalized === pendingValue;
}

export function shouldApplySearchNavigation(
  payload: SearchNavigatePayload,
  pending: PendingSearchNavigation | null,
  current: Pick<PendingSearchNavigation, "view" | "selectedFileId">
) {
  return Boolean(
    pending
    && isValidSearchNavigatePayload(payload)
    && payload.nonce === pending.nonce
    && matchesOptionalContext(payload.sessionId, pending.sessionId)
    && matchesOptionalContext(payload.revision, pending.revision)
    && current.view === pending.view
    && current.selectedFileId === pending.selectedFileId
  );
}

export function applySearchNavigation(
  payload: SearchNavigatePayload,
  setView: (view: View) => void,
  setSelectedFileId: (id: string) => void,
  requestSettingsSection?: (sectionId: string) => void
) {
  if (!isValidSearchNavigatePayload(payload)) return false;
  const view = payload.view as View;
  setView(view);
  if (typeof payload.fileId === "string" && payload.fileId) setSelectedFileId(payload.fileId);
  const settingsSection = settingsSectionForTarget(payload.settingsTarget);
  if (settingsSection) requestSettingsSection?.(settingsSection);
  return true;
}
