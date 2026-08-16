# macOS Quick Look Extensions — QLMarkdown / SourceCodeSyntaxHighlight

Official sources:

- QLMarkdown: https://github.com/sbarex/QLMarkdown
- SourceCodeSyntaxHighlight: https://github.com/sbarex/SourceCodeSyntaxHighlight

Audit snapshots: see [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md).

> **Provenance:** this note is a 2026-08-17 reconstruction of the Zen research conclusion. Current extension/type/security behavior was re-verified against the pinned upstream sources; Zen's Core/Host split and provider rules are design conclusions rather than claims about the projects' internal architecture.

## Why we studied them

These projects were concrete examples of modern macOS Quick Look extensions that handle rich formats outside the host application. They helped answer:

> What belongs in a native macOS Quick Look extension, what belongs in Zen's own Preview provider/core, and what limitations must remain explicit?

## Re-verified official-source facts

QLMarkdown is a macOS application that provides a Quick Look extension for Markdown plus a separate graphical configuration interface. Its documentation explicitly discusses Quick Look/security limitations and notes that the app is not intended to be a standalone Markdown editor/viewer.

SourceCodeSyntaxHighlight is a separate Quick Look extension specialized for source-code rendering. Its documentation ties support to registered file types/UTIs and discusses extension/type ownership conflicts.

Both repositories are GPL-3.0 at the pinned audit snapshots.

These examples demonstrate practical macOS Quick Look extension/type-registration constraints. Zen's conclusion that native Quick Look is a **host boundary rather than Preview's entire architecture** is a Zen design inference from those constraints.

## Main observations

### 1. Native Quick Look host and Zen app host are different product surfaces

A system Quick Look extension has:

- system-controlled invocation;
- extension lifecycle;
- sandbox/entitlement constraints;
- type-registration constraints;
- limited ownership of host UI.

Zen's in-app Quick Preview can have a different shell, navigation context and capability set while still reusing Preview providers/representations where safe.

This led to the explicit rule:

```text
Preview Core != Preview Host
```

### 2. File-type ownership must be capability-driven

Quick Look extensions cannot safely assume they own every extension/UTType.

Zen therefore should not infer system-host support solely from filename extension. Native capability must be checked against the actual host/platform/source context.

### 3. Markdown and source code are not the same provider problem

QLMarkdown intentionally renders Markdown semantically, while SourceCodeSyntaxHighlight focuses on source representation.

This reinforced the decision to keep Zen's future providers specialized:

- Markdown provider for formatted Markdown;
- Text/Code provider for source/text;
- native fallback only where appropriate.

Do not collapse all text-like formats into one renderer just to reduce implementation count.

### 4. Rendering rich content has a security boundary

Markdown rendering may involve:

- local images;
- syntax highlighting;
- diagrams;
- external libraries;
- HTML output.

Zen's research conclusion was stricter than “if the upstream extension can render it, Zen should too”:

- sanitize output;
- no arbitrary remote resources by default;
- no code/macro execution;
- no implicit network access;
- source/session/materialization rules remain authoritative.

QLMarkdown itself exposes configurable behaviors including raw HTML and external JavaScript-library choices; those upstream options are useful evidence that rich rendering has a security/configuration surface, not permission for Zen to enable unsafe behavior by default.

### 5. The standalone configuration app pattern is useful evidence, not a requirement

QLMarkdown shows that extension settings can live outside the extension host itself. Zen may use app-side settings/capability configuration for future native hosts, but should not prematurely build W4 configuration UI during W1/W3.

## Adopted by Zen

- Preview Core / Host separation;
- dedicated macOS Quick Look host/extension as a later W4 adapter;
- host capability intersection rather than assuming every control works everywhere;
- UTType/type-support awareness;
- specialized Markdown vs Text/Code providers;
- strict rendering security rules.

## Adapted, not copied

Zen's providers should be reusable by Zen app hosts where possible, while the macOS extension remains a constrained system host.

A Zen-rich provider does not automatically become a Quick Look extension renderer, and a native extension does not become the authority for in-app Preview.

## Explicitly rejected

- building the macOS Quick Look extension during W1 Foundation;
- treating file extension alone as native capability proof;
- assuming the system Quick Look host can expose every Zen Preview capability;
- executing embedded Markdown/source code;
- loading arbitrary external JS/resources by default;
- merging Markdown and source-code semantics into one generic provider.

## Downstream influence

- W0-D Preview Provider/Host architecture;
- W0-D `HostCapabilities` / effective capability intersection;
- W3 Markdown and Text/Code provider separation;
- W4 macOS Quick Look extension/host integration;
- W4 native lifecycle/security QA.

## Design statement preserved from the reconstructed research

> macOS Quick Look is a constrained system host, not the architecture of Preview itself. Zen should share safe content understanding where possible, while keeping host lifecycle, UTType ownership and native capability explicit.