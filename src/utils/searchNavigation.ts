import type { View } from "../types/ui";

export interface SearchNavigatePayload {
  view: View;
  fileId: string | null;
}

export function applySearchNavigation(
  payload: SearchNavigatePayload,
  setView: (view: View) => void,
  setSelectedFileId: (id: string) => void
) {
  setView(payload.view);
  if (payload.fileId) setSelectedFileId(payload.fileId);
}
