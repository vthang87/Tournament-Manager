"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginActionState } from "./actions";

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<LoginActionState, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="username" className="text-sm font-medium text-slate-700">
          {t("username")}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-slate-400"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-slate-400"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
