export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";

const disabledState =
  "disabled:cursor-not-allowed disabled:border-[var(--zc-divider)] disabled:bg-[var(--zc-surface-subtle)] disabled:text-[var(--zc-text-disabled)] disabled:shadow-none disabled:opacity-70 disabled:hover:border-[var(--zc-divider)] disabled:hover:bg-[var(--zc-surface-subtle)] disabled:hover:text-[var(--zc-text-disabled)] disabled:hover:shadow-none";

const standardButtonBase = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-[background,border-color,box-shadow,color,opacity] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
  focusRing,
  disabledState
);

const iconButtonBase = cn(
  "inline-grid h-9 w-9 place-items-center rounded-[var(--zc-radius-control)] border bg-[var(--zc-surface)] text-[var(--zc-text-secondary)] shadow-sm transition-[background,border-color,box-shadow,color,opacity] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
  focusRing,
  disabledState
);

export const canvasSurface =
  "bg-[var(--zc-canvas)] text-[var(--zc-text-primary)]";

export const contentSurface =
  "rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] text-[var(--zc-text-primary)]";

export const raisedSurface =
  "rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-raised)]";

export const floatingSurface =
  "rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-floating)] backdrop-blur-xl";

export const sidebarSurface =
  "border-[var(--zc-divider)] bg-[var(--zc-sidebar)] text-[var(--zc-text-primary)] backdrop-blur-lg";

export const titlebarSurface =
  "border-[var(--zc-divider)] bg-[var(--zc-titlebar)] text-[var(--zc-text-primary)] backdrop-blur-lg";

// Legacy surface aliases form the migration compatibility layer for existing pages.
export const glassPanel = raisedSurface;

export const appPanel =
  "rounded-[var(--zc-radius-window)] border border-[var(--zc-border)] bg-[var(--zc-canvas-elevated)] text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-raised)]";

export const contentPanel = contentSurface;

export const elevatedPanel = floatingSurface;

export const softPanel =
  "rounded-[var(--zc-radius-panel)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-primary)]";

export const toolbarSurface = cn(raisedSurface, "px-3 py-2");

export const scopeBarSurface =
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] px-3 py-2 text-sm text-[var(--zc-text-primary)]";

export const dangerSurface =
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-danger-border)] bg-[var(--zc-danger-soft)] px-3 py-2 text-[var(--zc-danger-text)]";

export const warningSurface =
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] px-3 py-2 text-[var(--zc-warning-text)]";

export const infoSurface =
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-primary-soft)] px-3 py-2 text-[var(--zc-primary-text)]";

export const successSurface =
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] px-3 py-2 text-[var(--zc-success-text)]";

export const glassButton = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-border)] bg-[var(--zc-surface)] text-[var(--zc-text-primary)] shadow-sm enabled:hover:border-[var(--zc-border-strong)] enabled:hover:bg-[var(--zc-surface-hover)]"
);

export const glassButtonPrimary = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-primary)] bg-[var(--zc-primary)] text-[var(--zc-primary-contrast)] shadow-sm enabled:hover:border-[var(--zc-primary-hover)] enabled:hover:bg-[var(--zc-primary-hover)] enabled:active:border-[var(--zc-primary-pressed)] enabled:active:bg-[var(--zc-primary-pressed)]"
);

export const glassButtonDanger = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-danger-border)] bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)] enabled:hover:border-[var(--zc-danger)] enabled:hover:bg-[var(--zc-danger-soft)]"
);

export const glassButtonWarning = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)] enabled:hover:border-[var(--zc-warning)] enabled:hover:bg-[var(--zc-warning-soft)]"
);

export const buttonSecondary = glassButton;

export const buttonGhost = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-transparent bg-transparent text-[var(--zc-text-secondary)] enabled:hover:bg-[var(--zc-surface-hover)] enabled:hover:text-[var(--zc-text-primary)]"
);

export const buttonSubtle = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)] enabled:hover:border-[var(--zc-border)] enabled:hover:bg-[var(--zc-surface-hover)] enabled:hover:text-[var(--zc-text-primary)]"
);

export const buttonIcon = cn(
  iconButtonBase,
  "border-[var(--zc-border)] enabled:hover:border-[var(--zc-border-strong)] enabled:hover:bg-[var(--zc-surface-hover)] enabled:hover:text-[var(--zc-text-primary)]"
);

export const buttonIconDanger = cn(
  iconButtonBase,
  "border-[var(--zc-border)] enabled:hover:border-[var(--zc-danger-border)] enabled:hover:bg-[var(--zc-danger-soft)] enabled:hover:text-[var(--zc-danger-text)]"
);

export const buttonPill = cn(
  standardButtonBase,
  "rounded-full border border-[var(--zc-border)] bg-[var(--zc-surface)] text-[var(--zc-text-primary)] shadow-sm enabled:hover:border-[var(--zc-border-strong)] enabled:hover:bg-[var(--zc-surface-hover)]"
);

export const inputSurface =
  "min-h-10 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface)] px-3 text-sm text-[var(--zc-text-primary)] outline-none transition-[background,border-color,box-shadow] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)] placeholder:text-[var(--zc-text-tertiary)] focus:border-[var(--zc-primary)] focus:bg-[var(--zc-surface)] focus:shadow-[0_0_0_3px_var(--zc-focus-ring-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";

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
