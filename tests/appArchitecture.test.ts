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
    const vault = read("src/views/vault/VaultView.tsx");
    const fileLibraryStore = read("src/store/useFileLibraryStore.ts");

    expect(scanner).toContain("const scopedTotalSize = stats.totalSize");
    expect(scanner).not.toContain("files.reduce((sum, file) => sum + file.size");
    expect(vault).not.toContain('useState<LibraryFilter>("all")');
    expect(fileLibraryStore).toContain("libraryFilter: LibraryFilter");
    expect(fileLibraryStore).toContain("setLibraryFilter");
    expect(vault).toContain("tauriApi.getPagedFiles(LIBRARY_PAGE_SIZE, offset, debouncedSearchQuery, scope, filters)");
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
    expect(appShell).toContain("pageBody");
    expect(appShell).not.toContain("h-[calc(");
    expect(scanner).toContain("PageHeader");
    expect(scanner).toContain("MetricCard");
    expect(scanner).toContain("NoticeBanner");
    expect(scanner).toContain("StateBlock");
  });

  it("keeps scanner state-driven with clear metrics and safety guidance", () => {
    const scanner = read("src/views/scanner/ScannerView.tsx");

    expect(scanner).toContain("type ScannerVisualState");
    expect(scanner).toContain("function scannerVisualState");
    expect(scanner).toContain('return "canceling"');
    expect(scanner).toContain('return "completed"');
    expect(scanner).toContain('return "error"');
    expect(scanner).toContain("scanState.error");
    expect(scanner).toContain('t("scannerStartTitle")');
    expect(scanner).toContain('t("scannerLocalIndexSafety")');
    expect(scanner).toContain('t("totalAnalysed")');
    expect(scanner).toContain('t("needsReview")');
    expect(scanner).toContain('t("scannerReferenceDisk")');
    expect(scanner).toContain('tone={visualState === "canceling" ? "amber"');
    expect(scanner).toContain('NoticeBanner tone="error"');
  });

  it("keeps shell navigation grouped explicitly and page descriptions view-specific", () => {
    const appShell = read("src/components/AppShell.tsx");

    expect(appShell).toContain("function navGroups");
    expect(appShell).toContain('id: "workspace"');
    expect(appShell).toContain('id: "system"');
    expect(appShell).not.toContain("index === 4");
    expect(appShell).toContain("function viewDescription");
    expect(appShell).toContain('case "rules"');
    expect(appShell).toContain('case "restore"');
    expect(appShell).toContain('case "settings"');
    expect(appShell).toContain("previewActionCount");
  });

  it("keeps titlebar controls draggable-safe and gives mac controls large hit targets", () => {
    const appShell = read("src/components/AppShell.tsx");
    const shellChrome = read("src/components/ShellChrome.tsx");

    expect(appShell).toContain("spotlightButton");
    expect(appShell).toContain("noDrag");
    expect(appShell).toContain("windowsControlButton");
    expect(appShell).toContain("windowsCloseButton");
    expect(appShell).toContain("h-8 w-10");
    expect(appShell).toContain("h-6 w-6");
    expect(appShell).toContain("softPanel");
    expect(shellChrome).toContain("titlebarToolButton");
    expect(shellChrome).toContain("[-webkit-app-region:no-drag]");
  });
});
