# Rust audit exceptions

`npm run security:audit:rust` ignores two advisories until Tauri's `plist`
dependency can adopt `quick-xml >= 0.41`:

- `RUSTSEC-2026-0194`
- `RUSTSEC-2026-0195`

Both findings are currently reachable only through Tauri's build-time plist
generation dependency. Zen Canvas does not parse user-controlled XML or plist
input at runtime. These exceptions must be removed as soon as the upstream
`plist` constraint moves beyond `quick-xml ^0.39.2`.

`crossbeam-epoch` is locked to `0.9.20` or newer to address
`RUSTSEC-2026-0204`.
