; W4-04 package-only wrapper around the existing installer ownership helpers.
; The custom Tauri 2.11.2 template calls the lifecycle functions directly and
; deliberately does not insert the legacy PREINSTALL/PREUNINSTALL macros.
;
; Define MUI cancel owners before installer-hooks.nsh is included. The legacy
; file uses !ifndef for UNABORT, so this wrapper keeps cancellation authority in
; the explicit reversible/irreversible lifecycle below.
!ifndef MUI_CUSTOMFUNCTION_ABORT
!define MUI_CUSTOMFUNCTION_ABORT ZCLifecycleUserAbort
!endif
!ifndef MUI_CUSTOMFUNCTION_UNABORT
!define MUI_CUSTOMFUNCTION_UNABORT un.ZCLifecycleUserAbort
!endif

!include "${__FILEDIR__}\installer-hooks.nsh"
!include "${__FILEDIR__}\installer-lifecycle-functions.nsh"
