"""Validate the documentation specimen; never imports or modifies production code."""
import json
import re
from collections import Counter
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent
HTML = ROOT / "06-system-specimen.html"


class Structure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.issues = []
        self.labels = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for chinese, english in (("data-zh", "data-en"), ("data-label-zh", "data-label-en"), ("data-placeholder-zh", "data-placeholder-en")):
            if chinese in attrs:
                self.labels += 1
                if not attrs.get(english):
                    self.issues.append(f"Missing English for {attrs[chinese]}")
        if tag in ("script", "link", "img", "iframe"):
            for attr in ("src", "href"):
                if attrs.get(attr, "").startswith(("http:", "https:", "//")):
                    self.issues.append("Unexpected external asset")


def luminance(color):
    color = color.lstrip("#")
    if len(color) == 3:
        color = "".join(c * 2 for c in color)
    rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(a * b for a, b in zip(rgb, (.2126, .7152, .0722)))


def contrast(a, b):
    x, y = sorted((luminance(a), luminance(b)))
    return (y + .05) / (x + .05)


def main():
    html = HTML.read_text(encoding="utf-8")
    parser = Structure()
    parser.feed(html)
    parser.issues.extend(f"Duplicate ID: {key}" for key, count in Counter(parser.ids).items() if count > 1)
    for anchor in re.findall(r'href="#([^"]+)"', html):
        if anchor not in parser.ids:
            parser.issues.append(f"Missing anchor: {anchor}")
    for required in ("theme", "language", "density", "width", "overflow", "confirm-dialog", "inspector-dialog", "preview-dialog", "metrics"):
        if required not in parser.ids:
            parser.issues.append(f"Missing specimen control: {required}")
    ratios = []
    theme_blocks = [html.split(":root{", 1)[1].split("}", 1)[0], html.split("[data-theme=dark]{", 1)[1].split("}", 1)[0]]
    for theme, block in zip(("light", "dark"), theme_blocks):
        colors = dict(re.findall(r"--zc-([\w-]+):\s*(#[a-fA-F0-9]+)", block))
        pairs = [(fg, bg, 4.5) for fg in ("text", "secondary") for bg in ("canvas", "surface", "subtle", "floating")]
        pairs += [("disabled", "subtle", 4.5), ("on-primary", "primary", 4.5), ("on-primary", "primary-hover", 4.5), ("on-primary", "primary-pressed", 4.5)]
        pairs += [(role, role + "-soft", 4.5) for role in ("danger", "warning", "success")]
        pairs += [("text", bg, 4.5) for bg in ("selected", "selected-hover", "selected-pressed")]
        pairs += [("focus", bg, 3) for bg in ("surface", "selected", "selected-hover", "selected-pressed")]
        pairs += [("mark", bg, 3) for bg in ("selected", "selected-hover", "selected-pressed")]
        pairs += [("border", "surface", 3)]
        for fg, bg, minimum in pairs:
            ratio = contrast(colors[fg], colors[bg])
            ratios.append(dict(theme=theme, foreground=fg, background=bg, ratio=round(ratio, 3), minimum=minimum, passed=ratio >= minimum))
            if ratio < minimum:
                parser.issues.append(f"Contrast {theme} {fg}/{bg}: {ratio:.3f} < {minimum}")
    primitives = ["Button", "IconButton", "SearchField", "Input", "Select", "SegmentedControl", "Switch", "Toolbar", "ToolbarGroup", "PageHeader", "CompactWorkspaceHeader", "SectionHeader", "Panel", "Row", "InteractiveRow", "FileRow", "GridTile", "Badge", "Notice", "StateBlock", "Popover", "Menu", "Dialog", "Sheet", "Inspector", "PropertyRow", "ScrollArea", "Tooltip", "Toast", "Preview overlay chrome"]
    anatomy = (ROOT / "06-COMPONENT-ANATOMY-SPEC.md").read_text(encoding="utf-8")
    for name in primitives:
        if not re.search(r"\| " + re.escape(name) + r" /", anatomy):
            parser.issues.append(f"Missing canonical anatomy row: {name}")
    report = dict(scope="Static artifact/contrast verification only; no accessibility/native certification", specimen_sha256=sha256(HTML.read_bytes()).hexdigest(), bilingual_attributes=parser.labels, canonical_primitives_checked=len(primitives), contrast=ratios, issues=parser.issues)
    target = ROOT / "06-evidence" / "artifact-checks.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"bilingual_attributes":parser.labels, "primitives":len(primitives), "contrast_pairs":len(ratios), "issues":parser.issues}, ensure_ascii=False))
    raise SystemExit(bool(parser.issues))


if __name__ == "__main__":
    main()
