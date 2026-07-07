export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/55";

const disabledState =
  "disabled:cursor-not-allowed disabled:border-[var(--line-dark)] disabled:bg-slate-200/45 disabled:text-slate-500 disabled:shadow-none disabled:opacity-70 disabled:hover:border-[var(--line-dark)] disabled:hover:bg-slate-200/45 disabled:hover:text-slate-500 disabled:hover:shadow-none dark:disabled:bg-slate-800/55 dark:disabled:text-slate-500 dark:disabled:hover:bg-slate-800/55";

export const glassPanel =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)] backdrop-blur-2xl";

export const appPanel = cn(
  glassPanel,
  "bg-[var(--surface-strong)] shadow-[var(--shadow-strong)]"
);

export const contentPanel =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] shadow-sm backdrop-blur-xl";

export const elevatedPanel =
  "rounded-[calc(var(--radius-md)+4px)] border border-[var(--line)] bg-[var(--surface-strong)] shadow-[var(--shadow-strong)] backdrop-blur-2xl";

export const softPanel =
  "rounded-[var(--radius-md)] border border-[var(--line-dark)] bg-[var(--surface-soft)] backdrop-blur-lg";

export const toolbarSurface =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-sm backdrop-blur-xl";

export const scopeBarSurface =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm shadow-sm backdrop-blur-lg";

export const dangerSurface =
  "rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-red-700 shadow-sm dark:text-red-200";

export const warningSurface =
  "rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-amber-800 shadow-sm dark:text-amber-200";

export const infoSurface =
  "rounded-xl border border-blue-400/30 bg-blue-500/8 px-3 py-2 text-blue-700 shadow-sm dark:text-blue-200";

export const successSurface =
  "rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 shadow-sm dark:text-emerald-200";

export const glassButton =
  cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/35 hover:bg-[var(--surface-strong)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] dark:hover:bg-slate-700/70",
    focusRing,
    disabledState
  );

export const glassButtonPrimary = cn(
  glassButton,
  "border-blue-500/70 bg-blue-600 text-white shadow-blue-500/16 hover:border-blue-400/80 hover:bg-blue-500 dark:border-blue-500/60 dark:bg-blue-500 dark:hover:bg-blue-400 disabled:border-[var(--line-dark)] disabled:bg-slate-200/45 disabled:text-slate-500 dark:disabled:bg-slate-800/55 dark:disabled:text-slate-500"
);

export const glassButtonDanger = cn(
  glassButton,
  "border-red-400/35 bg-red-500/10 text-red-700 hover:border-red-400/55 hover:bg-red-500/16 dark:text-red-200"
);

export const glassButtonWarning = cn(
  glassButton,
  "border-amber-400/35 bg-amber-500/10 text-amber-700 hover:border-amber-400/55 hover:bg-amber-500/16 dark:text-amber-200"
);

export const buttonSecondary = cn(
  glassButton,
  "bg-[var(--surface-soft)] text-[var(--ink)] hover:bg-[var(--surface-strong)] dark:hover:bg-slate-700/70"
);

export const buttonGhost = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-[var(--muted)] transition-[background,border-color,box-shadow,color,opacity] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] dark:hover:bg-slate-800/80",
  focusRing,
  disabledState
);

export const buttonSubtle = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line-dark)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/24 hover:bg-[var(--surface)] hover:text-[var(--ink)] dark:hover:bg-slate-700/70",
  focusRing,
  disabledState
);

export const buttonIcon = cn(
  "inline-grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/35 hover:bg-[var(--surface-strong)] hover:text-[var(--ink)] dark:hover:bg-slate-700/70",
  focusRing,
  disabledState
);

export const buttonIconDanger = cn(
  buttonIcon,
  "hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
);

export const buttonPill = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/35 hover:bg-[var(--surface-strong)] dark:hover:bg-slate-700/70",
  focusRing,
  disabledState
);

export const inputSurface =
  "min-h-10 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--ink)] outline-none transition-[background,border-color,box-shadow] placeholder:text-[var(--quiet)] focus:border-blue-400/55 focus:bg-[var(--surface-strong)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/55";

export const selectSurface = cn(inputSurface, "appearance-auto");

export const sectionTitle =
  "mb-4 flex items-start justify-between gap-4 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-[var(--muted)]";

export const emptyState =
  "flex min-h-28 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]";

export const virtualList = "relative overflow-auto overscroll-contain";
export const virtualSpacer = "relative w-full";
export const virtualRow = "absolute left-0 top-0 w-full";

export const statusToast =
  "mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)] shadow-[var(--shadow)] backdrop-blur-xl";

export function toastTone(type: "success" | "error" | "info"): string {
  if (type === "success") return "border-l-4 border-l-green-600";
  if (type === "error") return "border-l-4 border-l-red-600 bg-red-600/10";
  return "border-l-4 border-l-blue-600";
}

export function toneClasses(tone: string): string {
  if (tone === "red") return "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20 border-transparent";
  if (tone === "purple") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/20 border-transparent";
  if (tone === "green") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 border-transparent";
  if (tone === "amber") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 border-transparent";
  if (tone === "slate") return "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-1 ring-slate-500/20 border-transparent";
  return "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 border-transparent";
}
