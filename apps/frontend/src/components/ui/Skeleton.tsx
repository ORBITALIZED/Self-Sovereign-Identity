import clsx from "clsx";

export interface SkeletonProps {
  /** Tailwind width utility, e.g. `"w-40"`. */
  width?: string;
  /** Tailwind height utility, e.g. `"h-4"`. */
  height?: string;
  /** Round (`rounded-full`) vs square (`rounded-md`) placeholder style. Default `"rounded-md"`. */
  rounded?: "md" | "full";
  className?: string;
}

/**
 * Animated placeholder block used while data is loading.
 * Excludes `width`/`height` defaults that callers can override.
 */
export function Skeleton({
  width = "w-full",
  height = "h-4",
  rounded = "md",
  className,
}: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={clsx(
        "bg-surface-700 animate-pulse",
        width,
        height,
        rounded === "full" ? "rounded-full" : "rounded-md",
        className,
      )}
    />
  );
}
