; The global index service is an installed, independent metadata provider.
; All service operations are performed by the per-machine installer while it
; is elevated. Failure to create or start the service aborts installation so a
; partially working global search is never reported as successfully installed.

!include "LogicLib.nsh"
!if "${NSIS_PTR_SIZE}" > 4
!include "Util.nsh"
!else ifndef IntPtrCmp
!define IntPtrCmp IntCmp
!endif
!include "${__FILEDIR__}\preview-handler-registration.nsh"

!define ZC_PREVIEW_CLSID_KEY "Software\Classes\CLSID\${ZC_PREVIEW_PRODUCTION_CLSID}"
!define ZC_PREVIEW_INPROC_KEY "${ZC_PREVIEW_CLSID_KEY}\InprocServer32"
!define ZC_PREVIEW_HANDLERS_KEY "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers"
!define ZC_PREVIEW_ASSOCIATION_ROOT "Software\Classes\SystemFileAssociations"
!define ZC_INDEX_SERVICE_READY_ATTEMPTS 20
!define ZC_INDEX_SERVICE_READY_DELAY_MS 250
!define ZC_INDEX_SERVICE_RUNNING_CONFIRMATIONS 2
!define ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS 20
!define ZC_INDEX_SERVICE_CLEANUP_DELAY_MS 250
!define ZC_INDEX_SERVICE_NAME "ZenCanvasGlobalIndex"
!define ZC_INDEX_SERVICE_KEY "SYSTEM\CurrentControlSet\Services\ZenCanvasGlobalIndex"
!define ZC_INDEX_SERVICE_PARENT_KEY "SYSTEM\CurrentControlSet\Services"

; Keep the native DLL under the install root. Tauri maps this resource directly
; to the stable $INSTDIR\native path frozen in the product registration
; contract before the post-install hook runs.
!define ZC_PREVIEW_INSTALLED_DLL "$INSTDIR\${ZC_PREVIEW_DLL_RELATIVE_PATH}"

Var ZC_PREVIEW_TXN_COUNT
Var ZC_PREVIEW_TXN_OLD_VALUE
Var ZC_PREVIEW_TXN_OLD_PRESENT
Var ZC_PREVIEW_QUIESCE_ACTIVE
Var ZC_PREVIEW_RELEASE_READY
Var ZC_PREVIEW_DLL_PROBE_PATH
Var ZC_PREVIEW_CORE_PRESENT
Var ZC_PREVIEW_CLSID_PRESENT
Var ZC_PREVIEW_APPID_PRESENT
Var ZC_PREVIEW_THREADING_PRESENT
Var ZC_PREVIEW_HANDLER_PRESENT
Var ZC_PREVIEW_INPROC_PATH_PRESENT
Var ZC_MAIN_BINARY_FILENAME
Var ZC_UNINSTALLER_REGISTRY_KEY
Var ZC_MANUFACTURER_PRODUCT_KEY
Var ZC_INDEX_SERVICE_CREATED
Var ZC_INDEX_SERVICE_READY
Var ZC_POSTINSTALL_ACTIVE
Var ZC_POSTINSTALL_SERVICE_CLEAN
Var ZC_POSTINSTALL_METADATA_CLEAN
Var ZC_POSTINSTALL_FAILURE_REASON
Var ZC_PRODUCT_NAME
Var ZC_MANUFACTURER_NAME
Var ZC_EXPECTED_INSTALL_LOCATION
Var ZC_EXPECTED_UNINSTALL_STRING
Var ZC_EXPECTED_DISPLAY_ICON
Var ZC_EXPECTED_DISPLAY_VERSION
Var ZC_EXPECTED_PUBLISHER
Var ZC_EXPECTED_HOMEPAGE
Var ZC_PREEXISTING_PRODUCT
Var ZC_PREEXISTING_PRODUCT_PRESENT
Var ZC_PREEXISTING_PRODUCT_VALID
Var ZC_PREEXISTING_UNINSTALLER_PRESENT
Var ZC_UNINSTALLER_KEY_PRESENT
Var ZC_MANUFACTURER_KEY_PRESENT
Var ZC_FRESH_UNINSTALL_METADATA_OWNED
Var ZC_FRESH_MANUFACTURER_METADATA_OWNED
Var ZC_FRESH_UNINSTALL_KEY_PRESENT
Var ZC_FRESH_MANUFACTURER_KEY_PRESENT
Var ZC_PREEXISTING_SERVICE
Var ZC_PREEXISTING_SERVICE_WAS_RUNNING
Var ZC_PREEXISTING_SERVICE_STATE_CAPTURED
Var ZC_INDEX_SERVICE_OWNERSHIP
Var ZC_INDEX_SERVICE_EXPECTED_IMAGE_PATH
Var ZC_INDEX_SERVICE_RUNTIME_STATE
Var ZC_INDEX_SERVICE_STOPPED_READY
Var ZC_INSTALL_FAILURE_COMPENSATED
Var ZC_INSTALL_LIFECYCLE_ACTIVE
Var ZC_PREVIEW_ARTIFACT_REMOVED
Var ZC_UNINSTALL_SERVICE_CLEAN
Var ZC_INDEX_SERVICE_CREATE_SUCCEEDED
Var ZC_INDEX_SERVICE_CREATE_OWNERSHIP_VERIFIED
Var ZC_UNINSTALL_LIFECYCLE_STAGE
Var ZC_UNINSTALL_RECOVERY_DONE
Var ZC_UNINSTALL_ORIGINAL_SERVICE
Var ZC_UNINSTALL_ORIGINAL_SERVICE_WAS_RUNNING
Var ZC_UNINSTALL_SERVICE_STATE_CAPTURED
Var ZC_UNINSTALL_PREDELETE_EVIDENCE_CAPTURED
Var ZC_UNINSTALL_PREDELETE_COHERENT
Var ZC_UNINSTALL_PREVIEW_RECOVERED

; Keep the previous value for every registry mutation in the current install
; transaction. Records are path/name/presence/old-value quadruples on the
; NSIS stack and are restored in reverse order if a later mutation fails.
!macro ZC_RECORD_REG_VALUE PATH NAME
  StrCpy $ZC_PREVIEW_TXN_OLD_VALUE ""
  ClearErrors
  ReadRegStr $ZC_PREVIEW_TXN_OLD_VALUE HKLM "${PATH}" "${NAME}"
  ${If} ${Errors}
    StrCpy $ZC_PREVIEW_TXN_OLD_PRESENT 0
  ${Else}
    StrCpy $ZC_PREVIEW_TXN_OLD_PRESENT 1
  ${EndIf}
  Push "${PATH}"
  Push "${NAME}"
  Push $ZC_PREVIEW_TXN_OLD_PRESENT
  Push $ZC_PREVIEW_TXN_OLD_VALUE
  IntOp $ZC_PREVIEW_TXN_COUNT $ZC_PREVIEW_TXN_COUNT + 1
!macroend

!macro ZC_WITHDRAW_REG_VALUE PATH NAME EXPECTED ROLLBACK_FUNCTION NOTIFY_FUNCTION
  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${PATH}" "${NAME}"
  ${If} ${Errors}
  ${Else}
    ${If} $0 == "${EXPECTED}"
      !insertmacro ZC_RECORD_REG_VALUE "${PATH}" "${NAME}"
      ClearErrors
      DeleteRegValue HKLM "${PATH}" "${NAME}"
      ${If} ${Errors}
        Call ${ROLLBACK_FUNCTION}
        Call ${NOTIFY_FUNCTION}
        MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler could not withdraw an owned registry value. The operation was aborted." /SD IDOK
        Abort
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

Function NotifyZenCanvasPreviewAssociationChanged
  ; SHCNE_ASSOCCHANGED / SHCNF_IDLIST. This is deliberately after all
  ; successful registry mutation/cleanup and never kills Explorer or prevhost.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
FunctionEnd

!macro ZC_VALIDATE_PREVIEW_CORE
  SetRegView 64
  StrCpy $ZC_PREVIEW_CORE_PRESENT 0
  StrCpy $ZC_PREVIEW_CLSID_PRESENT 0
  StrCpy $ZC_PREVIEW_APPID_PRESENT 0
  StrCpy $ZC_PREVIEW_THREADING_PRESENT 0
  StrCpy $ZC_PREVIEW_HANDLER_PRESENT 0
  StrCpy $ZC_PREVIEW_INPROC_PATH_PRESENT 0
  StrCpy $ZC_PREVIEW_DLL_PROBE_PATH ""

  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_CLSID_KEY}" ""
  ${If} ${Errors}
  ${Else}
    StrCpy $ZC_PREVIEW_CORE_PRESENT 1
    StrCpy $ZC_PREVIEW_CLSID_PRESENT 1
    ${If} $0 != "${ZC_PREVIEW_FRIENDLY_NAME}"
      MessageBox MB_ICONSTOP|MB_OK "A foreign or inconsistent Preview Handler already owns the Zen Canvas production CLSID. Installation was not changed." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}

  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_CLSID_KEY}" "AppID"
  ${If} ${Errors}
  ${Else}
    StrCpy $ZC_PREVIEW_CORE_PRESENT 1
    StrCpy $ZC_PREVIEW_APPID_PRESENT 1
    ${If} $0 != "${ZC_PREVIEW_PREVHOST_APP_ID}"
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production CLSID has a foreign or inconsistent AppID. Installation was not changed." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}

  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_INPROC_KEY}" "ThreadingModel"
  ${If} ${Errors}
  ${Else}
    StrCpy $ZC_PREVIEW_CORE_PRESENT 1
    StrCpy $ZC_PREVIEW_THREADING_PRESENT 1
    ${If} $0 != "${ZC_PREVIEW_THREADING_MODEL}"
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler has a foreign or inconsistent threading model. Installation was not changed." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}

  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_HANDLERS_KEY}" "${ZC_PREVIEW_PRODUCTION_CLSID}"
  ${If} ${Errors}
  ${Else}
    StrCpy $ZC_PREVIEW_CORE_PRESENT 1
    StrCpy $ZC_PREVIEW_HANDLER_PRESENT 1
    ${If} $0 != "${ZC_PREVIEW_FRIENDLY_NAME}"
      MessageBox MB_ICONSTOP|MB_OK "A foreign or inconsistent PreviewHandlers entry conflicts with Zen Canvas. Installation was not changed." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}

  ; An existing InprocServer32 path is trusted only when it is the exact
  ; canonical path for this install attempt. There is no durable provenance
  ; authority for arbitrary historical paths, so unexpected non-current paths
  ; fail closed before any withdrawal, probe, or file deletion can occur.
  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_INPROC_KEY}" ""
  ${If} ${Errors}
  ${Else}
    StrCpy $ZC_PREVIEW_CORE_PRESENT 1
    StrCpy $ZC_PREVIEW_INPROC_PATH_PRESENT 1
    ${If} $0 == ""
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production InprocServer32 path is present but empty. Installation was not changed." /SD IDOK
      Abort
    ${EndIf}
    ${If} $0 != "${ZC_PREVIEW_INSTALLED_DLL}"
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production InprocServer32 path is not the current canonical Zen path. The existing registration and file were preserved." /SD IDOK
      Abort
    ${EndIf}
    StrCpy $ZC_PREVIEW_DLL_PROBE_PATH "$0"
  ${EndIf}

  ; Any existing production marker must form one complete, exact core. A
  ; partial marker set is not treated as a repairable fresh install because it
  ; could have been written by another actor between installer runs.
  ${If} $ZC_PREVIEW_CORE_PRESENT == 0
    Return
  ${EndIf}
  ${If} $ZC_PREVIEW_CLSID_PRESENT == 0
  ${OrIf} $ZC_PREVIEW_APPID_PRESENT == 0
  ${OrIf} $ZC_PREVIEW_THREADING_PRESENT == 0
  ${OrIf} $ZC_PREVIEW_HANDLER_PRESENT == 0
  ${OrIf} $ZC_PREVIEW_INPROC_PATH_PRESENT == 0
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production core registration is incomplete. Installation was not changed." /SD IDOK
    Abort
  ${EndIf}
