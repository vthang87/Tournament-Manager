import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserManagementService } from "@/application/services";
import { ActionForm } from "@/components/shared/action-form";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getDb } from "@/db/client";
import {
  resetUserPasswordAction,
  updateUserAction,
} from "@/features/users/actions";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATOR",
  "SCOREKEEPER",
  "VIEWER",
] as const;

export async function generateMetadata() {
  const t = await getTranslations("users");
  return pageTitle(t("edit"));
}

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const currentUser = await requireRoleOrRedirect(["SUPER_ADMIN"]);
  const t = await getTranslations("users");
  let user;
  try {
    user = await new UserManagementService(getDb()).getById(
      { userId: currentUser.id, role: currentUser.role },
      userId,
    );
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <AdminBreadcrumbs section="users" current={t("edit")} />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("edit")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">@{user.username}</p>
      </div>

      <ActionForm
        action={updateUserAction.bind(null, user.id)}
        submitLabel={t("save")}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="username">{t("username")}</Label>
          <Input
            id="username"
            name="username"
            defaultValue={user.username}
            required
            minLength={3}
            pattern="[a-z0-9._-]+"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={user.displayName}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">{t("role")}</Label>
          <Select id="role" name="role" defaultValue={user.role}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" defaultChecked={user.active} />
          {t("activeAccount")}
        </label>
        {user.id === currentUser.id ? (
          <p className="text-xs text-amber-700">{t("selfProtection")}</p>
        ) : null}
      </ActionForm>

      <ActionForm
        action={resetUserPasswordAction.bind(null, user.id)}
        submitLabel={t("resetPassword")}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h3 className="font-semibold">{t("resetPassword")}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {t("resetPasswordDescription")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
      </ActionForm>
    </div>
  );
}
