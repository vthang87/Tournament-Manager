import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function Pagination({
  pathname,
  page,
  totalPages,
  totalItems,
  params = {},
}: {
  pathname: string;
  page: number;
  totalPages: number;
  totalItems: number;
  params?: Record<string, string | undefined>;
}) {
  if (totalItems === 0) {
    return null;
  }

  const t = await getTranslations("common");

  function href(targetPage: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }
    if (targetPage > 1) {
      search.set("page", String(targetPage));
    }
    const query = search.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const linkClass =
    "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";
  const disabledClass =
    "inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400";

  return (
    <nav
      aria-label={t("pagination")}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm tabular-nums text-slate-500">
        {t("paginationSummary", { page, totalPages, total: totalItems })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkClass}>
            {t("previous")}
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            {t("previous")}
          </span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={linkClass}>
            {t("next")}
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            {t("next")}
          </span>
        )}
      </div>
    </nav>
  );
}
