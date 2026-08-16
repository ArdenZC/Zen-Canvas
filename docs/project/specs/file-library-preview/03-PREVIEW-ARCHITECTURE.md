# W0-D — Preview Architecture

## 1. Core flow

```text
PreviewRequest
  -> SourceResolver
  -> PreviewSourceSnapshot
  -> Materialization Gate
  -> PreviewSession / Coordinator
  -> Provider Registry
  -> PreviewRepresentation
  -> Preview Host
```

Quick Preview is read-only and never authorizes filesystem mutation.

## 2. Source references

Zen app requests use `EntryRef`; React does not submit arbitrary raw paths as preview authorization.

Native system hosts may create a trusted `HostProvidedSourceRef` after native validation. This reference cannot be forged by renderer input.

## 3. PreviewSourceSnapshot

A resolver produces a backend-owned snapshot containing bounded metadata and a `sourceVersion` used for race protection. Raw filesystem handles, security-scoped URLs and shell/native objects remain backend/native details.

Publication requires current session/request/source version to remain valid.

## 4. PreviewSession

Suggested lifecycle:

```text
Idle -> Resolving -> Preparing -> Loading -> Ready
                    |          |
                    +-> Failed +-> Cancelled
                                  |
                               Disposed
```

`Disposed` is terminal.

Any close, source switch, host destruction or app shutdown removes publication rights and deterministically cleans owned resources.

## 5. Provider contract

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

## 6. Provider errors

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

Unsupported may fall through to another provider. Materialization/permission/identity/cancel conditions must not be bypassed by a fallback provider that implicitly reads/downloads bytes.

## 7. Representation, not UI component

Preview Core produces host-neutral representation families, e.g.:

- Metadata
- Text
- SafeHTML/RichText
- StructuredTree
- Table
- Image
- Media
- FolderSummary
- ArchiveTree
- Native

Hosts render the representation in platform-appropriate UI. Zen app, macOS Quick Look and Windows Quick Preview do not need pixel-identical views.

## 8. Hosts

Architecture host kinds:

- Zen Floating Preview
- Zen Pinned Preview
- macOS Quick Look Extension Host
- Windows Quick Preview Host
- Windows Preview Handler Host (architecture-ready; optional v1 system integration)

Native Provider and Native Host are different concepts.

## 9. Capabilities

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

## 10. Navigation context

Preview sessions receive a bounded navigation window from the originating workspace. Preview must not build a second query engine or fetch one million IDs just to support Next/Previous.

When the originating Zen workspace still exists, Preview sibling navigation should advance workspace focus/selection as well.

## 11. Materialization

Byte-dependent preview happens only after the Materialization Gate.

A remote/provider placeholder requiring bytes yields an explicit user action such as **Download to Preview**. After materialization, source resolution/revalidation occurs again before reading.

PR #63 rule: generic provider byte-read support is capability dependent; no routing hint or earlier operation proof can be treated as universal provider identity/byte authority.

## 12. Fallback

Metadata fallback always exists. Unsupported/corrupt content may still present name, type, size, location/materialization status and safe Open/Reveal actions.

Provider failure does not destroy the Preview shell or the app.

## 13. Security

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

## 14. Provider v1 focus

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

## 15. Command behavior

- Space -> Toggle Quick Preview when the command context permits.
- Enter is not a Preview command.
- Space is ignored as Preview while text input, rename/edit, IME composition, menu/dialog ownership or invalid selection is active.
- Pin Preview is a command; platform mapping is separate. Windows `Alt+Space` remains reserved for the OS.
