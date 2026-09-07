import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("TD-001-P0 legacy store consumers", () => {
  it("keeps FileLibraryList page-size copy owned by Query V2 at 50", () => {
    const list = read("src/views/vault/components/FileLibraryList.tsx");
    const v2Store = read("src/store/useFileLibraryV2Store.ts");

    expect(list).toContain('import { FILE_LIBRARY_V2_PAGE_SIZE } from "../../../store/useFileLibraryV2Store";');
    expect(list).not.toContain('from "../../../store/useFileLibraryStore"');
    expect(list).toContain("remainingDisplayCount = Math.min(FILE_LIBRARY_V2_PAGE_SIZE, remainingCount)");
    expect(v2Store).toContain("export const FILE_LIBRARY_V2_PAGE_SIZE = 50;");
  });

  it("has no useFileLibraryStore reference in the operation queue store", () => {
    expect(read("src/store/useOperationQueueStore.ts")).not.toContain("useFileLibraryStore");
  });
});
