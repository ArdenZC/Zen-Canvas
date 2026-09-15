# ADR-0009 — Zen In-App Quick Preview Surface

Status: **Accepted for W6-09 implementation by the owner amendment**

Date: 2026-09-14

Supersedes: the in-app presentation assumptions carried by the W6-08
`ZenFloatingQuickPreview` / `ZenPinnedPreview` implementation. ADR-0005 and
ADR-0006 remain historical and normative for their native Host/Adapter,
opaque-source, shell-isolation and Windows Preview Handler boundaries. This
decision does not rewrite or delete those records.

## Context

W6-08 closed the repository/browser presentation gap around the existing
Preview Core, but exact Windows native review found that the current in-app
Quick Preview experience is not an acceptable product surface. In particular,
the current Windows presentation conflates the Zen-owned in-app experience
with platform-specific preview presentation and gives Floating and Pinned
different product layouts.

The owner amendment for W6-09 establishes the product correction:

- V26 remains the visual authority;
- Zen in-app Quick Preview must feel like one calm, centered Quick Look-style
  surface across supported platforms;
- the metadata/details panel is hidden by default and opened explicitly;
- PDF is a first-class continuous document preview;
- Markdown is rendered-first rather than raw-source-first;
- Windows in-app Preview must not depend on the Explorer Preview Handler or
  the current native child-HWND visual path.

## Decision

### 1. V26 remains the visual authority

The checksum-bound V26 target under `docs/design/w6-06/07-v26/` remains the
canonical reference for shell geometry, quiet controls, typography, surfaces,
focus grammar and responsive behavior. Native evidence and real content may
expose truthful capability differences, but they do not replace the V26 visual
authority or permit a fake score.

### 2. Zen owns the in-app Quick Preview surface

Zen-owned in-app Quick Preview is a cross-platform product surface. It is not
the Windows Explorer Preview Handler UI and it is not an Explorer Preview Pane
child window.

The in-app path preserves the existing source and lifecycle authorities:

```text
ManagedFile / EphemeralBrowse
→ PreviewSession / PreviewExperienceController
→ Preview Core and Read/Materialization authority
→ Provider Registry / PreviewRepresentation
→ Zen-owned Quick Preview renderer
```

The renderer receives only the existing safe representation or approved
`PreviewAsset` capability. It never receives a raw filesystem path and it does
not enumerate the filesystem itself.

### 3. Native platform boundaries remain explicit

Windows in-app Quick Preview no longer depends on:

- WindowsPreviewHandler presentation;
- Explorer Preview Pane presentation;
- the current native child-HWND visual experience.

The Windows Explorer Preview Handler remains a separate read-only shell
integration governed by ADR-0005/0006. It is frozen for this initiative:
retain it, do not improve its appearance here, do not delete it, and do not
use it as evidence for Zen in-app Quick Preview acceptance.

On macOS, the existing Preview authority may use `QLPreviewView` / the
`NativeOpaque` presentation seam behind the Zen-owned surface when the native
host can preserve the existing sourceVersion, Read Gate, lifecycle and
cleanup contracts. Native macOS GUI acceptance remains separate evidence.

### 4. Floating and Pinned share one canonical surface

The product presentation owner is one shared surface:

```text
ZenQuickPreviewSurface
├── QuickPreviewHeader
├── QuickPreviewViewport
├── QuickPreviewDetailsPanel
├── QuickPreviewFooter
└── renderers/
```

`mode` is `floating | pinned`. The mode changes lifecycle semantics, not the
product layout:

- Floating opens and closes from the current selected/focused file;
- Pinned keeps the current Preview target fixed while external Files
  selection changes;
- the pin control exposes active/pressed state;
- Unpin returns to Floating mode;
- both modes remain the same centered V26 shell and never become a right dock,
  sidebar, inspector or permanent workspace region.

Compatibility wrappers may remain while callers migrate, but they must not
own divergent layout or independent Preview state.

### 5. Details are ephemeral and hidden by default

`detailsOpen` is UI/session state owned by the canonical surface and defaults
to `false` for every newly opened Preview. The header info action toggles it.
Closing the Preview resets it unless an existing ephemeral session owner
provides a more natural, non-durable lifecycle.

