; Final package-only W4-04 orchestration layer.
; The generated Tauri template calls only these entry points for PRE/POST
; lifecycle ownership. Legacy NSIS_HOOK_PRE*/POST* macros remain defined by
; installer-hooks.nsh for compatibility but are not inserted by this package.

Function ZCResolveMainAppGateFinal
  StrCpy $ZC_LIFECYCLE_GATE_OK 0
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

  IfSilent zc_final_install_gate_kill 0
  ${If} $PassiveMode == 1
    Goto zc_final_install_gate_kill
  ${EndIf}
  MessageBox MB_OKCANCEL "$R2" IDOK zc_final_install_gate_kill IDCANCEL zc_final_install_gate_done

zc_final_install_gate_kill:
  nsis_tauri_utils::KillProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  Sleep 500
  nsis_tauri_utils::FindProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $R0 != 0
    StrCpy $ZC_LIFECYCLE_GATE_OK 1
    Return
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "$R3" /SD IDOK
zc_final_install_gate_done:
FunctionEnd

Function un.ZCResolveMainAppGateFinal
  StrCpy $ZC_LIFECYCLE_GATE_OK 0
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

  IfSilent zc_final_uninstall_gate_kill 0
  ${If} $PassiveMode == 1
    Goto zc_final_uninstall_gate_kill
  ${EndIf}
  MessageBox MB_OKCANCEL "$R2" IDOK zc_final_uninstall_gate_kill IDCANCEL zc_final_uninstall_gate_done

zc_final_uninstall_gate_kill:
  nsis_tauri_utils::KillProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  Sleep 500
  nsis_tauri_utils::FindProcess "${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $R0 != 0
    StrCpy $ZC_LIFECYCLE_GATE_OK 1
    Return
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "$R3" /SD IDOK
zc_final_uninstall_gate_done:
FunctionEnd

Function ZCPrepareInstallLifecycleFinal
  Call ZCInitializeInstallLifecycle

  Call ZCStopCapturedServiceForLifecycle
  ${If} $ZC_LIFECYCLE_STOP_OK != 1
    Call ZCRecoverInstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not stop the exact captured Global Index service before file mutation. The captured service state was restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}

  Call ZCResolveMainAppGateFinal
  ${If} $ZC_LIFECYCLE_GATE_OK != 1
    Call ZCRecoverInstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas installation was cancelled or the desktop process could not be closed before file mutation. The captured service state was restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}

  Call ZCQuiescePreviewForLifecycle
  ${If} $ZC_LIFECYCLE_PREVIEW_OK != 1
    Call ZCRecoverInstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not quiesce and release the exact Preview Handler before file mutation. Preview and the captured service state were restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
FunctionEnd

Function un.ZCPrepareUninstallLifecycleFinal
  Call un.ZCInitializeUninstallLifecycle

  Call un.ZCStopCapturedServiceForLifecycle
  ${If} $ZC_LIFECYCLE_STOP_OK != 1
    Call un.ZCRecoverUninstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not stop the exact captured Global Index service before uninstall deletion. The original service state was restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}

  Call un.ZCResolveMainAppGateFinal
  ${If} $ZC_LIFECYCLE_GATE_OK != 1
    Call un.ZCRecoverUninstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas uninstall was cancelled or the desktop process could not be closed before file deletion. The original service state was restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}

  Call un.ZCQuiescePreviewForLifecycle
  ${If} $ZC_LIFECYCLE_PREVIEW_OK != 1
    Call un.ZCRecoverUninstallReversible
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas could not quiesce and release the exact Preview Handler before file deletion. Preview and the original service state were restored where verifiable." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
FunctionEnd

Function ZCEnsurePostInstallServiceFinal
  Call ReadZenCanvasIndexServiceOwnership

  ${If} $ZC_PREEXISTING_SERVICE == 1
    ; A captured repair service must still be the exact same owned service.
    ; Never recreate it if it disappeared and never adopt a replacement.
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
      StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The captured Zen Canvas Global Index service disappeared or changed ownership during repair; it was not recreated or adopted."
      Call FailZenCanvasPostInstall
    ${EndIf}
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
    Call RestoreZenCanvasPreexistingService
    ${If} $ZC_POSTINSTALL_SERVICE_CLEAN != 1
      StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The captured Zen Canvas Global Index service could not be restored to its original RUNNING/STOPPED state after repair."
      Call FailZenCanvasPostInstall
    ${EndIf}
    Return
  ${EndIf}

  ; No service was captured. An exact or foreign service appearing between
  ; PREINSTALL and POSTINSTALL is concurrent state, not current-attempt
  ; ownership. Fresh/missing-service repair may create only from true absence.
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 0
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "A Global Index service appeared after preinstall capture and was not adopted or modified."
    Call FailZenCanvasPostInstall
  ${EndIf}
  Call InstallZenCanvasIndexService
FunctionEnd

Function ZCPostInstallLifecycleFinal
  ; Any fatal POSTINSTALL path inherits a deterministic non-zero silent exit.
  ; Reset to success only after service + Preview registration fully complete.
  SetErrorLevel 2
  StrCpy $ZC_MAIN_BINARY_FILENAME "${MAINBINARYNAME}.exe"
  StrCpy $ZC_UNINSTALLER_REGISTRY_KEY "${UNINSTKEY}"
  StrCpy $ZC_MANUFACTURER_PRODUCT_KEY "${MANUPRODUCTKEY}"
  StrCpy $ZC_INDEX_SERVICE_CREATED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_SUCCEEDED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_OWNERSHIP_VERIFIED 0
  StrCpy $ZC_POSTINSTALL_ACTIVE 1

  Call ZCEnsurePostInstallServiceFinal
  Call InstallZenCanvasPreviewHandler
  Call CommitZenCanvasPreviewQuiesce

  StrCpy $ZC_POSTINSTALL_ACTIVE 0
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
  SetErrorLevel 0
FunctionEnd

Function un.ZCPostUninstallLifecycleFinal
  ; Keep non-zero until all exact-owned finalization succeeds. If any helper
  ; aborts, silent uninstall returns failure instead of a false success.
  SetErrorLevel 2
  Call un.FinalizeZenCanvasPreviewUninstall
  Call un.DeleteZenCanvasIndexService
  ${If} $ZC_PREVIEW_ARTIFACT_REMOVED != 1
    ${If} $ZC_UNINSTALL_SERVICE_CLEAN == 1
      MessageBox MB_ICONSTOP|MB_OK "Uninstall is incomplete. Preview registration remains withdrawn, but the Preview Handler DLL could not be removed; Global Index service cleanup completed." /SD IDOK
    ${Else}
      MessageBox MB_ICONSTOP|MB_OK "Uninstall is incomplete. Preview registration remains withdrawn, and Preview Handler DLL plus Global Index service cleanup could not both be verified." /SD IDOK
    ${EndIf}
    Abort
  ${EndIf}
  SetErrorLevel 0
FunctionEnd
