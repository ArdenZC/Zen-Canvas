export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/55";

const disabledState = "disabled:pointer-events-none disabled:opacity-55";

export const glassPanel =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-[linear-gradient(135deg,var(--surface),var(--surface-soft))] shadow-[var(--shadow)] backdrop-blur-3xl";

export const appPanel = cn(
  glassPanel,
  "bg-[linear-gradient(145deg,var(--surface-strong),var(--surface))] shadow-[var(--shadow-strong)]"
);

export const contentPanel =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-white/28 shadow-sm backdrop-blur-2xl dark:bg-white/6";

export const elevatedPanel =
  "rounded-[calc(var(--radius-md)+4px)] border border-[var(--line)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-soft))] shadow-[var(--shadow-strong)] backdrop-blur-3xl";

export const softPanel =
  "rounded-[var(--radius-md)] border border-[var(--line-dark)] bg-white/16 backdrop-blur-xl dark:bg-white/4";

export const toolbarSurface =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-white/22 px-3 py-2 shadow-sm backdrop-blur-2xl dark:bg-white/5";

export const scopeBarSurface =
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-white/18 px-3 py-2 text-sm shadow-sm backdrop-blur-2xl dark:bg-white/5";

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
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white/36 px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/35 hover:bg-white/58 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:bg-white/5 dark:hover:bg-white/10",
    focusRing,
    disabledState
  );

export const glassButtonPrimary = cn(
  glassButton,
  "border-blue-400/55 bg-blue-500 text-white shadow-blue-500/20 hover:border-blue-300/70 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
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
  "bg-white/28 text-[var(--ink)] hover:bg-white/50 dark:bg-white/6 dark:hover:bg-white/12"
);

export const buttonGhost = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-[var(--muted)] transition-[background,border-color,box-shadow,color,opacity] hover:bg-white/30 hover:text-[var(--ink)] dark:hover:bg-white/8",
  focusRing,
  disabledState
);

export const buttonSubtle = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line-dark)] bg-white/18 px-4 py-2 text-sm font-medium text-[var(--muted)] transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/24 hover:bg-white/36 hover:text-[var(--ink)] dark:bg-white/4 dark:hover:bg-white/8",
  focusRing,
  disabledState
);

export const buttonIcon = cn(
  "inline-grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white/30 text-[var(--muted)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/35 hover:bg-white/52 hover:text-[var(--ink)] dark:bg-white/5 dark:hover:bg-white/10",
  focusRing,
  disabledState
);

export const buttonIconDanger = cn(
  buttonIcon,
  "hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
);

export const buttonPill = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white/32 px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] hover:border-blue-400/35 hover:bg-white/54 dark:bg-white/5 dark:hover:bg-white/10",
  focusRing,
  disabledState
);

export const inputSurface =
  "min-h-10 rounded-xl border border-[var(--line)] bg-white/36 px-3 text-sm text-[var(--ink)] outline-none transition-[background,border-color,box-shadow] placeholder:text-[var(--quiet)] focus:border-blue-400/55 focus:bg-white/64 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/55 dark:bg-white/5 dark:focus:bg-white/10";

export const selectSurface = cn(inputSurface, "appearance-auto");

export const sectionTitle =
  "mb-4 flex items-start justify-between gap-4 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-[var(--muted)]";

export const emptyState =
  "flex min-h-28 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-white/16 px-4 py-6 text-center text-sm text-[var(--muted)] dark:bg-white/5";

export const virtualList = "relative overflow-auto overscroll-contain";
export const virtualSpacer = "relative w-full";
export const virtualRow = "absolute left-0 top-0 w-full";

export const statusToast =
  "mb-3 rounded-xl border border-[var(--line)] bg-[linear-gradient(135deg,var(--surface),var(--surface-soft))] px-4 py-3 text-sm text-[var(--muted)] shadow-[var(--shadow)] backdrop-blur-3xl";

export function toastTone(type: "success" | "error" | "info"): string {
  if (type === "success") return "border-l-4 border-l-green-600";
  if (type === "error") return "border-l-4 border-l-red-600 bg-red-600/10";
  return "border-l-4 border-l-blue-600";
}

export function toneClasses(tone: string): string {
  if (tone === "red") return "border-red-400/30 bg-red-500/10 text-red-600 dark:text-red-300";
  if (tone === "purple") return "border-violet-400/30 bg-violet-500/10 text-violet-600 dark:text-violet-300";
  if (tone === "green") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  if (tone === "amber") return "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  if (tone === "slate") return "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-300";
  return "border-blue-400/30 bg-blue-500/10 text-blue-600 dark:text-blue-300";
}
