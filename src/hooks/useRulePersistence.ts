import { useEffect, useRef } from "react";
import { tauriApi } from "../api/tauriApi";
import { migrateLocalUserRulesToSQLite, userRulesFrom } from "../store/rulePersistence";
import type { Rule } from "../types/domain";
import { readableError } from "../utils/viewHelpers";

interface UseRulePersistenceOptions {
  enabled?: boolean;
  isDatabaseReady: boolean;
  rules: Rule[];
  hydrateUserRulesFromSQLite: (sqliteRules: Rule[], replaceUserRuleIds?: string[]) => void;
  onError: (message: string) => void;
}

export function useRulePersistence({
  enabled = true,
  isDatabaseReady,
  rules,
  hydrateUserRulesFromSQLite,
  onError
}: UseRulePersistenceOptions) {
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!enabled || !isDatabaseReady || hasHydrated.current) return;

    hasHydrated.current = true;
    let cancelled = false;
    const localUserRules = userRulesFrom(rules);
    const replaceUserRuleIds = localUserRules.map((rule) => rule.id);

    async function hydrateRules() {
      try {
        const sqliteRules = await tauriApi.getUserRules();
        if (cancelled) return;

        if (sqliteRules.length > 0) {
          hydrateUserRulesFromSQLite(sqliteRules, replaceUserRuleIds);
          return;
        }

        if (localUserRules.length === 0) return;

        const savedRules = await migrateLocalUserRulesToSQLite(localUserRules, (rule) =>
          tauriApi.saveUserRule(rule)
        );
        if (cancelled) return;
        hydrateUserRulesFromSQLite(savedRules, replaceUserRuleIds);
      } catch (error) {
        if (!cancelled) {
          onError(`规则已保留在本地缓存，但同步 SQLite 失败：${readableError(error)}`);
        }
      }
    }

    void hydrateRules();

    return () => {
      cancelled = true;
    };
  }, [enabled, hydrateUserRulesFromSQLite, isDatabaseReady, onError, rules]);
}
