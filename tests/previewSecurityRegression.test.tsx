import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseStructuredTreePayload, parseTablePayload } from "../src/api/previewPayloadWire";
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
});
