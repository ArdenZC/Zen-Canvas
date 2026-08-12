import { invoke } from "@tauri-apps/api/core";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
import { isBrowserMockEnabled } from "../utils/runtimeMode";

type BrowserMockModule = typeof import("./browserMockApi");
const loadBrowserMock: (() => Promise<BrowserMockModule>) | null = import.meta.env.DEV
  ? () => import("./browserMockApi")
  : null;

export type EventHandler<T> = (payload: T, event: Event<T>) => void;

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (isBrowserMockEnabled()) {
      if (!loadBrowserMock) throw error;
      return (await loadBrowserMock()).mockInvokeCommand<T>(command, args);
    }
    throw error;
  }
}

export async function listenTo<T>(eventName: string, handler: EventHandler<T>): Promise<UnlistenFn> {
  try {
    return await listen<T>(eventName, (event) => handler(event.payload, event));
  } catch (error) {
    if (isBrowserMockEnabled()) return () => undefined;
    throw error;
  }
}
