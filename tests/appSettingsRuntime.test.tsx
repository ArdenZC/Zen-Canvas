// @vitest-environment happy-dom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, useAppSettings } from "../src/hooks/useAppSettings";

const settingsMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  onError: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    getSettings: settingsMocks.getSettings,
    saveSettings: settingsMocks.saveSettings
  }
}));

describe("useAppSettings load and save epochs", () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let latest: ReturnType<typeof useAppSettings> | undefined;

  beforeEach(() => {
    settingsMocks.getSettings.mockReset();
    settingsMocks.saveSettings.mockReset();
    settingsMocks.onError.mockReset();
    latest = undefined;
  });

  afterEach(() => {
    root?.unmount();
    root = undefined;
  });

  it("does not let a delayed initial load overwrite a user intent", async () => {
    const loaded = deferred<ReturnType<typeof versionedSettings>>();
    settingsMocks.getSettings.mockReturnValue(loaded.promise);
    const container = document.createElement("div");
    root = createRoot(container);
    root.render(createElement(SettingsHarness, { onState: (state) => { latest = state; } }));
    await flushPromises();

    expect(latest?.isLoadingSettings).toBe(true);
    const saving = latest?.updateSettings({ searchHotkey: "Ctrl+Shift+P" });
    expect(settingsMocks.saveSettings).not.toHaveBeenCalled();

    loaded.resolve({
      settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Alt+K" },
      revision: 7
    });
    settingsMocks.saveSettings.mockResolvedValue({
      settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Ctrl+Shift+P" },
      revision: 8
    });
    await saving;
    await flushPromises();

    expect(settingsMocks.saveSettings).toHaveBeenCalledWith({
      settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Ctrl+Shift+P" },
      expectedRevision: 7
    });
    expect(latest?.settings.searchHotkey).toBe("Ctrl+Shift+P");
  });

  it("serializes fast partial updates against the latest persisted revision", async () => {
    settingsMocks.getSettings.mockResolvedValue({
      settings: DEFAULT_APP_SETTINGS,
      revision: 10
    });
    settingsMocks.saveSettings
      .mockResolvedValueOnce({
        settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Ctrl+J" },
        revision: 11
      })
      .mockResolvedValueOnce({
        settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Ctrl+J", restoreRetentionDays: 90 },
        revision: 12
      });
    const container = document.createElement("div");
    root = createRoot(container);
    root.render(createElement(SettingsHarness, { onState: (state) => { latest = state; } }));
    await flushPromises();

    const first = latest?.updateSettings({ searchHotkey: "Ctrl+J" });
    const second = latest?.updateSettings({ restoreRetentionDays: 90 });
    await Promise.all([first, second]);
    await flushPromises();

    expect(settingsMocks.saveSettings).toHaveBeenNthCalledWith(1, {
      settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Ctrl+J" },
      expectedRevision: 10
    });
    expect(settingsMocks.saveSettings).toHaveBeenNthCalledWith(2, {
      settings: { ...DEFAULT_APP_SETTINGS, searchHotkey: "Ctrl+J", restoreRetentionDays: 90 },
      expectedRevision: 11
    });
    expect(latest?.settings.restoreRetentionDays).toBe(90);
  });
});

function SettingsHarness({ onState }: { onState: (state: ReturnType<typeof useAppSettings>) => void }) {
  const state = useAppSettings({
    isDatabaseReady: true,
    onError: settingsMocks.onError
  });
  onState(state);
  return null;
}

function versionedSettings() {
  return {
    settings: DEFAULT_APP_SETTINGS,
    revision: 0
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await Promise.resolve();
}
