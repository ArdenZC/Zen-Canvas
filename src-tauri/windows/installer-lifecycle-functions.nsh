; W4-04 synchronous package lifecycle owner.
; This file is included only through installer-lifecycle-wrapper.nsh by the
; package-only custom Tauri 2.11.2 template. It deliberately keeps the legacy
; .onInstFailed / un.onUninstFailed callbacks outside the correctness path.

Var ZC_LIFECYCLE_INSTALL_STAGE
Var ZC_LIFECYCLE_INSTALL_RECOVERY_DONE
Var ZC_LIFECYCLE_UNINSTALL_STAGE
Var ZC_LIFECYCLE_UNINSTALL_RECOVERY_DONE
Var ZC_LIFECYCLE_GATE_OK
Var ZC_LIFECYCLE_STOP_OK

; Resolve the main desktop process without aborting from inside the gate. The
; Global Index service has already been stopped through SCM before this runs,
; so the name-only Tauri process helper cannot kill the service process.
Function ZCResolveMainAppGate
  StrCpy $ZC_LIFECYCLE_GATE_OK 0
  nsis_tauri_utils::StrReplace "$(appRunning)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R1
  nsis_tauri_utils::StrReplace "$(appRunningOkKill)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R2
  nsis_tauri_utils::StrReplace "$(failedToKillApp)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R3

  nsis_tauri_utils::FindProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $R0 != 0
    StrCpy $ZC_LIFECYCLE_GATE_OK 1
    Return
  ${EndIf}

  IfSilent zc_install_gate_kill zc_install_gate_prompt
zc_install_gate_prompt:
  MessageBox MB_OKCANCEL "$R2" IDOK zc_install_gate_kill IDCANCEL zc_install_gate_cancel
zc_install_gate_kill:
  nsis_tauri_utils::KillProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  Sleep 500
  ${If} $R0 = 0
  ${OrIf} $R0 = 2
    StrCpy $ZC_LIFECYCLE_GATE_OK 1
    Return
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "$R3" /SD IDOK
  Return
zc_install_gate_cancel:
  Return
FunctionEnd

Function un.ZCResolveMainAppGate
  StrCpy $ZC_LIFECYCLE_GATE_OK 0
  nsis_tauri_utils::StrReplace "$(appRunning)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R1
  nsis_tauri_utils::StrReplace "$(appRunningOkKill)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R2
  nsis_tauri_utils::StrReplace "$(failedToKillApp)" "{{product_name}}" "${PRODUCTNAME}"
  Pop $R3

  nsis_tauri_utils::FindProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $R0 != 0
    StrCpy $ZC_LIFECYCLE_GATE_OK 1
    Return
  ${EndIf}

  IfSilent zc_uninstall_gate_kill zc_uninstall_gate_prompt
zc_uninstall_gate_prompt:
  MessageBox MB_OKCANCEL "$R2" IDOK zc_uninstall_gate_kill IDCANCEL zc_uninstall_gate_cancel
zc_uninstall_gate_kill:
  nsis_tauri_utils::KillProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  Sleep 500
  ${If} $R0 = 0
  ${OrIf} $R0 = 2
    StrCpy $ZC_LIFECYCLE_GATE_OK 1
    Return
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "$R3" /SD IDOK
  Return
zc_uninstall_gate_cancel:
  Return
FunctionEnd

; Stop only the service captured at install entry. This is intentionally
; non-aborting so the caller can synchronously restore Preview/service state.
Function ZCStopCapturedServiceForLifecycle
  StrCpy $ZC_LIFECYCLE_STOP_OK 0
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_PREEXISTING_SERVICE == 0
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
      StrCpy $ZC_LIFECYCLE_STOP_OK 1
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}

  Call ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    StrCpy $ZC_LIFECYCLE_STOP_OK 1
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call WaitForZenCanvasIndexServiceStopped
    ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
      StrCpy $ZC_LIFECYCLE_STOP_OK 1
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
    Return
  ${EndIf}

  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    Call ReadZenCanvasIndexServiceOwnership
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
      Return
    ${EndIf}
    Call ReadZenCanvasIndexServiceRuntimeState
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
      StrCpy $ZC_LIFECYCLE_STOP_OK 1
    ${EndIf}
    Return
  ${EndIf}
  Call WaitForZenCanvasIndexServiceStopped
  ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
    StrCpy $ZC_LIFECYCLE_STOP_OK 1
  ${EndIf}
