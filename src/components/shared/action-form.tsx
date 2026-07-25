"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string };

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  actionsClassName,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Wrapper around the submit button. Default `mt-4`; use e.g. empty/`self-end` for grid rows. */
  actionsClassName?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = submitLabel ?? t("save");

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onSuccess?.();
        });
      }}
    >
      {children}
      {error ? (
        <p className="mt-3 text-sm text-red-600 md:col-span-full" role="alert">
          {error}
        </p>
      ) : null}
      <div className={actionsClassName ?? "mt-4"}>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : label}
        </Button>
      </div>
    </form>
  );
}
