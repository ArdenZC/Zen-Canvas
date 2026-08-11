import { describe, expect, it } from "vitest";
import { findVaultPaginationArchitectureViolations } from "../scripts/performanceArchitectureGuard.mjs";

const canonicalView = `
  import { useEffect } from "react";
  import { useFileLibraryResultStore } from "../../store/useFileLibraryV2Store";

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
  import { create } from "zustand";
  import { tauriApi } from "../api/tauriApi";
  export const FILE_LIBRARY_V2_PAGE_SIZE = 50;
  async function executeLibraryQuery(spec, pageSize, cursor) {
    return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });
  }
  export const useFileLibraryResultStore = create<ResultState>((set, get) => ({
    loadFirstPage: async () => executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, null),
    loadNextPage: async () => {
      const cursor = get().nextCursor;
      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);
    },
    refresh: async () => undefined
  }));
`;

function violations(viewSource = canonicalView, storeSource = canonicalStore) {
  return findVaultPaginationArchitectureViolations({ viewSource, storeSource });
}

function viewWithCallback(callback: string, declarations = "") {
  return `
    import { useEffect } from "react";
    import { useFileLibraryResultStore } from "../../store/useFileLibraryV2Store";

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

  it("accepts an aliased canonical result-store import", () => {
    const view = canonicalView
      .replace(
        'import { useFileLibraryResultStore } from "../../store/useFileLibraryV2Store";',
        'import { useFileLibraryResultStore as useResultStore } from "../../store/useFileLibraryV2Store";'
      )
      .replaceAll("useFileLibraryResultStore(", "useResultStore(");

    expect(violations(view)).toEqual([]);
  });

  it.each([
    [
      "same-name fake hook",
      'import { useFileLibraryResultStore } from "../../store/useFileLibraryV2Store";',
      "function useFileLibraryResultStore(selector) { return selector({ loadFirstPage: async () => undefined, loadNextPage: async () => undefined }); }"
    ],
    [
      "wrong-module hook import",
      'import { useFileLibraryResultStore } from "../../store/useFileLibraryV2Store";',
      'import { useFileLibraryResultStore } from "./fakeStore";'
    ],
    [
      "fake hook returning canonical selectors",
      'import { useFileLibraryResultStore } from "../../store/useFileLibraryV2Store";',
      "const useFileLibraryResultStore = (selector) => selector({ loadFirstPage: async () => undefined, loadNextPage: async () => undefined });"
    ]
  ])("rejects a %s", (_label, canonicalImport, replacement) => {
    const view = canonicalView.replace(canonicalImport, replacement);

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a result-store hook shadowed by a Vault parameter", () => {
    const view = canonicalView.replace(
      "function VaultView() {",
      "function VaultView(useFileLibraryResultStore) {"
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a result-store hook shadowed inside its lexical block", () => {
    const view = canonicalView.replace(
      "const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);",
      `{
        const useFileLibraryResultStore = (selector) => selector({ loadFirstPage: async () => undefined });
        const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
        useEffect(() => void loadFirstPage(), [loadFirstPage]);
      }`
    ).replace(
      `useEffect(() => {
      void loadFirstPage().catch(() => undefined);
    }, [loadFirstPage]);`,
      ""
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("accepts named React effect imports through an alias", () => {
    const view = canonicalView
      .replace(
        'import { useEffect } from "react";',
        'import { useEffect as reactEffect } from "react";'
      )
      .replaceAll("useEffect(", "reactEffect(");

    expect(violations(view)).toEqual([]);
  });

  it.each(["useEffect", "useLayoutEffect"])("accepts the React namespace %s hook", (hook) => {
    const view = canonicalView
      .replace('import { useEffect } from "react";', 'import * as React from "react";')
      .replace("useEffect(", `React.${hook}(`);

    expect(violations(view)).toEqual([]);
  });

  it("accepts a React namespace hook through a local namespace alias", () => {
    const view = canonicalView
      .replace('import { useEffect } from "react";', 'import * as React from "react";')
      .replace("function VaultView() {", "function VaultView() {\n    const ReactApi = React;")
      .replace("useEffect(", "ReactApi.useEffect(");

    expect(violations(view)).toEqual([]);
  });

  it.each([
    [
      "local hook shadow",
      "function VaultView() {",
      "function VaultView() {\n    const useEffect = () => undefined;"
    ],
    [
      "parameter shadow",
      "function VaultView() {",
      "function VaultView(useEffect) {"
    ],
    [
      "wrong-module hook import",
      'import { useEffect } from "react";',
      'import { useEffect } from "./fakeReact";'
    ],
    [
      "fake React namespace",
      'import { useEffect } from "react";',
      'import * as React from "./fakeReact";'
    ]
  ])("rejects a %s", (_label, source, replacement) => {
    const view = canonicalView
      .replace(source, replacement)
      .replace(
        'import { useEffect } from "react";',
        'import { useEffect } from "./fakeReact";'
      );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("does not borrow load-more discovery from an unrelated component", () => {
    const view = `${canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "return null;"
    )}
    function OtherView() {
      const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
      return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;
    }
    `;

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("does not discover load-more from an uninvoked nested function", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `function NeverRendered() {
        return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;
      }
      return null;`
    );

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("rejects any reachable File Library list missing its load-more callback", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `return showPrimary
        ? <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />
        : <FileLibraryList />;`
    );

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("rejects direct backend bypass from Vault", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "const cursor = null;\n      void tauriApi.queryFileLibraryV2({ pageSize: 50, cursor });\n      return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;"
    );

    expect(violations(view)).toEqual(expect.arrayContaining([
      "Vault must not call the File Library V2 backend directly.",
      "Vault must not own a frontend pagination cursor."
    ]));
  });

  it.each([
    [
      "direct raw Tauri invoke",
      "invoke(\"query_file_library_v2\", { pageSize: 50, cursor: null });"
    ],
    [
      "aliased raw Tauri invoke",
      "const callTauri = invoke;\n      callTauri(\"query_file_library_v2\", { pageSize: 50, cursor: null });"
    ],
    [
      "aliased raw command string",
      "const command = \"query_file_library_v2\";\n      invoke(command, { pageSize: 50, cursor: null });"
    ],
    [
      "chained raw command string alias",
      "const command = \"query_file_library_v2\";\n      const commandAlias = command;\n      invoke(commandAlias, { pageSize: 50, cursor: null });"
    ]
  ])("rejects %s from Vault", (_label, call) => {
    const view = viewWithCallback("() => loadNextPage()", call);

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it.each([
    [
      "named Tauri invoke import",
      'import { invoke } from "@tauri-apps/api/core";\n',
      "invoke(\"query_file_library_v2\", { pageSize: 50, cursor: null });"
    ],
    [
      "aliased Tauri invoke import",
      'import { invoke as tauriInvoke } from "@tauri-apps/api/core";\n',
      "tauriInvoke(\"query_file_library_v2\", { pageSize: 50, cursor: null });"
    ]
  ])("rejects %s by import provenance", (_label, importSource, call) => {
    const view = `${importSource}${viewWithCallback("() => loadNextPage()", call)}`;

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("rejects a namespace-imported Tauri invoke", () => {
    const view = `import * as core from "@tauri-apps/api/core";
    ${viewWithCallback(
      "() => loadNextPage()",
      "core.invoke(\"query_file_library_v2\", { pageSize: 50, cursor: null });"
    )}`;

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("rejects a namespace-imported Tauri invoke through an alias and command alias", () => {
    const view = `import * as core from "@tauri-apps/api/core";
    ${viewWithCallback(
      "() => loadNextPage()",
      `const api = core;
      const command = "query_file_library_v2";
      api.invoke(command, { pageSize: 50, cursor: null });`
    )}`;

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it.each([
    [
      "ordinary analytics receiver",
      'const analytics = { invoke: () => undefined };\n      analytics.invoke("query_file_library_v2", {});'
    ],
    [
      "ordinary local core object",
      'const core = { invoke: () => undefined };\n      core.invoke("query_file_library_v2", {});'
    ],
  ])("does not flag %s as a Tauri backend bypass", (_label, call) => {
    const view = viewWithCallback("() => loadNextPage()", call);

    expect(violations(view)).not.toContain("Vault must not call the File Library V2 backend directly.");
  });

  it.each([
    ["console logging", 'console.debug("query_file_library_v2");'],
    ["telemetry", 'telemetry.track("query_file_library_v2");']
  ])("ignores the backend command string passed to unrelated %s", (_label, call) => {
    const view = viewWithCallback("() => loadNextPage()", call);

    expect(violations(view)).not.toContain("Vault must not call the File Library V2 backend directly.");
  });

  it.each([
    ["for", "for (let index = 0; index < 1; index += 1) { tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null }); }"],
    ["while", "while (enabled) { tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null }); break; }"],
    ["do", "do { tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null }); } while (false);"],
    ["switch", 'switch (mode) { case "query": tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null }); break; }']
  ])("rejects a direct backend bypass inside a %s statement", (_label, statement) => {
    const view = viewWithCallback("() => loadNextPage()", statement);

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("ignores a raw backend command in an unrelated component", () => {
    const view = `${canonicalView}
      function OtherView() {
        invoke(\"query_file_library_v2\", { pageSize: 50, cursor: null });
        return null;
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it.each([
    ["direct method", "tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null });"],
    ["command wrapper", "invokeCommand(\"query_file_library_v2\", { pageSize: 50, cursor: null });"]
  ])("ignores a %s backend call in an unrelated component", (_label, call) => {
    const view = `${canonicalView}
      function OtherView() {
        ${call}
        return null;
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it("rejects a direct invokeCommand backend call from Vault", () => {
    const view = viewWithCallback(
      "() => loadNextPage()",
      "invokeCommand(\"query_file_library_v2\", { pageSize: 50, cursor: null });"
    );

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it.each([
    [
      "top-level helper",
      "function runQuery() { return tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null }); }"
    ],
    [
      "top-level helper alias",
      "const runQuery = () => { const queryDirectly = tauriApi.queryFileLibraryV2; return queryDirectly({ pageSize: 50, cursor: null }); };"
    ],
    [
      "top-level raw invoke helper",
      "function runQuery() { return invoke(\"query_file_library_v2\", { pageSize: 50, cursor: null }); }"
    ]
  ])("rejects a direct backend bypass through an invoked %s", (_label, helper) => {
    const view = `${canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "runQuery();\n    return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;"
    )}\n${helper}`;

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("rejects an unresolved imported query helper", () => {
    const view = `
      import { runQuery } from "./fileLibraryQueryHelpers";
      ${canonicalView.replace(
        "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
        "runQuery();\n    return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;"
      )}
    `;

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("ignores a direct backend call in an uninvoked helper", () => {
    const view = `${canonicalView}
      function neverCalled() {
        return tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null });
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it.each([
    ["property access", "helpers.refresh()"],
    ["element access", 'helpers["refresh"]()']
  ])("rejects a direct backend bypass through an invoked object method using %s", (_label, call) => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `const helpers = {
        refresh() {
          return tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null });
        }
      };
      ${call};
      return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;`
    );

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("rejects a direct backend bypass in a rendered local child component", () => {
    const view = `${canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `return <>
        <QueryingChild />
        <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />
      </>;`
    )}
    function QueryingChild() {
      void tauriApi.queryFileLibraryV2({ pageSize: 50, cursor: null });
      return null;
    }`;

    expect(violations(view)).toContain("Vault must not call the File Library V2 backend directly.");
  });

  it("does not let an unreachable rendered child satisfy load-more", () => {
    const view = `${canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "return false && <PagedChild />;"
    )}
    function PagedChild() {
      return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;
    }`;

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("rejects a local no-op first-page binding", () => {
    const view = canonicalView.replace(
      "const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);",
      "const loadFirstPage = async () => {};"
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a first-page effect whose local binding shadows the canonical store action", () => {
    const view = canonicalView.replace(
      "void loadFirstPage().catch(() => undefined);",
      "const loadFirstPage = () => undefined;\n      void loadFirstPage();"
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

  it("rejects an unbounded first-page request through the canonical query flow", () => {
    const store = canonicalStore.replace(
      "executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, null)",
      "executeLibraryQuery(spec, 100000, null)"
    );

    expect(violations(canonicalView, store)).toContain(
      "The first File Library V2 request must use a bounded page size and no cursor."
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

  it("ignores unrelated limit and pageSize options outside the Query V2 flow", () => {
    const store = `${canonicalStore}
      function unrelatedDataRequests() {
        const tags = getTags({ limit: 100 });
        const previews = loadPreviews({ pageSize: 1000 });
        const options = { limit: 500 };
        return [tags, previews, options];
      }
    `;

    expect(violations(canonicalView, store)).toEqual([]);
  });

  it("rejects a page-size parameter that shadows the guarded constant", () => {
    const store = canonicalStore.replace(
      "loadNextPage: async () => {",
      "loadNextPage: async (FILE_LIBRARY_V2_PAGE_SIZE = 500) => {"
    );

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
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

  it.each([
    [
      "page size",
      "const pageSize = 500;",
      "File Library V2 backend request must use its exact page-size parameter."
    ],
    [
      "cursor",
      "const cursor = null;",
      "File Library V2 backend request must forward its exact cursor parameter."
    ]
  ])("rejects a backend request that uses a shadowing %s binding", (_label, shadow, violation) => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      `{ ${shadow}
      return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });
    }`
    );

    expect(violations(canonicalView, store)).toContain(violation);
  });

  it("rejects a backend query whose tauriApi receiver is shadowed by a default parameter", () => {
    const store = canonicalStore.replace(
      "async function executeLibraryQuery(spec, pageSize, cursor) {",
      "async function executeLibraryQuery(spec, pageSize, cursor, tauriApi = { queryFileLibraryV2: () => undefined }) {"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must use its exact page-size parameter."
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

  it.each([
    ["property cleanup", "request.pageSize = 0;"],
    ["alias cleanup", "const alias = request;\n    alias.pageSize = 0;"]
  ])("ignores request-object %s after the backend call", (_label, cleanup) => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      `const request = { query: spec, pageSize, cursor };
    const result = await tauriApi.queryFileLibraryV2(request);
    ${cleanup}
    return result;`
    );

    expect(violations(canonicalView, store)).not.toContain(
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

  it.each([
    ["object", "({ pageSize: request.pageSize } = { pageSize: 200 });"],
    ["array", "[request.cursor] = [null];"]
  ])("rejects request-object mutation through a destructuring %s assignment", (_label, assignment) => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      `const request = { query: spec, pageSize, cursor };
    ${assignment}
    return tauriApi.queryFileLibraryV2(request);`
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request object must not be mutated before the query."
    );
  });

  it.each([
    ["object", "const holder = { request };\n    holder.request.pageSize = 200;"],
    ["array", "const holder = [request];\n    holder[0].pageSize = 200;"]
  ])("rejects request-object mutation through a containing %s", (_label, mutation) => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      `const request = { query: spec, pageSize, cursor };
    ${mutation}
    return tauriApi.queryFileLibraryV2(request);`
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request object must not be mutated before the query."
    );
  });

  it("rejects request-object mutation inside an invoked closure", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      "const request = { query: spec, pageSize, cursor };\n    (() => {\n      request.pageSize = 200;\n    })();\n    return tauriApi.queryFileLibraryV2(request);"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request object must not be mutated before the query."
    );
  });

  it("rejects request-object mutation inside an invoked named closure", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      `const request = { query: spec, pageSize, cursor };
    const mutate = () => {
      request.pageSize = 200;
    };
    mutate();
    return tauriApi.queryFileLibraryV2(request);`
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request object must not be mutated before the query."
    );
  });

  it("ignores request-object mutation inside an uninvoked named closure", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      `const request = { query: spec, pageSize, cursor };
    const neverMutate = () => {
      request.pageSize = 200;
    };
    return tauriApi.queryFileLibraryV2(request);`
    );

    expect(violations(canonicalView, store)).not.toContain(
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

  it("rejects an unresolved computed request property after guarded fields", () => {
    const store = canonicalStore.replace(
      "return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor });",
      "const key = \"pageSize\";\n    return tauriApi.queryFileLibraryV2({ query: spec, pageSize, cursor, [key]: 200 });"
    );

    expect(violations(canonicalView, store)).toContain(
      "File Library V2 backend request must not use an unresolved computed property after guarded fields."
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

  it("accepts a canonical Zustand getter parameter under a renamed binding", () => {
    const store = canonicalStore
      .replace("(set, get) =>", "(set, readState) =>")
      .replace("get().nextCursor", "readState().nextCursor");

    expect(violations(canonicalView, store)).toEqual([]);
  });

  it.each([
    [
      "local shadow",
      "loadNextPage: async () => {\n      const get = () => ({ nextCursor: null });\n      const cursor = get().nextCursor;",
      "loadNextPage: async () => {\n      const cursor = get().nextCursor;"
    ],
    [
      "parameter shadow",
      "loadNextPage: async (get = () => ({ nextCursor: null })) => {\n      const cursor = get().nextCursor;",
      "loadNextPage: async () => {\n      const cursor = get().nextCursor;"
    ],
    [
      "foreign receiver",
      "loadNextPage: async () => {\n      const cursor = other.get().nextCursor;",
      "loadNextPage: async () => {\n      const cursor = get().nextCursor;"
    ]
  ])("rejects a %s cursor getter", (_label, replacement, original) => {
    const store = canonicalStore.replace(original, replacement);

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("rejects a nested-block cursor getter shadow", () => {
    const store = canonicalStore.replace(
      `loadNextPage: async () => {
      const cursor = get().nextCursor;
      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);
    },`,
      `loadNextPage: async () => {
      {
        const get = fakeGet;
        const cursor = get().nextCursor;
        return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, cursor);
      }
    },`
    );

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("rejects a same-name top-level helper when the creator getter is renamed", () => {
    const store = `${canonicalStore
      .replace("(set, get) =>", "(set, readState) =>")
      .replace("get().nextCursor", "get().nextCursor")}
      function get() {
        return { nextCursor: null };
      }
    `;

    expect(violations(canonicalView, store)).toContain(
      "The next File Library V2 request must use a bounded page size and backend cursor."
    );
  });

  it("ignores an unrelated get binding in another function", () => {
    const store = `${canonicalStore}
      function unrelated() {
        const get = () => 123;
        return get();
      }
    `;

    expect(violations(canonicalView, store)).toEqual([]);
  });

  it("rejects a store query call that resolves to a local helper", () => {
    const store = canonicalStore.replace(
      "loadFirstPage: async () => executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, null),",
      "loadFirstPage: async () => {\n      function executeLibraryQuery() { return undefined; }\n      return executeLibraryQuery(spec, FILE_LIBRARY_V2_PAGE_SIZE, null);\n    },"
    );

    expect(violations(canonicalView, store)).toContain(
      "The first File Library V2 request must use a bounded page size and no cursor."
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

  it("rejects an unresolved JSX spread after the canonical load-more callback", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "const listProps = {};\n    return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} {...listProps} />;"
    );

    expect(violations(view)).toContain("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  });

  it("accepts a JSX spread before the canonical load-more callback", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "const listProps = {};\n    return <FileLibraryList {...listProps} onLoadMore={() => void loadNextPage().catch(() => undefined)} />;"
    );

    expect(violations(view)).toEqual([]);
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
    ],
    [
      "method alias introduced by assignment",
      "let queryDirectly;\n      queryDirectly = tauriApi.queryFileLibraryV2;\n      const handleLoadMore = () => {\n        loadNextPage();\n        queryDirectly({ pageSize: 50, cursor: null });\n      };"
    ],
    [
      "receiver alias introduced by assignment",
      "let api;\n      api = tauriApi;\n      const handleLoadMore = () => {\n        loadNextPage();\n        api[\"queryFileLibraryV2\"]({ pageSize: 50, cursor: null });\n      };"
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

  it("rejects a selector with a reachable foreign return", () => {
    const view = canonicalView.replace(
      "(state) => state.loadNextPage",
      "(state) => { if (useForeign) return other.loadNextPage; return state.loadNextPage; }"
    );

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
  });

  it("rejects a callback parameter that shadows the canonical store binding", () => {
    const view = viewWithCallback(
      "wrapper",
      "const wrapper = (loadNextPage = () => {}) => loadNextPage();"
    );

    expect(violations(view)).toContain(
      "Vault must pass loadNextPage to FileLibraryList.onLoadMore."
    );
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

  it("rejects a first-page call directly from the render body", () => {
    const view = canonicalView
      .replace(
        "useEffect(() => {\n      void loadFirstPage().catch(() => undefined);\n    }, [loadFirstPage]);",
        "loadFirstPage();"
      );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a first-page call in an unreachable effect", () => {
    const view = canonicalView.replace(
      "useEffect(() => {\n      void loadFirstPage().catch(() => undefined);\n    }, [loadFirstPage]);",
      "if (false) useEffect(() => void loadFirstPage(), [loadFirstPage]);"
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a first-page effect without a dependency array", () => {
    const view = canonicalView.replace(
      "useEffect(() => {\n      void loadFirstPage().catch(() => undefined);\n    }, [loadFirstPage]);",
      "useEffect(() => void loadFirstPage());"
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects a first-page effect with a recreated object dependency", () => {
    const view = canonicalView.replace("[loadFirstPage]);", "[{}]);");

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it.each([
    ["files", "files"],
    ["loading state", "isLoading"]
  ])("rejects a first-page effect driven by File Library result %s", (_label, dependency) => {
    const view = canonicalView
      .replace(
        "const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);",
        `const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
    const ${dependency} = useFileLibraryResultStore((state) => state.${dependency});`
      )
      .replace("[loadFirstPage]);", `[loadFirstPage, ${dependency}]);`);

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it.each([
    ["short-circuit", "false && loadFirstPage();"],
    ["conditional", "true ? undefined : loadFirstPage();"]
  ])("rejects a first-page call hidden behind an unreachable %s expression", (_label, expression) => {
    const view = canonicalView.replace(
      "useEffect(() => {\n      void loadFirstPage().catch(() => undefined);\n    }, [loadFirstPage]);",
      `useEffect(() => {\n      ${expression}\n    }, [loadFirstPage]);`
    );

    expect(violations(view)).toContain("Vault must request its first page through the canonical store.");
  });

  it("rejects frontend-owned fake cursors", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      "const [cursor, setCursor] = useState<string | null>(null);\n    return <FileLibraryList onLoadMore={() => void loadNextPage(cursor).catch(() => undefined)} />;"
    );

    expect(violations(view)).toContain("Vault must not own a frontend pagination cursor.");
  });

  it.each(["textCursorPosition", "selectionCursor"])("ignores ordinary UI state named %s", (name) => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `const ${name} = useState(0);
    return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;`
    );

    expect(violations(view)).toEqual([]);
  });

  it("ignores ordinary cursor-like state in a rendered local child", () => {
    const view = `${canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `return <>
        <SelectionChild />
        <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />
      </>;`
    )}
      function SelectionChild() {
        const selectionCursor = useState(0);
        return null;
      }`;

    expect(violations(view)).toEqual([]);
  });

  it("ignores cursor-named state in an unrelated component", () => {
    const view = `${canonicalView}
      function OtherView() {
        const [textCursor, setTextCursor] = useState<string | null>(null);
        return null;
      }
    `;

    expect(violations(view)).toEqual([]);
  });

  it("detects frontend cursor ownership in an invoked Vault helper", () => {
    const view = canonicalView.replace(
      "return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;",
      `function preparePage() {
        const pageCursor = null;
        loadNextPage(pageCursor);
      }
      preparePage();
      return <FileLibraryList onLoadMore={() => void loadNextPage().catch(() => undefined)} />;`
    );

    expect(violations(view)).toContain("Vault must not own a frontend pagination cursor.");
  });
});