!macroend

Function ValidateZenCanvasPreviewCore
  !insertmacro ZC_VALIDATE_PREVIEW_CORE
FunctionEnd

Function un.ValidateZenCanvasPreviewCore
  !insertmacro ZC_VALIDATE_PREVIEW_CORE
FunctionEnd

Function RollbackZenCanvasPreviewRegistration
  ; Restore only values captured by this transaction. It never recursively
  ; removes shared SystemFileAssociations parents or any foreign value.
  SetRegView 64
rollback_transaction_loop:
  ${If} $ZC_PREVIEW_TXN_COUNT == 0
    Return
  ${EndIf}
  Pop $2
  Pop $3
  Pop $1
  Pop $0
  ${If} $3 == "1"
    WriteRegStr HKLM "$0" "$1" "$2"
  ${Else}
    DeleteRegValue HKLM "$0" "$1"
  ${EndIf}
  IntOp $ZC_PREVIEW_TXN_COUNT $ZC_PREVIEW_TXN_COUNT - 1
  Goto rollback_transaction_loop
FunctionEnd

Function CommitZenCanvasPreviewRegistration
  ; Discard the in-memory transaction log after notification succeeds.
commit_transaction_loop:
  ${If} $ZC_PREVIEW_TXN_COUNT == 0
    Return
  ${EndIf}
  Pop $2
  Pop $3
  Pop $1
  Pop $0
  IntOp $ZC_PREVIEW_TXN_COUNT $ZC_PREVIEW_TXN_COUNT - 1
  Goto commit_transaction_loop
FunctionEnd

Function un.RollbackZenCanvasPreviewRegistration
  SetRegView 64
un_rollback_transaction_loop:
  ${If} $ZC_PREVIEW_TXN_COUNT == 0
    Return
  ${EndIf}
  Pop $2
  Pop $3
  Pop $1
  Pop $0
  ${If} $3 == "1"
    WriteRegStr HKLM "$0" "$1" "$2"
  ${Else}
    DeleteRegValue HKLM "$0" "$1"
  ${EndIf}
  IntOp $ZC_PREVIEW_TXN_COUNT $ZC_PREVIEW_TXN_COUNT - 1
  Goto un_rollback_transaction_loop
FunctionEnd

Function un.CommitZenCanvasPreviewRegistration
un_commit_transaction_loop:
  ${If} $ZC_PREVIEW_TXN_COUNT == 0
    Return
  ${EndIf}
  Pop $2
  Pop $3
  Pop $1
  Pop $0
  IntOp $ZC_PREVIEW_TXN_COUNT $ZC_PREVIEW_TXN_COUNT - 1
  Goto un_commit_transaction_loop
FunctionEnd

; Tauri writes these per-machine authorities in the generated install section.
; Detect them before PREINSTALL withdraws Preview or stops a service so a
; repair cannot be mistaken for a fresh install.
Function DetectZenCanvasPreexistingProduct
  SetRegView 64
  StrCpy $ZC_PREEXISTING_PRODUCT 0
  StrCpy $ZC_PREEXISTING_PRODUCT_PRESENT 0
  StrCpy $ZC_PREEXISTING_PRODUCT_VALID 1
  StrCpy $ZC_PREEXISTING_UNINSTALLER_PRESENT 0
  StrCpy $ZC_UNINSTALLER_KEY_PRESENT 0
  StrCpy $ZC_MANUFACTURER_KEY_PRESENT 0
  StrCpy $ZC_EXPECTED_INSTALL_LOCATION "$\"$INSTDIR$\""
  StrCpy $ZC_EXPECTED_UNINSTALL_STRING "$\"$INSTDIR\uninstall.exe$\""
  StrCpy $ZC_EXPECTED_DISPLAY_ICON "$\"$INSTDIR\$ZC_MAIN_BINARY_FILENAME$\""
  StrCpy $ZC_EXPECTED_DISPLAY_VERSION "${VERSION}"
  StrCpy $ZC_EXPECTED_PUBLISHER "$ZC_MANUFACTURER_NAME"
  StrCpy $ZC_EXPECTED_HOMEPAGE "${HOMEPAGE}"

  StrCpy $0 0
detect_uninstaller_key_loop:
  ClearErrors
  EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  ${If} ${Errors}
    Goto detect_uninstaller_key_done
  ${EndIf}
  ${If} $1 == $ZC_PRODUCT_NAME
    StrCpy $ZC_UNINSTALLER_KEY_PRESENT 1
    Goto detect_uninstaller_key_done
  ${EndIf}
  IntOp $0 $0 + 1
  Goto detect_uninstaller_key_loop
detect_uninstaller_key_done:

  StrCpy $0 0
detect_manufacturer_key_loop:
  ClearErrors
  EnumRegKey $1 HKLM "Software\$ZC_MANUFACTURER_NAME" $0
  ${If} ${Errors}
    Goto detect_manufacturer_key_done
  ${EndIf}
  ${If} $1 == $ZC_PRODUCT_NAME
    StrCpy $ZC_MANUFACTURER_KEY_PRESENT 1
    Goto detect_manufacturer_key_done
  ${EndIf}
  IntOp $0 $0 + 1
  Goto detect_manufacturer_key_loop
detect_manufacturer_key_done:

  IfFileExists "$INSTDIR\uninstall.exe" 0 detect_product_uninstaller_absent
  StrCpy $ZC_PREEXISTING_UNINSTALLER_PRESENT 1
detect_product_uninstaller_absent:

  ${If} $ZC_UNINSTALLER_KEY_PRESENT == 1
  ${OrIf} $ZC_MANUFACTURER_KEY_PRESENT == 1
  ${OrIf} $ZC_PREEXISTING_UNINSTALLER_PRESENT == 1
    StrCpy $ZC_PREEXISTING_PRODUCT_PRESENT 1
  ${EndIf}
  ${If} $ZC_PREEXISTING_PRODUCT_PRESENT == 0
    Return
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayName"
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $ZC_PRODUCT_NAME
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "MainBinaryName"
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $ZC_MAIN_BINARY_FILENAME
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayIcon"
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $ZC_EXPECTED_DISPLAY_ICON
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayVersion"
  ${If} ${Errors}
  ${OrIf} $0 == ""
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "Publisher"
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $ZC_EXPECTED_PUBLISHER
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "InstallLocation"
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $ZC_EXPECTED_INSTALL_LOCATION
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "UninstallString"
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $ZC_EXPECTED_UNINSTALL_STRING
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" ""
  ${If} ${Errors}
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${ElseIf} $0 != $INSTDIR
    StrCpy $ZC_PREEXISTING_PRODUCT_VALID 0
  ${EndIf}

  ${If} $ZC_UNINSTALLER_KEY_PRESENT == 1
  ${AndIf} $ZC_MANUFACTURER_KEY_PRESENT == 1
  ${AndIf} $ZC_PREEXISTING_UNINSTALLER_PRESENT == 1
  ${AndIf} $ZC_PREEXISTING_PRODUCT_VALID == 1
    StrCpy $ZC_PREEXISTING_PRODUCT 1
    Return
  ${EndIf}
  StrCpy $ZC_PREEXISTING_PRODUCT 2
FunctionEnd

Function ValidateZenCanvasPreexistingProduct
  Call DetectZenCanvasPreexistingProduct
  ${If} $ZC_PREEXISTING_PRODUCT == 2
    MessageBox MB_ICONSTOP|MB_OK "Existing Zen Canvas product metadata is incomplete or inconsistent. Installation was not changed." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

; ImagePath is the only service ownership authority. SCM query output is used
; only for bounded runtime state after this exact registry check succeeds.
!macro ZC_READ_INDEX_SERVICE_OWNERSHIP_BODY
  SetRegView 64
  StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 0
  StrCpy $ZC_INDEX_SERVICE_EXPECTED_IMAGE_PATH "$\"$INSTDIR\$ZC_MAIN_BINARY_FILENAME$\" --index-service"
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_INDEX_SERVICE_KEY}" "ImagePath"
  ${If} !${Errors}
    ${If} $0 == ""
      StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 2
    ${ElseIf} $0 == $ZC_INDEX_SERVICE_EXPECTED_IMAGE_PATH
      StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 1
    ${Else}
      StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 2
    ${EndIf}
    Return
  ${EndIf}

  StrCpy $1 0
