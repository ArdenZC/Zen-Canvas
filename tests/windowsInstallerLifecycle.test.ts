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
const installerHooksPath = path.join(
  repositoryRoot,
  "src-tauri",
  "windows",
  "installer-hooks.nsh",
);

function sectionBody(source: string, sectionName: string) {
  const start = source.indexOf(`Section ${sectionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("SectionEnd", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function normalizeNewlines(source: string) {
  return source.replace(/\r\n?/gu, "\n");
}

function functionBody(source: string, functionName: string) {
  const start = source.indexOf(`Function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("FunctionEnd", start);
  expect(end).toBeGreaterThan(start);
  return normalizeNewlines(source.slice(start, end));
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
  stage: number,
) {
  return stage === lifecycleStages.fileMutation || stage === lifecycleStages.generatedMutation
    ? "STOPPED"
    : original;
}

type FailureProduct = "fresh" | "repair" | "unknown";

function partialFailureActions(product: FailureProduct = "repair") {
  if (product === "fresh") {
    return ["exact-preview-withdrawal", "fresh-service-compensation"];
  }
  if (product === "unknown") {
    return ["exact-preview-withdrawal", "service-cleanup-incomplete"];
  }
  return ["exact-preview-withdrawal", "repair-service-stop-only"];
}

function metadataFailureActions(product: FailureProduct) {
  if (product === "fresh") {
    return ["fresh-metadata-compensation"];
  }
  if (product === "repair") {
    return ["repair-metadata-preserved"];
  }
  return ["metadata-cleanup-incomplete"];
}

function metadataFailureReport(product: FailureProduct, cleanupVerified: boolean) {
  if (product === "fresh") {
    return cleanupVerified ? "fresh-metadata-neutralized" : "fresh-metadata-incomplete";
  }
  if (product === "repair") {
    return "repair-metadata-preserved";
  }
  return "metadata-cleanup-incomplete";
}

function dispatchFailure(
  stage: number,
  coherent: boolean,
  product: FailureProduct = "repair",
  ownerDone = false,
) {
  if (ownerDone || stage === lifecycleStages.inactive) {
    return { ownerDone, actions: [] as string[], metadataActions: [] as string[] };
  }
  if (stage === lifecycleStages.reversiblePreparation) {
    return { ownerDone: true, actions: ["reversible-recovery"], metadataActions: [] as string[] };
  }
  if (stage === lifecycleStages.fileMutation || stage === lifecycleStages.generatedMutation) {
    return {
      ownerDone: true,
      actions: partialFailureActions(product),
      metadataActions: metadataFailureActions(product),
    };
  }
  if (stage === lifecycleStages.complete) {
    return { ownerDone: true, actions: [] as string[], metadataActions: [] as string[] };
  }
  if (stage !== lifecycleStages.postGeneratedIntegration) {
    return { ownerDone: true, actions: ["fail-closed"], metadataActions: [] as string[] };
  }
  return {
    ownerDone: true,
    actions: coherent
      ? product === "fresh"
        ? ["preview-rollback", "fresh-service-compensation"]
        : product === "repair"
          ? ["preview-rollback", "captured-service-restore"]
          : ["preview-rollback", "service-cleanup-incomplete"]
      : partialFailureActions(product),
    metadataActions: metadataFailureActions(product),
  };
}

function labeledBody(source: string, label: string) {
  const start = source.indexOf(`${label}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("FunctionEnd", start);
  return source.slice(start, end >= 0 ? end : source.length);
}

function nsisConditionalBody(source: string, marker: string, condition: string) {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const ifIndex = source.indexOf(condition, markerIndex);
  expect(ifIndex).toBeGreaterThan(markerIndex);

  const tokenPattern = /\$\{If\}|\$\{EndIf\}/g;
  tokenPattern.lastIndex = ifIndex;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(source)) !== null) {
    if (match[0] === "${If}") {
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return source.slice(ifIndex, match.index);
      }
    }
  }
  throw new Error(`Unclosed NSIS conditional for ${marker}`);
}

function loopBody(source: string, label: string, nextLabel: string) {
  const start = source.indexOf(`${label}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  const endMarker =
    nextLabel === "FunctionEnd" || nextLabel === "!macroend"
      ? nextLabel
      : `${nextLabel}:`;
  const end = source.indexOf(endMarker, start + label.length + 1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function installerHooksSource() {
  return normalizeNewlines(fs.readFileSync(installerHooksPath, "utf8"));
}

function evaluateEnumRegKeyModel(
  results: readonly (string | "ERROR")[],
  target: string,
) {
  for (const result of results) {
    if (result === "ERROR") {
      return "unknown" as const;
    }
    if (result === "") {
      return "absent" as const;
    }
    if (result === target) {
      return "present" as const;
    }
  }
  return "unknown" as const;
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
    expect(failedRepairServiceState("RUNNING", lifecycleStages.postGeneratedIntegration)).toBe(
      "RUNNING",
    );
    expect(failedRepairServiceState("STOPPED", lifecycleStages.postGeneratedIntegration)).toBe(
      "STOPPED",
    );

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
      const second = dispatchFailure(stage, false, "repair", first.ownerDone);
      expect(first.actions).toEqual(partialFailureActions());
      expect(second.actions).toEqual([]);
      expect(first.metadataActions).toEqual(metadataFailureActions("repair"));
      expect(second.metadataActions).toEqual([]);
    }
    expect(dispatchFailure(lifecycleStages.postGeneratedIntegration, true).actions).toEqual([
      "preview-rollback",
      "captured-service-restore",
    ]);
    expect(dispatchFailure(lifecycleStages.complete, true).actions).toEqual([]);
    const legacy = fs.readFileSync(
      path.join(repositoryRoot, "src-tauri", "windows", "installer-hooks.nsh"),
      "utf8",
    );
    const callback = functionBody(legacy, ".onInstFailed");
    expect(callback.trim()).toBe("Function .onInstFailed\n  Call ZCDispatchInstallFailureFinal");
    const uninstallCallback = functionBody(legacy, "un.onUninstFailed");
    expect(uninstallCallback.trim()).toBe(
      "Function un.onUninstFailed\n  Call un.RecoverZenCanvasPreDeleteAbort",
    );
  });

  it("T40: normalizes LF and CRLF without weakening exact callback bodies", () => {
    const lf = [
      "Function .onInstFailed",
      "  Call ZCDispatchInstallFailureFinal",
      "FunctionEnd",
    ].join("\n");
    const crlf = lf.replace(/\n/gu, "\r\n");
    const expected = "Function .onInstFailed\n  Call ZCDispatchInstallFailureFinal";

    expect(functionBody(lf, ".onInstFailed").trim()).toBe(expected);
    expect(functionBody(crlf, ".onInstFailed").trim()).toBe(expected);
    expect(functionBody(lf, ".onInstFailed").trim()).toBe(
      functionBody(crlf, ".onInstFailed").trim(),
    );
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
      ...partialFailureActions(),
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

  it("T45: Stage 2 cannot promote coherent-looking evidence into full rollback", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const stage2 = nsisConditionalBody(
      handler,
      "; Stage 2 has begun canonical product-file mutation.",
      "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_FILE_MUTATION}",
    );
    expect(stage2).toContain("Goto zc_post_install_irreversible_partial_failure");
    for (const forbidden of [
      "ZCCheckPostGeneratedProductCoherence",
      "RollbackZenCanvasPreviewQuiesce",
      "RollbackZenCanvasPreviewRegistration",
      "RestoreZenCanvasPreexistingService",
    ]) {
      expect(stage2).not.toContain(forbidden);
    }
    expect(dispatchFailure(lifecycleStages.fileMutation, true).actions).toEqual(
      partialFailureActions(),
    );
    expect(failedRepairServiceState("RUNNING", lifecycleStages.fileMutation)).toBe("STOPPED");
    expect(failedRepairServiceState("STOPPED", lifecycleStages.fileMutation)).toBe("STOPPED");
  });

  it("T46: Stage 3 cannot promote a complete-looking main EXE into full rollback", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const stage3 = nsisConditionalBody(
      handler,
      "; Stage 3 may have a complete-looking main EXE",
      "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_GENERATED_MUTATION}",
    );
    expect(stage3).toContain("Goto zc_post_install_irreversible_partial_failure");
    expect(dispatchFailure(lifecycleStages.generatedMutation, true).actions).toEqual(
      partialFailureActions(),
    );
    expect(stage3).not.toContain("Call ZCCheckPostGeneratedProductCoherence");
    expect(stage3).not.toContain("Call RestoreZenCanvasPreexistingService");
    expect(stage3).not.toContain("Call RollbackZenCanvasPreviewQuiesce");
    expect(stage3).not.toContain("Call RollbackZenCanvasPreviewRegistration");
    expect(failedRepairServiceState("RUNNING", lifecycleStages.generatedMutation)).toBe("STOPPED");
  });

  it("T47: only Stage 4 may use coherence-gated recovery", () => {
    expect(dispatchFailure(lifecycleStages.reversiblePreparation, true).actions).toEqual([
      "reversible-recovery",
    ]);
    expect(dispatchFailure(lifecycleStages.fileMutation, true).actions).toEqual(
      partialFailureActions(),
    );
    expect(dispatchFailure(lifecycleStages.generatedMutation, true).actions).toEqual(
      partialFailureActions(),
    );
    expect(dispatchFailure(lifecycleStages.postGeneratedIntegration, true).actions).toEqual([
      "preview-rollback",
      "captured-service-restore",
    ]);
    expect(dispatchFailure(lifecycleStages.postGeneratedIntegration, false).actions).toEqual(
      partialFailureActions(),
    );
    expect(dispatchFailure(lifecycleStages.complete, true).actions).toEqual([]);

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const stage4 = nsisConditionalBody(
      handler,
      "; Only the post-generated integration phase may use current-product",
      "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_POST_GENERATED_INTEGRATION}",
    );
    expect(stage4).toContain("Call ZCCheckPostGeneratedProductCoherence");
    expect(stage4).toContain("Call RollbackZenCanvasPreviewQuiesce");
    expect(stage4).toContain("Call RestoreZenCanvasPreexistingService");
    expect(stage4).toContain("Goto zc_post_install_irreversible_partial_failure");
    expect(handler.match(/Call ZCCheckPostGeneratedProductCoherence/g)?.length).toBe(1);
  });

  it("T48: Stage 2/3 repair service safety never starts a captured service", () => {
    for (const stage of [lifecycleStages.fileMutation, lifecycleStages.generatedMutation]) {
      expect(failedRepairServiceState("RUNNING", stage)).toBe("STOPPED");
      expect(failedRepairServiceState("STOPPED", stage)).toBe("STOPPED");
      expect(dispatchFailure(stage, true).actions).not.toContain("captured-service-restore");
    }
    expect(dispatchFailure(lifecycleStages.fileMutation, true).actions).toEqual(
      partialFailureActions(),
    );
    expect(dispatchFailure(lifecycleStages.generatedMutation, true).actions).toEqual(
      partialFailureActions(),
    );

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const partialStart = handler.indexOf("zc_post_install_irreversible_partial_failure:");
    expect(partialStart).toBeGreaterThanOrEqual(0);
    const partial = handler.slice(partialStart);
    expect(partial).toContain("Call ZCStopCapturedServiceForLifecycle");
    expect(partial).not.toContain("Call RestoreZenCanvasPreexistingService");
    expect(partial).not.toContain('sc.exe\" start');
    expect(partial).toContain("Call CompensateZenCanvasPostInstallService");
  });

  it("T49: Stage 2/3 Preview failure keeps the withdrawal transaction committed", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const partialStart = handler.indexOf("zc_post_install_irreversible_partial_failure:");
    expect(partialStart).toBeGreaterThanOrEqual(0);
    const partial = handler.slice(partialStart);
    expect(partial).toContain("Call ZCRemoveCurrentPreviewRegistrationForFailure");
    expect(partial).toContain("Call CommitZenCanvasPreviewQuiesce");
    expect(partial).toContain("Call CommitZenCanvasPreviewRegistration");
    expect(partial).not.toContain("Call RollbackZenCanvasPreviewQuiesce");
    expect(partial).not.toContain("Call RollbackZenCanvasPreviewRegistration");
    expect(partial).not.toContain("Call ZCCheckPostGeneratedProductCoherence");

    for (const stage of [lifecycleStages.fileMutation, lifecycleStages.generatedMutation]) {
      expect(dispatchFailure(stage, true).actions).toEqual(partialFailureActions());
    }
  });

  it("T50: Stage 4 coherent failure converges through common metadata finalization", () => {
    const outcome = dispatchFailure(lifecycleStages.postGeneratedIntegration, true, "fresh");
    expect(outcome.actions).toEqual(["preview-rollback", "fresh-service-compensation"]);
    expect(outcome.metadataActions).toEqual(["fresh-metadata-compensation"]);
    expect(metadataFailureReport("fresh", true)).toBe("fresh-metadata-neutralized");

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const stage4 = nsisConditionalBody(
      handler,
      "; Only the post-generated integration phase may use current-product",
      "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_POST_GENERATED_INTEGRATION}",
    );
    expect(stage4).toContain("Goto zc_post_install_metadata_failure_finalization");
    expect(stage4).not.toContain("Return");

    const metadata = labeledBody(handler, "zc_post_install_metadata_failure_finalization");
    expect(metadata).toContain("Call CompensateZenCanvasFreshProductMetadata");
    expect(handler.match(/Call CompensateZenCanvasFreshProductMetadata/g)).toHaveLength(1);
  });

  it("T51: Stage 4 coherent repair failure preserves existing metadata after service recovery", () => {
    const outcome = dispatchFailure(lifecycleStages.postGeneratedIntegration, true, "repair");
    expect(outcome.actions).toEqual(["preview-rollback", "captured-service-restore"]);
    expect(outcome.metadataActions).toEqual(["repair-metadata-preserved"]);
    expect(metadataFailureReport("repair", true)).toBe("repair-metadata-preserved");

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const metadata = labeledBody(handler, "zc_post_install_metadata_failure_finalization");
    const freshBranchStart = metadata.indexOf("${If} $ZC_PREEXISTING_PRODUCT == 0");
    const repairBranchStart = metadata.indexOf("${ElseIf} $ZC_PREEXISTING_PRODUCT == 1");
    expect(freshBranchStart).toBeGreaterThanOrEqual(0);
    expect(repairBranchStart).toBeGreaterThan(freshBranchStart);
    expect(metadata.slice(freshBranchStart, repairBranchStart)).toContain(
      "Call CompensateZenCanvasFreshProductMetadata",
    );
    expect(metadata.slice(repairBranchStart)).toContain(
      "existing Add/Remove Programs metadata, install location authority, and uninstall.exe were preserved.",
    );
    expect(metadata.slice(repairBranchStart)).not.toContain(
      "Call CompensateZenCanvasFreshProductMetadata",
    );
    expect(handler.match(/Call CompensateZenCanvasFreshProductMetadata/g)).toHaveLength(1);
  });

  it("T52: Stage 4 incoherent failure uses partial handling before fresh metadata compensation", () => {
    const outcome = dispatchFailure(lifecycleStages.postGeneratedIntegration, false, "fresh");
    expect(outcome.actions).toEqual([
      "exact-preview-withdrawal",
      "fresh-service-compensation",
    ]);
    expect(outcome.metadataActions).toEqual(["fresh-metadata-compensation"]);

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const stage4 = nsisConditionalBody(
      handler,
      "; Only the post-generated integration phase may use current-product",
      "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_POST_GENERATED_INTEGRATION}",
    );
    expect(stage4).toContain("Goto zc_post_install_irreversible_partial_failure");
    const partialStart = handler.indexOf("zc_post_install_irreversible_partial_failure:");
    const metadataStart = handler.indexOf("zc_post_install_metadata_failure_finalization:");
    expect(partialStart).toBeGreaterThanOrEqual(0);
    expect(metadataStart).toBeGreaterThan(partialStart);
    const partial = handler.slice(partialStart, metadataStart);
    expect(partial).toContain("Goto zc_post_install_metadata_failure_finalization");
    expect(partial).not.toContain("RollbackZenCanvasPreview");
    expect(partial).not.toContain("RestoreZenCanvasPreexistingService");
  });

  it("T53: Stage 2/3 fresh failures share the same metadata finalization tail", () => {
    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    for (const [stage, marker, condition] of [
      [
        lifecycleStages.fileMutation,
        "; Stage 2 has begun canonical product-file mutation.",
        "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_FILE_MUTATION}",
      ],
      [
        lifecycleStages.generatedMutation,
        "; Stage 3 may have a complete-looking main EXE",
        "  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_GENERATED_MUTATION}",
      ],
    ] as const) {
      const outcome = dispatchFailure(stage, true, "fresh");
      expect(outcome.actions).toEqual([
        "exact-preview-withdrawal",
        "fresh-service-compensation",
      ]);
      expect(outcome.metadataActions).toEqual(["fresh-metadata-compensation"]);
      const branch = nsisConditionalBody(handler, marker, condition);
      expect(branch).toContain("Goto zc_post_install_irreversible_partial_failure");
      expect(branch).not.toContain("Call ZCCheckPostGeneratedProductCoherence");
    }

    const metadata = labeledBody(handler, "zc_post_install_metadata_failure_finalization");
    expect(metadata).toContain("Call CompensateZenCanvasFreshProductMetadata");
    expect(handler.match(/Call CompensateZenCanvasFreshProductMetadata/g)).toHaveLength(1);
    const partialStart = handler.indexOf("zc_post_install_irreversible_partial_failure:");
    const metadataStart = handler.indexOf("zc_post_install_metadata_failure_finalization:");
    const partial = handler.slice(partialStart, metadataStart);
    for (const forbidden of [
      "RollbackZenCanvasPreviewQuiesce",
      "RollbackZenCanvasPreviewRegistration",
      "RestoreZenCanvasPreexistingService",
    ]) {
      expect(partial).not.toContain(forbidden);
    }
  });

  it("T54: metadata cleanup truth remains explicit for fresh, repair, and uncertain ownership", () => {
    expect(metadataFailureReport("fresh", true)).toBe("fresh-metadata-neutralized");
    expect(metadataFailureReport("fresh", false)).toBe("fresh-metadata-incomplete");
    expect(metadataFailureReport("repair", true)).toBe("repair-metadata-preserved");
    expect(metadataFailureReport("unknown", false)).toBe("metadata-cleanup-incomplete");

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    const metadata = labeledBody(handler, "zc_post_install_metadata_failure_finalization");
    expect(metadata).toContain("StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1");
    expect(metadata).toContain("Call CompensateZenCanvasFreshProductMetadata");
    expect(metadata).toContain("StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0");
    const metadataStart = handler.indexOf("zc_post_install_metadata_failure_finalization:");
    expect(handler.slice(0, metadataStart)).not.toContain(
      "Call CompensateZenCanvasFreshProductMetadata",
    );

    const report = functionBody(final, "ZCFailPostInstallLifecycleFinal");
    expect(report).toContain("$ZC_POSTINSTALL_METADATA_CLEAN == 1");
    expect(report).toContain("Fresh-install metadata was neutralized where exact ownership was proven.");
    expect(report).toContain("Fresh-install metadata cleanup could not be fully verified; generated files may remain.");
  });

  it("T55: duplicate lifecycle callbacks cannot repeat metadata finalization", () => {
    const first = dispatchFailure(lifecycleStages.postGeneratedIntegration, true, "fresh");
    const second = dispatchFailure(
      lifecycleStages.postGeneratedIntegration,
      true,
      "fresh",
      first.ownerDone,
    );
    expect(first.metadataActions).toEqual(["fresh-metadata-compensation"]);
    expect(second.actions).toEqual([]);
    expect(second.metadataActions).toEqual([]);

    const final = fs.readFileSync(finalPath, "utf8");
    const handler = functionBody(final, "ZCHandlePostInstallFailureFinal");
    expect(handler.match(/Call CompensateZenCanvasFreshProductMetadata/g)).toHaveLength(1);
  });

  it("T56: product EnumRegKey loops terminate on empty and fail closed on errors", () => {
    const source = installerHooksSource();
    for (const [label, doneLabel, key] of [
      [
        "detect_uninstaller_key_loop",
        "detect_uninstaller_key_done",
        'EnumRegKey $1 HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" $0',
      ],
      [
        "detect_manufacturer_key_loop",
        "detect_manufacturer_key_done",
        'EnumRegKey $1 HKLM "Software\\$ZC_MANUFACTURER_NAME" $0',
      ],
    ] as const) {
      const loop = loopBody(source, label, doneLabel);
      const enumIndex = loop.indexOf(key);
      const errorIndex = loop.indexOf("${If} ${Errors}", enumIndex);
      const emptyIndex = loop.indexOf('${If} $1 == ""', enumIndex);
      const incrementIndex = loop.indexOf("IntOp $0 $0 + 1", enumIndex);
      const backedgeIndex = loop.indexOf(`Goto ${label}`, enumIndex);
      expect(enumIndex).toBeGreaterThanOrEqual(0);
      expect(errorIndex).toBeGreaterThan(enumIndex);
      expect(emptyIndex).toBeGreaterThan(errorIndex);
      expect(incrementIndex).toBeGreaterThan(emptyIndex);
      expect(backedgeIndex).toBeGreaterThan(incrementIndex);
      expect(loop.slice(errorIndex, emptyIndex)).toContain(
        "StrCpy $ZC_PREEXISTING_PRODUCT 2",
      );
      expect(loop.slice(emptyIndex, incrementIndex)).toContain(`Goto ${doneLabel}`);
    }

    const detect = functionBody(source, "DetectZenCanvasPreexistingProduct");
    const failClosedReturn = detect.indexOf("${If} $ZC_PREEXISTING_PRODUCT == 2");
    const presenceCalculation = detect.indexOf(
      "${If} $ZC_UNINSTALLER_KEY_PRESENT == 1",
    );
    expect(failClosedReturn).toBeGreaterThanOrEqual(0);
    expect(failClosedReturn).toBeLessThan(presenceCalculation);
  });

  it("T57: service presence distinguishes error, empty, and matching keys", () => {
    const source = installerHooksSource();
    const loop = loopBody(source, "service_key_presence_loop", "!macroend");
    const enumIndex = loop.indexOf(
      'EnumRegKey $2 HKLM "${ZC_INDEX_SERVICE_PARENT_KEY}" $1',
    );
    const errorIndex = loop.indexOf("${If} ${Errors}", enumIndex);
    const emptyIndex = loop.indexOf('${If} $2 == ""', enumIndex);
    const matchIndex = loop.indexOf(
      '${If} $2 == "${ZC_INDEX_SERVICE_NAME}"',
      enumIndex,
    );
    const incrementIndex = loop.indexOf("IntOp $1 $1 + 1", enumIndex);
    const backedgeIndex = loop.indexOf("Goto service_key_presence_loop", enumIndex);

    expect(errorIndex).toBeGreaterThan(enumIndex);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
    expect(matchIndex).toBeGreaterThan(emptyIndex);
    expect(incrementIndex).toBeGreaterThan(matchIndex);
    expect(backedgeIndex).toBeGreaterThan(incrementIndex);
    expect(loop.slice(errorIndex, emptyIndex)).toContain(
      "StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 2",
    );
    expect(loop.slice(emptyIndex, matchIndex)).toContain("Return");
    expect(loop.slice(matchIndex, incrementIndex)).toContain(
      "StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 2",
    );

    expect(source).toContain("$ZC_INDEX_SERVICE_OWNERSHIP 2");
  });

  it("T58: fresh metadata presence loops fail closed without deleting uncertain keys", () => {
    const source = installerHooksSource();
    for (const [functionName, label, ownedVar, key, presentVar] of [
      [
        "ReadZenCanvasFreshUninstallKeyPresence",
        "fresh_uninstall_key_presence_loop",
        "$ZC_FRESH_UNINSTALL_METADATA_OWNED",
        'EnumRegKey $1 HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" $0',
        "$ZC_FRESH_UNINSTALL_KEY_PRESENT",
      ],
      [
        "ReadZenCanvasFreshManufacturerKeyPresence",
        "fresh_manufacturer_key_presence_loop",
        "$ZC_FRESH_MANUFACTURER_METADATA_OWNED",
        'EnumRegKey $1 HKLM "Software\\$ZC_MANUFACTURER_NAME" $0',
        "$ZC_FRESH_MANUFACTURER_KEY_PRESENT",
      ],
    ] as const) {
      const functionSource = functionBody(source, functionName);
      const enumIndex = functionSource.indexOf(key);
      const errorIndex = functionSource.indexOf("${If} ${Errors}", enumIndex);
      const emptyIndex = functionSource.indexOf('${If} $1 == ""', enumIndex);
      const targetIndex = functionSource.indexOf('${If} $1 == $ZC_PRODUCT_NAME', enumIndex);
      const incrementIndex = functionSource.indexOf("IntOp $0 $0 + 1", enumIndex);
      const backedgeIndex = functionSource.lastIndexOf(`Goto ${label}`);

      expect(enumIndex).toBeGreaterThanOrEqual(0);
      expect(errorIndex).toBeGreaterThan(enumIndex);
      expect(emptyIndex).toBeGreaterThan(errorIndex);
      expect(targetIndex).toBeGreaterThan(emptyIndex);
      expect(incrementIndex).toBeGreaterThan(targetIndex);
      expect(backedgeIndex).toBeGreaterThan(incrementIndex);
      expect(functionSource.slice(errorIndex, emptyIndex)).toContain(
        `StrCpy ${ownedVar} 2`,
      );
      expect(functionSource.slice(errorIndex, emptyIndex)).toContain(
        "StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0",
      );
      expect(functionSource.slice(emptyIndex, targetIndex)).toContain("Return");
      expect(functionSource).toContain(`StrCpy ${presentVar} 1`);
    }

    const compensation = functionBody(source, "CompensateZenCanvasFreshProductMetadata");
    const conflict = compensation.indexOf(
      "${If} $ZC_FRESH_UNINSTALL_METADATA_OWNED == 2",
    );
    expect(conflict).toBeGreaterThanOrEqual(0);
    expect(compensation.slice(conflict)).toContain(
      "StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0",
    );
    expect(compensation.slice(conflict)).toContain("Goto fresh_metadata_cleanup_done");
    const conflictEnd = compensation.indexOf("${EndIf}", conflict);
    const cleanupDelete = compensation.indexOf(
      "DeleteRegKey HKLM \"$ZC_UNINSTALLER_REGISTRY_KEY\"",
      conflict,
    );
    expect(conflictEnd).toBeGreaterThan(conflict);
    expect(cleanupDelete).toBeGreaterThan(conflictEnd);
    expect(compensation.slice(conflict, conflictEnd)).not.toContain("DeleteRegKey");
  });

  it("T59: the finite EnumRegKey model maps empty to absent and errors to unknown", () => {
    expect(evaluateEnumRegKeyModel(["Alpha", "Beta", ""], "Zen Canvas")).toBe("absent");
    expect(evaluateEnumRegKeyModel(["Alpha", "Zen Canvas", "Gamma"], "Zen Canvas")).toBe(
      "present",
    );
    expect(evaluateEnumRegKeyModel(["Alpha", "ERROR"], "Zen Canvas")).toBe("unknown");
    expect(evaluateEnumRegKeyModel(["ERROR", ""], "Zen Canvas")).not.toBe("absent");
  });

  it("T60: every Zen-owned EnumRegKey loop has a finite empty exit and ownership error handling", () => {
    const windowsDir = path.join(repositoryRoot, "src-tauri", "windows");
    const productionNsisFiles = fs
      .readdirSync(windowsDir)
      .filter((fileName) => /\.(?:nsh|nsi)$/u.test(fileName))
      .filter((fileName) => fileName !== "tauri-2.11.2-installer.upstream.nsi");
    const occurrences = productionNsisFiles.flatMap((fileName) => {
      const source = normalizeNewlines(
        fs.readFileSync(path.join(windowsDir, fileName), "utf8"),
      );
      return [...source.matchAll(/^\s*(EnumRegKey\s+[^\r\n]+)/gmu)].map((match) => ({
        fileName,
        line: match[1],
      }));
    });

    expect(occurrences).toHaveLength(9);
    expect(occurrences.map(({ fileName, line }) => `${fileName}:${line}`)).toEqual(
      expect.arrayContaining([
        'installer-hooks.nsh:EnumRegKey $1 HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" $0',
        'installer-hooks.nsh:EnumRegKey $1 HKLM "Software\\$ZC_MANUFACTURER_NAME" $0',
        'installer-hooks.nsh:EnumRegKey $2 HKLM "${ZC_INDEX_SERVICE_PARENT_KEY}" $1',
        'installer-hooks.nsh:EnumRegKey $1 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}" $0',
        'installer-lifecycle-synchronous.nsh:EnumRegKey $1 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}" $0',
        'installer-lifecycle-final.nsh:EnumRegKey $2 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}" $1',
      ]),
    );

    const loopContracts = [
      [
        "installer-hooks.nsh",
        "detect_uninstaller_key_loop",
        "detect_uninstaller_key_done",
        "$1",
        "$0",
        "$ZC_PREEXISTING_PRODUCT 2",
      ],
      [
        "installer-hooks.nsh",
        "detect_manufacturer_key_loop",
        "detect_manufacturer_key_done",
        "$1",
        "$0",
        "$ZC_PREEXISTING_PRODUCT 2",
      ],
      [
        "installer-hooks.nsh",
        "service_key_presence_loop",
        "!macroend",
        "$2",
        "$1",
        "$ZC_INDEX_SERVICE_OWNERSHIP 2",
      ],
      [
        "installer-hooks.nsh",
        "fresh_uninstall_key_presence_loop",
        "FunctionEnd",
        "$1",
        "$0",
        "$ZC_FRESH_UNINSTALL_METADATA_OWNED 2",
      ],
      [
        "installer-hooks.nsh",
        "fresh_manufacturer_key_presence_loop",
        "FunctionEnd",
        "$1",
        "$0",
        "$ZC_FRESH_MANUFACTURER_METADATA_OWNED 2",
      ],
      ["installer-hooks.nsh", "stale_association_loop", "FunctionEnd", "$1", "$0", ""],
      ["installer-hooks.nsh", "un_stale_association_loop", "FunctionEnd", "$1", "$0", ""],
      [
        "installer-lifecycle-synchronous.nsh",
        "zc_lifecycle_stale_loop",
        "!macroend",
        "$1",
        "$0",
        "",
      ],
      [
        "installer-lifecycle-final.nsh",
        "zc_remove_current_preview_association_loop",
        "zc_remove_current_preview_association_done",
        "$2",
        "$1",
        "",
      ],
    ] as const;

    for (const [fileName, label, doneLabel, output, index, ownershipError] of loopContracts) {
      const source = normalizeNewlines(
        fs.readFileSync(path.join(windowsDir, fileName), "utf8"),
      );
      const loop = loopBody(source, label, doneLabel);
      expect(loop).toContain("EnumRegKey");
      const enumIndex = loop.indexOf("EnumRegKey");
      const emptyIndex = loop.indexOf(`${output} == ""`, enumIndex);
      const incrementIndex = loop.indexOf(`IntOp ${index} ${index} + 1`, enumIndex);
      const backedgeIndex = loop.lastIndexOf(`Goto ${label}`);
      expect(emptyIndex).toBeGreaterThan(enumIndex);
      expect(emptyIndex).toBeLessThan(incrementIndex);
      expect(incrementIndex).toBeLessThan(backedgeIndex);
      if (ownershipError !== "") {
        const errorIndex = loop.indexOf("${If} ${Errors}", enumIndex);
        expect(errorIndex).toBeGreaterThan(enumIndex);
        expect(loop.slice(errorIndex, emptyIndex)).toContain(`StrCpy ${ownershipError}`);
      }
    }
  });

  it("T61: EnumRegValue loops retain error-flag termination semantics", () => {
    const source = installerHooksSource();
    expect(source.match(/EnumRegValue\b/gu)).toHaveLength(2);
    const functionSource = functionBody(source, "CompensateZenCanvasFreshProductMetadata");
    for (const [enumLine, doneLabel] of [
      [
        'EnumRegValue $1 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" $0',
        "fresh_uninstall_values_done",
      ],
      [
        'EnumRegValue $1 HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" $0',
        "fresh_manufacturer_values_done",
      ],
    ] as const) {
      const enumIndex = functionSource.indexOf(enumLine);
      const doneIndex = functionSource.indexOf(`${doneLabel}:`);
      expect(enumIndex).toBeGreaterThanOrEqual(0);
      const errorIndex = functionSource.indexOf("${If} ${Errors}", enumIndex);
      expect(errorIndex).toBeGreaterThan(enumIndex);
      expect(doneIndex).toBeGreaterThan(errorIndex);
      expect(functionSource.slice(errorIndex, doneIndex)).toContain(`Goto ${doneLabel}`);
    }
    expect(functionSource).toContain('${If} $1 != ""');
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
