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

function brandMarkVariant(source: string, variant: string, nextVariant?: string) {
  const normalizedSource = source.replace(/\r\n?/g, "\n");
  const boundary = nextVariant
    ? `\\n\\s*\\},\\n\\s*${nextVariant}:`
    : "\\n\\s*\\}";
  return normalizedSource.match(
    new RegExp(`${variant}:\\s*\\{([\\s\\S]*?)${boundary}`)
  )?.[1] ?? "";
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

describe("W6-07 V26 design foundation", () => {
  const styles = read("src/styles.css");
  const tokens = read("src/styles/tokens.css");
  const shellV26 = read("src/styles/w6-07-shell-v26.css");
  const filesV26 = read("src/views/fileLibrary/fileLibraryV26.css");
  const tw = read("src/utils/tw.ts");
  const brandMark = read("src/components/ui/BrandMark.tsx");
  const shellChrome = read("src/components/ShellChrome.tsx");

  it("binds production semantic roles to the frozen V26 light target", () => {
    expect(tokens).toContain("--zc-canvas: #f5f6f8");
    expect(tokens).toContain("--zc-surface: #ffffff");
    expect(tokens).toContain("--zc-surface-subtle: #eef0f3");
    expect(tokens).toContain("--zc-surface-hover: #e9edf2");
    expect(tokens).toContain("--zc-surface-selected: #e8edf4");
    expect(tokens).toContain("--zc-primary: #295fc7");
    expect(tokens).toContain("--zc-primary-hover: #2354b4");
    expect(tokens).toContain("--zc-primary-pressed: #1c4598");
    expect(tokens).toContain("--zc-control-border: #8993a1");
    expect(tokens).toContain("--zc-focus: #215fd1");
    expect(tokens).toContain("--zc-focus-soft: #edf3fb");
    expect(tokens).toContain("--zc-selected-focus: #dbe6f3");
    expect(tokens).toContain("--zc-selection-mark: #426899");
    expect(styles).toContain('@import "./styles/tokens.css"');
    expect(styles).toContain('@import "./styles/w6-07-shell-v26.css"');
    expect(styles).toContain('@import "./views/fileLibrary/fileLibraryV26.css"');
  });

  it("meets the retained V26 light-mode contrast gates used by the migrated shell", () => {
    const primary = tokenValue(tokens, "zc-primary");
    const primaryHover = tokenValue(tokens, "zc-primary-hover");
    const primaryPressed = tokenValue(tokens, "zc-primary-pressed");
    const primaryContrast = tokenValue(tokens, "zc-primary-contrast");
    const secondary = tokenValue(tokens, "zc-text-secondary");
    const surface = tokenValue(tokens, "zc-surface");
    const canvas = tokenValue(tokens, "zc-canvas");
    const focus = tokenValue(tokens, "zc-focus");
    const controlBorder = tokenValue(tokens, "zc-control-border");

    for (const value of [primary, primaryHover, primaryPressed, primaryContrast, secondary, surface, canvas, focus, controlBorder]) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }

    expect(contrastRatio(primary, primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(primaryHover, primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(primaryPressed, primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(secondary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(secondary, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(focus, canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(controlBorder, surface)).toBeGreaterThanOrEqual(3);
  });

  it("binds dark mode to the frozen V26 semantic roles", () => {
    const darkTheme = tokens.match(/:root\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(darkTheme).toContain("--zc-canvas: #17191d");
    expect(darkTheme).toContain("--zc-surface: #202328");
    expect(darkTheme).toContain("--zc-surface-subtle: #292d34");
    expect(darkTheme).toContain("--zc-surface-selected: #2c3542");
    expect(darkTheme).toContain("--zc-primary: #91b7ff");
    expect(darkTheme).toContain("--zc-control-border: #7e899a");
    expect(darkTheme).toContain("--zc-focus: #a8cbff");
    expect(darkTheme).toContain("--zc-focus-soft: #273548");
    expect(darkTheme).toContain("--zc-selected-focus: #34455c");
    expect(tokenValue(tokens, "zc-warning")).not.toBe(tokenValue(tokens, "zc-danger"));
    expect(tokenValue(darkTheme, "zc-warning")).not.toBe(tokenValue(darkTheme, "zc-danger"));
  });

  it("keeps semantic info, neutral, purple, and safety families available in both themes", () => {
    const darkTheme = tokens.match(/:root\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    for (const family of ["info", "neutral", "purple", "success", "warning", "danger"]) {
      for (const suffix of ["", "-text", "-soft", "-border"]) {
        const tokenName = `zc-${family}${suffix}`;
        expect(tokenValue(tokens, tokenName), `${tokenName} light`).not.toBe("");
        expect(tokenValue(darkTheme, tokenName), `${tokenName} dark`).not.toBe("");
      }
    }
  });

  it("uses the frozen spacing, radius, density, motion, and focus-role ladders", () => {
    expect(tokens).toContain("--zc-space-micro: 2px");
    expect(tokens).toContain("--zc-space-1: 4px");
    expect(tokens).toContain("--zc-space-2: 8px");
    expect(tokens).toContain("--zc-space-3: 12px");
    expect(tokens).toContain("--zc-space-4: 16px");
    expect(tokens).toContain("--zc-space-6: 24px");
    expect(tokens).toContain("--zc-space-8: 32px");
    expect(tokens).toContain("--zc-radius-micro: 4px");
    expect(tokens).toContain("--zc-radius-control: 8px");
    expect(tokens).toContain("--zc-radius-panel: 12px");
    expect(tokens).toContain("--zc-control-height-compact: 32px");
    expect(tokens).toContain("--zc-control-height-default: 36px");
    expect(tokens).toContain("--zc-row-height-default: 44px");
    expect(tokens).toContain("--zc-duration-fast: 120ms");
    expect(tokens).toContain("--zc-duration-standard: 180ms");
    expect(tokens).toContain("--zc-ease-standard: cubic-bezier(0.2, 0, 0, 1)");
    expect(tokens).toContain("--zc-primary-focus");
  });

  it("uses platform-local typography without reintroducing a remote-first Inter dependency", () => {
    const familyLine = styles.match(/font-family:[^;]+;/)?.[0] ?? "";
    expect(familyLine).toContain('"Segoe UI"');
    expect(familyLine).toContain("system-ui");
    expect(familyLine).toContain('"PingFang SC"');
    expect(familyLine).toContain('"Microsoft YaHei UI"');
    expect(familyLine).not.toContain("Inter");
  });

  it("migrates shell search and navigation to quiet V26 chrome without a selection rail", () => {
    expect(shellV26).toContain("#app-shell-content > header > div:nth-child(2) > button");
    expect(shellV26).toContain("minmax(236px, 326px)");
    expect(shellV26).toContain("border-radius: var(--zc-radius-control)");
    expect(shellV26).toContain("button kbd");
    expect(shellV26).toContain("background: transparent");
    expect(shellV26).toContain("nav button::before");
    expect(shellV26).toContain("display: none");
    expect(shellV26).toContain('button[aria-current="page"]');
    expect(shellV26).toContain("background: var(--zc-surface-selected)");
    expect(shellV26).toContain("background: var(--zc-focus-soft)");
    expect(shellV26).toContain("background: var(--zc-selected-focus)");
    expect(shellV26).not.toContain("rounded-full");
  });

  it("migrates the Files command surface away from boxed tool groups and ring focus", () => {
    expect(filesV26).toContain(".file-library-workspace .file-library-command-group");
    expect(filesV26).toContain(".file-library-workspace .file-library-view-switch");
    expect(filesV26).toContain("border: 0");
    expect(filesV26).toContain("background: transparent");
    expect(filesV26).toContain(".file-library-mode-switch");
    expect(filesV26).toContain("background: var(--zc-surface-subtle)");
    expect(filesV26).toContain("background: var(--zc-focus-soft)");
    expect(filesV26).toContain("background: var(--zc-selected-focus)");
    expect(filesV26).toContain("outline: 0");
    expect(filesV26).not.toContain("box-shadow: inset");
  });

  it("keeps material exports semantic and the legacy aliases explicit during migration", () => {
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

    expect(tw).toContain("// Legacy surface aliases");
    for (const exportName of ["glassPanel", "appPanel", "contentPanel", "elevatedPanel", "softPanel", "toolbarSurface", "scopeBarSurface"]) {
      expect(tw).toContain(`export const ${exportName}`);
    }
  });

  it("preserves the local Zen mark semantics while presentation roles migrate", () => {
    expect(brandMark).toContain('type BrandMarkSize = "micro" | "sidebar" | "app"');
    expect(brandMark).toContain("Zen Core");
    expect(brandMark).toContain("Canvas");
    expect(brandMark).toContain("var(--zc-brand-blue)");
    expect(brandMark).toContain("var(--zc-brand-blue-soft)");
    expect(brandMark).not.toMatch(/var\(--zc-primary(?:-[^)]+)?\)/);
    expect(shellChrome).toContain("export function ZenMark");
    expect(shellChrome).toContain("<BrandMark");

    const micro = brandMarkVariant(brandMark, "micro", "sidebar");
    const sidebar = brandMarkVariant(brandMark, "sidebar", "app");
    const app = brandMarkVariant(brandMark, "app");
    expect(micro).not.toContain("shadow-");
    expect(sidebar).not.toMatch(/backdrop-blur-(?:sm|md|lg|xl|2xl|3xl)/);
    expect(app).not.toContain("backdrop-blur-md");
  });

  it("preserves reduced motion and avoids scale-based foundation interactions", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(brandMark).not.toMatch(/(?:hover|active):scale-/);
    expect(tw).not.toMatch(/(?:hover|active):scale-/);
    expect(shellV26).not.toMatch(/transform:\s*scale/);
    expect(filesV26).not.toMatch(/transform:\s*scale/);
  });

  it("keeps status exports free of fixed Tailwind palette colors", () => {
    const statusExports = tw.slice(tw.indexOf("export const statusToast"));
    expect(statusExports).toContain("var(--zc-");
    expect(statusExports).not.toMatch(/(?:red|blue|green|emerald|amber|slate|purple)-\d/);
  });

  it("keeps Ambient Mesh structure local to ShellChrome and semantic tokens", () => {
    expect(shellChrome).toContain("function AmbientMesh");
    expect(shellChrome).toContain("var(--zc-ambient-primary)");
    expect(shellChrome).toContain("var(--zc-ambient-secondary)");
    expect(tokens).toContain("--zc-ambient-primary");
    expect(tokens).toContain("--zc-ambient-secondary");
    expect(styles).not.toContain("--zc-ambient-primary:");
  });
});