FunctionEnd

Function un.ZCStopCapturedServiceForLifecycle
  StrCpy $ZC_LIFECYCLE_STOP_OK 0
  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_UNINSTALL_ORIGINAL_SERVICE == 0
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
      StrCpy $ZC_LIFECYCLE_STOP_OK 1
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}

  Call un.ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    StrCpy $ZC_LIFECYCLE_STOP_OK 1
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call un.WaitForZenCanvasIndexServiceStopped
    ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
      StrCpy $ZC_LIFECYCLE_STOP_OK 1
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
    Return
  ${EndIf}

  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    Call un.ReadZenCanvasIndexServiceOwnership
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
      Return
    ${EndIf}
    Call un.ReadZenCanvasIndexServiceRuntimeState
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
      StrCpy $ZC_LIFECYCLE_STOP_OK 1
    ${EndIf}
    Return
  ${EndIf}
  Call un.WaitForZenCanvasIndexServiceStopped
  ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
    StrCpy $ZC_LIFECYCLE_STOP_OK 1
  ${EndIf}
FunctionEnd

Function ZCRecoverInstallReversible
  ${If} $ZC_LIFECYCLE_INSTALL_STAGE != 1
    Return
  ${EndIf}
  ${If} $ZC_LIFECYCLE_INSTALL_RECOVERY_DONE == 1
    Return
  ${EndIf}
  StrCpy $ZC_LIFECYCLE_INSTALL_RECOVERY_DONE 1
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call RollbackZenCanvasPreviewQuiesce
  ${EndIf}
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
  Call RestoreZenCanvasPreexistingService
  StrCpy $ZC_LIFECYCLE_INSTALL_STAGE 0
FunctionEnd

Function un.ZCRecoverUninstallReversible
  ${If} $ZC_LIFECYCLE_UNINSTALL_STAGE != 1
    Return
  ${EndIf}
  ${If} $ZC_LIFECYCLE_UNINSTALL_RECOVERY_DONE == 1
    Return
  ${EndIf}
  StrCpy $ZC_LIFECYCLE_UNINSTALL_RECOVERY_DONE 1
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call un.RollbackZenCanvasPreviewQuiesce
    Call un.VerifyZenCanvasPreviewRecovery
  ${Else}
    StrCpy $ZC_UNINSTALL_PREVIEW_RECOVERED 1
  ${EndIf}
  Call un.RestoreZenCanvasOriginalService
  StrCpy $ZC_LIFECYCLE_UNINSTALL_STAGE 0
FunctionEnd

Function ZCLifecycleUserAbort
  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == 1
    Call ZCRecoverInstallReversible
    ${If} $ZC_POSTINSTALL_SERVICE_CLEAN != 1
      Abort
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_LIFECYCLE_INSTALL_STAGE >= 2
    ; Once generated file mutation has succeeded, do not permit an arbitrary
    ; mid-section cancel to bypass the controlled partial-failure owner.
    Abort
  ${EndIf}
FunctionEnd

Function un.ZCLifecycleUserAbort
  ${If} $ZC_LIFECYCLE_UNINSTALL_STAGE == 1
    Call un.ZCRecoverUninstallReversible
    ${If} $ZC_UNINSTALL_PREVIEW_RECOVERED != 1
    ${OrIf} $ZC_UNINSTALL_SERVICE_CLEAN != 1
      Abort
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_LIFECYCLE_UNINSTALL_STAGE >= 2
    Abort
  ${EndIf}
FunctionEnd

