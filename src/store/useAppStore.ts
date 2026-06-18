import { create } from "zustand";
import type { Language } from "../i18n";
import type { ThemeMode, View } from "../types/ui";
import { preferredLanguage, preferredTheme } from "../utils/viewHelpers";

interface AppStore {
  language: Language;
  theme: ThemeMode;
  view: View;
  searchQuery: string;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  setView: (view: View) => void;
  setSearchQuery: (searchQuery: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  language: preferredLanguage(),
  theme: preferredTheme(),
  view: "scanner",
  searchQuery: "",
  setLanguage: (language) => {
    window.localStorage.setItem("zc-language", language);
    set({ language });
  },
  setTheme: (theme) => {
    window.localStorage.setItem("zc-theme", theme);
    set({ theme });
  },
  setView: (view) => set({ view }),
  setSearchQuery: (searchQuery) => set({ searchQuery })
}));
