import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EventService, TournamentService } from "@/application/services";
import { getDb } from "@/db/client";

type Section = "tournaments" | "clubs" | "players" | "users";

type BreadcrumbItem = {
  href: string;
  label: string;
};

export async function AdminBreadcrumbs({
  section,
  tournament,
  event,
  items = [],
  current,
}: {
  section?: Section;
  tournament?: { id: string; name?: string };
  event?: { id: string; name?: string };
  items?: BreadcrumbItem[];
  current: string;
}) {
  const tnav = await getTranslations("nav");
  const db = getDb();
  const resolvedTournament = tournament
    ? {
        id: tournament.id,
        name:
          tournament.name ??
          (await new TournamentService(db).getById(tournament.id)).name,
      }
    : null;
  const resolvedEvent = event
    ? {
        id: event.id,
        name:
          event.name ??
          (await new EventService(db).getById(event.id)).name,
      }
    : null;

  const crumbs: BreadcrumbItem[] = [];
  const resolvedSection = tournament ? "tournaments" : section;
  if (resolvedSection) {
    const sectionLabel = tnav(resolvedSection);
    if (sectionLabel !== current) {
      crumbs.push({
        href: `/admin/${resolvedSection}`,
        label: sectionLabel,
      });
    }
  }
  if (resolvedTournament && resolvedTournament.name !== current) {
    crumbs.push({
      href: `/admin/tournaments/${resolvedTournament.id}`,
      label: resolvedTournament.name,
    });
  }
  if (
    resolvedTournament &&
    resolvedEvent &&
    resolvedEvent.name !== current
  ) {
    crumbs.push({
      href: `/admin/tournaments/${resolvedTournament.id}/events/${resolvedEvent.id}`,
      label: resolvedEvent.name,
    });
  }
  crumbs.push(...items);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-500">
        <li>
          <Link href="/admin" className="hover:text-slate-900">
            {tnav("dashboard")}
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
            <Link
              href={crumb.href}
              className="block max-w-80 truncate hover:text-slate-900"
              title={crumb.label}
            >
              {crumb.label}
            </Link>
          </li>
        ))}
        <li className="flex min-w-0 items-center gap-1">
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          <span
            className="block max-w-80 truncate font-medium text-slate-800"
            aria-current="page"
            title={current}
          >
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
