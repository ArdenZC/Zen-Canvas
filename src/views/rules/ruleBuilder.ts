import type {
  ConditionField,
  ConditionOperator,
  FileType,
  Lifecycle,
  Purpose,
  RiskLevel,
  Rule,
  RuleCondition,
  RuleConditionGroup,
  RuleOperator
} from "../../types/domain";
import { localId } from "../../utils/viewHelpers";

export const RULE_FIELD_OPTIONS = [
  "name",
  "extension",
  "file_type",
  "path",
  "directory",
  "size",
  "modified_at",
  "is_duplicate",
  "risk_level"
] as const satisfies readonly ConditionField[];

export const RULE_CONDITION_OPERATORS: Record<ConditionField, readonly ConditionOperator[]> = {
  name: ["contains", "equals", "startsWith", "endsWith"],
  extension: ["contains", "equals", "startsWith", "endsWith"],
  file_type: ["equals", "is"],
  path: ["contains", "equals", "startsWith", "endsWith"],
  directory: ["contains", "equals", "startsWith", "endsWith"],
  size: ["equals", "greaterThan", "lessThan"],
  modified_at: ["olderThanDays", "newerThanDays"],
  is_duplicate: ["is"],
  risk_level: ["equals", "is"]
};

export const RULE_OPERATOR_OPTIONS = Array.from(new Set(Object.values(RULE_CONDITION_OPERATORS).flat())) as readonly ConditionOperator[];
export const RULE_PURPOSE_OPTIONS = ["Project", "Teaching", "Study", "Work", "Personal", "Career", "Finance", "Identity", "Media", "Installer", "Temporary", "Archive", "Unknown"] as const satisfies readonly Purpose[];
export const RULE_LIFECYCLE_OPTIONS = ["Inbox", "Active", "Reference", "Archive", "Disposable", "Duplicate", "Sensitive"] as const satisfies readonly Lifecycle[];
export const RULE_LOGIC_OPTIONS = ["AND", "OR"] as const satisfies readonly RuleOperator[];
export const RULE_FILE_TYPE_OPTIONS = [
  "Document",
  "Image",
  "Video",
  "Audio",
  "Code",
  "ArchivePackage",
  "Installer",
  "Spreadsheet",
  "Presentation",
  "Other"
] as const satisfies readonly FileType[];
export const RULE_RISK_LEVEL_OPTIONS = ["Normal", "Sensitive", "System", "Unknown"] as const satisfies readonly RiskLevel[];

export type ConditionInputType = "text" | "number" | "select" | "boolean";
export const RULE_CONDITION_INPUT_TYPES: Record<ConditionField, ConditionInputType> = {
  name: "text",
  extension: "text",
  file_type: "select",
  path: "text",
  directory: "text",
  size: "number",
  modified_at: "number",
  is_duplicate: "boolean",
  risk_level: "select"
};

export type ConditionValidationError =
  | "required"
  | "operator"
  | "number"
  | "nonNegative"
  | "integer"
  | "option"
  | "boolean";

export type DraftValidationError = "required" | "tooLong" | "invalid" | "finite" | "range";

export interface RuleDraftValidation {
  name?: DraftValidationError;
  conditions?: "required" | "invalid";
  conditionErrors: Record<string, ConditionValidationError>;
  weight?: "finite" | "range";
  priority?: "finite" | "range";
  valid: boolean;
}

export interface RuleBuilderDraft {
  id?: string;
  name: string;
  rootOperator: RuleOperator;
  groups: RuleConditionGroup[];
  purpose: Purpose;
  lifecycle: Lifecycle;
  weight: number;
  priority?: number;
  enabled?: boolean;
  now: string;
}

export function conditionOperatorsForField(field: ConditionField): readonly ConditionOperator[] {
  return RULE_CONDITION_OPERATORS[field];
}

export function conditionInputType(field: ConditionField): ConditionInputType {
  return RULE_CONDITION_INPUT_TYPES[field];
}

export function conditionOptions(field: ConditionField): readonly string[] {
  if (field === "file_type") return RULE_FILE_TYPE_OPTIONS;
  if (field === "risk_level") return RULE_RISK_LEVEL_OPTIONS;
  if (field === "is_duplicate") return ["true", "false"];
  return [];
}

function defaultConditionValue(field: ConditionField): string | number | boolean {
  if (field === "file_type") return RULE_FILE_TYPE_OPTIONS[0];
  if (field === "risk_level") return RULE_RISK_LEVEL_OPTIONS[0];
  if (field === "is_duplicate") return true;
  if (field === "size" || field === "modified_at") return "";
  return "";
}

function conditionValueCompatible(field: ConditionField, value: RuleCondition["value"]): boolean {
  const inputType = conditionInputType(field);
  if (inputType === "boolean") return typeof value === "boolean" || value === "true" || value === "false";
  if (inputType === "number") return value === "" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim() === "");
  if (inputType === "select") return typeof value === "string" && conditionOptions(field).includes(value);
  return typeof value === "string";
}

