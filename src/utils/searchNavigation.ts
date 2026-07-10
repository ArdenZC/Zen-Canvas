import type { View } from "../types/ui";

export interface SearchNavigatePayload {
  view: unknown;
  fileId: unknown;
}

const VALID_VIEWS = new Set<View>([
  "scanner", "cleanup", "organize", "library", "preview", "rules", "restore", "settings"
]);

export function applySearchNavigation(
  payload: SearchNavigatePayload,
  setView: (view: View) => void,
  setSelectedFileId: (id: string) => void
) {
  const view = typeof payload.view === "string" && VALID_VIEWS.has(payload.view as View)
    ? payload.view as View
    : "library";
  setView(view);
  if (typeof payload.fileId === "string" && payload.fileId) setSelectedFileId(payload.fileId);
}
