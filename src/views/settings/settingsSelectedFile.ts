import type { FileLibraryDetail } from "../../types/domain";

export interface SettingsInspectorState {
  selectedId: string | null;
  detail: FileLibraryDetail | null;
  isLoading: boolean;
  error: string | null;
}

export function projectSettingsSelectedFile(
  selectedFileId: string | null,
  inspector: Pick<SettingsInspectorState, "selectedId" | "detail">
): { id: string; name: string; path: string } | undefined {
  if (!selectedFileId || inspector.selectedId !== selectedFileId || inspector.detail?.id !== selectedFileId) return undefined;
  return {
    id: inspector.detail.id,
    name: inspector.detail.name,
    path: inspector.detail.path
  };
}

export function settingsSelectedFileDetailRequestId(
  selectedFileId: string | null,
  inspector: SettingsInspectorState
): string | null {
  if (!selectedFileId) return null;
  if (inspector.selectedId === selectedFileId && inspector.detail?.id === selectedFileId) return null;
  if (inspector.selectedId === selectedFileId && (inspector.isLoading || inspector.error !== null)) return null;
  return selectedFileId;
}
