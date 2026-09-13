import { createElement } from "react";
import { cn, focusVisibleState } from "../../utils/tw";

export const switchTrack =
  cn(
    "relative h-5 w-9 shrink-0 rounded-full border border-[var(--zc-control-border)] bg-[var(--zc-surface-subtle)] transition-[background,border-color] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]",
    focusVisibleState,
    "focus-visible:border-[var(--zc-focus)] disabled:cursor-not-allowed disabled:border-[var(--zc-control-border)] disabled:bg-[var(--zc-surface-subtle)] disabled:opacity-55"
  );

export const switchThumb =
  "pointer-events-none absolute left-[2px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[var(--zc-text-tertiary)] transition-[background,transform] duration-[var(--zc-duration-fast)] ease-[var(--zc-ease-standard)]";

export function toggleSwitch(on: boolean): string {
  return cn(
    switchTrack,
    on && "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)] [&_i]:translate-x-4 [&_i]:bg-[var(--zc-primary)]"
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
      createElement("i", { className: switchThumb })
    ),
    statusLabel
      ? createElement(
          "span",
          { className: cn("min-w-10 text-xs font-medium", checked ? "text-[var(--zc-primary-text)]" : "text-[var(--zc-text-secondary)]") },
          statusLabel
        )
      : null
  );
}
