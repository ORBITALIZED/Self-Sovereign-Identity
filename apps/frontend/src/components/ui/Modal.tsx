import { useEffect, useRef } from "react";
import clsx from "clsx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        ref={ref}
        tabIndex={-1}
        className="surface-card w-full max-w-md outline-none"
        role="dialog"
        aria-modal="true"
      >
        <header className="px-6 py-4 border-b border-surface-700">
          <h2 className="text-lg font-semibold">{title}</h2>
        </header>
        <div className={clsx("px-6 py-4")}>{children}</div>
      </div>
    </div>
  );
}
