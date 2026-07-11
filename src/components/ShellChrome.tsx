import { useEffect, useId, useRef, useState } from "react";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import type { Language } from "../i18n";
import type { ThemeMode, Translator } from "../types/ui";
import { cn, floatingSurface, glassButton, glassButtonPrimary } from "../utils/tw";
import { BrandMark } from "./ui/BrandMark";

const titlebarToolButton =
  "grid h-8 w-8 place-items-center rounded-full border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)] transition-[background,border-color,box-shadow,color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)] hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";
const titlebarPillButton =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-3 text-xs font-medium text-[var(--zc-text-secondary)] transition-[background,border-color,box-shadow,color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)] hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";

export function ZenMark({
  decorative = true,
  size = "sidebar",
  ariaLabel
}: {
  decorative?: boolean;
  size?: "micro" | "sidebar" | "app";
  ariaLabel?: string;
} = {}) {
  return <BrandMark size={size} decorative={decorative} aria-label={ariaLabel} />;
}

export function AmbientMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,var(--zc-ambient-primary),transparent_42%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_88%,var(--zc-ambient-secondary),transparent_38%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_72%,var(--zc-ambient-vignette))]" />
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
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isSubmitting === null) {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [isSubmitting, onCancel]);

  async function choose(action: "minimize" | "quit") {
    setIsSubmitting(action);
    await onChoose(action, remember);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--zc-overlay)] p-6 backdrop-blur-sm">
      <section ref={dialogRef} className={cn(floatingSurface, "grid w-full max-w-md gap-5 p-6")} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="mx-auto">
          <ZenMark decorative={false} ariaLabel={t("appName")} />
        </div>
        <div className="text-center">
          <h2 id={titleId} className="text-xl font-semibold">{t("closeChoiceTitle")}</h2>
          <p id={descriptionId} className="mt-2 text-sm text-[var(--muted)]">{t("closeChoiceDesc")}</p>
        </div>
        <label className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>{t("doNotAskAgain")}</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button ref={cancelRef} className={glassButton} onClick={onCancel} disabled={isSubmitting !== null}>
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
