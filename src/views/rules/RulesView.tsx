import { memo, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext, useRulesContext } from "../../contexts/AppContexts";
import { useAppStore } from "../../store/useAppStore";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import type { Lifecycle, Purpose, Rule, RuleCondition, RuleConditionGroup, RuleOperator } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { nowIso, readableError } from "../../utils/viewHelpers";
import { shouldVirtualizeList } from "../../utils/virtualization";
import { buttonIconDanger, buttonSecondary, cn, glassButton, glassButtonPrimary, glassButtonWarning, inputSurface, selectSurface, virtualList, virtualRow as virtualRowClass, virtualSpacer } from "../../utils/tw";
import {
  ConfirmDialog,
  NoticeBanner,
  StateBlock,
  ToneBadge,
  compactInteractiveRow,
  contentPanel,
  formGrid,
  itemMotion,
  listMotion,
  pageSurface,
  panelSurface,
  quietText,
  segmented,
  segmentButton,
  softPanel,
  toggleSwitch,
  SectionTitle
} from "../shared/ui";
import {
  RULE_FIELD_OPTIONS,
  RULE_LIFECYCLE_OPTIONS,
  RULE_LOGIC_OPTIONS,
  RULE_OPERATOR_OPTIONS,
  RULE_PURPOSE_OPTIONS,
  buildRuleFromBuilderDraft,
  createRuleCondition,
  createRuleGroup
} from "./ruleBuilder";

const RULE_ROW_HEIGHT = 68;

type ConfirmState =
  | { kind: "deleteRule"; rule: Rule }
  | { kind: "reapplyRules" };

