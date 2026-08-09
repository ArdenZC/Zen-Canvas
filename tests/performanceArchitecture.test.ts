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

function viewWithCallback(callback: string, declarations = "") {
  return `
    const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
    const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
    void loadFirstPage();
    ${declarations}
    <FileLibraryList onLoadMore={${callback}} />;
  `;
}

function storeWithPageSize(value: string) {
  return canonicalStore.replace("FILE_LIBRARY_V2_PAGE_SIZE = 50", `FILE_LIBRARY_V2_PAGE_SIZE = ${value}`);
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

  it.each(["0", "-1", "25", "49", "51", "100000", "DEFAULT_PAGE_SIZE"])("requires an exact numeric page-size contract: %s", (value) => {
    expect(violations(canonicalView, storeWithPageSize(value))).toContain(
      "File Library V2 store must define FILE_LIBRARY_V2_PAGE_SIZE as exactly 50."
    );
  });

  it("accepts only the exact page-size constant", () => {
    expect(violations(canonicalView, storeWithPageSize("50"))).not.toContain(
      "File Library V2 store must define FILE_LIBRARY_V2_PAGE_SIZE as exactly 50."
    );
  });

  it.each([
    "export let FILE_LIBRARY_V2_PAGE_SIZE = 50;",
    "export const FILE_LIBRARY_V2_PAGE_SIZE = 50;\nFILE_LIBRARY_V2_PAGE_SIZE = 100000;"
  ])("rejects a mutable page-size binding: %s", (declaration) => {
    const store = canonicalStore.replace("export const FILE_LIBRARY_V2_PAGE_SIZE = 50;", declaration);

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 store must define FILE_LIBRARY_V2_PAGE_SIZE as exactly 50."
    );
  });

  it("rejects a missing page-size declaration", () => {
    const store = canonicalStore.replace("export const FILE_LIBRARY_V2_PAGE_SIZE = 50;", "");

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 store must define FILE_LIBRARY_V2_PAGE_SIZE as exactly 50."
    );
  });

  it("rejects a selector that reads loadNextPage from a foreign receiver", () => {
    const view = canonicalView.replace("(state) => state.loadNextPage", "(state) => other.loadNextPage");

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("rejects an unbounded individual page request", () => {
    const store = canonicalStore.replace("pageSize, cursor", "pageSize: 100000, cursor");

    expect(violations(canonicalView, store)).toContain(
      "File Library pagination must not issue an unbounded page request."
    );
  });

  it("rejects a computed first-page size even when the constant is present", () => {
    const store = canonicalStore.replace(
      "executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, null)",
      "executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE * 2000, null)"
    );

    expect(violations(canonicalView, store)).toContain(
      "The first File Library V2 request must use a bounded page size and no cursor."
    );
  });

  it.each([
    ["inline callback", "() => loadNextPage()", ""],
    ["direct function reference", "loadNextPage", ""],
    ["named arrow wrapper", "handleLoadMore", "const handleLoadMore = () => void loadNextPage().catch(() => undefined);"],
    ["named function declaration", "handleLoadMore", "function handleLoadMore() { void loadNextPage(); }"]
  ])("accepts %s callback bindings", (_label, callback, declarations) => {
    expect(violations(viewWithCallback(callback, declarations))).not.toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("accepts the existing inline callback with an error boundary", () => {
    expect(violations()).not.toContain("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  });

  it.each([
    ["wrong callback", "loadFirstPage", ""],
    ["empty wrapper", "handleLoadMore", "const handleLoadMore = () => {};"],
    ["wrong function call", "handleLoadMore", "const handleLoadMore = () => loadFirstPage();"],
    ["misleading wrapper", "handleLoadMore", "const handleLoadMore = () => { doSomething(); };"],
    ["unreachable load-more call", "handleLoadMore", "const handleLoadMore = () => { return; loadNextPage(); };"],
    ["direct backend callback", "handleLoadMore", "const handleLoadMore = () => tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null });"],
    ["recursive wrapper", "handleLoadMore", "const handleLoadMore = () => handleLoadMore();"],
    ["missing callback", "", ""]
  ])("rejects %s callback bindings", (_label, callback, declarations) => {
    const view = callback ? viewWithCallback(callback, declarations) : viewWithCallback("", declarations).replace("onLoadMore={}", "");

    expect(violations(view)).toContain("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  });

  it("rejects frontend-owned fake cursors", () => {
    const view = `${canonicalView}
      const [cursor, setCursor] = useState<string | null>(null);
    `;

    expect(violations(view)).toContain("Vault must not own a frontend pagination cursor.");
  });
});
