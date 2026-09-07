import type { InspectorDetailLoadResult } from "../store/useFileLibraryV2Store";

export interface FileLibraryActivationBridge {
  setExplicitSelection: (fileIds: string[], focusedId?: string, anchorIndex?: number) => void;
  loadDetail: (fileId: string | null) => Promise<InspectorDetailLoadResult>;
}

export function projectAcceptedFileLibraryActivation(
  fileId: string | null | undefined,
  bridge: FileLibraryActivationBridge
) {
  if (typeof fileId !== "string" || !fileId) return false;

  bridge.setExplicitSelection([fileId], fileId);
  void bridge.loadDetail(fileId);
  return true;
}
