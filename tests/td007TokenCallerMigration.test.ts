import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const targetFiles = {
  assetCard: "src/views/vault/AssetCard.tsx",
  previewFileRow: "src/views/timeline/PreviewFileRow.tsx",
  timeline: "src/views/timeline/TimelineView.tsx"
} as const;

const targetedAliases = [
  "--surface-soft",
  "--ink",
  "--muted",
  "--quiet",
  "--line",
  "--zc-focus-ring",
  "--zc-focus-ring-soft"
] as const;

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("TD-007-P1 bounded token caller migration", () => {
  it("leaves every named file caller-zero for the targeted aliases", () => {
    for (const path of Object.values(targetFiles)) {
      const source = read(path);
      for (const alias of targetedAliases) {
        expect(source, `${path} still uses ${alias}`).not.toContain(`var(${alias})`);
      }
    }
  });

  it("uses the existing V26 semantic roles for each migrated presentation concern", () => {
    const assetCard = read(targetFiles.assetCard);
    const previewFileRow = read(targetFiles.previewFileRow);
    const timeline = read(targetFiles.timeline);

    expect(assetCard).toContain("var(--zc-surface-subtle)");
    expect(assetCard).toContain("var(--zc-text-primary)");
    expect(assetCard).toContain("var(--zc-text-secondary)");
    expect(assetCard).toContain("var(--zc-text-tertiary)");
    expect(assetCard).toContain("var(--zc-border)");
    expect(assetCard).toContain("var(--zc-focus-soft)");

    expect(previewFileRow).toContain("var(--zc-text-secondary)");
    expect(previewFileRow).toContain("var(--zc-text-tertiary)");
    expect(previewFileRow).toContain("riskLabel");
    expect(previewFileRow).toContain("../fileLibrary/presentation/fileLibraryPresentation");

    expect(timeline).toContain("var(--zc-text-secondary)");
    expect(timeline).toContain("var(--zc-border)");
    expect(timeline).toContain("focus-visible:outline-[var(--zc-focus)]");
  });

  it("keeps selection, focus and operation authority boundaries intact", () => {
    const assetCard = read(targetFiles.assetCard);
    const previewFileRow = read(targetFiles.previewFileRow);
    const timeline = read(targetFiles.timeline);

    expect(assetCard).toContain("aria-pressed={isSelected}");
    expect(assetCard).toContain("isSelected &&");
    expect(assetCard).not.toContain("focus-visible:outline-[var(--zc-focus-soft)]");
    expect(previewFileRow).toContain("resolvePreviewEligibility");
    expect(previewFileRow).toContain("riskLabel(preview.risk_level, t)");
    expect(timeline).toContain("useFileLibraryStore");
    expect(timeline).toContain("useOperationQueueStore");
    expect(timeline).toContain("executeSelected(true)");
  });
});
