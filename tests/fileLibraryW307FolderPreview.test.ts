import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Translator } from "../src/types/ui";
import type { PreviewCapabilities, PreviewRepresentation, PreviewSnapshot } from "../src/types/fileWorkspace";
import {
  parseFolderSummaryPayload,
  type FolderSummaryPayloadV1
} from "../src/api/folderPreviewWire";
import { renderPreviewBody } from "../src/views/fileLibrary/preview/PreviewContent";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

const capabilities: PreviewCapabilities = {
  canSearch: false,
  canZoom: false,
  canPlayback: false,
  canSelectText: false,
  canNavigateInternal: false,
  canNavigateSiblings: false,
  canOpenExternal: false,
  canReveal: false,
  canRequestMaterialization: false
};

const source: PreviewSourceProjection = {
  key: "browse:session-1:folder-1",
  generation: "browse:session-1",
  source: "browse",
  previewSource: { kind: "ephemeral", browseSessionId: "session-1", entryId: "folder-1" },
  displayName: "fixture-folder",
  entryKind: "directory"
};

const t = ((key: string) => key) as Translator;

function payload(overrides: Partial<FolderSummaryPayloadV1> = {}): FolderSummaryPayloadV1 {
  return {
    version: 1,
    folderName: "fixture-folder",
    progress: {
      inspectedEntries: 2,
      acceptedChildren: 2,
      state: "complete",
      limitReason: null
    },
    sample: [
      { name: "README.md", kind: "file", extension: "md", sizeBytes: 128 },
      { name: "src", kind: "directory", extension: null, sizeBytes: null }
    ],
    kindCounts: { files: 1, directories: 1, other: 0 },
    extensionCounts: [{ extension: "md", count: 1 }],
    sizeProgress: { observedBytes: 128, knownSizeEntries: 1 },
    largestObserved: [{ name: "README.md", sizeBytes: 128 }],
    projectHints: ["README"],
    ...overrides
  };
}

function snapshot(encodedSummary: string, completeness: "complete" | "partial" = "complete"): PreviewSnapshot {
  const representation: PreviewRepresentation = { family: "folder_summary", encodedSummary };
  return {
    previewId: "preview-folder",
    sessionId: "preview-folder",
    requestId: "request-folder",
    source: source.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: "folder-version",
    representation: {
      sourceVersion: "folder-version",
      representation,
      completeness,
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

describe("W3-07 Folder Preview wire and shared renderer", () => {
  it("decodes a complete empty folder and renders no fabricated child content", () => {
    const empty = payload({
      folderName: "empty-folder",
      progress: { inspectedEntries: 0, acceptedChildren: 0, state: "complete", limitReason: null },
      sample: [],
      kindCounts: { files: 0, directories: 0, other: 0 },
      extensionCounts: [],
      sizeProgress: { observedBytes: 0, knownSizeEntries: 0 },
      largestObserved: [],
      projectHints: []
    });
    expect(parseFolderSummaryPayload(JSON.stringify(empty)).progress.state).toBe("complete");
    const html = renderToStaticMarkup(renderPreviewBody("content", source, null, "en", t, snapshot(JSON.stringify(empty))));
    expect(html).toContain('data-preview-representation="folder_summary"');
    expect(html).toContain('data-preview-folder-state="complete"');
    expect(html).toContain("empty-folder");
    expect(html).toContain("previewFolderNoEntries");
    expect(html).not.toContain("C:\\");
    expect(html).not.toContain("file://");
  });

  it("keeps a bounded 100k-entry result visibly Partial", () => {
    const partial = payload({
      progress: { inspectedEntries: 100_000, acceptedChildren: 100_000, state: "partial", limitReason: "entry_limit" },
      sample: Array.from({ length: 32 }, (_, index) => ({ name: `file-${index}.txt`, kind: "file" as const, extension: "txt", sizeBytes: index })),
      kindCounts: { files: 90_000, directories: 10_000, other: 0 },
      extensionCounts: [{ extension: "txt", count: 90_000 }],
      sizeProgress: { observedBytes: 89_999, knownSizeEntries: 90_000 },
      largestObserved: Array.from({ length: 10 }, (_, index) => ({ name: `file-${index}.txt`, sizeBytes: 100_000 - index })),
      projectHints: ["Node.js project", "README"]
    });
    const decoded = parseFolderSummaryPayload(JSON.stringify(partial));
    expect(decoded.progress.limitReason).toBe("entry_limit");
    const html = renderToStaticMarkup(renderPreviewBody("content", source, null, "en", t, snapshot(JSON.stringify(partial), "partial")));
    expect(html).toContain('data-preview-completeness="partial"');
    expect(html).toContain('data-preview-limit-reason="entry_limit"');
    expect(html).toContain('data-preview-partial="true"');
    expect(html).toContain("100,000");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<a ");
  });

  it("rejects unknown fields, invalid counts, inconsistent totals, and oversized arrays", () => {
    const good = JSON.stringify(payload());
    expect(() => parseFolderSummaryPayload(good.replace('"version":1', '"version":2'))).toThrow("preview_folder_summary_version_invalid");
    expect(() => parseFolderSummaryPayload(good.replace('"folderName":"fixture-folder"', '"folderName":"fixture-folder","path":"C:\\\\secret"'))).toThrow("preview_folder_payload_unknown_field");
    expect(() => parseFolderSummaryPayload(good.replace('"acceptedChildren":2', '"acceptedChildren":-1'))).toThrow("preview_folder_progress_invalid");
    expect(() => parseFolderSummaryPayload(good.replace('"files":1', '"files":2'))).toThrow("preview_folder_summary_counts_invalid");
    expect(() => parseFolderSummaryPayload(JSON.stringify(payload({
      sample: Array.from({ length: 33 }, (_, index) => ({ name: String(index), kind: "file", extension: "txt", sizeBytes: 1 }))
    })))).toThrow("preview_folder_sample_bound_exceeded");
  });
});
