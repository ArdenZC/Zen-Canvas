import type { LibraryScope, Lifecycle, Purpose, Rule, RuleCondition } from "../../types/domain";
import type { Translator } from "../../types/ui";
import {
  conditionOptions,
  conditionValueText,
  validateRuleDraft,
  type ConditionValidationError,
  type RuleDraftValidation
} from "../rules/ruleBuilder";

export interface AutomationRunContext {
  generationId: number;
  scopeSignature: string;
  enabledRuleVersion: string;
  triggerTime: string;
}

export type AutomationRunState =
  | { kind: "idle" }
  | { kind: "running"; context: AutomationRunContext }
  | { kind: "completed"; context: AutomationRunContext; scanned: number; updated: number; skipped: number; needsConfirmation: number; warning?: string }
  | { kind: "failed"; context: AutomationRunContext; message: string }
  | { kind: "stale"; context?: AutomationRunContext };

export function automationOverview(rules: Rule[], needsReview: number) {
  const editable = rules.filter((rule) => rule.source === "user");
  return {
    total: editable.length,
    enabled: editable.filter((rule) => rule.enabled).length,
    paused: editable.filter((rule) => !rule.enabled).length,
    needsReview
  };
}

export function scopeSummary(scope: LibraryScope) {
  if (scope.kind === "all") return { kind: "all" as const, roots: [] as string[], scanSessionId: "" };
  return { kind: scope.kind, roots: scope.roots, scanSessionId: scope.kind === "current_scan" ? scope.scanSessionId ?? "" : "" };
}

export function libraryScopeSignature(scope: LibraryScope): string {
  const roots = scope.kind === "all" ? [] : [...scope.roots].map(normalizePath).sort();
  const session = scope.kind === "current_scan" ? scope.scanSessionId ?? "" : "";
  return `${scope.kind}|${session}|${roots.join("\u001f")}`;
}

function normalizePath(path: string) {
  return path.trim().replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase();
}

function hashText(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function enabledRulesVersion(rules: Rule[]): string {
  const payload = rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((rule) => ({
      id: rule.id,
      source: rule.source,
      enabled: rule.enabled,
      priority: rule.priority,
      weight: rule.weight,
      root_operator: rule.root_operator,
      groups: rule.groups,
      action: rule.action,
      updated_at: rule.updated_at
    }));
  return `rules-${hashText(JSON.stringify(payload))}`;
}

export function createAutomationRunContext(generationId: number, scope: LibraryScope, rules: Rule[], triggerTime = new Date().toISOString()): AutomationRunContext {
  return {
    generationId,
    scopeSignature: libraryScopeSignature(scope),
    enabledRuleVersion: enabledRulesVersion(rules),
    triggerTime
  };
}

export function acceptsAutomationRunResult(
  context: AutomationRunContext,
  mounted: boolean,
  currentGenerationId: number,
  currentScopeSignature: string,
  currentEnabledRuleVersion: string
) {
  return mounted
    && context.generationId === currentGenerationId
    && context.scopeSignature === currentScopeSignature
    && context.enabledRuleVersion === currentEnabledRuleVersion;
}

export function conditionFieldLabel(field: RuleCondition["field"], t: Translator) {
  return t(`automationField${field}` as Parameters<Translator>[0]);
}

export function conditionOperatorLabel(operator: RuleCondition["operator"], t: Translator) {
  return t(`automationOperator${operator}` as Parameters<Translator>[0]);
}

export function conditionValueLabel(condition: RuleCondition, t: Translator) {
  if (condition.field === "is_duplicate") return condition.value === true || condition.value === "true" ? t("automationBooleanTrue") : t("automationBooleanFalse");
  if (condition.field === "file_type") return t(`libraryType${conditionValueText(condition.value) === "ArchivePackage" ? "Archive" : conditionValueText(condition.value)}` as Parameters<Translator>[0]);
  if (condition.field === "risk_level") return t(`libraryRisk${conditionValueText(condition.value)}` as Parameters<Translator>[0]);
  return conditionValueText(condition.value);
}

export function conditionSummary(condition: RuleCondition, t: Translator) {
  if (!validateRuleDraft("rule", [{ id: "summary", operator: "AND", conditions: [condition] }]).valid) return t("automationConditionIncomplete");
  return `${conditionFieldLabel(condition.field, t)} ${conditionOperatorLabel(condition.operator, t)} ${conditionValueLabel(condition, t)}`;
}

export function ruleConditionSummary(rule: Rule, t: Translator) {
  if (!rule.groups.length) return t("automationNoConditions");
  return rule.groups
    .map((group) => group.conditions.map((condition) => conditionSummary(condition, t)).join(` ${t(group.operator === "AND" ? "automationLogicAnd" : "automationLogicOr")} `))
    .join(` ${t(rule.root_operator === "AND" ? "automationLogicAnd" : "automationLogicOr")} `);
}

export function purposeLabel(value: Purpose, t: Translator) {
  return t(`libraryPurpose${value}` as Parameters<Translator>[0]);
}

export function lifecycleLabel(value: Lifecycle, t: Translator) {
  return t(`libraryLifecycle${value}` as Parameters<Translator>[0]);
}

export function ruleActionSummary(rule: Rule, t: Translator) {
  return [rule.action.purpose ? purposeLabel(rule.action.purpose, t) : "", rule.action.lifecycle ? lifecycleLabel(rule.action.lifecycle, t) : ""]
    .filter(Boolean)
    .join(" · ");
}

export function draftActionSummary(purpose: Purpose, lifecycle: Lifecycle, t: Translator) {
  return `${purposeLabel(purpose, t)} · ${lifecycleLabel(lifecycle, t)}`;
}

export function draftConditionSummary(groups: Rule["groups"], rootOperator: Rule["root_operator"], t: Translator) {
  if (!groups.length || groups.some((group) => !group.conditions.length)) return t("automationConditionIncomplete");
  return groups
    .map((group) => group.conditions.map((condition) => conditionSummary(condition, t)).join(` ${t(group.operator === "AND" ? "automationLogicAnd" : "automationLogicOr")} `))
    .join(` ${t(rootOperator === "AND" ? "automationLogicAnd" : "automationLogicOr")} `);
}

export { conditionOptions, validateRuleDraft };
export type { ConditionValidationError, RuleDraftValidation };
