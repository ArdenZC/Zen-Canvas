import { create } from "zustand";
import type { Rule } from "../types/domain";

interface RulesStore {
  rules: Rule[];
  catalogRevision: number;
  replaceUserRules: (rules: Rule[], catalogRevision?: number) => void;
  hydrateUserRulesFromSQLite: (rules: Rule[], _replaceUserRuleIds?: string[]) => void;
  upsertRule: (rule: Rule, catalogRevision?: number) => void;
  removeUserRule: (id: string, catalogRevision?: number) => void;
  setCatalogRevision: (revision: number) => void;
  loadRules: () => void;
}

/**
 * SQLite is the sole Rule Repository authority. This store is a replaceable UI
 * projection only: it never hydrates from or writes to localStorage.
 */
export const useRulesStore = create<RulesStore>((set) => ({
  rules: [],
  catalogRevision: 1,
  replaceUserRules: (rules, catalogRevision) =>
    set((state) => ({
      rules: rules.filter((rule) => rule.source === "user"),
      catalogRevision: catalogRevision ?? state.catalogRevision
    })),
  hydrateUserRulesFromSQLite: (rules) =>
    set({ rules: rules.filter((rule) => rule.source === "user") }),
  upsertRule: (rule, catalogRevision) =>
    set((state) => ({
      rules: state.rules.some((current) => current.id === rule.id)
        ? state.rules.map((current) => current.id === rule.id ? rule : current)
        : [...state.rules, rule],
      catalogRevision: catalogRevision ?? state.catalogRevision
    })),
  removeUserRule: (id, catalogRevision) =>
    set((state) => ({
      rules: state.rules.filter((rule) => rule.id !== id),
      catalogRevision: catalogRevision ?? state.catalogRevision
    })),
  setCatalogRevision: (catalogRevision) => set({ catalogRevision }),
  loadRules: () => undefined
}));
