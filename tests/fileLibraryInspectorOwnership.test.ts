import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileLibraryInspectorStore } from "../src/store/useFileLibraryV2Store";
import type { FileLibraryDetail } from "../src/types/domain";

const api = vi.hoisted(() => ({ getFileLibraryDetail: vi.fn() }));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: api }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function detail(id: string, revision: number): FileLibraryDetail {
  return { id, revision } as unknown as FileLibraryDetail;
}

describe("File Library Inspector ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileLibraryInspectorStore.setState({ detail: null, selectionSummary: null, selectedId: null, requestEpoch: 0, isLoading: false, error: null });
  });

  it("commits a refresh only while the expected Inspector owner and epoch remain current", () => {
    useFileLibraryInspectorStore.setState({ selectedId: "file-a", requestEpoch: 7 });
    expect(useFileLibraryInspectorStore.getState().commitDetailIfCurrent("file-a", detail("file-a", 2), 7)).toBe(true);
    expect(useFileLibraryInspectorStore.getState().detail).toMatchObject({ id: "file-a", revision: 2 });

    useFileLibraryInspectorStore.setState({ selectedId: "file-b", requestEpoch: 8 });
    expect(useFileLibraryInspectorStore.getState().commitDetailIfCurrent("file-a", detail("file-a", 3), 7)).toBe(false);
    expect(useFileLibraryInspectorStore.getState().detail).toMatchObject({ id: "file-a", revision: 2 });
  });

  it("keeps B when a deferred A load resolves after the user switches selection", async () => {
    const pendingA = deferred<FileLibraryDetail>();
    api.getFileLibraryDetail.mockImplementation((fileId: string) => fileId === "file-a" ? pendingA.promise : Promise.resolve(detail("file-b", 1)));

    const loadA = useFileLibraryInspectorStore.getState().loadDetail("file-a");
    const loadB = useFileLibraryInspectorStore.getState().loadDetail("file-b");
    await loadB;
    pendingA.resolve(detail("file-a", 2));
    await loadA;

    expect(useFileLibraryInspectorStore.getState().selectedId).toBe("file-b");
    expect(useFileLibraryInspectorStore.getState().detail).toMatchObject({ id: "file-b", revision: 1 });
  });

  it("keeps the newest of two consecutive refreshes and stays empty after clear", async () => {
    const first = deferred<FileLibraryDetail>();
    const second = deferred<FileLibraryDetail>();
    api.getFileLibraryDetail.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const firstLoad = useFileLibraryInspectorStore.getState().loadDetail("file-a");
    const secondLoad = useFileLibraryInspectorStore.getState().loadDetail("file-a");
    first.resolve(detail("file-a", 2));
    await firstLoad;
    expect(useFileLibraryInspectorStore.getState().detail).toBeNull();
    second.resolve(detail("file-a", 3));
    await secondLoad;
    expect(useFileLibraryInspectorStore.getState().detail).toMatchObject({ id: "file-a", revision: 3 });

    const pendingClear = deferred<FileLibraryDetail>();
    api.getFileLibraryDetail.mockReturnValueOnce(pendingClear.promise);
    const loadAfterClear = useFileLibraryInspectorStore.getState().loadDetail("file-a");
    useFileLibraryInspectorStore.getState().clear();
    pendingClear.resolve(detail("file-a", 4));
    await loadAfterClear;
    expect(useFileLibraryInspectorStore.getState().selectedId).toBeNull();
    expect(useFileLibraryInspectorStore.getState().detail).toBeNull();
  });
});