export function RulesView() {
  const { t, onError } = useChromeContext();
  const {
    rules,
    saveRule: onSave,
    toggleRuleEnabled: onToggleRuleEnabled,
    deleteRule: onDeleteRule
  } = useRulesContext();
  const [name, setName] = useState("Screenshots to Inbox");
  const [rootOperator, setRootOperator] = useState<RuleOperator>("AND");
  const [groups, setGroups] = useState<RuleConditionGroup[]>(() => [createRuleGroup()]);
  const [purpose, setPurpose] = useState<Purpose>("Temporary");
  const [lifecycle, setLifecycle] = useState<Lifecycle>("Inbox");
  const [weight, setWeight] = useState(76);
  const [isReapplyingRules, setIsReapplyingRules] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [reapplyStatus, setReapplyStatus] = useState("");
  const reapplyLockedRef = useRef(false);
  const systemRules = useMemo(() => rules.filter((rule) => rule.source === "system"), [rules]);
  const userRules = useMemo(() => rules.filter((rule) => rule.source !== "system"), [rules]);
  const expectedResultText = t("ruleExpectedResultIntro")
    .replace("{purpose}", purpose)
    .replace("{lifecycle}", lifecycle);

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
    setConfirmState({ kind: "reapplyRules" });
  }

  async function reapplyRulesToCurrentScope() {
    if (reapplyLockedRef.current) return;
    reapplyLockedRef.current = true;
    setIsReapplyingRules(true);
    setReapplyStatus("");

    try {
      const scope = useFileLibraryStore.getState().scope;
      const summary = await tauriApi.executeRulesForScope(
        scope,
        rules,
        "all_changed_or_rule_changed"
      );
      await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
      setReapplyStatus(
        `${t("rulesReapplied")}: ${summary.updated.toLocaleString()} / ${summary.scanned.toLocaleString()} (${t("skipped")}: ${summary.skipped.toLocaleString()})`
      );
    } catch (error) {
      onError(readableError(error));
    } finally {
      reapplyLockedRef.current = false;
      setIsReapplyingRules(false);
    }
  }

  async function handleToggleRuleEnabled(rule: Rule, enabled: boolean) {
    await onToggleRuleEnabled?.(rule, enabled);
    setConfirmState({ kind: "reapplyRules" });
  }

  async function confirmDeleteRule(rule: Rule) {
    await onDeleteRule?.(rule);
    setConfirmState({ kind: "reapplyRules" });
  }

  async function handleConfirmDialog() {
    if (!confirmState || isConfirming) return;
    setIsConfirming(true);
    try {
      if (confirmState.kind === "deleteRule") {
        await confirmDeleteRule(confirmState.rule);
      } else {
        await reapplyRulesToCurrentScope();
        setConfirmState(null);
      }
    } finally {
      setIsConfirming(false);
    }
  }

  const confirmDialogTitle =
    confirmState?.kind === "deleteRule" ? t("confirmDeleteRuleTitle") : t("confirmReapplyRulesTitle");
  const confirmDialogDescription =
    confirmState?.kind === "deleteRule" ? t("confirmDeleteRule") : t("reapplyRulesSafetyDesc");
  const confirmDialogLabel =
    confirmState?.kind === "deleteRule" ? t("deleteRule") : t("reapplyRules");

  return (
    <>
      <div className={cn(pageSurface, "grid grid-cols-1 gap-4 overflow-auto xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] xl:overflow-hidden")}>
        <section className={cn(panelSurface, "grid gap-4")}>
          <SectionTitle title={t("ruleBuilder")} body={t("customDesc")} />

          <section className={cn(contentPanel, "grid gap-3 p-4")}>
            <SectionTitle title={t("ruleBasicInfo")} body={t("ruleLayerDesc")} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>{t("whenFile")}</span>
              <ToneBadge tone="info">{groups.length} {t("ruleGroups")}</ToneBadge>
              <ToneBadge tone="success">{rootOperator}</ToneBadge>
              <span>{t("thenSendTo")}</span>
              <ToneBadge tone="info">{purpose}</ToneBadge>
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
              <label>{t("weight")}<input className={inputSurface} type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></label>
            </div>
          </section>

          <section className={cn(contentPanel, "grid gap-3 p-4")}>
            <SectionTitle title={t("ruleConditions")} body={t("safeModeDesc")} />
            <div className="grid gap-3">
              {groups.map((group, groupIndex) => (
                <div key={group.id} className={cn(softPanel, "grid gap-3 p-3")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="block text-sm">{t("ruleGroup")} {groupIndex + 1}</strong>
                      <span className={quietText}>{group.conditions.length} {t("conditions")}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        className={buttonIconDanger}
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
                      <div key={condition.id} className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center">
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
                          className={buttonIconDanger}
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
                  <button type="button" className={buttonSecondary} onClick={() => addCondition(group.id)}>
                    <Plus size={15} />
                    {t("addCondition")}
                  </button>
                </div>
              ))}
              <button type="button" className={buttonSecondary} onClick={addGroup}>
                <Plus size={15} />
                {t("addGroup")}
              </button>
            </div>
          </section>

          <section className={cn(contentPanel, "grid gap-3 p-4")}>
            <SectionTitle title={t("ruleActions")} body={t("thenSendTo")} />
            <div className={formGrid}>
              <label>{t("purpose")}<select className={selectSurface} value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)}>{RULE_PURPOSE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label>{t("lifecycle")}<select className={selectSurface} value={lifecycle} onChange={(event) => setLifecycle(event.target.value as Lifecycle)}>{RULE_LIFECYCLE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
          </section>

          <NoticeBanner tone="info" title={t("ruleExpectedResult")}>
            <div className="grid gap-2">
              <span>{expectedResultText}</span>
              <span>{t("ruleNoAutoMove")} · {t("rulePreviewRequired")}</span>
            </div>
          </NoticeBanner>

          <button className={glassButtonPrimary} onClick={submit}>
            <Plus size={17} />
            {t("saveRule")}
          </button>
        </section>

        <section className={cn(panelSurface, "grid min-h-0 gap-4 overflow-hidden")}>
          <SectionTitle title={t("strategy")} body={t("ruleLayerDesc")} />
          <div className={cn(softPanel, "grid gap-3 p-4")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong className="block text-sm">{t("reapplyRules")}</strong>
                <span className={quietText}>{t("reapplyRulesSafetyDesc")}</span>
              </div>
              <button
                type="button"
                className={glassButtonWarning}
                disabled={isReapplyingRules}
                onClick={() => setConfirmState({ kind: "reapplyRules" })}
              >
                <RefreshCw size={15} className={cn(isReapplyingRules && "animate-spin")} />
                {t("reapplyRules")}
              </button>
            </div>
            {reapplyStatus ? <span className={quietText}>{reapplyStatus}</span> : null}
          </div>

          <div className="grid min-h-0 gap-4 overflow-auto pr-1">
            <RuleSection
              title={t("systemRuleTemplates")}
              description={t("systemRuleTemplatesDesc")}
              emptyTitle={t("systemRuleTemplates")}
              rules={systemRules}
              t={t}
            />
            <RuleSection
              title={t("userRules")}
              description={t("userRulesDesc")}
              emptyTitle={t("userRules")}
              rules={userRules}
              onToggleRuleEnabled={handleToggleRuleEnabled}
              onRequestDeleteRule={(rule) => setConfirmState({ kind: "deleteRule", rule })}
              t={t}
            />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        tone={confirmState?.kind === "deleteRule" ? "danger" : "warning"}
        title={confirmDialogTitle}
        description={confirmDialogDescription}
        confirmLabel={confirmDialogLabel}
        cancelLabel={t("cancel")}
        isProcessing={isConfirming || isReapplyingRules}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmDialog}
      />
    </>
  );
}

