import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  BracketService,
  DrawService,
  EntryService,
  EventService,
  StageService,
  TournamentService,
  TournamentAccessService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleDrawRepository } from "@/db/repositories/draw-repository";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { BracketBoard } from "@/features/bracket/components/bracket-board";
import { BracketControls } from "@/features/bracket/components/bracket-controls";
import { buildBracketBoardView } from "@/features/bracket/lib/build-bracket-view";
import { nextPowerOfTwo } from "@/features/bracket/lib/round-labels";
import { stageStatusKey } from "@/i18n/status-labels";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("bracket");
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

export default async function BracketPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("bracket");
  const ts = await getTranslations("schedule");
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

  const stages = await new StageService(db).listByEvent(eventId);
  const groupStages = stages.filter((s) => s.format === "GROUP");
  const knockoutStages = stages.filter((s) => s.format === "KNOCKOUT");
  const sourceStage = groupStages[0] ?? null;
  const targetStage = knockoutStages[0] ?? null;

  const bracketService = new BracketService(db);
  const drawService = new DrawService(db);
  const drawRepo = new DrizzleDrawRepository(db);
  const matchRepo = new DrizzleMatchRepository(db);
  const entries = await new EntryService(db).listByEvent(eventId);

  let knockoutMatches: Awaited<
    ReturnType<BracketService["listKnockoutMatches"]>
  > = [];
  let board = null;
  let loadError: string | null = null;
  let qualifiers: Awaited<
    ReturnType<BracketService["resolveQualification"]>
  >["qualifiers"] = [];

  let groups: Awaited<ReturnType<DrawService["listGroups"]>> = [];
  let groupEntries: Awaited<
    ReturnType<DrizzleDrawRepository["listGroupEntriesByStageId"]>
  > = [];

  if (sourceStage) {
    groups = await drawService.listGroups(sourceStage.id);
    groupEntries = await drawRepo.listGroupEntriesByStageId(sourceStage.id);
  }

  if (targetStage) {
    try {
      knockoutMatches = await bracketService.listKnockoutMatches(targetStage.id);
    } catch (err) {
      loadError = err instanceof Error ? err.message : t("failedLoad");
    }
  }

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  const access = await new TournamentAccessService(db).resolve(
    { userId: user.id, role: user.role },
    tournamentId,
  );
  const canDraw = canPerform(access.role, "draw");
  const canAdminReset = canPerform(access.role, "setup");

  if (sourceStage && targetStage && user && canDraw) {
    const rule = await bracketService.getQualificationRule(
      sourceStage.id,
      targetStage.id,
    );
    if (rule) {
      try {
        const resolved = await bracketService.resolveQualification(
          { userId: user.id, role: user.role },
          sourceStage.id,
          targetStage.id,
        );
        qualifiers = resolved.qualifiers;
      } catch {
        // Standings may be incomplete; bracket UI still renders.
      }
    }
  }

  if (knockoutMatches.length > 0) {
    const setsByMatchId = new Map<
      string,
      Awaited<ReturnType<DrizzleMatchRepository["listSets"]>>
    >();
    await Promise.all(
      knockoutMatches.map(async (m) => {
        setsByMatchId.set(m.id, await matchRepo.listSets(m.id));
      }),
    );
    board = buildBracketBoardView({
      matches: knockoutMatches,
      setsByMatchId,
      entries,
      groups,
      groupEntries,
      qualifiers,
    });
  }

  let groupStageCompletable = false;
  let groupCompleteBlockedReason: string | null = null;
  if (sourceStage) {
    if (sourceStage.status === "COMPLETED") {
      groupCompleteBlockedReason = t("groupCompleted");
    } else if (sourceStage.status !== "ACTIVE") {
      groupCompleteBlockedReason = t("groupStatus", {
        status: tStatus(stageStatusKey(sourceStage.status)),
      });
    } else {
      const stageMatches = await matchRepo.listByStageId(sourceStage.id);
      if (stageMatches.length === 0) {
        groupCompleteBlockedReason = t("noGroupMatches");
      } else {
        const open = stageMatches.filter(
          (m) =>
            m.status !== "COMPLETED" &&
            m.status !== "WALKOVER" &&
            m.status !== "CANCELLED",
        );
        if (open.length > 0) {
          groupCompleteBlockedReason = t("matchesOpen", { count: open.length });
        } else {
          groupStageCompletable = true;
        }
      }
    }
  } else {
    groupCompleteBlockedReason = t("noGroupStage");
  }

  const hasQualificationRule =
    sourceStage && targetStage
      ? Boolean(
          await bracketService.getQualificationRule(
            sourceStage.id,
            targetStage.id,
          ),
        )
      : false;

  const suggestedSize = nextPowerOfTwo(
    Math.max(qualifiers.length || 0, groups.length * 2 || 2),
  );

  const entryNames = Object.fromEntries(
    entries.map((e) => [e.id, e.displayName]),
  );
  const groupCodes = Object.fromEntries(groups.map((g) => [g.id, g.code]));

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {event.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {tournament.name} ·{" "}
              {targetStage
                ? `${targetStage.name} (${tStatus(stageStatusKey(targetStage.status))})`
                : t("noKnockout")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/schedule`}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              {ts("title")}
            </Link>
          </div>
        </div>
      </div>

      {!sourceStage || !targetStage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          {t("configureWarning")}
        </div>
      ) : (
        <BracketControls
          tournamentId={tournamentId}
          eventId={eventId}
          groupStages={groupStages.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            format: s.format,
          }))}
          knockoutStages={knockoutStages.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            format: s.format,
          }))}
          defaultSourceStageId={sourceStage.id}
          defaultTargetStageId={targetStage.id}
          defaultBracketSize={suggestedSize}
          thirdPlaceDefault={event.thirdPlaceMatchEnabled}
          hasQualificationRule={hasQualificationRule}
          canDraw={canDraw}
          canAdminReset={canAdminReset}
          groupStageCompletable={groupStageCompletable}
          groupCompleteBlockedReason={groupCompleteBlockedReason}
          hasExistingBracket={knockoutMatches.length > 0}
          entryNames={entryNames}
          groupCodes={groupCodes}
        />
      )}

      <section id="bracket-print" className="space-y-3">
        <h3 className="text-lg font-semibold">
          {board
            ? t("drawSize", { size: board.bracketSize })
            : t("bracketTree")}
        </h3>

        {loadError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        ) : null}

        {!board && !loadError ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
            {t("noKnockoutMatches")}
          </div>
        ) : null}

        {board ? (
          <BracketBoard
            board={board}
            tournamentId={tournamentId}
            eventId={eventId}
          />
        ) : null}
      </section>
    </div>
  );
}
