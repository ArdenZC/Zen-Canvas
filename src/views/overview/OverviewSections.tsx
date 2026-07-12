import { AlertTriangle, BrainCircuit, ChevronRight, Clock3, FileCog, FolderSync, History } from "lucide-react";
import type { Translator } from "../../types/ui";
import { formatDate } from "../../utils/format";
import { buttonGhost, cn } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import type { OverviewActivity, OverviewBackgroundTask } from "./overviewModel";

export function OverviewSpaceSummary({ summary, t }: { summary: string; t: Translator }) {
  return (
    <section className="grid gap-1 border-y border-[var(--zc-divider)] py-4" aria-labelledby="overview-summary-title">
      <h2 id="overview-summary-title" className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("overviewSpaceSummary")}</h2>
      <p className="max-w-5xl text-sm leading-6 text-[var(--zc-text-secondary)]">{summary}</p>
    </section>
  );
}

export function OverviewRecentActivityList({ activities, t }: { activities: OverviewActivity[]; t: Translator }) {
  if (activities.length === 0) return null;
  return (
    <section className="grid gap-2" aria-labelledby="overview-activity-title">
      <h2 id="overview-activity-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{t("overviewRecentActivity")}</h2>
      <div className="divide-y divide-[var(--zc-divider)]">
        {activities.map((activity) => (
          <div key={activity.id} className="flex min-w-0 items-center gap-3 py-3">
            <span className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--zc-radius-control)]",
              activity.status === "failed" ? "bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]" : "bg-[var(--zc-neutral-soft)] text-[var(--zc-neutral-text)]"
            )} aria-hidden="true">
              {activity.status === "failed" ? <AlertTriangle size={16} /> : <History size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--zc-text-primary)]">{activity.title}</p>
              {activity.description ? <p className="truncate text-xs text-[var(--zc-text-secondary)]">{activity.description}</p> : null}
            </div>
            <time className="shrink-0 text-xs text-[var(--zc-text-tertiary)]" dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OverviewBackgroundTaskList({
  tasks,
  t,
  onRetryIndex
}: {
  tasks: OverviewBackgroundTask[];
  t: Translator;
  onRetryIndex: (path: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="grid gap-2" aria-labelledby="overview-background-title">
      <h2 id="overview-background-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{t("overviewBackgroundTasks")}</h2>
      <div className="divide-y divide-[var(--zc-divider)] border-y border-[var(--zc-divider)]">
        {tasks.map((task, index) => {
          const presentation = backgroundPresentation(task, t);
          const Icon = presentation.icon;
          return (
            <div className="flex min-w-0 items-center gap-3 py-3" key={`${task.kind}-${task.currentPath ?? index}`} role="status">
              <Icon size={17} className={presentation.iconClass} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--zc-text-primary)]">{presentation.title}</p>
                {presentation.description ? <p className="truncate text-xs text-[var(--zc-text-secondary)]">{presentation.description}</p> : null}
              </div>
              {task.kind === "background-failure" && task.currentPath ? (
                <button className={buttonGhost} onClick={() => onRetryIndex(task.currentPath!)}>
                  <span>{t("overviewRetryBackground")}</span>
                  <ChevronRight size={15} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function backgroundPresentation(task: OverviewBackgroundTask, t: Translator) {
  const path = task.currentPath ? compactPath(formatDisplayPath(task.currentPath), 64) : "";
  if (task.kind === "background-index") return {
    icon: FolderSync,
    iconClass: "animate-pulse text-[var(--zc-info-text)] motion-reduce:animate-none",
    title: t("overviewBackgroundIndexing"),
    description: [path, task.pending ? t("overviewBackgroundIndexQueue").replace("{count}", task.pending.toLocaleString()) : ""].filter(Boolean).join(" · ")
  };
  if (task.kind === "operation") return {
    icon: FileCog,
    iconClass: "text-[var(--zc-info-text)]",
    title: t("overviewBackgroundOperation"),
    description: [path, typeof task.processed === "number" && typeof task.total === "number" ? `${task.processed.toLocaleString()} / ${task.total.toLocaleString()}` : ""].filter(Boolean).join(" · ")
  };
  if (task.kind === "ai") return {
    icon: BrainCircuit,
    iconClass: "text-[var(--zc-info-text)]",
    title: t("overviewBackgroundAI"),
    description: [path, typeof task.processed === "number" && typeof task.total === "number" ? `${task.processed.toLocaleString()} / ${task.total.toLocaleString()}` : ""].filter(Boolean).join(" · ")
  };
  return {
    icon: AlertTriangle,
    iconClass: "text-[var(--zc-danger-text)]",
    title: t("overviewBackgroundFailure"),
    description: [path, task.message].filter(Boolean).join(" · ")
  };
}
