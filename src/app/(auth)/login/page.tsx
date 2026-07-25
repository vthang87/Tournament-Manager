import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";
import { LocaleSwitcher } from "@/features/i18n/locale-switcher";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return pageTitle(t("signIn"));
}

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const tMeta = await getTranslations("meta");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 px-4">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle>{tMeta("appName")}</CardTitle>
          <CardDescription>{t("signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
