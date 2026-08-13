import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release-build.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("code pull-request CI fast path", () => {
  it("classifies deletions and both sides of renames", () => {
    expect(workflow).toContain('git", "diff", "--name-status", "-M"');
    expect(workflow).toContain('status.startswith("R")');
    expect(workflow).toContain("changed.extend(paths)");
    expect(workflow).not.toContain("--diff-filter=ACMR");
  });

  it("keeps platform-independent and platform-specific checks separated", () => {
    expect(workflow).toContain("name: Frontend and format quality");
    expect(workflow).toContain("name: Rust quality (windows-latest)");
    expect(workflow).toContain("name: Rust quality (macos-latest)");
    expect(workflow).toContain("name: Release compile (windows-latest)");
    expect(workflow).toContain("name: Release compile (macos-latest)");
  });

  it("uses fast PR profiles while retaining explicit full-validation gates", () => {
    expect(workflow).toContain("npm run test:performance:pr");
    expect(workflow).toContain("npm run test:performance:full");
    expect(workflow).toContain("full_validation: ${{ steps.classify.outputs.full_validation }}");
    expect(workflow).toContain('"full-validation" in pr_labels');
    expect(workflow).toContain("inputs.full_validation");
    expect(workflow).toContain("npm run build:check");
    expect(workflow).toContain("npm run build -- --no-sign");
    expect(workflow).not.toContain('pr_number == "44"');
    expect(workflow).not.toContain("PR_NUMBER");
    expect(workflow).toContain("high_risk_prefixes");
    expect(workflow).toContain('"src-tauri/src/content/"');
    expect(workflow).toContain('"src-tauri/src/file_ops/"');
    expect(workflow).toContain("base_missing");
  });

  it("pins current Node 24-compatible official actions", () => {
    expect(workflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
    expect(workflow).toContain("Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2");
    expect(releaseWorkflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
    expect(releaseWorkflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
    expect(releaseWorkflow).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
    expect(releaseWorkflow).toContain("actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8");
    expect(releaseWorkflow).toContain("softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3");
  });

  it("checks production frontend and cross-platform release Rust on every code PR", () => {
    const buildCheck = packageJson.scripts["build:check"];
    expect(buildCheck).toContain("vite build");
    expect(buildCheck).toContain("cargo check --release");
    expect(buildCheck).toContain("--features desktop-runtime");
    expect(buildCheck).not.toContain("tauri build");
    expect(workflow).toContain("needs.change-scope.outputs.docs_only != 'true' }}");
    expect(workflow).toContain("test \"$RUST\" = success");
    expect(workflow).toContain("test \"$BUILD\" = success");
  });

  it("only packages on the explicit full-validation path", () => {
    const packageJobs = workflow.match(/package-(?:windows|macos):[\s\S]*?\n\s+if:([^\n]+)/g) ?? [];
    expect(packageJobs).toHaveLength(2);
    for (const packageJob of packageJobs) {
      expect(packageJob).toContain("needs.change-scope.outputs.full_validation == 'true'");
    }
  });

  it("preserves stable required check names", () => {
    expect(workflow).toContain("name: Quality (windows-latest)");
    expect(workflow).toContain("name: Quality (macos-latest)");
    expect(workflow).toContain("name: Dependency audit");
  });
});
