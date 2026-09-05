# W6-06 — Design Craftsmanship Quality Bar

Date: 2026-09-06

Status: **W6-06 design acceptance rubric — production implementation not authorized**

This rubric defines the quality bar for Zen Canvas representative target designs and the later W6-07 implementation handoff.

The standard is not “looks cleaner than before.”

The standard is:

> Zen Canvas should withstand side-by-side scrutiny with mature, highly crafted desktop software while still feeling like its own product.

## 1. Review philosophy

A visually impressive screenshot is insufficient.

Quality must survive:

- switching between major screens;
- repeated interaction with the same controls;
- keyboard use;
- degraded/error states;
- narrow windows;
- Chinese/English text;
- Light/Dark mode;
- long-session use;
- repeated inspection of small details.

The more often an element appears, the higher its craftsmanship requirement.

## 2. Scored quality dimensions

Representative target designs are scored out of 100.

A target is not accepted below **92/100**, and no individual critical category may score below its minimum.

### A. Cross-product coherence — 20 points; minimum 18

- shared content grid and edge alignment — 4
- same-role component anatomy across pages — 5
- consistent density/spacing rhythm — 4
- consistent state grammar — 4
- shell/navigation/page hierarchy unity — 3

### B. Component craftsmanship — 15 points; minimum 14

- control dimensions/padding — 3
- icon sizing and optical alignment — 3
- border/radius/elevation consistency — 3
- typography/baseline alignment — 3
- hover/pressed/disabled details — 3

### C. Information hierarchy — 12 points; minimum 11

- primary task clarity — 3
- primary vs secondary action weight — 3
- ordinary vs advanced information separation — 2
- content outranks chrome — 2
- degraded state consequence/next action clarity — 2

### D. Interaction states — 12 points; minimum 11

- selection vs keyboard focus distinction — 3
- predictable hover/pressed behavior — 2
- focus geometry and restoration specification — 2
- loading without layout jumps — 2
- modal/popover/menu interaction consistency — 3

### E. Desktop/platform credibility — 10 points; minimum 9

- Windows behavior feels Windows-native — 3
- macOS behavior can adapt without fake platform chrome — 2
- toolbar/menu/shortcut conventions — 2
- resizing/overflow/scroll ownership — 3

### F. Density and long-session comfort — 8 points; minimum 7

- real file-work density — 2
- no unnecessary oversized controls — 2
- visual noise restrained — 2
- repeated surfaces remain comfortable — 2

### G. Failure and safety craftsmanship — 8 points; minimum 7

- unavailable vs error vs safety-block distinction — 2
- retry/recovery clarity — 2
- destructive consequence visibility — 2
- no visual camouflage of backend limitations — 2

### H. Responsive/i18n/theme resilience — 8 points; minimum 7

- wide/medium/narrow collapse order — 3
- Chinese/English expansion behavior — 2
- Light/Dark parity — 2
- truncation/wrapping behavior — 1

### I. Brand restraint and distinctiveness — 4 points; minimum 3

- recognizably Zen Canvas — 2
- signature details do not compete with work content — 2

### J. Motion and micro-interaction — 3 points; minimum 2

- timing/easing consistency — 1
- no gratuitous animation — 1
- state transition continuity — 1

## 3. Automatic rejection conditions

Regardless of total score, a target is rejected if any of these are visible:

- same semantic control has materially different height/radius/padding across representative pages without justification;
- page content edges visibly drift between Overview, File Library and Settings;
- Preview looks like a separate unrelated application;
- selection and keyboard focus are visually indistinguishable;
- empty/error/unavailable states use unrelated layout systems;
- page-local one-off palette/radius/shadow becomes necessary to make a screen look right;
- arbitrary icon sizes are used without a size ladder;
- dialog/popover/sheet shadow/radius/spacing differ by feature rather than semantic role;
- narrow-window behavior relies on accidental wrapping;
- technical diagnostics visually dominate ordinary settings;
- Light mode is polished but Dark mode is merely color-inverted, or vice versa;
- Chinese copy visibly breaks the rhythm that works in English;
- a mature-product reference is copied literally without adapting to Zen Canvas architecture or platform context.

## 4. Pixel/detail review checklist

Every representative screen must be reviewed at 100% browser/native scale and at one scaled desktop condition.

Inspect:

- left/right content edges;
- top baseline of page title;
- toolbar baseline;
- search/field/control heights;
- button text vertical centering;
- icon optical centering;
- icon/text gap;
- shortcut alignment;
- checkbox/switch alignment;
- row baseline consistency;
- separator start/end points;
- panel inset symmetry;
- nested corner relationships;
- border contrast;
- focus-ring offset;
- selected state saturation;
- hover transition;
- disabled-state legibility;
- truncation ellipsis location;
- multi-line copy line height;
- popover anchor alignment;
- popover edge clearance;
- dialog action alignment;
- scrollbar intrusion;
- bottom scroll padding;
- empty-state vertical placement;
- loading-state geometry stability;
- error-state action placement;
- narrow-window collapse sequence.

## 5. Cross-screen review method

Do not review Overview, File Library, Quick Preview and Settings one at a time and approve them independently.

Review them in a single contact sheet / side-by-side sequence.

For every repeated semantic role, compare directly across screens:

- page title
- subtitle/status
- toolbar
- search
- button
- icon button
- segmented control
- notice
- row
- selected row
- focus
- panel
- Inspector/settings detail area
- empty/error/unavailable state

If a repeated role appears different, record either:

- a documented semantic reason; or
- a coherence defect to fix.

## 6. Reference-product use

Mature products are quality references, not templates.

Use references to answer questions such as:

- How does Finder make location and file content dominant?
- How does Quick Look keep preview chrome quiet?
- How does Fluent keep Windows controls/platform behavior natural?
- How does Raycast make keyboard states predictable?
- How does Things make a dense daily-use product feel calm?
- How does Linear keep action placement consistent as product complexity grows?
- How does Figma make inspector density systematic?

Then design a Zen Canvas-specific solution.

## 7. W6-06 completion implication

The final W6-06 representative designs may proceed to W6-07 handoff only when:

- the coherence audit exists;
- the mature-product benchmark exists;
- the canonical Zen UI grammar exists;
- representative target screens score at least 92/100;
- all automatic rejection conditions are clear;
- remaining functional failures/UNVERIFIED states are not hidden by visual design;
- the product owner has reviewed the combined system, not just isolated attractive screens.
