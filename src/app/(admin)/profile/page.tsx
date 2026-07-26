import { getTranslations } from "next-intl/server";
import { ProfileService } from "@/application/services";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db/client";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/features/profile/actions";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("profile");
  return pageTitle(t("title"));
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const currentUser = await requireAuthOrRedirect();
  const profile = await new ProfileService(getDb()).get({
    userId: currentUser.id,
    role: currentUser.role,
  });
  const t = await getTranslations("profile");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
      </div>

      <ActionForm
        action={updateProfileAction}
        submitLabel={t("saveProfile")}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h3 className="font-semibold">{t("personalInformation")}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {t("personalInformationDescription")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">{t("username")}</Label>
          <Input id="username" value={profile.username} disabled readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={profile.displayName}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">{t("role")}</Label>
          <Input id="role" value={profile.role} disabled readOnly />
        </div>
      </ActionForm>

      <ActionForm
        action={changePasswordAction}
        submitLabel={t("changePassword")}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h3 className="font-semibold">{t("security")}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {t("securityDescription")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">{t("newPassword")}</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <p className="text-xs text-slate-500">{t("passwordHint")}</p>
      </ActionForm>
    </div>
  );
}
