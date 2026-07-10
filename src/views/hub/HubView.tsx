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
import type { Translator } from "../../types/ui";
import { formatBytes, formatDate } from "../../utils/format";
import { compactPath, libraryScopeLabel, readableError } from "../../utils/viewHelpers";
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

const HUB_BUCKET_KEYS = ["Actionable", "Review", "Keep", "Cleanup", "Sensitive"] as const;
const HUB_PENDING_PREVIEW_LIMIT = 6;
const HUB_BUCKET_PREVIEW_LIMIT = 4;
const DEFAULT_AI_CLASSIFICATION_RUN_LIMIT = 100;
const AI_CLASSIFICATION_LIMIT_OPTIONS = [50, 100, 500, 1000] as const;

export type HubBucketKey = typeof HUB_BUCKET_KEYS[number];
export type HubBucketGroups = Record<HubBucketKey, FileRecord[]>;
export interface HubFileModel {
  pendingFiles: FileRecord[];
  bucketedFiles: HubBucketGroups;
  classifiedCount: number;
  actionablePreviewCount: number;
  requiresConfirmationCount: number;
  keepCount: number;
  cleanupCandidateCount: number;
  sensitiveCount: number;
}

type HubTone = "blue" | "green" | "amber" | "red" | "slate" | "purple";

function createEmptyHubBucketGroups(): HubBucketGroups {
  return {
    Actionable: [],
    Review: [],
    Keep: [],
    Cleanup: [],
    Sensitive: []
  };
}

export function getHubBucketKey(file: FileRecord): HubBucketKey {
  if (file.risk_level === "Sensitive" || file.lifecycle === "Sensitive") return "Sensitive";
  if (file.suggested_action === "DeleteCandidate" || file.lifecycle === "Disposable" || file.purpose === "Temporary") return "Cleanup";
  if (file.suggested_action === "Keep") return "Keep";
  if (
    file.suggested_action === "Review"
    || file.requires_confirmation
    || file.confidence < 0.65
    || !file.suggested_target_path.trim() && ["Move", "MoveAndRename", "Archive"].includes(file.suggested_action)
  ) return "Review";
  if (
    ["Move", "MoveAndRename", "Archive"].includes(file.suggested_action)
    && file.suggested_target_path.trim()
    && file.confidence >= 0.65
  ) return "Actionable";
  return "Keep";
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

  return {
    pendingFiles,
    bucketedFiles,
    classifiedCount,
    actionablePreviewCount: bucketedFiles.Actionable.length,
    requiresConfirmationCount: bucketedFiles.Review.length,
    keepCount: bucketedFiles.Keep.length,
    cleanupCandidateCount: bucketedFiles.Cleanup.length,
    sensitiveCount: bucketedFiles.Sensitive.length
  };
}

