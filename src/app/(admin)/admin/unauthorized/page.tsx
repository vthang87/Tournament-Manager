import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return pageTitle(t("unauthorized"));
}

export default async function UnauthorizedPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-lg pt-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("unauthorized")}</CardTitle>
          <CardDescription>{t("unauthorizedDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-100 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
          >
            {t("backToDashboard")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
