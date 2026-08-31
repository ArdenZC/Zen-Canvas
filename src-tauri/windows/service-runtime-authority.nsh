; Numeric Win32 SCM runtime-state authority shared by the production NSIS
; lifecycle and the executable service-runtime semantic smoke. Product
; ownership and lifecycle decisions intentionally remain outside this file.

!ifndef ZC_SERVICE_RUNTIME_AUTHORITY_NSH
!define ZC_SERVICE_RUNTIME_AUTHORITY_NSH

!include "LogicLib.nsh"

!define ZC_SERVICE_RUNTIME_UNKNOWN 0
!define ZC_SERVICE_RUNTIME_RUNNING 1
!define ZC_SERVICE_RUNTIME_STOPPED 2
!define ZC_SERVICE_RUNTIME_PENDING 3
!define ZC_SERVICE_RUNTIME_ABSENT 4

!define ZC_SERVICE_RUNTIME_SC_MANAGER_CONNECT 0x0001
!define ZC_SERVICE_RUNTIME_SERVICE_QUERY_STATUS 0x0004
!define ZC_SERVICE_RUNTIME_SC_STATUS_PROCESS_INFO 0
!define ZC_SERVICE_RUNTIME_ERROR_SERVICE_DOES_NOT_EXIST 1060
!define ZC_SERVICE_RUNTIME_STATUS_PROCESS_SIZE 36

Var ZC_SERVICE_RUNTIME_NAME
Var ZC_SERVICE_RUNTIME_STATE
Var ZC_SERVICE_RUNTIME_ERROR
Var ZC_SERVICE_RUNTIME_CURRENT_STATE
Var ZC_SERVICE_RUNTIME_BYTES_NEEDED
Var ZC_SERVICE_RUNTIME_QUERY_RESULT
Var ZC_SERVICE_RUNTIME_SCM_HANDLE
Var ZC_SERVICE_RUNTIME_SERVICE_HANDLE
Var ZC_SERVICE_RUNTIME_STATUS_BUFFER
Var ZC_SERVICE_RUNTIME_CLOSE_RESULT
Var ZC_SERVICE_RUNTIME_CLEANUP_FAILED

; SERVICE_NAME may be a literal or an NSIS variable expression. The caller
; reads ZC_SERVICE_RUNTIME_STATE after this macro returns.
!macro ZC_QUERY_SERVICE_RUNTIME_STATE SERVICE_NAME
  StrCpy $ZC_SERVICE_RUNTIME_NAME "${SERVICE_NAME}"
  Call ZCReadServiceRuntimeState
!macroend

!macro ZC_QUERY_SERVICE_RUNTIME_STATE_UN SERVICE_NAME
  StrCpy $ZC_SERVICE_RUNTIME_NAME "${SERVICE_NAME}"
  Call un.ZCReadServiceRuntimeState
!macroend

; Map the numeric SERVICE_STATUS_PROCESS.dwCurrentState value. This narrow
; seam is also used by the executable smoke to exercise every mapping without
; making a hosted test depend on a particular system service being running.
!macro ZC_MAP_SERVICE_RUNTIME_STATE_BODY
  StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_UNKNOWN}
  ${If} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 1
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_STOPPED}
  ${ElseIf} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 2
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_PENDING}
  ${ElseIf} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 3
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_PENDING}
  ${ElseIf} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 4
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_RUNNING}
  ${ElseIf} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 5
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_PENDING}
  ${ElseIf} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 6
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_PENDING}
  ${ElseIf} $ZC_SERVICE_RUNTIME_CURRENT_STATE == 7
    ; SERVICE_PAUSED is deliberately not a stable product state.
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_UNKNOWN}
  ${EndIf}
!macroend

Function ZCMapServiceRuntimeState
  !insertmacro ZC_MAP_SERVICE_RUNTIME_STATE_BODY
FunctionEnd

Function un.ZCMapServiceRuntimeState
  !insertmacro ZC_MAP_SERVICE_RUNTIME_STATE_BODY
FunctionEnd

