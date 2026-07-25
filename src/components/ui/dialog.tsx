"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn(
        // Tailwind Preflight resets dialog margin — restore centering for showModal().
        "fixed inset-0 z-50 m-auto h-fit max-h-[min(90vh,40rem)] w-[min(100%-2rem,28rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-lg backdrop:bg-slate-900/40",
        className,
      )}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === ref.current) {
          onOpenChange(false);
        }
      }}
    >
      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </dialog>
  );
}
