; The global index service is an installed, independent metadata provider.
; All service operations are performed by the per-machine installer while it
; is elevated. Failure to create or start the service aborts installation so a
; partially working global search is never reported as successfully installed.

!include "LogicLib.nsh"

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
  Call StopZenCanvasIndexService
  Call DeleteZenCanvasIndexService
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Call InstallZenCanvasIndexService
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Call un.StopZenCanvasIndexService
  Call un.DeleteZenCanvasIndexService
!macroend
