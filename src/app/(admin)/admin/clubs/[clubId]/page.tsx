import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClubService } from "@/application/services";
import { getDb } from "@/db/client";
import { updateClubAction } from "@/features/participants/actions";
import {
  getCurrentUser,
  requireAuthOrRedirect,
} from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const t = await getTranslations("clubs");
  try {
    const user = await getCurrentUser();
    if (!user) {
      return pageTitle(t("title"));
    }
    const club = await new ClubService(getDb()).getById(
      { userId: user.id, role: user.role },
      clubId,
    );
    return pageTitle(club.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const user = await requireAuthOrRedirect();
  const { clubId } = await params;
  const t = await getTranslations("clubs");
  const tc = await getTranslations("common");

  let club;
  try {
    club = await new ClubService(getDb()).getById(
      { userId: user.id, role: user.role },
      clubId,
    );
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/clubs"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {club.name}
        </h2>
      </div>
      <ActionForm
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        action={updateClubAction.bind(null, clubId)}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{tc("name")}</Label>
          <Input id="name" name="name" required defaultValue={club.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shortName">{tc("shortName")}</Label>
          <Input
            id="shortName"
            name="shortName"
            defaultValue={club.shortName ?? ""}
          />
        </div>
      </ActionForm>
    </div>
  );
}
