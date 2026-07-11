import { cn } from "../../utils/tw";

type BrandMarkSize = "micro" | "sidebar" | "app";

type BrandMarkProps = {
  size?: BrandMarkSize;
  decorative?: boolean;
  className?: string;
  "aria-label"?: string;
};

const sizeClasses: Record<
  BrandMarkSize,
  { root: string; core: string; canvas: string }
> = {
  micro: {
    root: "h-5 w-5",
    core: "right-0 top-0 h-3 w-3 shadow-[0_1px_4px_var(--zc-primary-soft)]",
    canvas: "bottom-0 left-0 h-3.5 w-3.5 rounded-[5px]"
  },
  sidebar: {
    root: "h-9 w-9",
    core: "right-0.5 top-0.5 h-[22px] w-[22px] shadow-[0_3px_10px_var(--zc-primary-soft)]",
    canvas: "bottom-0.5 left-0.5 h-[25px] w-[25px] rounded-[8px] backdrop-blur-[2px]"
  },
  app: {
    root: "h-20 w-20",
    core: "right-1 top-1 h-12 w-12 shadow-[0_6px_18px_var(--zc-primary-soft)]",
    canvas: "bottom-1 left-1 h-14 w-14 rounded-[18px] backdrop-blur-md"
  }
};

export function BrandMark({
  size = "sidebar",
  decorative = false,
  className,
  "aria-label": ariaLabel = "Zen Canvas"
}: BrandMarkProps) {
  const classes = sizeClasses[size];

  return (
    <span
      className={cn("relative inline-block shrink-0", classes.root, className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : ariaLabel}
      data-brand-mark-size={size}
    >
      {/* Zen Core: understanding and intelligent analysis. */}
      <span
        className={cn(
          "absolute rounded-full [background:linear-gradient(135deg,var(--zc-primary),var(--zc-brand-cyan))]",
          classes.core
        )}
      />
      {/* Canvas: the foreground space that receives and orders files. */}
      <span
        className={cn(
          "absolute border border-[var(--zc-brand-canvas-border)] bg-[var(--zc-brand-canvas)] shadow-[inset_0_1px_0_var(--zc-brand-canvas-highlight)]",
          classes.canvas
        )}
      />
    </span>
  );
}
