"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MatchResolution, MatchStatus } from "@/core/domain";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import type { ActionResult } from "@/features/shared/action-utils";
import { CountdownTimer } from "./countdown-timer";
import { ScoreEntryPanel } from "./score-entry";

const WARMUP_MINUTE_OPTIONS = [1, 3, 5] as const;

type CourtOption = {
  id: string;
  name: string;
  code: string;
  busy?: boolean;
};

type Props = {
  tournamentId: string;
  eventId: string;
  matchId: string;
  status: MatchStatus;
  expectedUpdatedAt: string;
  entryAId: string;
  entryBId: string;
  labelA: string;
  labelB: string;
  courtId: string | null;
  courts: CourtOption[];
  rule: MatchRuleSnapshot;
  canScore: boolean;
  canCorrect: boolean;
  warmupUntil: string | null;
  initialSets: Array<{ setNumber: number; scoreA: number; scoreB: number }>;
  startAction: (
    tournamentId: string,
    eventId: string,
    matchId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  callToCourtAction: (
    tournamentId: string,
    eventId: string,
    matchId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  clearWarmupAction: (
    tournamentId: string,
    eventId: string,
    matchId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  swapSidesAction: (
    tournamentId: string,
    eventId: string,
    matchId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  enterScoreAction: (
    tournamentId: string,
    eventId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  saveLiveScoreAction: (
    tournamentId: string,
    eventId: string,
    formData: FormData,
  ) => Promise<ActionResult<{ updatedAt: string }>>;
  resolveSpecialAction: (
    tournamentId: string,
    eventId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  cancelMatchAction: (
    tournamentId: string,
    eventId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
  correctScoreAction: (
    tournamentId: string,
    eventId: string,
    formData: FormData,
  ) => Promise<ActionResult>;
};

export function MatchOpsPanel(props: Props) {
  const router = useRouter();
  const t = useTranslations("matches");
  const tc = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [startOpen, setStartOpen] = useState(false);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);
  const [warmupMinutes, setWarmupMinutes] = useState(3);

  const canStart =
    props.canScore &&
    (props.status === "PENDING" || props.status === "SCHEDULED");
  const canEnterScore = props.canScore && props.status === "IN_PROGRESS";
  const canSpecial =
    props.canScore &&
    props.status !== "CANCELLED" &&
    props.status !== "COMPLETED" &&
    props.status !== "WALKOVER";
  const canCancel =
    props.canScore &&
    (props.status === "PENDING" ||
      props.status === "SCHEDULED" ||
      props.status === "IN_PROGRESS");
  const canCorrectScore =
    props.canCorrect &&
    (props.status === "COMPLETED" || props.status === "WALKOVER");

  function runAction(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canStart && props.warmupUntil ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {t("warmupActive")}
          </p>
          <CountdownTimer
            target={props.warmupUntil}
            readyLabel={t("warmupReady")}
            className="block text-4xl font-bold tabular-nums text-emerald-700"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
              runAction(() =>
                props.clearWarmupAction(
                  props.tournamentId,
                  props.eventId,
                  props.matchId,
                  fd,
                ),
              );
            }}
          >
            {t("warmupCancel")}
          </Button>
        </div>
      ) : null}

      {canStart && !props.warmupUntil ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium text-slate-500">{t("warmupHint")}</p>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2">
              {WARMUP_MINUTE_OPTIONS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={warmupMinutes === m ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => setWarmupMinutes(m)}
                >
                  {t("warmupMinutes", { mins: m })}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("minutes", String(warmupMinutes));
                fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
                runAction(() =>
                  props.callToCourtAction(
                    props.tournamentId,
                    props.eventId,
                    props.matchId,
                    fd,
                  ),
                );
              }}
            >
              {t("warmupCall")}
            </Button>
          </div>
        </div>
      ) : null}

      {canStart ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-900">{props.labelA}</p>
            <p className="text-xs text-slate-500">{tc("vs")}</p>
            <p className="truncate font-medium text-slate-900">{props.labelB}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
              runAction(() =>
                props.swapSidesAction(
                  props.tournamentId,
                  props.eventId,
                  props.matchId,
                  fd,
                ),
              );
            }}
          >
            {t("swapSides")}
          </Button>
        </div>
      ) : null}

      {canStart ? (
        <Button
          type="button"
          className="h-12 w-full text-base"
          disabled={pending}
          onClick={() => setStartOpen(true)}
        >
          {pending ? t("starting") : t("startMatch")}
        </Button>
      ) : null}

      <StartMatchDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        pending={pending}
        labelA={props.labelA}
        labelB={props.labelB}
        courts={props.courts}
        initialCourtId={props.courtId}
        onConfirm={(courtId) => {
          const fd = new FormData();
          fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
          fd.set("courtId", courtId);
          runAction(async () => {
            const result = await props.startAction(
              props.tournamentId,
              props.eventId,
              props.matchId,
              fd,
            );
            if (result.ok) {
              setStartOpen(false);
            }
            return result;
          });
        }}
      />

      {canEnterScore ? (
        <ScoreEntryPanel
          matchId={props.matchId}
          entryAId={props.entryAId}
          entryBId={props.entryBId}
          labelA={props.labelA}
          labelB={props.labelB}
          rule={props.rule}
          expectedUpdatedAt={props.expectedUpdatedAt}
          initialSets={props.initialSets}
          onSubmit={(formData) =>
            props.enterScoreAction(
              props.tournamentId,
              props.eventId,
              formData,
            )
          }
          onSaveLive={(formData) =>
            props.saveLiveScoreAction(
              props.tournamentId,
              props.eventId,
              formData,
            )
          }
        />
      ) : null}

      {canCorrectScore ? (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowCorrect((v) => !v)}
          >
            {showCorrect ? t("hideCorrection") : t("correctScore")}
          </Button>
          {showCorrect ? (
            <ScoreEntryPanel
              matchId={props.matchId}
              entryAId={props.entryAId}
              entryBId={props.entryBId}
              labelA={props.labelA}
              labelB={props.labelB}
              rule={props.rule}
              expectedUpdatedAt={props.expectedUpdatedAt}
              initialSets={
                props.initialSets.length > 0
                  ? props.initialSets
                  : [{ setNumber: 1, scoreA: 0, scoreB: 0 }]
              }
              mode="correct"
              onCorrectionReason
              onSubmit={(formData) =>
                props.correctScoreAction(
                  props.tournamentId,
                  props.eventId,
                  formData,
                )
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canSpecial ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setSpecialOpen(true)}
          >
            {t("walkoverRetirement")}
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => setCancelOpen(true)}
          >
            {t("cancelMatch")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <SpecialResolutionDialog
        open={specialOpen}
        onOpenChange={setSpecialOpen}
        pending={pending}
        labelA={props.labelA}
        labelB={props.labelB}
        entryAId={props.entryAId}
        entryBId={props.entryBId}
        onConfirm={(resolution, winnerEntryId) => {
          const fd = new FormData();
          fd.set("matchId", props.matchId);
          fd.set("resolution", resolution);
          fd.set("winnerEntryId", winnerEntryId);
          fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
          runAction(() =>
            props.resolveSpecialAction(
              props.tournamentId,
              props.eventId,
              fd,
            ),
          );
          setSpecialOpen(false);
        }}
      />

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        pending={pending}
        onConfirm={(reason) => {
          const fd = new FormData();
          fd.set("matchId", props.matchId);
          if (reason) {
            fd.set("reason", reason);
          }
          fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
          runAction(() =>
            props.cancelMatchAction(
              props.tournamentId,
              props.eventId,
              fd,
            ),
          );
          setCancelOpen(false);
        }}
      />
    </div>
  );
}

function StartMatchDialog({
  open,
  onOpenChange,
  pending,
  labelA,
  labelB,
  courts,
  initialCourtId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  labelA: string;
  labelB: string;
  courts: CourtOption[];
  initialCourtId: string | null;
  onConfirm: (courtId: string) => void;
}) {
  const t = useTranslations("matches");
  const tCommon = useTranslations("common");
  const [courtId, setCourtId] = useState(initialCourtId ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const preferred =
        initialCourtId &&
        !courts.find((c) => c.id === initialCourtId)?.busy
          ? initialCourtId
          : "";
      setCourtId(preferred);
      setLocalError(null);
    }
  }, [open, initialCourtId, courts]);

  const availableCourts = courts.filter((c) => !c.busy);
  const allBusy = courts.length > 0 && availableCourts.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("confirmStartTitle")}
      description={t("confirmStartHint")}
    >
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-900">
          {t("confirmStartMatchup", { a: labelA, b: labelB })}
        </p>
        {courts.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("confirmStartNoCourts")}
          </p>
        ) : allBusy ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("confirmStartAllCourtsBusy")}
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="startCourt">{t("confirmStartCourt")}</Label>
            <Select
              id="startCourt"
              value={courtId}
              onChange={(e) => {
                setCourtId(e.target.value);
                setLocalError(null);
              }}
              className="h-12 text-base font-medium"
            >
              <option value="">{t("selectCourt")}</option>
              {courts.map((court) => (
                <option
                  key={court.id}
                  value={court.id}
                  disabled={court.busy}
                >
                  {court.busy
                    ? t("courtBusyOption", {
                        name: court.name,
                        code: court.code,
                      })
                    : t("courtOption", {
                        name: court.name,
                        code: court.code,
                      })}
                </option>
              ))}
            </Select>
            {localError ? (
              <p className="text-sm text-red-600">{localError}</p>
            ) : null}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || courts.length === 0 || allBusy}
            onClick={() => {
              if (!courtId) {
                setLocalError(t("confirmStartCourtRequired"));
                return;
              }
              if (courts.find((c) => c.id === courtId)?.busy) {
                setLocalError(t("confirmStartCourtBusy"));
                return;
              }
              onConfirm(courtId);
            }}
          >
            {pending ? t("starting") : t("confirmStart")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SpecialResolutionDialog({
  open,
  onOpenChange,
  pending,
  labelA,
  labelB,
  entryAId,
  entryBId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  labelA: string;
  labelB: string;
  entryAId: string;
  entryBId: string;
  onConfirm: (resolution: MatchResolution, winnerEntryId: string) => void;
}) {
  const t = useTranslations("matches");
  const tCommon = useTranslations("common");
  const [resolution, setResolution] = useState<MatchResolution>("NO_SHOW");
  const [winnerEntryId, setWinnerEntryId] = useState(entryAId);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("specialResolution")}
      description={t("specialResolutionHint")}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="resolution">{t("resolution")}</Label>
          <Select
            id="resolution"
            value={resolution}
            onChange={(e) =>
              setResolution(e.target.value as MatchResolution)
            }
          >
            <option value="NO_SHOW">{t("noShow")}</option>
            <option value="WALKOVER">{t("walkover")}</option>
            <option value="RETIREMENT">{t("retirement")}</option>
            <option value="DISQUALIFICATION">{t("disqualification")}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="winner">{tCommon("winner")}</Label>
          <Select
            id="winner"
            value={winnerEntryId}
            onChange={(e) => setWinnerEntryId(e.target.value)}
          >
            <option value={entryAId}>{labelA}</option>
            <option value={entryBId}>{labelB}</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("back")}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(resolution, winnerEntryId)}
          >
            {tCommon("confirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("matches");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("cancelMatch")}
      description={t("cancelledHint")}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cancelReason">{t("reasonOptional")}</Label>
          <Input
            id="cancelReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("back")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {t("cancelMatch")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
