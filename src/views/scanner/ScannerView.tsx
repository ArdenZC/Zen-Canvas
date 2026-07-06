import type { CSSProperties, ReactNode } from "react";
import { FolderSearch, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { ScanProgressPayload } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import type { Translator } from "../../types/ui";
import { formatBytes, percent } from "../../utils/format";
import { compactPath, libraryScopeLabel } from "../../utils/viewHelpers";
import { buttonSecondary, cn, glassButtonPrimary, glassButtonWarning } from "../../utils/tw";
import {
  MetricCard,
  NoticeBanner,
  PageHeader,
  StateBlock,
  ToneBadge,
  contentPanel,
  inlineActions,
  metadataText,
  pageBody,
  pageFrame,
  quietText,
  sectionDescription,
  sectionHeading,
  softPanel,
  toolbarSurface
} from "../shared/ui";

type ScannerVisualState = "idle" | "scanning" | "canceling" | "canceled" | "completed" | "error";

export function ScannerView() {
  const { t } = useChromeContext();
  const scope = useFileLibraryStore((state) => state.scope);
  const stats = useFileLibraryStore((state) => state.stats);
  const selectedFolders = useScanManagerStore((state) => state.selectedFolders);
  const isScanning = useScanManagerStore((state) => state.isScanning);
  const isCancelingScan = useScanManagerStore((state) => state.isCancelingScan);
  const scanState = useScanManagerStore((state) => state.scanState);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const handleScan = useScanManagerStore((state) => state.handleScan);
  const cancelScan = useScanManagerStore((state) => state.cancelScan);
  const scanProgress = scanState.progress;
  const scopedTotalSize = stats.totalSize;
  // 注意：此处计算的是"已索引数据占磁盘总容量的比例"（扫描覆盖率），
  // 与后端 StatsSummary.diskUsageRatio（真实磁盘占用率 = 1 - 可用/总）含义不同。
  const scannedDiskCoverageRatio = stats.diskTotalSize > 0 ? Math.min(1, scopedTotalSize / stats.diskTotalSize) : 0;
  const clutterItems = stats.duplicateFiles + stats.largeFiles + stats.needsConfirmation;
  const clutterRatio = stats.totalFiles > 0 ? Math.min(1, clutterItems / stats.totalFiles) : 0;
  const scopeLabel = libraryScopeLabel(scope, t("allIndexedFiles"), selectedFolders[0] ?? t("userSpaceHint"));
  const hasIndexedData = stats.totalFiles > 0 || scopedTotalSize > 0;
  const visualState = scannerVisualState(scanState.status, isScanning, isCancelingScan, hasIndexedData);
  const rootLabel = compactPath(scanProgress?.root ?? selectedFolders[0] ?? scopeLabel);
  const statusLabel = scannerStatusLabel(visualState, t);
  const statusDescription = scannerStatusDescription(visualState, {
    files: scanProgress?.files ?? stats.totalFiles,
    skipped: scanProgress?.skipped ?? 0,
    path: rootLabel,
    scopeLabel,
    elapsedMs: scanProgress?.elapsedMs ?? 0,
    t
  });

  return (
    <div className={pageFrame}>
      <PageHeader
        title={t("spaceScan")}
        description={statusDescription}
        meta={t("diskUsageInScope").replace("{size}", formatBytes(scopedTotalSize)).replace("{disk}", formatBytes(stats.diskTotalSize))}
      />
      <div className={cn(pageBody, "grid content-start gap-5")}>
        <StatusNotice visualState={visualState} error={scanState.error} warningCount={scanProgress?.errors ?? 0} />

        <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(320px,0.95fr)_minmax(280px,0.7fr)]">
          <div className={cn(toolbarSurface, "grid min-h-[360px] place-items-center gap-4 px-4 py-6 text-center")}>
            <ScannerDisk
              visualState={visualState}
              statusLabel={statusLabel}
              rootLabel={rootLabel}
              fileCount={scanProgress?.files ?? stats.totalFiles}
              skippedCount={scanProgress?.skipped ?? 0}
              elapsedMs={scanProgress?.elapsedMs ?? 0}
              coverageRatio={scannedDiskCoverageRatio}
            />
          </div>

          <aside className="grid content-start gap-3">
            {visualState === "idle" ? (
              <StateBlock
                tone="info"
                title={t("scannerStartTitle")}
                description={t("scannerLocalIndexSafety")}
                primaryAction={
                  <button className={glassButtonPrimary} onClick={handleScan}>
                    <RefreshCw size={17} />
                    <span>{t("scanCommon")}</span>
                  </button>
                }
                secondaryAction={
                  <button className={buttonSecondary} onClick={handleChooseFolders}>
                    <FolderSearch size={17} />
                    <span>{t("chooseFolders")}</span>
                  </button>
                }
              />
            ) : (
              <ActionPanel
                isScanning={isScanning}
                isCancelingScan={isCancelingScan}
                onScan={handleScan}
                onCancel={cancelScan}
                onChooseFolders={handleChooseFolders}
              />
            )}

            <ScopePanel title={t("scannerScopeTitle")} body={rootLabel || t("scannerNoRoot")} />
            <NoticeBanner tone="info" title={t("scannerSafetyTitle")}>
              {t("scannerLocalIndexSafety")}
            </NoticeBanner>
          </aside>
        </section>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <MetricCard label={t("scannerIndexedVolume")} value={formatBytes(scopedTotalSize)} hint={t("totalAnalysed")} tone="blue" />
          <MetricCard label={t("files")} value={stats.totalFiles.toLocaleString()} hint={scopeLabel} tone="slate" />
          <MetricCard label={t("needsReview")} value={stats.needsConfirmation.toLocaleString()} hint={t("confirmationItems")} tone={stats.needsConfirmation > 0 ? "amber" : "green"} />
          <MetricCard label={t("clutterRatio")} value={percent(clutterRatio)} hint={t("scannerCurrentViewHint")} tone={clutterRatio > 0 ? "red" : "green"} />
          <MetricCard label={t("scannerReferenceDisk")} value={formatBytes(stats.diskTotalSize)} hint={t("scannerReferenceDiskHint")} tone="purple" />
        </section>
      </div>
    </div>
  );
}

