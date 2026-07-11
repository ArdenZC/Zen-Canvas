import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("App Shell v4", () => {
  const appShell = read("src/components/AppShell.tsx");
  const commandModal = read("src/components/CommandModal.tsx");
  const shellChrome = read("src/components/ShellChrome.tsx");
  const tokens = read("src/styles/tokens.css");

  it("uses the final primary and advanced navigation without removing routed views", () => {
    const nav = appShell.slice(appShell.indexOf("function navGroups"));

    for (const id of ["scanner", "library", "organize", "restore", "rules", "settings"]) {
      expect(nav).toContain(`id: "${id}"`);
    }
    expect(nav).not.toContain('id: "cleanup"');
    expect(nav).not.toContain('id: "preview"');
    expect(appShell).toContain('view === "cleanup"');
    expect(appShell).toContain('view === "preview"');
    expect(appShell).toContain('id: "primary"');
    expect(appShell).toContain('id: "advanced"');
  });

  it("uses the specified shell geometry and semantic selected navigation", () => {
    expect(appShell).toContain("h-12");
    expect(appShell).toContain("grid-cols-[228px_minmax(0,1fr)]");
    expect(appShell).toContain("min-w-[720px]");
    expect(appShell).toContain("var(--zc-sidebar)");
    expect(appShell).toContain("var(--zc-surface-selected)");
    expect(appShell).toContain("before:w-0.5");
    expect(appShell).not.toMatch(/(?:hover|active):scale-/);
  });

  it("reports the active local or AI mode instead of making an absolute local-only claim", () => {
    expect(appShell).toContain("tauriApi.getAISettings()");
    expect(appShell).toContain('provider === "ollama"');
    expect(appShell).toContain('t("modeAICloud")');
    expect(appShell).toContain('t("modeAILocal")');
    expect(appShell).toContain('t("modeAIDisabled")');
  });

  it("keeps platform controls native to each platform and drag-safe", () => {
    expect(appShell).toContain("MacWindowControls");
    expect(appShell).toContain("WindowsControls");
    expect(appShell).toContain("h-6 w-6");
    expect(appShell).toContain("var(--zc-window-close-hover)");
    expect(appShell).not.toContain("overflow-hidden rounded-lg border");
    expect(appShell).toContain("[-webkit-app-region:no-drag]");
    expect(shellChrome).toContain("[-webkit-app-region:no-drag]");
    expect(tokens).toContain("--zc-window-close-hover");
  });

  it("uses the floating material and semantic colors for Spotlight", () => {
    expect(commandModal).toContain("var(--zc-surface-floating)");
    expect(commandModal).toContain("var(--zc-shadow-spotlight)");
    expect(commandModal).toContain("var(--zc-focus-ring)");
    expect(commandModal).toContain("commandIdleGroups");
    expect(commandModal).toContain("isBackgroundIndexing");
    expect(commandModal).not.toMatch(/(?:neutral|blue|slate|red|amber|emerald|green|purple)-\d/);
    expect(commandModal).not.toMatch(/(?:hover|active):scale-/);
  });

  it("preserves Spotlight accessibility and keyboard behavior", () => {
    expect(commandModal).toContain('role={standalone ? "search" : "dialog"}');
    expect(commandModal).toContain("aria-modal={standalone ? undefined : true}");
    expect(commandModal).toContain('if (event.key === "ArrowDown")');
    expect(commandModal).toContain('if (event.key === "ArrowUp")');
    expect(commandModal).toContain('if (event.key === "Enter"');
    expect(commandModal).toContain('if (event.key === "Escape")');
    expect(commandModal).toContain("isSortingPreviewShortcut(event)");
  });
});
