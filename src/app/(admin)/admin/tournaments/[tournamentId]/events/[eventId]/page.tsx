import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EntryService,
  EventService,
  MatchRuleService,
  StageService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import {
  markEventDrawReadyAction,
  updateEventAction,
} from "@/features/events/actions";
import { eventStatusKey } from "@/i18n/status-labels";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("events");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");

  let tournament;
  let event;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  if (event.tournamentId !== tournamentId) {
    notFound();
  }

  const [rules, stages, entrySummary, pipeline] = await Promise.all([
    new MatchRuleService(db).listByEvent(eventId),
    new StageService(db).listByEvent(eventId),
    new EntryService(db).validationSummary(eventId),
    new StageService(db).validatePipeline(eventId),
  ]);
  const readyCheck = await new EventService(db).validateReady(eventId);

  const user = await getCurrentUser();
  const canSetup = user ? canPerform(user.role, "setup") : false;
  const canDraw = user ? canPerform(user.role, "draw") : false;
  const drawStatuses = new Set([
    "DRAW_READY",
    "DRAW_CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
  ]);
  const showDrawLink = drawStatuses.has(event.status);

  const eventTypeLabels: Record<string, string> = {
    SINGLES: t("typeSingles"),
    DOUBLES: t("typeDoubles"),
    TEAM: t("typeTeam"),
  };
  const genderLabels: Record<string, string> = {
    MALE: t("genderMale"),
    FEMALE: t("genderFemale"),
    MIXED: t("genderMixed"),
    OPEN: t("genderOpen"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/tournaments/${tournamentId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← {tournament.name}
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {event.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {eventTypeLabels[event.type] ?? event.type} ·{" "}
            {genderLabels[event.genderCategory] ?? event.genderCategory} ·{" "}
            <span className="font-medium text-slate-800">
              {tStatus(eventStatusKey(event.status))}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showDrawLink ? (
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/draw`}
            >
              <Button type="button" variant="secondary" size="sm">
                {canDraw ? t("openDraw") : t("viewDraw")}
              </Button>
            </Link>
          ) : null}
          {canSetup && event.status === "SETUP" ? (
            <form
              action={async () => {
                "use server";
                await markEventDrawReadyAction(tournamentId, eventId);
              }}
            >
              <Button type="submit" size="sm">
                {t("markDrawReady")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {!readyCheck.ok ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">{t("notReadyForDraw")}</p>
          <ul className="mt-1 list-disc pl-5">
            {readyCheck.errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {t("readyForDraw")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stagesCard")}</CardTitle>
            <CardDescription>
              {t("stagesDesc", {
                count: stages.length,
                valid: pipeline.ok ? t("pipelineValid") : t("pipelineInvalid"),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/stages`}
              className="text-sm font-medium underline"
            >
              {t("formatBuilder")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("matchRulesCard")}</CardTitle>
            <CardDescription>
              {t("matchRulesDesc", { count: rules.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/rules`}
              className="text-sm font-medium underline"
            >
              {t("manageRules")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("entriesCard")}</CardTitle>
            <CardDescription>
              {t("entriesDesc", {
                active: entrySummary.active,
                seeded: entrySummary.seeded,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries`}
              className="block text-sm font-medium underline"
            >
              {t("participants")}
            </Link>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/import`}
              className="block text-sm font-medium underline"
            >
              {t("excelImport")}
            </Link>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/export`}
              className="block text-sm font-medium underline"
            >
              {t("excelExport")}
            </Link>
          </CardContent>
        </Card>
        {showDrawLink ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("drawCard")}</CardTitle>
              <CardDescription>
                {event.status === "DRAW_READY"
                  ? t("drawDescOpen")
                  : t("drawDescLocked")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/admin/tournaments/${tournamentId}/events/${eventId}/draw`}
                className="text-sm font-medium underline"
              >
                {canDraw ? t("openDrawWorkspace") : t("viewDraw")}
              </Link>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("matchesCard")}</CardTitle>
            <CardDescription>{t("matchesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/matches`}
              className="text-sm font-medium underline"
            >
              {t("openMatches")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("groupsCard")}</CardTitle>
            <CardDescription>{t("groupsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/groups`}
              className="text-sm font-medium underline"
            >
              {t("groupsStandings")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bracketCard")}</CardTitle>
            <CardDescription>{t("bracketDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/bracket`}
              className="text-sm font-medium underline"
            >
              {t("viewGenerate")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("scheduleCard")}</CardTitle>
            <CardDescription>{t("scheduleDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/schedule`}
              className="text-sm font-medium underline"
            >
              {t("openTimeline")}
            </Link>
          </CardContent>
        </Card>
      </div>

      {canSetup && event.status === "SETUP" ? (
        <ActionForm
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
          submitLabel={t("updateEvent")}
          action={updateEventAction.bind(null, tournamentId, eventId)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">{tc("name")}</Label>
            <Input id="name" name="name" required defaultValue={event.name} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">{t("type")}</Label>
              <Select id="type" name="type" defaultValue={event.type}>
                <option value="SINGLES">{t("typeSingles")}</option>
                <option value="DOUBLES">{t("typeDoubles")}</option>
                <option value="TEAM">{t("typeTeam")}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="genderCategory">{t("gender")}</Label>
              <Select
                id="genderCategory"
                name="genderCategory"
                defaultValue={event.genderCategory}
              >
                <option value="MALE">{t("genderMale")}</option>
                <option value="FEMALE">{t("genderFemale")}</option>
                <option value="MIXED">{t("genderMixed")}</option>
                <option value="OPEN">{t("genderOpen")}</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultMatchRuleId">{t("defaultMatchRule")}</Label>
            <Select
              id="defaultMatchRuleId"
              name="defaultMatchRuleId"
              defaultValue={event.defaultMatchRuleId ?? ""}
            >
              <option value="">{tc("none")}</option>
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              name="thirdPlaceMatchEnabled"
              defaultChecked={event.thirdPlaceMatchEnabled}
            />
            {t("enableThirdPlace")}
          </label>
        </ActionForm>
      ) : null}
    </div>
  );
}
