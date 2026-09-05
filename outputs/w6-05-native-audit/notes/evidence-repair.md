# W6-05 Evidence Contract Repair

This repair is post-audit evidence maintenance only. The Whole-Product Native Audit was not rerun and the 63-shot product workflow was not repeated.

## Screenshot format repair

- Pre-repair inventory: 63 files with `.png` extensions.
- Magic verification: all 63 began with JPEG/JFIF magic `FF D8 FF`.
- The pre-repair File Library intermediate capture was verified as 13x13 and 631 bytes, then removed as invalid evidence.
- The remaining 62 files were renamed with `git mv` from `.png` to `.jpg`; bytes were not re-encoded.
- No valid PNG screenshot was present.

## Matrix repair

- Matrix rows changed from 54 to 80 to express taskbook-required states explicitly.
- Rows without direct retained native evidence are `UNVERIFIED`; no source/test inference was promoted to native PASS.
- Final totals are computed from the JSON manifest: PASS 45, FAIL 6, DEGRADED 7, UNVERIFIED 22.
- Finding severity is a separate field: P0 0, P1 0, P2 5, P3 0.

## Archive repair

The pre-review archive SHA-256 was `ADA10467710564EAFCC734F6C66502D7EEDD8715A47D56BBD46E4C5D0326280B` and is superseded. The final archive was rebuilt from the final `screenshots`, `manifests` and `notes` directories after the repair; its SHA-256 is recorded in the result document.
