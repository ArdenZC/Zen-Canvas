import { AlertTriangle, ArrowRight, CheckCircle2, FolderSearch, LoaderCircle, RefreshCw, ScanSearch, Sparkles, X } from "lucide-react";
import type { Translator } from "../../types/ui";
import { buttonSecondary, cn, glassButtonPrimary, buttonGhost } from "../../utils/tw";
import { formatBytes } from "../../utils/format";
import type { OverviewPriorityTaskModel } from "./overviewModel";

export function OverviewPriorityTask({
  task,
  t,
  onPrimary,
  onChooseFolder,
  onCancel
}: {
  task: OverviewPriorityTaskModel;
  t: Translator;
  onPrimary: () => void;
  onChooseFolder: () => void;
  onCancel: () => void;
}) {
  const content = priorityContent(task, t);
  const Icon = content.icon;
  const showChooseFolder = task.kind === "unindexed"
    || task.kind === "update"
    || task.kind === "scan-failed"
    || task.kind === "scan-permission"
    || task.kind === "scan-canceled";
  return (
    <section className="grid gap-5 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] p-5" aria-labelledby="overview-priority-title">
      <div className="flex min-w-0 items-start gap-4">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[var(--zc-radius-control)]", content.iconClass)} aria-hidden="true">
          <Icon size={22} className={task.kind === "scan-active" ? "animate-spin motion-reduce:animate-none" : ""} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{task.kind === "orderly" ? t("overviewCurrentStatusLabel") : t("overviewPriorityLabel")}</span>
          <h2 id="overview-priority-title" className="mt-1 text-xl font-semibold text-[var(--zc-text-primary)]">{content.title}</h2>
          <p className="mt-1 min-w-0 max-w-full break-words text-sm leading-6 text-[var(--zc-text-secondary)] [overflow-wrap:anywhere]">
            {content.description}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button data-overview-primary="true" className={glassButtonPrimary} onClick={onPrimary}>
          <span>{content.primaryLabel}</span>
          <ArrowRight size={17} />
        </button>
        {showChooseFolder ? (
          <button className={buttonSecondary} onClick={onChooseFolder}>
            <FolderSearch size={17} />
            <span>{t("overviewChooseFolder")}</span>
          </button>
        ) : null}
        {task.kind === "scan-active" ? (
          <button className={buttonGhost} onClick={onCancel}>
            <X size={17} />
            <span>{t("cancelScan")}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function priorityContent(task: OverviewPriorityTaskModel, t: Translator) {
  if (task.kind === "scan-permission") return {
    icon: AlertTriangle,
    iconClass: "bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]",
    title: t("overviewTaskPermission"),
    description: task.error || t("overviewTaskPermissionDesc"),
    primaryLabel: t("overviewRetryScan")
  };
  if (task.kind === "scan-failed") return {
    icon: AlertTriangle,
    iconClass: "bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]",
    title: t("overviewTaskScanFailed"),
    description: task.error || t("overviewTaskScanFailedDesc"),
    primaryLabel: t("overviewRetryScan")
  };
  if (task.kind === "scan-active") return {
    icon: LoaderCircle,
    iconClass: "bg-[var(--zc-info-soft)] text-[var(--zc-info-text)]",
    title: t("overviewTaskScanning"),
    description: t("overviewTaskScanningDesc")
      .replace("{count}", (task.fileCount ?? 0).toLocaleString())
      .replace("{path}", task.path || t("overviewCurrentLocation")),
    primaryLabel: t("overviewViewProgress")
  };
  if (task.kind === "scan-canceling") return {
    icon: LoaderCircle,
    iconClass: "bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]",
    title: t("overviewTaskCanceling"),
    description: t("overviewTaskCancelingDesc").replace("{count}", (task.fileCount ?? 0).toLocaleString()),
    primaryLabel: t("overviewViewProgress")
  };
  if (task.kind === "scan-canceled") return {
    icon: X,
    iconClass: "bg-[var(--zc-neutral-soft)] text-[var(--zc-neutral-text)]",
    title: t("overviewTaskCanceled"),
    description: t("overviewTaskCanceledDesc").replace("{count}", (task.fileCount ?? 0).toLocaleString()),
    primaryLabel: t("overviewRetryScan")
  };
  if (task.kind === "scan-partial") return {
    icon: AlertTriangle,
    iconClass: "bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]",
    title: t("overviewTaskPartial"),
    description: t("overviewTaskPartialDesc")
      .replace("{files}", (task.fileCount ?? 0).toLocaleString())
      .replace("{errors}", (task.count ?? 0).toLocaleString()),
    primaryLabel: t("overviewViewFailures")
  };
  if (task.kind === "review") return {
    icon: Sparkles,
    iconClass: "bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]",
    title: t("overviewTaskReview").replace("{count}", (task.count ?? 0).toLocaleString()),
    description: t("overviewTaskReviewDesc"),
    primaryLabel: t("overviewViewSuggestions")
  };
  if (task.kind === "cleanup") return {
    icon: ScanSearch,
    iconClass: "bg-[var(--zc-success-soft)] text-[var(--zc-success-text)]",
    title: t("overviewTaskCleanup").replace("{count}", (task.count ?? 0).toLocaleString()),
    description: t("overviewTaskCleanupDesc").replace("{size}", formatBytes(task.bytes ?? 0)),
    primaryLabel: t("overviewViewCleanup")
  };
  if (task.kind === "unindexed") return {
    icon: ScanSearch,
    iconClass: "bg-[var(--zc-info-soft)] text-[var(--zc-info-text)]",
    title: t("overviewTaskUnindexed"),
    description: t("overviewTaskUnindexedDesc"),
    primaryLabel: t("overviewStartScan")
  };
  if (task.kind === "update") return {
    icon: RefreshCw,
    iconClass: "bg-[var(--zc-info-soft)] text-[var(--zc-info-text)]",
    title: t("overviewTaskUpdate"),
    description: t("overviewTaskUpdateDesc"),
    primaryLabel: t("overviewCheckUpdates")
  };
  return {
    icon: CheckCircle2,
    iconClass: "bg-[var(--zc-success-soft)] text-[var(--zc-success-text)]",
    title: t("overviewTaskOrderly"),
    description: t("overviewTaskOrderlyDesc").replace("{count}", (task.fileCount ?? 0).toLocaleString()),
    primaryLabel: t("overviewScanNewLocation")
  };
}
