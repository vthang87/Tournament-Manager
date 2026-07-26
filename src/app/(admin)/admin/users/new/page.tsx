import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createUserAction } from "@/features/users/actions";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("users");
  return pageTitle(t("new"));
}

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATOR",
  "SCOREKEEPER",
  "VIEWER",
] as const;

export default async function NewUserPage() {
  const t = await getTranslations("users");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <AdminBreadcrumbs section="users" current={t("new")} />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("new")}</h2>
      </div>
      <ActionForm
        action={createUserAction}
        submitLabel={t("create")}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="username">{t("username")}</Label>
          <Input
            id="username"
            name="username"
            required
            minLength={3}
            pattern="[a-z0-9._-]+"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input id="displayName" name="displayName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-500">{t("passwordHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">{t("role")}</Label>
          <Select id="role" name="role" defaultValue="VIEWER">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" defaultChecked />
          {t("activeAccount")}
        </label>
      </ActionForm>
    </div>
  );
}
