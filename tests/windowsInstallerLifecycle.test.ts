import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildZenCanvasNsisTemplate,
  TAURI_NSIS_UPSTREAM_BLOB_SHA,
} from "../scripts/prepareWindowsNsisLifecycleTemplate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const upstreamPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "tauri-2.11.2-installer.upstream.nsi",
);
const wrapperPath = path.join(repositoryRoot, "src-tauri", "windows", "installer-lifecycle-wrapper.nsh");
const synchronousPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "installer-lifecycle-synchronous.nsh",
);
const finalPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "installer-lifecycle-final.nsh",
);

function sectionBody(source: string, sectionName: string) {
  const start = source.indexOf(`Section ${sectionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("SectionEnd", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function functionBody(source: string, functionName: string) {
  const start = source.indexOf(`Function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("FunctionEnd", start);
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

  it("uses only the final synchronous lifecycle entries in generated install/uninstall sections", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    const uninstall = sectionBody(generated, "Uninstall");

    expect(install).toContain("Call ZCPrepareInstallLifecycleFinal");
    expect(install).toContain("Call ZCPostInstallLifecycleFinal");
    expect(uninstall).toContain("Call un.ZCPrepareUninstallLifecycleFinal");
    expect(uninstall).toContain("Call un.ZCPostUninstallLifecycleFinal");

    for (const legacyHook of [
      "!insertmacro NSIS_HOOK_PREINSTALL",
      "!insertmacro NSIS_HOOK_POSTINSTALL",
      "!insertmacro NSIS_HOOK_PREUNINSTALL",
      "!insertmacro NSIS_HOOK_POSTUNINSTALL",
      "!insertmacro CheckIfAppIsRunning",
    ]) {
      expect(install).not.toContain(legacyHook);
      expect(uninstall).not.toContain(legacyHook);
    }
  });

  it("orders install service stop, app gate, Preview quiesce, then generated mutation", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    expect(install.indexOf("Call ZCPrepareInstallLifecycleFinal")).toBeLessThan(
      install.indexOf("SetOverwrite try"),
    );
    expect(install.indexOf("SetOverwrite try")).toBeLessThan(
      install.indexOf('File "${MAINBINARYSRCPATH}"'),
    );

    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    const initialize = functionBody(synchronous, "ZCInitializeInstallLifecycle");
    expect(initialize).toContain("Call ValidateZenCanvasPreexistingProduct");
    expect(initialize).toContain("Call ValidateZenCanvasPreviewCore");
    expect(initialize).toContain("Call ValidateZenCanvasIndexServiceOwnership");

    const final = fs.readFileSync(finalPath, "utf8");
    const prepare = functionBody(final, "ZCPrepareInstallLifecycleFinal");
    const stop = prepare.indexOf("Call ZCStopCapturedServiceForLifecycle");
    const gate = prepare.indexOf("Call ZCResolveMainAppGateFinal");
    const quiesce = prepare.indexOf("Call ZCQuiescePreviewForLifecycle");
    expect(stop).toBeGreaterThanOrEqual(0);
    expect(gate).toBeGreaterThan(stop);
    expect(quiesce).toBeGreaterThan(gate);
  });

  it("orders uninstall service stop, app gate, Preview quiesce, then first critical delete", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const uninstall = sectionBody(generated, "Uninstall");
    expect(uninstall.indexOf("Call un.ZCPrepareUninstallLifecycleFinal")).toBeLessThan(
      uninstall.indexOf('Delete "$INSTDIR\\${MAINBINARYNAME}.exe"'),
    );

    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    const initialize = functionBody(synchronous, "un.ZCInitializeUninstallLifecycle");
    expect(initialize).toContain("Call un.ValidateZenCanvasPreviewCore");
    expect(initialize).toContain("Call un.ValidateZenCanvasIndexServiceOwnership");
    expect(initialize).toContain("Call un.CaptureZenCanvasOriginalServiceState");
    expect(initialize).toContain("Call un.CheckZenCanvasPreDeleteProductEvidence");

    const final = fs.readFileSync(finalPath, "utf8");
    const prepare = functionBody(final, "un.ZCPrepareUninstallLifecycleFinal");
    const stop = prepare.indexOf("Call un.ZCStopCapturedServiceForLifecycle");
    const gate = prepare.indexOf("Call un.ZCResolveMainAppGateFinal");
    const quiesce = prepare.indexOf("Call un.ZCQuiescePreviewForLifecycle");
    expect(stop).toBeGreaterThanOrEqual(0);
    expect(gate).toBeGreaterThan(stop);
    expect(quiesce).toBeGreaterThan(gate);
  });

  it("keeps silent and passive process gates non-interactive", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    for (const functionName of ["ZCResolveMainAppGateFinal", "un.ZCResolveMainAppGateFinal"]) {
      const gate = functionBody(final, functionName);
      const silent = gate.indexOf("IfSilent");
      const passive = gate.indexOf("$PassiveMode == 1");
      const prompt = gate.indexOf("MessageBox MB_OKCANCEL");
      expect(silent).toBeGreaterThanOrEqual(0);
      expect(passive).toBeGreaterThan(silent);
      expect(prompt).toBeGreaterThan(passive);
    }
  });

  it("owns Preview quiesce synchronously without hidden Abort paths", () => {
    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    const installQuiesce = functionBody(synchronous, "ZCQuiescePreviewForLifecycle");
    const uninstallQuiesce = functionBody(synchronous, "un.ZCQuiescePreviewForLifecycle");
    expect(installQuiesce).not.toContain("Abort");
    expect(uninstallQuiesce).not.toContain("Abort");
    expect(synchronous).toContain("StrCpy $ZC_LIFECYCLE_PREVIEW_OK 0");
    expect(synchronous).toContain("Call ${ROLLBACK_QUIESCE_FUNCTION}");
  });

  it("routes generated file and metadata failures to the same synchronous partial owner", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    const uninstall = sectionBody(generated, "Uninstall");

    expect(install).toContain("IfErrors zc_install_reversible_failure");
    expect(install).toContain("IfErrors zc_install_partial_failure");
    expect(install).toContain("Call ZCMarkInstallIrreversible");
    expect(install).toContain("APP_ASSOCIATE");
    expect(install).toContain("URL Protocol");
    expect(install).toContain("EstimatedSize");

    expect(uninstall).toContain("IfErrors zc_uninstall_reversible_failure");
    expect(uninstall).toContain("IfErrors zc_uninstall_partial_failure");
    expect(uninstall).toContain("Call un.ZCMarkUninstallIrreversible");
    expect(uninstall).toContain("APP_UNASSOCIATE");
    expect(uninstall).not.toContain("RMDir /REBOOTOK");
    expect(uninstall).toContain('RMDir "$INSTDIR"');
  });

  it("preserves the captured service runtime state on repair and rejects service races", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const ensure = functionBody(final, "ZCEnsurePostInstallServiceFinal");
    expect(ensure).toContain("$ZC_PREEXISTING_SERVICE == 1");
    expect(ensure).toContain("Call RestoreZenCanvasPreexistingService");
    expect(ensure).toContain("$ZC_INDEX_SERVICE_OWNERSHIP != 1");
    expect(ensure).toContain("$ZC_INDEX_SERVICE_OWNERSHIP != 0");
    expect(ensure).toContain("Call InstallZenCanvasIndexService");
    expect(ensure).not.toContain("Call EnsureZenCanvasIndexServiceRunning");
  });

  it("makes POST failures non-zero and resets exit status only after successful finalization", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const installPost = functionBody(final, "ZCPostInstallLifecycleFinal");
    const uninstallPost = functionBody(final, "un.ZCPostUninstallLifecycleFinal");
    expect(installPost.indexOf("SetErrorLevel 2")).toBeLessThan(
      installPost.indexOf("Call ZCEnsurePostInstallServiceFinal"),
    );
    expect(installPost.lastIndexOf("SetErrorLevel 0")).toBeGreaterThan(
      installPost.indexOf("Call CommitZenCanvasPreviewQuiesce"),
    );
    expect(uninstallPost.indexOf("SetErrorLevel 2")).toBeLessThan(
      uninstallPost.indexOf("Call un.FinalizeZenCanvasPreviewUninstall"),
    );
    expect(uninstallPost.lastIndexOf("SetErrorLevel 0")).toBeGreaterThan(
      uninstallPost.indexOf("Call un.DeleteZenCanvasIndexService"),
    );
  });

  it("keeps user cancellation recoverable before mutation and blocked after the irreversible boundary", () => {
    const wrapper = fs.readFileSync(wrapperPath, "utf8");
    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    expect(wrapper).toContain("!define MUI_CUSTOMFUNCTION_ABORT ZCLifecycleUserAbort");
    expect(wrapper).toContain("!define MUI_CUSTOMFUNCTION_UNABORT un.ZCLifecycleUserAbort");
    expect(wrapper).toContain('!include "${__FILEDIR__}\\installer-lifecycle-final.nsh"');
    expect(synchronous).toContain("Call ZCRecoverInstallReversible");
    expect(synchronous).toContain("Call un.ZCRecoverUninstallReversible");
    expect(synchronous).toContain("$ZC_LIFECYCLE_INSTALL_STAGE >= 2");
    expect(synchronous).toContain("$ZC_LIFECYCLE_UNINSTALL_STAGE >= 2");
  });

  it("keeps irreversible failure truthful instead of synthesizing a full product rollback", () => {
    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    const installPartial = functionBody(synchronous, "ZCFailInstallPartial");
    expect(installPartial).toContain("Call CommitZenCanvasPreviewQuiesce");
    expect(installPartial).not.toContain("RollbackZenCanvasPreviewQuiesce");
    expect(installPartial).not.toContain("RestoreZenCanvasPreexistingService");

    const uninstallPartial = functionBody(synchronous, "un.ZCFailUninstallPartial");
    expect(uninstallPartial).toContain("Call un.CommitZenCanvasPreviewQuiesce");
    expect(uninstallPartial).toContain("Call un.DeleteZenCanvasIndexService");
    expect(uninstallPartial).not.toContain("RollbackZenCanvasPreviewQuiesce");
    expect(uninstallPartial).not.toContain("RestoreZenCanvasOriginalService");
  });
});
