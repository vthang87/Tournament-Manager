import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EntryService,
  EventService,
  PlayerService,
  TournamentAccessService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import {
  deleteEntryAction,
  disqualifyEntryAction,
  withdrawEntryAction,
} from "@/features/entries/actions";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("entries");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    return pageTitle(t("title"), event.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function EntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
  searchParams: Promise<{ status?: string; seeded?: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const filters = await searchParams;
  const db = getDb();
  const t = await getTranslations("entries");
  const tc = await getTranslations("common");

  let event;
  try {
    await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  const actor = { userId: user.id, role: user.role };
  const entryService = new EntryService(db);
  const [entries, summary, players] = await Promise.all([
    entryService.listByEvent(eventId),
    entryService.validationSummary(eventId),
    new PlayerService(db).listForTournament(actor, tournamentId),
  ]);
  const playerName = new Map(players.map((p) => [p.id, p.displayName]));

  let filtered = entries;
  if (filters.status) {
    filtered = filtered.filter((e) => e.status === filters.status);
  }
  if (filters.seeded === "1") {
    filtered = filtered.filter((e) => e.seed != null);
  }

  const access = await new TournamentAccessService(db).resolve(
    actor,
    tournamentId,
  );
  const canImport = canPerform(access.role, "import");
  const isDoubles = event.type === "DOUBLES";
  const summaryText = isDoubles
    ? t("pairsSummary", {
        active: summary.active,
        seeded: summary.seeded,
        withdrawn: summary.withdrawn,
        disqualified: summary.disqualified,
      })
    : t("summary", {
        active: summary.active,
        seeded: summary.seeded,
        withdrawn: summary.withdrawn,
        disqualified: summary.disqualified,
      });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <AdminBreadcrumbs
            tournament={{ id: tournamentId }}
            event={{ id: eventId, name: event.name }}
            current={isDoubles ? t("pairsTitle") : t("title")}
          />
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {isDoubles ? t("pairsTitle") : t("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{summaryText}</p>
        </div>
        {canImport &&
        (event.status === "SETUP" || event.status === "DRAW_READY") ? (
          <Link
            href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries/new`}
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isDoubles ? t("addPair") : t("addEntry")}
          </Link>
        ) : null}
      </div>

      {summary.invalid.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">{t("validationIssues")}</p>
          <ul className="mt-1 list-disc pl-5">
            {summary.invalid.map((item) => (
              <li key={item.entryId}>
                {item.displayName}: {item.errors.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries`}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
        >
          {tc("all")}
        </Link>
        <Link
          href={`?status=ACTIVE`}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
        >
          {t("active")}
        </Link>
        <Link
          href={`?seeded=1`}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
        >
          {t("seeded")}
        </Link>
        <Link
          href={`?status=WITHDRAWN`}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
        >
          {t("withdrawn")}
        </Link>
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white sm:hidden">
        {filtered.map((entry) => (
          <article key={entry.id} className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries/${entry.id}`}
                  className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                >
                  {entry.displayName}
                </Link>
                <p className="mt-1 text-sm leading-snug text-slate-600">
                  {entry.members
                    .map((m) => playerName.get(m.playerId) ?? m.playerId)
                    .join(" / ")}
                </p>
              </div>
              {entry.seed != null ? (
                <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-white">
                  #{entry.seed}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                {t("ranking")}:{" "}
                <strong className="font-medium text-slate-800">
                  {entry.ranking ?? tc("dash")}
                </strong>
              </span>
              <span className="font-medium uppercase tracking-wide text-slate-700">
                {entry.status}
              </span>
            </div>

            {canImport && entry.status === "ACTIVE" ? (
              <div
                className={`grid gap-2 border-t border-slate-100 pt-3 ${
                  event.status === "SETUP" ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
                <form
                  action={async () => {
                    "use server";
                    await withdrawEntryAction(
                      tournamentId,
                      eventId,
                      entry.id,
                    );
                  }}
                >
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    {t("withdraw")}
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await disqualifyEntryAction(
                      tournamentId,
                      eventId,
                      entry.id,
                    );
                  }}
                >
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    {t("disqualify")}
                  </Button>
                </form>
                {event.status === "SETUP" ? (
                  <form
                    action={async () => {
                      "use server";
                      await deleteEntryAction(
                        tournamentId,
                        eventId,
                        entry.id,
                      );
                    }}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      {tc("delete")}
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("seed")}</TableHead>
              <TableHead>
                {isDoubles ? t("pairName") : t("displayName")}
              </TableHead>
              <TableHead>
                {isDoubles ? t("pairMembers") : t("members")}
              </TableHead>
              <TableHead>{t("ranking")}</TableHead>
              <TableHead>{tc("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {entry.seed != null ? (
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-white">
                      #{entry.seed}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries/${entry.id}`}
                    className="font-medium hover:underline"
                  >
                    {entry.displayName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {entry.members
                    .map((m) => playerName.get(m.playerId) ?? m.playerId)
                    .join(" / ")}
                </TableCell>
                <TableCell>{entry.ranking ?? "—"}</TableCell>
                <TableCell>{entry.status}</TableCell>
                <TableCell className="text-right">
                  {canImport && entry.status === "ACTIVE" ? (
                    <div className="flex justify-end gap-1">
                      <form
                        action={async () => {
                          "use server";
                          await withdrawEntryAction(
                            tournamentId,
                            eventId,
                            entry.id,
                          );
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          {t("withdraw")}
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await disqualifyEntryAction(
                            tournamentId,
                            eventId,
                            entry.id,
                          );
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          {t("disqualify")}
                        </Button>
                      </form>
                      {event.status === "SETUP" ? (
                        <form
                          action={async () => {
                            "use server";
                            await deleteEntryAction(
                              tournamentId,
                              eventId,
                              entry.id,
                            );
                          }}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            {tc("delete")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
