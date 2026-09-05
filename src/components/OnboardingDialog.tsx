import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, FolderOpen, LockKeyhole } from "lucide-react";
import { useI18nContext, useNavigationContext, useSettingsContext } from "../contexts/AppContexts";
import { upsertDefaultScanRoot } from "../hooks/useAppSettings";
import { maturityCopy } from "../i18n/maturityCopy";
import { cn, buttonGhost, buttonSecondary, floatingSurface, glassButtonPrimary } from "../utils/tw";
import { BrandMark } from "./ui/BrandMark";
import { ModalPortal } from "./modal/ModalPortal";

export const ONBOARDING_STORAGE_KEY = "zc-onboarding-complete";

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
    // Optional browser storage must never make the first-value flow unsafe to exit.
  }
}

export function OnboardingDialog() {
  const { t, language } = useI18nContext();
  const { view, setView, onError } = useNavigationContext();
  const { settings, isLoadingSettings, setDefaultScanFolders } = useSettingsContext();
  const copy = maturityCopy(language);
  const [openDialog, setOpenDialog] = useState(false);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const [step, setStep] = useState(0);
  const [folderAdded, setFolderAdded] = useState(false);
  const [error, setError] = useState("");
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  const configuredScanCount = settings.defaultScanFolders.filter((root) => root.enabled && root.path.trim()).length;
  const scanCount = Math.max(configuredScanCount, folderAdded ? 1 : 0);
  const hasUsefulFolder = scanCount > 0;

  useEffect(() => {
    if (isLoadingSettings || dismissedForSession) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (!hasCompletedOnboarding()) setOpenDialog(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dismissedForSession, isLoadingSettings]);

  function dismiss(markComplete: boolean) {
    if (markComplete) completeOnboarding();
    setOpenDialog(false);
    setDismissedForSession(true);
    setError("");
    setView(markComplete ? "library" : "scanner");
  }

  function reopen() {
    setStep(0);
    setError("");
    setDismissedForSession(false);
    setOpenDialog(true);
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
      setFolderAdded(true);
      setError("");
    } catch (caught) {
      const message = String(caught instanceof Error ? caught.message : caught);
      setError(message || t("onboardingSaveFailed"));
      onError?.(message || t("onboardingSaveFailed"));
    }
  }

  function nextStep() {
    setError("");
    if (step === 0) {
      setStep(1);
      return;
    }
    if (hasUsefulFolder) dismiss(true);
  }

  if (!openDialog) {
    return !isLoadingSettings && view === "scanner" ? (
      <button
        type="button"
        data-getting-started
        className={cn(buttonSecondary, "fixed bottom-5 right-5 z-40 min-h-9 px-3 text-xs shadow-[var(--zc-shadow-raised)] backdrop-blur-xl")}
        onClick={reopen}
      >
        <FolderOpen size={15} />
        {copy.onboardingRestart}
      </button>
    ) : null;
  }

  const stepLabel = copy.onboardingStep(step + 1, 2);
  const titleId = "onboarding-title";
  const descriptionId = "onboarding-description";

  return (
    <ModalPortal modalId="onboarding-dialog" initialFocusRef={primaryRef} onEscape={() => dismiss(hasUsefulFolder)}>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--zc-overlay)] p-4 backdrop-blur-sm sm:p-6">
        <section className={cn(floatingSurface, "grid max-h-[calc(100dvh-2rem)] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-5 overflow-hidden p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-7")} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandMark size="app" decorative />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--zc-primary-text)]">Zen Canvas</p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold text-[var(--zc-text-primary)]">{copy.onboardingTitle}</h2>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-[var(--zc-text-tertiary)]">{stepLabel}</span>
          </header>

          <div id={descriptionId} className="min-h-0 overflow-y-auto overscroll-contain pr-1">
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
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-2"><h3 className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("onboardingScopeTitle")}</h3><p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{t("onboardingScopeDesc")}</p></div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-4">
                  <div className="min-w-0"><strong className="block text-sm">{scanCount ? t("onboardingCurrentScope").replace("{count}", String(scanCount)) : t("onboardingNoScope")}</strong><span className="mt-1 block text-xs text-[var(--zc-text-tertiary)]">{settings.defaultScanFolders.filter((root) => root.enabled).map((root) => root.label).join("、")}</span></div>
                  <button type="button" className={buttonSecondary} onClick={() => void chooseScanFolder()}><FolderOpen size={16} />{t("onboardingChooseFolder")}</button>
                </div>
                {!hasUsefulFolder ? <p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{copy.onboardingNeedsFolder}</p> : null}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-[var(--zc-danger-text)]" role="alert">{error}</p> : null}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--zc-divider)] pt-4">
            <button type="button" className={buttonGhost} onClick={() => dismiss(hasUsefulFolder)}>{t("onboardingSkip")}</button>
            <div className="flex flex-wrap justify-end gap-2">
              {step > 0 ? <button type="button" className={buttonSecondary} onClick={() => { setError(""); setStep(0); }}>{t("onboardingBack")}</button> : null}
              <button ref={primaryRef} type="button" className={glassButtonPrimary} onClick={nextStep} disabled={step === 1 && !hasUsefulFolder}>{step === 1 ? copy.onboardingFinish : t("onboardingNext")}</button>
            </div>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}
