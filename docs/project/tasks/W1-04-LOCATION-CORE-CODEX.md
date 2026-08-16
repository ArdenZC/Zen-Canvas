# W1-04 — Location Core — Codex Implementation Brief

Status: active implementation task

Baseline: `master@3f30f12fea23961e03b4021d0ffa63c80377167b` (W1-01 / F1 merge)

Branch: `feat/w1-04-location-core`

## Goal

Implement the common Location domain/projection layer for managed scan roots and ephemeral Browse locations. This Track owns availability, freshness and coarse runtime capability projection only. It must not turn per-entry materialization/readability into a Location-wide fact.

## Required behavior

- Reuse W1-01 `LocationRef`, `LocationKind`, `LocationAvailability`, `LocationFreshness`, `LocationCapabilities`.
- Define a `LocationDescriptor`/equivalent runtime projection with ref, display name, kind, availability, freshness and capabilities.
- Managed Location identity reuses existing `scanRootId`; project from existing scan-root authority rather than creating a `locations` table or duplicate durable model.
- Derive managed freshness from existing scan/reconciliation/watcher facts (e.g. generation/reconciliation/revision/health) without changing watcher authority.
- Ephemeral locations remain session-scoped and non-durable; their freshness is normally `not_applicable` because they do not own a durable index.
- Availability and freshness remain orthogonal (e.g. `available + reconciling` is valid).
- `LocationCapabilities` are coarse runtime/platform capabilities only. Do not place `MaterializationState` or `ContentReadEligibility` on LocationDescriptor.
- Unknown/offline/provider/network cases fail closed; UI/platform labels alone do not imply capability.
- Keep common core platform-neutral. If platform-specific probing is necessary, isolate it behind adapter interfaces. Do not overwrite PR #63 macOS provider/materialization/capability semantics.

## Scope sequencing

This PR should establish the common Location core and only minimal adapters needed to prove the interface. Deeper macOS/Windows platform adapters may be split into bounded follow-up subtracks after common core review if that keeps the PR smaller.

## Required tests

At minimum:

- managed scan-root projection retains `scanRootId` and maps representative health/reconciliation facts to freshness;
- availability and freshness combinations remain independent;
- ephemeral Location is session-scoped and never serialized/persisted as a managed authority;
- coarse capabilities fail closed for unknown/unavailable cases;
- no Location-level materialization/read eligibility field is introduced;
- external/network/provider disappearance produces unavailable/disconnected state rather than mass deletion semantics;
- platform adapter fixtures, if added, prove capability comes from runtime evidence rather than `isMac/isWindows` labels.

## Protected authorities / non-goals

Do not add DB schema/migrations, rewrite scan/watcher/reconciliation, implement W1-07 byte-read/materialization gate, perform hydration/download, implement filesystem mutation, Query V3, polished UI, or broad Tauri integration.

Treat `src-tauri/src/platform/macos/*`, managed watcher, `src-tauri/src/lib.rs`, and shared domain registries as hotspots; minimize changes and explain any unavoidable touch.

## Definition of Done

- Common Location projection is explicit, tested and authority-preserving.
- Managed truth still comes from ScanRoot/watcher/reconciliation authorities.
- Per-entry materialization/read state is not lifted to Location.
- No new durable authority.
- Rust fmt/tests/clippy and relevant frontend/type checks if any pass; report skipped platform checks honestly.
- Leave PR Draft for independent review.