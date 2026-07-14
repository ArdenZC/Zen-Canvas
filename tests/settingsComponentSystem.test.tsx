// @vitest-environment happy-dom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SettingsEmptyState,
  SettingsLayout,
  SettingsSectionNav,
  SettingsSegmentedControl,
  SettingsDisclosure,
  SettingsSwitch,
  SettingsSwitchControl
} from "../src/views/settings/components/SettingsPrimitives";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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

  it("exposes a real switch without duplicating visible On/Off copy", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<SettingsSwitchControl id="scan-root" label="Scan folder" checked={false} onChange={onChange} />);
    });

    const input = container.querySelector<HTMLInputElement>('[role="switch"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute("aria-label")).toBe("Scan folder");
    expect(input?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toBe("");

    await act(async () => input?.click());
    expect(onChange).toHaveBeenCalledWith(true);
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
