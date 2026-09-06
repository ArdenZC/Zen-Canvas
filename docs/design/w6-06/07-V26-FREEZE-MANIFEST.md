# V26 Freeze Manifest

This manifest binds the final W6-06 owner-approved target-design artifacts by SHA-256.

## Canonical artifacts

| Artifact | SHA-256 |
| --- | --- |
| Main V26 target | `302905D8EEA95BF08873588810983E505E732031E100992171B97C421EA81F52` |
| macOS V26 target | `85097A21597FBEA32475445A1AF4F1BD146AC0D72A1CB72633DA8D3C696D3B9C` |
| Windows V26 target | `0D789D2DFBF2508C8F0307B8925EB98DF27E2401F1EF9DD66C1713C7790FA656` |
| Desktop Quick Search V26 | `7C604C86BEE2B24F164BEBC8F4D8F8BCF3480D34F976E2362E1A99C9FFB07558` |
| Owner freeze-package ZIP | `EFDD0C57D96916FD8F3752E37307BB4A956E58D33C3DF3A5D32C21102E3590DB` |

## QA identity

Main V26 accepted QA:

- 128 / 128 primary layout scenarios PASS;
- 8 / 8 core interaction suites PASS;
- 16 / 16 extra 680px smoke scenarios PASS;
- Windows platform chrome PASS;
- macOS platform chrome PASS;
- console/page errors 0;
- duplicate DOM IDs 0;
- unnamed buttons 0;
- JavaScript syntax PASS.

Desktop Quick Search V26 accepted QA:

- 6 / 6 layout scenarios PASS;
- search/filter/arrow/Escape/global-shortcut/focus suite PASS;
- console/page errors 0.

## Repository retention note

The authoritative design semantics, owner decisions and implementation handoff are retained in this W6-06 branch and the associated design/specification documents. The exact V26 owner-review package is checksum-bound above. No browser/prototype evidence in this package constitutes native product acceptance.

## Freeze score

**93.4 / 100 — PASS against the 92 / 100 owner freeze threshold.**
