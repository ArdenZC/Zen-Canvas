import { createElement, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Variants } from "motion/react";
import { CircleCheck, ShieldAlert, Trash2 } from "lucide-react";
import { ModalPortal } from "../../components/modal/ModalPortal";
import {
  appPanel as appPanelClass,
  buttonSecondary,
  buttonIcon,
  cn,
  contentPanel,
  dangerSurface,
  elevatedPanel,
  glassButtonDanger,
  glassButtonPrimary,
  glassButtonWarning,
  infoSurface,
  sectionTitle,
  softPanel as softPanelClass,
  scopeBarSurface as scopeBarSurfaceClass,
  successSurface,
  toolbarSurface as toolbarSurfaceClass,
  toneClasses,
  warningSurface
} from "../../utils/tw";

export const listMotion: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(2px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }
  }
};

export const itemMotion: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(2px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }
  }
};

export const appPanel = appPanelClass;
export { contentPanel, elevatedPanel, dangerSurface, warningSurface, infoSurface, successSurface };
export const softPanel = softPanelClass;
export const toolbarSurface = toolbarSurfaceClass;
export const scopeBarSurface = scopeBarSurfaceClass;

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
  "rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-left shadow-sm transition-[background,border-color,box-shadow,color]";
export const compactRowSurface =
  "rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-left transition-[background,border-color,box-shadow,color]";

export const pageTitle = "m-0 text-2xl font-semibold tracking-[-0.01em] text-[var(--ink)]";
export const pageSubtitle = "mt-1 text-sm leading-6 text-[var(--muted)]";
export const sectionHeading = "m-0 text-lg font-semibold text-[var(--ink)]";
export const sectionDescription = "mt-1 text-sm leading-6 text-[var(--muted)]";
export const metricValue = "text-3xl font-semibold tabular-nums tracking-[-0.02em] text-[var(--ink)]";
export const metricLabel = "text-xs font-semibold uppercase tracking-[0.12em] text-[var(--quiet)]";
export const metadataText = "text-sm leading-6 text-[var(--muted)]";
export const mutedText = metadataText;
export const quietText = "text-xs leading-5 text-[var(--quiet)]";
export const dangerText = "text-sm font-medium text-[var(--zc-danger-text)]";
export const warningText = "text-sm font-medium text-[var(--zc-warning-text)]";
export const successText = "text-sm font-medium text-[var(--zc-success-text)]";

export const formGrid = "grid grid-cols-2 gap-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-medium [&_label]:text-[var(--muted)]";
export const segmented = "inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-1";

export function segmentButton(active: boolean): string {
  return cn(
    "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] transition-[background,border-color,box-shadow,color] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--ink)]",
    active && "bg-[var(--zc-primary)] text-[var(--zc-primary-contrast)] shadow-sm hover:bg-[var(--zc-primary-hover)] hover:text-[var(--zc-primary-contrast)]"
  );
}

export function toggleSwitch(on: boolean): string {
  return cn(
    "relative h-7 w-12 shrink-0 rounded-full border border-[var(--zc-control-border)] bg-[var(--zc-surface-subtle)] shadow-inner transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zc-focus-ring)] disabled:cursor-not-allowed disabled:border-[var(--zc-control-border)] disabled:bg-[var(--zc-surface-subtle)] disabled:opacity-55 [&_i]:absolute [&_i]:left-1 [&_i]:top-1 [&_i]:h-5 [&_i]:w-5 [&_i]:rounded-full [&_i]:bg-[var(--zc-surface)] [&_i]:shadow-sm [&_i]:ring-1 [&_i]:ring-[var(--zc-border)] [&_i]:transition",
    on && "border-[var(--zc-primary)] bg-[var(--zc-primary)] shadow-[0_2px_8px_var(--zc-primary-soft)] [&_i]:translate-x-5 [&_i]:ring-[var(--zc-primary-pressed)]"
  );
}

export function SwitchButton({
  checked,
  label,
  onChange,
  disabled = false,
  statusLabel
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  statusLabel?: string;
}) {
  return createElement(
    "span",
    { className: "inline-flex items-center gap-2" },
    createElement(
      "button",
      {
        type: "button",
        className: toggleSwitch(checked),
        disabled,
        role: "switch",
        "aria-checked": checked,
        "aria-label": label,
        title: label,
        onClick: () => onChange(!checked)
      },
      createElement("i")
    ),
    statusLabel
      ? createElement(
          "span",
          { className: cn("min-w-10 text-xs font-medium", checked ? "text-[var(--zc-primary-text)]" : "text-[var(--muted)]") },
          statusLabel
        )
      : null
  );
}

export function sourceBadge(source: string): string {
  return cn(
    "rounded-full border px-2 py-1 text-xs font-medium",
    source === "user" || source === "user_space" ? toneClasses("green") : toneClasses("blue")
  );
}

