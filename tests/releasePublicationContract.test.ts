import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/release-build.yml", "utf8").replace(/\r\n?/gu, "\n");

function step(name: string, nextName: string) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = workflow.indexOf(`      - name: ${nextName}\n`, start + 1);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe("release publication SBOM contract", () => {
  it("emits the source dependency SBOM pair only once across the platform matrix", () => {
    for (const [name, nextName] of [
      ["Generate Node SBOM", "Generate Rust SBOM"],
      ["Generate Rust SBOM", "Verify SBOM outputs"],
      ["Verify SBOM outputs", "Generate Windows checksums"],
    ] as const) {
      const source = step(name, nextName);
      expect(source).toContain("if: runner.os == 'Windows'");
    }

    expect(workflow).toContain("sbom-node.cdx.json");
    expect(workflow).toContain("src-tauri/sbom-rust.cdx.json");
  });

  it("keeps the tag publication verifier fail-closed on exactly one Node and one Rust SBOM", () => {
    const releaseVerification = step(
      "Verify final release artifacts and checksums",
      "Attach installers to GitHub Release",
    );

    expect(releaseVerification).toContain("Get-ChildItem -LiteralPath $root -Recurse -Filter *.cdx.json -File");
    expect(releaseVerification).toContain(
      'if ($sboms.Count -ne 2) { throw "Expected Node and Rust SBOMs; found $($sboms.Count)." }',
    );
    expect(releaseVerification).toContain('$document.bomFormat -ne "CycloneDX"');
  });

  it("still uploads the SBOM pair with platform installers and publishes it from downloaded artifacts", () => {
    const upload = step("Upload installers", "Checkout release commit");
    expect(upload).toContain("sbom-node.cdx.json");
    expect(upload).toContain("src-tauri/sbom-rust.cdx.json");
    expect(upload).toContain("installers-*.sha256");

    const publish = workflow.slice(workflow.indexOf("      - name: Attach installers to GitHub Release\n"));
    expect(publish).toContain("release-artifacts/**/*.cdx.json");
    expect(publish).toContain("release-artifacts/**/*.sha256");
  });
});
