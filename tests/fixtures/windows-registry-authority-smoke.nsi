Unicode true
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow

!ifndef ZC_SMOKE_OUTFILE
!define ZC_SMOKE_OUTFILE "windows-registry-authority-smoke.exe"
!endif

OutFile "${ZC_SMOKE_OUTFILE}"
Name "Zen Canvas Registry Authority Smoke"

!include "${ZC_REGISTRY_AUTHORITY_FILE}"

Var ZC_SMOKE_KEY
Var ZC_SMOKE_FAILED
Var ZC_SMOKE_LOG
Var ZC_SMOKE_EXPECTED_IMAGE

!macro ZC_SMOKE_REQUIRE CASE ACTUAL EXPECTED
  ${If} ${ACTUAL} != ${EXPECTED}
    StrCpy $ZC_SMOKE_FAILED 1
    FileWrite $ZC_SMOKE_LOG "${CASE}: expected ${EXPECTED}, got ${ACTUAL}$\r$\n"
  ${EndIf}
!macroend

Section
  SetErrorLevel 1
  StrCpy $ZC_SMOKE_FAILED 0
  FileOpen $ZC_SMOKE_LOG "$EXEDIR\registry-authority-smoke.log" w
  System::Call 'kernel32::GetCurrentProcessId() i.r0'
  StrCpy $ZC_SMOKE_KEY "Software\ZenCanvasTests\RegistryAuthoritySmoke-$0"

  ; 1. Missing exact key is positively absent.
  !insertmacro ZC_REG_QUERY_KEY_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY"
  FileWrite $ZC_SMOKE_LOG "missing-key-open-result=$ZC_REG_RESULT$\r$\n"
  !insertmacro ZC_SMOKE_REQUIRE "missing-key" $ZC_REG_KEY_STATE ${ZC_REG_KEY_ABSENT}

  ; 2. An existing empty key is positively present.
  WriteRegStr HKCU "$ZC_SMOKE_KEY" "seed" "seed"
  DeleteRegValue HKCU "$ZC_SMOKE_KEY" "seed"
  !insertmacro ZC_REG_QUERY_KEY_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY"
  FileWrite $ZC_SMOKE_LOG "existing-key-open-result=$ZC_REG_RESULT close=$ZC_REG_CLOSE_RESULT$\r$\n"
  !insertmacro ZC_SMOKE_REQUIRE "existing-empty-key" $ZC_REG_KEY_STATE ${ZC_REG_KEY_PRESENT}

  ; 3. Missing value is absent.
  !insertmacro ZC_REG_QUERY_STRING_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "slot" "zen" ${ZC_REG_STRING_SZ_ONLY}
  !insertmacro ZC_SMOKE_REQUIRE "missing-value" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_ABSENT}

  ; 4. Exact REG_SZ is exact.
  WriteRegStr HKCU "$ZC_SMOKE_KEY" "slot" "zen"
  !insertmacro ZC_REG_QUERY_STRING_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "slot" "zen" ${ZC_REG_STRING_SZ_ONLY}
  !insertmacro ZC_SMOKE_REQUIRE "exact-reg-sz" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_EXACT}

  ; 5. Different REG_SZ is foreign.
  WriteRegStr HKCU "$ZC_SMOKE_KEY" "slot" "foreign"
  !insertmacro ZC_REG_QUERY_STRING_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "slot" "zen" ${ZC_REG_STRING_SZ_ONLY}
  !insertmacro ZC_SMOKE_REQUIRE "foreign-reg-sz" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_FOREIGN}

  ; 6. Wrong-type REG_DWORD is foreign and never absent.
  WriteRegDWORD HKCU "$ZC_SMOKE_KEY" "slot" 7
  !insertmacro ZC_REG_QUERY_STRING_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "slot" "zen" ${ZC_REG_STRING_SZ_ONLY}
  !insertmacro ZC_SMOKE_REQUIRE "wrong-type-dword" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_FOREIGN}
  !insertmacro ZC_REG_QUERY_DWORD_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "slot" 7
  !insertmacro ZC_SMOKE_REQUIRE "exact-dword" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_EXACT}
  !insertmacro ZC_REG_QUERY_DWORD_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "slot" 8
  !insertmacro ZC_SMOKE_REQUIRE "foreign-dword" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_FOREIGN}

  ; SCM ownership requires the raw REG_EXPAND_SZ type, not expanded equality.
  StrCpy $ZC_SMOKE_EXPECTED_IMAGE "$\"C:\Zen Canvas.exe$\" --index-service"
  WriteRegExpandStr HKCU "$ZC_SMOKE_KEY" "image" "$ZC_SMOKE_EXPECTED_IMAGE"
  !insertmacro ZC_REG_QUERY_STRING_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" "image" "$ZC_SMOKE_EXPECTED_IMAGE" ${ZC_REG_STRING_EXPAND_SZ_ONLY}
  !insertmacro ZC_SMOKE_REQUIRE "exact-expand-sz" $ZC_REG_VALUE_STATE ${ZC_REG_VALUE_EXACT}

  ; 7. RegEnumKeyExW distinguishes item from finite end.
  WriteRegStr HKCU "$ZC_SMOKE_KEY\child" "seed" "seed"
  !insertmacro ZC_REG_ENUM_KEY_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" 0
  !insertmacro ZC_SMOKE_REQUIRE "enum-key-item" $ZC_REG_ENUM_STATE ${ZC_REG_ENUM_ITEM}
  !insertmacro ZC_REG_ENUM_KEY_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" 1
  !insertmacro ZC_SMOKE_REQUIRE "enum-key-end" $ZC_REG_ENUM_STATE ${ZC_REG_ENUM_END}

  ; 8. RegEnumValueW distinguishes item from finite end.
  !insertmacro ZC_REG_ENUM_VALUE_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" 0
  !insertmacro ZC_SMOKE_REQUIRE "enum-value-item" $ZC_REG_ENUM_STATE ${ZC_REG_ENUM_ITEM}
  !insertmacro ZC_REG_ENUM_VALUE_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY" 2
  !insertmacro ZC_SMOKE_REQUIRE "enum-value-end" $ZC_REG_ENUM_STATE ${ZC_REG_ENUM_END}

  ; 9. A forced invalid-handle API error is UNKNOWN and not END.
  !insertmacro ZC_REG_ENUM_VALUE_INVALID_HANDLE_STATE
  !insertmacro ZC_SMOKE_REQUIRE "invalid-handle-unknown" $ZC_REG_ENUM_STATE ${ZC_REG_ENUM_UNKNOWN}

  ; 10. The disposable HKCU fixture is removed and absence is re-proven.
  DeleteRegKey HKCU "$ZC_SMOKE_KEY"
  !insertmacro ZC_REG_QUERY_KEY_STATE ${ZC_REG_ROOT_HKCU} "$ZC_SMOKE_KEY"
  !insertmacro ZC_SMOKE_REQUIRE "fixture-cleanup" $ZC_REG_KEY_STATE ${ZC_REG_KEY_ABSENT}

  FileClose $ZC_SMOKE_LOG

  ${If} $ZC_SMOKE_FAILED == 0
    SetErrorLevel 0
  ${EndIf}
SectionEnd
