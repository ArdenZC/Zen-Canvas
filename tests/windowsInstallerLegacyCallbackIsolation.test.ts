import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const legacyHooksPath = path.join(repositoryRoot, "src-tauri", "windows", "installer-hooks.nsh");
const synchronousPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "installer-lifecycle-synchronous.nsh",
);

function functionBody(source: string, functionName: string) {
  const start = source.indexOf(`Function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("FunctionEnd", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("W4-04 package legacy callback isolation", () => {
  it("keeps compiled legacy install failure callback inert under the synchronous package owner", () => {
    const legacy = fs.readFileSync(legacyHooksPath, "utf8");
    const synchronous = fs.readFileSync(synchronousPath, "utf8");

    const legacyFailed = functionBody(legacy, ".onInstFailed");
    expect(legacyFailed).toContain("$ZC_INSTALL_LIFECYCLE_ACTIVE != 1");
    expect(synchronous).toContain("StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0");
    expect(synchronous).not.toContain("StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 1");
  });

  it("keeps compiled legacy uninstall failure recovery outside its stage-1 window", () => {
    const legacy = fs.readFileSync(legacyHooksPath, "utf8");
    const synchronous = fs.readFileSync(synchronousPath, "utf8");

    const legacyFailed = functionBody(legacy, "un.onUninstFailed");
    const legacyRecovery = functionBody(legacy, "un.RecoverZenCanvasPreDeleteAbort");
    expect(legacyFailed).toContain("Call un.RecoverZenCanvasPreDeleteAbort");
    expect(legacyRecovery).toContain("$ZC_UNINSTALL_LIFECYCLE_STAGE != 1");
    expect(synchronous).toContain("StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 0");
    expect(synchronous).not.toContain("StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 1");
  });
});