export function interactiveRow(options: { selected?: boolean; disabled?: boolean } = {}): string {
  return cn(
    rowSurface,
    "transition-[background,border-color,box-shadow,color,opacity]",
    !options.disabled && "hover:border-[var(--zc-control-border-hover)] hover:bg-[var(--zc-surface-hover)] hover:shadow-[inset_0_1px_0_var(--zc-brand-canvas-highlight)]",
    options.selected && "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] shadow-[inset_0_1px_0_var(--zc-brand-canvas-highlight),0_0_0_3px_var(--zc-focus-ring-soft)]",
    options.disabled && "pointer-events-none opacity-55"
  );
}

export function compactInteractiveRow(options: { selected?: boolean; disabled?: boolean } = {}): string {
  return cn(
    compactRowSurface,
    "transition-[background,border-color,box-shadow,color,opacity]",
    !options.disabled && "hover:border-[var(--zc-control-border-hover)] hover:bg-[var(--zc-surface-hover)] hover:shadow-[inset_0_1px_0_var(--zc-brand-canvas-highlight)]",
    options.selected && "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] shadow-[inset_0_1px_0_var(--zc-brand-canvas-highlight)]",
    options.disabled && "pointer-events-none opacity-55"
  );
}

type NoticeTone = "info" | "success" | "warning" | "danger" | "error";
type BadgeTone = "blue" | "green" | "amber" | "red" | "slate" | "purple" | "success" | "warning" | "danger" | "info";

function surfaceForTone(tone: NoticeTone): string {
  if (tone === "success") return successSurface;
  if (tone === "warning") return warningSurface;
  if (tone === "danger" || tone === "error") return dangerSurface;
  return infoSurface;
}

function badgeTone(tone: BadgeTone): string {
  if (tone === "success") return toneClasses("green");
  if (tone === "warning") return toneClasses("amber");
  if (tone === "danger") return toneClasses("red");
  if (tone === "info") return toneClasses("blue");
  return toneClasses(tone);
}

