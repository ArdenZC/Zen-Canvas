# W1-06 — Preview Contract Core — Codex Implementation Brief

Status: active implementation task

Baseline: `master@3f30f12fea23961e03b4021d0ffa63c80377167b` (W1-01 / F1 merge)

Branch: `feat/w1-06-preview-contract-core`

## Goal

Implement the Preview lifecycle/core interfaces beneath future Quick Preview UI and rich providers. This Track proves shell/session-first lifecycle, source resolution boundaries, provider selection/fallback, capabilities, cancellation and deterministic cleanup using fake/test providers. It does not ship production Quick Preview UI or rich content providers.

## Required behavior

- Reuse W1-01 `PreviewSourceRef`, `PreviewHostKind`, `ContentReadLeaseRef`, `ContentReadEligibility` and related shared contracts.
- Implement `PreviewSession` lifecycle with explicit states aligned to W0: idle/resolving/preparing/loading/ready/failed/cancelled/disposed (exact internal naming may vary if wire semantics remain clear).
- Session/Host shell exists before slow source/provider/materialization work. Closing/switching source revokes old publication rights immediately.
- Define SourceResolver interface that produces a backend-owned source snapshot with source version and bounded metadata. No renderer-authorized raw path.
- Define Provider registry/interface: stable id, priority, cheap probe, bounded prepare/load, capabilities, cancellation and cleanup.
- Implement provider selection and explicit fallback matrix: provider-local unsupported/failed/timeout/corrupt may fall through; source/session-terminal materialization-required/permission/identity-changed/unavailable/cancelled must not be bypassed by another byte-reading provider.
- Metadata fallback always exists conceptually/testably even when content provider fails.
- Define Preview representation envelope/families and completeness/warnings without coupling Core to React components. Native representation, if modeled, is explicitly host-bound/opaque.
- Define Host/Provider/Source capability intersection into effective capabilities.
- Define bounded resolved-content-access / content-read-lease consumer interface. A lease ref is not durable read authority; actual byte access remains behind existing authoritative read/open revalidation and W1-07 will wire the real gate.
- Fake/test providers must exercise priority, timeout/failure, cancellation, cleanup and stale-publication behavior.

## Required tests

At minimum:

- shell/session created before provider result;
- higher-priority compatible provider selected over generic provider;
- unsupported/provider-failed/timeout/corrupt fallback behavior;
- materialization/permission/identity/cancel terminal conditions do not fall through to a byte-reading provider;
- stale result from source A cannot publish after switching to B;
- dispose/cancel deterministically calls provider cleanup and removes publication rights;
- capability intersection is correct;
- metadata fallback survives provider failure;
- fake content-read lease path remains opaque and no raw path crosses the public provider boundary.

## Hard boundaries

No Markdown/JSON/CSV/ZIP/Folder/Image production providers; no React/Tauri Quick Preview UI; no Finder/Explorer integration; no real materialization/download implementation; no second read-eligibility engine; no filesystem mutation; no Query V3.

Avoid broad changes to `lib.rs`, Tauri command registration or frontend API registry; W1-10 owns integration.

## Definition of Done

- Preview lifecycle/interfaces are runtime-testable with fakes and deterministic cleanup/cancellation.
- Provider fallback/terminal-source policy is encoded, not left to UI convention.
- No raw path authority leaks to renderer/provider-facing contracts.
- No W3 rich provider or W4 native-host scope is pulled forward.
- Rust/TS tests as applicable, fmt/clippy/typecheck/build/governance and `git diff --check` pass; report skipped platform checks honestly.
- Leave PR Draft for independent architecture/code review.