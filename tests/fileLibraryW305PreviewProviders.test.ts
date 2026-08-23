import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Translator } from "../src/types/ui";
import type { PreviewCapabilities, PreviewRepresentation, PreviewSnapshot } from "../src/types/fileWorkspace";
import { parseStructuredTreePayload, parseTablePayload } from "../src/api/previewPayloadWire";
import { renderPreviewBody } from "../src/views/fileLibrary/preview/PreviewContent";
import type { PreviewSourceProjection } from "../src/views/fileLibrary/preview/previewSource";

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
  key: "library:query:1:file-1",
  generation: "library:query:1",
  source: "library",
  previewSource: { kind: "managed", fileId: "file-1" },
  displayName: "sample.json",
  entryKind: "file",
  extension: "json"
};

const t = ((key: string) => key) as Translator;

function snapshot(representation: PreviewRepresentation, completeness: "complete" | "partial" = "complete"): PreviewSnapshot {
  return {
    previewId: "preview-1",
    sessionId: "preview-1",
    requestId: "request-1",
    source: source.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: "version-1",
    representation: {
      sourceVersion: "version-1",
      representation,
      completeness,
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

function structured(format: "json" | "yaml" | "xml", root: unknown, truncation = { depth: false, nodes: false, strings: false }): PreviewRepresentation {
  return {
    family: "structured_tree",
    encodedTree: JSON.stringify({ schemaVersion: 1, format, root, truncation })
  };
}

function table(format: "csv" | "tsv", rows: string[][], truncation = { rows: false, columns: false, cells: false }): PreviewRepresentation {
  return {
    family: "table",
    encodedTable: JSON.stringify({ schemaVersion: 1, format, columns: ["Name", "Value"], rows, truncation })
  };
}

describe("W3-05 structured and table preview wire", () => {
  it("strictly decodes the frozen structured payload and renders JSON/YAML/XML as inert text", () => {
    const root = {
      kind: "object",
      entries: [
        { key: "name", value: { kind: "scalar", scalarType: "string", value: "Zen Canvas" } },
        { key: "xml", value: { kind: "element", name: "message", attributes: [], children: [{ kind: "text", value: "<script>inert</script>" }] } }
      ]
    };
    const encoded = (structured("json", root) as Extract<PreviewRepresentation, { family: "structured_tree" }>).encodedTree;
    expect(parseStructuredTreePayload(encoded).schemaVersion).toBe(1);
    const html = renderToStaticMarkup(renderPreviewBody("content", source, null, "en", t, snapshot(structured("xml", root))));
    expect(html).toContain('data-preview-representation="structured_tree"');
    expect(html).toContain('data-preview-structured-format="xml"');
    expect(html).toContain("&lt;script&gt;inert&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Zen Canvas");
  });

  it("renders CSV/TSV cells literally, including formula-looking values and ragged rows", () => {
    const html = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      snapshot(table("csv", [["alpha", "=SUM(A1:A2)"], ["ragged", "+1+1", "extra"], ["literal", "@COMMAND"]]))
    ));
    expect(html).toContain('data-preview-representation="table"');
    expect(html).toContain('data-preview-table-format="csv"');
    expect(html).toContain("=SUM(A1:A2)");
    expect(html).toContain("+1+1");
    expect(html).toContain("@COMMAND");
    expect(html).not.toContain("contenteditable");
    expect(parseTablePayload((table("tsv", [["one", "1"]]) as Extract<PreviewRepresentation, { family: "table" }>).encodedTable).format).toBe("tsv");
  });

  it("discloses Partial from either the envelope or payload truncation flags", () => {
    const html = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      snapshot(table("csv", [["loaded", "value"]], { rows: true, columns: false, cells: false }), "complete")
    ));
    expect(html).toContain('data-preview-completeness="complete"');
    expect(html).toContain('data-preview-partial="true"');

    const structuredHtml = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      snapshot(structured("json", { kind: "array", items: [] }, { depth: false, nodes: true, strings: false }), "partial")
    ));
    expect(structuredHtml).toContain('data-preview-representation="structured_tree"');
    expect(structuredHtml).toContain('data-preview-partial="true"');
  });

  it("fails closed on schema, unknown fields, and bounded payload violations", () => {
    const good = JSON.stringify({
      schemaVersion: 1,
      format: "json",
      root: { kind: "scalar", scalarType: "string", value: "ok" },
      truncation: { depth: false, nodes: false, strings: false }
    });
    expect(() => parseStructuredTreePayload(good.replace('"schemaVersion":1', '"schemaVersion":2'))).toThrow("preview_tree_schema_invalid");
    expect(() => parseStructuredTreePayload(good.replace('"value":"ok"', '"value":"ok","path":"C:\\\\secret"'))).toThrow("preview_payload_unknown_field");
    expect(() => parseTablePayload(JSON.stringify({
      schemaVersion: 1,
      format: "csv",
      columns: ["x"],
      rows: [["x".repeat(16 * 1024 + 1)]],
      truncation: { rows: false, columns: false, cells: false }
    }))).toThrow("preview_table_row_invalid");
  });
});
