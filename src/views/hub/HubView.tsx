import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { File, FolderOpen, FolderSearch, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
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
import { buttonSecondary, cn, glassButtonPrimary } from "../../utils/tw";
import { revealFileFromCard } from "../shared/cardActions";
import {
  IconButton,
  NoticeBanner,
  StateBlock,
  ToneBadge,
  compactInteractiveRow,
  contentPanel,
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

const HUB_BUCKET_KEYS = ["CoreAssets", "QuietArchive", "CleanupLane", "PrivacyVault"] as const;
const HUB_PENDING_PREVIEW_LIMIT = 6;
const HUB_BUCKET_PREVIEW_LIMIT = 4;

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
  const isClassifyingWithAI = useFileLibraryStore((state) => state.isClassifyingWithAI);
  const aiClassificationStatus = useFileLibraryStore((state) => state.aiClassificationStatus);
  const loadOrganizeQueue = useFileLibraryStore((state) => state.loadOrganizeQueue);
  const classifyCurrentScopeWithAI = useFileLibraryStore((state) => state.classifyCurrentScopeWithAI);
  const scope = useFileLibraryStore((state) => state.scope);
  const setScope = useFileLibraryStore((state) => state.setScope);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const { rules } = useRulesContext();
  const runDispatch = useOperationQueueStore((state) => state.runDispatch);
  const [isDispatching, setIsDispatching] = useState(false);
  const [aiThinkingWarning, setAiThinkingWarning] = useState(false);
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
  const dispatchLabel = pendingFiles.length > 0 && classifiedCount === 0 ? t("generateSuggestions") : t("runDispatch");

  useEffect(() => {
    if (isEmptyCurrentScanScope) return;
    void loadOrganizeQueue(scope);
  }, [isEmptyCurrentScanScope, loadOrganizeQueue, scope]);

  useEffect(() => {
    let disposed = false;
    void tauriApi.getAISettings()
      .then((settings) => {
        if (disposed) return;
        const model = settings.model.toLowerCase();
        setAiThinkingWarning(settings.enableThinking || (settings.provider === "ollama" && model.includes("qwen3")));
      })
      .catch(() => {
        if (!disposed) setAiThinkingWarning(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

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

  async function runAIClassification(options: { onlyUnclassified: boolean; onlyLowConfidence: boolean }) {
    if (isClassifyingWithAI) return;
    try {
      await classifyCurrentScopeWithAI(options);
      await loadOrganizeQueue(scope);
    } catch {
      // File library store owns readable AI error reporting and toast state.
    }
  }

  if (isEmptyCurrentScanScope) {
    return (
      <div className={cn(pageFrame, "gap-3 !overflow-auto overscroll-contain pr-1")}>
        <StateBlock
          tone="info"
          title={t("noOrganizeScopeTitle")}
          description={t("noOrganizeScopeDesc")}
          density="compact"
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
    <div className={cn(pageFrame, "gap-3 !overflow-auto overscroll-contain pr-1")}>
      <section className={cn(contentPanel, "grid gap-3 p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionHeading}>{t("hubWorkbenchTitle")}</h2>
              <ToneBadge tone="info">{t("currentOrganizeScope")}: {scopeText}</ToneBadge>
            </div>
            <p className={sectionDescription}>{t("hubWorkbenchDesc")}</p>
          </div>
          <div className="flex max-w-lg flex-wrap items-center justify-end gap-2">
            <motion.button
              className={glassButtonPrimary}
              onClick={dispatchFiles}
              disabled={isDispatching || isLoadingOrganizeQueue}
              title={`${activeRuleCount} active rules`}
            >
              {isDispatching ? t("dispatching") : dispatchLabel}
            </motion.button>
            <div className={cn(softPanel, "flex items-start gap-2 px-3 py-2 text-sm")}>
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
              <span className="leading-6 text-[var(--muted)]">{t("hubSafetyHint")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className={cn(contentPanel, "grid gap-3 p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionHeading}>AI 智能分类</h2>
              <ToneBadge tone="info">不会自动移动文件</ToneBadge>
            </div>
            <p className={sectionDescription}>
              让模型先理解文件，再生成整理建议。AI 不会直接移动文件，所有结果都需要进入预览后再执行。
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ onlyUnclassified: false, onlyLowConfidence: false })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>{isClassifyingWithAI ? "正在请求模型分析文件…" : "开始 AI 分类"}</span>
            </button>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ onlyUnclassified: true, onlyLowConfidence: false })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>仅处理未分类</span>
            </button>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ onlyUnclassified: false, onlyLowConfidence: true })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>复查低置信度</span>
            </button>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ onlyUnclassified: false, onlyLowConfidence: false })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>重新分类当前范围</span>
            </button>
            <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => setView("preview")}>
              查看整理预览
            </button>
          </div>
        </div>
        {aiThinkingWarning ? (
          <NoticeBanner tone="warning">
            Thinking 模式可能降低 JSON 稳定性，建议关闭后再批量分类。
          </NoticeBanner>
        ) : null}
        {isClassifyingWithAI ? (
          <NoticeBanner tone="info">
            正在请求模型分析文件… 正在解析 AI 分类结果… 正在写入整理建议…
          </NoticeBanner>
        ) : aiClassificationStatus ? (
          <NoticeBanner tone={aiClassificationStatus.startsWith("AI 分类完成") ? "success" : "warning"}>
            {aiClassificationStatus.startsWith("AI 分类完成")
              ? `${aiClassificationStatus} AI 已生成整理建议，请进入预览后确认执行。`
              : `AI 分类失败：${aiClassificationStatus}`}
          </NoticeBanner>
        ) : null}
      </section>

      <section className={cn(contentPanel, "grid gap-2 p-3 sm:grid-cols-3")}>
        <SummaryChip label={t("inboxStack")} value={pendingFiles.length.toLocaleString()} hint={t("hubPendingStatus")} />
        <SummaryChip label={t("suggestedPlan")} value={classifiedCount.toLocaleString()} hint={t("hubSuggestionStatus")} />
        <SummaryChip label={t("builtInRules")} value={activeRuleCount.toLocaleString()} hint={t("safeModeDesc")} />
      </section>

      {organizeQueueTruncated && (
        <NoticeBanner tone="warning">
          {t("organizeQueueTruncatedWarning")}
        </NoticeBanner>
      )}

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.35fr)]">
        <section className={cn(contentPanel, "grid gap-3 p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={sectionHeading}>{t("inboxStack")}</h2>
              <p className={cn(metadataText, "mt-1")}>{t("hubPendingDesc")}</p>
            </div>
            <ToneBadge tone="warning">{pendingFiles.length.toLocaleString()} {t("items")}</ToneBadge>
          </div>
          <FileCardList files={pendingFiles} isLoading={isLoadingOrganizeQueue} onError={onError} t={t} />
        </section>

        <div className="grid content-start gap-3">
          {!isLoadingOrganizeQueue && classifiedCount === 0 && (
            <NoticeBanner
              tone="info"
              title={t("hubNoBucketedTitle")}
              action={(
                <button className={glassButtonPrimary} onClick={dispatchFiles} disabled={isDispatching || isLoadingOrganizeQueue}>
                  {isDispatching ? t("dispatching") : dispatchLabel}
                </button>
              )}
            >
              {t("hubNoBucketedDesc")}
            </NoticeBanner>
          )}
          <motion.section className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2" variants={listMotion} initial="hidden" animate="show">
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

function SummaryChip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 rounded-xl border border-[var(--line-dark)] bg-[var(--surface-soft)] px-3 py-2">
      <strong className="text-xl font-semibold tabular-nums text-[var(--ink)]">{value}</strong>
      <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">{label}</span>
      <span className={cn(quietText, "col-start-2 truncate")}>{hint}</span>
    </div>
  );
}

function FileCardList({
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
  if (isLoading) {
    return (
      <StateBlock tone="info" title={t("hubLoadingQueue")} description={t("hubPendingDesc")} density="compact" />
    );
  }

  if (!files.length) {
    return (
      <StateBlock tone="neutral" title={t("hubNoPendingTitle")} description={t("hubNoPendingDesc")} density="compact" />
    );
  }

  const visibleFiles = files.slice(0, HUB_PENDING_PREVIEW_LIMIT);
  const remaining = files.length - visibleFiles.length;

  return (
    <motion.div className="grid gap-2" variants={listMotion} initial="hidden" animate="show">
      {visibleFiles.map((file, index) => (
        <FileCard key={file.id} file={file} index={index} onError={onError} t={t} compact />
      ))}
      {remaining > 0 && <span className={cn(quietText, "px-1")}>+{remaining.toLocaleString()} {t("items")}</span>}
    </motion.div>
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
      className={cn(contentPanel, "grid gap-3 p-4")}
      variants={itemMotion}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--ink)]">{bucket.label}</h3>
          <p className={cn(quietText, "mt-1")}>{bucket.description}</p>
        </div>
        <ToneBadge tone={bucket.tone}>{files.length.toLocaleString()}</ToneBadge>
      </div>
      <BucketFileList files={files} isLoading={isLoading} setView={setView} t={t} />
    </motion.article>
  );
}

function BucketFileList({
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
  if (isLoading) {
    return <StateBlock tone="info" title={t("hubLoadingQueue")} density="compact" />;
  }

  if (!files.length) {
    return <StateBlock tone="neutral" title={t("hubEmptyBucket")} description={t("hubBucketSuggestionHint")} density="compact" />;
  }

  const visibleFiles = files.slice(0, HUB_BUCKET_PREVIEW_LIMIT);
  const remaining = files.length - visibleFiles.length;

  return (
    <motion.div className="grid gap-2" variants={listMotion} initial="hidden" animate="show">
      {visibleFiles.map((file) => (
        <BucketFileButton file={file} key={file.id} setView={setView} t={t} />
      ))}
      {remaining > 0 && (
        <button className={cn(buttonSecondary, "min-h-8 justify-self-start px-3 py-1.5 text-xs")} onClick={() => setView("preview")}>
          +{remaining.toLocaleString()} {t("items")}
        </button>
      )}
    </motion.div>
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
