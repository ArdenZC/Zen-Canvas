import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { activateCommandNavigation, isSortingPreviewShortcut } from "../src/components/CommandModal";
import { makeTranslator } from "../src/i18n";
import { applySearchNavigation, shouldApplySearchNavigation } from "../src/utils/searchNavigation";
import { DEFAULT_SEARCH_HOTKEY, formatHotkeyLabel } from "../src/utils/hotkeys";

describe("spotlight search navigation", () => {
  it("displays the registered global shortcut for each platform", () => {
    expect(DEFAULT_SEARCH_HOTKEY).toBe("CmdOrCtrl+K");
    expect(formatHotkeyLabel(DEFAULT_SEARCH_HOTKEY, "darwin")).toBe("⌘ K");
    expect(formatHotkeyLabel(DEFAULT_SEARCH_HOTKEY, "win32")).toBe("Ctrl K");
    expect(formatHotkeyLabel(DEFAULT_SEARCH_HOTKEY, "linux")).toBe("Ctrl K");
  });

  it("activates standalone search results through the backend command", async () => {
    const activateSearchResult = vi.fn(async () => {});
    const setView = vi.fn();
    const setSelectedFileId = vi.fn();
    const onClose = vi.fn();

    await activateCommandNavigation({
      standalone: true,
      view: "library",
      fileId: "file-1",
      setView,
      setSelectedFileId,
      onClose,
      activateSearchResult
    });

    expect(activateSearchResult).toHaveBeenCalledWith("library", "file-1", undefined);
    expect(setSelectedFileId).not.toHaveBeenCalled();
    expect(setView).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps in-window command navigation local", async () => {
    const activateSearchResult = vi.fn(async () => {});
    const setView = vi.fn();
    const setSelectedFileId = vi.fn();
    const onClose = vi.fn();

    await activateCommandNavigation({
      standalone: false,
      view: "library",
      fileId: "file-1",
      setView,
      setSelectedFileId,
      onClose,
      activateSearchResult
    });

    expect(setSelectedFileId).toHaveBeenCalledWith("file-1");
    expect(setView).toHaveBeenCalledWith("library");
    expect(onClose).toHaveBeenCalledOnce();
    expect(activateSearchResult).not.toHaveBeenCalled();
  });

  it("applies search-navigate payloads to the main window state", () => {
    const setView = vi.fn();
    const setSelectedFileId = vi.fn();

    applySearchNavigation({ view: "library", fileId: "file-1" }, setView, setSelectedFileId);
    applySearchNavigation({ view: "preview", fileId: null }, setView, setSelectedFileId);

    expect(setView).toHaveBeenNthCalledWith(1, "library");
    expect(setSelectedFileId).toHaveBeenCalledWith("file-1");
    expect(setView).toHaveBeenNthCalledWith(2, "preview");
    expect(setSelectedFileId).toHaveBeenCalledTimes(1);
  });

  it("uses the independent global index for command and standalone Spotlight results", () => {
    const commandModal = readFileSync(resolve("src/components/CommandModal.tsx"), "utf8");
    const appShell = readFileSync(resolve("src/components/AppShell.tsx"), "utf8");

    expect(commandModal).toContain("const SEARCH_RESULT_LIMIT = 80");
    expect(commandModal).toContain("tauriApi.searchGlobalEntries(request)");
    expect(commandModal).toContain("queryControllerRef.current.nextRequest(trimmedSearch, SEARCH_RESULT_LIMIT)");
    expect(commandModal).toContain("queryControllerRef.current.accepts(response)");
    expect(commandModal).toContain("mergeSpotlightResults(currentGlobalResults, commandResults)");
    expect(commandModal).toContain("filesForCurrentQuery(trimmedSearch, globalResultState.query, globalResultState.results)");
    expect(commandModal).toContain('setGlobalResultState({ query: trimmedSearch, results: [] })');
    expect(commandModal).toContain("queryCommandRegistry(trimmedSearch, commandRegistry)");
    expect(commandModal).toContain("groupSpotlightResults(visibleResults, t)");
    expect(commandModal).not.toContain("results.slice(0, 12)");
    expect(commandModal).toContain("scrollIntoView({ block: \"nearest\" })");
    expect(commandModal).toContain("max-h-[50vh] overflow-y-auto p-2");
    expect(commandModal).not.toContain("tauriApi.getPagedFiles(12, 0, trimmedSearch");
    expect(commandModal).toContain("tauriApi.openGlobalSearchResult(entry.id)");
    expect(commandModal).toContain("tauriApi.revealGlobalSearchResult(activeResult.entry.id)");
    expect(commandModal).not.toContain("searchScope");
    expect(appShell).not.toContain("resolveEffectiveSearchScope");
    expect(appShell).not.toContain("searchScope={effectiveSearchScope}");
  });

  it("acknowledges Rust-owned main-window navigation readiness", () => {
    const runtimeProviders = readFileSync(resolve("src/components/AppRuntimeProviders.tsx"), "utf8");

    expect(runtimeProviders).toContain("tauriApi.onMainWindowReadyRequest");
    expect(runtimeProviders).toContain("tauriApi.acknowledgeMainWindowReady(nonce)");
    expect(runtimeProviders).toContain("tauriApi.markMainWindowReady(true)");
    expect(runtimeProviders).not.toContain("onGlobalSearchRequested");
  });

  it("rejects late navigation after the user changes main-window state", () => {
    const pending = { nonce: 9, view: "scanner" as const, selectedFileId: "" };
    expect(shouldApplySearchNavigation(
      { nonce: 9, view: "library", fileId: "file-1" },
      pending,
      { view: "scanner", selectedFileId: "" }
    )).toBe(true);
    expect(shouldApplySearchNavigation(
      { nonce: 9, view: "library", fileId: "file-1" },
      pending,
      { view: "settings", selectedFileId: "" }
    )).toBe(false);
    expect(shouldApplySearchNavigation(
      { nonce: 8, view: "library", fileId: "file-1" },
      pending,
      { view: "scanner", selectedFileId: "" }
    )).toBe(false);
  });

  it("uses folder-aware wording, plural-safe counts, and neutral indexed-entry icons", () => {
    const commandModal = readFileSync(resolve("src/components/CommandModal.tsx"), "utf8");
    const en = makeTranslator("en");
    expect(en("globalSearch")).toBe("Search folders, files, actions, or settings");
    expect(commandModal).toContain("formatCount(t, visibleResults.length");
    expect(commandModal).toContain("entry.isDirectory ? <Folder size={20} /> : <FileIcon size={20} />");
    expect(commandModal).not.toContain("<FileTypeIcon");
  });

  it("falls back to the library for an invalid runtime view payload", () => {
    const setView = vi.fn();
    const setSelectedFileId = vi.fn();

    applySearchNavigation(
      { view: "destructive-unknown-view", fileId: "file-1" },
      setView,
      setSelectedFileId
    );

    expect(setView).toHaveBeenCalledWith("library");
    expect(setSelectedFileId).toHaveBeenCalledWith("file-1");
  });

  it("keeps Tab available for focus movement and uses primary-key shortcuts for sorting preview", () => {
    const keyEvent = (key: string, overrides: Partial<KeyboardEvent> = {}) => ({
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ...overrides
    } as KeyboardEvent);

    expect(isSortingPreviewShortcut(keyEvent("Tab"))).toBe(false);
    expect(isSortingPreviewShortcut(keyEvent("Enter"))).toBe(false);
    expect(isSortingPreviewShortcut(keyEvent("Enter", { ctrlKey: true }))).toBe(true);
    expect(isSortingPreviewShortcut(keyEvent("Enter", { metaKey: true }))).toBe(true);
    expect(isSortingPreviewShortcut(keyEvent("p", { ctrlKey: true }))).toBe(true);
    expect(isSortingPreviewShortcut(keyEvent("P", { metaKey: true }))).toBe(true);
    expect(isSortingPreviewShortcut(keyEvent("P", { ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it("configures the global search window as a transparent spotlight surface", () => {
    const appControl = readFileSync(resolve("src-tauri/src/app_control.rs"), "utf8");
    const cargoToml = readFileSync(resolve("src-tauri/Cargo.toml"), "utf8");
    const tauriConfig = readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8");
    const appShell = readFileSync(resolve("src/components/AppShell.tsx"), "utf8");
    const tauriApi = readFileSync(resolve("src/api/tauriApi.ts"), "utf8");
    const mainRs = readFileSync(resolve("src-tauri/src/main.rs"), "utf8");
    const main = readFileSync(resolve("src/main.tsx"), "utf8");
    const styles = readFileSync(resolve("src/styles.css"), "utf8");

    const setupSearchWindow = appControl.slice(
      appControl.indexOf("pub fn setup_search_window"),
      appControl.indexOf("pub fn setup_global_search_shortcut")
    );

    expect(setupSearchWindow).toContain(".transparent(true)");
    expect(appControl).toContain("SEARCH_WINDOW_WIDTH: f64 = 820.0");
    expect(appControl).toContain("SEARCH_WINDOW_COLLAPSED_HEIGHT: f64 = 160.0");
    expect(appControl).toContain("SEARCH_WINDOW_EXPANDED_HEIGHT: f64 = 660.0");
    expect(appControl).not.toContain("SEARCH_WINDOW_HEIGHT: f64 = 320.0");
    expect(appControl).toContain("pub fn resize_search_window<R: Runtime>");
    expect(appControl).toContain("expanded: bool");
    expect(appControl).toContain('.ok_or_else(|| "search_window_missing".to_string())?');
    expect(appControl).toContain("SEARCH_WINDOW_EXPANDED_HEIGHT");
    expect(appControl).toContain("window.center().map_err(|error| error.to_string())?");
    expect(setupSearchWindow).toContain(".inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_COLLAPSED_HEIGHT)");
    expect(setupSearchWindow).toContain(".min_inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_COLLAPSED_HEIGHT)");
    expect(setupSearchWindow).toContain(".max_inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_EXPANDED_HEIGHT)");
    expect(setupSearchWindow).toContain(".shadow(false)");
    expect(appControl).toContain(".set_size(Size::Logical(LogicalSize");
    expect(appControl).toContain("height: if expanded");
    expect(appControl).toContain("SEARCH_WINDOW_EXPANDED_HEIGHT");
    expect(appControl).toContain("SEARCH_WINDOW_COLLAPSED_HEIGHT");
    expect(setupSearchWindow).not.toContain("target_os = \"windows\", target_os = \"linux\"");
    expect(cargoToml).toContain("\"tauri/macos-private-api\"");
    expect(tauriConfig).toContain("\"macOSPrivateApi\": true");
    expect(setupSearchWindow).toContain(".decorations(false)");
    expect(setupSearchWindow).toContain(".resizable(false)");
    expect(setupSearchWindow).toContain(".skip_taskbar(true)");
    expect(setupSearchWindow).toContain(".always_on_top(true)");
    expect(mainRs).toContain("zen_canvas_tauri::app_control::resize_search_window");
    expect(mainRs).toContain("zen_canvas_tauri::app_control::hide_search_window_command");
    expect(tauriApi).toContain("resizeSearchWindow(snapshot: SearchWindowSnapshot, expanded: boolean)");
    expect(tauriApi).toContain('invokeCommand<SearchWindowSnapshot>("resize_search_window"');
    expect(appShell).toContain("const searchWindowRoot =");
    expect(appShell).toContain("bg-transparent");
    expect(appShell).toContain("h-full w-full");
    expect(appShell).not.toContain("h-screen w-screen");
    expect(appShell).toContain("<div className={searchWindowRoot}>");
    const commandModal = readFileSync(resolve("src/components/CommandModal.tsx"), "utf8");
    expect(commandModal).toContain("standaloneSearchWindowCollapsedHeight = 160");
    expect(commandModal).toContain("standaloneSearchWindowExpandedHeight = 660");
    expect(commandModal).toContain("max-h-[50vh] overflow-y-auto p-2");
    expect(commandModal).toContain("const isStandaloneCollapsed =");
    expect(commandModal).toContain("tauriApi.resizeSearchWindow(searchWindowSnapshot, expanded)");
    expect(commandModal).toContain("tauriApi.hideSearchWindow(snapshot)");
    expect(commandModal).toContain("tauriApi.onSearchWindowState(updateSearchWindowSnapshot)");
    expect(commandModal).toContain("commandShellBase");
    expect(commandModal).toContain("commandShellCollapsed");
    expect(commandModal).toContain("commandShellExpanded");
    expect(commandModal).toContain("h-16 w-full max-w-[720px] rounded-full");
    expect(commandModal).toContain("const shouldShowIdleState = !standalone && !trimmedSearch");
    expect(commandModal).not.toContain("pt-[9vh]");
    expect(commandModal).not.toContain("px-5 pt-2");
    expect(commandModal).not.toContain("@tauri-apps/api/window");
    expect(main).toContain("search-window-root");
    expect(main).not.toContain("search-window-page");
    expect(styles).toContain("html.search-window-root");
    expect(styles).not.toContain("search-window-page");
    expect(styles).toContain("min-width: 0");
    expect(styles).toContain("background: transparent");
  });
});
