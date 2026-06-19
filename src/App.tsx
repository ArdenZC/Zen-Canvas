import { useCallback, useEffect, useMemo, useState } from "react";
import { tauriApi } from "./api/tauriApi";
import { AppShell } from "./components/AppShell";
import { makeTranslator } from "./i18n";
import { useAppChrome } from "./hooks/useAppChrome";
import { useDebounce } from "./hooks/useDebounce";
import { useOperationQueue } from "./hooks/useOperationQueue";
import { useScanManager } from "./hooks/useScanManager";
import { useWindowBehavior } from "./hooks/useWindowBehavior";
import { useAppStore } from "./store/useAppStore";
import { useRulesStore } from "./store/useRulesStore";
import type { DashboardStats, FileQueryResult, Rule } from "./types/domain";
import { readableError } from "./utils/viewHelpers";

const PAGE_SIZE = 50;

const emptyStats: DashboardStats = {
  totalFiles: 0,
  totalSize: 0,
  diskTotalSize: 0,
  diskFreeSize: 0,
  diskUsageRatio: 0,
  duplicateFiles: 0,
  largeFiles: 0,
  sensitiveFiles: 0,
  needsConfirmation: 0,
  byType: {},
  byLifecycle: {},
  lastScannedAt: null
};

const emptyPage: FileQueryResult = {
  files: [],
  total: 0,
  limit: PAGE_SIZE,
  offset: 0
};

export function App() {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const rules = useRulesStore((state) => state.rules);
  const addRule = useRulesStore((state) => state.addRule);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [libraryPage, setLibraryPage] = useState<FileQueryResult>(emptyPage);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const t = useMemo(() => makeTranslator(language), [language]);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const showSuccess = useCallback((message: string) => setToast({ message, type: "success" }), []);
  const showError = useCallback((message: string) => setToast({ message, type: "error" }), []);

  const loadStats = useCallback(async () => {
    try {
      setStats(await tauriApi.getStatsSummary());
    } catch (error) {
      setStats(emptyStats);
      showError(readableError(error));
    }
  }, [showError]);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await tauriApi.getPagedFiles(PAGE_SIZE, 0, debouncedSearchQuery || undefined);
      setLibraryPage(page);
      setSelectedFileId((current) => current || page.files[0]?.id || "");
    } catch (error) {
      setLibraryPage(emptyPage);
      showError(readableError(error));
    }
  }, [debouncedSearchQuery, showError]);

  useEffect(() => {
    void tauriApi.initDatabase().catch(() => undefined);
    void Promise.all([loadStats(), loadFirstPage()]);
  }, [loadFirstPage, loadStats]);

  const appChrome = useAppChrome({ theme, setTheme, setLanguage });
  const windowBehavior = useWindowBehavior();
  const scanManager = useScanManager({
    t,
    loadStats,
    loadFirstPage,
    showSuccess,
    showError,
    clearToast: () => setToast(null)
  });
  const files = libraryPage.files;
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0];
  const operationQueue = useOperationQueue({
    files,
    t,
    loadStats,
    loadFirstPage,
    showSuccess,
    showError
  });

  const saveRule = useCallback(async (rule: Rule) => addRule(rule), [addRule]);
  const runDispatch = useCallback(async () => {
    try {
      const summary = await tauriApi.executeRulesOnInbox(rules);
      await Promise.all([loadStats(), loadFirstPage()]);
      showSuccess(`${t("success")}: ${summary.updated.toLocaleString()} / ${summary.scanned.toLocaleString()}`);
      return summary;
    } catch (error) {
      showError(readableError(error));
      throw error;
    }
  }, [loadFirstPage, loadStats, rules, showError, showSuccess, t]);

  return (
    <AppShell
      {...appChrome}
      {...windowBehavior}
      {...scanManager}
      {...operationQueue}
      language={language}
      setLanguage={setLanguage}
      theme={theme}
      setTheme={setTheme}
      view={view}
      setView={setView}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      stats={stats}
      libraryPage={libraryPage}
      setLibraryPage={setLibraryPage}
      selectedFile={selectedFile}
      setSelectedFileId={setSelectedFileId}
      files={files}
      rules={rules}
      saveRule={saveRule}
      runDispatch={runDispatch}
      toast={toast}
      loadStats={loadStats}
      t={t}
    />
  );
}