export function HubView() {
  const { t, setView, onError } = useChromeContext();
  const files = useFileLibraryStore((state) => state.organizeQueue);
  const organizeQueueTruncated = useFileLibraryStore((state) => state.organizeQueueTruncated);
  const isLoadingOrganizeQueue = useFileLibraryStore((state) => state.isLoadingOrganizeQueue);
  const isClassifyingWithAI = useFileLibraryStore((state) => state.isClassifyingWithAI);
  const aiClassificationStatus = useFileLibraryStore((state) => state.aiClassificationStatus);
  const aiClassificationProgress = useFileLibraryStore((state) => state.aiClassificationProgress);
  const loadOrganizeQueue = useFileLibraryStore((state) => state.loadOrganizeQueue);
  const classifyCurrentScopeWithAI = useFileLibraryStore((state) => state.classifyCurrentScopeWithAI);
  const cancelAIClassification = useFileLibraryStore((state) => state.cancelAIClassification);
  const applyAIClassificationProgress = useFileLibraryStore((state) => state.applyAIClassificationProgress);
  const scope = useFileLibraryStore((state) => state.scope);
  const setScope = useFileLibraryStore((state) => state.setScope);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const { rules } = useRulesContext();
  const refreshPreviewsForScope = useOperationQueueStore((state) => state.refreshPreviewsForScope);
  const [isDispatching, setIsDispatching] = useState(false);
  const [aiThinkingWarning, setAiThinkingWarning] = useState(false);
  const [aiBatchSize, setAiBatchSize] = useState(10);
  const [aiConcurrency, setAiConcurrency] = useState(2);
  const [aiPreviewNotice, setAiPreviewNotice] = useState("");
  const [aiRunLimit, setAiRunLimit] = useState<number>(DEFAULT_AI_CLASSIFICATION_RUN_LIMIT);
  const activeRuleCount = useMemo(() => countActiveRules(rules), [rules]);
  const {
    pendingFiles,
    bucketedFiles,
    classifiedCount,
    actionablePreviewCount,
    requiresConfirmationCount,
    keepCount,
    cleanupCandidateCount
  } = useMemo(() => deriveHubFileModel(files), [files]);
  const buckets = useMemo(() => [
    { key: "Actionable" as const, label: "可整理", description: "高置信且目标明确，可进入预览执行。", tone: "green" },
    { key: "Review" as const, label: "需人工确认", description: "这些文件 AI 已给出初步判断，但因为置信度低、目标不明确或涉及敏感信息，暂时不会进入预览执行。", tone: "amber" },
    { key: "Keep" as const, label: "保留不动", description: "这些文件被判断为近期使用或无需移动，默认不会进入整理预览。", tone: "blue" },
    { key: "Cleanup" as const, label: "清理候选", description: "这些文件可能适合清理，但不会在智能整理中删除。请前往空间清理中处理。", tone: "slate" },
    { key: "Sensitive" as const, label: "敏感文件", description: "仅展示和提醒，不自动移动，不进入批量执行。", tone: "red" }
  ] satisfies Array<{ key: HubBucketKey; label: string; description: string; tone: HubTone }>, [t]);
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));
  const isEmptyCurrentScanScope = scope.kind === "current_scan" && scope.roots.length === 0;
  const dispatchLabel = t("runDispatch");

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
        setAiBatchSize(Math.max(1, settings.batchSize || 10));
        setAiConcurrency(Math.max(1, settings.classificationConcurrency || 1));
      })
      .catch(() => {
        if (!disposed) setAiThinkingWarning(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void tauriApi.onAIClassificationProgress((payload) => {
      if (!disposed) applyAIClassificationProgress(payload);
    }).then((unlisten) => {
      if (disposed) unlisten();
      else cleanup = unlisten;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [applyAIClassificationProgress]);

  async function dispatchFiles() {
    if (isDispatching) return;
    setIsDispatching(true);
    try {
      await refreshPreviewsForScope(scope);
      setView("preview");
    } catch {
      // Operation store owns dispatch error reporting.
    } finally {
      setIsDispatching(false);
    }
  }

  async function runAIClassification(options: {
    pendingOnly?: boolean;
    onlyUnclassified?: boolean;
    onlyLowConfidence?: boolean;
    force?: boolean;
    allowOverwriteUserCorrections?: boolean;
  }) {
    if (isClassifyingWithAI) return;
    setAiPreviewNotice("");
    try {
      const summary = await classifyCurrentScopeWithAI({
        ...options,
        limit: aiRunLimit
      });
      await loadOrganizeQueue(scope);
      const previews = await refreshPreviewsForScope(scope);
      const latestModel = deriveHubFileModel(useFileLibraryStore.getState().organizeQueue);
      setAiPreviewNotice(aiClassificationCompletionMessage(
        summary,
        previews.total,
        latestModel.keepCount
      ));
    } catch {
      // File library store owns readable AI error reporting and toast state.
    }
  }

  async function rerunAIClassificationForCurrentScope() {
    const confirmed = globalThis.confirm?.(
      "这会重新分析当前范围内的文件，可能覆盖已有 AI 分类结果。用户手动纠正和确认过的结果默认仍会被保护，除非你在高级选项中允许覆盖。是否继续？"
    ) ?? false;
    if (!confirmed) return;
    await runAIClassification({ force: true, allowOverwriteUserCorrections: false });
  }

  async function openPreview() {
    try {
      const previews = await refreshPreviewsForScope(scope);
      if (previews.total === 0) {
        setAiPreviewNotice(emptyPreviewReasonMessage());
      }
      setView("preview");
    } catch (error) {
      onError(readableError(error));
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
            <label className={cn(softPanel, "flex min-h-8 items-center gap-2 px-3 py-1.5 text-xs text-[var(--muted)]")}>
              <span>本次最多处理</span>
              <select
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[var(--ink)]"
                value={aiRunLimit}
                onChange={(event) => setAiRunLimit(Number(event.target.value))}
                disabled={isClassifyingWithAI}
              >
                {AI_CLASSIFICATION_LIMIT_OPTIONS.map((limit) => (
                  <option key={limit} value={limit}>{limit}</option>
                ))}
              </select>
            </label>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ pendingOnly: true, force: false })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>{isClassifyingWithAI ? "正在请求模型分析文件…" : "智能分类待处理文件"}</span>
            </button>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ onlyUnclassified: true, onlyLowConfidence: false, force: false })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>仅处理未分类</span>
            </button>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void runAIClassification({ onlyUnclassified: false, onlyLowConfidence: true, force: false })}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>复查低置信度</span>
            </button>
            <button
              className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")}
              onClick={() => void rerunAIClassificationForCurrentScope()}
              disabled={isClassifyingWithAI || isLoadingOrganizeQueue}
            >
              <Sparkles size={14} />
              <span>重新分类当前范围</span>
            </button>
            <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => void openPreview()}>
              查看整理预览
            </button>
            {isClassifyingWithAI && (
              <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => void cancelAIClassification()}>
                取消本次 AI 分类
              </button>
            )}
          </div>
        </div>
        {aiRunLimit === 1000 ? (
          <NoticeBanner tone="warning">
            {aiConcurrency >= 2 ? "这可能产生较多 API 请求。如遇限流，请降低并发数或稍后重试。" : "这可能需要较长时间和较多 API 请求。"}
          </NoticeBanner>
        ) : null}
        <NoticeBanner tone="info">
          只处理未分类、文件变化过、低置信度或需要确认的项目。不会覆盖你已经确认或纠正过的分类。
        </NoticeBanner>
        <NoticeBanner tone="info">
          Batch Size：每次请求模型处理的文件数。并发数：同时请求模型的批次数。预计请求批次 {Math.ceil(aiRunLimit / aiBatchSize).toLocaleString()}，预计并发轮数 {Math.ceil(Math.ceil(aiRunLimit / aiBatchSize) / aiConcurrency).toLocaleString()}。提高 Batch Size 和并发数可以加快分类，但过高可能导致模型返回 JSON 不完整或触发限流。
        </NoticeBanner>
        {aiThinkingWarning ? (
          <NoticeBanner tone="warning">
            Thinking 模式可能降低 JSON 稳定性，建议关闭后再批量分类。
          </NoticeBanner>
        ) : null}
        {isClassifyingWithAI ? (
          <NoticeBanner tone="info">
            {aiClassificationProgress
              ? `正在分类：${aiClassificationProgress.processed}/${aiClassificationProgress.total}，批次：${aiClassificationProgress.completedBatches}/${aiClassificationProgress.batchCount}，已更新：${aiClassificationProgress.updated}，失败批次：${aiClassificationProgress.failedBatches}，当前阶段：${aiClassificationProgress.stage}${aiClassificationProgress.currentFilePreview ? `，当前：${aiClassificationProgress.currentFilePreview}` : ""}`
              : "正在收集待分类文件…"}
          </NoticeBanner>
        ) : aiClassificationStatus ? (
          <NoticeBanner tone={aiClassificationStatus.startsWith("AI 分类完成") ? "success" : "warning"}>
            {aiClassificationStatus.startsWith("AI 分类完成")
              ? aiPreviewNotice || "AI 已生成分类建议。可移动/重命名的项目会进入整理预览，需要确认的项目请在文件库或智能整理中查看。"
              : `AI 分类失败：${aiClassificationStatus}`}
          </NoticeBanner>
        ) : null}
      </section>

      <section className={cn(contentPanel, "grid gap-2 p-3 sm:grid-cols-4")}>
        <SummaryChip label="可进入预览" value={actionablePreviewCount.toLocaleString()} hint="可整理项会进入预览执行" />
        <SummaryChip label="需人工确认" value={requiresConfirmationCount.toLocaleString()} hint="低置信、敏感或目标不明确" />
        <SummaryChip label="保留不动" value={keepCount.toLocaleString()} hint="默认不进入整理预览" />
        <SummaryChip label="清理候选" value={cleanupCandidateCount.toLocaleString()} hint="请前往空间清理处理" />
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
                onOpenPreview={openPreview}
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
  onOpenPreview,
  t
}: {
  bucket: { key: HubBucketKey; label: string; description: string; tone: HubTone };
  files: FileRecord[];
  isLoading: boolean;
  onOpenPreview: () => Promise<void>;
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
      <BucketFileList files={files} isLoading={isLoading} onOpenPreview={onOpenPreview} t={t} />
    </motion.article>
  );
}

