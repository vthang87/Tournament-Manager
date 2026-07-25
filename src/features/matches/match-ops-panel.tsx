"use client";

import { useState, useTransition } from "react";
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
import { ScoreEntryPanel } from "./score-entry";

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
  rule: MatchRuleSnapshot;
  canScore: boolean;
  canCorrect: boolean;
  initialSets: Array<{ setNumber: number; scoreA: number; scoreB: number }>;
  startAction: (
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [specialOpen, setSpecialOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);

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
      {canStart ? (
        <Button
          type="button"
          className="h-12 w-full text-base"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("expectedUpdatedAt", props.expectedUpdatedAt);
            runAction(() =>
              props.startAction(
                props.tournamentId,
                props.eventId,
                props.matchId,
                fd,
              ),
            );
          }}
        >
          {pending ? t("starting") : t("startMatch")}
        </Button>
      ) : null}

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
            variant="outline"
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
  const [resolution, setResolution] = useState<MatchResolution>("WALKOVER");
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
            <option value="WALKOVER">{t("walkover")}</option>
            <option value="RETIREMENT">{t("retirement")}</option>
            <option value="DISQUALIFICATION">{t("disqualification")}</option>
            <option value="NO_SHOW">{t("noShow")}</option>
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