function scannerVisualState(status: string, isScanning: boolean, isCancelingScan: boolean, hasIndexedData: boolean): ScannerVisualState {
  if (isCancelingScan) return "canceling";
  if (status === "error") return "error";
  if (status === "canceled") return "canceled";
  if (isScanning || status === "scanning") return "scanning";
  if (status === "completed" || hasIndexedData) return "completed";
  return "idle";
}

function StatusNotice({ visualState, error, warningCount }: { visualState: ScannerVisualState; error?: string | null; warningCount: number }) {
  const { t } = useChromeContext();

  if (visualState === "error") {
    return (
      <NoticeBanner tone="error" title={t("scannerStatusError")}>
        {error ?? t("failed")}
      </NoticeBanner>
    );
  }

  if (visualState === "canceling") {
    return <NoticeBanner tone="warning" title={t("scannerStatusCanceling")}>{t("scanCanceling")}</NoticeBanner>;
  }

  if (visualState === "canceled") {
    return <NoticeBanner tone="warning" title={t("scannerStatusCanceled")}>{t("scanCanceled")}</NoticeBanner>;
  }

  if (warningCount > 0) {
    return <NoticeBanner tone="warning">{t("scanWarnings").replace("{count}", warningCount.toLocaleString())}</NoticeBanner>;
  }

  return null;
}

function ActionPanel({
  isScanning,
  isCancelingScan,
  onScan,
  onCancel,
  onChooseFolders
}: {
  isScanning: boolean;
  isCancelingScan: boolean;
  onScan: () => void;
  onCancel: () => void;
  onChooseFolders: () => void;
}) {
  const { t } = useChromeContext();

  return (
    <div className={cn(contentPanel, "grid gap-3 p-4")}>
      <div>
        <h2 className={sectionHeading}>{t("spaceScan")}</h2>
        <p className={sectionDescription}>{t("folderPickerSubtitle")}</p>
      </div>
      <div className={inlineActions}>
        <button className={glassButtonPrimary} onClick={onScan} disabled={isScanning}>
          <RefreshCw size={18} className={isScanning ? "animate-spin" : ""} />
          <span>{isScanning ? t("scanning") : t("scanCommon")}</span>
        </button>
        {(isScanning || isCancelingScan) && (
          <button className={glassButtonWarning} onClick={onCancel} disabled={isCancelingScan}>
            <X size={18} />
            <span>{isCancelingScan ? t("scanCanceling") : t("cancelScan")}</span>
          </button>
        )}
        <button className={buttonSecondary} onClick={onChooseFolders} disabled={isScanning}>
          <FolderSearch size={18} />
          <span>{t("chooseFolders")}</span>
        </button>
      </div>
    </div>
  );
}

