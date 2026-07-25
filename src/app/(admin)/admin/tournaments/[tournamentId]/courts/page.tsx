import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CourtService, TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  createCourtAction,
  deleteCourtAction,
} from "@/features/courts/actions";
import { CourtPinControls } from "@/features/courts/court-pin-controls";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const t = await getTranslations("courts");
  const db = getDb();
  try {
    const tournament = await new TournamentService(db).getById(tournamentId);
    return pageTitle(t("title"), tournament.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function CourtsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRoleOrRedirect(["ADMIN"]);
  const { tournamentId } = await params;
  const db = getDb();
  const t = await getTranslations("courts");
  const tc = await getTranslations("common");

  let tournament;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
  } catch {
    notFound();
  }

  const courts = await new CourtService(db).listByTournament(tournamentId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {tournament.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
          <Link
            href={`/admin/tournaments/${tournamentId}/courts/live`}
            className="text-sm font-medium text-slate-800 underline-offset-4 hover:underline"
          >
            {t("liveCourtBoard")}
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("pinHelp")}</p>
      </div>

      <ActionForm
        className="grid items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3"
        actionsClassName=""
        submitLabel={t("addCourt")}
        action={createCourtAction.bind(null, tournamentId)}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{tc("name")}</Label>
          <Input id="name" name="name" required placeholder={t("placeholderName")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">{tc("code")}</Label>
          <Input id="code" name="code" required placeholder={t("placeholderCode")} />
        </div>
      </ActionForm>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{tc("code")}</TableHead>
              <TableHead>{tc("active")}</TableHead>
              <TableHead>{t("refereeAccess")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {courts.map((court) => (
              <TableRow key={court.id}>
                <TableCell className="align-top">{court.name}</TableCell>
                <TableCell className="align-top">{court.code}</TableCell>
                <TableCell className="align-top">
                  {court.active ? tc("yes") : tc("no")}
                </TableCell>
                <TableCell className="align-top">
                  <CourtPinControls
                    tournamentId={tournamentId}
                    courtId={court.id}
                    courtCode={court.code}
                    tournamentSlug={tournament.slug}
                    hasAccessPin={court.hasAccessPin}
                  />
                </TableCell>
                <TableCell className="align-top text-right">
                  <form
                    action={async () => {
                      "use server";
                      await deleteCourtAction(tournamentId, court.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      {tc("delete")}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
