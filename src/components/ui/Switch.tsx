import { createElement } from "react";
import { cn } from "../../utils/tw";

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
          { className: cn("min-w-10 text-xs font-medium", checked ? "text-[var(--zc-primary-text)]" : "text-[var(--zc-text-secondary)]") },
          statusLabel
        )
      : null
  );
}
