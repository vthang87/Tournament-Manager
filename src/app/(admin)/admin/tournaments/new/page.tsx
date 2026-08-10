import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTournamentAction } from "@/features/tournaments/actions";
import { SportService } from "@/application/services";
import { getDb } from "@/db/client";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("tournaments");
  return pageTitle(t("new"));
}

export default async function NewTournamentPage() {
  await requireAuthOrRedirect();
  const t = await getTranslations("tournaments");
  const sports = await new SportService(getDb()).listActive();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <AdminBreadcrumbs section="tournaments" current={t("new")} />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("new")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("step1Hint")}</p>
      </div>

      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        submitLabel={t("createTournament")}
        action={createTournamentAction}
      >
        <div className="space-y-1.5">
          <Label htmlFor="sportId">Môn thể thao</Label>
          <select
            id="sportId"
            name="sportId"
            required
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">{t("slug")}</Label>
          <Input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="hcmc-open-2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">{t("location")}</Label>
          <Input id="location" name="location" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">{t("timezone")}</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue="Asia/Ho_Chi_Minh"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">{t("startDate")}</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">{t("endDate")}</Label>
            <Input id="endDate" name="endDate" type="date" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">{t("description")}</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
      </ActionForm>
    </div>
  );
}
