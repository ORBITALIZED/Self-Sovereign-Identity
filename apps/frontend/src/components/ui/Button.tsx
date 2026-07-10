import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 hover:bg-brand-500 text-white shadow-glow",
  secondary: "bg-surface-700 hover:bg-surface-600 text-slate-100 border border-surface-600",
  ghost: "bg-transparent hover:bg-surface-700 text-slate-300",
  danger: "bg-red-600 hover:bg-red-500 text-white",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", icon, loading, className, children, disabled, ...rest },
    ref,
  ) => {
    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all",
          sizeClasses[size],
          "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-0",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {icon}
        {loading ? "…" : children}
      </button>
    );
  },
);
Button.displayName = "Button";
