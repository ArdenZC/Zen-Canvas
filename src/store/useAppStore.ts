import { create } from "zustand";
import type { Language } from "../i18n";
import type { ThemeMode, View } from "../types/ui";
import { preferredLanguage, preferredTheme } from "../utils/viewHelpers";

export type ToastState = { message: string; type: "success" | "error" | "info" };

interface AppStore {
  language: Language;
  theme: ThemeMode;
  view: View;
  searchQuery: string;
  globalHotkeyError: string;
  toast: ToastState | null;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  setView: (view: View) => void;
  setSearchQuery: (searchQuery: string) => void;
  setGlobalHotkeyError: (message: string) => void;
  showToast: (toast: ToastState) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  language: preferredLanguage(),
  theme: preferredTheme(),
  view: "scanner",
  searchQuery: "",
  globalHotkeyError: "",
  toast: null,
  setLanguage: (language) => {
    set({ language });
    try { window.localStorage.setItem("zc-language", language); } catch { /* optional preference */ }
  },
  setTheme: (theme) => {
    set({ theme });
    try { window.localStorage.setItem("zc-theme", theme); } catch { /* optional preference */ }
  },
  setView: (view) => set({ view }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setGlobalHotkeyError: (globalHotkeyError) => set({ globalHotkeyError }),
  showToast: (toast) => set({ toast }),
  showSuccess: (message) => set({ toast: { message, type: "success" } }),
  showError: (message) => set({ toast: { message, type: "error" } }),
  clearToast: () => set({ toast: null })
}));
