import { createElement, type ReactNode } from "react";
import { cn, toneClasses } from "../../utils/tw";
import { contentPanel, metricLabel, metricValue } from "./surfaces";

export type BadgeTone = "blue" | "green" | "amber" | "red" | "slate" | "purple" | "success" | "warning" | "danger" | "info";

export function badgeTone(tone: BadgeTone): string {
  if (tone === "success") return toneClasses("green");
  if (tone === "warning") return toneClasses("amber");
  if (tone === "danger") return toneClasses("red");
  if (tone === "info") return toneClasses("blue");
  return toneClasses(tone);
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
  return createElement(
    "div",
    { className: cn(contentPanel, "relative overflow-hidden p-4", badgeTone(tone)) },
    createElement(
      "div",
      { className: "flex items-center gap-2" },
      createElement("span", { className: metricLabel }, label)
    ),
    createElement("strong", { className: cn(metricValue, "mt-1 block") }, value),
    hint ? createElement("span", { className: cn("text-xs leading-5 text-[var(--zc-text-tertiary)]", "mt-1 block") }, hint) : null
  );
}

export function ToneBadge({ tone = "info", children }: { tone?: BadgeTone; children: ReactNode }) {
  return createElement(
    "span",
    { className: cn("inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold", badgeTone(tone)) },
    children
  );
}
