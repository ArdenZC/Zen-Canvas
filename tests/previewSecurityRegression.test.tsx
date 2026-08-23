import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseFolderSummaryPayload } from "../src/api/folderPreviewWire";
import {
  parseArchiveTreePayload,
  parseStructuredTreePayload,
  parseTablePayload
} from "../src/api/previewPayloadWire";
import { makeTranslator } from "../src/i18n";
import type {
  PreviewCapabilities,
  PreviewRepresentation,
  PreviewSnapshot
} from "../src/types/fileWorkspace";
import { renderPreviewBody } from "../src/views/fileLibrary/preview/PreviewContent";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

const t = makeTranslator("en");
const capabilities: PreviewCapabilities = {
  canSearch: false,
  canZoom: false,
  canPlayback: false,
  canSelectText: true,
  canNavigateInternal: false,
  canNavigateSiblings: false,
  canOpenExternal: false,
  canReveal: false,
  canRequestMaterialization: false
};

const source: PreviewSourceProjection = {
  key: "library:query:1:security-fixture",
  generation: "library:query:1",
  source: "library",
  previewSource: { kind: "managed", fileId: "security-fixture" },
  displayName: "security-fixture",
  entryKind: "file",
  extension: "txt"
};

function snapshot(representation: PreviewRepresentation): PreviewSnapshot {
  return {
    previewId: "preview-security",
    sessionId: "preview-security",
    requestId: "request-security",
    source: source.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: "version-security",
    representation: {
      sourceVersion: "version-security",
      representation,
      completeness: "complete",
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

function render(representation: PreviewRepresentation) {
  return renderToStaticMarkup(renderPreviewBody(
    "content",
    source,
    null,
    "en",
    t,
    snapshot(representation)
  ));
}

describe("W3-09 merged-provider renderer security harness", () => {
  it("keeps Markdown SafeHTML inside one resource-free backend-sanitized seam", () => {
    const html = render({
      family: "safe_html",
      html: "<h1>Sanitized Markdown</h1><p>remote image text: https://example.invalid/a.png</p>"
    });

    expect(html).toContain('data-preview-representation="safe_html"');
    expect(html).toContain("https://example.invalid/a.png");
    expect(html).not.toMatch(/<(?:script|iframe|object|embed)\b/i);
    expect(html).not.toMatch(/\s(?:src|href|action)=/i);
  });

  it("keeps Text/source output inert and never creates resource-bearing markup", () => {
    const html = render({
      family: "text",
      text: "fn main() { println!(\"literal <script> text\"); }",
      language: "rust"
    });

    expect(html).toContain('data-preview-representation="text"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<(?:script|img|iframe|object|embed)\b/i);
    expect(html).not.toMatch(/\s(?:src|href|action)=/i);
  });

  it("keeps JSON/YAML/XML tree values escaped and XML resource-free", () => {
    const encodedTree = JSON.stringify({
      schemaVersion: 1,
      format: "xml",
      root: {
        kind: "element",
        name: "root",
        attributes: [{ name: "data-kind", value: "inert" }],
        children: [
          { kind: "text", value: "<script>inert</script> https://example.invalid/remote" }
        ]
      },
      truncation: { depth: false, nodes: false, strings: false }
    });
    expect(parseStructuredTreePayload(encodedTree).format).toBe("xml");
    const html = render({ family: "structured_tree", encodedTree });

    expect(html).toContain('data-preview-structured-format="xml"');
    expect(html).toContain("&lt;script&gt;inert&lt;/script&gt;");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\s(?:src|href|action)=/i);
  });

  it("keeps CSV/TSV formula-looking cells literal and non-editable", () => {
    const encodedTable = JSON.stringify({
      schemaVersion: 1,
      format: "csv",
      columns: ["Name", "Value"],
      rows: [["sum", "=SUM(A1:A2)"], ["command", "@COMMAND"], ["plus", "+1+1"]],
      truncation: { rows: false, columns: false, cells: false }
    });
    expect(parseTablePayload(encodedTable).format).toBe("csv");
    const html = render({ family: "table", encodedTable });

    expect(html).toContain('data-preview-table-format="csv"');
    expect(html).toContain("=SUM(A1:A2)");
    expect(html).toContain("@COMMAND");
    expect(html).toContain("+1+1");
    expect(html).not.toContain("contenteditable");
    expect(html).not.toMatch(/\s(?:src|href|action)=/i);
  });

  it("keeps Image representation transport opaque to the textual renderer", () => {
    const html = render({ family: "image", assetToken: "opaque-image-token", mediaType: "image/png" });

    expect(html).toContain('data-preview-representation="image"');
    expect(html).not.toContain("file:");
    expect(html).not.toContain("C:\\");
    expect(html).not.toMatch(/\s(?:src|href|action)=/i);
  });

  it("keeps FolderSummary and ArchiveTree names inert and resource-free", () => {
    const folderPayload = {
      version: 1,
      folderName: "<script>alert(1)",
      progress: { inspectedEntries: 1, acceptedChildren: 1, state: "complete", limitReason: null },
      sample: [{ name: "<img src=attacker>", kind: "file", extension: "txt", sizeBytes: 1 }],
      kindCounts: { files: 1, directories: 0, other: 0 },
      extensionCounts: [{ extension: "txt", count: 1 }],
      sizeProgress: { observedBytes: 1, knownSizeEntries: 1 },
      largestObserved: [{ name: "<img src=secret>", sizeBytes: 1 }],
      projectHints: ["javascript:alert(1)", "data:text-html,blocked", "blob:opaque-token"]
    };
    const folderHtml = render({ family: "folder_summary", encodedSummary: JSON.stringify(folderPayload) });
    expect(parseFolderSummaryPayload(JSON.stringify(folderPayload)).progress.state).toBe("complete");
    expect(folderHtml).toContain("&lt;script&gt;alert(1)");
    expect(folderHtml).toContain("&lt;img src=attacker&gt;");
    expect(folderHtml).not.toMatch(/<(?:script|img|iframe|object|embed|a)\b/i);
    expect(folderHtml).not.toMatch(/<[^>]+\s(?:src|href|action)=/i);

    const archivePayload = {
      version: 1,
      format: "zip",
      progress: { inspectedEntries: 4, state: "complete", limitReason: null },
      totals: {
        entriesObserved: 4,
        filesObserved: 4,
        directoriesObserved: 0,
        compressedBytesObserved: 0,
        uncompressedBytesDeclaredObserved: 0
      },
      root: {
        kind: "directory",
        name: "",
        children: [
          { kind: "file", name: "..\\secret.txt", unsafeName: true },
          { kind: "file", name: "C:\\absolute.txt", unsafeName: true },
          { kind: "file", name: "//server/share/payload", unsafeName: true },
          { kind: "file", name: "<script>alert(1)</script>", unsafeName: true }
        ]
      },
      warnings: ["unsafe_name"]
    };
    const archiveHtml = render({ family: "archive_tree", encodedTree: JSON.stringify(archivePayload) });
    expect(parseArchiveTreePayload(JSON.stringify(archivePayload)).progress.state).toBe("complete");
    expect(archiveHtml).toContain("..\\secret.txt");
    expect(archiveHtml).toContain("C:\\absolute.txt");
    expect(archiveHtml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(archiveHtml).not.toMatch(/<(?:script|img|iframe|object|embed|a)\b/i);
    expect(archiveHtml).not.toMatch(/<[^>]+\s(?:src|href|action)=/i);
  });

  it("fails closed when FolderSummary or ArchiveTree payloads try to add path/resource fields", () => {
    const folderPayload = {
      version: 1,
      folderName: "folder",
      progress: { inspectedEntries: 0, acceptedChildren: 0, state: "complete", limitReason: null },
      sample: [],
      kindCounts: { files: 0, directories: 0, other: 0 },
      extensionCounts: [],
      sizeProgress: { observedBytes: 0, knownSizeEntries: 0 },
      largestObserved: [],
      projectHints: []
    };
    expect(() => parseFolderSummaryPayload(JSON.stringify({ ...folderPayload, path: "C:\\secret" })))
      .toThrow("preview_folder_payload_unknown_field");

    const archivePayload = {
      version: 1,
      format: "zip",
      progress: { inspectedEntries: 1, state: "complete", limitReason: null },
      totals: {
        entriesObserved: 1,
        filesObserved: 1,
        directoriesObserved: 0,
        compressedBytesObserved: 1,
        uncompressedBytesDeclaredObserved: 1
      },
      root: {
        kind: "directory",
        name: "",
        children: [{ kind: "file", name: "safe.txt", path: "C:\\secret" }]
      },
      warnings: []
    };
    expect(() => parseArchiveTreePayload(JSON.stringify(archivePayload)))
      .toThrow("preview_payload_unknown_field");
  });
});
