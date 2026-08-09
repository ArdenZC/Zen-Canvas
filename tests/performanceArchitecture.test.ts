import { describe, expect, it } from "vitest";
import { findVaultPaginationArchitectureViolations } from "../scripts/performanceArchitectureGuard.mjs";

const canonicalView = `
  const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
  const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
  void loadFirstPage().catch(() => undefined);
  <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;
`;

const canonicalStore = `
  export const FILE_LIBRARY_V2_PAGE_SIZE = 50;
  async function executeLibraryQuery(spec, pageSize, cursor) {
    return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });
  }
  const result = { nextCursor: null };
  const store = {
    loadFirstPage: async () => executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, null),
    loadNextPage: async () => {
      const cursor = get().nextCursor;
      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);
    },
    refresh: async () => undefined
  };
`;

function violations(viewSource = canonicalView, storeSource = canonicalStore) {
  return findVaultPaginationArchitectureViolations({ viewSource, storeSource });
}

describe("Vault pagination architecture guard", () => {
  it("accepts canonical store pagination with a bounded backend cursor", () => {
    expect(violations()).toEqual([]);
  });

  it("rejects direct backend bypass from Vault", () => {
    const view = `${canonicalView}
      const cursor = null;
      void tauriApi.queryFileLibraryV2({ pageSize: 50, cursor });
    `;

    expect(violations(view)).toEqual(expect.arrayContaining([
      "Vault must not call the File Library V2 backend directly.",
      "Vault must not own a frontend pagination cursor."
    ]));
  });

  it("rejects unbounded page requests", () => {
    const store = canonicalStore.replace("FILE_LIBRARY_V2_PAGE_SIZE = 50", "FILE_LIBRARY_V2_PAGE_SIZE = 100000");

    expect(violations(canonicalView, store)).toEqual(expect.arrayContaining([
      "File Library V2 store must define a bounded page size of 50.",
      "File Library pagination must not issue an unbounded page request."
    ]));
  });

  it("rejects frontend-owned fake cursors", () => {
    const view = `${canonicalView}
      const [cursor, setCursor] = useState<string | null>(null);
    `;

    expect(violations(view)).toContain("Vault must not own a frontend pagination cursor.");
  });
});
