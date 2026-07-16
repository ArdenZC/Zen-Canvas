export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";

const disabledState =
  "disabled:cursor-not-allowed disabled:border-[var(--zc-control-border)] disabled:bg-[var(--zc-surface-subtle)] disabled:text-[var(--zc-text-disabled)] disabled:shadow-none disabled:opacity-70 disabled:hover:border-[var(--zc-control-border)] disabled:hover:bg-[var(--zc-surface-subtle)] disabled:hover:text-[var(--zc-text-disabled)] disabled:hover:shadow-none";

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
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-info-border)] bg-[var(--zc-info-soft)] px-3 py-2 text-[var(--zc-info-text)]";

export const successSurface =
  "rounded-[var(--zc-radius-field)] border border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] px-3 py-2 text-[var(--zc-success-text)]";

export const glassButton = cn(
  standardButtonBase,
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-control-border)] bg-[var(--zc-surface)] text-[var(--zc-text-primary)] shadow-sm enabled:hover:border-[var(--zc-control-border-hover)] enabled:hover:bg-[var(--zc-surface-hover)]"
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
  "rounded-[var(--zc-radius-control)] border border-[var(--zc-control-border)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)] enabled:hover:border-[var(--zc-control-border-hover)] enabled:hover:bg-[var(--zc-surface-hover)] enabled:hover:text-[var(--zc-text-primary)]"
);

export const buttonIcon = cn(
  iconButtonBase,
  "border-[var(--zc-control-border)] enabled:hover:border-[var(--zc-control-border-hover)] enabled:hover:bg-[var(--zc-surface-hover)] enabled:hover:text-[var(--zc-text-primary)]"
);

export const buttonIconDanger = cn(
  iconButtonBase,
  "border-[var(--zc-control-border)] enabled:hover:border-[var(--zc-danger-border)] enabled:hover:bg-[var(--zc-danger-soft)] enabled:hover:text-[var(--zc-danger-text)]"
);

export const buttonPill = cn(
  standardButtonBase,
  "rounded-full border border-[var(--zc-control-border)] bg-[var(--zc-surface)] text-[var(--zc-text-primary)] shadow-sm enabled:hover:border-[var(--zc-control-border-hover)] enabled:hover:bg-[var(--zc-surface-hover)]"
);

export const inputSurface =
  "min-h-10 rounded-[var(--zc-radius-field)] border border-[var(--zc-control-border)] bg-[var(--zc-surface)] px-3 text-sm text-[var(--zc-text-primary)] outline-none transition-[background,border-color,box-shadow] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)] placeholder:text-[var(--zc-text-tertiary)] hover:border-[var(--zc-control-border-hover)] focus:border-[var(--zc-primary)] focus:bg-[var(--zc-surface)] focus:shadow-[0_0_0_3px_var(--zc-focus-ring-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)]";

export const selectSurface = cn(inputSurface, "appearance-auto");

export const sectionTitle =
  "mb-4 flex items-start justify-between gap-4 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-[var(--muted)]";

export const emptyState =
  "flex min-h-28 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]";

export const virtualList = "relative overflow-auto overscroll-contain";
export const virtualSpacer = "relative w-full";
export const virtualRow = "absolute left-0 top-0 w-full";

export const statusToast =
  "mb-3 rounded-[var(--zc-radius-field)] border border-[var(--zc-border)] bg-[var(--zc-surface-floating)] px-4 py-3 text-sm text-[var(--zc-text-secondary)] shadow-[var(--zc-shadow-raised)] backdrop-blur-xl";

export function toastTone(type: "success" | "error" | "info"): string {
  if (type === "success") return "border-l-4 border-l-[var(--zc-success)]";
  if (type === "error") return "border-l-4 border-l-[var(--zc-danger)] bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]";
  return "border-l-4 border-l-[var(--zc-info)]";
}

export function toneClasses(tone: string): string {
  if (tone === "red") return "border-transparent bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)] ring-1 ring-[var(--zc-danger-border)]";
  if (tone === "purple") return "border-transparent bg-[var(--zc-purple-soft)] text-[var(--zc-purple-text)] ring-1 ring-[var(--zc-purple-border)]";
  if (tone === "green") return "border-transparent bg-[var(--zc-success-soft)] text-[var(--zc-success-text)] ring-1 ring-[var(--zc-success-border)]";
  if (tone === "amber") return "border-transparent bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)] ring-1 ring-[var(--zc-warning-border)]";
  if (tone === "slate") return "border-transparent bg-[var(--zc-neutral-soft)] text-[var(--zc-neutral-text)] ring-1 ring-[var(--zc-neutral-border)]";
  return "border-transparent bg-[var(--zc-info-soft)] text-[var(--zc-info-text)] ring-1 ring-[var(--zc-info-border)]";
}
