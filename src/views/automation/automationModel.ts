import type { LibraryScope, Lifecycle, Purpose, Rule, RuleCondition } from "../../types/domain";
import type { Translator } from "../../types/ui";

export type AutomationRunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "completed"; scanned: number; updated: number; skipped: number; needsConfirmation: number; warning?: string }
  | { kind: "failed"; message: string };

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
  if (scope.kind === "all") return { kind: "all" as const, roots: [] as string[] };
  return { kind: scope.kind, roots: scope.roots };
}

export function conditionFieldLabel(field: RuleCondition["field"], t: Translator) {
  return t(`automationField${field}` as Parameters<Translator>[0]);
}

export function conditionOperatorLabel(operator: RuleCondition["operator"], t: Translator) {
  return t(`automationOperator${operator}` as Parameters<Translator>[0]);
}

export function conditionSummary(condition: RuleCondition, t: Translator) {
  return `${conditionFieldLabel(condition.field, t)} ${conditionOperatorLabel(condition.operator, t)} ${String(condition.value)}`;
}

export function ruleConditionSummary(rule: Rule, t: Translator) {
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
  return [rule.action.purpose ? purposeLabel(rule.action.purpose, t) : "", rule.action.lifecycle ? lifecycleLabel(rule.action.lifecycle, t) : "", rule.action.suggested_action]
    .filter(Boolean)
    .join(" · ");
}

export function validateRuleDraft(name: string, groups: Rule["groups"]) {
  const errors: { name?: string; conditions?: string } = {};
  if (!name.trim()) errors.name = "required";
  if (!groups.length || groups.some((group) => !group.conditions.length || group.conditions.some((condition) => typeof condition.value === "string" && !condition.value.trim()))) {
    errors.conditions = "required";
  }
  return errors;
}
