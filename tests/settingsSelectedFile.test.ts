import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
 
const api = vi.hoisted(() => ({ getFileLibraryDetail: vi.fn() }));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: api }));

import { explicitSingleSelectionId, useFileLibraryInspectorStore } from "../src/store/useFileLibraryV2Store";
import type { FileLibraryDetail, LibrarySelectionV1 } from "../src/types/domain";
import { tauriApi } from "../src/api/tauriApi";
import {
  projectSettingsSelectedFile,
  settingsSelectedFileDetailRequestId,
  type SettingsInspectorState
} from "../src/views/settings/settingsSelectedFile";

function detail(id: string): FileLibraryDetail {
  return { id, name: `${id}.txt`, path: `D:/Library/${id}.txt` } as FileLibraryDetail;
}

function inspector(overrides: Partial<SettingsInspectorState> = {}): SettingsInspectorState {
  return {
    selectedId: null,
    detail: null,
    isLoading: false,
    error: null,
    ...overrides
  };
}

const explicitSingle: LibrarySelectionV1 = { kind: "explicit", fileIds: ["file-a"] };
const explicitMulti: LibrarySelectionV1 = { kind: "explicit", fileIds: ["file-a", "file-b"] };
const allMatching = {
  kind: "all_matching",
  query: {} as never,
  queryFingerprint: "fingerprint",
  snapshotRevision: 7,
  excludedFileIds: []
} as LibrarySelectionV1;

describe("Settings selected-file V2 projection", () => {
  beforeEach(() => {
    useFileLibraryInspectorStore.getState().clear();
    vi.mocked(tauriApi.getFileLibraryDetail).mockReset();
  });

  it("projects the canonical detail only for an explicit single selection with matching Inspector ownership", () => {
    const selectedId = explicitSingleSelectionId(explicitSingle);

    expect(selectedId).toBe("file-a");
    expect(projectSettingsSelectedFile(selectedId, inspector({ selectedId, detail: detail("file-a") }))).toEqual({
      id: "file-a",
      name: "file-a.txt",
      path: "D:/Library/file-a.txt"
    });
    expect(projectSettingsSelectedFile(selectedId, inspector({ selectedId: "file-b", detail: detail("file-a") }))).toBeUndefined();
    expect(projectSettingsSelectedFile(selectedId, inspector({ selectedId, detail: detail("file-b") }))).toBeUndefined();
  });

  it.each([
    ["no selection", null],
    ["explicit multi-selection", explicitMulti],
    ["all-matching selection", allMatching]
  ])("fails closed for %s", (_label, selection) => {
    const selectedId = explicitSingleSelectionId(selection as LibrarySelectionV1 | null);

    expect(selectedId).toBeNull();
    expect(projectSettingsSelectedFile(selectedId, inspector({ selectedId: "file-a", detail: detail("file-a") }))).toBeUndefined();
    expect(settingsSelectedFileDetailRequestId(selectedId, inspector())).toBeNull();
  });

  it("requests missing detail through the existing Inspector owner without requiring page membership", () => {
    const selectedId = explicitSingleSelectionId(explicitSingle);

    expect(settingsSelectedFileDetailRequestId(selectedId, inspector())).toBe("file-a");
    expect(settingsSelectedFileDetailRequestId(selectedId, inspector({ selectedId: "file-other" }))).toBe("file-a");
  });

  it("does not re-request a matching detail already in flight or retry a terminal Inspector error", () => {
    const selectedId = explicitSingleSelectionId(explicitSingle);

    expect(settingsSelectedFileDetailRequestId(selectedId, inspector({ selectedId, isLoading: true }))).toBeNull();
    expect(settingsSelectedFileDetailRequestId(selectedId, inspector({ selectedId, error: "detail_failed" }))).toBeNull();
  });

  it("uses the existing Inspector request coalescing and error ownership", async () => {
    vi.mocked(tauriApi.getFileLibraryDetail).mockResolvedValue(detail("file-a"));
    const selectedId = explicitSingleSelectionId(explicitSingle);
    const requestId = settingsSelectedFileDetailRequestId(selectedId, inspector());

    expect(requestId).toBe("file-a");
    const first = useFileLibraryInspectorStore.getState().loadDetail(requestId);
    const second = useFileLibraryInspectorStore.getState().loadDetail(requestId);
    await Promise.all([first, second]);

    expect(tauriApi.getFileLibraryDetail).toHaveBeenCalledOnce();
    expect(useFileLibraryInspectorStore.getState().detail?.id).toBe("file-a");
  });

  it("leaves Settings caller-zero and the ID-based AI debug action intact", () => {
    const settingsView = readFileSync(resolve("src/views/settings/SettingsView.tsx"), "utf8");

    expect(settingsView).not.toContain("useFileLibraryStore");
    expect(settingsView).not.toContain("libraryPage.files");
    expect(settingsView).toContain("useFileLibrarySelectionStore");
    expect(settingsView).toContain("useFileLibraryInspectorStore");
    expect(settingsView).toContain("explicitSingleSelectionId");
    expect(settingsView).toContain("settingsSelectedFileDetailRequestId");
    expect(settingsView).toContain('onUseSelectedFile={() => setAiDebugTarget(selectedLibraryFile?.id ?? "")}');
  });
});
