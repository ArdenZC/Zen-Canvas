import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultFileLibraryQuerySpec } from "../src/store/useFileLibraryV2Store";
import type { FileLibrarySummary } from "../src/types/domain";
import { adaptLibraryCollection } from "../src/views/fileLibrary/presentation/adapters";
import { libraryPresentationEntryAt } from "../src/views/fileLibrary/library/librarySourceOwner";

const read = (path: string) => readFileSync(resolve(path), "utf8");

function summary(id: string): FileLibrarySummary {
  return {
    id,
    name: `${id}.txt`,
    extension: "txt",
    displayDirectory: "C:/Library",
    size: 12,
    modifiedAt: 7,
    createdAt: 6,
    isDirectory: false,
    fileType: "Document",
    purpose: "Work",
    lifecycle: "Active",
    risk: "Low",
    confidence: 1,
    isDuplicate: false,
    requiresReview: false,
    isStale: false,
    tags: [],
    tagCount: 0
  };
}

describe("W2-03 Library source-owner migration contracts", () => {
  it("replaces the whole Vault handoff with a concrete Library source slot", () => {
    const workspace = read("src/views/fileLibrary/FileLibraryWorkspace.tsx");
    const mode = read("src/views/fileLibrary/library/LibraryMode.tsx");

    expect(workspace).toContain('import("./library/LibraryMode")');
    expect(workspace).toContain('data-library-migration-adapter="library-source-owner"');
    expect(workspace).not.toContain("LegacyVaultView");
    expect(workspace).not.toContain('import("../vault/VaultView")');
    expect(workspace).not.toContain('presentation="embedded"');
    expect(mode).toContain("useLibrarySourceOwner");
    expect(mode).toContain("useLibraryContentCompatibility");
    expect(mode).toContain('data-library-source-owner="query-v2"');
    expect(mode).toContain('data-library-selection-authority="library-selection-v1"');
    expect(mode).toContain("h-full min-h-0 max-[1100px]:min-h-[340px]");
    expect(mode.split(/\r?\n/u).length).toBeLessThan(500);
  });

  it("coalesces existing authorities without introducing a second query or selection store", () => {
    const owner = read("src/views/fileLibrary/library/librarySourceOwner.ts");
    const mode = read("src/views/fileLibrary/library/LibraryMode.tsx");

    expect(owner).toContain("useFileLibraryQueryStore");
    expect(owner).toContain("useFileLibrarySelectionStore");
    expect(owner).toContain("useFileLibraryInspectorStore");
    expect(owner).toContain("useOperationQueueStore");
    expect(owner).toContain("useFileLibrarySavedViewStore");
    expect(owner).toContain("useFileLibraryTagStore");
    expect(owner).toContain("adaptLibraryCollection");
    expect(owner).toContain("adaptLibrarySummary");
    expect(owner).toContain("selectAllMatching");
    expect(owner).toContain("refreshPreviewsForSelection");
    expect(owner).toContain("commitDetailIfCurrent");
    expect(owner).not.toMatch(/create\s*\(/);
    expect(owner).not.toMatch(/create\s*<[^>]+>\s*\(/);
    expect(mode).toContain("tauriApi.revealFileLibraryEntry");
    expect(mode).toContain("refreshPreviewsForSelection");
    expect(mode).not.toContain("usePresentationSelectionStore");
    expect(mode).not.toContain("SharedFocusManager");
  });

  it("adapts only the mounted result window and keeps all_matching compact", () => {
    const owner = read("src/views/fileLibrary/library/librarySourceOwner.ts");
    const list = read("src/views/vault/components/FileLibraryList.tsx");
    const adapters = read("src/views/fileLibrary/presentation/adapters.ts");

    expect(owner).toContain("const summary = files[index]");
    expect(owner).toContain("never touches LibrarySelectionV1's all_matching IDs");
    expect(list).toContain("getPresentationEntry?.(virtualRow.index)");
    expect(list).toContain("presentationEntry={presentationEntry}");
    expect(adapters).toContain("export function adaptLibrarySummary");
    expect(adapters).toContain("export function adaptLibraryCollection");
    expect(adapters).not.toMatch(/all_matching.*fileIds|fileIds.*all_matching/i);
  });

  it("keeps Browse and the standalone legacy compatibility surface outside this migration", () => {
    const owner = read("src/views/fileLibrary/library/librarySourceOwner.ts");
    const mode = read("src/views/fileLibrary/library/LibraryMode.tsx");
    const vault = read("src/views/vault/VaultView.tsx");

    expect(owner).not.toContain("Browse");
    expect(mode).not.toContain("Browse");
    expect(vault).toContain('presentation = "standalone"');
    expect(vault).toContain("FileLibraryPreviewDialog");
    expect(vault).toContain("revealFileLibraryEntry");
  });

  it("preserves Library selection across mode remounts while keeping standalone Vault defaults", () => {
    const owner = read("src/views/fileLibrary/library/librarySourceOwner.ts");
    const controller = read("src/views/vault/controllers/useVaultQueryController.ts");

    expect(owner).toContain("clearSelectionOnMount: false");
    expect(controller).toContain("clearSelectionOnMount = true");
    expect(controller).toContain("selectionBoundaryChanged");
  });

  it("keeps collection provenance at source scope and adapts only the requested result window", () => {
    const collection = adaptLibraryCollection({ queryFingerprint: "fp-w203", snapshotRevision: 9 }, defaultFileLibraryQuerySpec);
    expect(collection).toEqual({
      source: "library",
      provenance: {
        queryFingerprint: "fp-w203",
        snapshotRevision: 9,
        query: defaultFileLibraryQuerySpec
      }
    });

    const accesses: string[] = [];
    const logicalFiles = new Proxy(
      { length: 100_000, 99_999: summary("window-row") } as unknown as FileLibrarySummary[],
      {
        get(target, property, receiver) {
          accesses.push(String(property));
          return Reflect.get(target, property, receiver);
        }
      }
    );
    const entry = libraryPresentationEntryAt(logicalFiles, 99_999);

    expect(entry?.entryRef).toEqual({ kind: "managed", fileId: "window-row" });
    expect(entry?.renderKey).toContain("window-row");
    expect(accesses).toEqual(["99999"]);
  });
});
