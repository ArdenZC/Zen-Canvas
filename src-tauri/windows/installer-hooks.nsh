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
        MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler could not withdraw an owned registry value. The operation was aborted."
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
      MessageBox MB_ICONSTOP|MB_OK "A foreign or inconsistent Preview Handler already owns the Zen Canvas production CLSID. Installation was not changed."
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
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production CLSID has a foreign or inconsistent AppID. Installation was not changed."
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
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler has a foreign or inconsistent threading model. Installation was not changed."
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
      MessageBox MB_ICONSTOP|MB_OK "A foreign or inconsistent PreviewHandlers entry conflicts with Zen Canvas. Installation was not changed."
      Abort
    ${EndIf}
  ${EndIf}

  ; An existing InprocServer32 path is trusted only when every surrounding
  ; production identity marker is present and exact. This accepts a prior Zen
  ; install path during upgrade, but never treats a foreign or partial core as
  ; repairable. A present empty path is also a collision, not an absent value.
  StrCpy $0 ""
  ClearErrors
  ReadRegStr $0 HKLM "${ZC_PREVIEW_INPROC_KEY}" ""
  ${If} ${Errors}
  ${Else}
    StrCpy $ZC_PREVIEW_CORE_PRESENT 1
    StrCpy $ZC_PREVIEW_INPROC_PATH_PRESENT 1
    ${If} $0 == ""
      MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production InprocServer32 path is present but empty. Installation was not changed."
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
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas production core registration is incomplete. Installation was not changed."
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

!macro ZC_WRITE_REG_VALUE PATH NAME VALUE
  !insertmacro ZC_RECORD_REG_VALUE "${PATH}" "${NAME}"
  ClearErrors
  WriteRegStr HKLM "${PATH}" "${NAME}" "${VALUE}"
  ${If} ${Errors}
    Call RollbackZenCanvasPreviewRegistration
    Call NotifyZenCanvasPreviewAssociationChanged
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler registration failed. Installation has been rolled back."
    Abort
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
          MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler stale association cleanup failed. Installation was not changed."
          Call RollbackZenCanvasPreviewRegistration
          Call NotifyZenCanvasPreviewAssociationChanged
          Abort
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
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler DLL is still in use after the bounded release window. Close the preview normally and run the installer again; the prior registration and DLL were preserved."
    Abort
  ${EndIf}
FunctionEnd

Function RemoveZenCanvasLegacyPreviewDll
  ; An exact Zen-owned old InprocServer32 path is cleaned only after the
  ; non-destructive release probe and Global Index prerequisites have succeeded.
  ; The current package path is left for Tauri's normal replacement step.
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH == ""
    Return
  ${EndIf}
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH == "${ZC_PREVIEW_INSTALLED_DLL}"
    Return
  ${EndIf}
  IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 legacy_preview_dll_removed
  DetailPrint "Removing the previous Zen Canvas Preview Handler DLL after quiesce..."
  StrCpy $0 0
legacy_preview_dll_delete_loop:
  ClearErrors
  Delete "$ZC_PREVIEW_DLL_PROBE_PATH"
  IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 legacy_preview_dll_removed
  IntOp $0 $0 + 1
  IntCmp $0 ${ZC_PREVIEW_QUIESCE_ATTEMPTS} legacy_preview_dll_delete_timeout 0 0
  Sleep ${ZC_PREVIEW_QUIESCE_DELAY_MS}
  Goto legacy_preview_dll_delete_loop

legacy_preview_dll_delete_timeout:
  Call RollbackZenCanvasPreviewQuiesce
  MessageBox MB_ICONSTOP|MB_OK "The previous Zen Canvas Preview Handler DLL could not be removed after the bounded release window. Installation was not changed."
  Abort

legacy_preview_dll_removed:
  DetailPrint "The previous Zen Canvas Preview Handler DLL was removed after quiesce."
FunctionEnd

