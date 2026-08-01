import { Play } from "lucide-react";
import type { GlobalIndexSource, GlobalIndexStatus } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { buttonSecondary, cn } from "../../../utils/tw";
import { compactPath } from "../../../utils/viewHelpers";
import { compactInteractiveRow, quietText } from "../../shared/ui";
import { SettingsEmptyState, SettingsInlineMessage, SettingsSection, SettingsSwitchControl } from "../components/SettingsPrimitives";

export interface GlobalIndexSettingsSectionProps {
  t: Translator;
  status: GlobalIndexStatus | null;
  sources: GlobalIndexSource[];
  isLoading: boolean;
  isUpdating: boolean;
  statusText: (status: string) => string;
  providerStatusText: (status: string | null | undefined) => string | null;
  errorText: (error: string | null | undefined) => string | null;
  onAction: (action: () => Promise<void>, successMessage: string) => void;
}

function statusNeedsAttention(status: GlobalIndexStatus | null) {
  return Boolean(
    status?.status === "error"
      || status?.status === "permission_required"
      || status?.status === "spotlight_not_indexed"
      || status?.status === "spotlight_external_not_indexed"
      || status?.status === "spotlight_unavailable"
      || status?.status === "fsevents_unavailable"
      || status?.lastError
      || status?.providerStatus?.includes("service_unavailable")
  );
}

export function GlobalIndexSettingsSection({
  t,
  status,
  sources,
  isLoading,
  isUpdating,
  statusText,
  providerStatusText,
  errorText,
  onAction
}: GlobalIndexSettingsSectionProps) {
  const attention = statusNeedsAttention(status);
  return (
    <SettingsSection id="settings-global-index" title={t("globalIndexTitle")} description={t("globalIndexDesc")}>
      {isLoading ? (
        <SettingsEmptyState title={t("globalIndexLoading")} description={t("globalIndexLoadingDesc")} />
      ) : (
        <>
          {status?.providerStatus?.includes("service_unavailable") ? (
            <SettingsInlineMessage tone="warning" role="alert">
              <strong>{t("globalIndexServiceUnavailable")}</strong>
              <span>{t("globalIndexServiceUnavailableDesc")}</span>
            </SettingsInlineMessage>
          ) : null}
          <SettingsInlineMessage tone={attention ? "warning" : "info"} role={attention ? "alert" : "status"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{t("globalIndexStatus")}</strong>
              <span>{status ? statusText(status.status) : t("globalIndexStatusUnknown")}</span>
            </div>
            {status ? (
              <span className={quietText}>
                {t("globalIndexProcessed")}: {(status.processedEntries ?? status.totalEntries).toLocaleString()} · {status.collectionComplete ? t("globalIndexCollectionComplete") : t("globalIndexCollectionCollecting")} · {t("globalIndexSources")}: {status.indexedVolumes.toLocaleString()}
              </span>
            ) : null}
            {status?.providerStatus ? <span className={quietText}>{t("globalIndexProvider")}: {providerStatusText(status.providerStatus)}</span> : null}
            {status?.lastError ? <span className={quietText}>{errorText(status.lastError)}</span> : null}
          </SettingsInlineMessage>
          <div className="flex flex-wrap gap-2">
            {status?.status === "indexing" || status?.status === "syncing" ? (
              <button className={buttonSecondary} onClick={() => onAction(() => import("../../../api/tauriApi").then(({ tauriApi }) => tauriApi.pauseGlobalIndex()), t("globalIndexPause"))} disabled={isUpdating}>
                {t("globalIndexPause")}
              </button>
            ) : status?.status === "paused" ? (
              <button className={buttonSecondary} onClick={() => onAction(() => import("../../../api/tauriApi").then(({ tauriApi }) => tauriApi.resumeGlobalIndex()), t("globalIndexResume"))} disabled={isUpdating}>
                {t("globalIndexResume")}
              </button>
            ) : (
              <button className={buttonSecondary} onClick={() => onAction(() => import("../../../api/tauriApi").then(({ tauriApi }) => tauriApi.startGlobalIndex()), t("globalIndexStart"))} disabled={isUpdating}>
                {t("globalIndexStart")}
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {sources.length ? sources.map((source) => (
              <div key={source.volume.id} className={cn(compactInteractiveRow(), "px-3 py-2")}>
                <div className="grid min-w-0 gap-3 min-[1180px]:grid-cols-[minmax(0,1fr)_auto] min-[1180px]:items-center">
                  <div className="min-w-0 text-left">
                    <strong className="block truncate text-sm font-medium text-[var(--zc-text-primary)]">{source.volume.displayName}</strong>
                    <span className="block truncate text-xs leading-5 text-[var(--zc-text-tertiary)]" title={source.volume.mountPath}>
                      {compactPath(source.volume.mountPath, 72)} · {statusText(source.volume.indexStatus)} · {source.volume.entryCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 min-[1180px]:justify-end">
                    <SettingsSwitchControl
                      id={`global-index-source-${source.volume.id}`}
                      checked={source.volume.enabled}
                      label={source.volume.enabled ? t("globalIndexEnabled") : t("globalIndexDisabled")}
                      onChange={(enabled) => onAction(() => import("../../../api/tauriApi").then(({ tauriApi }) => tauriApi.setGlobalIndexSourceEnabled(source.volume.id, enabled)), t("settingsSavedInline"))}
                    />
                    <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => onAction(() => import("../../../api/tauriApi").then(({ tauriApi }) => tauriApi.rebuildGlobalIndexSource(source.volume.id)), t("globalIndexRebuild"))} disabled={isUpdating || !source.canRebuild}>
                      <Play size={14} />
                      <span>{t("globalIndexRebuild")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )) : <SettingsEmptyState title={t("globalIndexNoSources")} description={t("globalIndexNoSourcesDesc")} />}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
