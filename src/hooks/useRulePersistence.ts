import { useEffect, useRef, useState } from "react";
import { tauriApi } from "../api/tauriApi";
import type { Rule } from "../types/domain";

interface UseRulePersistenceOptions {
  enabled?: boolean;
  isDatabaseReady: boolean;
  rules: Rule[];
  hydrateUserRulesFromSQLite: (sqliteRules: Rule[], replaceUserRuleIds?: string[]) => void;
  onCatalogRevision?: (revision: number) => void;
  onError: (message: string) => void;
  formatSyncError: () => string;
}

export function useRulePersistence({
  enabled = true,
  isDatabaseReady,
  hydrateUserRulesFromSQLite,
  onCatalogRevision,
  onError,
  formatSyncError
}: UseRulePersistenceOptions) {
  const hasHydrated = useRef(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !isDatabaseReady || hasHydrated.current) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function hydrateRules() {
      try {
        const [sqliteRules, catalog] = await Promise.all([
          tauriApi.listUserRulesV2(),
          tauriApi.getRuleCatalogState()
        ]);
        if (cancelled) return;
        hydrateUserRulesFromSQLite(sqliteRules);
        onCatalogRevision?.(catalog.revision);
        hasHydrated.current = true;
      } catch {
        if (!cancelled) {
          onError(formatSyncError());
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
  }, [
    enabled,
    formatSyncError,
    hydrateUserRulesFromSQLite,
    isDatabaseReady,
    onCatalogRevision,
    onError,
    retryAttempt
  ]);
}
