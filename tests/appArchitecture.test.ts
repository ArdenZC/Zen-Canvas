import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("app render architecture", () => {
  it("keeps high-frequency state and business singletons out of App.tsx", () => {
    const app = read("src/App.tsx");

    expect(app).not.toContain("searchQuery");
    expect(app).not.toContain("toast");
    expect(app).not.toContain("useFileLibrary(");
    expect(app).not.toContain("useScanManager(");
    expect(app).not.toContain("useOperationQueue(");
    expect(app).not.toContain("FileLibraryProvider");
    expect(app).not.toContain("ScanProvider");
    expect(app).not.toContain("OperationQueueProvider");
  });

  it("uses Zustand stores instead of React context for file, scan, and operation queues", () => {
    const contexts = read("src/contexts/AppContexts.tsx");
    const fileLibraryStore = read("src/store/useFileLibraryStore.ts");
    const scanStore = read("src/store/useScanManagerStore.ts");
    const operationStore = read("src/store/useOperationQueueStore.ts");

    expect(contexts).not.toContain("FileLibraryProvider");
    expect(contexts).not.toContain("ScanProvider");
    expect(contexts).not.toContain("OperationQueueProvider");
    expect(fileLibraryStore).toContain("create<FileLibraryStore>");
    expect(scanStore).toContain("create<ScanManagerStore>");
    expect(operationStore).toContain("create<OperationQueueStore>");
  });

  it("allows folder picking through the dialog open permission only", () => {
    const capability = JSON.parse(read("src-tauri/capabilities/default.json")) as {
      permissions: string[];
    };

    expect(capability.permissions).toContain("dialog:allow-open");
    expect(capability.permissions).not.toContain("dialog:allow-save");
  });

  it("keeps scanner totals and vault filters tied to their real state", () => {
    const scanner = read("src/views/scanner/ScannerView.tsx");
    const overviewModel = read("src/views/overview/overviewModel.ts");
    const vault = read("src/views/vault/VaultView.tsx");
    const fileLibraryStore = read("src/store/useFileLibraryStore.ts");

    expect(scanner).toContain("buildOverviewSummary(stats, overviewRoots, t, language)");
    expect(overviewModel).toContain("stats.totalSize");
    expect(overviewModel).toContain("stats.totalFiles");
    expect(scanner).not.toContain("files.reduce((sum, file) => sum + file.size");
    expect(vault).not.toContain('useState<LibraryFilter>("all")');
    expect(fileLibraryStore).toContain("libraryFilter: LibraryFilter");
    expect(fileLibraryStore).toContain("setLibraryFilter");
    expect(vault).toContain("tauriApi.getPagedFiles(LIBRARY_PAGE_SIZE, nextOffset, debouncedSearchQuery, scope, filters)");
    expect(vault).not.toContain("setSearchQuery(filter.key)");
  });

  it("does not rebuild operation previews from the current paged library rows", () => {
    const runtimeProviders = read("src/components/AppRuntimeProviders.tsx");
    const bootstrapper = runtimeProviders.slice(
      runtimeProviders.indexOf("function StoreRuntimeBootstrapper"),
      runtimeProviders.indexOf("function arraysEqual")
    );

    expect(bootstrapper).not.toContain("libraryPage.files");
    expect(bootstrapper).not.toContain("syncPreviews(files)");
  });

  it("refreshes operation previews after AI classification before opening preview", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");

    expect(view).toContain("AI_ANALYSIS_LIMIT = 100");
    expect(view).toContain("const refreshPreviewsForFiles = useOperationQueueStore((state) => state.refreshPreviewsForFiles)");
    expect(view).toContain("await refreshPreviewsForFiles(scope, new Set(currentFiles.map((file) => file.id)))");
    expect(view).not.toContain("while (useOperationQueueStore.getState().previewHasMore)");
    expect(view).not.toContain("useOperationQueueStore((state) => state.runDispatch)");
    expect(view).toContain("pendingOnly: true, force: false, limit: AI_ANALYSIS_LIMIT");
    expect(view).toContain("force: true, allowOverwriteUserCorrections: false, limit: AI_ANALYSIS_LIMIT");
    expect(view).toContain("startOrganizePreviewSession(organizeScopeKey(scope), ids)");
    expect(view).toContain('setView("preview")');
    expect(view).not.toMatch(/temperature|top_p|endpoint|modelName/i);
  });

  it("describes AI batch size as per-request and exposes cleanup AI settings", () => {
    const settings = read("src/views/settings/SettingsView.tsx");
    const i18n = read("src/i18n.ts");
    const browserMock = read("src/api/browserMockApi.ts");

    expect(settings).toContain('description={t("aiBatchSizeDesc")}');
    expect(settings).toContain('label={t("aiConcurrencyLabel")}');
    expect(settings).toContain('{t("aiPresetFast")}');
    expect(settings).toContain('{t("aiPresetStandard")}');
    expect(settings).toContain('{t("aiPresetDetailed")}');
    expect(settings).toContain('description={t("aiLearnedRulesDesc")}');
    expect(settings).toContain('label={t("aiLegacyRulesLabel")}');
    expect(settings).toContain('description={t("aiLegacyRulesDesc")}');
    expect(settings).toContain('label={t("aiCleanupEnabledLabel")}');
    expect(settings).toContain('description={t("aiCleanupEnabledDesc")}');
    expect(i18n).toContain("DeepSeek / 国产模型建议 10");
    expect(i18n).toContain("AI 分类并发数");
    expect(i18n).toContain("AI-first 模式下建议关闭");
    expect(i18n).toContain("AI 空间清理分析只增强候选项的风险说明和建议，不会直接删除文件，也不会绕过 Safe Trash。");
    expect(settings).toContain("cleanupAiEnabled: true");
    expect(browserMock).toContain("cleanupAiEnabled: true");
  });

  it("keeps automatic rule execution behind explicit confirmation and the current safety boundary", () => {
    const rulesView = read("src/views/rules/RulesView.tsx");
    const i18n = read("src/i18n.ts");

    expect(rulesView).toContain('setConfirmation({ kind: "run" })');
    expect(rulesView).toContain("ConfirmDialog");
    expect(i18n).toContain("自动化只写入建议");
    expect(i18n).toContain("不会直接移动、重命名、删除或覆盖文件");
    expect(i18n).toContain("执行仍需进入预览确认");
  });

  it("does not register main-window runtime side effects in search mode", () => {
    const runtimeProviders = read("src/components/AppRuntimeProviders.tsx");
    const fsWatcher = read("src/hooks/useFsWatcher.ts");
    const bootstrapper = runtimeProviders.slice(
      runtimeProviders.indexOf("function StoreRuntimeBootstrapper"),
      runtimeProviders.indexOf("function arraysEqual")
    );
    const searchNavigateIndex = runtimeProviders.indexOf("tauriApi.onSearchNavigate");
    const hotkeyFailureIndex = runtimeProviders.indexOf("tauriApi.onGlobalHotkeyRegistrationFailed");
    const searchNavigateHandler = runtimeProviders.slice(
      runtimeProviders.lastIndexOf("useEffect", searchNavigateIndex),
      hotkeyFailureIndex
    );
    const hotkeyFailureHandler = runtimeProviders.slice(
      runtimeProviders.lastIndexOf("useEffect", hotkeyFailureIndex),
      runtimeProviders.indexOf("const setCloseBehavior")
    );

    expect(fsWatcher).toContain("enabled?: boolean");
    expect(runtimeProviders).toContain("useFsWatcher({");
    expect(runtimeProviders).toContain("enabled: !isSearchMode");
    expect(runtimeProviders).toContain("<StoreRuntimeBootstrapper enabled={!isSearchMode} />");
    expect(bootstrapper).toContain("enabled: boolean");
    expect(bootstrapper).toContain("if (!enabled) return");
    expect(searchNavigateHandler).toContain("if (isSearchMode) return");
    expect(hotkeyFailureHandler).toContain("if (isSearchMode) return");
  });

  it("gates rule persistence in search mode", () => {
    const runtimeProviders = read("src/components/AppRuntimeProviders.tsx");
    const rulePersistence = read("src/hooks/useRulePersistence.ts");
    const useRulePersistenceCall = runtimeProviders.slice(
      runtimeProviders.indexOf("useRulePersistence({"),
      runtimeProviders.indexOf("useFsWatcher({")
    );
    const rulePersistenceEffect = rulePersistence.slice(
      rulePersistence.indexOf("useEffect(() => {"),
      rulePersistence.indexOf("async function hydrateRules")
    );

    expect(rulePersistence).toContain("enabled?: boolean");
    expect(rulePersistence).toContain("enabled = true");
    expect(rulePersistenceEffect).toContain("if (!enabled || !isDatabaseReady || hasHydrated.current) return");
    expect(useRulePersistenceCall).toContain("enabled: !isSearchMode");
    expect(useRulePersistenceCall).toContain("hydrateUserRulesFromSQLite");
  });

  it("reapplies changed rules only from an explicit RulesView action", () => {
    const rulesView = read("src/views/rules/RulesView.tsx");
    const runtimeProviders = read("src/components/AppRuntimeProviders.tsx");
    const saveRule = runtimeProviders.slice(
      runtimeProviders.indexOf("const saveRule"),
      runtimeProviders.indexOf("const toggleRuleEnabled")
    );

    expect(rulesView).toContain("reapplyRulesToCurrentScope");
    expect(rulesView).toContain('"all_changed_or_rule_changed"');
    expect(saveRule).not.toContain("executeRulesForScope");
  });

  it("uses shared UI primitives for the shell frame and scanner entry experience", () => {
    const appShell = read("src/components/AppShell.tsx");
    const scanner = read("src/views/scanner/ScannerView.tsx");

    expect(appShell).toContain("PageHeader");
    expect(appShell).toContain("pageFrame");
    expect(appShell).toContain("viewStage");
    expect(appShell).not.toContain("h-[calc(");
    expect(appShell).not.toContain("cn(pageBody");
    expect(scanner).toContain("PageHeader");
    expect(scanner).toContain("OverviewPriorityTask");
    expect(scanner).toContain("OverviewSpaceSummary");
    expect(scanner).toContain("OverviewRecentActivityList");
    expect(scanner).toContain("OverviewBackgroundTaskList");
    expect(scanner).toContain("pageSurface");
    expect(scanner).not.toContain("ScannerSummaryChip");
    expect(scanner).not.toContain("ScannerDisk");
    expect(scanner).not.toContain("clamp(180px,26vw,240px)");
  });

  it("keeps scanner state-driven with clear metrics and safety guidance", () => {
    const scanner = read("src/views/scanner/ScannerView.tsx");
    const overviewModel = read("src/views/overview/overviewModel.ts");
    const scanTaskPanel = read("src/views/overview/ScanTaskPanel.tsx");
    const cancelDialog = read("src/views/overview/ScanCancelDialog.tsx");

    expect(overviewModel).toContain("export type OverviewScanState");
    for (const state of ["scanning", "canceling", "completed", "partial", "canceled", "failed", "first-use"]) {
      expect(overviewModel).toContain(`"${state}"`);
    }
    expect(scanner).toContain("scanState.error");
    expect(scanTaskPanel).toContain('t("overviewScanProcessed")');
    expect(scanTaskPanel).toContain('t("overviewScanElapsed")');
    expect(scanTaskPanel).toContain('t("overviewScanSkipped")');
    expect(scanTaskPanel).toContain('t("overviewScanWarnings")');
    expect(scanTaskPanel).not.toContain("progressbar");
    expect(cancelDialog).toContain("ConfirmDialog");
    expect(scanner).toContain("await cancelScan()");
    expect(scanner).not.toContain("globalThis.confirm");
    expect(scanner).not.toContain("window.confirm");
  });

  it("keeps shell navigation grouped explicitly and page descriptions view-specific", () => {
    const appShell = read("src/components/AppShell.tsx");

    expect(appShell).toContain("function navGroups");
    expect(appShell).toContain('id: "primary"');
    expect(appShell).toContain('id: "advanced"');
    expect(appShell.indexOf('id: "scanner"')).toBeLessThan(appShell.indexOf('id: "library"'));
    expect(appShell.indexOf('id: "library"')).toBeLessThan(appShell.indexOf('id: "organize"'));
    expect(appShell.indexOf('id: "organize"')).toBeLessThan(appShell.indexOf('id: "restore"'));
    expect(appShell).not.toContain('{ id: "cleanup",');
    expect(appShell).not.toContain('{ id: "preview",');
    expect(appShell).not.toContain("index === 4");
    expect(appShell).toContain('aria-current={view === item.id ? "page" : undefined}');
    expect(appShell).toContain("function viewDescription");
    expect(appShell).toContain('case "cleanup"');
    expect(appShell).toContain('case "rules"');
    expect(appShell).toContain('case "restore"');
    expect(appShell).toContain('case "settings"');
    expect(appShell).toContain("previewActionCount");
  });

  it("auto clears transient success and info toasts without restoring page banners", () => {
    const appShell = read("src/components/AppShell.tsx");

    expect(appShell).toContain("function ToastContainer");
    expect(appShell).toContain("window.setTimeout(clearToast, toast.type === \"success\" ? 2200 : 3200)");
    expect(appShell).toContain("previousViewRef");
    expect(appShell).toContain("if (toast?.type === \"success\") clearToast()");
    expect(appShell).not.toContain("成功：36/36");
  });

  it("keeps titlebar controls draggable-safe and gives mac controls large hit targets", () => {
    const appShell = read("src/components/AppShell.tsx");
    const shellChrome = read("src/components/ShellChrome.tsx");

    expect(appShell).toContain("spotlightButton");
    expect(appShell).toContain("noDrag");
    expect(appShell).toContain("windowsControlButton");
    expect(appShell).toContain("windowsCloseButton");
    expect(appShell).toContain("h-12 w-11");
    expect(appShell).toContain("h-6 w-6");
    expect(appShell).toContain("var(--zc-window-close-hover)");
    expect(appShell).not.toContain("overflow-hidden rounded-lg border");
    expect(appShell).toContain("softPanel");
    expect(shellChrome).toContain("titlebarToolButton");
    expect(shellChrome).toContain("aria-label={themeLabel}");
    expect(shellChrome).toContain("title={themeLabel}");
    expect(shellChrome).toContain('t("lightTheme")');
    expect(shellChrome).toContain("[-webkit-app-region:no-drag]");
  });
});
