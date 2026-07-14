import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("phase 8 release safety and polish contracts", () => {
  it("keeps native confirmation and fixed utility palette out of production source", () => {
    const source = sourceFiles(resolve("src")).map((path) => readFileSync(path, "utf8")).join("\n");

    expect(source).not.toMatch(/(?:globalThis|window)\.confirm\s*\(/);
    expect(source).not.toMatch(/\b(?:slate|blue|red|amber|emerald|violet|purple|green)-\d{2,3}\b/);
    expect(source).not.toMatch(/\.(?:only|skip)\s*\(/);
  });

  it("gates engineering diagnostics and keeps onboarding on existing safe persistence paths", () => {
    const settings = read("src/views/settings/SettingsView.tsx");
    const onboarding = read("src/components/OnboardingDialog.tsx");
    const cleanup = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(settings).toContain('developerMode ? (');
    expect(settings).toContain('t("developerModeDesc")');
    expect(settings).toContain("tauriApi.saveAISettings");
    expect(onboarding).toContain("ModalPortal");
    expect(onboarding).toContain("setDefaultScanFolders");
    expect(onboarding).toContain("tauriApi.saveAISettings");
    expect(onboarding).not.toContain("moveFile");
    expect(onboarding).not.toContain("renameFile");
    expect(onboarding).not.toContain("delete");
    expect(cleanup).toContain("ConfirmDialog");
    expect(cleanup).toContain("moveCleanupCandidatesToSafeTrash");
  });
});
