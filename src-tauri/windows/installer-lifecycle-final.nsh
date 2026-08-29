; Final package-only W4-04 orchestration layer.
; The generated Tauri template calls only these entry points for PRE/POST
; lifecycle ownership. Legacy NSIS_HOOK_PRE*/POST* macros remain defined by
; installer-hooks.nsh for compatibility but are not inserted by this package.

; These small macros keep the post-generated evidence and cleanup paths
; non-aborting. They compare exact current Zen values before deleting them and
; never remove a key or value that does not carry current Zen ownership.
!macro ZC_CHECK_POST_GENERATED_REG_STRING PATH NAME EXPECTED
  ClearErrors
  ReadRegStr $0 HKLM "${PATH}" "${NAME}"
  ${If} ${Errors}
    Goto zc_post_generated_coherence_failed
  ${EndIf}
  ${If} $0 != ${EXPECTED}
    Goto zc_post_generated_coherence_failed
  ${EndIf}
!macroend

!macro ZC_REMOVE_CURRENT_PREVIEW_VALUE PATH NAME EXPECTED
  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${PATH}" "${NAME}"
  ${If} !${Errors}
  ${AndIf} $0 == "${EXPECTED}"
    ClearErrors
    DeleteRegValue HKLM "${PATH}" "${NAME}"
    ${If} ${Errors}
      StrCpy $ZC_LIFECYCLE_PREVIEW_FAILURE_CLEAN 0
    ${EndIf}
  ${EndIf}
!macroend

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

; Successful install/repair semantics intentionally converge the exact-owned
; service to RUNNING. Failure recovery remains state-oriented and is owned by
; RestoreZenCanvasPreexistingService; these two paths must not be mixed.
Function ZCEnsureZenCanvasIndexServiceRunningForSuccessfulInstall
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  Call EnsureZenCanvasIndexServiceRunning
  ${If} $ZC_INDEX_SERVICE_READY == 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
  ${EndIf}
FunctionEnd

; Post-generated coherence is a narrow evidence gate, not a repair attempt.
; It deliberately ignores the Preview registry because PREINSTALL keeps that
; transaction withdrawn until the final Preview registration succeeds.
Function ZCCheckPostGeneratedProductCoherence
  StrCpy $ZC_LIFECYCLE_PRODUCT_COHERENT 0
  IfFileExists "$INSTDIR\$ZC_MAIN_BINARY_FILENAME" 0 zc_post_generated_coherence_failed
  IfFileExists "${ZC_PREVIEW_INSTALLED_DLL}" 0 zc_post_generated_coherence_failed
  IfFileExists "$INSTDIR\uninstall.exe" 0 zc_post_generated_coherence_failed

  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayName" "$ZC_PRODUCT_NAME"
  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_UNINSTALLER_REGISTRY_KEY" "MainBinaryName" "$ZC_MAIN_BINARY_FILENAME"
  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayIcon" "$ZC_EXPECTED_DISPLAY_ICON"

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayVersion"
  ${If} ${Errors}
    Goto zc_post_generated_coherence_failed
  ${EndIf}
  ${If} $0 == ""
    Goto zc_post_generated_coherence_failed
  ${EndIf}
  ${If} $0 != $ZC_EXPECTED_DISPLAY_VERSION
    Goto zc_post_generated_coherence_failed
  ${EndIf}

  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_UNINSTALLER_REGISTRY_KEY" "Publisher" "$ZC_EXPECTED_PUBLISHER"
  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_UNINSTALLER_REGISTRY_KEY" "InstallLocation" "$ZC_EXPECTED_INSTALL_LOCATION"
  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_UNINSTALLER_REGISTRY_KEY" "UninstallString" "$ZC_EXPECTED_UNINSTALL_STRING"
  !insertmacro ZC_CHECK_POST_GENERATED_REG_STRING "$ZC_MANUFACTURER_PRODUCT_KEY" "" "$INSTDIR"

  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Goto zc_post_generated_coherence_failed
  ${EndIf}
  StrCpy $ZC_LIFECYCLE_PRODUCT_COHERENT 1
  Return

zc_post_generated_coherence_failed:
  StrCpy $ZC_LIFECYCLE_PRODUCT_COHERENT 0
FunctionEnd

