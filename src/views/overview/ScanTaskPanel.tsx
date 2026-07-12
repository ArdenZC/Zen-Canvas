import { AlertTriangle, CheckCircle2, Clock3, FileSearch, Folder, LoaderCircle, XCircle } from "lucide-react";
import type { ScanProgressPayload } from "../../api/tauriApi";
import type { Translator } from "../../types/ui";
import { cn } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import type { OverviewScanState } from "./overviewModel";

export function ScanTaskPanel({
  state,
  progress,
  error,
  fallbackPath,
  t
}: {
  state: OverviewScanState;
  progress: Partial<ScanProgressPayload> | null;
  error: string | null;
  fallbackPath: string;
  t: Translator;
}) {
  if (state === "first-use" || state === "idle") return null;
  const presentation = scanPresentation(state, progress, t);
  const Icon = presentation.icon;
  const path = progress?.root || fallbackPath;
  return (
    <section id="overview-scan-task" className="grid gap-3 border-t border-[var(--zc-divider)] pt-4" aria-labelledby="overview-scan-task-title" aria-live="polite">
      <div className="flex items-center gap-2">
        <Icon size={18} className={cn(presentation.iconClass, state === "scanning" || state === "canceling" ? "animate-pulse motion-reduce:animate-none" : "")} />
        <h2 id="overview-scan-task-title" className="text-sm font-semibold text-[var(--zc-text-primary)]">{presentation.title}</h2>
      </div>
      <p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{error || presentation.description}</p>
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        {path ? <ScanFact icon={Folder} label={t("overviewScanCurrentPath")} value={compactPath(formatDisplayPath(path), 54)} /> : null}
        {typeof progress?.files === "number" ? <ScanFact icon={FileSearch} label={t("overviewScanProcessed")} value={progress.files.toLocaleString()} /> : null}
        {typeof progress?.elapsedMs === "number" ? <ScanFact icon={Clock3} label={t("overviewScanElapsed")} value={formatElapsed(progress.elapsedMs)} /> : null}
        {(progress?.skipped ?? 0) > 0 ? <ScanFact icon={AlertTriangle} label={t("overviewScanSkipped")} value={(progress?.skipped ?? 0).toLocaleString()} /> : null}
        {(progress?.errors ?? 0) > 0 ? <ScanFact icon={AlertTriangle} label={t("overviewScanWarnings")} value={(progress?.errors ?? 0).toLocaleString()} /> : null}
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

function scanPresentation(state: OverviewScanState, progress: Partial<ScanProgressPayload> | null, t: Translator) {
  if (state === "scanning") return { icon: LoaderCircle, iconClass: "text-[var(--zc-info-text)]", title: t("overviewTaskScanning"), description: t("overviewScanSafeToLeave") };
  if (state === "canceling") return { icon: LoaderCircle, iconClass: "text-[var(--zc-warning-text)]", title: t("overviewTaskCanceling"), description: t("overviewTaskCancelingDesc").replace("{count}", (progress?.files ?? 0).toLocaleString()) };
  if (state === "partial") return { icon: AlertTriangle, iconClass: "text-[var(--zc-warning-text)]", title: t("overviewTaskPartial"), description: t("overviewTaskPartialDesc").replace("{files}", (progress?.files ?? 0).toLocaleString()).replace("{errors}", (progress?.errors ?? 0).toLocaleString()) };
  if (state === "failed") return { icon: XCircle, iconClass: "text-[var(--zc-danger-text)]", title: t("overviewTaskScanFailed"), description: t("overviewTaskScanFailedDesc") };
  if (state === "canceled") return { icon: XCircle, iconClass: "text-[var(--zc-neutral-text)]", title: t("overviewTaskCanceled"), description: t("scanCanceled") };
  return { icon: CheckCircle2, iconClass: "text-[var(--zc-success-text)]", title: t("overviewScanCompletedTitle"), description: t("overviewScanCompletedDesc") };
}

function formatElapsed(elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}
