"""Read-only source inventory and retained-evidence atlas; no runtime or product writes.

Run from repository root: python docs/design/w6-06/build_audit_inventory.py
Lexical occurrences are candidates, not computed styles or independent implementations.
"""
from pathlib import Path
import collections
import hashlib
import html
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = "3910dc9e6e5caca922a91482c8a3ae954cde4104"
SHOTS = ROOT / "outputs/w6-05-native-audit/screenshots"

def write(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

paths = sorted(p for p in (ROOT / "src").rglob("*") if p.suffix in {".tsx", ".css", ".ts"})
categories = {
    "typography": r"(?:font-size|font-weight|line-height|letter-spacing)\s*:\s*[^;\n]+|(?<![\w-])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])|font-(?:normal|medium|semibold|bold|\[[^\]]+\])|leading-[\w.\[\]()-]+|tracking-[\w.\[\]()-]+)",
    "controls_dimensions": r"(?:min-height|max-height|height|width|min-width|max-width)\s*:\s*[^;\n]+|(?<![\w-])(?:min-h|max-h|h|w|size)-(?:\d+(?:\.\d+)?|\[[^\]]+\])",
    "layout_spacing": r"(?:padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|row-gap|column-gap)\s*:\s*[^;\n]+|(?<![\w-])(?:p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy])-(?:\d+(?:\.\d+)?|\[[^\]]+\])",
    "shape": r"(?:border(?:-[a-z]+)?|outline(?:-[a-z]+)?)\s*:\s*[^;\n]+|(?<![\w-])(?:rounded(?:-[a-z]+)?|border|divide-[xy]|outline-offset)-(?:[\w.]+|\[[^\]]+\])",
    "elevation": r"(?:box-shadow|backdrop-filter|z-index)\s*:\s*[^;\n]+|(?<![\w-])(?:shadow|backdrop-blur|z)-(?:[\w.]+|\[[^\]]+\])",
    "motion": r"(?:transition(?:-[a-z]+)?|animation(?:-[a-z]+)?)\s*:\s*[^;\n]+|(?<![\w-])(?:duration|ease|animate)-(?:[\w.]+|\[[^\]]+\])",
    "icon_size": r"\bsize\s*=\s*\{\d+\}|\bstrokeWidth\s*=\s*\{[\d.]+\}|\bsize:\s*\d+",
    "raw_color": r"#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch)\([^\n;)]+\)",
    "tokens": r"--zc-[\w-]+\s*:\s*[^;\n]+",
}
items = {k: collections.defaultdict(list) for k in categories}
files = []
groups = collections.defaultdict(list)
for p in paths:
    raw = p.read_text(encoding="utf-8")
    rel = p.relative_to(ROOT).as_posix()
    # Preserve line numbers while suppressing block and whole-line comments.
    clean = re.sub(r"/\*[\s\S]*?\*/", lambda m: "\n" * m[0].count("\n"), raw)
    clean = re.sub(r"(?m)^[ \t]*//[^\n]*", "", clean)
    count = 0
    for key, pattern in categories.items():
        for m in re.finditer(pattern, clean):
            items[key][m[0]].append(f"{rel}:{clean.count(chr(10), 0, m.start()) + 1}")
            count += 1
    if count:
        files.append({"path": rel, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "lexical_occurrences": count})
    for i, line in enumerate(raw.splitlines(), 1):
        for s in re.findall(r'"([^"\n]{18,})"', line):
            parts = s.split()
            for j in range(len(parts) - 3):
                seq = parts[j:j+4]
                if all(re.match(r"[\w\[&].*", x) for x in seq) and any("-" in x for x in seq):
                    groups[" ".join(seq)].append(f"{rel}:{i}")
inventory = {k: [{"value": v, "count": len(loc), "locations": loc} for v, loc in sorted(d.items())] for k, d in items.items()}
write("03-metric-inventory.json", {"source_head": BASE, "method": "Lexical scan of all src TS/TSX/CSS, including candidates in non-presentation TS. Comments suppressed. No CSS cascade, runtime occurrence, physical-pixel or reachability inference. text-[var(...)] includes color candidates: classify via human inventory. Counts are source mentions, not defects.", "scanned_files": len(paths), "files_with_candidates": files, "inventory": inventory})
write("03-duplicate-class-groups.json", {"method": "Repeated contiguous four-token quoted strings, >=2 distinct files; candidate review only. Re-exports are not duplication.", "groups": [{"class_group": k, "locations": sorted(set(v))} for k,v in sorted(groups.items()) if len({x.rsplit(':',1)[0] for x in v}) >= 2]})

inspected = '''Overview-final-stable FileLibrary-all-indexed-21 QuickPreview-Welcome-Markdown Settings-overview Browse-navigation-open Organize-initial OrganizationPlan-missing-info Cleanup-scan-fixture-result History-initial Settings-files-scanning-english Settings-search-english-dark Settings-automation-english-dark Settings-AI-english-dark Settings-privacy-security-english-dark Settings-about-english-dark Settings-global-index-unavailable Settings-platform-diagnostics-english-dark Settings-platform-and-managed-scopes-english-dark Automation-rules-initial-english-dark Automation-rule-manual-builder-english-dark Settings-appearance-chinese-light-restored Settings-appearance-english-dark FileLibrary-narrow-969x675 Overview-narrow-969x675 FileLibrary-filter-image ContextPanel-Welcome FileLibrary-grid QuickPreview-image-unavailable QuickPreview-PDF-metadata-fallback FileLibrary-multi-selection-ctrl-a R0-keyboard-focus Overview-medium-1299x884'''.split()
groups = {
 "Headers, content edges, command hierarchy": ["Overview-medium-1299x884", "FileLibrary-all-indexed-21", "Settings-overview", "QuickPreview-Welcome-Markdown", "Organize-initial", "History-initial"],
 "Selection, search and control anatomy": ["FileLibrary-multi-selection-ctrl-a", "FileLibrary-grid", "Settings-appearance-english-dark", "OrganizationPlan-missing-info", "R0-keyboard-focus"],
 "Panels, empty/error and safety language": ["Cleanup-scan-fixture-result", "Automation-rules-initial-english-dark", "History-initial", "QuickPreview-image-unavailable", "QuickPreview-PDF-metadata-fallback", "Settings-global-index-unavailable"],
 "Overlay and inspector chrome": ["QuickPreview-Welcome-Markdown", "Browse-navigation-open", "ContextPanel-Welcome", "Automation-rule-manual-builder-english-dark", "Settings-search-english-dark"],
 "Settings row, disclosure and diagnostics": ["Settings-overview", "Settings-files-scanning-english", "Settings-automation-english-dark", "Settings-AI-english-dark", "Settings-privacy-security-english-dark", "Settings-about-english-dark", "Settings-platform-diagnostics-english-dark", "Settings-platform-and-managed-scopes-english-dark"],
 "Narrow, language, theme and scroll": ["Overview-narrow-969x675", "FileLibrary-narrow-969x675", "Settings-appearance-chinese-light-restored", "Settings-appearance-english-dark"]}
def jpeg_size(data):
    i = 2
    while i < len(data):
        if data[i] != 255:
            i += 1
            continue
        marker = data[i+1]
        i += 2
        if marker in {0xD8,0xD9}:
            continue
        length = int.from_bytes(data[i:i+2], "big")
        if marker in {0xC0,0xC1,0xC2}:
            return int.from_bytes(data[i+5:i+7], "big"), int.from_bytes(data[i+3:i+5], "big")
        i += length
    raise ValueError("No JPEG frame")
shots = []
for p in sorted(SHOTS.glob("*.jpg")):
    data = p.read_bytes()
    assert data[:3] == b"\xff\xd8\xff"
    w,h = jpeg_size(data)
    shots.append({"file": p.relative_to(ROOT).as_posix(), "width": w, "height": h, "sha256": hashlib.sha256(data).hexdigest(), "inspection": "visually reviewed in W6-06" if p.stem in inspected else "retained W6-05 evidence; not separately visually reviewed in W6-06"})
write("03-screenshot-atlas.json", {"production_head": "ee1163fbf32f23cc95150adca4e1cb5a53081654", "capture_date": "2026-09-05", "review_date": "2026-09-06", "scaling": "UNVERIFIED; raster coordinates are not CSS px", "groups": groups, "screenshots": shots, "caveats": ["Settings-search-english-dark is an open command palette, not an unobscured Search settings section", "FileLibrary-filter-image shows applied results, not the open filter popover", "Blue cursor halo is capture/input decoration; excluded from product shadows and hover judgments", "JPEG compression prevents reliable 1px color/border and optical-centering certification"]})
header = '''<!doctype html><html lang="en"><meta charset="utf-8"><title>W6-06 retained screenshot comparison atlas</title><style>body{font:15px/1.5 system-ui;margin:24px;background:#eee;color:#111}nav{position:sticky;top:0;background:white;padding:12px;z-index:2}nav a{margin-right:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;background:white;padding:12px;min-width:0}img{width:100%;height:auto;display:block}figcaption{overflow-wrap:anywhere}section{scroll-margin-top:90px}details img{width:auto;max-width:none}details{overflow:auto}a:focus-visible{outline:3px solid #1367a2}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style><h1>W6-06 · Coherence comparison atlas</h1><p>Read-only W6-05 Windows/Tauri evidence; no new product screenshots or page designs. Images retain their bytes. Scaled comparisons explain structure only; open native-size originals for detail. Native DPI is unknown; cursor halo and JPEG noise are excluded. Status/search/filter filenames do not guarantee the visible state.</p>'''
header += '<nav>' + ''.join(f'<a href="#g{i}">{html.escape(name)}</a>' for i,name in enumerate(groups)) + '</nav>'
for i,(name,names) in enumerate(groups.items()):
    header += f'<section id="g{i}"><h2>{html.escape(name)}</h2><div class="grid">'
    for n in names:
        src = '../../../outputs/w6-05-native-audit/screenshots/' + n + '.jpg'
        header += f'<figure><a href="{src}"><img loading="lazy" src="{src}" alt="{n}"></a><figcaption>{n} · W6-05 retained evidence</figcaption><details><summary>Native raster size</summary><img loading="lazy" src="{src}" alt="{n} original size"></details></figure>'
    header += '</div></section>'
(OUT / '03-comparison-atlas.html').write_text(header + '</html>\n', encoding='utf-8')
print(json.dumps({"scanned_files": len(paths), "candidate_files": len(files), "categories": {k: {"unique": len(v), "occurrences": sum(x['count'] for x in v)} for k,v in inventory.items()}, "screenshots":len(shots), "reviewed": len(inspected)}, indent=2))