service_key_presence_loop:
  ClearErrors
  EnumRegKey $2 HKLM "${ZC_INDEX_SERVICE_PARENT_KEY}" $1
  ${If} ${Errors}
    Return
  ${EndIf}
  ${If} $2 == "${ZC_INDEX_SERVICE_NAME}"
    StrCpy $ZC_INDEX_SERVICE_OWNERSHIP 2
    Return
  ${EndIf}
  IntOp $1 $1 + 1
  Goto service_key_presence_loop
!macroend

Function ReadZenCanvasIndexServiceOwnership
  !insertmacro ZC_READ_INDEX_SERVICE_OWNERSHIP_BODY
FunctionEnd

Function un.ReadZenCanvasIndexServiceOwnership
  !insertmacro ZC_READ_INDEX_SERVICE_OWNERSHIP_BODY
FunctionEnd

Function ValidateZenCanvasIndexServiceOwnership
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 2
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Global Index service exists but its ImagePath is empty, foreign, or not the current canonical Zen Canvas binary. The operation was aborted." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

Function un.ValidateZenCanvasIndexServiceOwnership
  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 2
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Global Index service exists but its ImagePath is empty, foreign, or not the current canonical Zen Canvas binary. Uninstall was aborted." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

; SCM runtime state is separate from ImagePath ownership. It is used only
; after the exact registry authority has been checked, and every state
; transition remains bounded by the callers below.
!macro ZC_READ_INDEX_SERVICE_RUNTIME_STATE_BODY
  SetRegView 64
  StrCpy $ZC_INDEX_SERVICE_RUNTIME_STATE 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    StrCpy $ZC_INDEX_SERVICE_RUNTIME_STATE 4
    Return
  ${EndIf}
  ${If} $0 != 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"${ZC_INDEX_SERVICE_NAME}\" | \"$SYSDIR\findstr.exe\" /C:\"RUNNING\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $ZC_INDEX_SERVICE_RUNTIME_STATE 1
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"${ZC_INDEX_SERVICE_NAME}\" | \"$SYSDIR\findstr.exe\" /C:\"STOPPED\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $ZC_INDEX_SERVICE_RUNTIME_STATE 2
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"${ZC_INDEX_SERVICE_NAME}\" | \"$SYSDIR\findstr.exe\" /C:\"PENDING\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $ZC_INDEX_SERVICE_RUNTIME_STATE 3
  ${EndIf}
!macroend

Function ReadZenCanvasIndexServiceRuntimeState
  !insertmacro ZC_READ_INDEX_SERVICE_RUNTIME_STATE_BODY
FunctionEnd

Function un.ReadZenCanvasIndexServiceRuntimeState
  !insertmacro ZC_READ_INDEX_SERVICE_RUNTIME_STATE_BODY
FunctionEnd

Function CaptureZenCanvasPreexistingServiceState
  StrCpy $ZC_PREEXISTING_SERVICE_WAS_RUNNING 0
  StrCpy $ZC_PREEXISTING_SERVICE_STATE_CAPTURED 0
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  Call ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 1
    StrCpy $ZC_PREEXISTING_SERVICE_WAS_RUNNING 1
    StrCpy $ZC_PREEXISTING_SERVICE_STATE_CAPTURED 1
  ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    StrCpy $ZC_PREEXISTING_SERVICE_STATE_CAPTURED 1
  ${Else}
    MessageBox MB_ICONSTOP|MB_OK "The existing Zen Canvas Global Index service state could not be determined safely. Installation was not changed." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

; A generated-section failure can happen after PREINSTALL stopped a repair's
; service but before POSTINSTALL runs. Restore only the exact preexisting
; service, and never touch a foreign replacement.
Function RestoreZenCanvasPreexistingService
  ${If} $ZC_PREEXISTING_SERVICE != 1
    Return
  ${EndIf}
  ${If} $ZC_PREEXISTING_SERVICE_STATE_CAPTURED != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}

  Call ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_PREEXISTING_SERVICE_WAS_RUNNING == 1
    ; Restoration is state-oriented: an already-running service needs only a
    ; bounded stable-running proof, not a second sc start that can fail with
    ; ERROR_SERVICE_ALREADY_RUNNING.
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 1
      Call WaitForZenCanvasIndexServiceRunning
    ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
      Call WaitForZenCanvasIndexServiceRunning
    ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
      Call ReadZenCanvasIndexServiceOwnership
      ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
        StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
        Return
      ${EndIf}
      DetailPrint "Restoring the preexisting Zen Canvas Global Index service after the failed repair..."
      nsExec::ExecToStack '"$SYSDIR\sc.exe" start "${ZC_INDEX_SERVICE_NAME}"'
      Pop $0
      Pop $1
      ${If} $0 != 0
        ; A race may have made the desired state true despite a non-zero
        ; start result. Re-read state before deciding that restoration failed.
        Call ReadZenCanvasIndexServiceOwnership
        ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
          StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
          Return
        ${EndIf}
        Call ReadZenCanvasIndexServiceRuntimeState
        ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
          StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
          Return
        ${EndIf}
      ${EndIf}
      Call WaitForZenCanvasIndexServiceRunning
    ${Else}
      StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
      Return
    ${EndIf}
    ${If} $ZC_INDEX_SERVICE_READY != 1
      StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    ${EndIf}
    Return
  ${EndIf}

  ; A service that was originally stopped must finish stopped. If it is
  ; already stopped there is no unnecessary sc call; if a POSTINSTALL or
  ; external race made it running, stop it only after re-checking ownership.
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call WaitForZenCanvasIndexServiceStopped
    ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
      Return
    ${EndIf}
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    Call ReadZenCanvasIndexServiceOwnership
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
      StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
      Return
    ${EndIf}
    Call ReadZenCanvasIndexServiceRuntimeState
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 2
      StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
      Return
    ${EndIf}
    Return
  ${EndIf}
  Call WaitForZenCanvasIndexServiceStopped
  ${If} $ZC_INDEX_SERVICE_STOPPED_READY != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
  ${EndIf}
FunctionEnd

; POSTINSTALL runs after Tauri has copied the product and written its
; uninstall metadata. CREATE_SUCCEEDED is deliberately separate from
; ownership verification: a successful sc create remains compensation
; provenance even if the immediately following ImagePath re-read is absent,
; foreign, or otherwise untrusted.
Function CompensateZenCanvasPostInstallService
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
  ${If} $ZC_INDEX_SERVICE_CREATE_SUCCEEDED != 1
    Return
  ${EndIf}

  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  DetailPrint "Compensating the Zen Canvas Global Index service after installation failure..."
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  StrCpy $2 0
postinstall_service_stop_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS} postinstall_service_delete_guard 0 0
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"${ZC_INDEX_SERVICE_NAME}\" | \"$SYSDIR\findstr.exe\" /C:\"STOPPED\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    Goto postinstall_service_delete_guard
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  Sleep ${ZC_INDEX_SERVICE_CLEANUP_DELAY_MS}
  IntOp $2 $2 + 1
  Goto postinstall_service_stop_loop

postinstall_service_delete_guard:
  ; Re-read immediately before the destructive SCM operation. A foreign
  ; replacement is never stopped or deleted by compensation.
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" delete "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Goto postinstall_service_cleanup_success
  ${EndIf}
  StrCpy $2 0
postinstall_service_delete_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS} postinstall_service_cleanup_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Goto postinstall_service_cleanup_success
  ${EndIf}
  Sleep ${ZC_INDEX_SERVICE_CLEANUP_DELAY_MS}
  IntOp $2 $2 + 1
  Goto postinstall_service_delete_loop

postinstall_service_cleanup_timeout:
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 0
  Return

postinstall_service_cleanup_success:
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
FunctionEnd

Function ReadZenCanvasFreshUninstallKeyPresence
  SetRegView 64
  StrCpy $ZC_FRESH_UNINSTALL_KEY_PRESENT 0
  StrCpy $0 0
fresh_uninstall_key_presence_loop:
  ClearErrors
  EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  ${If} ${Errors}
    Return
  ${EndIf}
  ${If} $1 == $ZC_PRODUCT_NAME
    StrCpy $ZC_FRESH_UNINSTALL_KEY_PRESENT 1
    Return
  ${EndIf}
  IntOp $0 $0 + 1
  Goto fresh_uninstall_key_presence_loop
FunctionEnd

Function ReadZenCanvasFreshManufacturerKeyPresence
  SetRegView 64
  StrCpy $ZC_FRESH_MANUFACTURER_KEY_PRESENT 0
  StrCpy $0 0
fresh_manufacturer_key_presence_loop:
  ClearErrors
  EnumRegKey $1 HKLM "Software\$ZC_MANUFACTURER_NAME" $0
  ${If} ${Errors}
    Return
  ${EndIf}
  ${If} $1 == $ZC_PRODUCT_NAME
    StrCpy $ZC_FRESH_MANUFACTURER_KEY_PRESENT 1
    Return
  ${EndIf}
  IntOp $0 $0 + 1
  Goto fresh_manufacturer_key_presence_loop
FunctionEnd

; Fresh-install metadata is removable when PREINSTALL proved that no
; authoritative product state existed and every generated value that is
; present still matches the current Tauri identity. Missing values are
; expected while Tauri is writing the generated install section; a foreign
; value is never treated as current-attempt ownership.
Function CompensateZenCanvasFreshProductMetadata
  SetRegView 64
  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1
  StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 1
  StrCpy $ZC_FRESH_MANUFACTURER_METADATA_OWNED 1

  ; This function is only valid for a PREINSTALL-proven fresh attempt. A
  ; repair never enters this branch and therefore never loses its authority.
  ${If} $ZC_PREEXISTING_PRODUCT != 0
    Return
  ${EndIf}

  Call ReadZenCanvasFreshUninstallKeyPresence
  ${If} $ZC_FRESH_UNINSTALL_KEY_PRESENT == 1
    StrCpy $0 0