; Query one service through the local SCM using read-only rights. The input
; service name is ZC_SERVICE_RUNTIME_NAME and the numeric result is
; ZC_SERVICE_RUNTIME_STATE. Every opened handle is closed before returning.
!macro ZC_SERVICE_RUNTIME_READER_BODY MAP_FUNCTION DONE_LABEL
  ; This helper is called from NSIS lifecycle code that uses the general
  ; registers for loop counters and return values. Preserve every register
  ; touched by the Win32 calls and struct unpacking.
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9

  StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_UNKNOWN}
  StrCpy $ZC_SERVICE_RUNTIME_ERROR 0
  StrCpy $ZC_SERVICE_RUNTIME_CURRENT_STATE 0
  StrCpy $ZC_SERVICE_RUNTIME_BYTES_NEEDED 0
  StrCpy $ZC_SERVICE_RUNTIME_QUERY_RESULT 0
  StrCpy $ZC_SERVICE_RUNTIME_SCM_HANDLE 0
  StrCpy $ZC_SERVICE_RUNTIME_SERVICE_HANDLE 0
  StrCpy $ZC_SERVICE_RUNTIME_STATUS_BUFFER 0
  StrCpy $ZC_SERVICE_RUNTIME_CLOSE_RESULT 0
  StrCpy $ZC_SERVICE_RUNTIME_CLEANUP_FAILED 0

  ; System::Call's ?e option invokes kernel32::GetLastError immediately
  ; after the Win32 procedure and pushes that numeric error for Pop.
  System::Call 'advapi32::OpenSCManagerW(p 0, p 0, i ${ZC_SERVICE_RUNTIME_SC_MANAGER_CONNECT}) p.r1 ?e'
  Pop $2
  StrCpy $ZC_SERVICE_RUNTIME_SCM_HANDLE $1
  ${If} $1 == 0
    StrCpy $ZC_SERVICE_RUNTIME_ERROR $2
    Goto ${DONE_LABEL}
  ${EndIf}

  ; Runtime register forms avoid passing the variable token as a literal
  ; wide-string argument through the System plug-in parser.
  StrCpy $0 $ZC_SERVICE_RUNTIME_NAME
  ; Capture GetLastError before any handle cleanup or other API call.
  System::Call 'advapi32::OpenServiceW(p r1, w r0, i ${ZC_SERVICE_RUNTIME_SERVICE_QUERY_STATUS}) p.r2 ?e'
  Pop $3
  StrCpy $ZC_SERVICE_RUNTIME_SERVICE_HANDLE $2
  ${If} $2 == 0
    StrCpy $ZC_SERVICE_RUNTIME_ERROR $3
    ${If} $ZC_SERVICE_RUNTIME_ERROR == ${ZC_SERVICE_RUNTIME_ERROR_SERVICE_DOES_NOT_EXIST}
      StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_ABSENT}
    ${EndIf}
    System::Call 'advapi32::CloseServiceHandle(p $ZC_SERVICE_RUNTIME_SCM_HANDLE) i.r4'
    StrCpy $ZC_SERVICE_RUNTIME_CLOSE_RESULT $4
    ${If} $4 == 0
      StrCpy $ZC_SERVICE_RUNTIME_CLEANUP_FAILED 1
      StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_UNKNOWN}
    ${EndIf}
    Goto ${DONE_LABEL}
  ${EndIf}

  ; SERVICE_STATUS_PROCESS is nine DWORDs, including dwCurrentState at
  ; offset 4. System::Alloc keeps the buffer local to this synchronous call.
  System::Alloc ${ZC_SERVICE_RUNTIME_STATUS_PROCESS_SIZE}
  Pop $3
  StrCpy $ZC_SERVICE_RUNTIME_STATUS_BUFFER $3
  ${If} $3 != 0
    StrCpy $4 0
    ; Capture GetLastError before buffer or handle cleanup.
    System::Call 'advapi32::QueryServiceStatusEx(p $ZC_SERVICE_RUNTIME_SERVICE_HANDLE, i ${ZC_SERVICE_RUNTIME_SC_STATUS_PROCESS_INFO}, p $ZC_SERVICE_RUNTIME_STATUS_BUFFER, i ${ZC_SERVICE_RUNTIME_STATUS_PROCESS_SIZE}, *i .r4) i.r5 ?e'
    Pop $6
    StrCpy $ZC_SERVICE_RUNTIME_QUERY_RESULT $5
    ${If} $5 == 0
      StrCpy $ZC_SERVICE_RUNTIME_ERROR $6
    ${Else}
      StrCpy $ZC_SERVICE_RUNTIME_BYTES_NEEDED $4
      ${If} $4 >= ${ZC_SERVICE_RUNTIME_STATUS_PROCESS_SIZE}
        System::Call '*$ZC_SERVICE_RUNTIME_STATUS_BUFFER(i .r4, i .r5, i .r6, i .r7, i .r8, i .r9, i .0, i .1, i .2)'
        StrCpy $ZC_SERVICE_RUNTIME_CURRENT_STATE $5
        Call ${MAP_FUNCTION}
      ${EndIf}
    ${EndIf}
    System::Free $ZC_SERVICE_RUNTIME_STATUS_BUFFER
    StrCpy $ZC_SERVICE_RUNTIME_STATUS_BUFFER 0
  ${EndIf}

  ; Cleanup failures invalidate a previously mapped stable result.
  System::Call 'advapi32::CloseServiceHandle(p $ZC_SERVICE_RUNTIME_SERVICE_HANDLE) i.r4'
  StrCpy $ZC_SERVICE_RUNTIME_CLOSE_RESULT $4
  ${If} $4 == 0
    StrCpy $ZC_SERVICE_RUNTIME_CLEANUP_FAILED 1
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_UNKNOWN}
  ${EndIf}
  System::Call 'advapi32::CloseServiceHandle(p $ZC_SERVICE_RUNTIME_SCM_HANDLE) i.r4'
  StrCpy $ZC_SERVICE_RUNTIME_CLOSE_RESULT $4
  ${If} $4 == 0
    StrCpy $ZC_SERVICE_RUNTIME_CLEANUP_FAILED 1
    StrCpy $ZC_SERVICE_RUNTIME_STATE ${ZC_SERVICE_RUNTIME_UNKNOWN}
  ${EndIf}

${DONE_LABEL}:
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
  Pop $9
  Pop $8
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

Function ZCReadServiceRuntimeState
  !insertmacro ZC_SERVICE_RUNTIME_READER_BODY ZCMapServiceRuntimeState zc_service_runtime_done
FunctionEnd

Function un.ZCReadServiceRuntimeState
  !insertmacro ZC_SERVICE_RUNTIME_READER_BODY un.ZCMapServiceRuntimeState un_zc_service_runtime_done
FunctionEnd

!endif
