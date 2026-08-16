# W0-D — Preview Architecture

## 1. Core flow

Preview is session/host first, content second:

```text
Preview command
  -> create PreviewSession + Preview Host shell
  -> SourceResolver
  -> PreviewSourceSnapshot
  -> ContentReadEligibility / Materialization Gate
  -> acquire bounded ContentReadLease when bytes are allowed
  -> PreviewCoordinator / Provider Registry
  -> PreviewRepresentation
  -> Preview Host render/update
```

This ordering is intentional: the Preview shell/lifecycle authority exists before slow provider/materialization work begins, so cancellation, timeout and shell-first UX are always available.

Quick Preview is read-only and never authorizes filesystem mutation.

## 2. Source references

Zen app requests use `EntryRef`; React does not submit arbitrary raw paths as preview authorization.

Native system hosts may create a trusted `HostProvidedSourceRef` after native validation. This reference cannot be forged by renderer input.

## 3. PreviewSourceSnapshot

A resolver produces a backend-owned snapshot containing bounded metadata and a `sourceVersion` used for race protection. Raw filesystem handles, security-scoped URLs and shell/native objects remain backend/native details.

Publication requires current session/request/source version to remain valid.

Materialization/content state is source/entry scoped; a Location is not assumed to be wholly local or wholly remote.

## 4. PreviewSession

Suggested lifecycle:

```text
Idle -> Resolving -> Preparing -> Loading -> Ready
          |             |          |
          +-----------> Failed <----+
          |                        
          +-----------> Cancelled
                          |
                       Disposed
```

The Host shell may be visible while the session is in Resolving/Preparing/Loading.

`Disposed` is terminal.

Any close, source switch, host destruction or app shutdown removes publication rights and deterministically cleans owned resources.

## 5. ContentReadLease / resolved content access

Providers that need bytes do not receive an arbitrary raw path from React and do not independently bypass platform byte-read rules.

After source resolution and read-eligibility/materialization checks, backend/native infrastructure may issue a bounded, opaque `ContentReadLease` (or equivalent resolved-content access capability) bound to:

- the current Preview session/request;
- the resolved source/sourceVersion;
- the applicable read intent;
- current platform/provider eligibility.

The lease is not durable authorization. The actual byte-open boundary still re-resolves/revalidates identity and provider eligibility using the existing authoritative byte-read path. Source/version/session mismatch invalidates the lease.

A provider may consume the lease through backend/provider APIs; it does not obtain permission to open arbitrary filesystem paths.

## 6. Provider contract

Built-in provider registry only in v1.

A provider has:

- stable ID
- priority
- cheap `probe`
- bounded `prepare/load`
- capabilities
- deterministic cleanup
- cancellation support

`probe` must not perform unbounded file reads.

Provider priority allows specific rich providers to beat generic text/native fallbacks.

## 7. Provider errors and fallback matrix

Errors must distinguish at least:

- unsupported
- provider_failed
- source_unavailable
- materialization_required
- permission_denied
- identity_changed
- timeout
- cancelled
- corrupt_source

Fallback policy is explicit:

**Provider-local recoverable conditions** may try the next compatible provider, then Metadata fallback:

- unsupported
- provider_failed
- timeout
- corrupt_source

**Source/session terminal conditions** must not be bypassed by another byte-reading provider:

- source_unavailable
- materialization_required
- permission_denied
- identity_changed
- cancelled

Metadata-only presentation may still remain available when it does not violate the source/session condition.

## 8. Representation, not UI component

Preview Core normally produces host-neutral representation families, e.g.:

- Metadata
- Text
- SafeHTML/RichText
- StructuredTree
- Table
- Image
- Media
- FolderSummary
- ArchiveTree

Hosts render the representation in platform-appropriate UI. Zen app, macOS Quick Look and Windows Quick Preview do not need pixel-identical views.

A **Native representation is an explicit exception**: it is a host-bound opaque representation/capability tied to compatible host kinds and native lifecycle. It is not assumed to be serializable, portable between hosts or reusable like a host-neutral representation.

## 9. Hosts

Architecture host kinds:

- Zen Floating Preview
- Zen Pinned Preview
- macOS Quick Look Extension Host
- Windows Quick Preview Host
- Windows Preview Handler Host (architecture-ready; optional v1 system integration)

Native Provider and Native Host are different concepts.

## 10. Capabilities

Provider capability, Host capability and Source capability are intersected into `EffectivePreviewCapabilities`.

Examples:

- search
- zoom
- playback
- text selection
- internal navigation
- sibling navigation
- open external
- reveal
- request materialization

UI reads only effective capability; it does not infer controls from file extensions.

## 11. Navigation context

Preview sessions receive a bounded navigation window from the originating workspace. Preview must not build a second query engine or fetch one million IDs just to support Next/Previous.

When the originating Zen workspace still exists, Preview sibling navigation should advance workspace focus/selection as well.

## 12. Materialization and read eligibility

Materialization state and byte-read eligibility are separate.

A byte-dependent Preview path evaluates the existing authoritative read eligibility through the Materialization/Read Gate. A remote/provider placeholder requiring bytes yields an explicit user action such as **Download to Preview**.

After user-authorized materialization:

1. re-resolve the source;
2. obtain a new sourceVersion/current eligibility;
3. reacquire bounded content access;
4. only then load a byte-reading provider.

PR #63 rule: generic provider byte-read support is capability dependent; no routing hint, earlier eligibility result or earlier operation proof can be treated as universal provider identity/byte authority.

## 13. Fallback

Metadata fallback always exists. Unsupported/corrupt/provider-failed content may still present name, type, size, location/materialization status and safe Open/Reveal actions.

A terminal materialization/permission/identity/cancellation condition is not silently converted into a native fallback that reads or downloads bytes anyway.

Provider failure does not destroy the Preview shell or the app.

## 14. Security

Preview rules:

- read only
- local-first
- no code execution
- no macro execution
- sanitize rendered HTML/Markdown
- no arbitrary remote resources by default
- no implicit hydration
- no implicit Content Understanding/AI artifacts
- archive preview indexes content; it does not silently extract
- folder analysis is bounded/progressive
- providers do not receive renderer-authorized arbitrary raw paths

## 15. Provider v1 focus

Zen-rich providers planned for W3:

- Metadata
- Text / Code
- Markdown
- JSON / YAML / XML
- CSV / TSV
- Folder
- ZIP
- Image

PDF/Office/iWork/audio/video and other strong native formats should prefer safe native capabilities where appropriate.

## 16. Command behavior

- Space -> Toggle Quick Preview when the command context permits.
- Enter is not a Preview command.
- Space is ignored as Preview while text input, rename/edit, IME composition, menu/dialog ownership or invalid selection is active.
- Pin Preview is a command; platform mapping is separate. Windows `Alt+Space` remains reserved for the OS.
