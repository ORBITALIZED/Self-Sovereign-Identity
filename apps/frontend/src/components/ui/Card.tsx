import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("surface-card", className)} {...rest}>
      {children}
    </div>
  );
}
