// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import { AutomationSettingsSection } from "../src/views/settings/sections/AutomationSettingsSection";

describe("Automation Settings entry", () => {
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="test-root"></div>';
    root = createRoot(document.getElementById("test-root")!);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  it("keeps the review-required Intent description and invokes only the canonical Automation entry", async () => {
    const openAutomation = vi.fn();
    await act(async () => root.render(
      <AutomationSettingsSection t={makeTranslator("en")} onOpenAutomation={openAutomation} />
    ));

    expect(document.body.textContent).toContain("Review required");
    expect(document.body.textContent).toContain("prepare review plans");
    const automationButton = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Automation")!;
    await act(async () => automationButton.click());
    expect(openAutomation).toHaveBeenCalledOnce();
  });
});