; If current product coherence is not proven, withdraw only exact current Zen
; Preview values. This is deliberately not a transaction rollback: restoring
; an old DLL path or a partial registration could leave Explorer loading an
; unverified artifact. Association cleanup enumerates every subkey under the
; authoritative SystemFileAssociations root and preserves foreign values.
Function ZCRemoveCurrentPreviewRegistrationForFailure
  SetRegView 64
  StrCpy $ZC_LIFECYCLE_PREVIEW_FAILURE_CLEAN 1

  !insertmacro ZC_REMOVE_CURRENT_PREVIEW_VALUE "${ZC_PREVIEW_CLSID_KEY}" "" "${ZC_PREVIEW_FRIENDLY_NAME}"
  !insertmacro ZC_REMOVE_CURRENT_PREVIEW_VALUE "${ZC_PREVIEW_CLSID_KEY}" "AppID" "${ZC_PREVIEW_PREVHOST_APP_ID}"
  !insertmacro ZC_REMOVE_CURRENT_PREVIEW_VALUE "${ZC_PREVIEW_INPROC_KEY}" "" "${ZC_PREVIEW_INSTALLED_DLL}"
  !insertmacro ZC_REMOVE_CURRENT_PREVIEW_VALUE "${ZC_PREVIEW_INPROC_KEY}" "ThreadingModel" "${ZC_PREVIEW_THREADING_MODEL}"
  !insertmacro ZC_REMOVE_CURRENT_PREVIEW_VALUE "${ZC_PREVIEW_HANDLERS_KEY}" "${ZC_PREVIEW_PRODUCTION_CLSID}" "${ZC_PREVIEW_FRIENDLY_NAME}"

  StrCpy $1 0
zc_remove_current_preview_association_loop:
  ClearErrors
  EnumRegKey $2 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}" $1
  ${If} ${Errors}
    Goto zc_remove_current_preview_association_done
  ${EndIf}
  ${If} $2 == ""
    Goto zc_remove_current_preview_association_done
  ${EndIf}
  StrCpy $3 ""
  ClearErrors
  ReadRegStr $3 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\$2\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
  ${If} !${Errors}
  ${AndIf} $3 == "${ZC_PREVIEW_PRODUCTION_CLSID}"
    ClearErrors
    DeleteRegValue HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\$2\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
    ${If} ${Errors}
      StrCpy $ZC_LIFECYCLE_PREVIEW_FAILURE_CLEAN 0
    ${EndIf}
    Goto zc_remove_current_preview_association_loop
  ${EndIf}
  IntOp $1 $1 + 1
  Goto zc_remove_current_preview_association_loop

zc_remove_current_preview_association_done:
  Call NotifyZenCanvasPreviewAssociationChanged
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
    ; A successful repair has a different contract from failure recovery: the
    ; product must be usable immediately, so both originally RUNNING and
    ; originally STOPPED services converge to stable RUNNING here.
    Call ZCEnsureZenCanvasIndexServiceRunningForSuccessfulInstall
    ${If} $ZC_POSTINSTALL_SERVICE_CLEAN != 1
      StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The exact-owned Zen Canvas Global Index service could not be converged to stable RUNNING after repair."
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
  StrCpy $ZC_LIFECYCLE_PRODUCT_COHERENT 0
  StrCpy $ZC_LIFECYCLE_PREVIEW_FAILURE_CLEAN 1
  Call ZCMarkInstallPostGeneratedIntegration

  Call ZCEnsurePostInstallServiceFinal
  Call InstallZenCanvasPreviewHandler
  Call CommitZenCanvasPreviewQuiesce

  StrCpy $ZC_POSTINSTALL_ACTIVE 0
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
  SetErrorLevel 0
FunctionEnd

; One failure owner covers explicit generated IfErrors labels and the NSIS
; .onInstFailed callback. The owner flag is set before any compensation so a
; callback/label pair cannot perform double rollback or double deletion.
Function ZCHandlePostInstallFailureFinal
  ${If} $ZC_INSTALL_FAILURE_OWNER_DONE == 1
    SetErrorLevel 2
    Return
  ${EndIf}
  StrCpy $ZC_INSTALL_FAILURE_OWNER_DONE 1
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
  SetErrorLevel 2

  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_REVERSIBLE_PREPARATION}
    Call ZCRecoverInstallReversible
    Return
  ${EndIf}
  ${If} $ZC_LIFECYCLE_INSTALL_STAGE < ${ZC_LIFECYCLE_STAGE_FILE_MUTATION}
    Return
  ${EndIf}

  Call ZCCheckPostGeneratedProductCoherence
  ${If} $ZC_LIFECYCLE_PRODUCT_COHERENT == 1
    ; Coherence proves that the current product can still be rolled back to
    ; the captured preinstall state without restoring an unverified artifact.
    StrCpy $ZC_LIFECYCLE_PREVIEW_FAILURE_CLEAN 1
    ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
      Call RollbackZenCanvasPreviewQuiesce
    ${ElseIf} $ZC_PREVIEW_TXN_COUNT != 0
      Call RollbackZenCanvasPreviewRegistration
      Call NotifyZenCanvasPreviewAssociationChanged
    ${EndIf}
    ${If} $ZC_PREEXISTING_SERVICE == 1
      StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
      Call RestoreZenCanvasPreexistingService
    ${Else}
      Call CompensateZenCanvasPostInstallService
    ${EndIf}
  ${Else}
    ; Incoherent current artifacts stay withdrawn. Direct exact-value cleanup
    ; is followed by transaction commit so old registry values are not
    ; accidentally restored after a missing/corrupt DLL or EXE.
    Call ZCRemoveCurrentPreviewRegistrationForFailure
    ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
      Call CommitZenCanvasPreviewQuiesce
    ${ElseIf} $ZC_PREVIEW_TXN_COUNT != 0
      Call CommitZenCanvasPreviewRegistration
      Call NotifyZenCanvasPreviewAssociationChanged
    ${EndIf}
    ${If} $ZC_PREEXISTING_SERVICE == 1
      ; A repair failure must not start an unknown or missing product. Stop
      ; only the exact current service after ownership is re-read.
      Call ZCStopCapturedServiceForLifecycle
      ${If} $ZC_LIFECYCLE_STOP_OK == 1
        StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
      ${Else}
        StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
      ${EndIf}
    ${Else}
      Call CompensateZenCanvasPostInstallService
    ${EndIf}
  ${EndIf}

  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1
  ${If} $ZC_PREEXISTING_PRODUCT == 0
    Call CompensateZenCanvasFreshProductMetadata
  ${ElseIf} $ZC_PREEXISTING_PRODUCT == 1
    DetailPrint "Repair failure: existing Add/Remove Programs metadata, install location authority, and uninstall.exe were preserved."
  ${Else}
    StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
  ${EndIf}
