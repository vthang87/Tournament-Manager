"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import {
  calculateMatchWinner,
  validateSetScore,
  setsToWin,
} from "@/core/tournament-engine/scoring";
import { DomainError } from "@/core/tournament-engine/errors";
import type { ActionResult } from "@/features/shared/action-utils";
import { cn } from "@/lib/utils";

type SetDraft = { setNumber: number; scoreA: number; scoreB: number };

export function ScoreEntryPanel({
  matchId,
  entryAId,
  entryBId,
  labelA,
  labelB,
  rule,
  expectedUpdatedAt,
  initialSets,
  mode = "enter",
  onSubmit,
  onCorrectionReason,
}: {
  matchId: string;
  entryAId: string;
  entryBId: string;
  labelA: string;
  labelB: string;
  rule: MatchRuleSnapshot;
  expectedUpdatedAt: string;
  initialSets?: SetDraft[];
  mode?: "enter" | "correct";
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  /** When mode is correct, reason is required before submit. */
  onCorrectionReason?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("matches");
  const tCommon = useTranslations("common");
  const needed = setsToWin(rule.bestOfSets);
  const maxSets = rule.bestOfSets;

  const [sets, setSets] = useState<SetDraft[]>(() => {
    if (initialSets && initialSets.length > 0) {
      return initialSets.map((s) => ({ ...s }));
    }
    return [{ setNumber: 1, scoreA: 0, scoreB: 0 }];
  });
  const [inputMode, setInputMode] = useState<"stepper" | "direct">("stepper");
  const [activeCell, setActiveCell] = useState<{
    setIndex: number;
    side: "A" | "B";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const setErrors: string[] = [];
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i]!;
      const setsWonSoFar = previewSetsWon(sets.slice(0, i), entryAId, entryBId);
      const isDeciding =
        setsWonSoFar.a === needed - 1 && setsWonSoFar.b === needed - 1;
      const result = validateSetScore({
        scoreA: set.scoreA,
        scoreB: set.scoreB,
        rule,
        isDecidingSet: isDeciding,
      });
      if (!result.valid && (set.scoreA > 0 || set.scoreB > 0)) {
        setErrors.push(
          t("setError", {
            setNumber: set.setNumber,
            errors: result.errors.map((e) => e.message).join("; "),
          }),
        );
      }
    }

    try {
      const outcome = calculateMatchWinner({
        sets,
        rule,
        entryIdA: entryAId,
        entryIdB: entryBId,
      });
      return { outcome, setErrors, engineError: null as string | null };
    } catch (err) {
      const message =
        err instanceof DomainError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("invalidSequence");
      return { outcome: null, setErrors, engineError: message };
    }
  }, [sets, rule, entryAId, entryBId, needed, t]);

  function updateScore(setIndex: number, side: "A" | "B", value: number) {
    const next = Math.max(0, Math.min(99, value));
    setSets((prev) =>
      prev.map((s, i) =>
        i === setIndex
          ? {
              ...s,
              scoreA: side === "A" ? next : s.scoreA,
              scoreB: side === "B" ? next : s.scoreB,
            }
          : s,
      ),
    );
  }

  function bump(setIndex: number, side: "A" | "B", delta: number) {
    const set = sets[setIndex];
    if (!set) {
      return;
    }
    const current = side === "A" ? set.scoreA : set.scoreB;
    updateScore(setIndex, side, current + delta);
  }

  function addSet() {
    if (sets.length >= maxSets) {
      return;
    }
    setSets((prev) => [
      ...prev,
      { setNumber: prev.length + 1, scoreA: 0, scoreB: 0 },
    ]);
  }

  function removeLastSet() {
    if (sets.length <= 1) {
      return;
    }
    setSets((prev) => prev.slice(0, -1));
  }

  function padDigit(digit: number) {
    if (!activeCell) {
      return;
    }
    const set = sets[activeCell.setIndex];
    if (!set) {
      return;
    }
    const current =
      activeCell.side === "A" ? set.scoreA : set.scoreB;
    const next = Math.min(99, current * 10 + digit);
    updateScore(activeCell.setIndex, activeCell.side, next);
  }

  function padClear() {
    if (!activeCell) {
      return;
    }
    updateScore(activeCell.setIndex, activeCell.side, 0);
  }

  function handleSubmit() {
    setError(null);
    if (mode === "correct" && onCorrectionReason && reason.trim().length < 1) {
      setError(t("correctionRequired"));
      return;
    }
    if (preview.engineError) {
      setError(preview.engineError);
      return;
    }
    if (!preview.outcome?.isComplete) {
      setError(t("completeSequence"));
      return;
    }

    const formData = new FormData();
    formData.set("matchId", matchId);
    formData.set("setsJson", JSON.stringify(sets));
    formData.set("expectedUpdatedAt", expectedUpdatedAt);
    if (mode === "correct") {
      formData.set("reason", reason.trim());
    }

    startTransition(async () => {
      const result = await onSubmit(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const winnerPreview =
    preview.outcome?.isComplete && preview.outcome.winnerEntryId
      ? preview.outcome.winnerEntryId === entryAId
        ? labelA
        : labelB
      : null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {mode === "correct" ? t("correctScore") : t("scoreEntry")}
          </p>
          <p className="text-xs text-slate-500">
            {t("bestOfHint", { bestOf: rule.bestOfSets, needed })}
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-slate-200 p-0.5">
          <button
            type="button"
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium",
              inputMode === "stepper"
                ? "bg-slate-900 text-white"
                : "text-slate-600",
            )}
            onClick={() => setInputMode("stepper")}
          >
            + / −
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium",
              inputMode === "direct"
                ? "bg-slate-900 text-white"
                : "text-slate-600",
            )}
            onClick={() => setInputMode("direct")}
          >
            {t("numberPad")}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {sets.map((set, setIndex) => (
          <div
            key={set.setNumber}
            className="rounded-md border border-slate-100 bg-slate-50 p-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("setLabel", { setNumber: set.setNumber })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ScoreSide
                label={labelA}
                value={set.scoreA}
                active={
                  activeCell?.setIndex === setIndex && activeCell.side === "A"
                }
                mode={inputMode}
                onSelect={() => setActiveCell({ setIndex, side: "A" })}
                onBump={(d) => bump(setIndex, "A", d)}
                onChange={(v) => updateScore(setIndex, "A", v)}
                t={t}
              />
              <ScoreSide
                label={labelB}
                value={set.scoreB}
                active={
                  activeCell?.setIndex === setIndex && activeCell.side === "B"
                }
                mode={inputMode}
                onSelect={() => setActiveCell({ setIndex, side: "B" })}
                onBump={(d) => bump(setIndex, "B", d)}
                onChange={(v) => updateScore(setIndex, "B", v)}
                t={t}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sets.length >= maxSets}
          onClick={addSet}
        >
          {t("addSet")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={sets.length <= 1}
          onClick={removeLastSet}
        >
          {t("removeLastSet")}
        </Button>
      </div>

      {inputMode === "direct" ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              type="button"
              className="flex h-14 items-center justify-center rounded-lg bg-slate-900 text-xl font-semibold text-white active:bg-slate-700"
              onClick={() => padDigit(d)}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className="flex h-14 items-center justify-center rounded-lg bg-slate-200 text-sm font-medium text-slate-800"
            onClick={padClear}
          >
            {t("clear")}
          </button>
          <button
            type="button"
            className="flex h-14 items-center justify-center rounded-lg bg-slate-900 text-xl font-semibold text-white"
            onClick={() => padDigit(0)}
          >
            0
          </button>
          <button
            type="button"
            className="flex h-14 items-center justify-center rounded-lg bg-slate-200 text-sm font-medium text-slate-800"
            onClick={() => setActiveCell(null)}
          >
            {t("done")}
          </button>
        </div>
      ) : null}

      {preview.setErrors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
          {preview.setErrors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : null}

      {preview.engineError ? (
        <p className="text-sm text-amber-800">{preview.engineError}</p>
      ) : null}

      {winnerPreview ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t("previewWinner", { name: winnerPreview })}
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          {t("setsIncomplete", {
            a: preview.outcome?.setsWonA ?? 0,
            b: preview.outcome?.setsWonB ?? 0,
          })}
        </p>
      )}

      {mode === "correct" && onCorrectionReason ? (
        <div className="space-y-1.5">
          <Label htmlFor="correctionReason">{t("correctionReason")}</Label>
          <Input
            id="correctionReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder={t("correctionPlaceholder")}
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="h-12 w-full text-base"
        disabled={pending || !preview.outcome?.isComplete}
        onClick={handleSubmit}
      >
        {pending
          ? tCommon("saving")
          : mode === "correct"
            ? t("saveCorrection")
            : t("finishMatch")}
      </Button>
    </div>
  );
}

function previewSetsWon(
  sets: SetDraft[],
  entryAId: string,
  entryBId: string,
): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const set of sets) {
    if (set.scoreA === set.scoreB) {
      continue;
    }
    if (set.scoreA > set.scoreB) {
      a += 1;
    } else {
      b += 1;
    }
  }
  void entryAId;
  void entryBId;
  return { a, b };
}

