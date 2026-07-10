import { useEffect, useRef, useState } from "react";
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
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !isDatabaseReady || hasHydrated.current) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const localUserRules = userRulesFrom(rules);
    const replaceUserRuleIds = localUserRules.map((rule) => rule.id);

    async function hydrateRules() {
      try {
        const sqliteRules = await tauriApi.getUserRules();
        if (cancelled) return;

        if (sqliteRules.length > 0) {
          hydrateUserRulesFromSQLite(sqliteRules, replaceUserRuleIds);
          hasHydrated.current = true;
          return;
        }

        if (localUserRules.length === 0) {
          hasHydrated.current = true;
          return;
        }

        const savedRules = await migrateLocalUserRulesToSQLite(localUserRules, (rule) =>
          tauriApi.saveUserRule(rule)
        );
        if (cancelled) return;
        hydrateUserRulesFromSQLite(savedRules, replaceUserRuleIds);
        hasHydrated.current = true;
      } catch (error) {
        if (!cancelled) {
          onError(`规则已保留在本地缓存，但同步 SQLite 失败：${readableError(error)}`);
          const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryAttempt, 5));
          retryTimer = setTimeout(() => setRetryAttempt((attempt) => attempt + 1), delay);
        }
      }
    }

    void hydrateRules();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, hydrateUserRulesFromSQLite, isDatabaseReady, onError, retryAttempt, rules]);
}
