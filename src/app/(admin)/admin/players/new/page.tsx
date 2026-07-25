import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ClubService } from "@/application/services";
import { getDb } from "@/db/client";
import { createPlayerAction } from "@/features/participants/actions";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("players");
  return pageTitle(t("new"));
}

export const dynamic = "force-dynamic";

export default async function NewPlayerPage() {
  await requireRoleOrRedirect(["ADMIN", "OPERATOR"]);
  const t = await getTranslations("players");
  const tc = await getTranslations("common");
  const te = await getTranslations("entries");
  const clubs = await new ClubService(getDb()).list();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/players"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("new")}</h2>
      </div>
      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        submitLabel={t("create")}
        action={createPlayerAction}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{tc("legalName")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{tc("displayName")}</Label>
          <Input id="displayName" name="displayName" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">{tc("gender")}</Label>
          <Select id="gender" name="gender" defaultValue="UNSPECIFIED">
            <option value="MALE">{tc("male")}</option>
            <option value="FEMALE">{tc("female")}</option>
            <option value="OTHER">{tc("other")}</option>
            <option value="UNSPECIFIED">{tc("unspecified")}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clubId">{te("club")}</Label>
          <Select id="clubId" name="clubId" defaultValue="">
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
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{tc("phone")}</Label>
            <Input id="phone" name="phone" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ranking">{tc("ranking")}</Label>
          <Input id="ranking" name="ranking" type="number" min={1} />
        </div>
      </ActionForm>
    </div>
  );
}
