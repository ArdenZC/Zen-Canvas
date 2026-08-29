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

; POSTINSTALL runs after Tauri has copied the product and written its
; uninstall metadata. This compensation path removes only state owned by the
; current Zen attempt and deliberately leaves generated application files in
; place when deleting them cannot be proven safe at this hook stage.
Function CompensateZenCanvasPostInstallService
  StrCpy $ZC_POSTINSTALL_SERVICE_CLEAN 1
  ${If} $ZC_INDEX_SERVICE_CREATED != 1
    Return
  ${EndIf}

  DetailPrint "Compensating the Zen Canvas Global Index service after installation failure..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  StrCpy $2 0
postinstall_service_stop_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS} postinstall_service_delete 0 0
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"ZenCanvasGlobalIndex\" | \"$SYSDIR\findstr.exe\" /C:\"STOPPED\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    Goto postinstall_service_delete
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Goto postinstall_service_delete
  ${EndIf}
  Sleep ${ZC_INDEX_SERVICE_CLEANUP_DELAY_MS}
  IntOp $2 $2 + 1
  Goto postinstall_service_stop_loop

postinstall_service_delete:
  nsExec::ExecToStack '"$SYSDIR\sc.exe" delete "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Goto postinstall_service_cleanup_success
  ${EndIf}
  StrCpy $2 0
postinstall_service_delete_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_CLEANUP_ATTEMPTS} postinstall_service_cleanup_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
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

Function FailZenCanvasPostInstall
  ${If} $ZC_PREVIEW_TXN_COUNT != 0
    Call RollbackZenCanvasPreviewRegistration
    Call NotifyZenCanvasPreviewAssociationChanged
  ${EndIf}
  Call CompensateZenCanvasPostInstallService

  ; These are the exact per-machine Tauri authorities bound in the
  ; POSTINSTALL macro. Do not recursively delete arbitrary registry state.
  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 1
  SetRegView 64
  ${If} $ZC_UNINSTALLER_REGISTRY_KEY != ""
    ClearErrors
    DeleteRegKey HKLM "$ZC_UNINSTALLER_REGISTRY_KEY"
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_UNINSTALLER_REGISTRY_KEY" "DisplayName"
    ${If} !${Errors}
      StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
    ${EndIf}
  ${EndIf}
  ${If} $ZC_MANUFACTURER_PRODUCT_KEY != ""
    ClearErrors
    DeleteRegValue HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" ""
    ClearErrors
    ReadRegStr $0 HKLM "$ZC_MANUFACTURER_PRODUCT_KEY" ""
    ${If} !${Errors}
      StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0
    ${EndIf}
    DeleteRegKey /ifempty HKLM "$ZC_MANUFACTURER_PRODUCT_KEY"
  ${EndIf}
  IfFileExists "$INSTDIR\uninstall.exe" 0 postinstall_uninstaller_cleanup_done
  ClearErrors
  Delete "$INSTDIR\uninstall.exe"
  IfFileExists "$INSTDIR\uninstall.exe" 0 postinstall_uninstaller_cleanup_done
  StrCpy $ZC_POSTINSTALL_METADATA_CLEAN 0

postinstall_uninstaller_cleanup_done:
  ${If} $ZC_POSTINSTALL_METADATA_CLEAN != 1
    StrCpy $2 "Add/Remove Programs or uninstaller cleanup could not be fully verified."
  ${Else}
    StrCpy $2 "Add/Remove Programs and uninstaller metadata were neutralized."
  ${EndIf}

  ${If} $ZC_POSTINSTALL_SERVICE_CLEAN == 1
    StrCpy $1 "The current attempt's service and Preview registration were compensated. $2"
  ${Else}
    StrCpy $1 "Service cleanup could not be verified within the bounded compensation window. $2"
  ${EndIf}
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas installation did not complete. Product files may remain in the install directory, but this attempt is not represented as a successful product.$\r$\n$\r$\n$ZC_POSTINSTALL_FAILURE_REASON$\r$\n$\r$\n$1" /SD IDOK
  Abort
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
  StrCpy $ZC_PREVIEW_TXN_COUNT 0

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
  Call CommitZenCanvasPreviewRegistration
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
  ; Uninstall withdraws and settles Preview before it removes Global Index.
  Call un.ValidateZenCanvasPreviewCore
  StrCpy $ZC_PREVIEW_QUIESCE_ACTIVE 1
  Call un.WithdrawZenCanvasPreviewRegistration
  Call un.WaitForZenCanvasPreviewDllRelease
  ${If} $ZC_PREVIEW_RELEASE_READY != 1
    Call un.RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler DLL is still in use after the bounded release window. Close the preview normally and run uninstall again; the prior registration and DLL were preserved." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

