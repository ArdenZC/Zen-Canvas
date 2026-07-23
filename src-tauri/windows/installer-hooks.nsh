; The global index service is an installed, independent metadata provider.
; Stop/remove the previous registration before replacing the executable, then
; register the new version with an installer-owned absolute binary path.
!macro NSIS_HOOK_PREINSTALL
  ExecWait '"$SYSDIR\sc.exe" stop "ZenCanvasGlobalIndex"'
  ExecWait '"$SYSDIR\sc.exe" delete "ZenCanvasGlobalIndex"'
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"$SYSDIR\sc.exe" create "ZenCanvasGlobalIndex" binPath= "\"$INSTDIR\Zen Canvas.exe\" --index-service" start= auto obj= LocalSystem DisplayName= "Zen Canvas Global Index"'
  ExecWait '"$SYSDIR\sc.exe" description "ZenCanvasGlobalIndex" "Enumerates local Windows volume metadata for Zen Canvas global search."'
  ExecWait '"$SYSDIR\sc.exe" failure "ZenCanvasGlobalIndex" reset= 86400 actions= restart/5000/restart/30000/""/0'
  ExecWait '"$SYSDIR\sc.exe" start "ZenCanvasGlobalIndex"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$SYSDIR\sc.exe" stop "ZenCanvasGlobalIndex"'
  ExecWait '"$SYSDIR\sc.exe" delete "ZenCanvasGlobalIndex"'
!macroend
