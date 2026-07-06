import { useState } from "react";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import type { Language } from "../i18n";
import type { ThemeMode, Translator } from "../types/ui";
import { cn, glassButton, glassButtonPrimary, glassPanel } from "../utils/tw";

const titlebarToolButton =
  "grid h-8 w-8 place-items-center rounded-full border border-[var(--line-dark)] bg-[var(--surface-soft)] text-[var(--muted)] transition-[background,border-color,box-shadow,color] hover:border-blue-400/25 hover:bg-[var(--surface-strong)] hover:text-[var(--ink)] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.055)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/45";
const titlebarPillButton =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line-dark)] bg-[var(--surface-soft)] px-3 text-xs font-medium text-[var(--muted)] transition-[background,border-color,box-shadow,color] hover:border-blue-400/25 hover:bg-[var(--surface-strong)] hover:text-[var(--ink)] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.055)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/45";

export function ZenMark() {
  return (
    <div className="relative h-9 w-9 shrink-0" aria-hidden="true">
      <span className="absolute inset-0 rounded-[15px] bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 shadow-lg shadow-blue-500/22" />
      <span className="absolute inset-[3px] rounded-xl border border-white/70 bg-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] dark:border-blue-300/18 dark:bg-slate-950" />
      <span className="absolute inset-[9px] rounded-md border border-blue-500/45 bg-blue-500/12 dark:border-blue-300/45 dark:bg-blue-400/14" />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,0.16)] dark:bg-blue-300" />
    </div>
  );
}

export function AmbientMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(59,130,246,0.08),transparent_30%,rgba(16,185,129,0.05)_58%,transparent_84%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),transparent_18%,transparent_76%,rgba(15,23,42,0.05))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_28%,rgba(0,0,0,0.18))]" />
    </div>
  );
}

export function TitlebarTools({
  language,
  theme,
  effectiveTheme,
  setLanguage,
  setTheme,
  t
}: {
  language: Language;
  theme: ThemeMode;
  effectiveTheme: Exclude<ThemeMode, "system">;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  t: Translator;
}) {
  const nextTheme = nextThemeMode(theme);
  const themeLabel = themeToggleLabel(language, theme, nextTheme, t);

  return (
    <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
      <button
        className={titlebarToolButton}
        onClick={() => setTheme(nextTheme)}
        aria-label={themeLabel}
        title={themeLabel}
      >
        {themeIcon(theme)}
      </button>
      <button
        className={titlebarPillButton}
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      >
        <Languages size={16} />
        <span>{language === "zh" ? "EN" : "中文"}</span>
      </button>
    </div>
  );
}

function nextThemeMode(theme: ThemeMode): ThemeMode {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

function themeIcon(theme: ThemeMode) {
  if (theme === "system") return <Monitor size={17} />;
  if (theme === "light") return <Sun size={17} />;
  return <Moon size={17} />;
}

function themeToggleLabel(language: Language, current: ThemeMode, next: ThemeMode, t: Translator) {
  const labelFor = (mode: ThemeMode) => {
    if (mode === "system") return t("systemTheme");
    if (mode === "light") return t("lightTheme");
    return t("darkTheme");
  };

  if (language === "zh") return `当前：${labelFor(current)}，点击切换到${labelFor(next)}`;
  return `Current: ${labelFor(current)}. Click to switch to ${labelFor(next)}.`;
}

export function CloseChoiceDialog({
  t,
  onCancel,
  onChoose
}: {
  t: Translator;
  onCancel: () => void;
  onChoose: (action: "minimize" | "quit", remember: boolean) => Promise<void>;
}) {
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<"minimize" | "quit" | null>(null);

  async function choose(action: "minimize" | "quit") {
    setIsSubmitting(action);
    await onChoose(action, remember);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-6 backdrop-blur-xl" role="dialog" aria-modal="true">
      <section className={cn(glassPanel, "grid w-full max-w-md gap-5 p-6")}>
        <div className="mx-auto">
          <ZenMark />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">{t("closeChoiceTitle")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("closeChoiceDesc")}</p>
        </div>
        <label className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>{t("doNotAskAgain")}</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button className={glassButton} onClick={onCancel} disabled={isSubmitting !== null}>
            {t("cancel")}
          </button>
          <button className={glassButton} onClick={() => void choose("quit")} disabled={isSubmitting !== null}>
            {t("quitApp")}
          </button>
          <button className={glassButtonPrimary} onClick={() => void choose("minimize")} disabled={isSubmitting !== null}>
            {t("minimizeToTray")}
          </button>
        </div>
      </section>
    </div>
  );
}
