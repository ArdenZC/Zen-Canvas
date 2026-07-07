import { motion } from "motion/react";
import { Folder, Play, X } from "lucide-react";
import type { OperationProgressPayload } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import type { OperationPreview } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { groupOperationPreviews, compactPath, formatDisplayPath, libraryScopeLabel } from "../../utils/viewHelpers";
import { cn, glassButton, glassButtonPrimary, glassButtonWarning } from "../../utils/tw";
import {
  MetricCard,
  NoticeBanner,
  StateBlock,
  cardGrid,
  contentPanel,
  interactiveRow,
  listMotion,
  pageSurface,
  panelSurface,
  sectionDescription,
  sectionHeading,
  softPanel
} from "../shared/ui";
import { PreviewFileRow } from "./PreviewFileRow";

export function TimelineView() {
  const { t, setView } = useChromeContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const previews = useOperationQueueStore((state) => state.displayPreviews);
  const previewScope = useOperationQueueStore((state) => state.previewScope);
  const previewTotal = useOperationQueueStore((state) => state.previewTotal);
  const previewLimit = useOperationQueueStore((state) => state.previewLimit);
  const previewTruncated = useOperationQueueStore((state) => state.previewTruncated);
  const previewHasMore = useOperationQueueStore((state) => state.previewHasMore);
  const selectedIds = useOperationQueueStore((state) => state.selectedOperationIds);
  const setSelectedIds = useOperationQueueStore((state) => state.setSelectedOperationIds);
  const loadMorePreviews = useOperationQueueStore((state) => state.loadMorePreviews);
  const onRenamePreview = useOperationQueueStore((state) => state.onRenamePreview);
  const executeSelected = useOperationQueueStore((state) => state.executeSelected);
  const operationProgress = useOperationQueueStore((state) => state.operationProgress);
  const isOperationCanceling = useOperationQueueStore((state) => state.isOperationCanceling);
  const cancelOperations = useOperationQueueStore((state) => state.cancelOperations);
  function toggle(id: string) {
    const preview = previews.find((item) => item.id === id);
    if (!preview || preview.is_executable === false) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  const groups = groupOperationPreviews(previews, t);
  const executableCount = previews.filter((preview) => preview.is_executable !== false).length;
  const blockedCount = previews.length - executableCount;
  const confirmationCount = previews.filter((preview) => preview.requires_confirmation).length;
  const autoCreateParentCount = previews.filter(
    (preview) => preview.operation_type !== "move_to_trash" && preview.will_create_parent
  ).length;
  const executeProgress = operationProgress?.kind === "execute" ? operationProgress : null;
  const isExecuting = Boolean(executeProgress);
  const scopeText = libraryScopeLabel(previewScope ?? scope, t("allIndexedFiles"), t("noFolderSelected"));
  const coveredTotal = previewTotal || previews.length;
  const selectedCount = selectedIds.size;
  const executeButtonLabel = t("executeSelectedWithCount").replace("{count}", selectedCount.toLocaleString());

  return (
    <div className={pageSurface}>
      <section className={panelSurface}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className={sectionHeading}>{t("suggestedPlan")}</h2>
            <p className={sectionDescription}>{t("previewBeforeExecute")}</p>
            <p className="mt-2 truncate text-xs text-[var(--muted)]">{t("currentOrganizeScope")}: {scopeText}</p>
          </div>
          <button className={glassButtonPrimary} onClick={executeSelected} disabled={!selectedCount || isExecuting}>
            <Play size={16} />
            <span>{isExecuting ? t("executingOperations") : executeButtonLabel}</span>
          </button>
        </div>

        <div className="mb-4 grid gap-3">
          <NoticeBanner tone="warning" title={t("previewSafetyTitle")}>
            {t("previewNoOverwriteDelete")}
          </NoticeBanner>
          {previews.some((preview) => preview.operation_type === "move_to_trash") && (
            <NoticeBanner tone="warning">
              {t("previewCleanupTrashSafety")}
            </NoticeBanner>
          )}
          <div className={cardGrid}>
            <MetricCard label={t("previewTotalSuggestions")} value={coveredTotal.toLocaleString()} tone="blue" />
            <MetricCard label={t("selectedOperations")} value={selectedCount.toLocaleString()} tone="green" />
            <MetricCard label={t("executableItems")} value={executableCount.toLocaleString()} tone="green" />
            <MetricCard label={t("blockedItems")} value={blockedCount.toLocaleString()} tone="red" />
            <MetricCard label={t("confirmationItems")} value={confirmationCount.toLocaleString()} tone="amber" />
            <MetricCard label={t("autoCreateFolders")} value={autoCreateParentCount.toLocaleString()} tone="purple" />
          </div>
        </div>
        {previewTruncated && (
          <NoticeBanner tone="warning">
            {t("previewTruncatedWarning")
              .replace("{limit}", previewLimit.toLocaleString())
              .replace("{total}", coveredTotal.toLocaleString())}
          </NoticeBanner>
        )}
        {autoCreateParentCount > 0 && (
          <NoticeBanner tone="info">
            {t("autoCreateFolderHint").replace("{count}", autoCreateParentCount.toLocaleString())}
          </NoticeBanner>
        )}
        {executeProgress && (
          <OperationProgressPanel
            progress={executeProgress}
            isCanceling={isOperationCanceling}
            onCancel={cancelOperations}
            t={t}
          />
        )}
        {!previews.length ? (
          <StateBlock
            title={t("previewEmptyTitle")}
            description={t("previewEmptyDesc")}
            primaryAction={(
              <button className={glassButtonPrimary} onClick={() => setView("organize")}>
                {t("goSmartDispatch")}
              </button>
            )}
            secondaryAction={(
              <button className={glassButton} onClick={() => setView("rules")}>
                {t("goRuleEngine")}
              </button>
            )}
          />
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => {
              const executable = group.items.filter((item) => item.is_executable !== false);
              const allSelected = executable.length > 0 && executable.every((item) => selectedIds.has(item.id));
              const selectedInGroup = executable.filter((item) => selectedIds.has(item.id)).length;
              const groupDisabledDescriptionId = `group-disabled-${group.key}`;
              return (
                <section className={cn(interactiveRow({ disabled: executable.length === 0 }), "grid gap-3 p-4")} key={group.key}>
                  <label className={cn("grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3", executable.length > 0 && "cursor-pointer")}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={executable.length === 0}
                      aria-describedby={executable.length === 0 ? groupDisabledDescriptionId : undefined}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        const shouldSelect = !allSelected;
                        executable.forEach((item) => {
                          if (shouldSelect) next.add(item.id);
                          else next.delete(item.id);
                        });
                        setSelectedIds(next);
                      }}
                    />
                    <Folder size={20} />
                    <div>
                      <strong className="block text-sm">{group.name}</strong>
                    <span className="block truncate text-xs text-[var(--muted)]">{formatDisplayPath(group.path)}</span>
                    </div>
                    <em className="rounded-full border border-[var(--line)] px-2 py-1 text-xs not-italic text-[var(--muted)]">
                      {selectedInGroup.toLocaleString()} / {executable.length.toLocaleString()}
                    </em>
                  </label>
                  {executable.length === 0 && (
                    <p id={groupDisabledDescriptionId} className="text-xs text-[var(--muted)]">
                      {t("groupNoExecutableItems")}
                    </p>
                  )}
                  <div className="grid gap-3">
                    {group.subgroups.map((subgroup) => (
                      <section className={cn(softPanel, "p-3")} key={`${group.key}-${subgroup.key}`}>
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pb-2">
                          <Folder size={16} />
                          <div>
                            <strong className="block text-sm">{subgroup.name}</strong>
                            <span className="block truncate text-xs text-[var(--muted)]">{formatDisplayPath(subgroup.path)}</span>
                          </div>
                          <em className="text-xs not-italic text-[var(--muted)]">{subgroup.items.length}</em>
                        </div>
                        <VirtualPreviewFileRows
                          previews={subgroup.items}
                          selectedIds={selectedIds}
                          toggle={toggle}
                          onRenamePreview={onRenamePreview}
                          t={t}
                        />
                      </section>
                    ))}
                  </div>
                </section>
              );
            })}
            {previewHasMore && (
              <button className={glassButton} onClick={loadMorePreviews}>
                {t("loadMoreFiles").replace("{count}", Math.max(0, coveredTotal - previews.length).toLocaleString())}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function VirtualPreviewFileRows({
  previews,
  selectedIds,
  toggle,
  onRenamePreview,
  t
}: {
  previews: OperationPreview[];
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  onRenamePreview: (id: string, name: string) => void;
  t: Translator;
}) {
  return (
    <motion.div className="grid gap-3 overflow-visible" variants={listMotion} initial="hidden" animate="show">
      {previews.map((preview) => (
        <PreviewFileRow
          key={preview.id}
          preview={preview}
          isSelected={selectedIds.has(preview.id)}
          toggle={toggle}
          onRenamePreview={onRenamePreview}
          t={t}
        />
      ))}
    </motion.div>
  );
}

export function OperationProgressPanel({
  progress,
  isCanceling,
  onCancel,
  t
}: {
  progress: OperationProgressPayload;
  isCanceling: boolean;
  onCancel: () => Promise<void>;
  t: Translator;
}) {
  const ratio = progress.total > 0 ? Math.min(1, progress.processed / progress.total) : 0;
  const currentPath = progress.currentPath ? compactPath(formatDisplayPath(progress.currentPath), 56) : "-";
  const line = t("operationProgressLine")
    .replace("{processed}", progress.processed.toLocaleString())
    .replace("{total}", progress.total.toLocaleString())
    .replace("{path}", currentPath);

  return (
    <div className={cn(contentPanel, "mb-4 grid gap-3 p-4")}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <strong>{progress.kind === "restore" ? t("restoring") : t("operationProgressTitle")}</strong>
        <span className="text-[var(--muted)]">
          {progress.processed.toLocaleString()} / {progress.total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/50 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-blue-500 transition-[width]"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <small className="min-w-0 truncate text-xs text-[var(--muted)]" title={progress.currentPath ?? undefined}>{line}</small>
        <button className={glassButtonWarning} onClick={onCancel} disabled={isCanceling}>
          <X size={15} />
          <span>{isCanceling ? t("operationCanceling") : t("cancel")}</span>
        </button>
      </div>
    </div>
  );
}