When closed, the content receives the complete usable Preview width. When
open, the metadata panel may use the V26-compatible approximately 226px rail
and the content resizes smoothly. Only authoritative, useful metadata is
shown; missing values are omitted rather than guessed. This is not a durable
settings preference.

### 6. Preview lifecycle invariants remain unchanged

Selection, focus and Preview target remain distinct. The existing
`PreviewSession` / `PreviewExperienceController` remains the only lifecycle
and cancellation owner:

- Space opens Floating and closes it when Floating is active;
- Escape and the close action close the surface and restore sensible focus;
- Pin stages the same target into Pinned mode;
- external selection does not replace a pinned target;
- internal sibling navigation may replace the target explicitly;
- rapid A → B → C publishes only C;
- close-before-response prevents late UI publication or reopening;
- disposal revokes assets, workers/tasks and transient representation state.

No second Preview store, durable source authority, or persistence authority is
introduced.

### 7. PDF and Markdown are first-class local representations

PDF Preview must provide a local, read-only, continuous vertical document
viewport with lazy/virtualized page rendering, fit/zoom controls, current page
tracking where known, truthful loading/corrupt/encrypted/failed/cancelled
states, and stale-response suppression. Arrow keys remain file sibling
navigation, not PDF page navigation.

Markdown Preview is rendered-first using the existing safe representation
boundary. It must sanitize untrusted content, execute no scripts or active
HTML, and provide a safe plain-text fallback on provider-local failure. Raw
Markdown source is not the default document presentation.

If a local PDF renderer dependency is needed, its exact package, license,
bundle/worker size, CSP, offline behavior and update/security ownership must be
recorded in the implementation PR before activation. Online viewers, cloud
upload, Explorer handlers, raw `file://` paths and renderer-owned filesystem
reads are prohibited.

Other existing bounded representations (text/code, image, table, structured
data, folder summary, archive tree and local media) remain on their current
Preview Core/asset contracts. Formats without an approved local renderer
remain truthful and quiet rather than being faked.

The current local media contract is not a browser media-stream contract: it
provides bounded opaque artifacts and, where explicitly approved, bounded
range reads, but it does not expose a seekable stream, `MediaSource` bridge or
codec/container policy to an `<audio>` or `<video>` element. Implementing
local media playback therefore requires a separately reviewed stream adapter,
renderer lifecycle and format policy. Until that architecture exists, local
media stays truthful and unsupported; it must not be full-copied into memory,
served through a raw path, or presented as a fake player.

### 8. Performance and cleanup are part of the surface contract

The implementation must preserve existing performance thresholds and measure
at least shell visibility, first useful content, file switching and close
cleanup. It must not eager-render hundreds of PDF pages. Object URLs,
renderer workers/tasks, page bitmaps and transient assets must be cleaned on
source switch, cancellation, close and dispose.

## Consequences

### Positive

- one understandable Floating/Pinned product surface;
- V26 geometry is not permanently reduced by a metadata rail;
- Windows in-app acceptance no longer depends on Explorer/COM presentation;
- PDF and Markdown behavior matches the owner's product intent;
- existing Preview Core, Read Gate, asset and source identity authorities are
  preserved;
- native shell integration remains separately governable and evidence-bound.

### Costs

- the current two-component presentation needs consolidation;
- details, mode and lifecycle behavior require real interaction coverage;
- local PDF rendering adds a dependency or a bounded implementation cost;
- exact Windows native screenshots must be regenerated from the new runtime;
- macOS native GUI and Explorer shell acceptance remain separate/unverified
  when their real hosts are unavailable.

## Rejected alternatives

- keeping a permanently visible inspector rail;
- retaining a separate Pinned dock layout;
- using Explorer Preview Handler output as Zen in-app acceptance;
- passing original filesystem paths to a renderer;
- creating a second Preview store or renderer filesystem API;
- using an online/cloud PDF viewer or uploading user files;
- treating raw Markdown as the default preview;
- bundling a large runtime such as LibreOffice without separate owner approval.

## Revisit triggers

Revisit this ADR only if implementation proves that the existing Preview Core,
Read/Materialization Gate, Provider Registry or PreviewAsset seam cannot support
the required local representation without a new durable authority, permission
boundary, schema migration, raw-path exposure, cloud transfer or replacement
of the Preview Core. Such a condition is a W6-09 blocker and requires explicit
architecture review before scope expands.