FunctionEnd

Function ZCHandleGeneratedInstallFailureFinal
  Call ZCHandlePostInstallFailureFinal
FunctionEnd

; This is the only work performed by the legacy .onInstFailed seam. It
; selects reversible recovery for Stage 1 and the exact-once generated owner
; for every later failure stage.
Function ZCDispatchInstallFailureFinal
  ${If} $ZC_INSTALL_FAILURE_OWNER_DONE == 1
    SetErrorLevel 2
    Return
  ${EndIf}
  ${If} $ZC_INSTALL_LIFECYCLE_ACTIVE != 1
    Return
  ${EndIf}
  ${If} $ZC_POSTINSTALL_FAILURE_REASON == ""
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The generated NSIS install section failed before the product lifecycle completed."
  ${EndIf}
  ${If} $ZC_LIFECYCLE_INSTALL_STAGE == ${ZC_LIFECYCLE_STAGE_REVERSIBLE_PREPARATION}
    Call ZCRecoverInstallReversible
    SetErrorLevel 2
    Return
  ${EndIf}
  ${If} $ZC_LIFECYCLE_INSTALL_STAGE >= ${ZC_LIFECYCLE_STAGE_FILE_MUTATION}
    Call ZCHandleGeneratedInstallFailureFinal
  ${EndIf}
FunctionEnd

Function ZCFailPostInstallLifecycleFinal
  ${If} $ZC_POSTINSTALL_FAILURE_REASON == ""
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Zen Canvas post-install integration failed before the product lifecycle completed."
  ${EndIf}
  Call ZCHandlePostInstallFailureFinal

  ${If} $ZC_PREEXISTING_PRODUCT == 1
    StrCpy $1 "Repair metadata and uninstall.exe were preserved."
  ${ElseIf} $ZC_POSTINSTALL_METADATA_CLEAN == 1
    StrCpy $1 "Fresh-install metadata was neutralized where exact ownership was proven."
  ${Else}
    StrCpy $1 "Fresh-install metadata cleanup could not be fully verified; generated files may remain."
  ${EndIf}
  ${If} $ZC_POSTINSTALL_SERVICE_CLEAN == 1
    StrCpy $2 "Exact-owned service handling completed within the evidence boundary."
  ${Else}
    StrCpy $2 "Service cleanup could not be fully verified; no foreign service was touched."
  ${EndIf}
  ${If} $ZC_LIFECYCLE_PREVIEW_FAILURE_CLEAN == 1
    StrCpy $3 "Preview registration was handled using exact current ownership."
  ${Else}
    StrCpy $3 "Preview cleanup could not be fully verified and remains withdrawn."
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas installation did not complete. Product files may remain in the install directory, but this attempt is not represented as a successful product.$\r$\n$\r$\n$ZC_POSTINSTALL_FAILURE_REASON$\r$\n$\r$\n$1 $2 $3" /SD IDOK
  Abort
FunctionEnd

Function un.ZCPostUninstallLifecycleFinal
  ; Keep non-zero until all exact-owned finalization succeeds. If any helper
  ; aborts, silent uninstall returns failure instead of a false success.
  SetErrorLevel 2
  Call un.ZCMarkUninstallPostGeneratedIntegration
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
