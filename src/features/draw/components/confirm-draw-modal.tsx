"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ConfirmDrawModal({
  open,
  pending,
  error,
  softWarningCount,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  softWarningCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("draw");
  const tCommon = useTranslations("common");

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-draw-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3
          id="confirm-draw-title"
          className="text-lg font-semibold text-slate-900"
        >
          {t("confirmTitle")}
        </h3>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>
            {t("confirmBody1")}{" "}
            <span className="font-medium">DRAW_CONFIRMED</span>
            .
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("confirmBody2")}</li>
            <li>{t("confirmBody3")}</li>
            <li>{t("confirmBody4")}</li>
          </ul>
          {softWarningCount > 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {softWarningCount === 1
                ? t("softWarningOne", { count: softWarningCount })
                : t("softWarningMany", { count: softWarningCount })}{" "}
              {t("softWarningHint")}
            </p>
          ) : null}
          {error ? (
            <p className="text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? t("confirming") : t("confirmLock")}
          </Button>
        </div>
      </div>
    </div>
  );
}
