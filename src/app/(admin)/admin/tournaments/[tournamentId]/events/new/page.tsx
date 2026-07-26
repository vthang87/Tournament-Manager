import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { createEventAction } from "@/features/events/actions";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const t = await getTranslations("events");
  try {
    const tournament = await new TournamentService(getDb()).getById(tournamentId);
    return pageTitle(t("new"), tournament.name);
  } catch {
    return pageTitle(t("new"));
  }
}

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireAuthOrRedirect();
  const { tournamentId } = await params;
  const t = await getTranslations("events");
  const tc = await getTranslations("common");

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
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("new")}</h2>
      </div>

      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        submitLabel={t("create")}
        action={createEventAction.bind(null, tournamentId)}
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
          <Label htmlFor="type">{t("type")}</Label>
          <Select id="type" name="type" defaultValue="DOUBLES" required>
            <option value="SINGLES">{t("typeSingles")}</option>
            <option value="DOUBLES">{t("typeDoubles")}</option>
            <option value="TEAM">{t("typeTeam")}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="genderCategory">{t("genderCategory")}</Label>
          <Select
            id="genderCategory"
            name="genderCategory"
            defaultValue="MALE"
            required
          >
            <option value="MALE">{tc("male")}</option>
            <option value="FEMALE">{tc("female")}</option>
            <option value="MIXED">{tc("mixed")}</option>
            <option value="OPEN">{tc("open")}</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="thirdPlaceMatchEnabled" />
          {t("enableThirdPlace")}
        </label>
      </ActionForm>
    </div>
  );
}
