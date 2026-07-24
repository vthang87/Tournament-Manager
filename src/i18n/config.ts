export const locales = ["vi", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "vi";

export const localeCookieName = "tm_locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "vi" || value === "en";
}
