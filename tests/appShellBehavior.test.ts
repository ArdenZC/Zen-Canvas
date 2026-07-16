import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTranslator } from "../src/i18n";
import { AIProcessingModeStatus, fileLibraryHeadingDescription, openAIProcessingModeSettings, ShellViewHeading } from "../src/components/AppShell";
import { filesForCurrentQuery } from "../src/components/CommandModal";
import type { AISettings, FileRecord, OperationLog } from "../src/types/domain";

const t = makeTranslator("zh");

async function commandModule() {
  return import("../src/components/spotlight/commandRegistry").catch(() => ({} as any));
}

async function modelModule() {
  return import("../src/components/spotlight/spotlightModel").catch(() => ({} as any));
}

async function aiModule() {
  return import("../src/store/useAIProcessingModeStore").catch(() => ({} as any));
}

async function focusModule() {
  return import("../src/components/spotlight/focusTrap").catch(() => ({} as any));
}

function aiSettings(enabled: boolean, provider: AISettings["provider"]): AISettings {
  return { enabled, provider } as AISettings;
}

function file(id: string, name: string, fileType: string, modifiedAt: string, lastOpenedAt?: string): FileRecord {
  return {
    id,
    name,
    file_type: fileType,
    modified_at: modifiedAt,
    last_opened_at: lastOpenedAt
  } as FileRecord;
}

function operation(id: string, createdAt: string): OperationLog {
  return {
    id,
    created_at: createdAt,
    operation_type: "move",
    old_name: `old-${id}`,
    new_name: `new-${id}`,
    status: "success"
  } as OperationLog;
}

