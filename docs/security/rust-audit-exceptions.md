# Rust audit exceptions

`npm run security:audit:rust` runs without advisory ignores. The former
exceptions for the following advisories were removed after the transitive
`plist` dependency was updated to a release using `quick-xml >= 0.41`:

- `RUSTSEC-2026-0194`
- `RUSTSEC-2026-0195`

Do not reintroduce ignores for these advisories. Dependency updates must keep
the patched `quick-xml` line or fail the audit gate.

`crossbeam-epoch` is locked to `0.9.20` or newer to address
`RUSTSEC-2026-0204`.
