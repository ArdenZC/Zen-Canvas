import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { activateCommandNavigation, isSortingPreviewShortcut } from "../src/components/CommandModal";
import { makeTranslator } from "../src/i18n";
import { applySearchNavigation } from "../src/utils/searchNavigation";
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

    expect(activateSearchResult).toHaveBeenCalledWith("library", "file-1");
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

  it("uses the resolved effective search scope for command and standalone spotlight results", () => {
    const commandModal = readFileSync(resolve("src/components/CommandModal.tsx"), "utf8");
    const appShell = readFileSync(resolve("src/components/AppShell.tsx"), "utf8");

    expect(commandModal).toContain("searchScope");
    expect(commandModal).toContain("const SEARCH_RESULT_LIMIT = 80");
    expect(commandModal).toContain("tauriApi.searchFiles(trimmedSearch, SEARCH_RESULT_LIMIT, searchScope)");
    expect(commandModal).toContain("mergeSpotlightResults(currentFileResults, commandResults)");
    expect(commandModal).toContain("filesForCurrentQuery(trimmedSearch, fileResultState.query, fileResultState.files)");
    expect(commandModal).toContain('setFileResultState({ query: trimmedSearch, files: [] })');
    expect(commandModal).toContain("queryCommandRegistry(trimmedSearch, commandRegistry)");
    expect(commandModal).toContain("groupSpotlightResults(visibleResults, t)");
    expect(commandModal).not.toContain("results.slice(0, 12)");
    expect(commandModal).toContain("scrollIntoView({ block: \"nearest\" })");
    expect(commandModal).toContain("max-h-[50vh] overflow-y-auto p-2");
    expect(commandModal).not.toContain("tauriApi.getPagedFiles(12, 0, trimmedSearch");
    expect(appShell).toContain("resolveEffectiveSearchScope");
    expect(appShell).toContain("searchScope={effectiveSearchScope}");
  });

  it("opens in-window Spotlight when the native search window falls back", () => {
    const runtimeProviders = readFileSync(resolve("src/components/AppRuntimeProviders.tsx"), "utf8");

    expect(runtimeProviders).toContain("tauriApi.onGlobalSearchRequested");
    expect(runtimeProviders).toContain("setIsCommandOpen(true)");
  });

  it("uses folder-aware wording, plural-safe counts, and shared file icons", () => {
    const commandModal = readFileSync(resolve("src/components/CommandModal.tsx"), "utf8");
    const en = makeTranslator("en");
    expect(en("globalSearch")).toBe("Search folders, files, actions, or settings");
    expect(commandModal).toContain("formatCount(t, visibleResults.length");
    expect(commandModal).toContain("<FileTypeIcon file={file}");
    expect(commandModal).toContain("<FileTypeIcon file={file} size={17}");
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
    expect(appControl).toContain("if let Some(window) = app.get_webview_window(SEARCH_WINDOW_LABEL)");
    expect(appControl).toContain("SEARCH_WINDOW_EXPANDED_HEIGHT");
    expect(appControl).toContain("window.center()?");
    expect(setupSearchWindow).toContain(".inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_COLLAPSED_HEIGHT)");
    expect(setupSearchWindow).toContain(".min_inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_COLLAPSED_HEIGHT)");
    expect(setupSearchWindow).toContain(".max_inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_EXPANDED_HEIGHT)");
    expect(setupSearchWindow).toContain(".shadow(false)");
    expect(appControl).toContain("window.set_size(Size::Logical(LogicalSize");
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
    expect(tauriApi).toContain("resizeSearchWindow(expanded: boolean): Promise<void>");
    expect(tauriApi).toContain('invokeCommand<void>("resize_search_window", { expanded })');
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
    expect(commandModal).toContain("void tauriApi.resizeSearchWindow(!isStandaloneCollapsed).catch(() => undefined)");
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
