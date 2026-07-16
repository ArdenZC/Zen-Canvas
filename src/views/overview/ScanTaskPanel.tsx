import { AlertTriangle, CheckCircle2, Clock3, FileSearch, Folder, LoaderCircle, XCircle } from "lucide-react";
import type { ScanProgressPayload } from "../../api/tauriApi";
import type { Language } from "../../i18n";
import type { Translator } from "../../types/ui";
import { cn } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import type { OverviewScanState } from "./overviewModel";

export function ScanTaskPanel({
  state,
  progress,
  error,
  fallbackPath,
  t,
  language = "zh"
}: {
  state: OverviewScanState;
  progress: Partial<ScanProgressPayload> | null;
  error: string | null;
  fallbackPath: string;
  t: Translator;
  language?: Language;
}) {
  if (state === "first-use" || state === "idle") return null;
  const phase = scanPhase(state, t);
  const Icon = phase.icon;
  const path = progress?.root || fallbackPath;
  return (
    <section id="overview-scan-task" className="grid gap-3 border-t border-[var(--zc-divider)] pt-4" aria-labelledby="overview-scan-task-title">
      <div className="flex items-center gap-2">
        <Icon size={18} className={cn(phase.iconClass, state === "scanning" || state === "canceling" ? "animate-pulse motion-reduce:animate-none" : "")} aria-hidden="true" />
        <h2 id="overview-scan-task-title" className="text-sm font-semibold text-[var(--zc-text-primary)]">{t("overviewScanDetails")}</h2>
        <span className="rounded-full bg-[var(--zc-neutral-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--zc-text-secondary)]">{phase.label}</span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{phase.announcement}</p>
      {error ? <p className="text-sm leading-6 text-[var(--zc-danger-text)]">{error}</p> : null}
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-5">
        {path ? <ScanFact icon={Folder} label={t("overviewScanCurrentPath")} value={compactPath(formatDisplayPath(path), 54)} /> : null}
        {typeof progress?.files === "number" ? <ScanFact icon={FileSearch} label={t("overviewScanProcessed")} value={progress.files.toLocaleString()} /> : null}
        {typeof progress?.elapsedMs === "number" ? <ScanFact icon={Clock3} label={t("overviewScanElapsed")} value={formatElapsed(progress.elapsedMs, language)} /> : null}
        {typeof progress?.skipped === "number" ? <ScanFact icon={AlertTriangle} label={t("overviewScanSkipped")} value={progress.skipped.toLocaleString()} /> : null}
        {typeof progress?.errors === "number" ? <ScanFact icon={AlertTriangle} label={t("overviewScanWarnings")} value={progress.errors.toLocaleString()} /> : null}
      </dl>
    </section>
  );
}

function ScanFact({ icon: Icon, label, value }: { icon: typeof Folder; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-[var(--zc-text-tertiary)]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold text-[var(--zc-text-tertiary)]">{label}</dt>
        <dd className="truncate text-sm text-[var(--zc-text-primary)]" title={value}>{value}</dd>
      </div>
    </div>
  );
}

function scanPhase(state: OverviewScanState, t: Translator) {
  if (state === "scanning") return {
    icon: LoaderCircle,
    iconClass: "text-[var(--zc-info-text)]",
    label: t("overviewScanPhaseScanning"),
    announcement: t("overviewScanPhaseScanning")
  };
  if (state === "canceling") return {
    icon: LoaderCircle,
    iconClass: "text-[var(--zc-warning-text)]",
    label: t("overviewScanPhaseCanceling"),
    announcement: t("overviewScanPhaseCanceling")
  };
  if (state === "partial") return {
    icon: AlertTriangle,
    iconClass: "text-[var(--zc-warning-text)]",
    label: t("overviewScanPhasePartial"),
    announcement: t("overviewScanPhasePartial")
  };
  if (state === "failed") return {
    icon: XCircle,
    iconClass: "text-[var(--zc-danger-text)]",
    label: t("overviewScanPhaseFailed"),
    announcement: t("overviewScanPhaseFailed")
  };
  if (state === "canceled") return {
    icon: XCircle,
    iconClass: "text-[var(--zc-neutral-text)]",
    label: t("overviewScanPhaseCanceled"),
    announcement: t("overviewScanPhaseCanceled")
  };
  return {
    icon: CheckCircle2,
    iconClass: "text-[var(--zc-success-text)]",
    label: t("overviewScanPhaseCompleted"),
    announcement: t("overviewScanPhaseCompleted")
  };
}

export function formatElapsed(elapsedMs: number, language: Language) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  if (language === "zh") {
    return [
      hours > 0 ? `${hours} 小时` : "",
      remainingMinutes > 0 ? `${remainingMinutes} 分` : "",
      remainingSeconds > 0 || (hours === 0 && remainingMinutes === 0) ? `${remainingSeconds} 秒` : ""
    ].filter(Boolean).join(" ");
  }
  return [
    hours > 0 ? `${hours}h` : "",
    remainingMinutes > 0 ? `${remainingMinutes}m` : "",
    remainingSeconds > 0 || (hours === 0 && remainingMinutes === 0) ? `${remainingSeconds}s` : ""
  ].filter(Boolean).join(" ");
}