export function normalizeConditionForField(condition: RuleCondition, field: ConditionField): RuleCondition {
  const operators = conditionOperatorsForField(field);
  const operator = operators.includes(condition.operator) ? condition.operator : operators[0];
  const value = conditionValueCompatible(field, condition.value) ? condition.value : defaultConditionValue(field);
  return { ...condition, field, operator, value };
}

export function parseConditionInput(field: ConditionField, rawValue: string): RuleCondition["value"] {
  const inputType = conditionInputType(field);
  if (inputType === "number") return rawValue.trim() ? Number(rawValue) : "";
  if (inputType === "boolean") return rawValue === "true";
  return rawValue;
}

export function conditionValueText(value: RuleCondition["value"]): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function validateRuleCondition(condition: RuleCondition): ConditionValidationError | undefined {
  const field = condition.field;
  const operators = RULE_CONDITION_OPERATORS[field];
  if (!operators || !operators.includes(condition.operator)) return "operator";

  const inputType = RULE_CONDITION_INPUT_TYPES[field];
  if (inputType === "text") return typeof condition.value === "string" && condition.value.trim() ? undefined : "required";
  if (inputType === "select") return typeof condition.value === "string" && conditionOptions(field).includes(condition.value) ? undefined : "option";
  if (inputType === "boolean") return typeof condition.value === "boolean" ? undefined : "boolean";

  if (condition.value === "" || (typeof condition.value === "string" && !condition.value.trim())) return "required";
  const numericValue = typeof condition.value === "number" ? condition.value : Number(condition.value);
  if (!Number.isFinite(numericValue)) return "number";
  if (numericValue < 0) return "nonNegative";
  if (field === "modified_at" && !Number.isInteger(numericValue)) return "integer";
  return undefined;
}

export function validateRuleDraft(name: string, groups: RuleConditionGroup[], weight = 75, priority = 75): RuleDraftValidation {
  const conditionErrors: Record<string, ConditionValidationError> = {};
  for (const group of groups) {
    for (const condition of group.conditions) {
      const error = validateRuleCondition(condition);
      if (error) conditionErrors[`${group.id}:${condition.id}`] = error;
    }
  }
  const nameError: DraftValidationError | undefined = !name.trim() ? "required" : name.trim().length > 160 ? "tooLong" : undefined;
  const hasRequiredCondition = Object.values(conditionErrors).some((error) => error === "required");
  const conditionsError = !groups.length || groups.some((group) => !group.conditions.length)
    ? "required"
    : hasRequiredCondition ? "required" : Object.keys(conditionErrors).length ? "invalid" : undefined;
  const weightError = !Number.isFinite(weight) ? "finite" : weight < 0 || weight > 100 ? "range" : undefined;
  const priorityError = !Number.isFinite(priority) ? "finite" : priority < 0 || priority > 1000 ? "range" : undefined;
  return {
    name: nameError,
    conditions: conditionsError,
    conditionErrors,
    weight: weightError,
    priority: priorityError,
    valid: !nameError && !conditionsError && !weightError && !priorityError
  };
}

export function buildRuleFromBuilderDraft(draft: RuleBuilderDraft): Rule {
  const name = draft.name.trim();
  const validation = validateRuleDraft(name, draft.groups, draft.weight, draft.priority ?? 75);
  if (validation.name === "required") throw new Error("Rule name is required.");
  if (validation.name === "tooLong") throw new Error("Rule name is too long.");
  if (validation.weight) throw new Error("Rule weight must be between 0 and 100.");
  if (validation.priority) throw new Error("Rule priority must be between 0 and 1000.");
  if (!draft.groups.length) throw new Error("At least one condition group is required.");
  if (draft.groups.some((group) => !group.conditions.length)) throw new Error("Each rule group requires at least one condition.");
  for (const group of draft.groups) {
    for (const condition of group.conditions) {
      const error = validation.conditionErrors[`${group.id}:${condition.id}`];
      if (!error) continue;
      if (error === "required") throw new Error("Rule condition value is required.");
      if (error === "operator") throw new Error("Rule condition operator is invalid for its field.");
      if (error === "number" || error === "nonNegative" || error === "integer") throw new Error("Rule condition number is invalid.");
      throw new Error("Rule condition value is invalid.");
    }
  }

  return {
    id: draft.id ?? localId("rule"),
    name,
    source: "user",
    enabled: draft.enabled ?? false,
    priority: draft.priority ?? 75,
    weight: draft.weight,
    root_operator: draft.rootOperator,
    groups: draft.groups.map((group) => ({
      ...group,
      conditions: group.conditions.map((condition) => ({ ...condition }))
    })),
    action: {
      purpose: draft.purpose,
      lifecycle: draft.lifecycle
    },
    created_at: draft.now,
    updated_at: draft.now
  };
}

export function createRuleCondition(overrides: Partial<RuleCondition> = {}): RuleCondition {
  return {
    id: localId("cond"),
    field: "name",
    operator: "contains",
    value: "screenshot",
    ...overrides
  };
}

export function createRuleGroup(conditionOverrides: Partial<RuleCondition> = {}): RuleConditionGroup {
  return {
    id: localId("group"),
    operator: "AND",
    conditions: [createRuleCondition(conditionOverrides)]
  };
}

