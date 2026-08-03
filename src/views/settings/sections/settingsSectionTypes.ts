import type { ScanRootSetting, SearchRootSetting } from "../../../types/domain";

export type FolderDeleteConfirmState =
  | { kind: "scan"; root: ScanRootSetting }
  | { kind: "search"; root: SearchRootSetting };

export type BackgroundRootState = "idle" | "queued" | "indexing" | "completed";