describe("App Shell v4.1 behavior", () => {
  it("does not attach global file totals to an empty current scan scope", () => {
    expect(fileLibraryHeadingDescription({ kind: "current_scan", roots: [] }, 5, "尚未选择文件夹", t)).toBe("当前范围: 尚未选择文件夹");
    expect(fileLibraryHeadingDescription({ kind: "all" }, 5, "全部索引文件", t)).toBe("当前范围: 全部索引文件 · 5 文件");
    expect(fileLibraryHeadingDescription({ kind: "current_scan", roots: ["C:/Users/Zen/Documents"] }, 2, "Documents", t)).toBe("当前范围: Documents · 2 文件");
  });

  it("models AI processing mode as loading, disabled, local, cloud, failed, and immediate updates", async () => {
    const module = await aiModule();
    expect(module.createAIProcessingModeController).toBeTypeOf("function");

    const controller = module.createAIProcessingModeController();
    expect(controller.getState().status).toBe("loading");

    await controller.load(async () => aiSettings(false, "openai_compatible"));
    expect(module.resolveAIProcessingMode(controller.getState())).toBe("disabled");

    await controller.load(async () => aiSettings(true, "ollama"));
    expect(module.resolveAIProcessingMode(controller.getState())).toBe("local");

    controller.publish(aiSettings(true, "openai_compatible"));
    expect(module.resolveAIProcessingMode(controller.getState())).toBe("cloud");

    await controller.load(async () => Promise.reject(new Error("offline")));
    expect(module.resolveAIProcessingMode(controller.getState())).toBe("failed");
    expect(controller.getState().error).toBe("offline");
  });

  it("renders distinct semantic AI mode icons and lets failed state open AI settings", () => {
    const states = [
      { status: "loading", settings: null, error: "", icon: "loader", tone: "--zc-info-text" },
      { status: "failed", settings: null, error: "offline", icon: "warning", tone: "--zc-warning-text" },
      { status: "ready", settings: aiSettings(false, "openai_compatible"), error: "", icon: "disabled", tone: "--zc-neutral-text" },
      { status: "ready", settings: aiSettings(true, "ollama"), error: "", icon: "local", tone: "--zc-success-text" },
      { status: "ready", settings: aiSettings(true, "openai_compatible"), error: "", icon: "cloud", tone: "--zc-info-text" }
    ] as const;

    for (const item of states) {
      const html = renderToStaticMarkup(createElement(AIProcessingModeStatus, { state: item, t, onCheckSettings: vi.fn() }));
      expect(html).toContain(`data-ai-mode-icon="${item.icon}"`);
      expect(html).toContain(item.tone);
    }

    const failedHtml = renderToStaticMarkup(createElement(AIProcessingModeStatus, { state: states[1], t, onCheckSettings: vi.fn() }));
    expect(failedHtml).toContain("检查设置");

    const setView = vi.fn();
    const openSection = vi.fn();
    openAIProcessingModeSettings(setView, openSection);
    expect(setView).toHaveBeenCalledWith("settings");
    expect(openSection).toHaveBeenCalledWith("settings-ai");
  });

  it("never mixes file results from the previous query into a new query", () => {
    const previousFiles = [file("old", "旧结果.txt", "document", "2026-07-10T10:00:00Z")];
    expect(filesForCurrentQuery("新查询", "旧查询", previousFiles)).toEqual([]);
    expect(filesForCurrentQuery("新查询", "新查询", previousFiles)).toBe(previousFiles);
  });

  it("queries the complete client command registry", async () => {
    const module = await commandModule();
    expect(module.createCommandRegistry).toBeTypeOf("function");

    const registry = module.createCommandRegistry(t);
    expect(registry.map((command: any) => command.id)).toEqual(expect.arrayContaining([
      "overview",
      "library",
      "suggestions",
      "cleanup",
      "history",
      "automation",
      "settings",
      "search-scope-settings",
      "theme-settings",
      "ai-settings"
    ]));
    expect(module.queryCommandRegistry("AI", registry).map((command: any) => command.id)).toContain("ai-settings");
    expect(module.queryCommandRegistry("搜索范围", registry).map((command: any) => command.id)).toContain("search-scope-settings");
  });

  it("merges file and command results and groups folders separately from commands", async () => {
    const commands = await commandModule();
    const model = await modelModule();
    const registry = commands.createCommandRegistry(t);
    const commandResults = commands.queryCommandRegistry("设置", registry);
    const files = [
      file("file-1", "设置说明.md", "document", "2026-07-10T10:00:00Z"),
      file("folder-1", "设置备份", "folder", "2026-07-10T11:00:00Z")
    ];

    const merged = model.mergeSpotlightResults(files, commandResults);
    expect(merged.some((item: any) => item.kind === "file")).toBe(true);
    expect(merged.some((item: any) => item.kind === "command")).toBe(true);
    const groups = model.groupSpotlightResults(merged);
    expect(groups.map((group: any) => group.type)).toEqual(["folders", "files", "settings"]);
  });

  it("uses true recent files and operations, caps them, and hides empty groups", async () => {
    const model = await modelModule();
    const files = [
      file("old", "old.txt", "document", "2026-07-01T10:00:00Z"),
      file("recent", "recent.txt", "document", "2026-07-09T10:00:00Z", "2026-07-11T10:00:00Z"),
      file("middle", "middle.txt", "document", "2026-07-10T10:00:00Z")
    ];
    const operations = [operation("old", "2026-07-01T10:00:00Z"), operation("new", "2026-07-11T10:00:00Z")];

    expect(model.selectRecentFiles(files, 2).map((item: FileRecord) => item.id)).toEqual(["recent", "middle"]);
    expect(model.selectRecentOperations(operations, 1).map((item: OperationLog) => item.id)).toEqual(["new"]);
    expect(model.buildRecentGroups([], [], t)).toEqual([]);
  });

  it("executes the search range command as a real settings-section action", async () => {
    const module = await commandModule();
    const command = module.createCommandRegistry(t).find((item: any) => item.id === "search-scope-settings");
    const setView = vi.fn();
    const requestSettingsSection = vi.fn();
    const onClose = vi.fn();

    module.executeSpotlightCommand(command, { setView, requestSettingsSection, onClose });

    expect(setView).toHaveBeenCalledWith("settings");
    expect(requestSettingsSection).toHaveBeenCalledWith("settings-search-scope");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cycles Tab and Shift+Tab within a dialog and restores the trigger", async () => {
    const module = await focusModule();
    expect(module.cycleDialogFocus).toBeTypeOf("function");
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const preventDefault = vi.fn();

    module.cycleDialogFocus({ key: "Tab", shiftKey: false, preventDefault }, [first, last], last);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();

    module.cycleDialogFocus({ key: "Tab", shiftKey: true, preventDefault }, [first, last], first);
    expect(last.focus).toHaveBeenCalledOnce();

    module.restoreDialogFocus(last);
    expect(last.focus).toHaveBeenCalledTimes(2);
  });

  it("localizes Spotlight keyboard hints in Chinese", () => {
    expect(t("commandNavigateHint")).toBe("移动选择");
    expect(t("commandCloseHint")).toBe("关闭");
  });

  it("does not inject scanner actions into non-overview page headings", () => {
    const html = renderToStaticMarkup(createElement(ShellViewHeading, {
      view: "settings",
      activeLabel: "偏好设置",
      headingDescription: "设置说明"
    }));

    expect(html).toContain("偏好设置");
    expect(html).not.toContain("选择文件夹");
    expect(html).not.toContain("扫描用户空间");
    expect(renderToStaticMarkup(createElement(ShellViewHeading, {
      view: "scanner",
      activeLabel: "概览",
      headingDescription: ""
    }))).toBe("");
  });
});
