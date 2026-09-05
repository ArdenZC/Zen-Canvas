# W6-05 Findings

Severity totals: `P0=0`, `P1=0`, `P2=5`, `P3=0`.

Severity is separate from the `PASS` / `FAIL` / `DEGRADED` / `UNVERIFIED` capability matrix. All five consolidated findings are `P2`: material product/capability defects, but none demonstrated data loss, unsafe mutation, security-boundary failure, or a whole-product condition requiring emergency P0/P1 remediation.

## W6-05-F-001 — Cleanup path validation

Status: `FAIL`
Severity: `P2`

With the disposable F: fixture selected in the real Cleanup flow, the product returned:

`Cleanup scope contains unsupported path characters: //?/F:/Coding/Zen-Canvas-w6-05-production/.tmp-tests/w6-05-native-audit-fixture-20260905`

The failure occurred before candidate review. No deletion, Safe Trash move, journal entry or restore operation was attempted.

## W6-05-F-002 — Preview coverage

Status: `FAIL`
Severity: `P2`

Image, CSV, JSON and folder Quick Preview requests reached the real preview surface but returned the generic unavailable state. Markdown, TypeScript and plain text rendered content. The PDF returned a truthful metadata fallback rather than fabricated content.

## W6-05-F-003 — Global Index

Status: `FAIL`
Severity: `P2`

Global Search reported `Index status: Unavailable`, zero index sources and an instruction to configure a source. The File Library's completed fixture scan is a separate managed-file authority and does not substitute for Global Index.

## W6-05-F-004 — Organization Plan

Status: `DEGRADED`
Severity: `P2`

A disposable one-file plan was created, but the product could not load suggestions or the safe preview. Dry Run and safe execution therefore remain `UNVERIFIED`; no mutation boundary was bypassed.

## W6-05-F-005 — Browse and scan recovery

Status: `DEGRADED`
Severity: `P2`

Browse showed the selected fixture as `已纳入文件库, 状态未知`, and the initial launch exposed a transient active-run error. Restarting only the exact task-owned production process recovered the completed 21-item index. This is recorded as a user-visible recovery friction, not as evidence that the managed-file authority was bypassed.
