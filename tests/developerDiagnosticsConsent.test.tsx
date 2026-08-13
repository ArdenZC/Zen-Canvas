// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import { DeveloperDiagnosticsSection } from "../src/views/settings/sections/DeveloperDiagnosticsSection";

let container: HTMLDivElement;
let root: Root;

function renderSection(overrides: Partial<React.ComponentProps<typeof DeveloperDiagnosticsSection>> = {}) {
  const props: React.ComponentProps<typeof DeveloperDiagnosticsSection> = {
    t: makeTranslator("en"),
    diagnosticsMode: "off",
    onDiagnosticsMode: vi.fn(),
    includeSensitiveDocumentContentInDiagnostics: false,
    onIncludeSensitiveDocumentContentInDiagnostics: vi.fn(),
    aiTraces: [],
    isLoadingAITraces: false,
    onRefreshAITraces: vi.fn(),
    onExportAITraces: vi.fn(),
    onClearAITraces: vi.fn(),
    developerMode: true,
    aiDebugAvailable: false,
    selectedLibraryFile: undefined,
    aiDebugTarget: "",
    onAiDebugTarget: vi.fn(),
    aiDependentControlsDisabled: false,
    isDebuggingAI: false,
    aiDebugStatus: null,
    aiDebugResult: null,
    apiKey: "",
    onUseSelectedFile: vi.fn(),
    onDebug: vi.fn(),
    ...overrides
  };
  act(() => root.render(<DeveloperDiagnosticsSection {...props} />));
  return props;
}

function button(label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label);
}

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

describe("developer diagnostics consent", () => {
  it("requires a session confirmation before inspecting traces", async () => {
    const props = renderSection();
    const refresh = props.onRefreshAITraces as ReturnType<typeof vi.fn>;

    await act(async () => button("Open recent requests")?.click());
    expect(refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    await act(async () => button("Confirm and continue")?.click());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.querySelector("[data-settings-disclosure]") ?? container.querySelector("details")).not.toBeNull();
  });

  it("requires the same confirmation before enabling document-content diagnostics", async () => {
    const props = renderSection();
    const onSensitive = props.onIncludeSensitiveDocumentContentInDiagnostics as ReturnType<typeof vi.fn>;
    const track = container.querySelector<HTMLElement>('[data-settings-switch-track]');

    await act(async () => track?.click());
    expect(onSensitive).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    await act(async () => button("Confirm and continue")?.click());
    expect(onSensitive).toHaveBeenCalledWith(true);
  });

  it("does not render trace controls until Developer mode is enabled", () => {
    renderSection({ developerMode: false });

    expect(container.querySelector("#settings-ai-diagnostics-mode")).toBeNull();
    expect(container.textContent).toContain("Turn on Developer mode explicitly before opening diagnostics.");
    expect(button("Open recent requests")).toBeUndefined();
  });
});
