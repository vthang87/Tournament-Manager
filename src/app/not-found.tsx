import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFoundPage() {
  const t = await getTranslations("notFoundPage");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-md">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          {t("description")}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {t("backToDashboard")}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            {t("goToLogin")}
          </Link>
        </div>
      </div>
    </main>
  );
}
