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

const lifecycleStages = {
  inactive: 0,
  reversiblePreparation: 1,
  fileMutation: 2,
  generatedMutation: 3,
  postGeneratedIntegration: 4,
  complete: 5,
} as const;

function advanceLifecycleStage(current: number, next: number) {
  return Math.max(current, next);
}

function successfulRepairServiceState(_original: "RUNNING" | "STOPPED") {
  return "RUNNING" as const;
}

function failedRepairServiceState(
  original: "RUNNING" | "STOPPED",
  coherent: boolean,
) {
  return coherent ? original : "STOPPED" as const;
}

function dispatchFailure(stage: number, coherent: boolean, ownerDone = false) {
  if (ownerDone || stage === lifecycleStages.inactive) {
    return { ownerDone, actions: [] as string[] };
  }
  if (stage === lifecycleStages.reversiblePreparation) {
    return { ownerDone: true, actions: ["reversible-recovery"] };
  }
  return {
    ownerDone: true,
    actions: coherent
      ? ["preview-rollback", "captured-service-restore"]
      : ["exact-preview-withdrawal", "repair-service-stop-only"],
  };
}

describe("W4-04 package NSIS lifecycle", () => {
  it("pins the exact Tauri 2.11.2 upstream template and package-only custom template", () => {
    expect(TAURI_NSIS_UPSTREAM_BLOB_SHA).toBe("a48a46149f6d6bdc76a0bf13f53e4acdfedb310b");
    const upstream = fs.readFileSync(upstreamPath, "utf8");
    const generated = buildZenCanvasNsisTemplate(upstream);
    expect(generated).not.toBe(upstream);
    const canonicalUpstream = upstream.replace(/\r\n/g, "\n");
    expect(buildZenCanvasNsisTemplate(canonicalUpstream.replace(/\n/g, "\r\n"))).toBe(
      buildZenCanvasNsisTemplate(canonicalUpstream),
    );

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
      install.indexOf("Call ZCMarkInstallIrreversible"),
    );
    expect(install.indexOf("Call ZCMarkInstallIrreversible")).toBeLessThan(
      install.indexOf('File "${MAINBINARYSRCPATH}"'),
    );
    expect(install.indexOf('File "${MAINBINARYSRCPATH}"')).toBeLessThan(
      install.indexOf("IfErrors zc_install_partial_failure"),
    );
    expect(install.indexOf("IfErrors zc_install_partial_failure")).toBeLessThan(
      install.indexOf("Call ZCMarkInstallGeneratedMutation"),
    );
    expect(install).not.toContain("IfErrors zc_install_reversible_failure");

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

    expect(install).toContain("IfErrors zc_install_partial_failure");
    expect(install).toContain("Call ZCMarkInstallIrreversible");
    expect(install).toContain("APP_ASSOCIATE");
    expect(install).toContain("URL Protocol");
    expect(install).toContain("EstimatedSize");

    expect(uninstall).toContain("IfErrors zc_uninstall_reversible_failure");
    expect(uninstall).toContain("IfErrors zc_uninstall_partial_failure");
    expect(uninstall).toContain("Call un.ZCMarkUninstallIrreversible");
    expect(uninstall).toContain("Call un.ZCMarkUninstallGeneratedMutation");
    expect(uninstall).toContain("APP_UNASSOCIATE");
    expect(uninstall).not.toContain("RMDir /REBOOTOK");
    expect(uninstall).toContain('RMDir "$INSTDIR"');
  });

  it("preserves the captured service runtime state on repair and rejects service races", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const ensure = functionBody(final, "ZCEnsurePostInstallServiceFinal");
    expect(ensure).toContain("$ZC_PREEXISTING_SERVICE == 1");
    expect(ensure).toContain("Call ZCEnsureZenCanvasIndexServiceRunningForSuccessfulInstall");
    expect(ensure).toContain("$ZC_INDEX_SERVICE_OWNERSHIP != 1");
    expect(ensure).toContain("$ZC_INDEX_SERVICE_OWNERSHIP != 0");
    expect(ensure).toContain("Call InstallZenCanvasIndexService");
    expect(ensure).not.toContain("Call RestoreZenCanvasPreexistingService");

    const successful = functionBody(
      final,
      "ZCEnsureZenCanvasIndexServiceRunningForSuccessfulInstall",
    );
    const failure = functionBody(final, "ZCHandlePostInstallFailureFinal");
    expect(successful).toContain("Call EnsureZenCanvasIndexServiceRunning");
    expect(successful).not.toContain("Call RestoreZenCanvasPreexistingService");
    expect(failure).toContain("Call RestoreZenCanvasPreexistingService");
  });

  it("makes POST failures non-zero and resets exit status only after successful finalization", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const installPost = functionBody(final, "ZCPostInstallLifecycleFinal");
    const uninstallPost = functionBody(final, "un.ZCPostUninstallLifecycleFinal");
    expect(installPost.indexOf("SetErrorLevel 2")).toBeLessThan(
      installPost.indexOf("Call ZCEnsurePostInstallServiceFinal"),
    );
    expect(installPost.indexOf("Call ZCMarkInstallPostGeneratedIntegration")).toBeLessThan(
      installPost.indexOf("Call ZCEnsurePostInstallServiceFinal"),
    );
    expect(installPost.lastIndexOf("SetErrorLevel 0")).toBeGreaterThan(
      installPost.indexOf("Call CommitZenCanvasPreviewQuiesce"),
    );
    expect(uninstallPost.indexOf("SetErrorLevel 2")).toBeLessThan(
      uninstallPost.indexOf("Call un.FinalizeZenCanvasPreviewUninstall"),
    );
    expect(uninstallPost.indexOf("Call un.ZCMarkUninstallPostGeneratedIntegration")).toBeLessThan(
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
    expect(synchronous).toContain(
      "$ZC_LIFECYCLE_INSTALL_STAGE >= ${ZC_LIFECYCLE_STAGE_FILE_MUTATION}",
    );
    expect(synchronous).toContain(
      "$ZC_LIFECYCLE_UNINSTALL_STAGE >= ${ZC_LIFECYCLE_STAGE_FILE_MUTATION}",
    );
  });

  it("keeps irreversible failure truthful instead of synthesizing a full product rollback", () => {
    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    const installPartial = functionBody(synchronous, "ZCFailInstallPartial");
    expect(installPartial).toContain("Call ZCHandleGeneratedInstallFailureFinal");
    expect(installPartial).not.toContain("Call CommitZenCanvasPreviewQuiesce");
    expect(installPartial).not.toContain("Call RestoreZenCanvasPreexistingService");
    expect(installPartial).not.toContain("RestoreZenCanvasPreexistingService");

    const uninstallPartial = functionBody(synchronous, "un.ZCFailUninstallPartial");
    expect(uninstallPartial).toContain("Call un.CommitZenCanvasPreviewQuiesce");
    expect(uninstallPartial).toContain("Call un.DeleteZenCanvasIndexService");
    expect(uninstallPartial).not.toContain("RollbackZenCanvasPreviewQuiesce");
    expect(uninstallPartial).not.toContain("RestoreZenCanvasOriginalService");
  });

  it("T38: separates successful repair convergence from failure-state restoration", () => {
    expect(successfulRepairServiceState("RUNNING")).toBe("RUNNING");
    expect(successfulRepairServiceState("STOPPED")).toBe("RUNNING");
    expect(failedRepairServiceState("RUNNING", true)).toBe("RUNNING");
    expect(failedRepairServiceState("STOPPED", true)).toBe("STOPPED");

    const final = fs.readFileSync(finalPath, "utf8");
    const success = functionBody(
      final,
      "ZCEnsureZenCanvasIndexServiceRunningForSuccessfulInstall",
    );
    const failure = functionBody(final, "ZCHandlePostInstallFailureFinal");
    expect(success).toContain("Call EnsureZenCanvasIndexServiceRunning");
    expect(failure).toContain("Call RestoreZenCanvasPreexistingService");
  });

  it("T39: makes the main executable replacement the stage-2 boundary", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    const irreversible = install.indexOf("Call ZCMarkInstallIrreversible");
    const mainFile = install.indexOf('File "${MAINBINARYSRCPATH}"');
    const partial = install.indexOf("IfErrors zc_install_partial_failure");
    const generatedMutation = install.indexOf("Call ZCMarkInstallGeneratedMutation");
    expect(irreversible).toBeLessThan(mainFile);
    expect(mainFile).toBeLessThan(partial);
    expect(partial).toBeLessThan(generatedMutation);
    expect(install).not.toContain("IfErrors zc_install_reversible_failure");
    expect(advanceLifecycleStage(lifecycleStages.reversiblePreparation, lifecycleStages.fileMutation)).toBe(
      lifecycleStages.fileMutation,
    );
  });

  it("T40: dispatches each install failure stage through one idempotent owner", () => {
    expect(dispatchFailure(lifecycleStages.reversiblePreparation, false).actions).toEqual([
      "reversible-recovery",
    ]);
    for (const stage of [
      lifecycleStages.fileMutation,
      lifecycleStages.generatedMutation,
      lifecycleStages.postGeneratedIntegration,
    ]) {
      const first = dispatchFailure(stage, false);
      const second = dispatchFailure(stage, false, first.ownerDone);
      expect(first.actions).toEqual(["exact-preview-withdrawal", "repair-service-stop-only"]);
      expect(second.actions).toEqual([]);
    }
    const legacy = fs.readFileSync(
      path.join(repositoryRoot, "src-tauri", "windows", "installer-hooks.nsh"),
      "utf8",
    );
    const callback = functionBody(legacy, ".onInstFailed");
    expect(callback.trim()).toBe("Function .onInstFailed\n  Call ZCDispatchInstallFailureFinal");
  });

  it("T41: routes every generated resource and binary failure to partial handling", () => {
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    const install = sectionBody(generated, "Install");
    expect(install.match(/IfErrors zc_install_partial_failure/g)?.length).toBeGreaterThanOrEqual(6);
    expect(install).not.toContain("IfErrors zc_install_reversible_failure");
    const synchronous = fs.readFileSync(synchronousPath, "utf8");
    const partial = functionBody(synchronous, "ZCFailInstallPartial");
    expect(partial).toContain("Call ZCHandleGeneratedInstallFailureFinal");
    expect(partial).not.toContain("Call RestoreZenCanvasPreexistingService");
  });

  it("T42: treats a missing Preview DLL as withdrawn and non-successful", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const coherence = functionBody(final, "ZCCheckPostGeneratedProductCoherence");
    const cleanup = functionBody(final, "ZCRemoveCurrentPreviewRegistrationForFailure");
    expect(coherence).toContain('IfFileExists "${ZC_PREVIEW_INSTALLED_DLL}" 0');
    expect(cleanup).toContain("DeleteRegValue");
    expect(cleanup).toContain("Call NotifyZenCanvasPreviewAssociationChanged");
    expect(cleanup).not.toContain("RollbackZenCanvasPreview");
    expect(dispatchFailure(lifecycleStages.postGeneratedIntegration, false).actions).toEqual([
      "exact-preview-withdrawal",
      "repair-service-stop-only",
    ]);
  });

  it("T43: gates Preview rollback and service compensation on current coherence", () => {
    expect(dispatchFailure(lifecycleStages.postGeneratedIntegration, true).actions).toEqual([
      "preview-rollback",
      "captured-service-restore",
    ]);
    expect(dispatchFailure(lifecycleStages.postGeneratedIntegration, false).actions).toEqual([
      "exact-preview-withdrawal",
      "repair-service-stop-only",
    ]);

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    expect(handler).toContain("Call ZCCheckPostGeneratedProductCoherence");
    expect(handler).toContain("Call RestoreZenCanvasPreexistingService");
    expect(handler).toContain("Call ZCStopCapturedServiceForLifecycle");
    expect(handler).toContain("Call CompensateZenCanvasPostInstallService");
  });

  it("T44: keeps legacy callbacks as shims and retains generated hook isolation", () => {
    const legacy = fs.readFileSync(
      path.join(repositoryRoot, "src-tauri", "windows", "installer-hooks.nsh"),
      "utf8",
    );
    const callback = functionBody(legacy, ".onInstFailed");
    for (const forbidden of [
      "RollbackZenCanvasPreview",
      "RestoreZenCanvasPreexistingService",
      "CompensateZenCanvasPostInstallService",
      "CompensateZenCanvasFreshProductMetadata",
    ]) {
      expect(callback).not.toContain(forbidden);
    }
    const generated = buildZenCanvasNsisTemplate(fs.readFileSync(upstreamPath, "utf8"));
    for (const sectionName of ["Install", "Uninstall"]) {
      const section = sectionBody(generated, sectionName);
      expect(section).not.toContain("!insertmacro NSIS_HOOK_PREINSTALL");
      expect(section).not.toContain("!insertmacro NSIS_HOOK_POSTINSTALL");
      expect(section).not.toContain("!insertmacro NSIS_HOOK_PREUNINSTALL");
      expect(section).not.toContain("!insertmacro NSIS_HOOK_POSTUNINSTALL");
    }
  });
});