Function InstallZenCanvasPreviewHandler
  SetRegView 64
  StrCpy $ZC_PREVIEW_TXN_COUNT 0

  ; The resource has already been unpacked by Tauri's generated NSIS section;
  ; verify it before any InprocServer32 value is written.
  IfFileExists "${ZC_PREVIEW_INSTALLED_DLL}" 0 preview_dll_missing
  Goto preview_dll_ready

preview_dll_missing:
  MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler DLL is missing from this package. Installation was not changed."
  Abort

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
    MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Preview Handler DLL is still in use after the bounded release window. Close the preview normally and run uninstall again; the prior registration and DLL were preserved."
    Abort
  ${EndIf}
FunctionEnd

Function un.RemoveZenCanvasPreviewHandler
  ; Registry withdrawal and the bounded DLL release probe both complete before
  ; this hook removes the resource directory. The Global Index service cleanup
  ; has already completed in NSIS_HOOK_PREUNINSTALL.
  RMDir "$INSTDIR\native"
FunctionEnd

Function un.FinalizeZenCanvasPreviewUninstall
  ; Generated NSIS deletes the packaged DLL after NSIS_HOOK_PREUNINSTALL. Do
  ; not commit registration withdrawal until that real deletion has completed;
  ; a failed delete keeps the old registration recoverable.
  ${If} $ZC_PREVIEW_DLL_PROBE_PATH != ""
    IfFileExists "$ZC_PREVIEW_DLL_PROBE_PATH" 0 un_preview_artifact_removed
    Call un.RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "The registered Zen Canvas Preview Handler DLL could not be removed. The prior registration was restored."
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
          MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Preview Handler stale association cleanup failed. The operation was aborted."
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
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Global Index service did not stop in time.$\r$\n$\r$\n$1"
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
    MessageBox MB_ICONSTOP|MB_OK "Could not remove the previous Zen Canvas Global Index service.$\r$\n$\r$\n$1"
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
  MessageBox MB_ICONSTOP|MB_OK "The previous Zen Canvas Global Index service is still pending deletion. Restart Windows and run the installer again."
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
  Call un.RollbackZenCanvasPreviewQuiesce
  MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Global Index service did not stop in time.$\r$\n$\r$\n$1"
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
    Call un.RollbackZenCanvasPreviewQuiesce
    MessageBox MB_ICONSTOP|MB_OK "Could not remove the Zen Canvas Global Index service.$\r$\n$\r$\n$1"
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
  Call un.RollbackZenCanvasPreviewQuiesce
  MessageBox MB_ICONSTOP|MB_OK "The Zen Canvas Global Index service is still pending deletion. Restart Windows to finish cleanup."
  Abort
FunctionEnd

Function InstallZenCanvasIndexService
  DetailPrint "Installing Zen Canvas Global Index service..."
  nsExec::ExecToStack '"$SYSDIR\sc.exe" create "ZenCanvasGlobalIndex" binPath= "\"$INSTDIR\Zen Canvas.exe\" --index-service" start= auto obj= LocalSystem DisplayName= "Zen Canvas Global Index"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "Could not install the Zen Canvas Global Index service.$\r$\n$\r$\n$1"
    Abort
  ${EndIf}

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
    Call StopZenCanvasIndexService
    Call DeleteZenCanvasIndexService
    MessageBox MB_ICONSTOP|MB_OK "Zen Canvas Global Index service could not be started. Installation has been rolled back.$\r$\n$\r$\n$1"
    Abort
  ${EndIf}
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  Call QuiesceZenCanvasPreviewBeforeInstall
  Call StopZenCanvasIndexService
  Call DeleteZenCanvasIndexService
  Call RemoveZenCanvasLegacyPreviewDll
  Call CommitZenCanvasPreviewQuiesce
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Call InstallZenCanvasIndexService
  Call InstallZenCanvasPreviewHandler
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Call un.QuiesceZenCanvasPreviewBeforeUninstall
  Call un.StopZenCanvasIndexService
  Call un.DeleteZenCanvasIndexService
  Call un.RemoveZenCanvasPreviewHandler
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Call un.FinalizeZenCanvasPreviewUninstall
!macroend
