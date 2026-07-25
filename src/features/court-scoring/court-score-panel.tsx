"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import type { MatchWithSets } from "@/core/domain";
import { ScoreEntryPanel } from "@/features/matches/score-entry";
import { CountdownTimer } from "@/features/matches/countdown-timer";
import { parseRuleSnapshot } from "@/features/matches/match-utils";
import type { CourtQueueMatch } from "./actions";
import {
  courtCallToCourtAction,
  courtCancelWarmupAction,
  courtFinishMatchAction,
  courtNoShowAction,
  courtSaveLiveScoreAction,
  courtStartAssignedMatchAction,
  courtSwapSidesAction,
  lockCourtAction,
} from "./actions";

const WARMUP_MINUTE_OPTIONS = [1, 3, 5] as const;

function EntrySide({
  name,
  club,
}: {
  name: string;
  club: string | null;
}) {
  return (
    <span className="block">
      <span className="font-medium text-slate-900">{name}</span>
      {club ? (
        <span className="mt-0.5 block text-sm font-normal text-slate-500">
          {club}
        </span>
      ) : null}
    </span>
  );
}

export function CourtScorePanel({
  slug,
  code,
  courtName,
  tournamentName,
  inProgress,
  queue,
  entryLabels,
  entryClubs,
}: {
  slug: string;
  code: string;
  courtName: string;
  tournamentName: string;
  inProgress: MatchWithSets | null;
  queue: CourtQueueMatch[];
  entryLabels: Record<string, string>;
  entryClubs: Record<string, string>;
}) {
  const t = useTranslations("courtScoring");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const preferredId =
    queue.find((m) => m.warmupUntil)?.id ??
    queue.find((m) => m.onThisCourt)?.id ??
    queue[0]?.id ??
    "";
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null);
  const selectedId =
    userSelectedId && queue.some((m) => m.id === userSelectedId)
      ? userSelectedId
      : preferredId;
  const selected = queue.find((m) => m.id === selectedId) ?? null;

  function label(entryId: string | null) {
    if (!entryId) return tc("tbd");
    return entryLabels[entryId] ?? entryId.slice(0, 8);
  }

  function club(entryId: string | null) {
    if (!entryId) return null;
    return entryClubs[entryId] ?? null;
  }

  function matchOptionLabel(m: CourtQueueMatch) {
    const a = label(m.entryAId);
    const b = label(m.entryBId);
    let prefix = "";
    if (!m.onThisCourt && m.assignedCourtCode) {
      prefix = `${t("fromCourt", { code: m.assignedCourtCode })} · `;
    } else if (!m.onThisCourt) {
      prefix = `${t("unassignedTag")} · `;
    }
    return `${prefix}${a} ${tc("vs")} ${b}`;
  }

  function matchOptionDescription(m: CourtQueueMatch) {
    const clubA = club(m.entryAId);
    const clubB = club(m.entryBId);
    if (clubA && clubB) return `${clubA} · ${clubB}`;
    return clubA ?? clubB ?? undefined;
  }

  const matchOptions = queue.map((m) => ({
    value: m.id,
    label: matchOptionLabel(m),
    description: matchOptionDescription(m),
    hint: m.eventName || undefined,
  }));

  let rule: MatchRuleSnapshot | null = null;
  if (inProgress) {
    try {
      rule = parseRuleSnapshot(inProgress.ruleSnapshotJson);
    } catch {
      rule = null;
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {tournamentName}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {courtName}{" "}
            <span className="text-slate-500">({code})</span>
          </h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await lockCourtAction(slug, code);
              router.refresh();
            });
          }}
        >
          {t("lock")}
        </Button>
      </header>

      {inProgress && rule && inProgress.entryAId && inProgress.entryBId ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              {t("nowPlaying")}
            </p>
            <div className="mt-2 space-y-2 text-lg font-semibold">
              <EntrySide
                name={label(inProgress.entryAId)}
                club={club(inProgress.entryAId)}
              />
              <p className="text-sm font-medium text-slate-500">{tc("vs")}</p>
              <EntrySide
                name={label(inProgress.entryBId)}
                club={club(inProgress.entryBId)}
              />
            </div>
          </div>
          <ScoreEntryPanel
            matchId={inProgress.id}
            entryAId={inProgress.entryAId}
            entryBId={inProgress.entryBId}
            labelA={label(inProgress.entryAId)}
            labelB={label(inProgress.entryBId)}
            rule={rule}
            expectedUpdatedAt={inProgress.updatedAt}
            initialSets={inProgress.sets.map((s) => ({
              setNumber: s.setNumber,
              scoreA: s.scoreA,
              scoreB: s.scoreB,
            }))}
            onSubmit={(formData) =>
              courtFinishMatchAction(slug, code, formData)
            }
            onSaveLive={(formData) =>
              courtSaveLiveScoreAction(slug, code, formData)
            }
            defaultAutoSaveLive
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
          <p className="text-lg font-medium text-slate-800">{t("noLiveMatch")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("noLiveMatchHint")}</p>
        </div>
      )}

      {!inProgress && queue.length > 0 && selected ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                {t("pickMatch")}
              </p>
              <SwapSidesButton
                slug={slug}
                code={code}
                matchId={selected.id}
                expectedUpdatedAt={selected.updatedAt}
                disabled={
                  !selected.entryAId ||
                  !selected.entryBId ||
                  Boolean(selected.warmupUntil)
                }
              />
            </div>
            <SearchableSelect
              name="courtMatchId"
              value={selected.id}
              options={matchOptions}
              placeholder={t("pickMatch")}
              searchPlaceholder={t("searchMatch")}
              emptyText={t("noMatchFound")}
              disabled={Boolean(selected.warmupUntil)}
              onChange={(next) => {
                if (next) setUserSelectedId(next);
              }}
              className="text-base"
            />
            {selected.warmupUntil ? (
              <p className="text-xs text-slate-500">{t("swapLockedAfterCall")}</p>
            ) : null}
          </div>

          <div className="mt-1 space-y-2 text-base">
            <EntrySide
              name={label(selected.entryAId)}
              club={club(selected.entryAId)}
            />
            <p className="py-1 text-center text-sm font-medium text-slate-500">
              {tc("vs")}
            </p>
            <EntrySide
              name={label(selected.entryBId)}
              club={club(selected.entryBId)}
            />
          </div>
          <p className="text-sm text-slate-500">
            {selected.eventName}
            {selected.assignedCourtCode
              ? ` · ${t("willMoveFromCourt", { code: selected.assignedCourtCode })}`
              : !selected.onThisCourt
                ? ` · ${t("willAssignCourt")}`
                : ""}
          </p>

          <WarmupControls
            slug={slug}
            code={code}
            matchId={selected.id}
            expectedUpdatedAt={selected.updatedAt}
            warmupUntil={selected.warmupUntil}
            disabled={!selected.entryAId || !selected.entryBId}
          />
          <StartAssignedButton
            slug={slug}
            code={code}
            matchId={selected.id}
            expectedUpdatedAt={selected.updatedAt}
            disabled={!selected.entryAId || !selected.entryBId}
            called={Boolean(selected.warmupUntil)}
          />
          {selected.entryAId && selected.entryBId ? (
            <NoShowControls
              slug={slug}
              code={code}
              matchId={selected.id}
              expectedUpdatedAt={selected.updatedAt}
              entryAId={selected.entryAId}
              entryBId={selected.entryBId}
              labelA={label(selected.entryAId)}
              labelB={label(selected.entryBId)}
            />
          ) : null}
        </div>
      ) : null}

      {!inProgress && queue.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          {t("noQueueMatches")}
        </p>
      ) : null}
    </div>
  );
}

