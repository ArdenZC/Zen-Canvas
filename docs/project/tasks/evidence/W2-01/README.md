# W2-01 exact-head browser evidence

This bundle is generated from the exact production head recorded in
`measurements.json`. It uses a real rendered browser page with an explicit
viewport override; browser outer-window dimensions are not used as viewport
evidence.

The repeatable gate is implemented in
`scripts/w2-01-browser-gate.mjs`:

- `collectW201BrowserMeasurement(sourceHead, requestedViewport)` records the
  viewport contract, bounds, overflow metrics and mounted virtual rows;
- `evaluateW201CompactGate(...)` checks the Compact bounded-layout contract;
- `evaluateW201VirtualizationInteraction(before, after)` checks actual
  listbox scrolling, virtual-range change, bounded mounted rows and
  progressive completion;
- `evaluateW201ProjectionGate(...)` checks detached Browse and ordinary
  Overview projection boundaries.

The browser fixture is enabled only with
`?w2-01-browser-fixture=virtualized`; it supplies enough mock rows to prove
the existing TanStack virtualizer and progressive load-more path without
changing production authority.

Evidence files:

- [Wide Library](./wide-library.jpg) — 1600×900
- [Medium Library](./medium-library.jpg) — 1280×720
- [Compact Library](./compact-library.jpg) — 980×680
- [Compact Library after listbox scroll](./compact-library-scrolled.jpg) — 980×680
- [Detached Browse](./compact-detached-browse.jpg) — 980×680
- [Ordinary Overview](./compact-overview.jpg) — 980×680
- [Measurements and hard assertions](./measurements.json)
