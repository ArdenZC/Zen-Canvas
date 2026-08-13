import {
  cn,
  contentPanel as contentPanelClass,
  appPanel as appPanelClass,
  elevatedPanel as elevatedPanelClass,
  softPanel as softPanelClass,
  scopeBarSurface as scopeBarSurfaceClass,
  toolbarSurface as toolbarSurfaceClass,
  dangerSurface,
  infoSurface,
  successSurface,
  warningSurface
} from "../../utils/tw";

export const appPanel = appPanelClass;
export const contentPanel = contentPanelClass;
export const elevatedPanel = elevatedPanelClass;
export const softPanel = softPanelClass;
export const toolbarSurface = toolbarSurfaceClass;
export const scopeBarSurface = scopeBarSurfaceClass;
export { dangerSurface, infoSurface, successSurface, warningSurface };

export const pageFrame = "flex h-full min-h-0 min-w-0 flex-col overflow-hidden";
export const pageHeader = "mb-4 flex shrink-0 items-start justify-between gap-4";
export const pageHeaderText = "min-w-0";
export const pageHeaderActions = "flex shrink-0 flex-wrap items-center justify-end gap-2";
export const pageBody = "min-h-0 flex-1 overflow-auto overscroll-contain pr-1";
export const viewStage = "min-h-0 flex-1 overflow-hidden";
export const pageSurface = "h-full min-h-0 min-w-0 overflow-auto overscroll-contain pr-1";
export const splitLayout = "grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto xl:overflow-hidden";
export const cardGrid = "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3";
export const toolbar = "flex flex-wrap items-center justify-between gap-3";
export const inlineActions = "flex flex-wrap items-center gap-2";
export const formSection = cn(contentPanel, "grid gap-3 p-4");
export const formRow = "grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center";

export const panelSurface = cn(appPanel, "min-h-0 p-5");
export const rowSurface =
  "min-h-[var(--zc-row-height-default)] rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-3 text-left transition-[background,border-color,box-shadow,color]";
export const compactRowSurface =
  "min-h-[var(--zc-row-height-compact)] rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] px-3 py-2 text-left transition-[background,border-color,box-shadow,color]";

export const pageTitle = "m-0 text-2xl font-semibold tracking-[-0.01em] text-[var(--zc-text-primary)]";
export const pageSubtitle = "mt-1 text-sm leading-6 text-[var(--zc-text-secondary)]";
export const sectionHeading = "m-0 text-lg font-semibold text-[var(--zc-text-primary)]";
export const sectionDescription = "mt-1 text-sm leading-6 text-[var(--zc-text-secondary)]";
export const sectionTitle = "mb-4 flex items-start justify-between gap-4 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-[var(--zc-text-secondary)]";
export const metricValue = "text-3xl font-semibold tabular-nums tracking-[-0.02em] text-[var(--zc-text-primary)]";
export const metricLabel = "text-xs font-semibold uppercase tracking-[0.12em] text-[var(--zc-text-tertiary)]";
export const metadataText = "text-sm leading-6 text-[var(--zc-text-secondary)]";
export const mutedText = metadataText;
export const quietText = "text-xs leading-5 text-[var(--zc-text-tertiary)]";
export const dangerText = "text-sm font-medium text-[var(--zc-danger-text)]";
export const warningText = "text-sm font-medium text-[var(--zc-warning-text)]";
export const successText = "text-sm font-medium text-[var(--zc-success-text)]";

export const formGrid = "grid grid-cols-2 gap-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-medium [&_label]:text-[var(--zc-text-secondary)]";
export const segmented = "inline-flex max-w-full flex-wrap items-center gap-1 rounded-[var(--zc-radius-control)] border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] p-1";
