# QuickLook for Windows — Research Notes

Official source: https://github.com/QL-Win/QuickLook

Audit snapshot: see [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md).

> **Provenance:** this note is a 2026-08-17 reconstruction of the Zen research conclusion. Current product/plugin/license facts were re-verified at the pinned snapshot; Zen's Provider Registry and fallback rules are design inferences, not claims that QuickLook uses the same internal contracts.

## Why we studied it

QuickLook for Windows is a mature example of bringing the macOS “select a file, press Space, inspect it without opening a heavy app” interaction to Windows.

The research question was:

> How should Zen structure provider selection, rapid preview navigation and extensibility without inheriting an unsafe or overly broad plugin model?

## Re-verified official-source facts

The project explicitly focuses on instant Space-key file previewing on Windows and documents extensibility through plugins for additional file types/formats.

Its repository is GPL-3.0, so Zen treats it as an architecture/behavior reference rather than a source-code donor.

Source:

- https://github.com/QL-Win/QuickLook
- https://github.com/QL-Win

## Main observations

### 1. Provider selection should be explicit and ordered

Different file types may have:

- a specific rich renderer;
- a native/system renderer;
- a generic text/image fallback;
- metadata-only fallback.

The reconstructed Zen research concluded that Zen needs a **priority-based Provider Registry**, not a long extension switch statement spread through the UI.

### 2. Provider lifecycle is different from Preview session lifecycle

A Preview session may survive while one provider fails and another provider is tried.

This directly influenced Zen's fallback matrix:

- provider-local failures may try the next provider;
- source/session terminal failures must not be bypassed by another byte-reading provider.

### 3. Rapid sibling navigation is central to the experience

The value of Space preview is not just rendering one file. Users should be able to move through adjacent files without repeatedly closing/opening heavy apps.

Zen therefore designed bounded sibling/navigation context rather than letting Preview create a second unbounded query engine.

### 4. Extensibility is useful, but v1 must stay built-in

QuickLook demonstrates the value of format plugins, but Zen deliberately rejected a third-party Preview plugin SDK for the first product version.

Reasons include:

- security and sandbox surface;
- lifecycle/cleanup consistency;
- platform-host complexity;
- content-read/materialization authority;
- versioning and support burden.

Zen can preserve a provider registry internally without exposing an arbitrary external plugin ABI.

### 5. Licensing requires clean-room discipline

The project is GPL-3.0. Zen may independently implement general concepts such as provider ordering, fallback or Space-preview UX, but must not copy incompatible implementation code into Zen.

## Adopted by Zen

- stable provider IDs;
- explicit provider priority/order;
- provider capabilities;
- bounded probe/prepare/load lifecycle;
- deterministic cleanup;
- fallback to another compatible provider when the error is provider-local;
- rapid sibling navigation as a core Quick Preview interaction.

## Adapted, not copied

Zen's provider registry is intentionally narrower:

- built-in providers first;
- shared Preview Core independent of Windows;
- all byte access passes Zen's authoritative Read Gate;
- hosts are separate from providers;
- platform/native fallback remains explicit.

## Explicitly rejected

- arbitrary third-party provider/plugin loading in v1;
- direct reuse of GPL implementation code;
- allowing a provider to open arbitrary renderer-supplied paths;
- making provider fallback bypass materialization, permission, identity-change or cancellation errors;
- loading every format into one generic web renderer just to reduce provider count.

## Downstream influence

- W0-D Provider Registry and fallback matrix;
- W1-06 Preview Contract Core;
- W1-07 read-lease boundary;
- W3 built-in provider plan;
- W4 Windows host/native adapter plan.

## Design statement preserved from the reconstructed research

> Zen should have an extensible internal provider architecture without making external plugins part of the first product contract. Provider flexibility is valuable; uncontrolled authority and lifecycle diversity are not.