fresh_uninstall_value_loop:
    ClearErrors
    EnumRegValue $1 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" $0
    ${If} ${Errors}
      Goto fresh_uninstall_values_done
    ${EndIf}
    ; These are the string/DWORD values emitted by the repository-current
    ; Tauri 2.11.2 NSIS template. Unknown values make whole-key deletion
    ; untrustworthy, even though the key name itself is canonical.
    ${If} $1 == "MainBinaryName"
    ${OrIf} $1 == "DisplayName"
    ${OrIf} $1 == "DisplayIcon"
    ${OrIf} $1 == "DisplayVersion"
    ${OrIf} $1 == "Publisher"
    ${OrIf} $1 == "InstallLocation"
    ${OrIf} $1 == "UninstallString"
    ${OrIf} $1 == "NoModify"
    ${OrIf} $1 == "NoRepair"
    ${OrIf} $1 == "EstimatedSize"
    ${OrIf} $1 == "URLInfoAbout"
    ${OrIf} $1 == "URLUpdateInfo"
    ${OrIf} $1 == "HelpLink"
      Goto fresh_uninstall_value_next
    ${EndIf}
    StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
fresh_uninstall_value_next:
    IntOp $0 $0 + 1
    Goto fresh_uninstall_value_loop
fresh_uninstall_values_done:

    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayName"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_PRODUCT_NAME
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "MainBinaryName"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_MAIN_BINARY_FILENAME
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayIcon"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_EXPECTED_DISPLAY_ICON
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayVersion"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_EXPECTED_DISPLAY_VERSION
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "Publisher"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_EXPECTED_PUBLISHER
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "InstallLocation"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_EXPECTED_INSTALL_LOCATION
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "UninstallString"
    ${If} !${Errors}
    ${AndIf} $0 != $ZC_EXPECTED_UNINSTALL_STRING
      StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
    ${EndIf}
    ; The repository configuration supplies a homepage. If it were empty in
    ; a future package, a present URL value would still be foreign rather
    ; than an absent generated field.
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "URLInfoAbout"
    ${If} !${Errors}
      ${If} $ZC_EXPECTED_HOMEPAGE == ""
      ${OrIf} $0 != $ZC_EXPECTED_HOMEPAGE
        StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
      ${EndIf}
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "URLUpdateInfo"
    ${If} !${Errors}
      ${If} $ZC_EXPECTED_HOMEPAGE == ""
      ${OrIf} $0 != $ZC_EXPECTED_HOMEPAGE
        StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
      ${EndIf}
    ${EndIf}
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "HelpLink"
    ${If} !${Errors}
      ${If} $ZC_EXPECTED_HOMEPAGE == ""
      ${OrIf} $0 != $ZC_EXPECTED_HOMEPAGE
        StrCpy $ZC_FRESH_UNINSTALL_METADATA_OWNED 2
      ${EndIf}
    ${EndIf}
  ${EndIf}

  Call ReadZenCanvasFreshManufacturerKeyPresence
  ${If} $ZC_FRESH_MANUFACTURER_KEY_PRESENT == 1
    StrCpy $0 0
fresh_manufacturer_value_loop:
    ClearErrors
    EnumRegValue $1 HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" $0
    ${If} ${Errors}
      Goto fresh_manufacturer_values_done
    ${EndIf}
    ${If} $1 != ""
      StrCpy $ZC_FRESH_MANUFACTURER_METADATA_OWNED 2
    ${EndIf}
    IntOp $0 $0 + 1
    Goto fresh_manufacturer_value_loop
fresh_manufacturer_values_done:
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" ""
    ${If} !${Errors}
    ${AndIf} $0 != $INSTDIR
      StrCpy $ZC_FRESH_MANUFACTURER_METADATA_OWNED 2
    ${EndIf}
  ${EndIf}

  ; Any conflict in either authoritative key blocks all metadata/uninstaller
  ; deletion. Fresh provenance permits absent-or-exact partial state, not a
  ; broad best-effort cleanup of an untrusted product name.
  ${If} $ZC_FRESH_UNINSTALL_METADATA_OWNED == 2
  ${OrIf} $ZC_FRESH_MANUFACTURER_METADATA_OWNED == 2
    StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
    Goto fresh_metadata_cleanup_done
  ${EndIf}

  ${If} $ZC_FRESH_UNINSTALL_KEY_PRESENT == 1
    ClearErrors
    DeleteRegKey HKLM "$ZC_UNINSTALLER_REGISTRY_KEY"
    Call ReadZenCanvasFreshUninstallKeyPresence
    ${If} $ZC_FRESH_UNINSTALL_KEY_PRESENT == 1
      StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
    ${EndIf}
  ${EndIf}

  ${If} $ZC_FRESH_MANUFACTURER_KEY_PRESENT == 1
    ClearErrors
    DeleteRegValue HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" ""
    DeleteRegKey /ifempty HKLM "$ZC_MANUFACTURER_PRODUCT_KEY"
    Call ReadZenCanvasFreshManufacturerKeyPresence
    ${If} $ZC_FRESH_MANUFACTURER_KEY_PRESENT == 1
      StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
    ${EndIf}
  ${EndIf}

  ${If} $ZC_PREEXISTING_UNINSTALLER_PRESENT == 0
    IfFileExists "$INSTDIR\uninstall.exe" 0 fresh_uninstaller_cleanup_done
    ClearErrors
    Delete "$INSTDIR\uninstall.exe"
    IfFileExists "$INSTDIR\uninstall.exe" 0 fresh_uninstaller_cleanup_done
    StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
  ${EndIf}
fresh_uninstaller_cleanup_done:
fresh_metadata_cleanup_done:
FunctionEnd

Function FailZenCanvasPostInstall
  ${If} $ZC_INSTALL_FAILURE_COMPENSATED == 1
    Return
  ${EndIf}
  StrCpy $ZC_INSTALL_FAILURE_COMPENSATED 1
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call RollbackZenCanvasPreviewQuiesce
  ${ElseIf} $ZC_PREVIEW_TXN_COUNT != 0
    Call RollbackZenCanvasPreviewRegistration
    Call NotifyZenCanvasPreviewAssociationChanged
  ${EndIf}
  Call CompensateZenCanvasPostInstallService
  Call RestoreZenCanvasPreexistingService

  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1
  ${If} $ZC_PREEXISTING_PRODUCT == 0
    Call CompensateZenCanvasFreshProductMetadata
  ${ElseIf} $ZC_PREEXISTING_PRODUCT == 1
    DetailPrint "Repair failure: existing Add/Remove Programs metadata, install location authority, and uninstall.exe were preserved."
  ${Else}
    StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
  ${EndIf}

  ${If} $ZC_PREEXISTING_PRODUCT == 1
    ${If} $ZC_POSTINSTALL_METADATA_CLEAN == 1
      StrCpy $2 "Repair metadata, manufacturer/install-location authority, and the existing uninstaller were preserved."
    ${Else}
      StrCpy $2 "Repair metadata was preserved, but failure cleanup status could not be fully verified."
    ${EndIf}
  ${ElseIf} $ZC_POSTINSTALL_METADATA_CLEAN == 1
    StrCpy $2 "Fresh-install Add/Remove Programs and uninstaller metadata were neutralized."
  ${Else}
    StrCpy $2 "Fresh-install Add/Remove Programs or uninstaller cleanup could not be fully verified; generated files may remain."
  ${EndIf}

  ${If} $ZC_POSTINSTALL_SERVICE_CLEAN == 1
    StrCpy $1 "The service and Preview registration were compensated. $2"
  ${Else}
    StrCpy $1 "Service ownership or bounded cleanup could not be verified; no foreign service was touched. $2"
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas installation did not complete. Product files may remain in the install directory, but this attempt is not represented as a successful product.$\r$\n$\r$\n$ZC_POSTINSTALL_FAILURE_REASON$\r$\n$\r$\n$1" /SD IDOK
  Abort
FunctionEnd

; NSIS invokes this callback when the generated install section fails before
; POSTINSTALL. It is deliberately silent-safe and shares the same guarded
; fresh/repair compensation branches as explicit hook failures.
Function .onInstFailed
  ${If} $ZC_INSTALL_LIFECYCLE_ACTIVE != 1
    Return
  ${EndIf}
  ${If} $ZC_INSTALL_FAILURE_COMPENSATED == 1
    Return
  ${EndIf}
  StrCpy $ZC_INSTALL_FAILURE_COMPENSATED 1
  StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The generated NSIS install section failed before POSTINSTALL completed."
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call RollbackZenCanvasPreviewQuiesce
  ${ElseIf} $ZC_PREVIEW_TXN_COUNT != 0
    Call RollbackZenCanvasPreviewRegistration
    Call NotifyZenCanvasPreviewAssociationChanged
  ${EndIf}
  Call CompensateZenCanvasPostInstallService
  Call RestoreZenCanvasPreexistingService
  ${If} $ZC_PREEXISTING_PRODUCT == 0
    Call CompensateZenCanvasFreshProductMetadata
  ${ElseIf} $ZC_PREEXISTING_PRODUCT == 1
    DetailPrint "Generated install failure during repair: existing uninstall metadata and service ownership were preserved."
  ${EndIf}
FunctionEnd

!macro ZC_WRITE_REG_VALUE PATH NAME VALUE
  !insertmacro ZC_RECORD_REG_VALUE "${PATH}" "${NAME}"
  ClearErrors
  WriteRegStr HKLM "${PATH}" "${NAME}" "${VALUE}"
  ${If} ${Errors}
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Zen Canvas Preview Handler registration failed while writing an owned registry value."
    Call FailZenCanvasPostInstall
  ${EndIf}
!macroend

