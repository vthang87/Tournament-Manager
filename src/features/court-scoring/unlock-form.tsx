"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockCourtAction } from "./actions";

export function CourtUnlockForm({
  slug,
  code,
  courtName,
  tournamentName,
}: {
  slug: string;
  code: string;
  courtName: string;
  tournamentName: string;
}) {
  const t = useTranslations("courtScoring");
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {tournamentName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {courtName}{" "}
          <span className="text-slate-500">({code})</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t("unlockHint")}</p>
      </div>
      <form
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData();
          fd.set("pin", pin);
          startTransition(async () => {
            const result = await unlockCourtAction(slug, code, fd);
            if (!result.ok) {
              setError(
                result.code === "UNAUTHORIZED"
                  ? t("wrongPin")
                  : result.error,
              );
              return;
            }
            router.refresh();
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="courtPin">{t("pinLabel")}</Label>
          <Input
            id="courtPin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-12 text-center text-2xl tracking-[0.4em]"
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? t("unlocking") : t("unlock")}
        </Button>
      </form>
    </div>
  );
}
