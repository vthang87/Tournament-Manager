import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CourtService,
  TournamentAccessService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { createCourtAction } from "@/features/courts/actions";
import { EditableCourtRow } from "@/features/courts/editable-court-row";
import { canPerform } from "@/lib/auth/policies";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
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
  const user = await requireAuthOrRedirect();
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

  const actor = { userId: user.id, role: user.role };
  const [courts, access] = await Promise.all([
    new CourtService(db).listByTournamentWithPins(actor, tournamentId),
    new TournamentAccessService(db).resolve(actor, tournamentId),
  ]);
  const canSetup = canPerform(access.role, "setup");

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumbs
          tournament={{ id: tournamentId, name: tournament.name }}
          current={t("title")}
        />
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

      {canSetup ? (
        <ActionForm
          className="grid items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3"
          actionsClassName=""
          submitLabel={t("addCourt")}
          action={createCourtAction.bind(null, tournamentId)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">{tc("name")}</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder={t("placeholderName")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">{tc("code")}</Label>
            <Input
              id="code"
              name="code"
              required
              placeholder={t("placeholderCode")}
            />
          </div>
        </ActionForm>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{tc("code")}</TableHead>
              <TableHead>{tc("active")}</TableHead>
              <TableHead>{t("refereeAccess")}</TableHead>
              {canSetup ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {courts.map((court) => (
              <EditableCourtRow
                key={court.id}
                tournamentId={tournamentId}
                tournamentSlug={tournament.slug}
                canSetup={canSetup}
                court={court}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
