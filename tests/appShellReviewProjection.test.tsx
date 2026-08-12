// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LayoutGrid } from "lucide-react";
import { ChromeProvider } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { useAIProcessingModeStore } from "../src/store/useAIProcessingModeStore";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import { Sidebar } from "../src/components/AppShell";
import type { OrganizationPlan } from "../src/types/domain";

const t = makeTranslator("zh");
const chrome = {
  view: "scanner",
  setView: vi.fn(),
  t
} as any;
const groups = [{
  id: "primary",
  label: "主要",
  items: [{ id: "organize", label: "整理文件", icon: LayoutGrid }]
}] as any;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function plan(id: string, pendingReview: number, effectiveSummary: OrganizationPlan["effectiveSummary"] = null) {
  return {
    id,
    title: id,
    status: "ready",
    summary: { pendingReview },
    effectiveSummary,
    updatedAt: id === "newer" ? 2 : 1
  } as unknown as OrganizationPlan;
}

describe("AppShell durable Organization Plan review projection", () => {
  beforeEach(() => {
    useOrganizationPlanStore.setState({ activePlan: null, plans: [] });
    useAIProcessingModeStore.setState({ status: "ready", settings: { enabled: false, provider: "ollama" }, error: "" });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it("mounts the Sidebar badge from the same selector when the newer plan is zero", async () => {
    const newerZero = plan("newer", 0, { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 });
    const olderPending = plan("older", 5);
    useOrganizationPlanStore.setState({ plans: [newerZero, olderPending], activePlan: newerZero });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(ChromeProvider, { value: chrome, children: createElement(Sidebar, { groups }) }));
    });

    const badge = container.querySelector<HTMLElement>("[aria-label='5 项整理建议待处理']");
    expect(badge?.textContent).toBe("5");
  });
});
