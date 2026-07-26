import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClubAction } from "@/features/participants/actions";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("clubs");
  return pageTitle(t("new"));
}

export default async function NewClubPage() {
  await requireAuthOrRedirect();
  const t = await getTranslations("clubs");
  const tc = await getTranslations("common");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <AdminBreadcrumbs section="clubs" current={t("new")} />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("new")}</h2>
      </div>
      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        submitLabel={t("create")}
        action={createClubAction}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{tc("name")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shortName">{tc("shortName")}</Label>
          <Input id="shortName" name="shortName" />
        </div>
      </ActionForm>
    </div>
  );
}
