// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_SECTION_EVENT } from "../src/components/spotlight/commandRegistry";
import { makeTranslator } from "../src/i18n";
import type { AIProductFeatureReadiness, AIProviderReadiness, AIReadinessState } from "../src/types/domain";
import type { View } from "../src/types/ui";
import { AIReadinessNotice, organizationPlanReadiness } from "../src/views/shared/AIReadinessNotice";

const t = makeTranslator("zh");
const disclosure = {
  providerPayloadIncludesFileName: false,
  providerPayloadIncludesParentPath: false,
  providerPayloadIncludesFullPath: false,
  providerPayloadIncludesFileContent: false,
  providerContentIsBounded: true
};

function provider(state: AIReadinessState, reason: string, providerMode: "local" | "cloud" = "cloud"): AIProviderReadiness {
  return {
    state,
    reason,
    providerMode,
    providerKind: providerMode === "local" ? "ollama" : "openai_compatible",
    providerPreset: null,
    model: state === "ready" ? "fixture-model" : null,
    credentialRequired: providerMode === "cloud",
    credentialConfigured: state === "ready" && providerMode === "cloud",
    settingsRevision: "presentation-fixture",
    bindingFingerprint: "presentation-fixture"
  };
}

function readiness(options: {
  providerState?: AIReadinessState;
  providerReason?: string;
  providerMode?: "local" | "cloud";
  managedState?: AIReadinessState;
  managedReason?: string;
  cleanupState?: AIReadinessState;
  cleanupReason?: string;
  hasManagedScope?: boolean;
} = {}): AIProductFeatureReadiness {
  const providerReadiness = provider(options.providerState ?? "ready", options.providerReason ?? "provider_configuration_ready", options.providerMode);
  const managedState = options.managedState ?? "ready";
  return {
    provider: providerReadiness,
    managedScopes: options.hasManagedScope === false ? [] : [{
      state: managedState,
      reason: options.managedReason ?? "managed_ai_ready",
      provider: providerReadiness,
      managedScopeId: "presentation-scope",
      scopeFingerprint: "presentation-scope",
      bindingFingerprint: "presentation-fixture",
      disclosure
    }],
    cleanup: {
      state: options.cleanupState ?? providerReadiness.state,
      reason: options.cleanupReason ?? providerReadiness.reason,
      provider: providerReadiness,
      cleanupAiEnabled: options.cleanupState !== "disabled",
      localAiAllowed: options.cleanupState === "ready" && options.providerMode === "local",
      cloudAiAllowed: options.cleanupState === "ready" && options.providerMode !== "local",
      bindingFingerprint: "presentation-fixture",
      disclosure
    }
  };
}

describe("AI feature readiness notice", () => {
  let root: Root;
  let host: HTMLDivElement;
  let setView: (view: View) => void;
  let onRetry: () => void;

  beforeEach(() => {
    document.body.innerHTML = '<div id="readiness-root"></div>';
    host = document.getElementById("readiness-root") as HTMLDivElement;
    root = createRoot(host);
    setView = vi.fn<(view: View) => void>();
    onRetry = vi.fn<() => void>();
    sessionStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
    sessionStorage.clear();
  });

  function renderNotice(options: {
    feature: "organize" | "cleanup";
    readiness: AIProductFeatureReadiness | null;
    planReadiness?: "no_plan" | "needs_analysis" | "ready" | "review" | "blocked" | "empty";
    loading?: boolean;
    error?: boolean;
  }) {
    act(() => root.render(createElement(AIReadinessNotice, {
      ...options,
      loading: options.loading ?? false,
      error: options.error ?? false,
      t,
      setView,
      onRetry
    })));
  }

  it("distinguishes a disconnected provider and routes recovery to provider settings", async () => {
    renderNotice({ feature: "organize", readiness: readiness({ providerState: "disabled", providerReason: "provider_disabled", hasManagedScope: false }) });
    expect(host.querySelector('[data-ai-provider-state="disabled"]')).not.toBeNull();
    expect(host.textContent).toContain(t("aiReadinessProviderDisabled"));
    const action = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(t("aiReadinessOpenSettings")));
    await act(async () => action?.click());
    expect(setView).toHaveBeenCalledWith("settings");
    expect(sessionStorage.getItem(SETTINGS_SECTION_EVENT)).toBe("settings-ai-provider");
  });

  it("distinguishes missing Managed AI scope and consent", () => {
    renderNotice({ feature: "organize", readiness: readiness({ hasManagedScope: false }) });
    expect(host.querySelector('[data-ai-managed-ready="false"]')).not.toBeNull();
    expect(host.textContent).toContain(t("aiReadinessManagedMissing"));
    expect(sessionStorage.getItem(SETTINGS_SECTION_EVENT)).toBeNull();

    renderNotice({ feature: "organize", readiness: readiness({ managedState: "needs_consent", managedReason: "managed_local_ai_consent_required" }) });
    expect(host.textContent).toContain(t("aiReadinessManagedConsent"));
  });

  it.each([
    ["needs_analysis", { needsAnalysis: 1 }, { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 }],
    ["ready", { needsAnalysis: 0 }, { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }],
    ["review", { needsAnalysis: 0 }, { ready: 0, reviewed: 0, pendingReview: 1, blocked: 0 }],
    ["blocked", { needsAnalysis: 0 }, { ready: 0, reviewed: 0, pendingReview: 0, blocked: 1 }]
  ] as const)("shows Organization Plan readiness %s alongside current AI readiness", (state, summary, effectiveSummary) => {
    expect(organizationPlanReadiness({ summary, effectiveSummary })).toBe(state);
    renderNotice({ feature: "organize", readiness: readiness(), planReadiness: state });
    expect(host.querySelector(`[data-ai-plan-readiness="${state}"]`)).not.toBeNull();
    const messageKey = state === "needs_analysis"
      ? "organizeReadinessPlanNeedsAnalysis"
      : state === "ready"
        ? "organizeReadinessPlanReady"
        : state === "review"
          ? "organizeReadinessPlanReview"
          : "organizeReadinessPlanBlocked";
    expect(host.textContent).toContain(t(messageKey));
  });

  it.each([
    ["disabled", "cleanup_ai_disabled", "cleanupReadinessDisabled", "settings-ai-cleanup"],
    ["needs_consent", "cleanup_local_ai_consent_required", "cleanupReadinessLocalConsent", "settings-ai-cleanup"],
    ["needs_consent", "cleanup_cloud_ai_consent_required", "cleanupReadinessCloudConsent", "settings-ai-cleanup"]
  ] as const)("shows separate Cleanup readiness for %s / %s", async (state, reason, messageKey, section) => {
    renderNotice({ feature: "cleanup", readiness: readiness({ cleanupState: state, cleanupReason: reason, providerMode: reason.includes("local") ? "local" : "cloud" }) });
    expect(host.querySelector(`[data-ai-cleanup-state="${state}"]`)).not.toBeNull();
    expect(host.textContent).toContain(t(messageKey));
    const action = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(t("aiReadinessOpenSettings")));
    await act(async () => action?.click());
    expect(sessionStorage.getItem(SETTINGS_SECTION_EVENT)).toBe(section);
  });

  it("offers a retry when readiness itself cannot be read", async () => {
    renderNotice({ feature: "cleanup", readiness: null, error: true });
    const retry = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(t("aiReadinessRetry")));
    await act(async () => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
