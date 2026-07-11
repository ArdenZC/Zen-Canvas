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

function relativeLuminance(hex: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Expected a six-digit hex color, received: ${hex}`);

  const channels = match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
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
    expect(tokens).toContain("--zc-brand-blue: #007aff");
    expect(tokens).toContain("--zc-primary: #0066cc");
    expect(tokens).toContain("--zc-primary-hover: #005ebd");
    expect(tokens).toContain("--zc-primary-pressed: #0052a8");
    expect(tokens).toContain("--zc-control-border: #858a95");
    expect(tokens).toContain("--zc-control-border-hover: #68707c");
    expect(styles).toContain('@import "./styles/tokens.css"');
  });

  it("meets light-mode text and interaction contrast requirements", () => {
    const primary = tokenValue(tokens, "zc-primary");
    const primaryHover = tokenValue(tokens, "zc-primary-hover");
    const primaryPressed = tokenValue(tokens, "zc-primary-pressed");
    const primaryContrast = tokenValue(tokens, "zc-primary-contrast");
    const tertiary = tokenValue(tokens, "zc-text-tertiary");
    const surface = tokenValue(tokens, "zc-surface");
    const canvas = tokenValue(tokens, "zc-canvas");
    const focusRing = tokenValue(tokens, "zc-focus-ring");
    const controlBorder = tokenValue(tokens, "zc-control-border");

    expect(primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(primaryHover).toMatch(/^#[0-9a-f]{6}$/i);
    expect(primaryPressed).toMatch(/^#[0-9a-f]{6}$/i);
    expect(primaryContrast).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tertiary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(surface).toMatch(/^#[0-9a-f]{6}$/i);
    expect(canvas).toMatch(/^#[0-9a-f]{6}$/i);
    expect(focusRing).toMatch(/^#[0-9a-f]{6}$/i);
    expect(controlBorder).toMatch(/^#[0-9a-f]{6}$/i);

    expect(contrastRatio(primary, primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(primaryHover, primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(primaryPressed, primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tertiary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tertiary, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(focusRing, canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(controlBorder, surface)).toBeGreaterThanOrEqual(3);
  });

  it("defines an independent dark theme with distinct warning and danger semantics", () => {
    const darkTheme = tokens.match(/:root\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(darkTheme).toContain("--zc-canvas: #0a0f1a");
    expect(darkTheme).toContain("--zc-surface: #111b2a");
    expect(darkTheme).toContain("--zc-primary: #4facfe");
    expect(darkTheme).toContain("--zc-control-border: #647287");
    expect(darkTheme).toContain("--zc-control-border-hover: #75849a");
    expect(tokenValue(tokens, "zc-warning")).not.toBe(tokenValue(tokens, "zc-danger"));
    expect(tokenValue(darkTheme, "zc-warning")).not.toBe(tokenValue(darkTheme, "zc-danger"));
  });

  it("defines semantic info, neutral, and purple token families in both themes", () => {
    const darkTheme = tokens.match(/:root\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    for (const family of ["info", "neutral", "purple"]) {
      for (const suffix of ["", "-text", "-soft", "-border"]) {
        const tokenName = `zc-${family}${suffix}`;
        expect(tokenValue(tokens, tokenName), `${tokenName} light`).not.toBe("");
        expect(tokenValue(darkTheme, tokenName), `${tokenName} dark`).not.toBe("");
      }
    }
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
    expect(brandMark).toContain("var(--zc-brand-blue)");
    expect(brandMark).toContain("var(--zc-brand-blue-soft)");
    expect(brandMark).not.toMatch(/var\(--zc-primary(?:-[^)]+)?\)/);
    expect(brandMark).toContain("var(--zc-brand-canvas-highlight)");
    expect(brandMark).not.toContain("rgba(255,255,255,0.28)");
    expect(shellChrome).toContain("export function ZenMark");
    expect(shellChrome).toContain("<BrandMark");
  });

  it("uses optical BrandMark variants without collapsing the micro mark into a glow", () => {
    const micro = brandMark.match(/micro:\s*\{([\s\S]*?)\n\s*\},\n\s*sidebar:/)?.[1] ?? "";
    const sidebar = brandMark.match(/sidebar:\s*\{([\s\S]*?)\n\s*\},\n\s*app:/)?.[1] ?? "";
    const app = brandMark.match(/app:\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";

    expect(micro).not.toContain("backdrop-blur");
    expect(micro).not.toContain("shadow-");
    expect(micro).toContain("h-3");
    expect(micro).toContain("h-3.5");
    expect(micro).toContain("border");

    expect(sidebar).toContain("backdrop-blur-[2px]");
    expect(sidebar).not.toMatch(/backdrop-blur-(?:sm|md|lg|xl|2xl|3xl)/);
    expect(app).toContain("backdrop-blur-[4px]");
    expect(app).not.toContain("backdrop-blur-md");
  });

  it("uses high-opacity, blue-tinted BrandMark canvas surfaces in both themes", () => {
    const darkTheme = tokens.match(/:root\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const lightCanvas = tokenValue(tokens, "zc-brand-canvas");
    const darkCanvas = tokenValue(darkTheme, "zc-brand-canvas");

    expect(lightCanvas).toBe("rgba(238, 246, 255, 0.94)");
    expect(tokenValue(tokens, "zc-brand-canvas-border")).toBe("rgba(0, 122, 255, 0.24)");
    expect(darkCanvas).toBe("rgba(17, 31, 50, 0.94)");
    expect(tokenValue(darkTheme, "zc-brand-canvas-border")).toBe("rgba(114, 190, 255, 0.42)");
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

  it("keeps status exports free of fixed Tailwind palette colors", () => {
    const statusExports = tw.slice(tw.indexOf("export const statusToast"));
    expect(statusExports).toContain("var(--zc-");
    expect(statusExports).not.toMatch(/(?:red|blue|green|emerald|amber|slate|purple)-\d/);
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
