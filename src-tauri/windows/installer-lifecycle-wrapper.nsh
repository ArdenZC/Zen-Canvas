; W4-04 package-only wrapper around the existing installer ownership helpers.
; The custom Tauri 2.11.2 template calls the synchronous lifecycle functions
; directly and deliberately does not insert the legacy PREINSTALL/PREUNINSTALL
; macros as execution owners.
;
; Define MUI cancel owners before installer-hooks.nsh is included. The legacy
; file uses !ifndef for these seams, so cancellation remains controlled by the
; explicit reversible/irreversible lifecycle below.
!ifndef MUI_CUSTOMFUNCTION_ABORT
!define MUI_CUSTOMFUNCTION_ABORT ZCLifecycleUserAbort
!endif
!ifndef MUI_CUSTOMFUNCTION_UNABORT
!define MUI_CUSTOMFUNCTION_UNABORT un.ZCLifecycleUserAbort
!endif

!include "${__FILEDIR__}\installer-hooks.nsh"
!include "${__FILEDIR__}\installer-lifecycle-synchronous.nsh"
