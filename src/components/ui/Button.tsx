import { createElement, type ButtonHTMLAttributes } from "react";
import {
  buttonGhost,
  buttonIcon,
  buttonSecondary,
  buttonSubtle,
  cn,
  glassButtonDanger,
  glassButtonPrimary,
  glassButtonWarning
} from "../../utils/tw";

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

export type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle" | "warning" | "danger";
export type ButtonSize = "compact" | "default";

function buttonVariantClass(variant: ButtonVariant): string {
  if (variant === "primary") return glassButtonPrimary;
  if (variant === "warning") return glassButtonWarning;
  if (variant === "danger") return glassButtonDanger;
  if (variant === "ghost") return buttonGhost;
  if (variant === "subtle") return buttonSubtle;
  return buttonSecondary;
}

export function Button({
  variant = "secondary",
  size = "default",
  className,
  children,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
}) {
  return createElement(
    "button",
    {
      ...props,
      type,
      className: cn(
        buttonVariantClass(variant),
        size === "compact" && "min-h-[var(--zc-control-height-compact)] px-3 py-1.5 text-xs",
        size === "default" && "min-h-[var(--zc-control-height-default)]",
        className
      )
    },
    children
  );
}
