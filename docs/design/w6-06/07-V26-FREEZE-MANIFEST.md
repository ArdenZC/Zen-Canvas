# V26 Freeze Manifest

This manifest binds the final W6-06 owner-approved target-design artifacts by SHA-256 and records the durable repository reconstruction path used by W6-07.

## Canonical rebuilt artifacts

| Artifact | SHA-256 |
| --- | --- |
| `zen-canvas-full-product-showcase-v26.html` | `302905D8EEA95BF08873588810983E505E732031E100992171B97C421EA81F52` |
| `zen-canvas-full-product-showcase-v26-mac.html` | `85097A21597FBEA32475445A1AF4F1BD146AC0D72A1CB72633DA8D3C696D3B9C` |
| `zen-canvas-full-product-showcase-v26-windows.html` | `0D789D2DFBF2508C8F0307B8925EB98DF27E2401F1EF9DD66C1713C7790FA656` |
| `zen-canvas-desktop-quick-search-v26.html` | `7C604C86BEE2B24F164BEBC8F4D8F8BCF3480D34F976E2362E1A99C9FFB07558` |

The earlier owner freeze-package ZIP remains a convenience/archive identity only: `EFDD0C57D96916FD8F3752E37307BB4A956E58D33C3DF3A5D32C21102E3590DB`. W6-07 does **not** depend on access to that ZIP.

## Durable repository retention

The exact V26 targets are rebuildable from files committed under `docs/design/w6-06/07-v26/`.

Main V26 is a deterministic gzip+base64 stream split into contiguous numbered text chunks:

| Retained source | Git blob SHA-1 |
| --- | --- |
| `zen-canvas-full-product-showcase-v26.html.gz.b64.part00` | `afaad1664d629a5439b9ba11714843f21aa15a0e` |
| `zen-canvas-full-product-showcase-v26.html.gz.b64.part01` | `ac1f2e0bf5b1015fa1c1a08ee294035cc4e308d8` |
| `zen-canvas-full-product-showcase-v26.html.gz.b64.part02` | `b501bfa5479a9426cb5fecb305e139d4214d6d16` |
| `zen-canvas-full-product-showcase-v26.html.gz.b64.part03` | `9aee04b6887385957ef3b801a389516d6b8813bc` |
| `zen-canvas-full-product-showcase-v26.html.gz.b64.part04` | `9543da3d5312126cc73bf023e854a487822fef1b` |

Desktop Quick Search is retained as:

- `zen-canvas-desktop-quick-search-v26.html.gz.b64` — Git blob `9ecf76533bbf6f57d1c052816a965ae1dc509d3b`.

The reconstruction/verification program is:

- `rebuild-v26.py` — Git blob `9ca44f5e521ec894c726655a25a40d562f6d0e01`.

Windows and macOS are deliberately not separate drifting copies. They are deterministic V26 platform variants derived from the canonical main target by replacing the **single** `data-platform="neutral"` marker with `windows` or `mac`. The verifier fails closed unless exactly one neutral marker exists and all four rebuilt SHA-256 values match this manifest.

## Fresh-checkout verification

From repository root:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only
```

Expected result: four `PASS` lines with the exact SHA-256 identities above and process exit code `0`.

To materialize the review targets for side-by-side W6-07 implementation work:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --out outputs/w6-06-v26-rebuilt
```

The retained compressed text assets are repository evidence only; they are never imported by production code.

## QA identity

Main V26 accepted QA:

- 128 / 128 primary layout scenarios PASS;
- 8 / 8 core interaction suites PASS;
- 16 / 16 extra 680px smoke scenarios PASS;
- Windows platform chrome PASS;
- macOS platform chrome PASS;
- console/page errors 0;
- duplicate DOM IDs 0;
- unnamed buttons 0;
- JavaScript syntax PASS.

Desktop Quick Search V26 accepted QA:

- 6 / 6 layout scenarios PASS;
- search/filter/arrow/Escape/global-shortcut/focus suite PASS;
- console/page errors 0.

These are browser/prototype claims only. They do not upgrade W6-05 `FAIL`, `DEGRADED` or `UNVERIFIED` native/product evidence.

## Frozen product decisions

- one global **Files** entry; Library and Browse folders are internal Files modes;
- centered Search + Commands anchor;
- Selection ≠ Focus ≠ Primary;
- no underline / bottom-bar / rail / decorative glow focus grammar;
- Space = Quick Preview;
- related-but-not-identical selection semantics;
- truthful unavailable/degraded/safety states;
- preserve durable backend, Query, Preview Core, Restore, Dry Run and AI-consent/provider authorities;
- Windows/macOS share the Zen product grammar but retain platform-appropriate native chrome;
- no second Preview architecture.

## Freeze score

**93.4 / 100 — PASS against the 92 / 100 owner freeze threshold.**

W6-06 is COMPLETE/CLOSED. W6-07 remains INACTIVE until its separate governance activation.
