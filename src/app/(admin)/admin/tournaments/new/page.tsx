import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTournamentAction } from "@/features/tournaments/actions";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";

export default async function NewTournamentPage() {
  await requireRoleOrRedirect(["ADMIN"]);
  const t = await getTranslations("tournaments");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/tournaments"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("new")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("step1Hint")}</p>
      </div>

      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        submitLabel={t("createTournament")}
        action={createTournamentAction}
      >
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