Function un.FinalizeZenCanvasPreviewUninstall
  ; Generated NSIS deletes the packaged DLL after NSIS_HOOK_PREUNINSTALL. Do
  ; not commit registration withdrawal until that real deletion has completed;
  ; a failed delete keeps the old registration recoverable.
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH != ""
    IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 un_preview_artifact_removed
    Call un.RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "The registered Zen Canvas Preview Handler DLL could not be removed. The Preview Handler registration was restored, but Global Index service cleanup was not attempted. Uninstall is incomplete." /SD IDOK
    Abort
  ${EndIf}
un_preview_artifact_removed:
  Call un.CommitZenCanvasPreviewQuiesce
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
  DetailPrint "Stopping Zen Canvas Global Index service..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1

  ; ERROR_SERVICE_DOES_NOT_EXIST (1060) and ERROR_SERVICE_NOT_ACTIVE (1062)
  ; are acceptable. For an active service, poll until SCM reports STOPPED.
  StrCpy $2 0
stop_wait_loop:
  IntCmp $2 40 stop_wait_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"ZenCanvasGlobalIndex\" | \"$SYSDIR\findstr.exe\" /C:\"STOPPED\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  Sleep 250
  IntOp $2 $2 + 1
  Goto stop_wait_loop

stop_wait_timeout:
  Call RollbackZenCanvasPreviewQuiesce
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Global Index service did not stop in time.$\r$\n$\r$\n$1" /SD IDOK
  Abort
FunctionEnd

Function DeleteZenCanvasIndexService
  DetailPrint "Removing previous Zen Canvas Global Index service registration..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" delete "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  ${If} $0 != 0
    Call RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "Could not remove the previous Zen Canvas Global Index service.$\r$\n$\r$\n$1" /SD IDOK
    Abort
  ${EndIf}

  ; SCM may briefly retain a service marked for deletion while handles close.
  StrCpy $2 0
delete_wait_loop:
  IntCmp $2 40 delete_wait_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  Sleep 250
  IntOp $2 $2 + 1
  Goto delete_wait_loop

delete_wait_timeout:
  Call RollbackZenCanvasPreviewQuiesce
  MessageBox MB_ICONSTOP|MB_OK "The previous Zen Canvas Global Index service is still pending deletion. Restart Windows and run the installer again." /SD IDOK
  Abort
FunctionEnd

; NSIS requires uninstall-section calls to target functions prefixed with `un.`.
; Keep uninstall service cleanup independent from installer functions so the
; generated uninstaller compiles and preserves the same fail-closed behavior.
Function un.StopZenCanvasIndexService
  DetailPrint "Stopping Zen Canvas Global Index service..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" stop "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1

  StrCpy $2 0
un_stop_wait_loop:
  IntCmp $2 40 un_stop_wait_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"ZenCanvasGlobalIndex\" | \"$SYSDIR\findstr.exe\" /C:\"STOPPED\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    Return
  ${EndIf}
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  Sleep 250
  IntOp $2 $2 + 1
  Goto un_stop_wait_loop

un_stop_wait_timeout:
  MessageBox MB_ICONSTOP|MB_OK "The Preview Handler was finalized, but the Zen Canvas Global Index service did not stop in time.$\r$\n$\r$\n$1" /SD IDOK
  DetailPrint "Uninstall is incomplete; the Zen Canvas Global Index service was not removed."
  Abort
FunctionEnd

Function un.DeleteZenCanvasIndexService
  DetailPrint "Removing Zen Canvas Global Index service registration..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" delete "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "The Preview Handler was finalized, but the Zen Canvas Global Index service could not be removed.$\r$\n$\r$\n$1" /SD IDOK
    DetailPrint "Uninstall is incomplete; the Zen Canvas Global Index service was not removed."
    Abort
  ${EndIf}

  StrCpy $2 0
un_delete_wait_loop:
  IntCmp $2 40 un_delete_wait_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  Sleep 250
  IntOp $2 $2 + 1
  Goto un_delete_wait_loop

un_delete_wait_timeout:
  MessageBox MB_ICONSTOP|MB_OK "The Preview Handler was finalized, but removal of the Zen Canvas Global Index service was not verified. Restart Windows to finish cleanup.$\r$\n$\r$\nUninstall is incomplete." /SD IDOK
  Abort
FunctionEnd

Function WaitForZenCanvasIndexServiceRunning
  ; Service start is asynchronous. Require two consecutive RUNNING samples
  ; inside a finite window; STOPPED, query errors and timeout all fail closed.
  StrCpy $ZC_INDEX_SERVICE_READY 0
  StrCpy $2 0
  StrCpy $3 0