; Withdraw only values that still carry Zen's exact ownership markers. The
; same body is used by install/repair and uninstall, with separate NSIS
; function namespaces for rollback, stale-association scanning and notification.
; The caller commits only after the bounded release probe and all earlier
; failure-prone preinstall/uninstall prerequisites have succeeded.
!macro ZC_WITHDRAW_PREVIEW_BODY ROLLBACK_FUNCTION STALE_FUNCTION NOTIFY_FUNCTION
  SetRegView 64
  StrCpy $ZC_PREVIEW_TXN_COUNT 0

  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_01}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_02}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_03}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_04}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_05}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_06}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_07}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_08}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_09}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_10}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_11}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_12}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_13}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_14}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_15}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${ZC_PREVIEW_EXTENSION_16}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}

  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_HANDLERS_KEY}" "${ZC_PREVIEW_PRODUCTION_CLSID}" "${ZC_PREVIEW_FRIENDLY_NAME}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_INPROC_KEY}" "" "$ZC_PREVIEW_DLL_PROBE_PATH" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_INPROC_KEY}" "ThreadingModel" "${ZC_PREVIEW_THREADING_MODEL}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_CLSID_KEY}" "AppID" "${ZC_PREVIEW_PREVHOST_APP_ID}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}
  !insertmacro ZC_WITHDRAW_REG_VALUE "${ZC_PREVIEW_CLSID_KEY}" "" "${ZC_PREVIEW_FRIENDLY_NAME}" ${ROLLBACK_FUNCTION} ${NOTIFY_FUNCTION}

  Call ${STALE_FUNCTION}
  Call ${NOTIFY_FUNCTION}
!macroend

!macro ZC_REGISTER_ASSOC EXT
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\${EXT}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
  ${If} ${Errors}
    !insertmacro ZC_WRITE_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\${EXT}\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" "" "${ZC_PREVIEW_PRODUCTION_CLSID}"
    DetailPrint "Zen Canvas Preview Handler claimed ${EXT} (absent slot)."
  ${ElseIf} $0 == "${ZC_PREVIEW_PRODUCTION_CLSID}"
    DetailPrint "Zen Canvas Preview Handler kept ${EXT} (already Zen-owned)."
  ${Else}
    DetailPrint "Zen Canvas Preview Handler preserved ${EXT} (conflicting CLSID $0)."
  ${EndIf}
!macroend

Function IsCanonicalZenCanvasPreviewExtension
  Pop $5
  StrCpy $6 "0"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_01}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_02}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_03}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_04}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_05}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_06}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_07}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_08}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_09}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_10}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_11}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_12}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_13}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_14}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_15}" 0 +2
    StrCpy $6 "1"
  StrCmp $5 "${ZC_PREVIEW_EXTENSION_16}" 0 +2
    StrCpy $6 "1"
  Push $6
FunctionEnd

Function RemoveStaleZenCanvasPreviewAssociations
  SetRegView 64
  StrCpy $0 0
stale_association_loop:
  ClearErrors
  EnumRegKey $1 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}" $0
  ${If} ${Errors}
    Return
  ${EndIf}
  ${If} $1 == ""
    Return
  ${EndIf}
  StrCpy $2 $1 1
  ${If} $2 == "."
    StrCpy $3 ""
    ReadRegStr $3 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\$1\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
    ${If} $3 == "${ZC_PREVIEW_PRODUCTION_CLSID}"
      Push $1
      Call IsCanonicalZenCanvasPreviewExtension
      Pop $4
      ${If} $4 == "0"
        !insertmacro ZC_RECORD_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\$1\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
        ClearErrors
        DeleteRegValue HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\$1\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
        ${If} ${Errors}
          ${If} $ZC_POSTINSTALL_ACTIVE == 1
            StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Zen Canvas Preview Handler stale association cleanup failed."
            Call FailZenCanvasPostInstall
          ${Else}
            MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler stale association cleanup failed. Installation was not changed." /SD IDOK
            Call RollbackZenCanvasPreviewRegistration
            Call NotifyZenCanvasPreviewAssociationChanged
            Abort
          ${EndIf}
        ${EndIf}
        DetailPrint "Zen Canvas Preview Handler removed stale Zen-owned $1 association."
        Goto stale_association_loop
      ${EndIf}
    ${EndIf}
  ${EndIf}
  IntOp $0 $0 + 1
  Goto stale_association_loop
FunctionEnd

Function WithdrawZenCanvasPreviewRegistration
  !insertmacro ZC_WITHDRAW_PREVIEW_BODY RollbackZenCanvasPreviewRegistration RemoveStaleZenCanvasPreviewAssociations NotifyZenCanvasPreviewAssociationChanged
FunctionEnd

Function WaitForZenCanvasPreviewDllRelease
  ; Probe the exact trusted DLL with write/delete access and zero sharing. A
  ; successful CreateFileW means Windows no longer denies replacement-class
  ; access for a mapped image or conflicting live handle. The handle is closed
  ; immediately and the DLL is never written, deleted, or renamed here.
  StrCpy $ZC_PREVIEW_RELEASE_READY 0
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH == ""
    Goto preview_dll_release_success
  ${EndIf}
  IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 preview_dll_release_success
  DetailPrint "Waiting for the Zen Canvas Preview Handler host to release the registered DLL..."
  StrCpy $0 0
preview_dll_release_loop:
  ; GENERIC_WRITE | DELETE, no sharing, OPEN_EXISTING, normal attributes.
  ; p is pointer-sized for both the returned HANDLE and CloseHandle input.
  System::Call 'kernel32::CreateFileW(w "$ZC_PREVIEW_DLL_PROBE_PATH", i 0x40000000|0x00010000, i 0, p 0, i 3, i 0x00000080, p 0) p.r1'
  ${IntPtrCmp} $1 -1 preview_dll_release_retry preview_dll_release_handle preview_dll_release_handle

preview_dll_release_handle:
  System::Call 'kernel32::CloseHandle(p $1) i.r2'
  ${If} $2 != 0
    Goto preview_dll_release_success
  ${EndIf}

preview_dll_release_retry:
  IntOp $0 $0 + 1
  IntCmp $0 ${ZC_PREVIEW_QUIESCE_ATTEMPTS} preview_dll_release_timeout 0 0
  Sleep ${ZC_PREVIEW_QUIESCE_DELAY_MS}
  Goto preview_dll_release_loop

preview_dll_release_timeout:
  StrCpy $ZC_PREVIEW_RELEASE_READY 0
  Return

preview_dll_release_success:
  StrCpy $ZC_PREVIEW_RELEASE_READY 1
  DetailPrint "Zen Canvas Preview Handler DLL release probe completed without changing the artifact."
FunctionEnd

Function RollbackZenCanvasPreviewQuiesce
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call RollbackZenCanvasPreviewRegistration
    Call NotifyZenCanvasPreviewAssociationChanged
    StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  ${EndIf}
FunctionEnd

Function CommitZenCanvasPreviewQuiesce
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call CommitZenCanvasPreviewRegistration
    StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  ${EndIf}
FunctionEnd

Function QuiesceZenCanvasPreviewBeforeInstall
  ; This hook is shared by fresh install, repair and upgrade. It must run
  ; before Global Index service changes or Tauri replaces the packaged DLL.
  Call ValidateZenCanvasPreviewCore
  StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 1
  Call WithdrawZenCanvasPreviewRegistration
  Call WaitForZenCanvasPreviewDllRelease
  ${If} $ZC_PREVIEW_RELEASE_READY != 1
    Call RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler DLL is still in use after the bounded release window. Close the preview normally and run the installer again; the prior registration and DLL were preserved." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

Function InstallZenCanvasPreviewHandler
  SetRegView 64

  ; The resource has already been unpacked by Tauri's generated NSIS section;
  ; verify it before any InprocServer32 value is written.
  IfFileExists "${ZC_PREVIEW_INSTALLED_DLL}" 0 preview_dll_missing
  Goto preview_dll_ready

preview_dll_missing:
  StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The Zen Canvas Preview Handler DLL is missing from this package."
  Call FailZenCanvasPostInstall

preview_dll_ready:
  !insertmacro ZC_WRITE_REG_VALUE "${ZC_PREVIEW_CLSID_KEY}" "" "${ZC_PREVIEW_FRIENDLY_NAME}"
  !insertmacro ZC_WRITE_REG_VALUE "${ZC_PREVIEW_CLSID_KEY}" "AppID" "${ZC_PREVIEW_PREVHOST_APP_ID}"
  !insertmacro ZC_WRITE_REG_VALUE "${ZC_PREVIEW_INPROC_KEY}" "" "${ZC_PREVIEW_INSTALLED_DLL}"
  !insertmacro ZC_WRITE_REG_VALUE "${ZC_PREVIEW_INPROC_KEY}" "ThreadingModel" "${ZC_PREVIEW_THREADING_MODEL}"
  !insertmacro ZC_WRITE_REG_VALUE "${ZC_PREVIEW_HANDLERS_KEY}" "${ZC_PREVIEW_PRODUCTION_CLSID}" "${ZC_PREVIEW_FRIENDLY_NAME}"

  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_01}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_02}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_03}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_04}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_05}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_06}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_07}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_08}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_09}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_10}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_11}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_12}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_13}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_14}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_15}"
  !insertmacro ZC_REGISTER_ASSOC "${ZC_PREVIEW_EXTENSION_16}"
  Call RemoveStaleZenCanvasPreviewAssociations
  Call NotifyZenCanvasPreviewAssociationChanged
FunctionEnd

Function un.WithdrawZenCanvasPreviewRegistration
  !insertmacro ZC_WITHDRAW_PREVIEW_BODY un.RollbackZenCanvasPreviewRegistration un.RemoveStaleZenCanvasPreviewAssociations un.NotifyZenCanvasPreviewAssociationChanged
FunctionEnd

Function un.WaitForZenCanvasPreviewDllRelease
  ; Keep uninstall on the same non-destructive, bounded release probe as
  ; install. It probes the exact trusted DLL path and does not mutate it.
  StrCpy $ZC_PREVIEW_RELEASE_READY 0
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH == ""
    Goto un_preview_dll_release_success
  ${EndIf}
  IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 un_preview_dll_release_success
  DetailPrint "Waiting for the Zen Canvas Preview Handler host to release the registered DLL..."
  StrCpy $0 0
