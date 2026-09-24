import { useEffect, useMemo, useRef, useState } from "react";
import "./search.css";
import { CommandModal } from "./components/CommandModal";
import { makeTranslator } from "./i18n";
import type { Language } from "./i18n";
import type { ThemeMode, View } from "./types/ui";
import { preferredLanguage, preferredTheme } from "./utils/uiPreferences";

const searchRoot = "relative h-full w-full overflow-hidden bg-transparent text-[var(--zc-text-primary)]";
const noop = () => undefined;

export function SearchApp() {
  const [language, setLanguage] = useState<Language>(preferredLanguage);
  const [theme, setTheme] = useState<ThemeMode>(preferredTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const t = useMemo(() => makeTranslator(language), [language]);
  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
    document.documentElement.classList.add("search-window-root");
    document.body.classList.add("search-window-root");
    return () => {
      document.documentElement.classList.remove("search-window-root");
      document.body.classList.remove("search-window-root");
    };
  }, [effectiveTheme]);

  useEffect(() => {
    const updatePreferences = (event: StorageEvent) => {
      if (!event.key || event.key === "zc-theme") setTheme(preferredTheme());
      if (!event.key || event.key === "zc-language" || event.key === "fma-language") setLanguage(preferredLanguage());
    };
    window.addEventListener("storage", updatePreferences);
    return () => window.removeEventListener("storage", updatePreferences);
  }, []);

  const platform: NodeJS.Platform = /Mac|iPhone|iPad/.test(navigator.platform) ? "darwin" : "win32";
  const setView = (_view: View) => undefined;
  const setSelectedFileId = (_id: string) => undefined;

  return (
    <div className={searchRoot} data-density="default">
      <CommandModal
        inputRef={inputRef}
        setView={setView}
        setSelectedFileId={setSelectedFileId}
        onClose={noop}
        platform={platform}
        t={t}
        onError={(message) => console.error("Search window runtime error", message)}
        standalone
      />
    </div>
  );
}
