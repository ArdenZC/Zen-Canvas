import type { Rule } from "../types/domain";

export type SaveUserRule = (rule: Rule) => Promise<Rule>;
export type UpsertRule = (rule: Rule) => void;

interface PersistRuleEnabledToggleOptions {
  rule: Rule;
  enabled: boolean;
  saveUserRule: SaveUserRule;
  upsertRule: UpsertRule;
  onSyncError?: (error: unknown, fallbackRule: Rule) => void;
  nowIso?: () => string;
}

export function userRulesFrom(rules: Rule[]): Rule[] {
  return rules.filter((rule) => rule.source === "user");
}

export function mergeSystemAndUserRules(
  currentRules: Rule[],
  sqliteUserRules: Rule[],
  replaceUserRuleIds: Iterable<string> = userRulesFrom(currentRules).map((rule) => rule.id)
): Rule[] {
  const replacedUserIds = new Set(replaceUserRuleIds);
  const nonUserRules = currentRules.filter((rule) => rule.source !== "user");
  const preservedUserRules = currentRules.filter((rule) => rule.source === "user" && !replacedUserIds.has(rule.id));
  const merged: Rule[] = [];
  const seen = new Set<string>();

  for (const rule of nonUserRules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    merged.push(rule);
  }

  for (const rule of sqliteUserRules) {
    if (rule.source !== "user" || seen.has(rule.id)) continue;
    seen.add(rule.id);
    merged.push(rule);
  }

  for (const rule of preservedUserRules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    merged.push(rule);
  }

  return merged;
}

export async function migrateLocalUserRulesToSQLite(
  localRules: Rule[],
  saveUserRule: SaveUserRule
): Promise<Rule[]> {
  const savedRules: Rule[] = [];
  for (const rule of userRulesFrom(localRules)) {
    savedRules.push(await saveUserRule(rule));
  }
  return savedRules;
}

export function setRuleEnabled(
  rules: Rule[],
  id: string,
  enabled: boolean,
  updatedAt = new Date().toISOString()
): Rule[] {
  return rules.map((rule) => {
    if (rule.id !== id || rule.source !== "user") return rule;
    return { ...rule, enabled, updated_at: updatedAt };
  });
}

export async function persistRuleEnabledToggle({
  rule,
  enabled,
  saveUserRule,
  upsertRule,
  onSyncError,
  nowIso = () => new Date().toISOString()
}: PersistRuleEnabledToggleOptions): Promise<void> {
  if (rule.source !== "user") return;

  const nextRule: Rule = {
    ...rule,
    enabled,
    updated_at: nowIso()
  };

  try {
    const savedRule = await saveUserRule(nextRule);
    upsertRule(savedRule);
  } catch (error) {
    upsertRule(nextRule);
    onSyncError?.(error, nextRule);
  }
}