un_preview_dll_release_loop:
  ; Keep the exact install probe contract: write/delete-class access, zero
  ; sharing, OPEN_EXISTING, normal attributes, and no file mutation.
  System::Call 'kernel32::CreateFileW(w "$ZC_PREVIEW_DLL_PROBE_PATH", i 0x40000000|0x00010000, i 0, p 0, i 3, i 0x00000080, p 0) p.r1'
  ${IntPtrCmp} $1 -1 un_preview_dll_release_retry un_preview_dll_release_handle un_preview_dll_release_handle

un_preview_dll_release_handle:
  System::Call 'kernel32::CloseHandle(p $1) i.r2'
  ${If} $2 != 0
    Goto un_preview_dll_release_success
  ${EndIf}

un_preview_dll_release_retry:
  IntOp $0 $0 + 1
  IntCmp $0 ${ZC_PREVIEW_QUIESCE_ATTEMPTS} un_preview_dll_release_timeout 0 0
  Sleep ${ZC_PREVIEW_QUIESCE_DELAY_MS}
  Goto un_preview_dll_release_loop

un_preview_dll_release_timeout:
  StrCpy $ZC_PREVIEW_RELEASE_READY 0
  Return

un_preview_dll_release_success:
  StrCpy $ZC_PREVIEW_RELEASE_READY 1
  DetailPrint "Zen Canvas Preview Handler DLL release probe completed without changing the artifact."
FunctionEnd

Function un.RollbackZenCanvasPreviewQuiesce
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call un.RollbackZenCanvasPreviewRegistration
    Call un.NotifyZenCanvasPreviewAssociationChanged
    StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  ${EndIf}
FunctionEnd

Function un.CommitZenCanvasPreviewQuiesce
  ${If} $ZC_PREVIEW_QUIESCE_ACTIVE == 1
    Call un.CommitZenCanvasPreviewRegistration
    StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  ${EndIf}
FunctionEnd

Function un.QuiesceZenCanvasPreviewBeforeUninstall
  ; Uninstall validates both authorities before withdrawal. The service stop is
  ; called by PREUNINSTALL after this function and before generated file delete.
  Call un.ValidateZenCanvasPreviewCore
  Call un.ValidateZenCanvasIndexServiceOwnership
  StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 1
  Call un.WithdrawZenCanvasPreviewRegistration
  Call un.WaitForZenCanvasPreviewDllRelease
  ${If} $ZC_PREVIEW_RELEASE_READY != 1
    Call un.RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler DLL is still in use after the bounded release window. Close the preview normally and run uninstall again; the prior registration and DLL were preserved." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

; This non-aborting evidence check is used by the guarded uninstall recovery
; owner. It deliberately excludes the Preview registry itself because that is
; the reversible transaction currently withdrawn by PREUNINSTALL.
Function un.CheckZenCanvasPreDeleteProductEvidence
  StrCpy $ZC_UNINSTALL_PREDELETE_COHERENT 0
  IfFileExists "$INSTDIR\$ZC_MAIN_BINARY_FILENAME" 0 un_predelete_evidence_failed
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH == ""
    Goto un_predelete_evidence_failed
  ${EndIf}
  IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 un_predelete_evidence_failed
  IfFileExists "$INSTDIR\uninstall.exe" 0 un_predelete_evidence_failed

  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayName"
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $ZC_PRODUCT_NAME
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "MainBinaryName"
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $ZC_MAIN_BINARY_FILENAME
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayIcon"
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $ZC_EXPECTED_DISPLAY_ICON
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayVersion"
  ${If} ${Errors}
  ${OrIf} $0 == ""
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "Publisher"
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $ZC_EXPECTED_PUBLISHER
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "InstallLocation"
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $ZC_EXPECTED_INSTALL_LOCATION
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "UninstallString"
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $ZC_EXPECTED_UNINSTALL_STRING
    Goto un_predelete_evidence_failed
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" ""
  ${If} ${Errors}
    Goto un_predelete_evidence_failed
  ${ElseIf} $0 != $INSTDIR
    Goto un_predelete_evidence_failed
  ${EndIf}

  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_UNINSTALL_ORIGINAL_SERVICE == 0
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 0
      Goto un_predelete_evidence_failed
    ${EndIf}
  ${ElseIf} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Goto un_predelete_evidence_failed
  ${EndIf}
  StrCpy $ZC_UNINSTALL_PREDELETE_COHERENT 1
  Return

un_predelete_evidence_failed:
  StrCpy $ZC_UNINSTALL_PREDELETE_COHERENT 0
FunctionEnd

Function un.VerifyZenCanvasPreviewRecovery
  StrCpy $ZC_UNINSTALL_PREVIEW_RECOVERED 0
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_CLSID_KEY}" ""
  ${If} ${Errors}
    Return
  ${ElseIf} $0 != "${ZC_PREVIEW_FRIENDLY_NAME}"
    Return
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_CLSID_KEY}" "AppID"
  ${If} ${Errors}
    Return
  ${ElseIf} $0 != "${ZC_PREVIEW_PREVHOST_APP_ID}"
    Return
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_INPROC_KEY}" ""
  ${If} ${Errors}
    Return
  ${ElseIf} $0 != "${ZC_PREVIEW_INSTALLED_DLL}"
    Return
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_INPROC_KEY}" "ThreadingModel"
  ${If} ${Errors}
    Return
  ${ElseIf} $0 != "${ZC_PREVIEW_THREADING_MODEL}"
    Return
  ${EndIf}
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_HANDLERS_KEY}" "${ZC_PREVIEW_PRODUCTION_CLSID}"
  ${If} ${Errors}
    Return
  ${ElseIf} $0 != "${ZC_PREVIEW_FRIENDLY_NAME}"
    Return
  ${EndIf}
  StrCpy $ZC_UNINSTALL_PREVIEW_RECOVERED 1
FunctionEnd

Function un.CaptureZenCanvasOriginalServiceState
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE 0
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE_WAS_RUNNING 0
  StrCpy $ZC_UNINSTALL_SERVICE_STATE_CAPTURED 0
  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    StrCpy $ZC_UNINSTALL_SERVICE_STATE_CAPTURED 1
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Global Index service ownership could not be verified safely. Uninstall was not changed." /SD IDOK
    Abort
  ${EndIf}
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE 1
  Call un.ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 1
    StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE_WAS_RUNNING 1
    StrCpy $ZC_UNINSTALL_SERVICE_STATE_CAPTURED 1
  ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    StrCpy $ZC_UNINSTALL_SERVICE_STATE_CAPTURED 1
  ${Else}
    MessageBox MB_ICONSTOP|MB_OK "The original Zen Canvas Global Index service state could not be determined safely. Uninstall was not changed." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

; Restore only the exact original uninstall service state. This function never
; creates a missing service and checks ImagePath immediately before start/stop.
Function un.RestoreZenCanvasOriginalService
  StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 1
  ${If} $ZC_UNINSTALL_SERVICE_STATE_CAPTURED != 1
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_UNINSTALL_ORIGINAL_SERVICE == 0
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 0
      StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    ${EndIf}
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}

  Call un.ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_UNINSTALL_ORIGINAL_SERVICE_WAS_RUNNING == 1
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 1
      Call un.WaitForZenCanvasIndexServiceRunning
    ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
      Call un.WaitForZenCanvasIndexServiceRunning
    ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
      Call un.ReadZenCanvasIndexServiceOwnership
      ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
        StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
        Return
      ${EndIf}
      nsExec::ExecToStack '"$SYSDIR\sc.exe" start "${ZC_INDEX_SERVICE_NAME}"'
      Pop $0
      Pop $1
      ${If} $0 != 0
        Call un.ReadZenCanvasIndexServiceOwnership
        ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
          StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
          Return
        ${EndIf}
        Call un.ReadZenCanvasIndexServiceRuntimeState
        ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
          StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
          Return
        ${EndIf}
      ${EndIf}
      Call un.WaitForZenCanvasIndexServiceRunning
    ${Else}
      StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
      Return
    ${EndIf}
    ${If} $ZC_INDEX_SERVICE_READY != 1
      StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    ${EndIf}
    Return
  ${EndIf}

  ; Originally stopped: preserve STOPPED without a redundant stop. A running
  ; exact-owned service is stopped only after a fresh ownership check.
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call un.WaitForZenCanvasIndexServiceStopped
    ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
      Return
    ${EndIf}
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  Call un.ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    Call un.ReadZenCanvasIndexServiceOwnership
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
      StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
      Return
    ${EndIf}
    Call un.ReadZenCanvasIndexServiceRuntimeState
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 2
      StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
      Return
    ${EndIf}
    Return
  ${EndIf}
  Call un.WaitForZenCanvasIndexServiceStopped
  ${If} $ZC_INDEX_SERVICE_STOPPED_READY != 1
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
  ${EndIf}
FunctionEnd

; Called by both NSIS uninstall abort/failure callbacks. Stage 1 is the only
; recovery window. Once any original product evidence is missing, treat the
; operation as post-delete/partial and never synthesize Preview or service
; state.
Function un.RecoverZenCanvasPreDeleteAbort
  ${If} $ZC_UNINSTALL_LIFECYCLE_STAGE != 1
    Return
  ${EndIf}
  ${If} $ZC_UNINSTALL_RECOVERY_DONE == 1
    Return
  ${EndIf}
  StrCpy $ZC_UNINSTALL_RECOVERY_DONE 1
  ${If} $ZC_UNINSTALL_PREDELETE_EVIDENCE_CAPTURED != 1
    DetailPrint "Uninstall abort occurred outside the recoverable product-evidence window; no Preview or service state was synthesized."
    Return
  ${EndIf}
  Call un.CheckZenCanvasPreDeleteProductEvidence
  ${If} $ZC_UNINSTALL_PREDELETE_COHERENT != 1
    ; Missing evidence means generated deletion may already have begun. Do
    ; not attempt a full restoration from a partial observation.
    StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 2
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    DetailPrint "Uninstall abort/failure could not prove the original product was still coherent; Preview rollback and service restart were withheld."
    Return
  ${EndIf}

  Call un.RollbackZenCanvasPreviewQuiesce
  Call un.VerifyZenCanvasPreviewRecovery
  Call un.RestoreZenCanvasOriginalService
  ${If} $ZC_UNINSTALL_PREVIEW_RECOVERED == 1
  ${AndIf} $ZC_UNINSTALL_SERVICE_CLEAN == 1
    DetailPrint "Pre-delete uninstall abort recovery restored the exact captured Preview registration and original service state; product files, metadata, and uninstall.exe remain."
  ${Else}
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    DetailPrint "Pre-delete uninstall abort recovery was incomplete; no foreign service was touched and the remaining state is reported as incomplete."
  ${EndIf}