index_service_ready_loop:
  IntCmp $2 ${ZC_INDEX_SERVICE_READY_ATTEMPTS} index_service_ready_timeout 0 0
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 == 1060
    Return
  ${EndIf}
  ${If} $0 != 0
    Return
  ${EndIf}

  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"ZenCanvasGlobalIndex\" | \"$SYSDIR\findstr.exe\" /C:\"RUNNING\" >NUL"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    IntOp $3 $3 + 1
    IntCmp $3 ${ZC_INDEX_SERVICE_RUNNING_CONFIRMATIONS} index_service_ready_success 0 index_service_ready_success
  ${Else}
    StrCpy $3 0
    nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"ZenCanvasGlobalIndex\" | \"$SYSDIR\findstr.exe\" /C:\"STOPPED\" >NUL"'
    Pop $0
    Pop $1
    ${If} $0 == 0
      Return
    ${EndIf}
    nsExec::ExecToStack '"$SYSDIR\cmd.exe" /D /S /C "\"$SYSDIR\sc.exe\" query \"ZenCanvasGlobalIndex\" | \"$SYSDIR\findstr.exe\" /C:\"FAILED\" >NUL"'
    Pop $0
    Pop $1
    ${If} $0 == 0
      Return
    ${EndIf}
  ${EndIf}
  Sleep ${ZC_INDEX_SERVICE_READY_DELAY_MS}
  IntOp $2 $2 + 1
  Goto index_service_ready_loop

index_service_ready_timeout:
  Return

index_service_ready_success:
  StrCpy $ZC_INDEX_SERVICE_READY 1
FunctionEnd

Function InstallZenCanvasIndexService
  DetailPrint "Installing Zen Canvas Global Index service..."
  ${If} $ZC_MAIN_BINARY_FILENAME == ""
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The Tauri main binary name was unavailable; the Global Index service was not created."
    Call FailZenCanvasPostInstall
  ${EndIf}
  IfFileExists "$INSTDIR\$ZC_MAIN_BINARY_FILENAME" 0 index_service_main_binary_missing
  nsExec::ExecToStack '"$SYSDIR\sc.exe" create "ZenCanvasGlobalIndex" binPath= "\"$INSTDIR\$ZC_MAIN_BINARY_FILENAME\" --index-service" start= auto obj= LocalSystem DisplayName= "Zen Canvas Global Index"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Could not install the Zen Canvas Global Index service.$\r$\n$\r$\n$1"
    Call FailZenCanvasPostInstall
  ${EndIf}
  StrCpy $ZC_INDEX_SERVICE_CREATED 1

  nsExec::ExecToStack '"$SYSDIR\sc.exe" description "ZenCanvasGlobalIndex" "Enumerates local Windows volume metadata for Zen Canvas global search."'
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "Warning: service description could not be configured: $1"
  ${EndIf}

  nsExec::ExecToStack '"$SYSDIR\sc.exe" failure "ZenCanvasGlobalIndex" reset= 86400 actions= restart/5000/restart/30000/""/0'
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "Warning: service recovery policy could not be configured: $1"
  ${EndIf}

  nsExec::ExecToStack '"$SYSDIR\sc.exe" start "ZenCanvasGlobalIndex"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Zen Canvas Global Index service could not be started.$\r$\n$\r$\n$1"
    Call FailZenCanvasPostInstall
  ${EndIf}

  Call WaitForZenCanvasIndexServiceRunning
  ${If} $ZC_INDEX_SERVICE_READY != 1
    StrCpy $ZC_POSTINSTALL_FAILURE_REASON "Zen Canvas Global Index service did not reach a stable RUNNING state within the bounded readiness window."
    Call FailZenCanvasPostInstall
  ${EndIf}
  Return

index_service_main_binary_missing:
  StrCpy $ZC_POSTINSTALL_FAILURE_REASON "The Tauri main binary was missing from the install directory; the Global Index service was not created."
  Call FailZenCanvasPostInstall
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  Call QuiesceZenCanvasPreviewBeforeInstall
  Call StopZenCanvasIndexService
  Call DeleteZenCanvasIndexService
  Call CommitZenCanvasPreviewQuiesce
!macroend

!macro NSIS_HOOK_POSTINSTALL
  StrCpy $ZC_MAIN_BINARY_FILENAME "${MAINBINARYNAME}.exe"
  StrCpy $ZC_UNINSTALLER_REGISTRY_KEY "${UNINSTKEY}"
  StrCpy $ZC_MANUFACTURER_PRODUCT_KEY "${MANUPRODUCTKEY}"
  StrCpy $ZC_INDEX_SERVICE_CREATED 0
  StrCpy $ZC_POSTINSTALL_ACTIVE 1
  Call InstallZenCanvasIndexService
  Call InstallZenCanvasPreviewHandler
  StrCpy $ZC_POSTINSTALL_ACTIVE 0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Call un.QuiesceZenCanvasPreviewBeforeUninstall
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Call un.FinalizeZenCanvasPreviewUninstall
  Call un.StopZenCanvasIndexService
  Call un.DeleteZenCanvasIndexService
!macroend