function ScannerDisk({
  visualState,
  statusLabel,
  rootLabel,
  fileCount,
  skippedCount,
  elapsedMs,
  coverageRatio
}: {
  visualState: ScannerVisualState;
  statusLabel: string;
  rootLabel: string;
  fileCount: number;
  skippedCount: number;
  elapsedMs: number;
  coverageRatio: number;
}) {
  const { t } = useChromeContext();
  const progress = Math.round(coverageRatio * 100);
  const tone = visualState === "canceling" || visualState === "canceled" ? "amber" : visualState === "error" ? "red" : visualState === "completed" ? "green" : "blue";

  return (
    <div className="grid justify-items-center gap-4">
      <div
        className={cn(
          "grid h-72 w-72 max-w-[72vw] place-items-center rounded-full p-4 shadow-[var(--shadow-strong)] transition-[background,border-color,box-shadow]",
          visualState === "scanning" && "animate-pulse shadow-blue-500/15",
          visualState === "canceling" && "shadow-amber-500/15",
          visualState === "error" && "shadow-red-500/12"
        )}
        style={{ background: scannerDiskBackground(visualState, progress) } as CSSProperties}
      >
        <div className="grid h-full w-full place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-7 backdrop-blur-3xl">
          <div className="grid justify-items-center gap-3 text-center">
            <ToneBadge tone={visualState === "canceling" ? "amber" : tone}>{statusLabel}</ToneBadge>
            <strong className="text-5xl font-semibold tabular-nums tracking-[-0.03em] text-[var(--ink)]">{fileCount.toLocaleString()}</strong>
            <span className={quietText}>{t("files")}</span>
            <p className="max-w-48 truncate text-sm font-medium text-[var(--ink)]">{rootLabel || t("scannerNoRoot")}</p>
            <span className={metadataText}>
              {t("scannerElapsed").replace("{time}", formatElapsed(elapsedMs))}
              {skippedCount > 0 ? ` · ${t("skipped")}: ${skippedCount.toLocaleString()}` : ""}
            </span>
          </div>
        </div>
      </div>
      <p className={cn(metadataText, "max-w-xl text-center")}>{diskSupportText(visualState, progress, t)}</p>
    </div>
  );
}

function ScopePanel({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className={cn(softPanel, "grid gap-2 p-4")}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-blue-600 dark:text-blue-300" />
        <h2 className={sectionHeading}>{title}</h2>
      </div>
      <p className={cn(metadataText, "break-words")}>{body}</p>
    </div>
  );
}

function scannerStatusLabel(visualState: ScannerVisualState, t: Translator): string {
  if (visualState === "scanning") return t("scannerStatusScanning");
  if (visualState === "canceling") return t("scannerStatusCanceling");
  if (visualState === "canceled") return t("scannerStatusCanceled");
  if (visualState === "completed") return t("scannerStatusCompleted");
  if (visualState === "error") return t("scannerStatusError");
  return t("scannerStatusIdle");
}

function scannerStatusDescription(
  visualState: ScannerVisualState,
  context: { files: number; skipped: number; path: string; scopeLabel: string; elapsedMs: number; t: Translator }
): string {
  if (visualState === "scanning" || visualState === "canceling") {
    return context.t("scanProgressLine")
      .replace("{files}", context.files.toLocaleString())
      .replace("{skipped}", context.skipped.toLocaleString())
      .replace("{path}", context.path);
  }

  if (visualState === "canceled") return context.t("scanCanceled");
  if (visualState === "error") return context.t("scannerStatusError");
  if (visualState === "idle") return context.t("scannerLocalIndexSafety");
  return context.scopeLabel;
}

function scannerDiskBackground(visualState: ScannerVisualState, progress: number): string {
  if (visualState === "scanning") return "linear-gradient(135deg, rgba(59,130,246,0.36), rgba(16,185,129,0.18))";
  if (visualState === "canceling" || visualState === "canceled") return "linear-gradient(135deg, rgba(245,158,11,0.30), rgba(251,191,36,0.12))";
  if (visualState === "error") return "linear-gradient(135deg, rgba(239,68,68,0.28), rgba(248,113,113,0.10))";
  return `conic-gradient(#3b82f6 0 ${progress}%, rgba(59,130,246,0.10) ${progress}% 100%)`;
}

function diskSupportText(visualState: ScannerVisualState, progress: number, t: Translator): string {
  if (visualState === "idle") return t("scannerLocalIndexSafety");
  if (visualState === "canceling") return t("scanCanceling");
  if (visualState === "canceled") return t("scanCanceled");
  if (visualState === "error") return t("scannerStatusError");
  if (visualState === "scanning") return t("scannerReferenceDiskHint");
  return `${t("scannerReferenceDiskHint")} · ${percent(progress / 100)}`;
}

function formatElapsed(elapsedMs: number): string {
  if (elapsedMs <= 0) return "0s";
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${remainder}s`;
}
