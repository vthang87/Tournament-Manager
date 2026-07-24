"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  isAppLocale,
  localeCookieName,
  type AppLocale,
} from "@/i18n/config";

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isAppLocale(locale)) {
    return;
  }
  const value: AppLocale = locale;
  const store = await cookies();
  store.set(localeCookieName, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
