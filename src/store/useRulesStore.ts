import { create } from "zustand";
import type { Rule } from "../types/domain";
import { mergeSystemAndUserRules, removeUserRule, setRuleEnabled } from "./rulePersistence";

const RULES_STORAGE_KEY = "zc-user-rules";
const RULES_STORAGE_VERSION = 1;

interface RulesStore {
  rules: Rule[];
  addRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  updateRule: (rule: Rule) => void;
  upsertRule: (rule: Rule) => void;
  setRuleEnabled: (id: string, enabled: boolean, updatedAt?: string) => void;
  removeUserRule: (id: string) => void;
  hydrateUserRulesFromSQLite: (sqliteRules: Rule[], replaceUserRuleIds?: string[]) => void;
  replaceUserRules: (userRules: Rule[]) => void;
  loadRules: () => void;
}

function readStoredRules(): Rule[] {
  try {
    const saved = window.localStorage.getItem(RULES_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed as Rule[];
    if (
      parsed && typeof parsed === "object"
      && "version" in parsed && parsed.version === RULES_STORAGE_VERSION
      && "rules" in parsed && Array.isArray(parsed.rules)
    ) {
      return parsed.rules as Rule[];
    }
    return [];
  } catch {
    return [];
  }
}

function writeStoredRules(rules: Rule[]) {
  try {
    window.localStorage.setItem(
      RULES_STORAGE_KEY,
      JSON.stringify({ version: RULES_STORAGE_VERSION, rules })
    );
  } catch {
    // SQLite remains authoritative when the optional migration cache is unavailable.
  }
}

export const useRulesStore = create<RulesStore>((set) => {
  let initialRules: Rule[] = [];

  const loadRules = () => {
    const rules = readStoredRules();
    initialRules = rules;
    set({ rules });
  };

  loadRules();

  return {
    rules: initialRules,
    addRule: (rule) =>
      set((state) => {
        const rules = [...state.rules, rule];
        writeStoredRules(rules);
        return { rules };
      }),
    removeRule: (id) =>
      set((state) => {
        const rules = state.rules.filter((rule) => rule.id !== id);
        writeStoredRules(rules);
        return { rules };
      }),
    updateRule: (rule) =>
      set((state) => {
        const rules = state.rules.map((current) => (current.id === rule.id ? rule : current));
        writeStoredRules(rules);
        return { rules };
      }),
    upsertRule: (rule) =>
      set((state) => {
        const exists = state.rules.some((current) => current.id === rule.id);
        const rules = exists
          ? state.rules.map((current) => (current.id === rule.id ? rule : current))
          : [...state.rules, rule];
        writeStoredRules(rules);
        return { rules };
      }),
    setRuleEnabled: (id, enabled, updatedAt) =>
      set((state) => {
        const rules = setRuleEnabled(state.rules, id, enabled, updatedAt);
        writeStoredRules(rules);
        return { rules };
      }),
    removeUserRule: (id) =>
      set((state) => {
        const rules = removeUserRule(state.rules, id);
        writeStoredRules(rules);
        return { rules };
      }),
    hydrateUserRulesFromSQLite: (sqliteRules, replaceUserRuleIds) =>
      set((state) => {
        const rules = mergeSystemAndUserRules(state.rules, sqliteRules, replaceUserRuleIds);
        writeStoredRules(rules);
        return { rules };
      }),
    replaceUserRules: (userRules) =>
      set((state) => {
        const rules = mergeSystemAndUserRules(state.rules, userRules);
        writeStoredRules(rules);
        return { rules };
      }),
    loadRules
  };
});
