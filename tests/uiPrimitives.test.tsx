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
  glassButton,
  glassButtonDanger,
  glassButtonPrimary,
  glassButtonWarning,
  infoSurface,
  inputSurface,
  selectSurface,
  statusToast,
  successSurface,
  toastTone,
  toneClasses,
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
    expect(appPanel).toContain("bg-[var(--zc-canvas-elevated)]");
    expect(appPanel).not.toContain("bg-[var(--zc-surface)]");
    expect(warningSurface).toContain("text-[var(--zc-warning-text)]");
    expect(interactiveRow({ selected: true })).not.toBe(interactiveRow());
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
    expect(buttonIconDanger).toContain("var(--zc-danger-text)");

    expect(glassButton).toContain("bg-[var(--zc-surface)]");
    expect(glassButtonPrimary).toContain("bg-[var(--zc-primary)]");
    expect(glassButtonPrimary).not.toContain("bg-[var(--zc-surface)]");
    expect(glassButtonDanger).toContain("bg-[var(--zc-danger-soft)]");
    expect(glassButtonDanger).not.toContain("bg-[var(--zc-surface)]");
    expect(glassButtonWarning).toContain("bg-[var(--zc-warning-soft)]");
    expect(glassButtonWarning).not.toContain("bg-[var(--zc-surface)]");

    for (const control of [glassButton, buttonSubtle, buttonPill, buttonIcon, inputSurface, selectSurface]) {
      expect(control).toContain("var(--zc-control-border)");
    }
    expect(contentPanel).not.toContain("var(--zc-control-border)");
  });

  it("uses semantic status tokens for badges, icon chips, and toasts", () => {
    const fixedTailwindPalette = /(?:red|blue|green|emerald|amber|slate|purple)-\d/;

    for (const tone of ["red", "purple", "green", "amber", "slate", "blue"]) {
      expect(toneClasses(tone)).toContain("var(--zc-");
      expect(toneClasses(tone)).not.toMatch(fixedTailwindPalette);
    }
    for (const type of ["success", "error", "info"] as const) {
      expect(toastTone(type)).toContain("var(--zc-");
      expect(toastTone(type)).not.toMatch(fixedTailwindPalette);
    }
    expect(statusToast).toContain("var(--zc-surface-floating)");
    expect(statusToast).toContain("var(--zc-text-secondary)");
    expect(statusToast).not.toMatch(fixedTailwindPalette);
  });

  it("renders switch controls with clear on and off status labels", () => {
    const markup = renderToStaticMarkup(
      <div>
        <SwitchButton checked label="Scan folder" statusLabel="On" onChange={() => {}} />
        <SwitchField checked={false} label="Launch at login" statusLabel="Off" onChange={() => {}} />
      </div>
    );

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
    expect(markup).not.toMatch(/(?:red|blue|green|emerald|amber|slate|purple)-\d/);
    expect(markup).toContain("aria-label=\"Reveal\"");
  });
});
