import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buttonGhost,
  buttonIcon,
  buttonIconDanger,
  buttonPill,
  buttonSecondary,
  buttonSubtle,
  contentPanel,
  dangerSurface,
  elevatedPanel,
  infoSurface,
  successSurface,
  warningSurface
} from "../src/utils/tw";
import {
  IconButton,
  MetricCard,
  NoticeBanner,
  PageHeader,
  StateBlock,
  ToneBadge,
  appPanel,
  compactInteractiveRow,
  interactiveRow,
  pageBody,
  pageFrame,
  softPanel,
  SwitchButton,
  SwitchField,
  toolbarSurface
} from "../src/views/shared/ui";

describe("shared UI primitives", () => {
  it("exposes layered surface classes with distinct visual hierarchy", () => {
    const surfaces = [
      appPanel,
      contentPanel,
      elevatedPanel,
      softPanel,
      toolbarSurface,
      interactiveRow(),
      compactInteractiveRow(),
      dangerSurface,
      warningSurface,
      infoSurface,
      successSurface
    ];

    for (const className of surfaces) {
      expect(className).toContain("border");
      expect(className).toMatch(/bg-|gradient/);
    }

    expect(new Set([appPanel, contentPanel, elevatedPanel, softPanel]).size).toBe(4);
    expect(interactiveRow({ selected: true })).toContain("border-blue");
    expect(interactiveRow({ disabled: true })).toContain("pointer-events-none");
  });

  it("keeps the button system consistent across variants", () => {
    for (const className of [
      buttonSecondary,
      buttonGhost,
      buttonSubtle,
      buttonPill,
      buttonIcon,
      buttonIconDanger
    ]) {
      expect(className).toContain("focus-visible");
      expect(className).toContain("disabled:cursor-not-allowed");
    }

    expect(buttonSecondary).toContain("min-h-10");
    expect(buttonIcon).toContain("h-9");
    expect(buttonIconDanger).toContain("red");
  });

  it("renders switch controls with clear on and off status labels", () => {
    const markup = renderToStaticMarkup(
      <div>
        <SwitchButton checked label="Scan folder" statusLabel="On" onChange={() => {}} />
        <SwitchField checked={false} label="Launch at login" statusLabel="Off" onChange={() => {}} />
      </div>
    );

    expect(markup).toContain("bg-blue-600");
    expect(markup).toContain("bg-slate-300");
    expect(markup).toContain("On");
    expect(markup).toContain("Off");
    expect(markup).toContain("role=\"switch\"");
    expect(markup).toContain("aria-checked=\"true\"");
    expect(markup).toContain("aria-checked=\"false\"");
  });

  it("renders semantic state, badge, metric, icon, and header components", () => {
    const markup = renderToStaticMarkup(
      <div>
        <PageHeader title="Scan" description="Review local files" meta={<span>Local only</span>} actions={<button>Run</button>} />
        <NoticeBanner tone="warning" title="Needs review" action={<button>Fix</button>}>
          Check paths before moving files.
        </NoticeBanner>
        <StateBlock title="Nothing scanned" description="Choose a folder first." primaryAction={<button>Choose</button>} />
        <MetricCard label="Files" value="1,204" hint="Indexed" tone="blue" />
        <ToneBadge tone="success">Safe</ToneBadge>
        <IconButton aria-label="Reveal">R</IconButton>
      </div>
    );

    expect(markup).toContain("<header");
    expect(markup).toContain("Scan");
    expect(markup).toContain("role=\"status\"");
    expect(markup).toContain("Needs review");
    expect(markup).toContain("Nothing scanned");
    expect(markup).toContain("1,204");
    expect(markup).not.toContain("bg-blue-500");
    expect(markup).not.toContain("text-blue-600");
    expect(markup).toContain("aria-label=\"Reveal\"");
  });
});
