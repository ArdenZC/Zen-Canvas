# Craftsmanship Review — Owner Refinement

**UNIFIED UI GRAMMAR REVISION COMPLETE — OWNER RE-REVIEW REQUIRED**

This review replaces the previous provisional self-review for the refined specimen. It does not authorize production or W6-07.

## Revised score

**91/100** at design/specimen level.

The score intentionally does **not** increase merely because owner comments were addressed. The refined system is more semantically coherent, but native evidence and complete flagship-page evidence remain absent.

| Category | Score | Reason |
| --- | ---: | --- |
| Cross-product coherence | 19/20 | one metric/spatial/state family; flagship full-page proof still pending |
| Component craftsmanship | 14/15 | semantic selection/focus improved; native glyph raster remains unverified |
| Information hierarchy | 11/12 | border texture and Switch noise reduced; real task composition still pending |
| Interaction states | 11/12 | surface/boundary focus grammar + independent selection/error/loading; native async transitions unverified |
| Desktop/platform credibility | 9/10 | quiet toolbar chrome and denser copy improve desktop credibility; native shell not revalidated |
| Density/long-session comfort | 7/8 | compact UI copy 14/20 and 32/36 controls; sustained real-library use not studied |
| Failure/safety craftsmanship | 8/8 | W6-05 failures remain explicit and not cosmetically upgraded |
| Responsive/i18n/theme resilience | 7/8 | browser matrix rerun; native DPI/Retina/IME still pending |
| Brand restraint/distinctiveness | 3/4 | strong restraint/family resemblance; flagship composition must prove distinctiveness at product scale |
| Motion/micro-interaction | 2/3 | restrained motion contract retained; live native transition continuity pending |

## Owner-review corrections completed

1. Removed universal selection check. Checks now belong to multi-select objects or genuinely checkable menu semantics.
2. Navigation uses tonal current state without check.
3. Segmented choices use tonal active child without check.
4. Owner rejected line-based focus. Focus now uses object/control tonal surfaces, the existing field boundary, and the existing Switch track; no focus underline/bottom-bar is permitted.
5. Routine toolbar buttons are quiet at rest; persistent fields retain explicit boundary.
6. Ordinary Switch no longer shows redundant On/Off copy; explicit state text is a high-impact variant.
7. Added compact UI-copy role 14/20 while retaining explanatory 14/24.
8. FileRow selection mark moved into a structural marker column with stable geometry.
9. Added a “Related, not identical” comparison to prove family resemblance without identical decoration.
10. Binding owner follow-up rejected underline/line-based focus. The specimen now uses tonal focus surfaces, identity foreground emphasis, existing field boundaries and existing Switch track emphasis; no focus underline or bottom-bar remains.

### Follow-up validation after underline rejection

The no-underline specimen was re-run through the same 24 Light/Dark × Chinese/English × Default/Compact × 3 viewport matrix. Result: **24/24 PASS**. Static checks confirm object/navigation text decoration is `none`, no control focus pseudo-line is generated, fields use no focus background-image accent, and selected+focus remains visually distinct from selected alone.

The score remains **91/100**. Addressing an owner rejection does not itself increase the craftsmanship score.

## Browser verification

The refined standalone specimen was exercised headlessly at 100% zoom through **24 final combinations**:

- 1920×1032, 1282×862, 980×680;
- Light/Dark;
- Chinese/English;
- Default/Compact density.

Checks include:

- no document horizontal overflow;
- 32/36 command heights;
- FileRow 44px in all combinations;
- structural 20px selection-marker slot retained in selected and unselected rows;
- Navigation selected state contains no check marker;
- Segmented active state contains no check marker;
- ordinary Switch contains no visible On/Off state copy;
- focus surfaces/boundaries and selected+focus states present without added line ornaments or layout change;
- narrow toolbar resolves to at most two rows;
- Inspector collapses at the narrow recipe.

Detailed results are stored in `06-evidence/owner-refinement-browser-matrix.json`.

## Interaction verification

Headless browser interaction checks cover:

- menu open, ArrowDown and Escape return;
- dialog safe focus, Tab/Shift+Tab containment and Escape focus return;
- segmented keyboard selection with one tab stop;
- ordinary Switch toggles without adding visible On/Off copy;
- selected FileRow preserves marker slot and selected+focus surface treatment;
- search clear retains field geometry/focus.

Results are stored in `06-evidence/owner-refinement-interaction-checks.json`.

## Contrast verification

The owner follow-up adds focus-soft / selected-focus roles. A fresh script evaluates **56 declared semantic foreground/background or meaningful non-text boundary pairs** against the same targets used by the prior candidate (4.5:1 text where applicable; 3:1 meaningful focus/control/selection boundaries). The result is stored in `06-evidence/owner-refinement-contrast-checks.json`.

This remains a design-level calculation, not WCAG certification.

## Still unverified

- real Windows/macOS font rasterization;
- native titlebar integration;
- DPI/Retina scaling;
- Narrator/VoiceOver;
- native IME edge cases;
- full virtualized real library;
- real provider loading/cancellation;
- native Preview pin/navigation/loading;
- long-session comfort;
- complete File Library flagship composition;
- final owner aesthetic acceptance.

Therefore the status remains **OWNER RE-REVIEW REQUIRED**.
