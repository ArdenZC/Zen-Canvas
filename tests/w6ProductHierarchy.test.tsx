// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIProcessingModeStatus } from "../src/components/AppShell";
import { makeTranslator } from "../src/i18n";
import { AboutSettingsSection } from "../src/views/settings/sections/AboutSettingsSection";
import {
  SettingsSection,
  SettingsSectionNav,
  scrollSettingsSectionIntoView,
  type SettingsSectionOption
} from "../src/views/settings/components/SettingsPrimitives";
import { settingsNavigationSectionId } from "../src/views/settings/settingsSectionModel";

const t = makeTranslator("zh");

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

describe("W6-03 product hierarchy", () => {
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

  it("keeps healthy disabled/loading AI out of persistent chrome while enabled and failed modes remain visible", () => {
    const renderState = (state: Parameters<typeof AIProcessingModeStatus>[0]["state"]) => {
      act(() => root.render(createElement(AIProcessingModeStatus, { state, t })));
    };

    renderState({ status: "loading", settings: null, error: "" });
    expect(document.querySelector("[data-ai-processing-mode]")).toBeNull();

    renderState({ status: "ready", settings: { enabled: false, provider: "openai_compatible" }, error: "" });
    expect(document.querySelector("[data-ai-processing-mode]")).toBeNull();

    renderState({ status: "ready", settings: { enabled: true, provider: "ollama" }, error: "" });
    expect(document.querySelector("[data-ai-processing-mode=local]")).toBeTruthy();

    renderState({ status: "ready", settings: { enabled: true, provider: "openai_compatible" }, error: "" });
    expect(document.querySelector("[data-ai-processing-mode=cloud]")).toBeTruthy();

    renderState({ status: "failed", settings: null, error: "provider unavailable" });
    expect(document.querySelector("[data-ai-processing-mode=failed]")).toBeTruthy();
  });

  it("removes implementation sections from ordinary settings navigation while keeping semantic compatibility mappings", () => {
    const sections: SettingsSectionOption[] = [
      ["settings-general", "General"],
      ["settings-appearance", "Appearance"],
      ["settings-files-scan", "Files"],
      ["settings-search", "Search"],
      ["settings-global-index", "Global Index"],
      ["settings-platform-diagnostics", "Platform Diagnostics"],
      ["settings-managed-scopes", "Managed Scopes"],
      ["settings-automation", "Automation"],
      ["settings-ai", "AI"],
      ["settings-privacy", "Privacy"],
      ["settings-about", "About"]
    ].map(([id, label]) => ({ id, label }));

    act(() => root.render(createElement(SettingsSectionNav, {
      sections,
      activeSectionId: "settings-general",
      onSectionChange: vi.fn(),
      sectionLabel: "Settings"
    })));

    const visibleIds = [...document.querySelectorAll<HTMLElement>("[data-settings-section]")]
      .map((node) => node.dataset.settingsSection);
    expect(visibleIds).toEqual([
      "settings-general",
      "settings-appearance",
      "settings-files-scan",
      "settings-search",
      "settings-automation",
      "settings-ai",
      "settings-privacy",
      "settings-about"
    ]);
    expect(settingsNavigationSectionId("settings-global-index")).toBe("settings-search");
    expect(settingsNavigationSectionId("settings-platform-diagnostics")).toBe("settings-search");
    expect(settingsNavigationSectionId("settings-managed-scopes")).toBe("settings-ai");
    expect(settingsNavigationSectionId("settings-search-scope")).toBe("settings-search");
  });

  it("reveals a progressively disclosed technical section when a compatibility deep link targets it", () => {
    act(() => root.render(createElement(
      "div",
      { id: "settings-scroll" },
      createElement(SettingsSection, {
        id: "settings-global-index",
        title: "Global Index",
        progressiveDisclosure: true,
        children: createElement("button", { type: "button" }, "Rebuild")
      })
    )));

    const container = document.getElementById("settings-scroll")!;
    const details = document.querySelector<HTMLDetailsElement>("details[data-settings-progressive-disclosure]")!;
    expect(details.open).toBe(false);
    scrollSettingsSectionIntoView(container, "settings-global-index", { revealContent: true });
    expect(details.open).toBe(true);
  });

  it("keeps developer build exclusions out of ordinary About until developer mode is explicitly enabled", () => {
    const renderAbout = (developerMode: boolean) => {
      act(() => root.render(createElement(AboutSettingsSection, {
        t,
        developerMode,
        onDeveloperMode: vi.fn()
      })));
    };

    renderAbout(false);
    expect(document.body.textContent).not.toContain("node_modules, .git, target, dist, build");
    expect(document.body.textContent).toContain("高级设置");

    renderAbout(true);
    expect(document.body.textContent).toContain("node_modules, .git, target, dist, build");
  });

  it("removes Automation from persistent sidebar without deleting the Rules workspace or its Settings entry", () => {
    const appShell = read("src/components/AppShell.tsx");
    const settingsView = read("src/views/settings/SettingsView.tsx");
    const automationSection = read("src/views/settings/sections/AutomationSettingsSection.tsx");
    const navGroupsSource = appShell.slice(appShell.indexOf("function navGroups"));

    expect(navGroupsSource).not.toContain('{ id: "rules", label: t("automation")');
    expect(appShell).toContain('const RulesView = lazy(() => import("../views/rules/RulesView")');
    expect(appShell).toContain('else if (view === "rules") content = <RulesView />');
    expect(settingsView).toContain('onOpenRules={() => setView("rules")}');
    expect(automationSection).toContain("onOpenRules");
  });
});
