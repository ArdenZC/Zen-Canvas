# Pre-PM Cleanup AI Data-Sharing Consent Gate — Activation

Status: **ACTIVE — implementation — OWNER REVIEW PASSED — READY TO MERGE; bounded implementation complete; Production HEAD `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`; exact-head CI `36332783985` SUCCESS**

Issue: #284

Branch: `hardening/cleanup-ai-consent`

Baseline: `master@2aaeb7599a6f4e8520c92dd8b3726138b0395d9a`

## 1. Production truth

Read before changes:

- `src-tauri/src/ai/settings.rs`
- `src-tauri/src/ai/readiness.rs`
- `src-tauri/src/ai/cleanup.rs`
- `src-tauri/src/ai/cleanup/publication.rs`
- existing AI Settings frontend model/view/tests
- PM-01 owner deep-audit amendment from superseded #274

Current Cleanup input always includes candidate name and deterministic metadata; parent/full path follow AI privacy settings.

## 2. Settings authority

Add explicit Cleanup local/cloud sharing policy to existing AI settings.

Preferred:

```rust
cleanup_local_ai_allowed: bool
cleanup_cloud_ai_allowed: bool
```

Requirements:

- backward-compatible deserialize;
- missing values -> false;
- default false;
- settings save/load/credential rollback behavior preserved;
- settings fingerprint/currentness changes when either permission changes.

No database schema migration.

## 3. Backend readiness

Extend `crate::ai::readiness` with Cleanup readiness using the same production provider readiness foundation.

Minimum projection:

- state/reason;
- provider readiness/mode;
- cleanup feature enabled state;
- matching consent;
- binding fingerprint;
- disclosure facts.

Required gates:

- provider disabled/config invalid/missing credential precede consent;
- `cleanup_ai_enabled=false` blocks;
- local provider requires Cleanup local permission;
- cloud provider requires Cleanup cloud permission.

Do not reuse Managed or Content permissions.

## 4. Backend enforcement

Before Cleanup provider call:

- compute/revalidate Cleanup readiness from backend state;
- fail closed if not ready;
- do not construct/send provider request when permission is absent.

If an internal provider test helper bypasses configured-provider readiness, keep it test-only and explicit.

Existing stale-publication/CAS/exact-coverage/current-assessment logic must remain unchanged.

## 5. Disclosure

Projection/settings copy must state:

- candidate name/metadata is sent;
- parent name follows `send_parent_path`;
- full path follows `send_full_path`;
- file content is not sent.

Changing parent/full-path settings must invalidate Cleanup readiness binding.

## 6. Frontend/settings

Add explicit Cleanup local/cloud permission controls to the existing AI Settings section.

Do not make frontend controls authority.

Do not implement PM-01 Cleanup gating yet.

## 7. Tests

Backend at minimum:

- local + local permission false -> blocked before provider;
- local + local permission true -> ready;
- cloud + valid credential + cloud permission false -> blocked;
- cloud + cloud permission true -> ready;
- global AI disabled/config invalid/missing credential precedes consent;
- `cleanup_ai_enabled=false` blocks;
- legacy settings without fields -> false/blocked;
- consent toggle changes binding fingerprint;
- disclosure toggle changes binding fingerprint;
- Managed cloud permission does not satisfy Cleanup cloud permission;
- Content cloud permission does not satisfy Cleanup cloud permission;
- configured Cleanup command performs zero provider work when blocked.

Frontend/settings:

- local/cloud permission controls render distinctly;
- disclosure copy is truthful;
- round-trip persistence/mock API updated;
- no implication that Organize/Content consent enables Cleanup.

## 8. Validation

Focused tests + fmt + Clippy + diff-check, then exact-head hosted CI.

Result document:

`docs/project/tasks/PRE-PM-CLEANUP-AI-CONSENT-GATE-RESULT.md`

Pre-owner disposition only:

`READY FOR OWNER REVIEW`

## 9. Stop condition

Do not activate PM-01, touch #270, or begin research production integration in this Track.


## 10. Implementation closeout

Accepted Production HEAD candidate: `1ec24f49bf2e2c777bcc8206e9a286d9b396685a`.

Exact-head CI `36332783985`: **SUCCESS** across frontend tests/build/browser gates, Windows/macOS Rust fmt/tests/Clippy, native hardening/lifecycle gates and Windows/macOS release compile.

No production changes are authorized after this point unless owner review finds a concrete blocker. Owner review comment `5857816333`: **PASSED**. Current disposition: **READY TO MERGE**.
