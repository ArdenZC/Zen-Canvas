import type { Language } from "../i18n";
import type { ThemeMode } from "../types/ui";

export function preferredLanguage(): Language {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem("zc-language") === "en" || window.localStorage.getItem("fma-language") === "en"
    ? "en"
    : "zh";
}

export function preferredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("zc-theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}
