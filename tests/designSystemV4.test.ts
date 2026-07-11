import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const path = join(root, relativePath);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function tokenValue(source: string, name: string) {
  return source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim() ?? "";
}

describe("Design Foundation v4", () => {
  const styles = read("src/styles.css");
  const tokens = read("src/styles/tokens.css");
  const tw = read("src/utils/tw.ts");
  const brandMark = read("src/components/ui/BrandMark.tsx");
  const shellChrome = read("src/components/ShellChrome.tsx");

  it("defines the required light semantic tokens and imports them globally", () => {
    expect(tokens).toContain("--zc-canvas: #f4f6f9");
    expect(tokens).toContain("--zc-surface: #ffffff");
    expect(tokens).toContain("--zc-primary: #007aff");
    expect(styles).toContain('@import "./styles/tokens.css"');
  });

  it("defines an independent dark theme with distinct warning and danger semantics", () => {
    const darkTheme = tokens.match(/:root\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(darkTheme).toContain("--zc-canvas: #0a0f1a");
    expect(darkTheme).toContain("--zc-surface: #111b2a");
    expect(darkTheme).toContain("--zc-primary: #4facfe");
    expect(tokenValue(tokens, "zc-warning")).not.toBe(tokenValue(tokens, "zc-danger"));
    expect(tokenValue(darkTheme, "zc-warning")).not.toBe(tokenValue(darkTheme, "zc-danger"));
  });

  it("provides radius, spacing, shadow, motion, and focus-ring tokens", () => {
    expect(tokens).toContain("--zc-radius-control");
    expect(tokens).toContain("--zc-space-1");
    expect(tokens).toContain("--zc-shadow-raised");
    expect(tokens).toContain("--zc-duration-fast");
    expect(tokens).toContain("--zc-ease-standard");
    expect(tokens).toContain("--zc-focus-ring");
    expect(tokens).toContain("--zc-warning-text: #7a4d00");
    expect(tokens).toContain("--zc-brand-canvas-highlight");
  });

  it("exports the four material layers and shell-specific surfaces using semantic variables", () => {
    for (const exportName of [
      "canvasSurface",
      "contentSurface",
      "raisedSurface",
      "floatingSurface",
      "sidebarSurface",
      "titlebarSurface"
    ]) {
      expect(tw).toContain(`export const ${exportName}`);
    }

    const materials = tw.slice(tw.indexOf("export const canvasSurface"), tw.indexOf("// Legacy surface aliases"));
    expect(materials).toContain("var(--zc-");
    expect(materials).not.toContain("slate-");
    expect(materials).not.toContain("blue-");
    expect(materials.match(/contentSurface[\s\S]*?(?=export const raisedSurface)/)?.[0] ?? "").not.toContain("backdrop-blur");
  });

  it("keeps legacy material exports as an explicit migration compatibility layer", () => {
    expect(tw).toContain("// Legacy surface aliases");
    for (const exportName of [
      "glassPanel",
      "appPanel",
      "contentPanel",
      "elevatedPanel",
      "softPanel",
      "toolbarSurface",
      "scopeBarSurface"
    ]) {
      expect(tw).toContain(`export const ${exportName}`);
    }
  });

  it("implements the overlapping Zen Core and Canvas mark at micro, sidebar, and app sizes", () => {
    expect(brandMark).toContain('type BrandMarkSize = "micro" | "sidebar" | "app"');
    expect(brandMark).toContain("Zen Core");
    expect(brandMark).toContain("Canvas");
    expect(brandMark).toContain("micro:");
    expect(brandMark).toContain("sidebar:");
    expect(brandMark).toContain("app:");
    expect(brandMark).toContain("var(--zc-brand-canvas-highlight)");
    expect(brandMark).not.toContain("rgba(255,255,255,0.28)");
    expect(shellChrome).toContain("export function ZenMark");
    expect(shellChrome).toContain("<BrandMark");
  });

  it("lets each BrandMark usage choose decorative or accessible image semantics", () => {
    expect(brandMark).toContain("decorative?: boolean");
    expect(brandMark).toContain('role={decorative ? undefined : "img"}');
    expect(brandMark).toContain("aria-hidden={decorative || undefined}");
    expect(brandMark).toContain('aria-label={decorative ? undefined : ariaLabel}');
  });

  it("preserves reduced motion and avoids scale-based interactions in the new foundation", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(brandMark).not.toMatch(/(?:hover|active):scale-/);
    expect(tw).not.toMatch(/(?:hover|active):scale-/);
  });

  it("keeps Ambient Mesh structure local to ShellChrome and driven by semantic tokens", () => {
    expect(shellChrome).toContain("function AmbientMesh");
    expect(shellChrome).toContain("var(--zc-ambient-primary)");
    expect(shellChrome).toContain("var(--zc-ambient-secondary)");
    expect(tokens).toContain("--zc-ambient-primary");
    expect(tokens).toContain("--zc-ambient-secondary");
    expect(styles).not.toContain("--zc-ambient-primary:");
  });
});
