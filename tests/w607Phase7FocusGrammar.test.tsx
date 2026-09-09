import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../src/components/ui/Button";
import {
  cn,
  dangerFocusVisibleState,
  focusVisibleState,
  primaryFocusVisibleState,
  selectedFocusVisibleState,
  selectedSurface,
  warningFocusVisibleState,
  buttonSecondary,
  glassButtonDanger,
  glassButtonPrimary,
  glassButtonWarning
} from "../src/utils/tw";
import { organizeSuggestionRowState } from "../src/views/organize/OrganizeSuggestionList";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("W6-07 Phase 7 role-aware focus grammar", () => {
  it("renders ordinary, selected, and primary focus roles without collapsing them", () => {
    const ordinaryMarkup = renderToStaticMarkup(<Button variant="secondary">Ordinary</Button>);
    const primaryMarkup = renderToStaticMarkup(<Button variant="primary">Primary</Button>);
    const dangerMarkup = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
    const warningMarkup = renderToStaticMarkup(<Button variant="warning">Review</Button>);
    const selectedMarkup = renderToStaticMarkup(
      <button className={cn(buttonSecondary, selectedSurface, selectedFocusVisibleState)} aria-pressed="true">
        Selected
      </button>
    );

    expect(ordinaryMarkup).toContain("zc-focus-visible");
    expect(ordinaryMarkup).not.toContain("zc-primary-focus-visible");
    expect(primaryMarkup).toContain("zc-primary-focus-visible");
    expect(primaryMarkup).not.toContain("zc-focus-visible");
    expect(dangerMarkup).toContain("zc-danger-focus-visible");
    expect(dangerMarkup).not.toContain("zc-focus-visible");
    expect(warningMarkup).toContain("zc-warning-focus-visible");
    expect(warningMarkup).not.toContain("zc-focus-visible");
    expect(selectedMarkup).toContain("zc-selected-surface");
    expect(selectedMarkup).toContain("zc-selected-focus-visible");
  });

  it("keeps active-descendant presentation separate from batch selection", () => {
    const idle = organizeSuggestionRowState(false, false);
    const selected = organizeSuggestionRowState(false, true);
    const active = organizeSuggestionRowState(true, false);
    const activeAndSelected = organizeSuggestionRowState(true, true);

    expect(idle).toBe("");
    expect(selected).toContain("zc-selected-surface");
    expect(selected).not.toContain("zc-focus-active-surface");
    expect(active).toContain("zc-focus-active-surface");
    expect(active).not.toContain("zc-selected-surface");
    expect(activeAndSelected).toContain("zc-selected-focus-surface");
  });

  it("provides a canonical system focus fallback for every required role", () => {
    const styles = read("src/styles.css");

    expect(styles).toContain("@media (forced-colors: active)");
    for (const hook of [
      ".zc-focus-visible:focus-visible",
      ".zc-selected-focus-visible:focus-visible",
      ".zc-primary-focus-visible:focus-visible",
      ".zc-danger-focus-visible:focus-visible",
      ".zc-warning-focus-visible:focus-visible",
      ".zc-focus-within:focus-within",
      "summary:focus-visible"
    ]) {
      expect(styles).toContain(hook);
    }
    expect(styles).toContain("outline: 2px solid CanvasText");
    expect(styles).toContain("outline: 2px double Highlight");
    expect(focusVisibleState).toContain("zc-focus-visible");
    expect(selectedFocusVisibleState).toContain("zc-selected-focus-visible");
    expect(primaryFocusVisibleState).toContain("zc-primary-focus-visible");
    expect(dangerFocusVisibleState).toContain("zc-danger-focus-visible");
    expect(warningFocusVisibleState).toContain("zc-warning-focus-visible");
    expect(glassButtonPrimary).not.toContain("zc-focus-visible");
    expect(glassButtonDanger).not.toContain("zc-focus-visible");
    expect(glassButtonWarning).not.toContain("zc-focus-visible");
  });
});