function BucketFileList({
  files,
  isLoading,
  onOpenPreview,
  t
}: {
  files: FileRecord[];
  isLoading: boolean;
  onOpenPreview: () => Promise<void>;
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
        <BucketFileButton file={file} key={file.id} onOpenPreview={onOpenPreview} t={t} />
      ))}
      {remaining > 0 && (
        <button className={cn(buttonSecondary, "min-h-8 justify-self-start px-3 py-1.5 text-xs")} onClick={() => void onOpenPreview()}>
          +{remaining.toLocaleString()} {t("items")}
        </button>
      )}
    </motion.div>
  );
}

function BucketFileButton({
  file,
  onOpenPreview,
  t,
  disableAnimation = false
}: {
  file: FileRecord;
  onOpenPreview: () => Promise<void>;
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
      onClick={() => void onOpenPreview()}
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

function aiClassificationCompletionMessage(
  summary: { scanned: number; skipped: number; needsConfirmation: number; warning?: string },
  previewCount: number,
  keepCount: number
) {
  const lines = [
    "AI 分类完成：",
    `- 已分析 ${summary.scanned.toLocaleString()} 个文件`,
    `- ${previewCount.toLocaleString()} 个可进入整理预览`,
    `- ${summary.needsConfirmation.toLocaleString()} 个需要人工确认`,
    `- ${keepCount.toLocaleString()} 个建议保留`,
    `- ${summary.skipped.toLocaleString()} 个跳过`
  ];
  if (summary.warning) lines.push(summary.warning);
  if (previewCount > 0) {
    lines.push(aiClassificationPreviewMessage(previewCount));
  } else {
    lines.push("AI 已完成分类，但当前没有可执行的移动/重命名操作。请查看需要确认的项目，或调整分类结果。");
  }
  return lines.join("\n");
}

function aiClassificationPreviewMessage(previewCount: number) {
  if (previewCount > 0) {
    return `AI 已生成整理建议，其中 ${previewCount.toLocaleString()} 项可进入整理预览。`;
  }
  return "AI 已完成分类，但当前没有可执行的移动/重命名操作。请查看需要确认的项目，或调整分类结果。";
}

function emptyPreviewReasonMessage() {
  return [
    "当前没有可执行的整理操作。可能原因：",
    "- AI 建议均为 Keep / Review",
    "- 目标路径与原路径相同",
    "- 低置信度结果需要先确认"
  ].join("\n");
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