FunctionEnd

; MUI2 owns the generated un.onUserAbort callback. Register the recovery
; function through its supported custom-callback seam instead of defining a
; second un.onUserAbort function.
!ifndef MUI_CUSTOMFUNCTION_UNABORT
!define MUI_CUSTOMFUNCTION_UNABORT un.ZCOnUserAbort
!endif

Function un.ZCOnUserAbort
  Call un.RecoverZenCanvasPreDeleteAbort
FunctionEnd

Function un.onUninstFailed
  Call un.RecoverZenCanvasPreDeleteAbort
FunctionEnd

Function un.FinalizeZenCanvasPreviewUninstall
  ; Enter Stage 2 only when the generated uninstall section has reached its
  ; post-generated hook. Stage 3 is the truthful partial-cleanup state.
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 2
  ; Generated NSIS deletes the packaged DLL after NSIS_HOOK_PREUNINSTALL.
  ; Finalize withdrawal truthfully even when that generated delete failed:
  ; restoring registration would point Explorer at a removed or stale DLL.
  StrCpy $ZC_PREVIEW_ARTIFACT_REMOVED 1
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH != ""
    IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 un_preview_artifact_removed
    StrCpy $ZC_PREVIEW_ARTIFACT_REMOVED 0
    DetailPrint "The generated uninstall section did not remove the Zen Canvas Preview Handler DLL; registration remains finalized as withdrawn."
  ${EndIf}
un_preview_artifact_removed:
  Call un.CommitZenCanvasPreviewQuiesce
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 3
FunctionEnd

Function un.NotifyZenCanvasPreviewAssociationChanged
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
FunctionEnd

Function un.RemoveStaleZenCanvasPreviewAssociations
  SetRegView 64
  StrCpy $0 0
un_stale_association_loop:
  ClearErrors
  EnumRegKey $1 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}" $0
  ${If} ${Errors}
    Return
  ${EndIf}
  ${If} $1 == ""
    Return
  ${EndIf}
    StrCpy $2 $1 1
    ${If} $2 == "."
      StrCpy $3 ""
      ReadRegStr $3 HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\$1\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
      ${If} $3 == "${ZC_PREVIEW_PRODUCTION_CLSID}"
        !insertmacro ZC_RECORD_REG_VALUE "${ZC_PREVIEW_ASSOCIATION_ROOT}\$1\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
        ClearErrors
        DeleteRegValue HKLM "${ZC_PREVIEW_ASSOCIATION_ROOT}\$1\shellex\${ZC_PREVIEW_SHELLEX_CATEGORY}" ""
        ${If} ${Errors}
          Call un.RollbackZenCanvasPreviewRegistration
          Call un.NotifyZenCanvasPreviewAssociationChanged
          MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler stale association cleanup failed. The operation was aborted." /SD IDOK
          Abort
        ${EndIf}
        Goto un_stale_association_loop
      ${EndIf}
  ${EndIf}
  IntOp $0 $0 + 1
  Goto un_stale_association_loop
FunctionEnd

Function StopZenCanvasIndexService
  Call ValidateZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  Call ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call WaitForZenCanvasIndexServiceStopped
    ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
      Return
    ${EndIf}
    Goto stop_wait_timeout
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
    Goto stop_wait_timeout
  ${EndIf}
  ; Re-read immediately before the stop mutation. A service that changed to
  ; foreign/empty ownership is never touched by this installer.
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Goto stop_wait_timeout
  ${EndIf}
  DetailPrint "Stopping Zen Canvas Global Index service..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  ${If} $0 != 0
    Goto stop_wait_timeout
  ${EndIf}
  Call WaitForZenCanvasIndexServiceStopped
  ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
    Return
  ${EndIf}

stop_wait_timeout:
  Call RollbackZenCanvasPreviewQuiesce
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Global Index service did not stop in time.$\r$\n$\r$\n$1" /SD IDOK
  Abort
FunctionEnd

; NSIS requires uninstall-section calls to target functions prefixed with `un.`.
; Keep uninstall service cleanup independent from installer functions so the
; generated uninstaller compiles and preserves the same fail-closed behavior.
Function un.StopZenCanvasIndexService
  StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 1
  Call un.ValidateZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  ${If} $ZC_UNINSTALL_ORIGINAL_SERVICE == 0
    ; PREUNINSTALL captured an absent service. Never stop a same-name service
    ; that appeared concurrently, even if its ImagePath looks current.
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    MessageBox MB_ICONSTOP|MB_OK "A Zen Canvas Global Index service appeared during uninstall but was not part of the captured installation. It was not modified; uninstall was aborted." /SD IDOK
    Abort
  ${EndIf}
  Call un.ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call un.WaitForZenCanvasIndexServiceStopped
    ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
      Return
    ${EndIf}
    Goto un_stop_wait_timeout
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 4
      Return
    ${EndIf}
    Goto un_stop_wait_timeout
  ${EndIf}
  ; Re-check exact ImagePath immediately before stopping the service.
  Call un.ValidateZenCanvasIndexServiceOwnership
  DetailPrint "Stopping Zen Canvas Global Index service..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  ${If} $0 != 0
    Goto un_stop_wait_timeout
  ${EndIf}
  Call un.WaitForZenCanvasIndexServiceStopped
  ${If} $ZC_INDEX_SERVICE_STOPPED_READY == 1
    Return
  ${EndIf}

un_stop_wait_timeout:
  StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
  Call un.RecoverZenCanvasPreDeleteAbort
  MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Global Index service did not stop before generated uninstall file deletion.$\r$\n$\r$\n$1" /SD IDOK
  DetailPrint "Uninstall is incomplete; the Zen Canvas Global Index service was not removed."
  Abort
FunctionEnd

Function un.DeleteZenCanvasIndexService
  StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 1
  Call un.ValidateZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  ; Re-check immediately before deletion. A foreign or empty ImagePath is
  ; never deleted, even if the service name is the expected one.
  Call un.ValidateZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    Return
  ${EndIf}
  DetailPrint "Removing Zen Canvas Global Index service registration..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" delete "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  ${If} $0 != 0
    StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
    MessageBox MB_ICONSTOP|MB_OK "The Preview Handler registration was finalized as withdrawn, but the Zen Canvas Global Index service could not be removed.$\r$\n$\r$\n$1" /SD IDOK
    DetailPrint "Uninstall is incomplete; the Zen Canvas Global Index service was not removed."
    Abort
  ${EndIf}

  StrCpy $2 0
un_delete_wait_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS} un_delete_wait_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  Sleep 250
  IntOp $2 $2 + 1
  Goto un_delete_wait_loop

un_delete_wait_timeout:
  StrCpy $ZC_UNINSTALL_SERVICE_CLEAN 0
  MessageBox MB_ICONSTOP|MB_OK "The Preview Handler registration was finalized as withdrawn, but removal of the Zen Canvas Global Index service was not verified. Restart Windows to finish cleanup.$\r$\n$\r$\nUninstall is incomplete." /SD IDOK
  Abort
FunctionEnd

!macro ZC_WAIT_INDEX_SERVICE_RUNNING_BODY READ_FUNCTION PREFIX
  ; Service start is asynchronous. Require two consecutive RUNNING samples
  ; inside a finite window; STOPPED, absent, query errors and timeout fail
  ; closed. PENDING states continue through the bounded window.
  StrCpy $ZC_INDEX_SERVICE_READY 0
  StrCpy $2 0
  StrCpy $3 0
${PREFIX}_index_service_ready_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_READY_ATTEMPTS} ${PREFIX}_index_service_ready_timeout 0 0
  Call ${READ_FUNCTION}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 1
    IntOp $3 $3 + 1
    ${If} $3 >= ${ZC_INDEX_SERVICE_RUNNING_CONFIRMATIONS}
      Goto ${PREFIX}_index_service_ready_success
    ${EndIf}
  ${ElseIf} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    StrCpy $3 0
  ${Else}
    Return
  ${EndIf}
  Sleep ${ZC_INDEX_SERVICE_READY_DELAY_MS}
  IntOp $2 $2 + 1
  Goto ${PREFIX}_index_service_ready_loop

${PREFIX}_index_service_ready_timeout:
  Return

${PREFIX}_index_service_ready_success:
  StrCpy $ZC_INDEX_SERVICE_READY 1
!macroend

Function WaitForZenCanvasIndexServiceRunning
  !insertmacro ZC_WAIT_INDEX_SERVICE_RUNNING_BODY ReadZenCanvasIndexServiceRuntimeState index_service
FunctionEnd

Function un.WaitForZenCanvasIndexServiceRunning
  !insertmacro ZC_WAIT_INDEX_SERVICE_RUNNING_BODY un.ReadZenCanvasIndexServiceRuntimeState un_index_service
FunctionEnd

!macro ZC_WAIT_INDEX_SERVICE_STOPPED_BODY READ_FUNCTION PREFIX
  StrCpy $ZC_INDEX_SERVICE_STOPPED_READY 0
  StrCpy $2 0
${PREFIX}_index_service_stopped_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS} ${PREFIX}_index_service_stopped_timeout 0 0
  Call ${READ_FUNCTION}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 2
    StrCpy $ZC_INDEX_SERVICE_STOPPED_READY 1
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 0
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 4
    Return
  ${EndIf}
  Sleep ${ZC_INDEX_SERVICE_CLEANUP_DELAY_MS}
  IntOp $2 $2 + 1
  Goto ${PREFIX}_index_service_stopped_loop

