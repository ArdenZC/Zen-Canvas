import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { File, FolderOpen, FolderSearch, Layers, ShieldCheck } from "lucide-react";
import {
  useChromeContext,
  useRulesContext
} from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import type { FileRecord } from "../../types/domain";
import type { Translator, View } from "../../types/ui";
import { formatBytes, formatDate } from "../../utils/format";
import { compactPath, libraryScopeLabel } from "../../utils/viewHelpers";
import { shouldVirtualizeList } from "../../utils/virtualization";
import { buttonSecondary, cn, glassButtonPrimary, virtualList, virtualRow as virtualRowClass, virtualSpacer } from "../../utils/tw";
import { revealFileFromCard } from "../shared/cardActions";
import {
  IconButton,
  MetricCard,
  NoticeBanner,
  StateBlock,
  ToneBadge,
  compactInteractiveRow,
  contentPanel,
  inlineActions,
  interactiveRow,
  itemMotion,
  listMotion,
  metadataText,
  pageFrame,
  quietText,
  sectionDescription,
  sectionHeading,
  softPanel
} from "../shared/ui";

const HUB_FILE_ROW_HEIGHT = 96;
const BUCKET_FILE_ROW_HEIGHT = 58;
const HUB_BUCKET_KEYS = ["CoreAssets", "QuietArchive", "CleanupLane", "PrivacyVault"] as const;

export type HubBucketKey = typeof HUB_BUCKET_KEYS[number];
export type HubBucketGroups = Record<HubBucketKey, FileRecord[]>;
export interface HubFileModel {
  pendingFiles: FileRecord[];
  bucketedFiles: HubBucketGroups;
  classifiedCount: number;
}

type HubTone = "blue" | "green" | "amber" | "red" | "slate" | "purple";

function createEmptyHubBucketGroups(): HubBucketGroups {
  return {
    CoreAssets: [],
    QuietArchive: [],
    CleanupLane: [],
    PrivacyVault: []
  };
}

export function getHubBucketKey(file: FileRecord): HubBucketKey {
  if (file.risk_level === "Sensitive") return "PrivacyVault";
  if (file.lifecycle === "Archive") return "QuietArchive";
  if (file.suggested_action === "DeleteCandidate" || file.suggested_action === "Review") return "CleanupLane";
  return "CoreAssets";
}

export function groupFilesByHubBucket(files: readonly FileRecord[]): HubBucketGroups {
  return files.reduce((groups, file) => {
    groups[getHubBucketKey(file)].push(file);
    return groups;
  }, createEmptyHubBucketGroups());
}

export function deriveHubFileModel(files: readonly FileRecord[]): HubFileModel {
  const pendingFiles: FileRecord[] = [];
  const bucketedFiles = createEmptyHubBucketGroups();
  let classifiedCount = 0;

  for (const file of files) {
    if (isRuleClassified(file)) {
      classifiedCount += 1;
      bucketedFiles[getHubBucketKey(file)].push(file);
    } else {
      pendingFiles.push(file);
    }
  }

  return { pendingFiles, bucketedFiles, classifiedCount };
}

