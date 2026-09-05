# W6-06 — Three Comparable Visual Directions

Status: **OWNER REVIEW REQUIRED — no direction selected yet**

Visual prototype: [`visual-directions.html`](visual-directions.html)

All three directions preserve the same information architecture, durable authorities and representative states. The differences are visual hierarchy, material treatment, density and product personality — not backend behavior.

## Direction A — Quiet Native

### Thesis

> Zen Canvas should feel like a mature native desktop utility that happens to be unusually thoughtful.

### Visual language

- near-neutral canvas and content surfaces;
- smallest practical radius hierarchy;
- separators and spacing do more work than cards;
- system-blue accent used sparingly;
- dense list/workspace presentation;
- minimal translucency outside titlebar/sidebar/floating surfaces;
- Inspector and Preview feel structurally integrated rather than decorative.

### Shell

- crisp 48px titlebar;
- quiet sidebar with a narrow active marker;
- local page tools sit directly above content rather than inside containers;
- global Spotlight is a compact centered capsule, visually distinct from local search.

### Strengths

- strongest native credibility;
- easiest transition from Finder/Explorer expectations;
- excellent long-session density;
- easiest to implement on existing semantic-token architecture;
- low risk of visual fashion aging badly.

### Risks

- can feel generic if brand micro-details are not excellent;
- least visually distinctive of the three;
- emotional “Zen” character relies on typography, motion and micro-spacing rather than obvious styling.

### Best fit

Choose A if the product priority is **serious native utility first, brand expression second**.

---

## Direction B — Zen Mist

### Thesis

> Zen Canvas should feel calm before it feels technical: a soft, ordered personal workspace with restrained brand atmosphere.

### Visual language

- muted blue-gray / Morandi canvas;
- slightly warm content surfaces rather than pure white everywhere;
- soft cyan-blue brand accents without large gradients;
- medium radii with a strict material hierarchy;
- very subtle inner highlight/elevation for selected and raised surfaces;
- translucent shell chrome, opaque work surfaces;
- state colors are desaturated and contextual.

### Shell

- sidebar visually blends into the canvas rather than reading as a separate slab;
- active navigation uses a tonal glow + 2px indicator, not a saturated fill;
- Overview uses one priority surface plus flat supporting rows;
- File Library remains content-first with slightly softer selection and inspector treatment.

### Strengths

- strongest balance of brand identity and desktop restraint;
- directly compatible with the existing Zen Core / Canvas brand concept;
- supports calm error/recovery states without looking clinical;
- preserves density while feeling more polished than A;
- naturally supports Light/Dark parity.

### Risks

- easy to over-soften into low contrast if tokens are not disciplined;
- glass/blur temptation must be actively constrained;
- requires careful typography and divider tuning to avoid “gray on gray”.

### Best fit

Choose B if the product priority is **calm distinctive identity without sacrificing serious file-work density**.

---

## Direction C — Focus Canvas

### Thesis

> Zen Canvas should make the current task unmistakable: one focused working stage surrounded by quiet contextual tools.

### Visual language

- stronger spatial hierarchy between shell, focus stage and context;
- larger but fewer surfaces;
- more deliberate asymmetric layouts;
- Spotlight/task-focus capsule becomes a recognizable product motif;
- status is summarized in a thin semantic rail/strip rather than repeated notices;
- accent can shift subtly between search, organize, cleanup and recovery contexts while staying in one blue/teal family.

### Shell

- sidebar is visually quieter than the main focus stage;
- current task occupies a strong central composition;
- Overview is task-first rather than section-first;
- Preview becomes a flagship floating/pinned stage with clearer navigation chrome;
- Settings visually separates everyday preferences from advanced system capability panels.

### Strengths

- most distinctive product identity;
- strongest potential for a premium Preview experience;
- excellent task hierarchy and progressive disclosure;
- gives Zen Canvas a visual motif beyond color alone.

### Risks

- highest implementation complexity;
- easiest direction to accidentally over-design;
- must be carefully adapted at narrow widths;
- if focus-stage surfaces become too large, file-work density suffers.

### Best fit

Choose C if the product priority is **strong product identity and task focus**, accepting a more ambitious reconstruction.

---

## Same-state comparison

| Criterion | A — Quiet Native | B — Zen Mist | C — Focus Canvas |
| --- | --- | --- | --- |
| Calmness | Excellent | Excellent | Very good |
| Native desktop credibility | Excellent | Excellent | Very good |
| Distinctive Zen identity | Moderate | Excellent | Excellent |
| File-work density | Excellent | Very good | Good–very good |
| Preview redesign potential | Very good | Excellent | Excellent |
| Failure/recovery readability | Very good | Excellent | Excellent |
| Responsive simplicity | Excellent | Very good | Moderate |
| Implementation tractability | Excellent | Very good | Moderate |
| Risk of generic appearance | Medium | Low | Low |
| Risk of over-design | Low | Medium | Highest |

## Recommendation for owner review

The strongest default candidate is **Direction B — Zen Mist** because it preserves the mature desktop/workspace logic of V4.3 and W2 while adding enough product identity to solve the current “everything works but the product still feels visually unfinished” problem.

Direction A should remain the restraint benchmark: if B becomes too decorative, pull it back toward A.

Direction C should remain the ambition benchmark, especially for Quick Preview and task-focused surfaces: selected C ideas may only enter another direction if the final unified system is documented explicitly rather than assembled ad hoc.

**No direction is selected by this document. Product-owner selection remains required.**
