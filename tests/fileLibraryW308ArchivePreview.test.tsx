import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Translator } from "../src/types/ui";
import type { PreviewCapabilities, PreviewRepresentation, PreviewSnapshot } from "../src/types/fileWorkspace";
import {
  parseArchiveTreePayload,
  MAX_ARCHIVE_TREE_CHILDREN,
  MAX_ARCHIVE_TREE_DEPTH
} from "../src/api/previewPayloadWire";
import { renderPreviewBody } from "../src/views/fileLibrary/preview/PreviewContent";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

const capabilities: PreviewCapabilities = {
  canSearch: false,
  canZoom: false,
  canPlayback: false,
  canSelectText: false,
  canNavigateInternal: false,
  canNavigateSiblings: true,
  canOpenExternal: false,
  canReveal: false,
  canRequestMaterialization: false
};

const source: PreviewSourceProjection = {
  key: "library:query:1:file-zip",
  generation: "library:query:1",
  source: "library",
  previewSource: { kind: "managed", fileId: "file-zip" },
  displayName: "fixture.zip",
  entryKind: "file",
  extension: "zip"
};

const t = ((key: string) => key) as Translator;

function snapshot(representation: PreviewRepresentation, completeness: "complete" | "partial" = "complete"): PreviewSnapshot {
  return {
    previewId: "preview-zip",
    sessionId: "preview-zip",
    requestId: "request-zip",
    source: source.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: "zip-version-1",
    representation: {
      sourceVersion: "zip-version-1",
      representation,
      completeness,
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

function archivePayload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    format: "zip",
    progress: { inspectedEntries: 2, state: "complete", limitReason: null },
    totals: {
      entriesObserved: 2,
      filesObserved: 1,
      directoriesObserved: 1,
      compressedBytesObserved: 12,
      uncompressedBytesDeclaredObserved: 24
    },
    root: {
      kind: "directory",
      name: "",
      children: [
        {
          kind: "directory",
          name: "docs",
          children: [
            {
              kind: "file",
              name: "readme.txt",
              compressedSize: 12,
              uncompressedSizeDeclared: 24,
              compressionMethod: "Deflated",
              encrypted: false
            }
          ]
        }
      ]
    },
    warnings: [],
    ...overrides
  };
}

function representation(payload: unknown): PreviewRepresentation {
  return { family: "archive_tree", encodedTree: JSON.stringify(payload) };
}

describe("W3-08 ZIP archive Preview", () => {
  it("strictly decodes the bounded ArchiveTreePayloadV1 and renders one inert shared tree", () => {
    const payload = parseArchiveTreePayload(JSON.stringify(archivePayload()));
    expect(payload.version).toBe(1);
    expect(payload.format).toBe("zip");
    expect(payload.root.children?.[0].name).toBe("docs");

    const html = renderToStaticMarkup(renderPreviewBody("content", source, null, "en", t, snapshot(representation(archivePayload()))));
    expect(html).toContain('data-preview-representation="archive_tree"');
    expect(html).toContain('data-preview-archive-state="complete"');
    expect(html).toContain("readme.txt");
    expect(html).toContain("previewArchiveComplete");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("src=");
    expect(html).not.toMatch(/<a(?:\s|>)/);
    expect(html).not.toContain("<img");
  });

  it("keeps hostile names visibly inert and discloses Partial truth", () => {
    const payload = archivePayload({
      progress: { inspectedEntries: 1, state: "partial", limitReason: "entry_limit" },
      totals: { entriesObserved: 1, filesObserved: 1, directoriesObserved: 0, compressedBytesObserved: 4, uncompressedBytesDeclaredObserved: 4 },
      root: {
        kind: "directory",
        name: "",
        children: [{ kind: "file", name: "..\\secret.txt", unsafeName: true, compressedSize: 4, uncompressedSizeDeclared: 4, compressionMethod: "Stored" }]
      },
      warnings: ["unsafe_name", "entry_limit"]
    });
    expect(parseArchiveTreePayload(JSON.stringify(payload)).progress.limitReason).toBe("entry_limit");
    const html = renderToStaticMarkup(renderPreviewBody("content", source, null, "en", t, snapshot(representation(payload), "partial")));
    expect(html).toContain('data-preview-archive-state="partial"');
    expect(html).toContain('data-preview-archive-unsafe="true"');
    expect(html).toContain("..\\secret.txt");
    expect(html).toContain("previewArchiveUnsafeName");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("src=");
  });

  it("fails closed on unknown fields, invalid progress, and depth/node/child bounds", () => {
    const good = archivePayload();
    expect(() => parseArchiveTreePayload(JSON.stringify({ ...good, extra: true }))).toThrow("preview_payload_unknown_field");
    expect(() => parseArchiveTreePayload(JSON.stringify({
      ...good,
      progress: { inspectedEntries: 2, state: "complete", limitReason: "entry_limit" }
    }))).toThrow("preview_archive_progress_truth_invalid");

    const tooManyChildren = Array.from({ length: MAX_ARCHIVE_TREE_CHILDREN + 1 }, (_, index) => ({ kind: "file", name: `f-${index}` }));
    expect(() => parseArchiveTreePayload(JSON.stringify({
      ...good,
      root: { kind: "directory", name: "", children: tooManyChildren }
    }))).toThrow("preview_archive_children_bound_exceeded");

    let deep: Record<string, unknown> = { kind: "file", name: "leaf" };
    for (let index = 0; index <= MAX_ARCHIVE_TREE_DEPTH; index += 1) {
      deep = { kind: "directory", name: `d-${index}`, children: [deep] };
    }
    expect(() => parseArchiveTreePayload(JSON.stringify({
      ...good,
      progress: { inspectedEntries: 0, state: "partial", limitReason: "tree_limit" },
      totals: { entriesObserved: 0, filesObserved: 0, directoriesObserved: 0, compressedBytesObserved: 0, uncompressedBytesDeclaredObserved: 0 },
      root: deep,
      warnings: ["tree_limit"]
    }))).toThrow("preview_archive_depth_exceeded");

    const tooManyNodes = Array.from({ length: 32 }, (_, directoryIndex) => ({
      kind: "directory",
      name: `d-${directoryIndex}`,
      children: Array.from({ length: 64 }, (_, fileIndex) => ({ kind: "file", name: `f-${fileIndex}` }))
    }));
    expect(() => parseArchiveTreePayload(JSON.stringify({
      ...good,
      progress: { inspectedEntries: 2080, state: "partial", limitReason: "tree_limit" },
      totals: { entriesObserved: 2080, filesObserved: 2048, directoriesObserved: 32, compressedBytesObserved: 0, uncompressedBytesDeclaredObserved: 0 },
      root: { kind: "directory", name: "", children: tooManyNodes },
      warnings: ["tree_limit"]
    }))).toThrow("preview_archive_nodes_exceeded");
  });
});
