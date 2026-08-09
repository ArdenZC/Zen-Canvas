import { describe, expect, it } from "vitest";
import { findVaultPaginationArchitectureViolations } from "../scripts/performanceArchitectureGuard.mjs";

const canonicalView = `
  function VaultView() {
    const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
    const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
    useEffect(() => {
      void loadFirstPage().catch(() => undefined);
    }, [loadFirstPage]);
    return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;
  }
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
    function VaultView() {
      const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
      const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
      useEffect(() => {
        void loadFirstPage();
      }, [loadFirstPage]);
      ${declarations}
      return <FileLibraryList onLoadMore={${callback}} />;
    }
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

  it("rejects a local no-op first-page binding", () => {
    const view = canonicalView.replace(
      "const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);",
      "const loadFirstPage = async () => {};"
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a mutable load-more binding", () => {
    const view = canonicalView.replace(
      "const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);",
      "let loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);\nloadNextPage = async () => {};"
    );

    expect(violations(view)).toContain("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
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

  it("rejects a transformed backend page-size property", () => {
    const store = canonicalStore.replace("pageSize, cursor", "pageSize: pageSize + 1, cursor");

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must use its exact page-size parameter."
    );
  });

  it("rejects a backend request that drops the helper cursor", () => {
    const store = canonicalStore.replace("pageSize, cursor });", "pageSize, cursor: null });");

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must forward its exact cursor parameter."
    );
  });

  it("rejects a backend page-size parameter that is reassigned", () => {
    const store = canonicalStore.replace(
      "async function executeLibraryQuery(spec, pageSize, cursor) {",
      "async function executeLibraryQuery(spec, pageSize, cursor) {\n    pageSize = 200;"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must use its exact page-size parameter."
    );
  });

  it("rejects a backend cursor parameter that is reassigned", () => {
    const store = canonicalStore.replace(
      "async function executeLibraryQuery(spec, pageSize, cursor) {",
      "async function executeLibraryQuery(spec, pageSize, cursor) {\n    cursor = null;"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must forward its exact cursor parameter."
    );
  });

  it("rejects request-object property mutation before the backend call", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      "const request = { query: spec, pageSize, cursor };\n    request.pageSize = 200;\n    return tauriApi.queryFileLibraryV2(request);"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request object must not be mutated before the query."
    );
  });

  it("rejects request-object mutation through an alias", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      "const request = { query: spec, pageSize, cursor };\n    const alias = request;\n    alias.pageSize = 200;\n    return tauriApi.queryFileLibraryV2(request);"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request object must not be mutated before the query."
    );
  });

  it("rejects an unresolved request spread after guarded fields", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor, ...overrides });"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must not use an unresolved spread after guarded fields."
    );
  });

  it("rejects a request passed to an arbitrary helper before the backend call", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      "const request = { query: spec, pageSize, cursor };\n    mutateRequest(request);\n    return tauriApi.queryFileLibraryV2(request);"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must not escape to an arbitrary helper before the query."
    );
  });

  it("rejects a cursor binding that is not the backend nextCursor read", () => {
    const store = canonicalStore.replace("const cursor = get().nextCursor;", "const cursor = get().otherCursor;");

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("does not let an unrelated cursor binding invalidate the canonical next-page cursor", () => {
    const store = `${canonicalStore}\nfunction unrelated(cursor) { cursor = null; }`;

    expect(violations(canonicalView, store)).toEqual([]);
  });

  it("rejects a mutable backend cursor binding", () => {
    const store = canonicalStore.replace(
      "const cursor = get().nextCursor;",
      "let cursor = get().nextCursor;\n      cursor = get().otherCursor;"
    );

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("rejects a load-more query that is unreachable after an early return", () => {
    const store = canonicalStore.replace(
      "loadNextPage: async () => {\n      const cursor = get().nextCursor;\n      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);\n    },",
      "loadNextPage: async () => {\n      return;\n      const cursor = get().nextCursor;\n      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);\n    },"
    );

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("rejects a load-more query that is unreachable in a conditional expression", () => {
    const store = canonicalStore.replace(
      "return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);",
      "return true ? undefined : executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);"
    );

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("rejects a load-more query after a non-fallthrough try/finally", () => {
    const store = canonicalStore.replace(
      "loadNextPage: async () => {\n      const cursor = get().nextCursor;\n      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);\n    },",
      "loadNextPage: async () => {\n      try {\n        return;\n      } finally {}\n      const cursor = get().nextCursor;\n      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);\n    },"
    );

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
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

  it("accepts canonical bindings when another component reuses their names", () => {
    const view = `${canonicalView}
      function OtherView() {
        let loadFirstPage = async () => undefined;
        loadFirstPage = async () => undefined;
        let loadNextPage = async () => undefined;
        loadNextPage = async () => undefined;
        return null;
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it("rejects an aliased direct backend call from Vault", () => {
    const view = viewWithCallback(
      "handleLoadMore",
      "const queryDirectly = tauriApi.queryFileLibraryV2;\n      const handleLoadMore = () => {\n        loadNextPage();\n        queryDirectly({ pageSize: 50, cursor: null });\n      };"
    );

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("rejects a computed direct backend call from Vault", () => {
    const view = viewWithCallback(
      "() => { loadNextPage(); tauriApi[\"queryFileLibraryV2\"]({ pageSize: 50, cursor: null }); }"
    );

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("rejects a computed backend call through a tauriApi receiver alias", () => {
    const view = viewWithCallback(
      "handleLoadMore",
      "const api = tauriApi;\n      const handleLoadMore = () => {\n        loadNextPage();\n        api[\"queryFileLibraryV2\"]({ pageSize: 50, cursor: null });\n      };"
    );

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("ignores an aliased backend call in an unrelated component", () => {
    const view = `${canonicalView}
      function OtherView() {
        const queryDirectly = tauriApi.queryFileLibraryV2;
        queryDirectly({ pageSize: 50, cursor: null });
        return null;
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it.each([
    [
      "renamed object destructuring",
      "const { queryFileLibraryV2: queryDirectly } = tauriApi;\n      const handleLoadMore = () => {\n        loadNextPage();\n        queryDirectly({ pageSize: 50, cursor: null });\n      };"
    ],
    [
      "chained alias",
      "const queryDirectly = tauriApi.queryFileLibraryV2;\n      const queryAgain = queryDirectly;\n      const handleLoadMore = () => {\n        loadNextPage();\n        queryAgain({ pageSize: 50, cursor: null });\n      };"
    ]
  ])("rejects %s direct backend aliases", (_label, declarations) => {
    const view = viewWithCallback("handleLoadMore", declarations);

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("ignores same-name writes to nested helper parameters", () => {
    const view = `${canonicalView}
      function helper(loadFirstPage, loadNextPage) {
        loadFirstPage = () => undefined;
        loadNextPage = () => undefined;
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it("accepts destructured canonical store selectors", () => {
    const view = canonicalView
      .replace("(state) => state.loadFirstPage", "({ loadFirstPage }) => loadFirstPage")
      .replace("(state) => state.loadNextPage", "({ loadNextPage }) => loadNextPage");

    expect(violations(view)).toEqual([]);
  });

  it.each([
    ["wrong callback", "loadFirstPage", ""],
    ["empty wrapper", "handleLoadMore", "const handleLoadMore = () => {};"],
    ["wrong function call", "handleLoadMore", "const handleLoadMore = () => loadFirstPage();"],
    ["misleading wrapper", "handleLoadMore", "const handleLoadMore = () => { doSomething(); };"],
    ["unreachable load-more call", "handleLoadMore", "const handleLoadMore = () => { return; loadNextPage(); };"],
    ["statically unreachable load-more call", "handleLoadMore", "const handleLoadMore = () => { if (false) loadNextPage(); };"],
    ["direct backend callback", "handleLoadMore", "const handleLoadMore = () => tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null });"],
    ["recursive wrapper", "handleLoadMore", "const handleLoadMore = () => handleLoadMore();"],
    ["missing callback", "", ""]
  ])("rejects %s callback bindings", (_label, callback, declarations) => {
    const view = callback ? viewWithCallback(callback, declarations) : viewWithCallback("", declarations).replace("onLoadMore={}", "");

    expect(violations(view)).toContain("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  });

  it("rejects first-page calls that only exist in an unmounted helper", () => {
    const view = `
      function VaultView() {
        const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
        const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
        function neverCalled() { loadFirstPage(); }
        return <FileLibraryList onLoadMore={() => loadNextPage()} />;
      }
    `;

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a first-page call that only exists in an effect cleanup", () => {
    const view = canonicalView.replace(
      "useEffect(() => {\n      void loadFirstPage().catch(() => undefined);\n    }, [loadFirstPage]);",
      "useEffect(() => () => void loadFirstPage(), [loadFirstPage]);"
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects frontend-owned fake cursors", () => {
    const view = `${canonicalView}
      const [cursor, setCursor] = useState<string | null>(null);
    `;

    expect(violations(view)).toContain("Vault must not own a frontend pagination cursor.");
  });
});
