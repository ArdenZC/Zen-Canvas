import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { Check, ChevronRight, File, Folder, FolderOpen, Play, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { tauriApi, type OperationProgressPayload } from "../api/tauriApi";
import { nextDefaultScanFolders } from "../hooks/useAppSettings";
import type { Language } from "../i18n";
import type {
  CloseBehavior,
  DefaultScanFolder,
  FileQueryResult,
  FileRecord,
  FolderNamingLanguage,
  OperationLog,
  OperationPreview,
  RestoreRetentionDays,
  Lifecycle,
  Purpose,
  Rule,
  RuleCondition,
  RuleConditionGroup,
  RuleOperator
} from "../types/domain";
import type { ThemeMode, Translator, View } from "../types/ui";
import { formatBytes, percent } from "../utils/format";
import {
  compactPath,
  defaultPlatformAccelerator,
  localId,
  nowIso
} from "../utils/viewHelpers";
import { shouldVirtualizeList } from "../utils/virtualization";
import { OperationProgressPanel } from "./timeline/TimelineView";
import { revealFileFromCard } from "./shared/cardActions";
import {
  compactRowSurface,
  formGrid,
  itemMotion,
  listMotion,
  mutedText,
  pageSurface,
  panelSurface,
  quietText,
  rowSurface,
  segmented,
  segmentButton,
  sourceBadge,
  toggleSwitch
} from "./shared/ui";
import {
  cn,
  emptyState,
  glassButton,
  glassButtonPrimary,
  inputSurface,
  sectionTitle,
  selectSurface,
  statusToast,
  toneClasses,
  virtualList,
  virtualRow as virtualRowClass,
  virtualSpacer
} from "../utils/tw";

const RULE_ROW_HEIGHT = 68;

const RULE_FIELD_OPTIONS = [
  "name",
  "extension",
  "file_type",
  "path",
  "directory",
  "size",
  "modified_at",
  "risk_level"
] as const satisfies readonly RuleCondition["field"][];
const RULE_OPERATOR_OPTIONS = [
  "contains",
  "equals",
  "startsWith",
  "endsWith",
  "greaterThan",
  "lessThan",
  "olderThanDays",
  "newerThanDays"
] as const satisfies readonly RuleCondition["operator"][];
const RULE_PURPOSE_OPTIONS = ["Temporary", "Career", "Finance", "Study", "Project", "Personal", "Media", "Unknown"] as const satisfies readonly Purpose[];
const RULE_LIFECYCLE_OPTIONS = ["Inbox", "Active", "Reference", "Archive", "Disposable", "Sensitive"] as const satisfies readonly Lifecycle[];
const RULE_LOGIC_OPTIONS = ["AND", "OR"] as const satisfies readonly RuleOperator[];
export interface RuleBuilderDraft {
  id?: string;
  name: string;
  rootOperator: RuleOperator;
  groups: RuleConditionGroup[];
  purpose: Purpose;
  lifecycle: Lifecycle;
  weight: number;
  now: string;
}

export function buildRuleFromBuilderDraft(draft: RuleBuilderDraft): Rule {
  return {
    id: draft.id ?? localId("rule"),
    name: draft.name,
    source: "user",
    enabled: true,
    priority: 75,
    weight: draft.weight,
    root_operator: draft.rootOperator,
    groups: draft.groups.map((group) => ({
      ...group,
      conditions: group.conditions.map((condition) => ({ ...condition }))
    })),
    action: {
      purpose: draft.purpose,
      lifecycle: draft.lifecycle,
      suggested_action: "Move",
      target_template: "00_Inbox/Screenshots",
      context: "Screenshots"
    },
    created_at: draft.now,
    updated_at: draft.now
  };
}

function createRuleCondition(overrides: Partial<RuleCondition> = {}): RuleCondition {
  return {
    id: localId("cond"),
    field: "name",
    operator: "contains",
    value: "screenshot",
    ...overrides
  };
}

function createRuleGroup(conditionOverrides: Partial<RuleCondition> = {}): RuleConditionGroup {
  return {
    id: localId("group"),
    operator: "AND",
    conditions: [createRuleCondition(conditionOverrides)]
  };
}

export { ScannerView } from "./scanner/ScannerView";

export { HubView } from "./hub/HubView";

export { VaultView } from "./vault/VaultView";

export { TimelineView } from "./timeline/TimelineView";

export function RulesView({
  rules,
  onSave,
  onToggleRuleEnabled,
  onDeleteRule,
  t
}: {
  rules: Rule[];
  onSave: (rule: Rule) => Promise<void>;
  onToggleRuleEnabled?: (rule: Rule, enabled: boolean) => Promise<void> | void;
  onDeleteRule?: (rule: Rule) => Promise<void> | void;
  t: Translator;
}) {
  const [name, setName] = useState("Screenshots to Inbox");
  const [rootOperator, setRootOperator] = useState<RuleOperator>("AND");
  const [groups, setGroups] = useState<RuleConditionGroup[]>(() => [createRuleGroup()]);
  const [purpose, setPurpose] = useState<Purpose>("Temporary");
  const [lifecycle, setLifecycle] = useState<Lifecycle>("Inbox");
  const [weight, setWeight] = useState(76);

  function updateGroupOperator(groupId: string, nextOperator: RuleOperator) {
    setGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, operator: nextOperator } : group))
    );
  }

  function updateCondition(groupId: string, conditionId: string, patch: Partial<RuleCondition>) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map((condition) =>
                condition.id === conditionId ? { ...condition, ...patch } : condition
              )
            }
          : group
      )
    );
  }

  function addCondition(groupId: string) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? { ...group, conditions: [...group.conditions, createRuleCondition({ value: "" })] }
          : group
      )
    );
  }

  function removeCondition(groupId: string, conditionId: string) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId && group.conditions.length > 1
          ? { ...group, conditions: group.conditions.filter((condition) => condition.id !== conditionId) }
          : group
      )
    );
  }

  function addGroup() {
    setGroups((current) => [...current, createRuleGroup({ value: "" })]);
  }

  function removeGroup(groupId: string) {
    setGroups((current) =>
      current.length > 1 ? current.filter((group) => group.id !== groupId) : current
    );
  }

  async function submit() {
    const now = nowIso();
    await onSave(buildRuleFromBuilderDraft({
      name,
      rootOperator,
      groups,
      purpose,
      lifecycle,
      weight,
      now
    }));
  }

  return (
    <div className={cn(pageSurface, "grid grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] gap-4 overflow-hidden")}>
      <section className={panelSurface}>
        <SectionTitle title={t("ruleBuilder")} body={t("customDesc")} />
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/25 p-3 text-sm dark:bg-white/5">
          <span>{t("whenFile")}</span>
          <strong className="rounded-full bg-blue-500/10 px-2 py-1 text-blue-600 dark:text-blue-300">{groups.length} {t("ruleGroups")}</strong>
          <strong className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-300">{rootOperator}</strong>
          <span>{t("thenSendTo")}</span>
          <strong className="rounded-full bg-violet-500/10 px-2 py-1 text-violet-600 dark:text-violet-300">{purpose}</strong>
        </div>
        <div className={formGrid}>
          <label>{t("ruleName")}<input className={inputSurface} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="grid gap-1.5 text-sm font-medium text-[var(--muted)]">
            <span>{t("rootOperator")}</span>
            <div className={segmented} role="group" aria-label={t("rootOperator")}>
              {RULE_LOGIC_OPTIONS.map((item) => (
                <button key={item} type="button" className={segmentButton(rootOperator === item)} onClick={() => setRootOperator(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <label>{t("purpose")}<select className={selectSurface} value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)}>{RULE_PURPOSE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>{t("lifecycle")}<select className={selectSurface} value={lifecycle} onChange={(event) => setLifecycle(event.target.value as Lifecycle)}>{RULE_LIFECYCLE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>{t("weight")}<input className={inputSurface} type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></label>
        </div>
        <div className="mt-4 grid gap-3">
          {groups.map((group, groupIndex) => (
            <div key={group.id} className="rounded-2xl border border-[var(--line)] bg-white/25 p-3 shadow-sm dark:bg-white/5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong className="block text-sm">{t("ruleGroup")} {groupIndex + 1}</strong>
                  <span className={quietText}>{group.conditions.length} {t("conditions")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={quietText}>{t("groupOperator")}</span>
                  <div className={segmented} role="group" aria-label={`${t("ruleGroup")} ${groupIndex + 1} ${t("groupOperator")}`}>
                    {RULE_LOGIC_OPTIONS.map((item) => (
                      <button key={item} type="button" className={segmentButton(group.operator === item)} onClick={() => updateGroupOperator(group.id, item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:bg-transparent disabled:hover:text-[var(--muted)] dark:hover:text-red-300"
                    disabled={groups.length <= 1}
                    aria-label={t("deleteGroup")}
                    title={t("deleteGroup")}
                    onClick={() => removeGroup(group.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                {group.conditions.map((condition) => (
                  <div key={condition.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-2">
                    <select
                      className={selectSurface}
                      value={condition.field}
                      aria-label={t("field")}
                      onChange={(event) => updateCondition(group.id, condition.id, { field: event.target.value as RuleCondition["field"] })}
                    >
                      {RULE_FIELD_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select
                      className={selectSurface}
                      value={condition.operator}
                      aria-label={t("operator")}
                      onChange={(event) => updateCondition(group.id, condition.id, { operator: event.target.value as RuleCondition["operator"] })}
                    >
                      {RULE_OPERATOR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input
                      className={inputSurface}
                      value={String(condition.value)}
                      aria-label={t("value")}
                      onChange={(event) => updateCondition(group.id, condition.id, { value: event.target.value })}
                    />
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:bg-transparent disabled:hover:text-[var(--muted)] dark:hover:text-red-300"
                      disabled={group.conditions.length <= 1}
                      aria-label={t("deleteCondition")}
                      title={t("deleteCondition")}
                      onClick={() => removeCondition(group.id, condition.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className={cn(glassButton, "mt-3")} onClick={() => addCondition(group.id)}>
                <Plus size={15} />
                {t("addCondition")}
              </button>
            </div>
          ))}
          <button type="button" className={glassButton} onClick={addGroup}>
            <Plus size={15} />
            {t("addGroup")}
          </button>
        </div>
        <button className={cn(glassButtonPrimary, "mt-4")} onClick={submit}>
          <Plus size={17} />
          {t("saveRule")}
        </button>
      </section>

      <section className={cn(panelSurface, "overflow-hidden")}>
        <SectionTitle title={t("strategy")} body={t("ruleLayerDesc")} />
        <VirtualRuleList
          rules={rules}
          onToggleRuleEnabled={onToggleRuleEnabled}
          onDeleteRule={onDeleteRule}
          t={t}
        />
      </section>
    </div>
  );
}

function VirtualRuleList({
  rules,
  onToggleRuleEnabled,
  onDeleteRule,
  t
}: {
  rules: Rule[];
  onToggleRuleEnabled?: (rule: Rule, enabled: boolean) => Promise<void> | void;
  onDeleteRule?: (rule: Rule) => Promise<void> | void;
  t: Translator;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = shouldVirtualizeList(rules.length);
  const rowVirtualizer = useVirtualizer({
    count: rules.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => RULE_ROW_HEIGHT,
    overscan: 8
  });

  if (!shouldVirtualize) {
    return (
      <motion.div className="grid gap-2" variants={listMotion} initial="hidden" animate="show">
        {rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onToggleEnabled={onToggleRuleEnabled}
            onDeleteRule={onDeleteRule}
            t={t}
          />
        ))}
      </motion.div>
    );
  }

  return (
    <div ref={parentRef} className={cn("h-[calc(100vh-260px)]", virtualList)}>
      <div className={virtualSpacer} style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rule = rules[virtualRow.index];
          return (
            <div
              className={virtualRowClass}
              key={rule.id}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <RuleRow
                rule={rule}
                onToggleEnabled={onToggleRuleEnabled}
                onDeleteRule={onDeleteRule}
                t={t}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RuleRow = memo(function RuleRow({
  rule,
  onToggleEnabled,
  onDeleteRule,
  t
}: {
  rule: Rule;
  onToggleEnabled?: (rule: Rule, enabled: boolean) => Promise<void> | void;
  onDeleteRule?: (rule: Rule) => Promise<void> | void;
  t: Translator;
}) {
  const canToggle = rule.source === "user" && Boolean(onToggleEnabled);
  const canDelete = rule.source === "user" && Boolean(onDeleteRule);
  const toggleLabel = canToggle
    ? rule.enabled
      ? t("disableRule")
      : t("enableRule")
    : t("systemRuleLocked");
  const deleteLabel = canDelete ? t("deleteRule") : t("systemRuleCannotDelete");

  return (
    <motion.div className={cn(compactRowSurface, "grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3")} layout variants={itemMotion}>
      <div>
        <strong className="block truncate text-sm">{rule.name}</strong>
        <span className="block text-xs text-[var(--muted)]">{rule.source} / weight {rule.weight} / priority {rule.priority}</span>
      </div>
      <span className={sourceBadge(rule.source)}>{rule.source}</span>
      <button
        type="button"
        className={toggleSwitch(rule.enabled)}
        disabled={!canToggle}
        aria-pressed={rule.enabled}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={(event) => {
          event.stopPropagation();
          if (!canToggle) return;
          void onToggleEnabled?.(rule, !rule.enabled);
        }}
      >
        <i />
      </button>
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:bg-transparent disabled:hover:text-[var(--muted)] dark:hover:text-red-300"
        disabled={!canDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={(event) => {
          event.stopPropagation();
          if (!canDelete || !window.confirm(t("confirmDeleteRule"))) return;
          void onDeleteRule?.(rule);
        }}
      >
        <Trash2 size={15} />
      </button>
    </motion.div>
  );
});

export function RestoreView({
  logs,
  onRestore,
  operationProgress,
  isOperationCanceling,
  cancelOperations,
  t
}: {
  logs: OperationLog[];
  onRestore: (logs: OperationLog[]) => Promise<void>;
  operationProgress: OperationProgressPayload | null;
  isOperationCanceling: boolean;
  cancelOperations: () => Promise<void>;
  t: Translator;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const batches = useMemo(() => groupOperationLogs(logs), [logs]);
  const selectedBatch = batches.find((batch) => batch.batchId === selectedBatchId) ?? batches[0];
  const restorableLogs = selectedBatch?.logs.filter(isRestorableLog) ?? [];
  const restoreProgress = operationProgress?.kind === "restore" ? operationProgress : null;
  const isRestoring = Boolean(restoreProgress);
  const historyLogs = useMemo(
    () => [...logs].sort((a, b) => logTimeValue(b.created_at) - logTimeValue(a.created_at)).slice(0, 8),
    [logs]
  );

  useEffect(() => {
    if (!batches.length) {
      setSelectedBatchId("");
      return;
    }
    if (!selectedBatchId || !batches.some((batch) => batch.batchId === selectedBatchId)) {
      setSelectedBatchId(batches[0].batchId);
    }
  }, [batches, selectedBatchId]);

  async function restoreSelectedBatch() {
    if (!restorableLogs.length || isRestoring) return;
    await onRestore(restorableLogs);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)] gap-4 overflow-hidden">
      <section className={cn(panelSurface, "overflow-auto")}>
        <SectionTitle title={t("restoreRecords")} body={t("restoreDesc")} />
        {batches.length ? (
          <div className="grid gap-2">
            {batches.map((batch) => (
              <button
                className={cn(
                  rowSurface,
                  "w-full",
                  batch.batchId === selectedBatch?.batchId && "border-blue-400/60 bg-blue-500/10"
                )}
                key={batch.batchId}
                onClick={() => setSelectedBatchId(batch.batchId)}
              >
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <RotateCcw size={16} />
                  <strong>{formatLogDate(batch.createdAt)}</strong>
                </div>
                <div>
                  <strong className="block text-sm">{batch.total} {t("items")} / {batch.restorable} {t("restorable")}</strong>
                  <small className={mutedText}>
                    {t("success")}: {batch.success} · {t("failed")}: {batch.failed} · {t("restored")}: {batch.restored}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={emptyState}>{t("noRestoreRecords")}</div>
        )}
        <div className="my-5 h-px bg-[var(--line-dark)]" />
        <SectionTitle title={t("operationHistory")} body={t("timeMachineDesc")} />
        {historyLogs.length ? (
          <div className="grid gap-2">
            {historyLogs.map((log) => (
              <div className={cn(compactRowSurface, "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3")} key={log.id}>
                <span className={cn("h-2.5 w-2.5 rounded-full", log.status === "success" ? "bg-emerald-500" : "bg-red-500")} />
                <div>
                  <strong className="block truncate text-sm">{log.new_name || log.old_name}</strong>
                  <span className="block text-xs text-[var(--muted)]">{log.operation_type} · {formatLogDate(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(emptyState, "min-h-20")}>{t("noOperationHistory")}</div>
        )}
      </section>

      <section className={cn(panelSurface, "overflow-auto")}>
        <div className={cn(sectionTitle, "items-center")}>
          <div>
            <h2>{t("restorePreview")}</h2>
            <p>{t("restorePreviewDesc")}</p>
          </div>
          <button
            className={glassButtonPrimary}
            disabled={!restorableLogs.length || isRestoring}
            onClick={restoreSelectedBatch}
          >
            <RotateCcw size={16} />
            {isRestoring ? t("restoring") : t("restoreBatch")}
          </button>
        </div>
        {restoreProgress && (
          <OperationProgressPanel
            progress={restoreProgress}
            isCanceling={isOperationCanceling}
            onCancel={cancelOperations}
            t={t}
          />
        )}
        {selectedBatch ? (
          <div className="grid gap-2">
            {selectedBatch.logs.map((log) => {
              const isRestorable = isRestorableLog(log);
              return (
                <div className={cn(rowSurface, isRestorable ? "border-emerald-400/40 bg-emerald-500/10" : "border-slate-400/20 opacity-80")} key={log.id}>
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    {isRestorable ? <Check size={15} /> : <X size={15} />}
                    <strong>{restoreStatusLabel(log, t)}</strong>
                  </div>
                  <div>
                    <strong className="block truncate text-sm">{log.new_name || log.old_name}</strong>
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-[var(--muted)]">
                      <span title={log.path_after}>{compactPath(log.path_after, 48)}</span>
                      <ChevronRight size={14} />
                      <span title={log.path_before}>{compactPath(log.path_before, 48)}</span>
                    </div>
                    {(log.restore_error || log.error_message) && (
                      <small className="mt-2 block text-xs text-red-500">{log.restore_error || log.error_message}</small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={cn(emptyState, "min-h-20")}>{t("noRestorePreview")}</div>
        )}
      </section>
    </div>
  );
}

interface OperationLogBatch {
  batchId: string;
  createdAt: string;
  logs: OperationLog[];
  total: number;
  success: number;
  failed: number;
  restored: number;
  restorable: number;
}

function groupOperationLogs(logs: OperationLog[]): OperationLogBatch[] {
  const groups = new Map<string, OperationLog[]>();
  for (const log of logs) {
    const key = log.batch_id || "batch";
    const group = groups.get(key) ?? [];
    group.push(log);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([batchId, batchLogs]) => {
      const sortedLogs = [...batchLogs].sort((a, b) => logTimeValue(b.created_at) - logTimeValue(a.created_at));
      return {
        batchId,
        createdAt: sortedLogs[0]?.created_at ?? "",
        logs: sortedLogs,
        total: sortedLogs.length,
        success: sortedLogs.filter((log) => log.status === "success").length,
        failed: sortedLogs.filter((log) => log.status === "failed").length,
        restored: sortedLogs.filter((log) => log.restore_status === "restored").length,
        restorable: sortedLogs.filter(isRestorableLog).length
      };
    })
    .sort((a, b) => logTimeValue(b.createdAt) - logTimeValue(a.createdAt));
}

function isRestorableLog(log: OperationLog): boolean {
  return (
    log.status === "success" &&
    log.can_restore &&
    (log.restore_status === "not_restored" || log.restore_status === "failed" || log.restore_status === "canceled")
  );
}

function restoreStatusLabel(log: OperationLog, t: Translator): string {
  if (log.restore_status === "restored") return t("restored");
  if (log.restore_status === "failed") return t("failed");
  if (log.restore_status === "canceled") return t("operationCanceled");
  if (isRestorableLog(log)) return t("restorable");
  if (log.status === "skipped") return t("skipped");
  return t("unavailable");
}

function formatLogDate(value: string): string {
  const timestamp = logTimeValue(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function logTimeValue(value: string): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SettingsView({
  language,
  setLanguage,
  theme,
  setTheme,
  platform,
  closeBehavior,
  setCloseBehavior,
  folderNamingLanguage,
  setFolderNamingLanguage,
  defaultScanFolders,
  setDefaultScanFolders,
  restoreRetentionDays,
  setRestoreRetentionDays,
  launchAtLogin,
  setLaunchAtLogin,
  t
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  platform: NodeJS.Platform | "browser";
  closeBehavior: CloseBehavior;
  setCloseBehavior: (behavior: CloseBehavior) => Promise<boolean>;
  folderNamingLanguage: FolderNamingLanguage;
  setFolderNamingLanguage: (language: FolderNamingLanguage) => Promise<boolean>;
  defaultScanFolders: DefaultScanFolder[];
  setDefaultScanFolders: (folders: DefaultScanFolder[]) => Promise<boolean>;
  restoreRetentionDays: RestoreRetentionDays;
  setRestoreRetentionDays: (days: RestoreRetentionDays) => Promise<boolean>;
  launchAtLogin: boolean;
  setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
  t: Translator;
}) {
  const hotkey = defaultPlatformAccelerator(platform);
  const [settingsStatus, setSettingsStatus] = useState("");

  async function updateCloseBehavior(next: CloseBehavior) {
    const saved = await setCloseBehavior(next);
    if (saved) {
      setSettingsStatus(t("settingSaved"));
    }
  }

  async function updateFolderNamingLanguage(next: FolderNamingLanguage) {
    const saved = await setFolderNamingLanguage(next);
    if (saved) {
      setSettingsStatus(t("settingSaved"));
    }
  }

  async function updateLaunchAtLogin(next: boolean) {
    const saved = await setLaunchAtLogin(next);
    if (saved) {
      setSettingsStatus(t("settingSaved"));
    }
  }

  async function toggleDefaultScanFolder(folder: DefaultScanFolder) {
    const saved = await setDefaultScanFolders(nextDefaultScanFolders(defaultScanFolders, folder));
    if (saved) {
      setSettingsStatus(`${t("settingSaved")} · ${t("defaultScanFoldersRestartHint")}`);
    }
  }

  async function updateRestoreRetentionDays(next: RestoreRetentionDays) {
    const saved = await setRestoreRetentionDays(next);
    if (saved) {
      setSettingsStatus(t("settingSaved"));
    }
  }

  return (
    <div className={cn(pageSurface, "grid grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)] gap-4 overflow-hidden")}>
      <section className={cn(panelSurface, "overflow-auto")}>
        <SectionTitle title={t("settings")} body={t("settingsDesc")} />
        <div className="grid gap-3">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("language")}</strong><span className={mutedText}>{t("languageDesc")}</span></div>
          <div className={segmented}>
            <button className={segmentButton(language === "zh")} onClick={() => setLanguage("zh")}>中文</button>
            <button className={segmentButton(language === "en")} onClick={() => setLanguage("en")}>English</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("appearance")}</strong><span className={mutedText}>{t("appearanceDesc")}</span></div>
          <div className={segmented}>
            <button className={segmentButton(theme === "light")} onClick={() => setTheme("light")}>{t("lightTheme")}</button>
            <button className={segmentButton(theme === "dark")} onClick={() => setTheme("dark")}>{t("darkTheme")}</button>
            <button className={segmentButton(theme === "system")} onClick={() => setTheme("system")}>{t("systemTheme")}</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("folderNaming")}</strong><span className={mutedText}>{t("folderNamingDesc")}</span></div>
          <div className={segmented}>
            <button className={segmentButton(folderNamingLanguage === "en")} onClick={() => void updateFolderNamingLanguage("en")}>{t("englishFolderNames")}</button>
            <button className={segmentButton(folderNamingLanguage === "zh")} onClick={() => void updateFolderNamingLanguage("zh")}>{t("chineseFolderNames")}</button>
          </div>
        </div>
        <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("defaultScanFolders")}</strong><span className={mutedText}>{t("defaultScanFoldersDesc")}</span></div>
          <div className="flex flex-wrap gap-2">
            {(["Desktop", "Downloads", "Documents"] as DefaultScanFolder[]).map((folder) => (
              <button className={segmentButton(defaultScanFolders.includes(folder))} key={folder} onClick={() => void toggleDefaultScanFolder(folder)}>
                {folder}
              </button>
            ))}
          </div>
          <span className={quietText}>{t("defaultScanFoldersRestartHint")}</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("searchHotkey")}</strong><span className={mutedText}>{t("searchHotkeyDesc")}</span></div>
          <span className="rounded-xl border border-[var(--line)] bg-white/25 px-3 py-1.5 text-sm font-medium text-[var(--ink)] dark:bg-white/5">{hotkey}</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("launchAtLogin")}</strong><span className={mutedText}>{t("launchAtLoginDesc")}</span></div>
          <button className={toggleSwitch(launchAtLogin)} onClick={() => void updateLaunchAtLogin(!launchAtLogin)}><i /></button>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("closeBehavior")}</strong><span className={mutedText}>{t("closeBehaviorDesc")}</span></div>
          <div className={segmented}>
            <button className={segmentButton(closeBehavior === "ask")} onClick={() => void updateCloseBehavior("ask")}>{t("askEveryTime")}</button>
            <button className={segmentButton(closeBehavior === "minimize")} onClick={() => void updateCloseBehavior("minimize")}>{t("minimizeToTray")}</button>
            <button className={segmentButton(closeBehavior === "quit")} onClick={() => void updateCloseBehavior("quit")}>{t("quitApp")}</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("logRetention")}</strong><span className={mutedText}>{t("logRetentionDesc")}</span></div>
          <div className={segmented}>
            {([15, 30, 60, 90] as RestoreRetentionDays[]).map((days) => (
              <button className={segmentButton(restoreRetentionDays === days)} key={days} onClick={() => void updateRestoreRetentionDays(days)}>
                {days} {t("days")}
              </button>
            ))}
          </div>
        </div>
        </div>
        {settingsStatus && <div className={cn(statusToast, "mt-4")}>{settingsStatus}</div>}
      </section>

      <section className={panelSurface}>
        <SectionTitle title={t("releaseReady")} body={t("releaseReadyDesc")} />
        <div className="grid gap-3">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("searchSources")}</strong><span className={mutedText}>{t("searchSourcesDesc")}</span></div>
          <span className={sourceBadge("user_space")}>{t("localOnly")}</span>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/20 p-3 dark:bg-white/5">
          <div><strong className="block text-sm">{t("excludedDirs")}</strong><span className={mutedText}>node_modules, .git, target, dist, build</span></div>
        </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, body }: { title: string; body: string }) {
  return (
    <div className={sectionTitle}>
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
    </div>
  );
}