export function NoticeBanner({
  tone = "info",
  title,
  children,
  action
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return createElement(
    "div",
    {
      className: cn(surfaceForTone(tone), "flex items-start justify-between gap-3 text-sm"),
      role: tone === "danger" || tone === "error" ? "alert" : "status"
    },
    createElement(
      "div",
      { className: "min-w-0" },
      title ? createElement("strong", { className: "block text-[var(--ink)]" }, title) : null,
      children ? createElement("div", { className: cn(title && "mt-1", "leading-6") }, children) : null
    ),
    action ? createElement("div", { className: "shrink-0" }, action) : null
  );
}

export function StateBlock({
  tone = "neutral",
  title,
  description,
  primaryAction,
  secondaryAction,
  density = "default"
}: {
  tone?: "neutral" | "info" | "warning" | "error";
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  density?: "default" | "compact";
}) {
  const toneClass =
    tone === "error"
      ? "border-[var(--zc-danger-border)] bg-[var(--zc-danger-soft)]"
      : tone === "warning"
        ? "border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)]"
        : tone === "info"
          ? "border-[var(--zc-info-border)] bg-[var(--zc-info-soft)]"
          : "border-[var(--line)] bg-[var(--surface-soft)]";
  const isCompact = density === "compact";

  return createElement(
    "div",
    {
      className: cn(
        "grid place-items-center rounded-[var(--radius-md)] border text-center",
        isCompact ? "min-h-0 px-4 py-4" : "min-h-28 border-dashed px-5 py-6",
        toneClass
      )
    },
    createElement(
      "div",
      { className: cn("grid max-w-xl", isCompact ? "gap-2" : "gap-3") },
      createElement(
        "div",
        null,
        createElement("strong", { className: cn("block text-[var(--ink)]", isCompact ? "text-sm" : "text-base") }, title),
        description ? createElement("span", { className: cn(isCompact ? quietText : metadataText, "mt-1 block") }, description) : null
      ),
      primaryAction || secondaryAction
        ? createElement("div", { className: "flex flex-wrap justify-center gap-2" }, primaryAction, secondaryAction)
        : null
    )
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "blue"
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate" | "purple";
}) {
  void tone;

  return createElement(
    "div",
    { className: cn(contentPanel, "relative overflow-hidden p-4") },
    createElement(
      "div",
      { className: "flex items-center gap-2" },
      createElement("span", { className: metricLabel }, label)
    ),
    createElement("strong", { className: cn(metricValue, "mt-1 block") }, value),
    hint ? createElement("span", { className: cn(quietText, "mt-1 block") }, hint) : null
  );
}

export function ToneBadge({ tone = "info", children }: { tone?: BadgeTone; children: ReactNode }) {
  return createElement(
    "span",
    { className: cn("inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold", badgeTone(tone)) },
    children
  );
}

export function IconButton({
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { "aria-label": string }) {
  return createElement(
    "button",
    {
      ...props,
      className: cn(buttonIcon, className)
    },
    children
  );
}

export function ConfirmDialog({
  open,
  tone = "default",
  title,
  description,
  emphasis,
  confirmLabel,
  cancelLabel,
  isProcessing = false,
  errorMessage,
  restoreFocus,
  onConfirm,
  onCancel
}: {
  open: boolean;
  tone?: "default" | "warning" | "danger";
  title: string;
  description?: string;
  emphasis?: string;
  confirmLabel: string;
  cancelLabel: string;
  isProcessing?: boolean;
  errorMessage?: string;
  restoreFocus?: () => HTMLElement | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const isProcessingRef = useRef(isProcessing);
  const restoreFocusRef = useRef(restoreFocus);
  const titleId = useId();
  const descriptionId = useId();
  const emphasisId = useId();
  onCancelRef.current = onCancel;
  isProcessingRef.current = isProcessing;
  restoreFocusRef.current = restoreFocus;
  if (!open) return null;

  const ToneIcon = tone === "danger" ? Trash2 : tone === "warning" ? ShieldAlert : CircleCheck;
  const emphasisClass = tone === "danger"
    ? dangerSurface
    : tone === "warning"
      ? warningSurface
      : "rounded-[var(--zc-radius-field)] border border-[var(--zc-neutral-border)] bg-[var(--zc-neutral-soft)] px-3 py-2 text-[var(--zc-neutral-text)]";

  return createElement(
    ModalPortal,
    {
      initialFocusRef: cancelRef,
      restoreFocus,
      onEscape: () => {
        if (!isProcessingRef.current) onCancelRef.current();
      },
      children: createElement(
      "div",
      { className: "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--zc-overlay)] p-4 backdrop-blur-sm" },
      createElement(
        "div",
        {
          className: cn(elevatedPanel, "grid w-full max-w-md gap-4 p-5"),
          role: tone === "default" ? "dialog" : "alertdialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          "aria-describedby": [description ? descriptionId : "", emphasis ? emphasisId : ""].filter(Boolean).join(" ") || undefined
        },
        createElement(
          "div",
          null,
          createElement("h2", { id: titleId, className: sectionHeading }, title),
          description
            ? createElement("p", { id: descriptionId, className: cn(sectionDescription, "whitespace-pre-line tabular-nums") }, description)
            : null
        ),
        errorMessage
          ? createElement("p", { className: "text-sm text-[var(--zc-danger-text)]", role: "alert", "aria-live": "assertive" }, errorMessage)
          : null,
        emphasis
          ? createElement(
              "div",
              { id: emphasisId, className: cn(emphasisClass, "flex items-start gap-2 text-sm font-medium") },
              createElement(ToneIcon, { size: 18, className: "mt-0.5 shrink-0", "aria-hidden": "true" }),
              createElement("span", null, emphasis)
            )
          : null,
        createElement(
          "div",
          { className: "flex flex-wrap justify-end gap-2" },
          createElement("button", { ref: cancelRef, type: "button", className: buttonSecondary, onClick: onCancel, disabled: isProcessing }, cancelLabel),
          createElement("button", { type: "button", className: cn(tone === "danger" ? glassButtonDanger : tone === "warning" ? glassButtonWarning : glassButtonPrimary, "tabular-nums"), onClick: onConfirm, disabled: isProcessing }, confirmLabel)
        )
      )
    )
    }
  );
}

export function ControlGroup({
  title,
  description,
  id,
  children
}: {
  title: string;
  description?: string;
  id?: string;
  children: ReactNode;
}) {
  return createElement(
    "section",
    { id, tabIndex: id ? -1 : undefined, className: cn(formSection, id && "outline-none") },
    createElement(
      "div",
      null,
      createElement("h2", { className: sectionHeading }, title),
      description ? createElement("p", { className: sectionDescription }, description) : null
    ),
    children
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  statusLabel
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  statusLabel?: string;
}) {
  return createElement(
    "div",
    { className: formRow },
    createElement(
      "div",
      null,
      createElement("strong", { className: "block text-sm text-[var(--ink)]" }, label),
      description ? createElement("span", { className: metadataText }, description) : null
    ),
    createElement(SwitchButton, { checked, disabled, label, onChange, statusLabel })
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  ariaLabel,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  return createElement(
    "div",
    { className: cn(segmented, "justify-start md:justify-end"), role: "group", "aria-label": ariaLabel },
    ...options.map((option) =>
      createElement(
        "button",
        {
          key: option.value,
          type: "button",
          className: segmentButton(value === option.value),
          "aria-pressed": value === option.value,
          onClick: () => onChange(option.value)
        },
        option.label
      )
    )
  );
}

export function PageHeader({
  title,
  description,
  meta,
  actions
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return createElement(
    "header",
    { className: pageHeader },
    createElement(
      "div",
      { className: pageHeaderText },
      createElement("h1", { className: pageTitle }, title),
      description ? createElement("p", { className: pageSubtitle }, description) : null,
      meta ? createElement("div", { className: cn(metadataText, "mt-2") }, meta) : null
    ),
    actions ? createElement("div", { className: pageHeaderActions }, actions) : null
  );
}


export function SectionTitle({ title, body }: { title: string; body: string }) {
  return createElement(
    "div",
    { className: sectionTitle },
    createElement(
      "div",
      null,
      createElement("h2", null, title),
      createElement("p", null, body)
    )
  );
}
