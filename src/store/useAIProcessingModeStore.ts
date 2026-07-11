import { create } from "zustand";
import { tauriApi } from "../api/tauriApi";
import type { AISettings } from "../types/domain";
import { readableError } from "../utils/viewHelpers";

export type AIProcessingModeSettings = Pick<AISettings, "enabled" | "provider">;
export type AIProcessingModeState = {
  status: "loading" | "ready" | "failed";
  settings: AIProcessingModeSettings | null;
  error: string;
};

const initialState: AIProcessingModeState = {
  status: "loading",
  settings: null,
  error: ""
};

export function resolveAIProcessingMode(state: AIProcessingModeState) {
  if (state.status === "loading") return "loading" as const;
  if (state.status === "failed") return "failed" as const;
  if (!state.settings?.enabled) return "disabled" as const;
  return state.settings.provider === "ollama" ? "local" as const : "cloud" as const;
}

export function createAIProcessingModeController() {
  let state = { ...initialState };
  return {
    getState: () => state,
    load: async (loader: () => Promise<AIProcessingModeSettings>) => {
      state = { status: "loading", settings: null, error: "" };
      try {
        const settings = await loader();
        state = { status: "ready", settings, error: "" };
      } catch (error) {
        state = { status: "failed", settings: null, error: readableError(error) };
      }
    },
    publish: (settings: AIProcessingModeSettings) => {
      state = { status: "ready", settings, error: "" };
    }
  };
}

type AIProcessingModeStore = AIProcessingModeState & {
  load: () => Promise<void>;
  publish: (settings: AIProcessingModeSettings) => void;
};

export const useAIProcessingModeStore = create<AIProcessingModeStore>((set) => ({
  ...initialState,
  load: async () => {
    set({ status: "loading", settings: null, error: "" });
    try {
      const settings = await tauriApi.getAISettings();
      set({
        status: "ready",
        settings: { enabled: settings.enabled, provider: settings.provider },
        error: ""
      });
    } catch (error) {
      set({ status: "failed", settings: null, error: readableError(error) });
    }
  },
  publish: (settings) => set({ status: "ready", settings, error: "" })
}));
