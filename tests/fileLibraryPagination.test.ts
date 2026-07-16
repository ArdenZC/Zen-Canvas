import { describe, expect, it, vi } from "vitest";
import type { FileQueryResult, FileRecord } from "../src/types/domain";
import { LIBRARY_COLLECTION_MAX_FILES, LIBRARY_COLLECTION_MAX_PAGES, collectLibraryPages } from "../src/views/vault/fileLibraryModel";

function file(id: string): FileRecord {
  return { id, name: `${id}.txt` } as FileRecord;
}

function page(offset: number, ids: string[], total: number): FileQueryResult {
  return { offset, limit: 50, total, files: ids.map(file) };
}

describe("bounded file-library pagination", () => {
  it("increments from the loaded offset and combines unique pages", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(2, ["c", "d"], 4));
    const result = await collectLibraryPages(page(0, ["a", "b"], 4), fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(2);
    expect(result?.complete).toBe(true);
    expect(result?.page.files.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("stops a repeated page instead of looping or duplicating rows", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(0, ["a", "b"], 100));
    const result = await collectLibraryPages(page(0, ["a", "b"], 100), fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ complete: false });
    expect(result?.page.files.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("honors request invalidation before publishing a later page", async () => {
    const onPage = vi.fn();
    const result = await collectLibraryPages(
      page(0, ["a"], 2),
      vi.fn().mockResolvedValue(page(1, ["b"], 2)),
      onPage,
      () => false
    );

    expect(result).toBeNull();
    expect(onPage).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit page and entry safety bounds", () => {
    expect(LIBRARY_COLLECTION_MAX_PAGES).toBeGreaterThan(1);
    expect(LIBRARY_COLLECTION_MAX_PAGES).toBeLessThanOrEqual(200);
    expect(LIBRARY_COLLECTION_MAX_FILES).toBeGreaterThan(50);
    expect(LIBRARY_COLLECTION_MAX_FILES).toBeLessThanOrEqual(10_000);
  });
});
