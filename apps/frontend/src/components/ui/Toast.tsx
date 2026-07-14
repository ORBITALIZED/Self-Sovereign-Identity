import { useEffect, type ComponentType } from "react";
import clsx from "clsx";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export type ToastKind = "info" | "success" | "warning" | "error";

const KIND_STYLES: Record<ToastKind, string> = {
  info: "border-brand-500/40 bg-brand-700/20 text-brand-100",
  success: "border-emerald-500/40 bg-emerald-700/20 text-emerald-100",
  warning: "border-yellow-500/40 bg-yellow-700/20 text-yellow-100",
  error: "border-red-500/40 bg-red-700/20 text-red-100",
};

const KIND_ICON: Record<ToastKind, ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
};

export interface ToastProps {
  message: string;
  kind?: ToastKind;
  visible: boolean;
  onClose: () => void;
  /** Time in ms before auto-close. Pass `0` to disable. Default `5000`. */
  durationMs?: number;
}

/**
 * Self-contained Toast — no provider required. Mounts to the top-right of
 * the viewport and auto-dismisses after `durationMs`. The dismiss timer
 * resets every time `visible` flips to `true`, so callers can reuse a
 * single Toast instance by passing a fresh `key`.
 */
export function Toast({ message, kind = "info", visible, onClose, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!visible || durationMs <= 0) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onClose]);

  if (!visible) return null;
  const Icon = KIND_ICON[kind];
  return (
    <div
      role="alert"
      aria-live="polite"
      className={clsx(
        "fixed top-4 right-4 z-50 surface-card border max-w-sm px-4 py-3",
        "flex items-start gap-3 shadow-glow",
        KIND_STYLES[kind],
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-current opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
