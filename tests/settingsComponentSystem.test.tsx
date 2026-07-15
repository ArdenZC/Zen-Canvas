// @vitest-environment happy-dom

import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SettingsEmptyState,
  SettingsInlineMessage,
  SettingsLayout,
  SettingsSection,
  SettingsSectionNav,
  SettingsSegmentedControl,
  SettingsDisclosure,
  SettingsSwitch,
  SettingsSwitchControl,
  scrollSettingsSectionIntoView
} from "../src/views/settings/components/SettingsPrimitives";
import { SettingsSecretField } from "../src/views/settings/components/SettingsSecretField";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => undefined;
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("settings component system", () => {
  it("keeps segmented controls as roving, arrow-key radio groups", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("light");
      return (
        <SettingsSegmentedControl
          value={value}
          ariaLabel="Theme"
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" }
          ]}
          onChange={(next) => { onChange(next); setValue(next); }}
        />
      );
    }

    await act(async () => {
      root.render(<Harness />);
    });

    const group = container.querySelector('[role="radiogroup"]');
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(group?.getAttribute("aria-label")).toBe("Theme");
    expect(radios).toHaveLength(3);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(radios[0].tabIndex).toBe(0);
    expect(radios[1].tabIndex).toBe(-1);

    await act(async () => {
      radios[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("dark");
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios[1]);
  });

  it("activates the native switch exactly once from its track, thumb, and visible label", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return <SettingsSwitch id="scan-root" label="Scan folder" checked={checked} onChange={(next) => { onChange(next); setChecked(next); }} />;
    }

    await act(async () => {
      root.render(<Harness />);
    });

    const input = container.querySelector<HTMLInputElement>('[role="switch"]');
    const track = container.querySelector<HTMLElement>("[data-settings-switch-track]");
    const thumb = container.querySelector<HTMLElement>("[data-settings-switch-thumb]");
    const visibleLabel = container.querySelector<HTMLLabelElement>('label[for="scan-root"]:not([data-settings-switch-control])');
    expect(input).not.toBeNull();
    expect(input?.getAttribute("aria-label")).toBe("Scan folder");
    expect(input?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toBe("Scan folder");
    expect(container.textContent).not.toMatch(/\b(On|Off)\b/);

    await act(async () => track?.click());
    expect(onChange).toHaveBeenCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input?.getAttribute("aria-checked")).toBe("true");

    await act(async () => thumb?.click());
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);

    await act(async () => visibleLabel?.click());
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("keeps a disabled switch inert from both track and label", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<SettingsSwitch id="disabled-root" label="Disabled folder" checked={false} disabled onChange={onChange} />);
    });

    const track = container.querySelector<HTMLElement>("[data-settings-switch-track]");
    const visibleLabel = container.querySelector<HTMLLabelElement>('label[for="disabled-root"]:not([data-settings-switch-control])');
    await act(async () => {
      track?.click();
      visibleLabel?.click();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('[role="switch"]')?.disabled).toBe(true);
  });

  it("keeps switch labels clickable and advanced disclosures collapsed by default", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <>
          <SettingsSwitch id="developer-mode" label="Developer mode" checked={false} onChange={onChange} />
          <SettingsDisclosure title="Advanced settings" description="Developer only">
            <button type="button">Advanced action</button>
          </SettingsDisclosure>
        </>
      );
    });

    const label = container.querySelector<HTMLLabelElement>('label[for="developer-mode"]');
    const details = container.querySelector<HTMLDetailsElement>("details");
    expect(label).not.toBeNull();
    expect(details?.open).toBe(false);

    await act(async () => {
      label?.click();
      container.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(true);
    expect(details?.open).toBe(true);
  });

  it("keeps section navigation keyboard reachable with one active item", async () => {
    function Harness() {
      const [activeSectionId, setActiveSectionId] = useState("general");
      return (
        <SettingsSectionNav
          sections={[{ id: "general", label: "General" }, { id: "appearance", label: "Appearance" }]}
          activeSectionId={activeSectionId}
          sectionLabel="Sections"
          onSectionChange={(sectionId) => setActiveSectionId(sectionId)}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-settings-section]")];
    expect(buttons[0].getAttribute("aria-current")).toBe("location");
    expect(buttons[0].tabIndex).toBe(0);
    expect(buttons[1].tabIndex).toBe(-1);

    await act(async () => {
      buttons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(buttons[1].getAttribute("aria-current")).toBe("location");
    expect(buttons[1].tabIndex).toBe(0);
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("scrolls section content for arrow, Home, and End navigation while keeping focus in the nav", async () => {
    const sectionIds = ["general", "appearance", "ai"];
    function Harness() {
      const [activeSectionId, setActiveSectionId] = useState("general");
      const scrollRef = useRef<HTMLDivElement | null>(null);
      const navigate = (sectionId: string, options?: { focusContent?: boolean }) => {
        setActiveSectionId(sectionId);
        window.requestAnimationFrame(() => scrollSettingsSectionIntoView(scrollRef.current, sectionId, options));
      };
      return (
        <SettingsLayout
          sections={sectionIds.map((id) => ({ id, label: id }))}
          activeSectionId={activeSectionId}
          sectionLabel="Sections"
          onSectionChange={navigate}
          scrollRef={scrollRef}
        >
          {sectionIds.map((id) => <SettingsSection key={id} id={id} title={id}>{id} content</SettingsSection>)}
        </SettingsLayout>
      );
    }

    await act(async () => root.render(<Harness />));
    const scrollOwner = container.querySelector<HTMLElement>("[data-settings-scroll-container]")!;
    const navShell = container.querySelector<HTMLElement>("[data-settings-section-nav-shell]")!;
    Object.defineProperties(scrollOwner, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1600 }
    });
    scrollOwner.getBoundingClientRect = () => ({ top: 0, left: 0, width: 900, height: 400, right: 900, bottom: 400, x: 0, y: 0, toJSON() { return {}; } } as DOMRect);
    navShell.getBoundingClientRect = () => ({ top: 0, left: 0, width: 900, height: 40, right: 900, bottom: 40, x: 0, y: 0, toJSON() { return {}; } } as DOMRect);
    sectionIds.forEach((id, index) => {
      const section = container.querySelector<HTMLElement>(`#${id}`)!;
      section.getBoundingClientRect = () => {
        const top = 48 + index * 500 - scrollOwner.scrollTop;
        return { top, left: 0, width: 800, height: 400, right: 800, bottom: top + 400, x: 0, y: top, toJSON() { return {}; } } as DOMRect;
      };
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("[data-settings-section]")];
    buttons()[0].focus();
    await act(async () => buttons()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(scrollOwner.scrollTop).toBe(500);
    expect(buttons()[1].getAttribute("aria-current")).toBe("location");
    expect(document.activeElement).toBe(buttons()[1]);

    await act(async () => buttons()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect(scrollOwner.scrollTop).toBe(1000);
    expect(document.activeElement).toBe(buttons()[2]);

    await act(async () => buttons()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(scrollOwner.scrollTop).toBe(0);
    expect(document.activeElement).toBe(buttons()[0]);

    await act(async () => buttons()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })));
    expect(scrollOwner.scrollTop).toBe(1000);
    expect(document.activeElement).toBe(buttons()[2]);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it("scrolls and focuses the target heading for mouse section navigation", async () => {
    function Harness() {
      const [activeSectionId, setActiveSectionId] = useState("general");
      const scrollRef = useRef<HTMLDivElement | null>(null);
      return (
        <SettingsLayout
          sections={[{ id: "general", label: "General" }, { id: "ai", label: "AI" }]}
          activeSectionId={activeSectionId}
          sectionLabel="Sections"
          onSectionChange={(sectionId, options) => {
            setActiveSectionId(sectionId);
            window.requestAnimationFrame(() => scrollSettingsSectionIntoView(scrollRef.current, sectionId, options));
          }}
          scrollRef={scrollRef}
        >
          <SettingsSection id="general" title="General">General</SettingsSection>
          <SettingsSection id="ai" title="AI">AI</SettingsSection>
        </SettingsLayout>
      );
    }

    await act(async () => root.render(<Harness />));
    const scrollOwner = container.querySelector<HTMLElement>("[data-settings-scroll-container]")!;
    const navShell = container.querySelector<HTMLElement>("[data-settings-section-nav-shell]")!;
    scrollOwner.getBoundingClientRect = () => ({ top: 0, left: 0, width: 900, height: 400, right: 900, bottom: 400, x: 0, y: 0, toJSON() { return {}; } } as DOMRect);
    navShell.getBoundingClientRect = () => ({ top: 0, left: 0, width: 900, height: 40, right: 900, bottom: 40, x: 0, y: 0, toJSON() { return {}; } } as DOMRect);
    const aiSection = container.querySelector<HTMLElement>("#ai")!;
    aiSection.getBoundingClientRect = () => ({ top: 548 - scrollOwner.scrollTop, left: 0, width: 800, height: 400, right: 800, bottom: 948 - scrollOwner.scrollTop, x: 0, y: 548 - scrollOwner.scrollTop, toJSON() { return {}; } } as DOMRect);

    await act(async () => container.querySelector<HTMLButtonElement>('[data-settings-section="ai"]')?.click());
    expect(scrollOwner.scrollTop).toBe(500);
    expect(container.querySelector('[data-settings-section="ai"]')?.getAttribute("aria-current")).toBe("location");
    expect(document.activeElement).toBe(container.querySelector("#ai-heading"));
  });

  it("keeps disabled segmented controls inert and correctly exposed", async () => {
    const onChange = vi.fn();
    await act(async () => root.render(
      <SettingsSegmentedControl value="off" ariaLabel="AI mode" disabled options={[{ value: "off", label: "Off" }, { value: "cloud", label: "Cloud" }]} onChange={onChange} />
    ));
    const group = container.querySelector('[role="radiogroup"]');
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(group?.getAttribute("aria-disabled")).toBe("true");
    expect(radios.every((radio) => radio.disabled && radio.tabIndex === -1)).toBe(true);
    await act(async () => {
      radios[0].click();
      radios[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses live-region roles only when explicitly requested", async () => {
    await act(async () => root.render(
      <>
        <SettingsInlineMessage>Static guidance</SettingsInlineMessage>
        <SettingsInlineMessage role="status">Saved</SettingsInlineMessage>
        <SettingsInlineMessage role="alert" tone="warning">Failed</SettingsInlineMessage>
      </>
    ));
    const messages = [...container.querySelectorAll<HTMLElement>("div")].filter((element) => ["Static guidance", "Saved", "Failed"].includes(element.textContent ?? ""));
    expect(messages[0].hasAttribute("role")).toBe(false);
    expect(messages[1].getAttribute("role")).toBe("status");
    expect(messages[2].getAttribute("role")).toBe("alert");
  });

  it("reveals and hides API keys locally without exposing the value in text nodes", async () => {
    const secret = "TEST_SECRET_DO_NOT_EXPOSE";
    const onChange = vi.fn();
    await act(async () => root.render(
      <SettingsSecretField id="api-key" label="API key" value={secret} showLabel="Show API key" hideLabel="Hide API key" onChange={onChange} />
    ));
    const input = container.querySelector<HTMLInputElement>("#api-key")!;
    const toggle = container.querySelector<HTMLButtonElement>("[data-settings-secret-toggle]")!;
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).not.toContain(secret);
    await act(async () => toggle.click());
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Hide API key");
    await act(async () => toggle.click());
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await act(async () => root.render(
      <SettingsSecretField id="api-key" label="API key" value={secret} showLabel="Show API key" hideLabel="Hide API key" disabled onChange={onChange} />
    ));
    const disabledToggle = container.querySelector<HTMLButtonElement>("[data-settings-secret-toggle]")!;
    expect(disabledToggle.disabled).toBe(true);
    await act(async () => disabledToggle.click());
    expect(container.querySelector<HTMLInputElement>("#api-key")?.type).toBe("password");
  });

  it("renders a single scroll owner and an empty-state primary action", async () => {
    await act(async () => {
      root.render(
        <SettingsLayout
          sections={[{ id: "general", label: "General" }]}
          activeSectionId="general"
          sectionLabel="Sections"
          onSectionChange={vi.fn()}
        >
          <section id="general">General</section>
          <SettingsEmptyState title="No scan roots" description="Add a folder to begin." action={<button type="button">Add folder</button>} />
        </SettingsLayout>
      );
    });

    expect(container.querySelectorAll("[data-settings-scroll-container]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-settings-section-nav]")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.querySelector('[data-settings-section-nav]')?.textContent).toContain("General");
    expect(container.querySelector('[data-settings-scroll-container]')?.textContent).toContain("Add folder");
  });
});
