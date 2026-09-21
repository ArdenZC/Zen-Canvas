# Solid / Calm Demo V2 Freeze Manifest

Status: **OWNER-APPROVED CURRENT VISUAL AUTHORITY — W6-09**

This manifest freezes the owner-approved Zen Canvas **Solid / Calm Demo V2** artifacts for W6-09 presentation migration. It supersedes the earlier Liquid Glass material direction without reopening accepted product, Preview, Browse, Read Gate, PDF, or source-identity architecture.

## Canonical artifacts

| Artifact | Role | SHA-256 |
| --- | --- | --- |
| `solid-calm-v2/zen-canvas-solid-calm-demo-windows-v2.html` | Whole-product Windows visual/material reference | `B7DA4B4E02E2A5F174824A16F5263211185092C03D2E85F6BCA471B17DBDA1D7` |
| `solid-calm-v2/zen-canvas-solid-calm-preview-demo-v2.html` | Quick Preview-focused reference; same demo with PDF Preview opened by default | `06E9DEB7B08EA433B27C946E2EB57184388029BEA00F322B8D48EF45F761C84E` |

The two frozen HTML files differ by one intentional behavior line only: the Preview artifact opens the PDF Quick Preview state by default when no explicit page/modal query is supplied.

## Authority precedence

1. **Solid / Calm Demo V2** — current canonical for material, surfaces, borders, shadows, selected navigation state, Settings grammar, Quick Preview grammar, spacing refinements, icons and shell polish.
2. **Later explicit Owner amendments** — override this freeze when documented.
3. **V26** — remains authoritative for product structure, navigation hierarchy, information architecture, and interaction contracts that have not been superseded.
4. Quick Look / SageThumbs and other references — engineering/interaction references only, never visual authority.

The previous **Liquid Glass** material direction is revoked.

## Hard visual rules

- No decorative left selection/current-page/focus rail.
- No Liquid Glass material system, glass-on-glass surfaces, specular glass highlight, or backdrop-blur Quick Preview material.
- Do not use decorative glow as focus grammar.
- Quick Preview is content-first; Details are hidden by default.
- PDF continuous scrolling and Markdown rendered reading mode remain functional requirements.
- Pinned Preview uses the same centered surface and remains non-modal outside the card.
- Loading and failed/unsupported terminal states are centered.
- No startup Close-button blue halo.
- Settings uses quiet rows/dividers and no card-inside-card composition.
- Real Settings capabilities remain reachable exactly once.
- Use the corrected, optically centered Settings gear from the V2 demo.
- Windows minimize/maximize/close controls must be geometrically and optically vertically centered.

## Prototype-source caveat

The frozen HTML files are visual prototypes, not production CSS templates. Their source retains historical declarations that are superseded later in the prototype cascade. **Do not copy obsolete internal prototype rules literally.** Implementation authority is the final rendered V2 result, this manifest, and later explicit Owner amendments. Production migration must reduce CSS authority/debt, not append another compatibility layer.

## Accepted functional baseline that must not regress

- source: `88fc663392371049fda2d71b85bd4815d073bfe0`
- tree: `5ca511f055b02bb511bc0873ffc5c2a2d26efadf`

Frozen behavior includes first-entry Browse through the existing native picker/openBrowse authority; admitted ephemeral-session truth; Preview Core / Read Gate / source identity; opaque PDF range transport, continuous scrolling and lazy rendering; rendered-first Markdown; controlled image blob transport; provider ordering; pinned source freeze/non-modal background interaction; Details lifecycle; and stale/cancellation behavior.

This freeze does not authorize backend, schema, permission, provider-ownership, or durable-authority changes.

## Verification

```bash
python docs/design/w6-09/solid-calm-v2/verify-solid-calm-v2.py
```

Expected result: two `PASS` lines with the exact hashes above and exit code `0`.

## Evidence disposition

The Windows native captures from production source `88fc6633...` remain accepted **functional/native regression evidence**. Because the material authority changed after those captures, they are **historical for final visual parity**.

Final Solid / Calm visual acceptance requires fresh native recapture after presentation migration. Real macOS GUI acceptance, Windows Forced Colors, and additional DPI-specific review remain unverified.

W6-09 remains **ACTIVE**. W6-10 remains **INACTIVE**. No release/publication decision changes here.