function RuleSection({
  title,
  description,
  emptyTitle,
  rules,
  onToggleRuleEnabled,
  onRequestDeleteRule,
  t
}: {
  title: string;
  description: string;
  emptyTitle: string;
  rules: Rule[];
  onToggleRuleEnabled?: (rule: Rule, enabled: boolean) => Promise<void> | void;
  onRequestDeleteRule?: (rule: Rule) => void;
  t: Translator;
}) {
  return (
    <section className={cn(contentPanel, "grid gap-3 p-4")}>
      <div>
        <h3 className="m-0 text-base font-semibold text-[var(--ink)]">{title}</h3>
        <p className={quietText}>{description}</p>
      </div>
      {rules.length ? (
        <VirtualRuleList
          rules={rules}
          onToggleRuleEnabled={onToggleRuleEnabled}
          onRequestDeleteRule={onRequestDeleteRule}
          t={t}
        />
      ) : (
        <StateBlock title={emptyTitle} description={description} />
      )}
    </section>
  );
}

function VirtualRuleList({
  rules,
  onToggleRuleEnabled,
  onRequestDeleteRule,
  t
}: {
  rules: Rule[];
  onToggleRuleEnabled?: (rule: Rule, enabled: boolean) => Promise<void> | void;
  onRequestDeleteRule?: (rule: Rule) => void;
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
            onRequestDeleteRule={onRequestDeleteRule}
            t={t}
          />
        ))}
      </motion.div>
    );
  }

  return (
    <div ref={parentRef} className={cn("max-h-[min(60vh,520px)]", virtualList)}>
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
                onRequestDeleteRule={onRequestDeleteRule}
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
  onRequestDeleteRule,
  t
}: {
  rule: Rule;
  onToggleEnabled?: (rule: Rule, enabled: boolean) => Promise<void> | void;
  onRequestDeleteRule?: (rule: Rule) => void;
  t: Translator;
}) {
  const canToggle = rule.source === "user" && Boolean(onToggleEnabled);
  const canDelete = rule.source === "user" && Boolean(onRequestDeleteRule);
  const toggleLabel = canToggle
    ? rule.enabled
      ? t("disableRule")
      : t("enableRule")
    : t("systemRuleLocked");
  const deleteLabel = canDelete ? t("deleteRule") : t("systemRuleCannotDelete");
  const sourceTone = rule.source === "system" ? "info" : "success";
  const stateTone = rule.enabled ? "success" : "slate";

  return (
    <motion.div
      className={cn(
        compactInteractiveRow({ disabled: rule.source === "system" }),
        "grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3"
      )}
      layout
      variants={itemMotion}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="truncate text-sm">{rule.name}</strong>
          <ToneBadge tone={rule.source === "system" ? "info" : "success"}>
            {rule.source === "system" ? t("lockedTemplate") : t("editableRule")}
          </ToneBadge>
        </div>
        <span className="block truncate text-xs text-[var(--muted)]">
          weight {rule.weight} / priority {rule.priority}
        </span>
      </div>
      <ToneBadge tone={sourceTone}>{rule.source}</ToneBadge>
      <ToneBadge tone={stateTone}>{rule.enabled ? t("enabled") : t("disabled")}</ToneBadge>
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
        className={buttonIconDanger}
        disabled={!canDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={(event) => {
          event.stopPropagation();
          if (!canDelete) return;
          onRequestDeleteRule?.(rule);
        }}
      >
        <Trash2 size={15} />
      </button>
    </motion.div>
  );
});

