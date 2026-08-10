import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { ActionForm } from "@/components/shared/action-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EventService,
  EventSetupService,
  MatchRuleService,
  StageService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { createMatchRuleAction } from "@/features/stages/actions";
import { SetupTemplatesPanel } from "@/features/stages/components/setup-templates-panel";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("rules");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    return pageTitle(t("title"), event.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function MatchRulesPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  await requireRoleOrRedirect([
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR",
    "SCOREKEEPER",
    "VIEWER",
  ]);
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("rules");
  const tc = await getTranslations("common");

  let event;
  let tournament;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  const rules = await new MatchRuleService(db).listByEvent(eventId);
  const mutable = event.status === "SETUP";
  const setup = new EventSetupService(db);
  const stageCount = (await new StageService(db).listByEvent(eventId)).length;

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumbs
          tournament={{ id: tournamentId }}
          event={{ id: eventId, name: event.name }}
          current={t("title")}
        />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("title")}
        </h2>
      </div>

      {mutable ? (
        <SetupTemplatesPanel
          tournamentId={tournamentId}
          eventId={eventId}
          hasStages={stageCount > 0}
          mode="rules"
          templates={setup.listSetupTemplates(tournament.sportId)}
          rulePresets={setup.listRulePresets(tournament.sportId)}
        />
      ) : null}

      <div className="grid gap-3 sm:hidden">
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{rule.name}</h3>
              {event.defaultMatchRuleId === rule.id ? (
                <span className="shrink-0 text-xs font-medium text-emerald-700">
                  {t("defaultBadge")}
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center">
              {[
                [t("bestOf"), rule.bestOfSets],
                [t("points"), rule.pointsToWin],
                [t("winBy"), rule.winBy],
                [t("max"), rule.maxPoints],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{t("bestOf")}</TableHead>
              <TableHead>{t("points")}</TableHead>
              <TableHead>{t("winBy")}</TableHead>
              <TableHead>{t("max")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  {rule.name}
                  {event.defaultMatchRuleId === rule.id ? (
                    <span className="ml-2 text-xs text-emerald-700">
                      {t("defaultBadge")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{rule.bestOfSets}</TableCell>
                <TableCell>{rule.pointsToWin}</TableCell>
                <TableCell>{rule.winBy}</TableCell>
                <TableCell>{rule.maxPoints}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {mutable ? (
        <ActionForm
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
          submitLabel={t("addRule")}
          action={createMatchRuleAction.bind(null, tournamentId, eventId)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">{tc("name")}</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder={t("placeholderName")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="bestOfSets">{t("bestOfSets")}</Label>
              <Input
                id="bestOfSets"
                name="bestOfSets"
                type="number"
                defaultValue={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pointsToWin">{t("pointsToWin")}</Label>
              <Input
                id="pointsToWin"
                name="pointsToWin"
                type="number"
                defaultValue={21}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="winBy">{t("winBy")}</Label>
              <Input
                id="winBy"
                name="winBy"
                type="number"
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPoints">{t("maxPoints")}</Label>
              <Input
                id="maxPoints"
                name="maxPoints"
                type="number"
                defaultValue={30}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="deuceEnabled" defaultChecked />
            {t("deuceEnabled")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="changeEndsEnabled" defaultChecked />
            {t("changeEnds")}
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="changeEndsAt">{t("changeEndsAt")}</Label>
            <Input
              id="changeEndsAt"
              name="changeEndsAt"
              type="number"
              defaultValue={11}
            />
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
