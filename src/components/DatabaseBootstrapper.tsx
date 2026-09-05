import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { tauriApi } from "../api/tauriApi";
import { makeTranslator } from "../i18n";
import { maturityCopy } from "../i18n/maturityCopy";
import { useAppStore } from "../store/useAppStore";
import { buttonSecondary, cn, floatingSurface, glassButtonPrimary } from "../utils/tw";
import { readableError } from "../utils/viewHelpers";
import { BrandMark } from "./ui/BrandMark";

export const DATABASE_BOOTSTRAP_LOADING_DELAY_MS = 350;

export function DatabaseBootstrapper({ children }: { children: ReactNode }) {
  const isSearchWindowMode = new URLSearchParams(window.location.search).get("mode") === "search";
  const language = useAppStore((state) => state.language);
  const t = useMemo(() => makeTranslator(language), [language]);
  const copy = useMemo(() => maturityCopy(language), [language]);
  const [databaseError, setDatabaseError] = useState("");
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTimer: number | undefined;

    if (isSearchWindowMode) {
      setDatabaseError("");
      setShowLoading(false);
      setIsDatabaseReady(true);
      return () => {
        cancelled = true;
      };
    }

    setDatabaseError("");
    setIsDatabaseReady(false);
    setShowLoading(false);
    loadingTimer = window.setTimeout(() => {
      if (!cancelled) setShowLoading(true);
    }, DATABASE_BOOTSTRAP_LOADING_DELAY_MS);

    async function initializeDatabase() {
      try {
        await tauriApi.initDatabase();
        if (cancelled) return;
        if (loadingTimer !== undefined) window.clearTimeout(loadingTimer);
        setDatabaseError("");
        setShowLoading(false);
        setIsDatabaseReady(true);
      } catch (error) {
        if (cancelled) return;
        if (loadingTimer !== undefined) window.clearTimeout(loadingTimer);
        setIsDatabaseReady(false);
        setShowLoading(false);
        setDatabaseError(readableError(error));
      }
    }

    void initializeDatabase();

    return () => {
      cancelled = true;
      if (loadingTimer !== undefined) window.clearTimeout(loadingTimer);
    };
  }, [attempt, isSearchWindowMode]);

  if (databaseError) {
    return (
      <DatabaseUnavailableState
        title={t("databaseUnavailable")}
        description={copy.databaseDescription}
        technicalError={databaseError}
        retryLabel={copy.retry}
        troubleshootingLabel={copy.troubleshooting}
        troubleshootingDescription={copy.troubleshootingDescription}
        technicalDetailsLabel={copy.technicalDetails}
        onRetry={() => setAttempt((current) => current + 1)}
      />
    );
  }

  if (!isDatabaseReady) {
    return showLoading ? <DatabaseLoadingState title={copy.startupLoadingTitle} description={copy.startupLoadingDescription} /> : null;
  }

  return <>{children}</>;
}

function BootstrapFrame({ children }: { children: ReactNode }) {
  return (
    <main className="grid h-screen min-h-[520px] place-items-center bg-[var(--zc-canvas)] px-6 text-[var(--zc-text-primary)]">
      <section className={cn(floatingSurface, "grid w-full max-w-lg gap-5 p-6 text-center")}>
        {children}
      </section>
    </main>
  );
}

function DatabaseLoadingState({ title, description }: { title: string; description: string }) {
  return (
    <BootstrapFrame>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--zc-surface-selected)]">
        <LoaderCircle size={22} className="animate-spin text-[var(--zc-primary)]" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--zc-text-secondary)]">{description}</p>
      </div>
    </BootstrapFrame>
  );
}

function DatabaseUnavailableState({
  title,
  description,
  technicalError,
  retryLabel,
  troubleshootingLabel,
  troubleshootingDescription,
  technicalDetailsLabel,
  onRetry
}: {
  title: string;
  description: string;
  technicalError: string;
  retryLabel: string;
  troubleshootingLabel: string;
  troubleshootingDescription: string;
  technicalDetailsLabel: string;
  onRetry: () => void;
}) {
  return (
    <BootstrapFrame>
      <BrandMark size="app" decorative />
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--zc-text-secondary)]">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={glassButtonPrimary} onClick={onRetry}>{retryLabel}</button>
      </div>
      <div className="grid gap-2 text-left">
        <details className="rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">{troubleshootingLabel}</summary>
          <p className="mt-2 text-sm leading-6 text-[var(--zc-text-secondary)]">{troubleshootingDescription}</p>
        </details>
        <details className="rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] px-3 py-2" data-database-technical-details>
          <summary className={cn(buttonSecondary, "min-h-0 cursor-pointer justify-start border-0 bg-transparent p-0 shadow-none")}>{technicalDetailsLabel}</summary>
          <code className="mt-2 block break-all text-xs leading-5 text-[var(--zc-text-tertiary)]">{technicalError}</code>
        </details>
      </div>
    </BootstrapFrame>
  );
}
