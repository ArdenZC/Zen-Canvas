import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
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

  it("uses fast PR profiles while retaining sensitive and post-merge gates", () => {
    expect(workflow).toContain("npm run test:performance:pr");
    expect(workflow).toContain("npm run test:performance:full");
    expect(workflow).toContain("needs.change-scope.outputs.performance_sensitive");
    expect(workflow).toContain("needs.change-scope.outputs.package_sensitive");
    expect(workflow).toContain("npm run build:check");
    expect(workflow).toContain("npm run build -- --no-sign");
  });

  it("checks production frontend and release Rust without linking ordinary PRs", () => {
    const buildCheck = packageJson.scripts["build:check"];
    expect(buildCheck).toContain("vite build");
    expect(buildCheck).toContain("cargo check --release");
    expect(buildCheck).toContain("--features desktop-runtime");
    expect(buildCheck).not.toContain("tauri build");
  });

  it("only packages pull requests when package-sensitive paths changed", () => {
    const packageCondition =
      "github.event_name != 'pull_request' || needs.change-scope.outputs.package_sensitive == 'true'";
    expect(workflow.match(new RegExp(packageCondition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(2);
  });

  it("preserves stable required check names", () => {
    expect(workflow).toContain("name: Quality (windows-latest)");
    expect(workflow).toContain("name: Quality (macos-latest)");
    expect(workflow).toContain("name: Dependency audit");
  });
});
