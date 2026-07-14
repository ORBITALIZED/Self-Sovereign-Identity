import { Loader2 } from "lucide-react";
import clsx from "clsx";

type Size = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<Size, string> = {
  sm: "w-3 h-3",
  md: "w-5 h-5",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

export interface SpinnerProps {
  /** Visual size of the spinner. Default `"md"`. */
  size?: Size;
  /** Extra class names to merge onto the spinner wrapper. */
  className?: string;
  /** Accessible label for screen-readers (default: "Loading…"). */
  label?: string;
}

/**
 * Inline spinner built on `lucide-react`'s `Loader2` icon. The spinner is
 * rendered as a focusable status region with an accessible `aria-live`
 * label so assistive tech announces the loading state.
 */
export function Spinner({ size = "md", className, label = "Loading…" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={clsx("inline-flex items-center", className)}
    >
      <Loader2 className={clsx("animate-spin text-brand-500", sizeClasses[size])} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
