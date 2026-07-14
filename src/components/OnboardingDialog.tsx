import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, FolderOpen, LockKeyhole, Sparkles } from "lucide-react";
import { tauriApi } from "../api/tauriApi";
import { useChromeContext, useSettingsContext } from "../contexts/AppContexts";
import { upsertDefaultScanRoot } from "../hooks/useAppSettings";
import { useAIProcessingModeStore } from "../store/useAIProcessingModeStore";
import type { AIProviderPreset, AISettings } from "../types/domain";
import { cn, buttonGhost, buttonSecondary, floatingSurface, glassButtonPrimary } from "../utils/tw";
import { BrandMark } from "./ui/BrandMark";
import { ModalPortal } from "./modal/ModalPortal";

export const ONBOARDING_STORAGE_KEY = "zc-onboarding-complete";

type AIModeChoice = "disabled" | "local" | "cloud";

export function hasCompletedOnboarding() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function completeOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // The dialog remains safe to dismiss even when optional browser storage is unavailable.
  }
}

export function OnboardingDialog() {
  const { t, setView, onError } = useChromeContext();
  const { settings, isLoadingSettings, setDefaultScanFolders } = useSettingsContext();
  const [openDialog, setOpenDialog] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedAI, setSelectedAI] = useState<AIModeChoice>("disabled");
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [aiPresets, setAIPresets] = useState<AIProviderPreset[]>([]);
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [error, setError] = useState("");
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isLoadingSettings) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (!hasCompletedOnboarding()) setOpenDialog(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLoadingSettings]);

  useEffect(() => {
    if (!openDialog || step !== 2) return undefined;
    let disposed = false;
    void Promise.all([tauriApi.getAISettings(), tauriApi.listAIProviderPresets()])
      .then(([current, presets]) => {
        if (disposed) return;
        setAISettings(current);
        setAIPresets(presets);
        setSelectedAI(resolveAIMode(current));
      })
      .catch(() => {
        if (!disposed) setError(t("onboardingAIUnavailable"));
      });
    return () => {
      disposed = true;
    };
  }, [openDialog, step, t]);

  function dismiss() {
    completeOnboarding();
    setOpenDialog(false);
    setView("scanner");
  }

  async function chooseScanFolder() {
    try {
      const selected = await open({ directory: true, multiple: false, title: t("onboardingChooseFolder") });
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path?.trim()) return;
      const next = upsertDefaultScanRoot(settings.defaultScanFolders, path);
      const saved = await setDefaultScanFolders(next);
      if (!saved) {
        setError(t("onboardingSaveFailed"));
        return;
      }
      setError("");
    } catch (caught) {
      const message = String(caught instanceof Error ? caught.message : caught);
      setError(message || t("onboardingSaveFailed"));
      onError?.(message || t("onboardingSaveFailed"));
    }
  }

  async function saveAIChoice() {
    if (!aiSettings || isSavingAI) return true;
    const preset = aiPresets.find((item) => selectedAI === "local" ? item.providerKind === "ollama" : item.providerKind === "openai_compatible");
    const next: AISettings = preset
      ? {
          ...aiSettings,
          enabled: selectedAI === "local",
          provider: preset.providerKind,
          preset: preset.id,
          baseUrl: preset.defaultBaseUrl,
          chatPath: preset.defaultChatPath || aiSettings.chatPath,
          model: preset.defaultModel
        }
      : { ...aiSettings, enabled: selectedAI === "local" };
    setIsSavingAI(true);
    try {
      const saved = await tauriApi.saveAISettings(next);
      setAISettings(saved);
      useAIProcessingModeStore.getState().publish({ enabled: saved.enabled, provider: saved.provider });
      return true;
    } catch {
      setError(t("onboardingSaveFailed"));
      return false;
    } finally {
      setIsSavingAI(false);
    }
  }

  async function nextStep() {
    setError("");
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    if (!(await saveAIChoice())) return;
    dismiss();
  }

  if (!openDialog) return null;

  const scanCount = settings.defaultScanFolders.filter((root) => root.enabled && root.path.trim()).length;
  const stepLabel = t("onboardingStepLabel").replace("{step}", String(step + 1));
  const titleId = "onboarding-title";
  const descriptionId = "onboarding-description";

  return (
    <ModalPortal modalId="onboarding-dialog" initialFocusRef={primaryRef} onEscape={dismiss}>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--zc-overlay)] p-4 backdrop-blur-sm sm:p-6">
        <section className={cn(floatingSurface, "grid w-full max-w-2xl gap-5 p-5 sm:p-7")} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandMark size="app" decorative />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--zc-primary-text)]">Zen Canvas</p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold text-[var(--zc-text-primary)]">{t("onboardingTitle")}</h2>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-[var(--zc-text-tertiary)]">{stepLabel}</span>
          </header>

          <div id={descriptionId} className="min-h-[220px]">
            {step === 0 ? (
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-[var(--zc-success-text)]"><LockKeyhole size={19} aria-hidden="true" /><h3 className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("onboardingPrivacyTitle")}</h3></div>
                  <p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{t("onboardingPrivacyDesc")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[t("onboardingLocalIndex"), t("onboardingPreview"), t("onboardingRestorable")].map((label) => <div key={label} className="grid gap-2 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3 text-sm"><Check size={16} className="text-[var(--zc-success-text)]" aria-hidden="true" /><span>{label}</span></div>)}
                </div>
              </div>
            ) : step === 1 ? (
              <div className="grid gap-5">
                <div className="grid gap-2"><h3 className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("onboardingScopeTitle")}</h3><p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{t("onboardingScopeDesc")}</p></div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-4">
                  <div className="min-w-0"><strong className="block text-sm">{scanCount ? t("onboardingCurrentScope").replace("{count}", String(scanCount)) : t("onboardingNoScope")}</strong><span className="mt-1 block text-xs text-[var(--zc-text-tertiary)]">{settings.defaultScanFolders.filter((root) => root.enabled).map((root) => root.label).join("、")}</span></div>
                  <button type="button" className={buttonSecondary} onClick={() => void chooseScanFolder()}><FolderOpen size={16} />{t("onboardingChooseFolder")}</button>
                </div>
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-2"><div className="flex items-center gap-2 text-[var(--zc-primary-text)]"><Sparkles size={19} aria-hidden="true" /><h3 className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("onboardingAIStepTitle")}</h3></div><p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{t("onboardingAIStepDesc")}</p></div>
                {aiSettings ? (
                  <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label={t("onboardingAIStepTitle")}>
                    {([
                      ["disabled", t("onboardingAIDisabled")],
                    ["local", t("onboardingAILocal")],
                      ["cloud", t("onboardingAICloud")]
                    ] as const).map(([value, label]) => <button key={value} type="button" className={cn("grid min-h-20 gap-1 rounded-[var(--zc-radius-field)] border p-3 text-left transition-[background,border-color,color]", selectedAI === value ? "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)]")} aria-pressed={selectedAI === value} onClick={() => setSelectedAI(value)}><strong>{label}</strong><span className="text-xs text-[var(--zc-text-tertiary)]">{value === "cloud" ? t("onboardingCloudSetup") : value === "local" ? t("onboardingLocalModelHint") : ""}</span></button>)}
                  </div>
                ) : <p className="rounded-[var(--zc-radius-field)] border border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] p-3 text-sm text-[var(--zc-warning-text)]">{t("onboardingAIUnavailable")}</p>}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-[var(--zc-danger-text)]" role="alert">{error}</p> : null}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--zc-divider)] pt-4">
            <button type="button" className={buttonGhost} onClick={dismiss}>{t("onboardingSkip")}</button>
            <div className="flex flex-wrap justify-end gap-2">
              {step > 0 ? <button type="button" className={buttonSecondary} onClick={() => { setError(""); setStep((current) => current - 1); }}>{t("onboardingBack")}</button> : null}
              <button ref={primaryRef} type="button" className={glassButtonPrimary} onClick={() => void nextStep()} disabled={isSavingAI}>{step === 2 ? t("onboardingFinish") : t("onboardingNext")}</button>
            </div>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}

function resolveAIMode(settings: AISettings): AIModeChoice {
  if (!settings.enabled) return "disabled";
  return settings.provider === "ollama" ? "local" : "cloud";
}
