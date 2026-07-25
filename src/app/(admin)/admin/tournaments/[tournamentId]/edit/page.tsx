import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { updateTournamentAction } from "@/features/tournaments/actions";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const t = await getTranslations("tournaments");
  try {
    const tournament = await new TournamentService(getDb()).getById(tournamentId);
    return pageTitle(t("edit"), tournament.name);
  } catch {
    return pageTitle(t("edit"));
  }
}

export const dynamic = "force-dynamic";

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRoleOrRedirect(["ADMIN"]);
  const { tournamentId } = await params;
  const t = await getTranslations("tournaments");

  let tournament;
  try {
    tournament = await new TournamentService(getDb()).getById(tournamentId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {tournament.name}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("edit")}</h2>
      </div>

      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        action={updateTournamentAction.bind(null, tournamentId)}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" required defaultValue={tournament.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">{t("slug")}</Label>
          <Input id="slug" name="slug" required defaultValue={tournament.slug} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">{t("location")}</Label>
          <Input
            id="location"
            name="location"
            defaultValue={tournament.location ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">{t("timezone")}</Label>
          <Input
            id="timezone"
            name="timezone"
            required
            defaultValue={tournament.timezone}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">{t("startDate")}</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={tournament.startDate ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">{t("endDate")}</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={tournament.endDate ?? ""}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">{t("description")}</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={tournament.description ?? ""}
          />
        </div>
      </ActionForm>
    </div>
  );
}
