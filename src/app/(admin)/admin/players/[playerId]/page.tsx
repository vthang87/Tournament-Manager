import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ClubService, PlayerService } from "@/application/services";
import { getDb } from "@/db/client";
import { updatePlayerAction } from "@/features/participants/actions";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const t = await getTranslations("players");
  try {
    const player = await new PlayerService(getDb()).getById(playerId);
    return pageTitle(player.displayName);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  await requireRoleOrRedirect(["ADMIN", "OPERATOR", "SCOREKEEPER", "VIEWER"]);
  const { playerId } = await params;
  const t = await getTranslations("players");
  const tc = await getTranslations("common");
  const te = await getTranslations("entries");
  const db = getDb();

  let player;
  try {
    player = await new PlayerService(db).getById(playerId);
  } catch {
    notFound();
  }
  const clubs = await new ClubService(db).list();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/players"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {player.displayName}
        </h2>
      </div>
      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        action={updatePlayerAction.bind(null, playerId)}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{tc("legalName")}</Label>
          <Input id="name" name="name" required defaultValue={player.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{tc("displayName")}</Label>
          <Input
            id="displayName"
            name="displayName"
            required
            defaultValue={player.displayName}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">{tc("gender")}</Label>
          <Select id="gender" name="gender" defaultValue={player.gender}>
            <option value="MALE">{tc("male")}</option>
            <option value="FEMALE">{tc("female")}</option>
            <option value="OTHER">{tc("other")}</option>
            <option value="UNSPECIFIED">{tc("unspecified")}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clubId">{te("club")}</Label>
          <Select
            id="clubId"
            name="clubId"
            defaultValue={player.clubId ?? ""}
          >
            <option value="">{tc("none")}</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">{tc("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={player.email ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{tc("phone")}</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={player.phone ?? ""}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ranking">{tc("ranking")}</Label>
          <Input
            id="ranking"
            name="ranking"
            type="number"
            min={1}
            defaultValue={player.ranking ?? ""}
          />
        </div>
      </ActionForm>
    </div>
  );
}