${PREFIX}_index_service_stopped_timeout:
  Return
!macroend

Function WaitForZenCanvasIndexServiceStopped
  !insertmacro ZC_WAIT_INDEX_SERVICE_STOPPED_BODY ReadZenCanvasIndexServiceRuntimeState index_service
FunctionEnd

Function un.WaitForZenCanvasIndexServiceStopped
  !insertmacro ZC_WAIT_INDEX_SERVICE_STOPPED_BODY un.ReadZenCanvasIndexServiceRuntimeState un_index_service
FunctionEnd

; Bring an exact-owned service to stable RUNNING without treating a redundant
; sc start as the proof of success. The caller decides whether failure is
; fatal (install) or a truthful incomplete restoration (compensation).
Function EnsureZenCanvasIndexServiceRunning
  StrCpy $ZC_INDEX_SERVICE_READY 0
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  Call ReadZenCanvasIndexServiceRuntimeState
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 1
    Call WaitForZenCanvasIndexServiceRunning
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE == 3
    Call WaitForZenCanvasIndexServiceRunning
    Return
  ${EndIf}
  ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 2
    Return
  ${EndIf}

  ; Only the exact current ImagePath may authorize the start mutation.
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" start "${ZC_INDEX_SERVICE_NAME}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    ; A concurrent actor may have made the desired state true despite a
    ; non-zero result. Re-read both ownership and runtime state before fail.
    Call ReadZenCanvasIndexServiceOwnership
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP != 1
      Return
    ${EndIf}
    Call ReadZenCanvasIndexServiceRuntimeState
    ${If} $ZC_INDEX_SERVICE_RUNTIME_STATE != 1
      Return
    ${EndIf}
  ${EndIf}
  Call WaitForZenCanvasIndexServiceRunning
FunctionEnd

Function InstallZenCanvasIndexService
  DetailPrint "Installing Zen Canvas Global Index service..."
  ${If} $ZC_MAIN_BINARY_FILENAME == ""
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The Tauri main binary name was unavailable; the Global Index service was not created."
    Call FailZenCanvasPostInstall
  ${EndIf}
  IfFileExists "$INSTDIR\$ZC_MAIN_BINARY_FILENAME" 0 index_service_main_binary_missing
  Call ReadZenCanvasIndexServiceOwnership
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 2
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The existing Zen Canvas Global Index service is not owned by the current canonical binary."
    Call FailZenCanvasPostInstall
  ${EndIf}

  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 0
    nsExec::ExecToStack '"$SYSDIR\sc.exe" create "${ZC_INDEX_SERVICE_NAME}" binPath= "\"$INSTDIR\$ZC_MAIN_BINARY_FILENAME\" --index-service" start= auto obj= LocalSystem DisplayName= "Zen Canvas Global Index"'
    Pop $0
    Pop $1
    ${If} $0 != 0
      StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Could not install the Zen Canvas Global Index service.$\r$\n$\r$\n$1"
      Call FailZenCanvasPostInstall
    ${EndIf}
    ; Record the successful CREATE before doing any ownership re-read. A
    ; later invalid/foreign observation must still reach compensation logic.
    StrCpy $ZC_INDEX_SERVICE_CREATE_SUCCEEDED 1
    Call ReadZenCanvasIndexServiceOwnership
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 1
      StrCpy $ZC_INDEX_SERVICE_CREATE_OWNERSHIP_VERIFIED 1
      StrCpy $ZC_INDEX_SERVICE_CREATED 1
    ${Else}
      StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The newly created Zen Canvas Global Index service did not retain the current canonical ImagePath."
      Call FailZenCanvasPostInstall
    ${EndIf}

    nsExec::ExecToStack '"$SYSDIR\sc.exe" description "${ZC_INDEX_SERVICE_NAME}" "Enumerates local Windows volume metadata for Zen Canvas global search."'
    Pop $0
    Pop $1
    ${If} $0 != 0
      DetailPrint "Warning: service description could not be configured: $1"
    ${EndIf}

    nsExec::ExecToStack '"$SYSDIR\sc.exe" failure "${ZC_INDEX_SERVICE_NAME}" reset= 86400 actions= restart/5000/restart/30000/""/0'
    Pop $0
    Pop $1
    ${If} $0 != 0
      DetailPrint "Warning: service recovery policy could not be configured: $1"
    ${EndIf}
  ${Else}
    DetailPrint "Using the existing Zen Canvas Global Index service with its exact current ImagePath."
  ${EndIf}

  Call EnsureZenCanvasIndexServiceRunning
  ${If} $ZC_INDEX_SERVICE_READY != 1
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Zen Canvas Global Index service could not be proven exact-owned and stably RUNNING within the bounded readiness window."
    Call FailZenCanvasPostInstall
  ${EndIf}
  Return

index_service_main_binary_missing:
  StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The Tauri main binary was missing from the install directory; the Global Index service was not created."
  Call FailZenCanvasPostInstall
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  StrCpy $ZC_MAIN_BINARY_FILENAME "${MAINBINARYNAME}.exe"
  StrCpy $ZC_UNINSTALLER_REGISTRY_KEY "${UNINSTKEY}"
  StrCpy $ZC_MANUFACTURER_PRODUCT_KEY "${MANUPRODUCTKEY}"
  StrCpy $ZC_PRODUCT_NAME "${PRODUCTNAME}"
  StrCpy $ZC_MANUFACTURER_NAME "${MANUFACTURER}"
  StrCpy $ZC_INDEX_SERVICE_CREATED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_SUCCEEDED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_OWNERSHIP_VERIFIED 0
  StrCpy $ZC_POSTINSTALL_ACTIVE 0
  StrCpy $ZC_INSTALL_FAILURE_COMPENSATED 0
  StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 0
  StrCpy $ZC_PREVIEW_TXN_COUNT 0
  Call ValidateZenCanvasPreexistingProduct
  Call ValidateZenCanvasIndexServiceOwnership
  ${If} $ZC_PREEXISTING_PRODUCT == 0
    ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 1
      MessageBox MB_ICONSTOP|MB_OK "A Zen Canvas Global Index service already exists without consistent Tauri product metadata. Installation was not changed." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 1
  StrCpy $ZC_PREEXISTING_SERVICE 0
  StrCpy $ZC_PREEXISTING_SERVICE_WAS_RUNNING 0
  ${If} $ZC_INDEX_SERVICE_OWNERSHIP == 1
    StrCpy $ZC_PREEXISTING_SERVICE 1
    Call CaptureZenCanvasPreexistingServiceState
  ${EndIf}
  Call QuiesceZenCanvasPreviewBeforeInstall
  Call StopZenCanvasIndexService
!macroend

!macro NSIS_HOOK_POSTINSTALL
  StrCpy $ZC_MAIN_BINARY_FILENAME "${MAINBINARYNAME}.exe"
  StrCpy $ZC_UNINSTALLER_REGISTRY_KEY "${UNINSTKEY}"
  StrCpy $ZC_MANUFACTURER_PRODUCT_KEY "${MANUPRODUCTKEY}"
  StrCpy $ZC_INDEX_SERVICE_CREATED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_SUCCEEDED 0
  StrCpy $ZC_INDEX_SERVICE_CREATE_OWNERSHIP_VERIFIED 0
  StrCpy $ZC_POSTINSTALL_ACTIVE 1
  Call InstallZenCanvasIndexService
  Call InstallZenCanvasPreviewHandler
  Call CommitZenCanvasPreviewQuiesce
  StrCpy $ZC_POSTINSTALL_ACTIVE 0
  StrCpy $ZC_INSTALL_LIFECYCLE_ACTIVE 0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
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
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 0
  StrCpy $ZC_UNINSTALL_RECOVERY_DONE 0
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE 0
  StrCpy $ZC_UNINSTALL_ORIGINAL_SERVICE_WAS_RUNNING 0
  StrCpy $ZC_UNINSTALL_SERVICE_STATE_CAPTURED 0
  StrCpy $ZC_UNINSTALL_PREDELETE_EVIDENCE_CAPTURED 0
  StrCpy $ZC_UNINSTALL_PREDELETE_COHERENT 0
  StrCpy $ZC_UNINSTALL_PREVIEW_RECOVERED 0

  ; Resolve Tauri's generated process gate before any reversible custom
  ; mutation. The generated uninstall section still repeats this exact gate
  ; immediately after PREUNINSTALL; the recovery owner below covers that
  ; later abort/failure window as well.
  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
  Call un.ValidateZenCanvasPreviewCore
  Call un.ValidateZenCanvasIndexServiceOwnership
  Call un.CaptureZenCanvasOriginalServiceState
  Call un.CheckZenCanvasPreDeleteProductEvidence
  ${If} $ZC_UNINSTALL_PREDELETE_COHERENT != 1
    MessageBox MB_ICONSTOP|MB_OK "The installed Zen Canvas product could not be verified as a coherent pre-delete installation. Uninstall was not changed." /SD IDOK
    Abort
  ${EndIf}
  StrCpy $ZC_UNINSTALL_PREDELETE_EVIDENCE_CAPTURED 1
  StrCpy $ZC_UNINSTALL_LIFECYCLE_STAGE 1
  Call un.QuiesceZenCanvasPreviewBeforeUninstall
  Call un.StopZenCanvasIndexService
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Call un.FinalizeZenCanvasPreviewUninstall
  Call un.DeleteZenCanvasIndexService
  ${If} $ZC_PREVIEW_ARTIFACT_REMOVED != 1
    ${If} $ZC_UNINSTALL_SERVICE_CLEAN == 1
      MessageBox MB_ICONSTOP|MB_OK "Uninstall is incomplete. The Preview Handler registration was finalized as withdrawn, but the Preview Handler DLL could not be removed; Global Index service cleanup completed." /SD IDOK
      Abort
    ${Else}
      MessageBox MB_ICONSTOP|MB_OK "Uninstall is incomplete. The Preview Handler registration was finalized as withdrawn, but the Preview Handler DLL and Global Index service cleanup could not both be verified." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}
!macroend
