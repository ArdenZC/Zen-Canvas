import { createElement, type ReactNode } from "react";
import type { Density } from "../../types/ui";
import { cn } from "../../utils/tw";
import { dangerSurface, infoSurface, metadataText, quietText, successSurface, warningSurface } from "./surfaces";

type NoticeTone = "info" | "success" | "warning" | "danger" | "error";

function surfaceForTone(tone: NoticeTone): string {
  if (tone === "success") return successSurface;
  if (tone === "warning") return warningSurface;
  if (tone === "danger" || tone === "error") return dangerSurface;
  return infoSurface;
}

export function NoticeBanner({
  tone = "info",
  title,
  children,
  action,
  density = "default"
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  density?: Density;
}) {
  const compact = density === "compact";
  return createElement(
    "div",
    {
      className: cn(surfaceForTone(tone), "flex items-start justify-between gap-3 text-sm", compact ? "px-3 py-2" : "px-3 py-3"),
      role: tone === "danger" || tone === "error" ? "alert" : "status",
      "aria-live": tone === "danger" || tone === "error" ? "assertive" : "polite",
      "aria-atomic": "true",
      "data-density": density
    },
    createElement(
      "div",
      { className: "min-w-0" },
      title ? createElement("strong", { className: "block text-[var(--zc-text-primary)]" }, title) : null,
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
          : "border-[var(--zc-border)] bg-[var(--zc-surface-subtle)]";
  const isCompact = density === "compact";

  return createElement(
    "div",
    {
      className: cn(
        "grid place-items-center rounded-[var(--zc-radius-row)] border text-center",
        isCompact ? "min-h-0 px-4 py-4" : "min-h-28 border-dashed px-5 py-6",
        toneClass
      ),
      role: tone === "error" ? "alert" : "status",
      "aria-live": tone === "error" ? "assertive" : "polite",
      "aria-atomic": "true",
      "data-density": density,
      "data-state": tone
    },
    createElement(
      "div",
      { className: cn("grid max-w-xl", isCompact ? "gap-2" : "gap-3") },
      createElement(
        "div",
        null,
        createElement("strong", { className: cn("block text-[var(--zc-text-primary)]", isCompact ? "text-sm" : "text-base") }, title),
        description ? createElement("span", { className: cn(isCompact ? quietText : metadataText, "mt-1 block") }, description) : null
      ),
      primaryAction || secondaryAction
        ? createElement("div", { className: "flex flex-wrap justify-center gap-2" }, primaryAction, secondaryAction)
        : null
    )
  );
}