Function ZCInitializeInstallLifecycle
  StrCpy $ZC_MAIN_BINARY_FILENAME "${MAINBINARYNAME}.exe"
  StrCpy $ZC_UNINSTALLER_REGISTRY_KEY "${UNINSTKEY}"
  StrCpy $ZC_MANUFACTURER_PRODUCT_KEY "${MANUPRODUCTKEY}"
  StrCpy $ZC_PRODUCT_NAME "${PRODUCTNAME}"
  StrCpy $ZC_MANUFACTURER_NAME "${MANUFACTURER}"
  StrCpy $ZC_INDEX_SERVICE_CREATED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_SUCCEEDED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_OWNERSHIP_VERIFIED 0
  StrCpy $ZC_POSTINSTALL_ACTIVE 0
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1
  StrCpy $ZC_INSTALL_FAILURE_COMPENSATED 0
  ; Keep the legacy .onInstFailed callback outside the correctness path.
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
  StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  StrCpy $ZC_PREVIEW_TXN_COUNT 0
  StrCpy $ZC_PREEXISTING_SERVICE 0
  StrCpy $ZC_PREEXISTING_SERVICE_WAS_RUNNING 0
  StrCpy $ZC_PREEXISTING_SERVICE_STATE_CAPTURED 0
  StrCpy $ZC_LIFECYCLE_INSTALL_STAGE 1
  StrCpy $ZC_LIFECYCLE_INSTALL_RECOVERY_DONE 0

  Call ValidateZenCanvasPreexistingProduct
  Call ValidateZenCanvasIndexServiceOwnership
  ${If} $ZC_PREEXISTING_PRODUCT == 0
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 1
      MessageBox MB_ICONSTOP|MB_OK "A Zen Canvas Global Index service already exists without consistent Tauri product metadata. Installation was not changed." /SD IDOK
      SetErrorLevel 2
      Abort
    ${EndIf}
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 1
    StrCpy $ZC_PREEXISTING_SERVICE 1
    Call CaptureZenCanvasPreexistingServiceState
  ${EndIf}
FunctionEnd

Function ZCPrepareInstallLifecycle
  Call ZCInitializeInstallLifecycle

  ; Preview withdrawal happens while the original service is still untouched.
  ; Its own bounded-release failure path rolls Preview back synchronously.
  Call QuiesceZenCanvasPreviewBeforeInstall

  Call ZCStopCapturedServiceForLifecycle
  ${If} $ZC_LIFECYCLE_STOP_OK != 1
    Call ZCRecoverInstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not stop the exact captured Global Index service before file mutation. Preview and the captured service state were restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}

  Call ZCResolveMainAppGate
  ${If} $ZC_LIFECYCLE_GATE_OK != 1
    Call ZCRecoverInstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas installation was cancelled or the desktop process could not be closed before file mutation. Preview and the captured service state were restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
FunctionEnd

Function ZCMarkInstallIrreversible
  StrCpy $ZC_LIFECYCLE_INSTALL_STAGE 2
FunctionEnd

Function ZCFailInstallReversible
  Call ZCRecoverInstallReversible
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not replace the main executable before any generated install mutation was committed. The prior Preview and captured service state were restored where verifiable." /SD IDOK
  SetErrorLevel 2
  Abort
FunctionEnd

Function ZCFailInstallPartial
  ; Generated mutation has already succeeded at least once. Do not pretend this
  ; is a product-level rollback: keep Preview withdrawn and a repair service
  ; stopped because the executable/resource set may be mixed or incomplete.
  StrCpy $ZC_LIFECYCLE_INSTALL_STAGE 3
  StrCpy $ZC_INSTALL_FAILURE_COMPENSATED 1
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call CommitZenCanvasPreviewQuiesce
  ${EndIf}

  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1
  ${If} $ZC_PREEXISTING_PRODUCT == 0
    Call CompensateZenCanvasFreshProductMetadata
  ${EndIf}

  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas installation stopped after generated file mutation began. Preview remains safely withdrawn and the captured service remains stopped because product artifact coherence can no longer be proven. Fresh exact-owned partial product metadata was neutralized where safe; repair metadata was preserved." /SD IDOK
  SetErrorLevel 2
  Abort
FunctionEnd

Function ZCFinishInstallLifecycle
  StrCpy $ZC_LIFECYCLE_INSTALL_STAGE 0
  StrCpy $ZC_LIFECYCLE_INSTALL_RECOVERY_DONE 1
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
FunctionEnd