export function HubView() {
  const { t, setView, onError } = useChromeContext();
  const files = useFileLibraryStore((state) => state.organizeQueue);
  const organizeQueueTruncated = useFileLibraryStore((state) => state.organizeQueueTruncated);
  const isLoadingOrganizeQueue = useFileLibraryStore((state) => state.isLoadingOrganizeQueue);
  const loadOrganizeQueue = useFileLibraryStore((state) => state.loadOrganizeQueue);
  const scope = useFileLibraryStore((state) => state.scope);
  const setScope = useFileLibraryStore((state) => state.setScope);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const { rules } = useRulesContext();
  const runDispatch = useOperationQueueStore((state) => state.runDispatch);
  const [isDispatching, setIsDispatching] = useState(false);
  const activeRuleCount = useMemo(() => countActiveRules(rules), [rules]);
  const { pendingFiles, bucketedFiles, classifiedCount } = useMemo(() => deriveHubFileModel(files), [files]);
  const buckets = useMemo(() => [
    { key: "CoreAssets" as const, label: t("coreAssets"), description: t("coreAssetsDesc"), tone: "blue" },
    { key: "QuietArchive" as const, label: t("archiveBox"), description: t("archiveBoxDesc"), tone: "purple" },
    { key: "CleanupLane" as const, label: t("cleanupLane"), description: t("cleanupLaneDesc"), tone: "slate" },
    { key: "PrivacyVault" as const, label: t("privacyVault"), description: t("privacyVaultDesc"), tone: "red" }
  ] satisfies Array<{ key: HubBucketKey; label: string; description: string; tone: HubTone }>, [t]);
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));
  const isEmptyCurrentScanScope = scope.kind === "current_scan" && scope.roots.length === 0;

  useEffect(() => {
    if (isEmptyCurrentScanScope) return;
    void loadOrganizeQueue(scope);
  }, [isEmptyCurrentScanScope, loadOrganizeQueue, scope]);

  async function dispatchFiles() {
    if (isDispatching) return;
    setIsDispatching(true);
    try {
      await runDispatch();
      await loadOrganizeQueue(scope);
      setView("preview");
    } catch {
      // Operation store owns dispatch error reporting.
    } finally {
      setIsDispatching(false);
    }
  }

  if (isEmptyCurrentScanScope) {
    return (
      <div className={cn(pageFrame, "gap-4")}>
        <StateBlock
          tone="info"
          title={t("noOrganizeScopeTitle")}
          description={t("noOrganizeScopeDesc")}
          primaryAction={
            <button className={glassButtonPrimary} onClick={() => void handleChooseFolders()}>
              <FolderSearch size={16} />
              <span>{t("chooseFolderScan")}</span>
            </button>
          }
          secondaryAction={
            <button className={buttonSecondary} onClick={() => setScope({ kind: "all" })}>
              <Layers size={16} />
              <span>{t("viewAllIndexedFiles")}</span>
            </button>
          }
        />
        <NoticeBanner tone="info" title={t("scannerSafetyTitle")}>
          {t("hubSafetyHint")}
        </NoticeBanner>
      </div>
    );
  }

  return (
    <div className={cn(pageFrame, "gap-4")}>
      <section className={cn(contentPanel, "grid gap-4 p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionHeading}>{t("hubWorkbenchTitle")}</h2>
              <ToneBadge tone="info">{t("currentOrganizeScope")}: {scopeText}</ToneBadge>
            </div>
            <p className={sectionDescription}>{t("hubWorkbenchDesc")}</p>
          </div>
          <div className={cn(softPanel, "flex items-start gap-2 px-3 py-2 text-sm")}>
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
            <span className="max-w-sm leading-6 text-[var(--muted)]">{t("hubSafetyHint")}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <MetricCard label={t("inboxStack")} value={pendingFiles.length.toLocaleString()} hint={t("hubPendingStatus")} tone="amber" />
        <MetricCard label={t("suggestedPlan")} value={classifiedCount.toLocaleString()} hint={t("hubSuggestionStatus")} tone="blue" />
        <MetricCard label={t("builtInRules")} value={activeRuleCount.toLocaleString()} hint={t("safeModeDesc")} tone="slate" />
      </section>

      {organizeQueueTruncated && (
        <NoticeBanner tone="warning">
          {t("organizeQueueTruncatedWarning")}
        </NoticeBanner>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.35fr)] xl:overflow-hidden">
        <section className={cn(contentPanel, "flex min-h-[420px] flex-col gap-4 overflow-hidden p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={sectionHeading}>{t("inboxStack")}</h2>
              <p className={cn(metadataText, "mt-1")}>{t("hubPendingDesc")}</p>
            </div>
            <ToneBadge tone="warning">{pendingFiles.length.toLocaleString()} {t("items")}</ToneBadge>
          </div>
          <VirtualFileCardList files={pendingFiles} isLoading={isLoadingOrganizeQueue} onError={onError} t={t} />
          <div className={cn(softPanel, "grid gap-3 p-3")}>
            <div className={inlineActions}>
              <motion.button
                className={glassButtonPrimary}
                onClick={dispatchFiles}
                disabled={isDispatching || isLoadingOrganizeQueue}
                title={`${activeRuleCount} active rules`}
              >
                {isDispatching ? t("dispatching") : t("runDispatch")}
              </motion.button>
              <span className={metadataText}>{t("hubSafetyHint")}</span>
            </div>
          </div>
        </section>

        <div className="grid min-h-0 content-start gap-3 overflow-auto pr-1">
          {!isLoadingOrganizeQueue && classifiedCount === 0 && (
            <NoticeBanner tone="info" title={t("hubNoBucketedTitle")}>
              {t("hubNoBucketedDesc")}
            </NoticeBanner>
          )}
          <motion.section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-2" variants={listMotion} initial="hidden" animate="show">
            {buckets.map((bucket) => (
              <BucketCard
                bucket={bucket}
                files={bucketedFiles[bucket.key]}
                isLoading={isLoadingOrganizeQueue}
                key={bucket.key}
                setView={setView}
                t={t}
              />
            ))}
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function VirtualFileCardList({
  files,
  isLoading,
  onError,
  t
}: {
  files: FileRecord[];
  isLoading: boolean;
  onError: (message: string) => void;
  t: Translator;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = shouldVirtualizeList(files.length);
  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => HUB_FILE_ROW_HEIGHT,
    overscan: 8
  });

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1">
        <StateBlock tone="info" title={t("hubLoadingQueue")} description={t("hubPendingDesc")} />
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className="min-h-0 flex-1">
        <StateBlock tone="neutral" title={t("hubNoPendingTitle")} description={t("hubNoPendingDesc")} />
      </div>
    );
  }

  if (!shouldVirtualize) {
    return (
      <motion.div className="grid min-h-0 flex-1 gap-3 overflow-auto pr-1" variants={listMotion} initial="hidden" animate="show">
        {files.map((file, index) => (
          <FileCard key={file.id} file={file} index={index} onError={onError} t={t} compact />
        ))}
      </motion.div>
    );
  }

  return (
    <div ref={parentRef} className={cn("min-h-0 flex-1", virtualList)}>
      <div className={virtualSpacer} style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const file = files[virtualRow.index];
          return (
            <div
              className={virtualRowClass}
              key={file.id}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <FileCard file={file} index={virtualRow.index} onError={onError} t={t} compact disableAnimation />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BucketCard({
  bucket,
  files,
  isLoading,
  setView,
  t
}: {
  bucket: { key: HubBucketKey; label: string; description: string; tone: HubTone };
  files: FileRecord[];
  isLoading: boolean;
  setView: (view: View) => void;
  t: Translator;
}) {
  return (
    <motion.article
      className={cn(contentPanel, "flex min-h-[250px] flex-col gap-3 p-4")}
      variants={itemMotion}
      layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--ink)]">{bucket.label}</h3>
          <p className={cn(quietText, "mt-1")}>{bucket.description}</p>
        </div>
        <ToneBadge tone={bucket.tone}>{files.length.toLocaleString()}</ToneBadge>
      </div>
      <p className={metadataText}>{t("hubBucketSuggestionHint")}</p>
      <VirtualBucketFileList files={files} isLoading={isLoading} setView={setView} t={t} />
    </motion.article>
  );
}

function VirtualBucketFileList({
  files,
  isLoading,
  setView,
  t
}: {
  files: FileRecord[];
  isLoading: boolean;
  setView: (view: View) => void;
  t: Translator;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = shouldVirtualizeList(files.length);
  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => BUCKET_FILE_ROW_HEIGHT,
    overscan: 8
  });

  if (isLoading) {
    return <StateBlock tone="info" title={t("hubLoadingQueue")} />;
  }

  if (!files.length) {
    return <StateBlock tone="neutral" title={t("hubEmptyBucket")} description={t("hubBucketSuggestionHint")} />;
  }

  if (!shouldVirtualize) {
    return (
      <motion.div className="grid gap-2" variants={listMotion} initial="hidden" animate="show">
        {files.map((file) => (
          <BucketFileButton file={file} key={file.id} setView={setView} t={t} />
        ))}
      </motion.div>
    );
  }

  return (
    <div ref={parentRef} className={cn("min-h-32", virtualList)}>
      <div className={virtualSpacer} style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const file = files[virtualRow.index];
          return (
            <div
              className={virtualRowClass}
              key={file.id}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <BucketFileButton file={file} setView={setView} t={t} disableAnimation />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BucketFileButton({
  file,
  setView,
  t,
  disableAnimation = false
}: {
  file: FileRecord;
  setView: (view: View) => void;
  t: Translator;
  disableAnimation?: boolean;
}) {
  return (
    <motion.button
      className={cn(compactInteractiveRow(), "grid h-[58px] min-h-[58px] w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 overflow-hidden text-sm")}
      layout={!disableAnimation}
      variants={disableAnimation ? undefined : itemMotion}
      initial={disableAnimation ? false : undefined}
      animate={disableAnimation ? false : undefined}
      onClick={() => setView("preview")}
      aria-label={`${file.name} · ${t("hubSuggestionStatus")}`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center text-[var(--muted)]">
        <File size={15} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate font-medium text-[var(--ink)]">{file.name}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{compactPath(file.path, 46)}</span>
      </span>
    </motion.button>
  );
}

function isRuleClassified(file: FileRecord): boolean {
  return file.classification_status === "classified";
}

function countActiveRules(rules: readonly { enabled: boolean }[]): number {
  let count = 0;
  for (const rule of rules) {
    if (rule.enabled) count += 1;
  }
  return count;
}

function FileCard({
  file,
  index,
  onError,
  t,
  compact = false,
  disableAnimation = false
}: {
  file: FileRecord;
  index: number;
  onError: (message: string) => void;
  t: Translator;
  compact?: boolean;
  disableAnimation?: boolean;
}) {
  return (
    <motion.div
      className={cn(
        interactiveRow(),
        "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3",
        compact && "h-24 min-h-24",
        compact ? "p-3" : "p-4"
      )}
      layout={!disableAnimation}
      variants={disableAnimation ? undefined : itemMotion}
      initial={disableAnimation ? false : undefined}
      animate={disableAnimation ? false : undefined}
      style={{ "--delay": `${Math.min(index * 18, 320)}ms` } as CSSProperties}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white/28 text-[var(--muted)] dark:bg-white/5">
        <File size={17} />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-sm text-[var(--ink)]">{file.name}</strong>
        <small className="mt-1 block truncate text-xs text-[var(--muted)]">{compactPath(file.path, 58)}</small>
        <span className={cn(quietText, "mt-1 block")}>
          {file.file_type} / {formatBytes(file.size)} / {formatDate(file.modified_at)}
        </span>
      </span>
      <IconButton
        type="button"
        className="opacity-0 transition-[background,border-color,color,opacity] focus:opacity-100 group-hover:opacity-100"
        aria-label={t("revealPhysical")}
        title={t("revealPhysical")}
        onClick={(event) => {
          void revealFileFromCard({
            path: file.path,
            onError,
            stopPropagation: () => event.stopPropagation()
          });
        }}
      >
        <FolderOpen size={15} />
      </IconButton>
      <ToneBadge tone="warning">{t("hubPendingStatus")}</ToneBadge>
    </motion.div>
  );
}
