import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  EventService,
  EventSetupService,
  MatchRuleService,
  StageService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import {
  createStageAction,
  deleteStageAction,
  reorderStagesAction,
} from "@/features/stages/actions";
import { SetupTemplatesPanel } from "@/features/stages/components/setup-templates-panel";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("stages");
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

export default async function StagesPage({
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
  const t = await getTranslations("stages");
  const tc = await getTranslations("common");

  let tournament;
  let event;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  const stageService = new StageService(db);
  const stages = await stageService.listByEvent(eventId);
  const rules = await new MatchRuleService(db).listByEvent(eventId);
  const pipeline = await stageService.validatePipeline(eventId);
  const stageRules = await Promise.all(
    stages.map(async (stage) => ({
      stage,
      rule: await stageService.getStageRule(stage.id),
    })),
  );

  const mutable = event.status === "SETUP";
  const nextOrder =
    stages.length === 0
      ? 0
      : Math.max(...stages.map((s) => s.orderIndex)) + 1;
  const setup = new EventSetupService(db);

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
        <p className="mt-1 text-sm text-slate-600">
          {tournament.name} · {mutable ? t("editable") : t("locked")}
        </p>
      </div>

      {mutable ? (
        <SetupTemplatesPanel
          tournamentId={tournamentId}
          eventId={eventId}
          hasStages={stages.length > 0}
          mode="full"
          templates={setup.listSetupTemplates(tournament.sportId)}
          rulePresets={setup.listRulePresets(tournament.sportId)}
        />
      ) : null}

      {!pipeline.ok ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ul className="list-disc pl-5">
            {pipeline.errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-emerald-700">{t("pipelineResolvable")}</p>
      )}

      <div className="space-y-2">
        {stageRules.map(({ stage, rule }, index) => (
          <div
            key={stage.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium">
                {stage.orderIndex}. {stage.name}
              </p>
              <p className="text-xs text-slate-500">
                {stage.type} ·{" "}
                {stage.format === "GROUP" ? t("formatGroup") : t("formatKnockout")}{" "}
                ·{" "}
                {t("ruleSuffix", {
                  rule:
                    rules.find((r) => r.id === rule?.matchRuleId)?.name ??
                    t("eventDefault"),
                })}
              </p>
            </div>
            {mutable ? (
              <div className="flex gap-2">
                {index > 0 ? (
                  <form
                    action={async () => {
                      "use server";
                      const ids = stages.map((s) => s.id);
                      const next = [...ids];
                      const tmp = next[index]!;
                      next[index] = next[index - 1]!;
                      next[index - 1] = tmp;
                      await reorderStagesAction(tournamentId, eventId, next);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      {t("up")}
                    </Button>
                  </form>
                ) : null}
                {index < stages.length - 1 ? (
                  <form
                    action={async () => {
                      "use server";
                      const ids = stages.map((s) => s.id);
                      const next = [...ids];
                      const tmp = next[index]!;
                      next[index] = next[index + 1]!;
                      next[index + 1] = tmp;
                      await reorderStagesAction(tournamentId, eventId, next);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      {t("down")}
                    </Button>
                  </form>
                ) : null}
                <form
                  action={async () => {
                    "use server";
                    await deleteStageAction(tournamentId, eventId, stage.id);
                  }}
                >
                  <Button type="submit" size="sm" variant="outline">
                    {t("remove")}
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {mutable ? (
        <ActionForm
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
          submitLabel={t("addStage")}
          action={createStageAction.bind(null, tournamentId, eventId)}
        >
          <input type="hidden" name="orderIndex" value={nextOrder} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">{tc("name")}</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder={t("placeholderName")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">{t("typeCode")}</Label>
              <Input
                id="type"
                name="type"
                required
                placeholder={t("placeholderCode")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="format">{t("format")}</Label>
              <Select id="format" name="format" defaultValue="KNOCKOUT">
                <option value="GROUP">{t("formatGroup")}</option>
                <option value="KNOCKOUT">{t("formatKnockout")}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matchRuleId">{t("matchRule")}</Label>
              <Select id="matchRuleId" name="matchRuleId" defaultValue="">
                <option value="">{t("eventDefault")}</option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