Function un.ZCInitializeUninstallLifecycle
  StrCpy $ZC_MAIN_BINARY_FILENAME "${MAINBINARYNAME}.exe"
  StrCpy $ZC_UNINSTALLER_REGISTRY_KEY "${UNINSTKEY}"
  StrCpy $ZC_MANUFACTURER_PRODUCT_KEY "${MANUPRODUCTKEY}"
  StrCpy $ZC_PRODUCT_NAME "${PRODUCTNAME}"
  StrCpy $ZC_MANUFACTURER_NAME "${MANUFACTURER}"
  StrCpy $ZC_EXPECTED_INSTALL_LOCATION "$\"$INSTDIR$\""
  StrCpy $ZC_EXPECTED_UNINSTALL_STRING "$\"$INSTDIR\uninstall.exe$\""
  StrCpy $ZC_EXPECTED_DISPLAY_ICON "$\"$INSTDIR\$ZC_MAIN_BINARY_FILENAME$\""
  StrCpy $ZC_EXPECTED_DISPLAY_VERSION "${VERSION}"
  StrCpy $ZC_EXPECTED_PUBLISHER "$ZC_MANUFACTURER_NAME"
  StrCpy $ZC_EXPECTED_HOMEPAGE "${HOMEPAGE}"
  StrCpy $ZC_PREVIEW_ARTIFACT_REMOVED 0
  StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 1
  StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  StrCpy $ZC_PREVIEW_TXN_COUNT 0
  ; The legacy un.onUninstFailed recovery owner remains disabled.
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 0
  StrCpy $ZC_UNINSTALL_RECOVERY_DONE 1
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE 0
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE_WAS_RUNNING 0
  StrCpy $ZC_UNINSTALL_SERVICE_STATE_CAPTURED 0
  StrCpy $ZC_UNINSTALL_PREDELETE_EVIDENCE_CAPTURED 0
  StrCpy $ZC_UNINSTALL_PREDELETE_COHERENT 0
  StrCpy $ZC_UNINSTALL_PREVIEW_RECOVERED 0
  StrCpy $ZC_LIFECYCLE_UNINSTALL_STAGE 1
  StrCpy $ZC_LIFECYCLE_UNINSTALL_RECOVERY_DONE 0

  Call un.ValidateZenCanvasPreviewCore
  Call un.ValidateZenCanvasIndexServiceOwnership
  Call un.CaptureZenCanvasOriginalServiceState
  Call un.CheckZenCanvasPreDeleteProductEvidence
  ${If} $ZC_UNINSTALL_PREDELETE_COHERENT != 1
    MessageBox MB_ICONSTOP|MB_OK "The installed Zen Canvas product could not be verified as a coherent pre-delete installation. Uninstall was not changed." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  StrCpy $ZC_UNINSTALL_PREDELETE_EVIDENCE_CAPTURED 1
FunctionEnd

Function un.ZCPrepareUninstallLifecycle
  Call un.ZCInitializeUninstallLifecycle

  Call un.QuiesceZenCanvasPreviewBeforeUninstall

  Call un.ZCStopCapturedServiceForLifecycle
  ${If} $ZC_LIFECYCLE_STOP_OK != 1
    Call un.ZCRecoverUninstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not stop the exact captured Global Index service before uninstall file deletion. Preview and the original service state were restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}

  Call un.ZCResolveMainAppGate
  ${If} $ZC_LIFECYCLE_GATE_OK != 1
    Call un.ZCRecoverUninstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas uninstall was cancelled or the desktop process could not be closed before file deletion. Preview and the original service state were restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
FunctionEnd

Function un.ZCMarkUninstallIrreversible
  StrCpy $ZC_LIFECYCLE_UNINSTALL_STAGE 2
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 2
FunctionEnd

Function un.ZCFailUninstallReversible
  Call un.ZCRecoverUninstallReversible
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not delete the main executable before uninstall became irreversible. Preview and the original service state were restored where verifiable." /SD IDOK
  SetErrorLevel 2
  Abort
FunctionEnd

Function un.ZCFailUninstallPartial
  ; At least one critical generated delete has succeeded. Never recreate a
  ; Preview registration that could point at a removed DLL and never restart a
  ; service whose executable may already be gone.
  StrCpy $ZC_LIFECYCLE_UNINSTALL_STAGE 3
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 2
  SetErrorLevel 2
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call un.CommitZenCanvasPreviewQuiesce
  ${EndIf}
  Call un.DeleteZenCanvasIndexService
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas uninstall is incomplete after generated deletion began. Preview remains withdrawn and the exact-owned Global Index service was removed where verifiable; product files or metadata may remain." /SD IDOK
  Abort
FunctionEnd

Function un.ZCFinishUninstallLifecycle
  StrCpy $ZC_LIFECYCLE_UNINSTALL_STAGE 0
  StrCpy $ZC_LIFECYCLE_UNINSTALL_RECOVERY_DONE 1
FunctionEnd
