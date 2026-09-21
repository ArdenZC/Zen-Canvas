import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8").replace(/\r\n?/gu, "\n");

describe("W6-09 Quick Preview visual remediation contracts", () => {
  it("keeps the canonical surface presentation quiet and truthful", () => {
    const surface = read("src/views/fileLibrary/preview/ZenQuickPreviewSurface.tsx");
    const content = read("src/views/fileLibrary/preview/PreviewContent.tsx");
    const floating = read("src/views/fileLibrary/preview/ZenFloatingQuickPreview.tsx");
    const styles = read("src/views/fileLibrary/preview/zenFloatingQuickPreview.css");
    const tokens = read("src/styles/tokens.css");

    expect(surface).toContain('data-preview-details-facts="true"');
    expect(surface).toContain("previewMaterializationLabel");
    expect(surface).toContain('data-preview-reveal="true"');
    expect(surface).toContain("setDetailsOpen");
    expect(surface).not.toContain("QuickPreviewFooter");
    expect(floating).toContain("initialFocusRef={surfaceRef}");
    expect(surface).toContain("tabIndex={-1}");
    expect(surface).not.toContain('t("libraryPreviewClose")}</button>');
    expect(content).not.toContain('className="zc-quick-preview-facts"');
    expect(content).not.toContain('t("previewMarkdownContent")');
    expect(content).not.toContain('<span>{t("libraryPreviewImage")}</span>');
    expect(content).toContain("TriangleAlert");
    expect(styles).toContain("background: transparent;");
    expect(styles).not.toContain(".zc-quick-preview-footer-status");
    expect(styles).not.toContain(".zc-quick-preview-footer");
    expect(styles).not.toContain("content-visibility: auto");
    expect(styles).toContain('[data-density="compact"] .zc-quick-preview-card');
    expect(styles).toContain("background: var(--zc-surface-overlay);");
    expect(styles).toContain("box-shadow: var(--zc-shadow-float);");
    expect(styles).not.toContain("--zc-glass-");
    expect(styles).not.toContain("backdrop-filter");
    expect(tokens).not.toContain("--zc-glass-");
    expect(styles).toContain("place-items: center;");
    expect(styles).toContain("forced-colors");
  });

  it("marks PDF pages only after a settled near-viewport render", () => {
    const renderer = read("src/views/fileLibrary/preview/renderers/PdfPreviewRenderer.tsx");

    expect(renderer).toContain("useMemo(");
    expect(renderer).toContain('setRenderState("rendering")');
    expect(renderer).toContain('setRenderState("rendered")');
    expect(renderer).toContain('data-preview-pdf-page-state={pageState}');
    expect(renderer).toContain(": !nearViewport");
    expect(renderer).toContain("pageRequestRef");
    expect(renderer).toContain("Do not cancel this request when the page briefly leaves the nearby");
    expect(renderer).toContain("const shouldRenderCanvas = nearViewport");
    expect(renderer).not.toContain("}, [nearViewport, page, viewport]);");
    expect(renderer).not.toContain("!visible || !nearViewport");
  });

  it("keeps PDF loading to one concise progress label", () => {
    const renderer = read("src/views/fileLibrary/preview/renderers/PdfPreviewRenderer.tsx");

    expect(renderer).toContain('if (status === "loading")');
    expect(renderer).toContain("<LoaderCircle className=\"animate-spin\"");
    expect(renderer).toContain('data-preview-pdf-message={status} role="status"');
  });
});
