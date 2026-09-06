# W6-06 Unified Zen UI Grammar — Owner Refinement Result

**UNIFIED UI GRAMMAR REVISION COMPLETE — OWNER RE-REVIEW REQUIRED**

This result records the bounded refinement requested by the owner after review of candidate `240d5168db42593fbe4a184fa85b0884cbfed66f`.

## Scope

Production code was not modified. W6-06 remains ACTIVE. W6-07 remains inactive. No File Library flagship redesign, Overview redesign, Settings full-page redesign, `tokens.css` implementation or runtime migration was performed.

## Refinement completed

- universal selection check removed;
- FileRow/GridTile multi-selection may retain semantic check;
- Navigation current state now uses tonal surface + label emphasis without check;
- Segment/mode selected state uses tonal selected child + label emphasis without check;
- Switch keeps its own track/thumb checked anatomy and ordinary preferences no longer repeat visible On/Off copy;
- owner rejected underline/line-based focus; focus grammar now uses object/control tonal surfaces, existing field boundaries and existing Switch track emphasis;
- routine toolbar buttons rest quietly while persistent fields retain explicit affordance boundaries;
- compact UI-copy role frozen at 14/20, with explanatory prose retained at 14/24;
- FileRow selection mark moved into a stable structural 20px marker column;
- specimen now includes a `Related, not identical` comparison proving family resemblance without identical decoration.

## Binding owner follow-up

The owner rejected underline-based focus after reviewing the refinement specimen. The design was revised again without changing production scope:

- no text underline for focus;
- no short bottom focus bars;
- no inner field accent line;
- object/navigation focus uses quiet focus surface + identity foreground emphasis;
- controls use focus surface/foreground;
- fields use their existing 1px boundary;
- switches use their existing track boundary/tone;
- Forced Colors may retain OS-native outline.

The revised no-underline specimen passed a fresh 24/24 browser matrix. Craftsmanship remains 91/100 pending owner acceptance and native/full-page proof.

## Verification

### Browser matrix

24/24 PASS:

- 1920×1032, 1282×862, 980×680;
- Light/Dark;
- Chinese/English;
- Default/Compact.

Verified no page horizontal overflow, canonical FileRow 44px, marker slot 20px, selected/unselected marker visibility, Navigation/Segment no generic check, ordinary Switch no visible On/Off copy, 14/20 compact copy, 14/24 prose, canonical toolbar control height, and no line-based focus ornament.

Evidence: `docs/design/w6-06/06-evidence/owner-refinement-browser-matrix.json`.

### Interaction checks

PASS:

- menu open / ArrowDown / Escape anchor return;
- segmented keyboard change + one tab stop;
- ordinary Switch toggle with no state-word insertion;
- Search clear geometry + focus return;
- Dialog initial safe focus, Tab containment and Escape return;
- FileRow 44px + 20px structural selection slot;
- selected+focus remains distinguishable through the refined surface treatment.

Evidence: `docs/design/w6-06/06-evidence/owner-refinement-interaction-checks.json`.

### Contrast

56/56 declared semantic pairs PASS at their defined 4.5:1 text or 3:1 meaningful non-text thresholds, including the new focus-soft / selected-focus roles.

Evidence: `docs/design/w6-06/06-evidence/owner-refinement-contrast-checks.json`.

### Artifact checks

PASS. Confirms structural marker slot, no generic Navigation/Segment check, no text underline/bottom-bar/inner focus accent, ordinary Switch without state word, compact/prose type roles, W6-07 inactive and no production-pass claim.

Evidence: `docs/design/w6-06/06-evidence/owner-refinement-artifact-checks.json`.

## Revised craftsmanship score

**91/100**.

The score intentionally did not increase merely because owner comments were addressed. Native font/DPI/platform evidence, long-session comfort and a complete flagship File Library composition remain outside this bounded task.

## Owner decision still required

The no-underline refined grammar is ready for owner re-review. If accepted, the next design step is **File Library Flagship Target Design**. Production implementation and W6-07 remain blocked until later authorization.
