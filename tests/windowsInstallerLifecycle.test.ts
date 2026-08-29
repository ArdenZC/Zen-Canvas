import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildZenCanvasNsisTemplate,
  TAURI_NSIS_UPSTREAM_BLOB_SHA,
} from "../scripts/prepareWindowsNsisTemplate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const upstreamPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "tauri-2.11.2-installer.upstream.nsi",
);
const wrapperPath = path.join(repositoryRoot, "src-tauri", "windows", "installer-lifecycle-wrapper.nsh");
const lifecyclePath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "installer-lifecycle-functions.nsh",
);

function sectionBody(source: string, sectionName: string) {
  const start = source.indexOf(`Section ${sectionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("SectionEnd", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("W4-04 package NSIS lifecycle", () => {
  it("pins the exact Tauri 2.11.2 upstream template and package-only custom template", () => {
    expect(TAURI_NSIS_UPSTREAM_BLOB_SHA).toBe("a48a46149f6d6bdc76a0bf13f53e4acdfedb310b");
    const upstream = fs.readFileSync(upstreamPath, "utf8");
    const generated = buildZenCanvasNsisTemplate(upstream);
    expect(generated).not.toBe(upstream);

    const packageConfig = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, "src-tauri", "tauri.windows.package.conf.json"), "utf8"),
    );
    expect(packageConfig.bundle.windows.nsis.installerHooks).toBe(
      "windows/installer-lifecycle-wrapper.nsh",
    );
    expect(packageConfig.bundle.windows.nsis.template).toBe(
      "windows/.generated/zen-canvas-installer.nsi",
    );
  });

  it("moves the name-only app gate behind SCM service stop and before generated install mutation", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    expect(install).toContain("Call ZCPrepareInstallLifecycle");
    expect(install).not.toContain("!insertmacro NSIS_HOOK_PREINSTALL");
    expect(install).not.toContain("!insertmacro CheckIfAppIsRunning");
    expect(install.indexOf("Call ZCPrepareInstallLifecycle")).toBeLessThan(
      install.indexOf("SetOverwrite try"),
    );
    expect(install.indexOf("SetOverwrite try")).toBeLessThan(
      install.indexOf('File "${MAINBINARYSRCPATH}"'),
    );

    const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
    const prepare = lifecycle.slice(
      lifecycle.indexOf("Function ZCPrepareInstallLifecycle"),
      lifecycle.indexOf("FunctionEnd", lifecycle.indexOf("Function ZCPrepareInstallLifecycle")),
    );
    expect(prepare.indexOf("Call ZCStopCapturedServiceForLifecycle")).toBeLessThan(
      prepare.indexOf("Call ZCResolveMainAppGate"),
    );
  });

  it("uses direct bounded generated-file failure owners instead of NSIS failure callbacks", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    const uninstall = sectionBody(generated, "Uninstall");

    expect(install).toContain("IfErrors zc_install_reversible_failure");
    expect(install).toContain("IfErrors zc_install_partial_failure");
    expect(install).toContain("Call ZCMarkInstallIrreversible");
    expect(uninstall).toContain("IfErrors zc_uninstall_reversible_failure");
    expect(uninstall).toContain("IfErrors zc_uninstall_partial_failure");
    expect(uninstall).toContain("Call un.ZCMarkUninstallIrreversible");
    expect(uninstall).not.toContain("!insertmacro NSIS_HOOK_PREUNINSTALL");
    expect(uninstall).not.toContain("!insertmacro CheckIfAppIsRunning");

    const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
    expect(lifecycle).not.toContain("Function .onInstFailed");
    expect(lifecycle).not.toContain("Function un.onUninstFailed");
    expect(lifecycle).toContain("StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0");
    expect(lifecycle).toContain("StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 0");
  });

  it("keeps user cancellation recoverable before mutation and blocked after the irreversible boundary", () => {
    const wrapper = fs.readFileSync(wrapperPath, "utf8");
    const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
    expect(wrapper).toContain("!define MUI_CUSTOMFUNCTION_ABORT ZCLifecycleUserAbort");
    expect(wrapper).toContain("!define MUI_CUSTOMFUNCTION_UNABORT un.ZCLifecycleUserAbort");
    expect(lifecycle).toContain("Call ZCRecoverInstallReversible");
    expect(lifecycle).toContain("Call un.ZCRecoverUninstallReversible");
    expect(lifecycle).toContain("$ZC_LIFECYCLE_INSTALL_STAGE >= 2");
    expect(lifecycle).toContain("$ZC_LIFECYCLE_UNINSTALL_STAGE >= 2");
  });

  it("keeps irreversible failure truthful instead of synthesizing a full product rollback", () => {
    const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
    const installPartial = lifecycle.slice(
      lifecycle.indexOf("Function ZCFailInstallPartial"),
      lifecycle.indexOf("FunctionEnd", lifecycle.indexOf("Function ZCFailInstallPartial")),
    );
    expect(installPartial).toContain("Call CommitZenCanvasPreviewQuiesce");
    expect(installPartial).not.toContain("RollbackZenCanvasPreviewQuiesce");
    expect(installPartial).not.toContain("RestoreZenCanvasPreexistingService");

    const uninstallPartial = lifecycle.slice(
      lifecycle.indexOf("Function un.ZCFailUninstallPartial"),
      lifecycle.indexOf("FunctionEnd", lifecycle.indexOf("Function un.ZCFailUninstallPartial")),
    );
    expect(uninstallPartial).toContain("Call un.CommitZenCanvasPreviewQuiesce");
    expect(uninstallPartial).toContain("Call un.DeleteZenCanvasIndexService");
    expect(uninstallPartial).not.toContain("RollbackZenCanvasPreviewQuiesce");
    expect(uninstallPartial).not.toContain("RestoreZenCanvasOriginalService");
  });
});