function SwapSidesButton({
  slug,
  code,
  matchId,
  expectedUpdatedAt,
  disabled,
}: {
  slug: string;
  code: string;
  matchId: string;
  expectedUpdatedAt: string;
  disabled: boolean;
}) {
  const t = useTranslations("courtScoring");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || disabled}
        aria-label={t("swapSides")}
        onClick={() => {
          setError(null);
          const fd = new FormData();
          fd.set("matchId", matchId);
          fd.set("expectedUpdatedAt", expectedUpdatedAt);
          startTransition(async () => {
            const result = await courtSwapSidesAction(slug, code, fd);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? t("swapping") : t("swapSides")}
      </Button>
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function WarmupControls({
  slug,
  code,
  matchId,
  expectedUpdatedAt,
  warmupUntil,
  disabled,
}: {
  slug: string;
  code: string;
  matchId: string;
  expectedUpdatedAt: string;
  warmupUntil: string | null;
  disabled: boolean;
}) {
  const t = useTranslations("courtScoring");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number>(3);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      router.refresh();
    });
  }

  if (warmupUntil) {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          {t("warmupActive")}
        </p>
        <CountdownTimer
          target={warmupUntil}
          readyLabel={t("warmupReady")}
          className="block text-4xl font-bold tabular-nums text-emerald-700"
        />
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("matchId", matchId);
            fd.set("expectedUpdatedAt", expectedUpdatedAt);
            run(() => courtCancelWarmupAction(slug, code, fd));
          }}
        >
          {t("warmupCancel")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{t("warmupHint")}</p>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        {WARMUP_MINUTE_OPTIONS.map((m) => (
          <Button
            key={m}
            type="button"
            variant={minutes === m ? "default" : "outline"}
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => setMinutes(m)}
          >
            {t("warmupMinutes", { mins: m })}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        className="h-11 w-full text-base"
        disabled={pending || disabled}
        onClick={() => {
          const fd = new FormData();
          fd.set("matchId", matchId);
          fd.set("minutes", String(minutes));
          fd.set("expectedUpdatedAt", expectedUpdatedAt);
          run(() => courtCallToCourtAction(slug, code, fd));
        }}
      >
        {pending ? t("warmupCalling") : t("warmupCall")}
      </Button>
    </div>
  );
}

function NoShowControls({
  slug,
  code,
  matchId,
  expectedUpdatedAt,
  entryAId,
  entryBId,
  labelA,
  labelB,
}: {
  slug: string;
  code: string;
  matchId: string;
  expectedUpdatedAt: string;
  entryAId: string;
  entryBId: string;
  labelA: string;
  labelB: string;
}) {
  const t = useTranslations("courtScoring");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [absentEntryId, setAbsentEntryId] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-slate-500"
        onClick={() => {
          setError(null);
          setAbsentEntryId(null);
          setOpen(true);
        }}
      >
        {t("noShow")}
      </Button>
    );
  }

  const absentLabel = absentEntryId === entryAId ? labelA : labelB;
  const winnerLabel = absentEntryId === entryAId ? labelB : labelA;

  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
        {t("noShow")}
      </p>
      <p className="text-sm text-slate-600">{t("noShowPick")}</p>
      <div className="flex gap-2">
        {[
          { id: entryAId, name: labelA },
          { id: entryBId, name: labelB },
        ].map((side) => (
          <Button
            key={side.id}
            type="button"
            variant={absentEntryId === side.id ? "destructive" : "outline"}
            size="sm"
            className="min-w-0 flex-1 whitespace-normal"
            disabled={pending}
            onClick={() => setAbsentEntryId(side.id)}
          >
            {side.name}
          </Button>
        ))}
      </div>
      {absentEntryId ? (
        <p className="text-sm text-slate-600">
          {t("noShowOutcome", { absent: absentLabel, winner: winnerLabel })}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          {t("noShowCancel")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="flex-1"
          disabled={pending || !absentEntryId}
          onClick={() => {
            if (!absentEntryId) return;
            setError(null);
            const fd = new FormData();
            fd.set("matchId", matchId);
            fd.set("absentEntryId", absentEntryId);
            fd.set("expectedUpdatedAt", expectedUpdatedAt);
            startTransition(async () => {
              const result = await courtNoShowAction(slug, code, fd);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {pending ? t("noShowSubmitting") : t("noShowConfirm")}
        </Button>
      </div>
    </div>
  );
}

function StartAssignedButton({
  slug,
  code,
  matchId,
  expectedUpdatedAt,
  disabled,
  called,
}: {
  slug: string;
  code: string;
  matchId: string;
  expectedUpdatedAt: string;
  disabled: boolean;
  called?: boolean;
}) {
  const t = useTranslations("courtScoring");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="h-12 w-full text-base"
        disabled={pending || disabled}
        onClick={() => {
          setError(null);
          const fd = new FormData();
          fd.set("matchId", matchId);
          fd.set("expectedUpdatedAt", expectedUpdatedAt);
          startTransition(async () => {
            const result = await courtStartAssignedMatchAction(slug, code, fd);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending
          ? t("starting")
          : called
            ? t("startNow")
            : t("startAssigned")}
      </Button>
    </div>
  );
}