function ScoreSide({
  label,
  value,
  active,
  mode,
  onSelect,
  onBump,
  onChange,
  t,
}: {
  label: string;
  value: number;
  active: boolean;
  mode: "stepper" | "direct";
  onSelect: () => void;
  onBump: (delta: number) => void;
  onChange: (value: number) => void;
  t: ReturnType<typeof useTranslations<"matches">>;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-2",
        active ? "border-slate-900 ring-2 ring-slate-900/20" : "border-slate-200",
      )}
    >
      <p className="mb-2 truncate text-xs font-medium text-slate-600">{label}</p>
      {mode === "stepper" ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("decrease", { label })}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-2xl font-bold text-slate-900 active:bg-slate-300"
            onClick={() => onBump(-1)}
          >
            −
          </button>
          <span className="flex min-w-0 flex-1 items-center justify-center text-3xl font-semibold tabular-nums">
            {value}
          </span>
          <button
            type="button"
            aria-label={t("increase", { label })}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-2xl font-bold text-white active:bg-slate-700"
            onClick={() => onBump(1)}
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex h-14 w-full items-center justify-center rounded-lg border border-slate-200 text-3xl font-semibold tabular-nums"
        >
          {value}
        </button>
      )}
      {mode === "stepper" ? (
        <input
          type="number"
          min={0}
          max={99}
          className="mt-2 h-9 w-full rounded-md border border-slate-200 px-2 text-center text-sm"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          aria-label={t("directScore", { label })}
        />
      ) : null}
    </div>
  );
}
