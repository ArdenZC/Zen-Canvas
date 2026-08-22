import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Translator } from "../src/types/ui";
import type { PreviewCapabilities, PreviewRepresentation, PreviewSnapshot } from "../src/types/fileWorkspace";
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
  displayName: "README.md",
  entryKind: "file",
  extension: "md"
};

const t = ((key: string) => key) as Translator;

function snapshot(representation: PreviewRepresentation | undefined, completeness: "complete" | "partial" = "complete"): PreviewSnapshot {
  return {
    previewId: "preview-1",
    sessionId: "preview-1",
    requestId: "request-1",
    source: source.previewSource,
    hostKind: "zen_floating",
    state: "ready",
    sourceVersion: "version-1",
    representation: representation === undefined ? undefined : {
      sourceVersion: "version-1",
      representation,
      completeness,
      warnings: [],
      capabilities
    },
    effectiveCapabilities: capabilities
  };
}

describe("W3-04 shared Preview representation renderer", () => {
  it("renders bounded selectable Text with language and Partial disclosure", () => {
    const html = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      snapshot({ family: "text", text: "fn main() {\n  世界\n}", language: "rust" }, "partial")
    ));

    expect(html).toContain('data-preview-representation="text"');
    expect(html).toContain('data-preview-completeness="partial"');
    expect(html).toContain('data-preview-selectable="true"');
    expect(html).toContain("rust");
    expect(html).toContain("previewPartialContent");
    expect(html).toContain("世界");
    expect(html).not.toContain("textarea");
    expect(html).not.toContain("contenteditable");
  });

  it("renders only the typed SafeHTML seam inside one contained root", () => {
    const html = renderToStaticMarkup(renderPreviewBody(
      "content",
      source,
      null,
      "en",
      t,
      snapshot({ family: "safe_html", html: "<h1>Safe</h1><p>Markdown body</p>" })
    ));

    expect(html).toContain('data-preview-representation="safe_html"');
    expect(html).toContain('class="zc-preview-safe-html-root"');
    expect(html).toContain("<h1>Safe</h1>");
    expect(html).toContain("Markdown body");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("src=");
    expect(html).not.toContain("href=");
  });

  it("keeps no-source state independent of stale representation data", () => {
    const html = renderToStaticMarkup(renderPreviewBody(
      "no_source",
      null,
      null,
      "en",
      t,
      snapshot({ family: "text", text: "stale", language: null })
    ));

    expect(html).toContain('data-preview-no-source="true"');
    expect(html).not.toContain("stale");
    expect(html).not.toContain("data-preview-representation");
  });
});
