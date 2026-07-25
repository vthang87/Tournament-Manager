import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

export const dynamic = "force-dynamic";

export default async function MatchRulesPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  await requireRoleOrRedirect(["ADMIN"]);
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("rules");
  const tc = await getTranslations("common");

  let event;
  try {
    await new TournamentService(db).getById(tournamentId);
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
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {event.name}
        </Link>
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
          templates={setup.listSetupTemplates()}
          rulePresets={setup.listRulePresets()}
        />
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white">
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
