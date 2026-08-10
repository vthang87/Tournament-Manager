"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  adminResetBracketAction,
  completeGroupStageAction,
  createQualificationRuleAction,
  generateBracketAction,
  previewBracketAction,
  resolveQualificationAction,
} from "@/features/bracket/actions";
import { roundLabelFromStructure } from "@/features/bracket/lib/round-labels";

type StageOption = { id: string; name: string; status: string; format: string };

type PreviewMatch = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  isThirdPlace: boolean;
  slotA: {
    entryId: string | null;
    isBye: boolean;
    sourceGroupId?: string;
    sourceRank?: number;
    qualificationSeed?: number;
  };
  slotB: {
    entryId: string | null;
    isBye: boolean;
    sourceGroupId?: string;
    sourceRank?: number;
    qualificationSeed?: number;
  };
};

type PreviewData = {
  warnings: Array<{ code: string; message: string }>;
  qualifiers: Array<{
    entryId: string;
    sourceGroupId: string;
    sourceRank: number;
    qualificationSeed: number;
    isAdditional: boolean;
  }>;
  bracket: {
    bracketSize: number;
    roundCount: number;
    matches: PreviewMatch[];
  };
};

function entryLabel(
  entryId: string | null,
  entryNames: Record<string, string>,
  slot: PreviewMatch["slotA"],
  tCommon: ReturnType<typeof useTranslations<"common">>,
): string {
  if (slot.isBye) return tCommon("bye");
  if (!entryId) return tCommon("tbd");
  const name = entryNames[entryId] ?? entryId.slice(0, 8);
  const bits: string[] = [];
  if (slot.qualificationSeed != null) bits.push(`Q#${slot.qualificationSeed}`);
  if (slot.sourceRank != null) bits.push(`R${slot.sourceRank}`);
  return bits.length ? `${name} (${bits.join(", ")})` : name;
}

export function BracketControls({
  tournamentId,
  eventId,
  groupStages,
  knockoutStages,
  defaultSourceStageId,
  defaultTargetStageId,
  defaultBracketSize,
  thirdPlaceDefault,
  hasQualificationRule,
  canDraw,
  canAdminReset,
  groupStageCompletable,
  groupCompleteBlockedReason,
  hasExistingBracket,
  entryNames,
  groupCodes,
}: {
  tournamentId: string;
  eventId: string;
  groupStages: StageOption[];
  knockoutStages: StageOption[];
  defaultSourceStageId: string;
  defaultTargetStageId: string;
  defaultBracketSize: number;
  thirdPlaceDefault: boolean;
  hasQualificationRule: boolean;
  canDraw: boolean;
  canAdminReset: boolean;
  groupStageCompletable: boolean;
  groupCompleteBlockedReason: string | null;
  hasExistingBracket: boolean;
  entryNames: Record<string, string>;
  groupCodes: Record<string, string>;
}) {
  const router = useRouter();
  const t = useTranslations("bracket");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewParams, setPreviewParams] = useState<FormData | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canDraw && !canAdminReset) {
    return null;
  }

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
    successMsg?: string,
  ) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? t("actionFailed"));
        return;
      }
      if (successMsg) setMessage(successMsg);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 print:hidden">
      {/* Step 1: Complete group stage */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold">{t("step1")}</h3>
        <p className="mt-1 text-xs text-slate-600">{t("step1Hint")}</p>
        {groupCompleteBlockedReason ? (
          <p className="mt-2 text-xs text-amber-700">{groupCompleteBlockedReason}</p>
        ) : null}
        {canDraw ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(
                () => completeGroupStageAction(tournamentId, eventId, fd),
                t("groupStageCompleted"),
              );
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="complete-source">{t("groupStage")}</Label>
              <Select
                id="complete-source"
                name="sourceStageId"
                defaultValue={defaultSourceStageId}
                required
              >
                {groupStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !groupStageCompletable}
            >
              {t("completeStage")}
            </Button>
          </form>
        ) : null}
      </section>

      {/* Step 2: Qualification rule + resolve */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold">{t("step2")}</h3>
        {!hasQualificationRule && canDraw ? (
          <form
            className="mt-3 grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(
                () => createQualificationRuleAction(tournamentId, eventId, fd),
                t("qualRuleCreated"),
              );
            }}
          >
            <input type="hidden" name="sourceStageId" value={defaultSourceStageId} />
            <input type="hidden" name="targetStageId" value={defaultTargetStageId} />
            <div className="space-y-1">
              <Label htmlFor="topPerGroup">{t("topPerGroup")}</Label>
              <Input
                id="topPerGroup"
                name="topPerGroup"
                type="number"
                min={1}
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bestAdditionalEntries">{t("bestAdditional")}</Label>
              <Input
                id="bestAdditionalEntries"
                name="bestAdditionalEntries"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" size="sm" disabled={pending}>
                {t("createQualRule")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-1 text-xs text-emerald-700">
            {t("qualConfigured")}
          </p>
        )}
        {canDraw && hasQualificationRule ? (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(async () => {
                const result = await resolveQualificationAction(
                  tournamentId,
                  eventId,
                  fd,
                );
                if (result.ok && result.data) {
                  const data = result.data as {
                    qualifiers: PreviewData["qualifiers"];
                  };
                  setMessage(
                    t("resolvedQualifiers", {
                      count: data.qualifiers.length,
                    }),
                  );
                }
                return result;
              });
            }}
          >
            <input type="hidden" name="sourceStageId" value={defaultSourceStageId} />
            <input type="hidden" name="targetStageId" value={defaultTargetStageId} />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              {t("resolveQualifiers")}
            </Button>
          </form>
        ) : null}
      </section>

      {/* Step 3: Preview + generate */}
      {canDraw ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">{t("step3")}</h3>
          <p className="mt-1 text-xs text-slate-600">{t("step3Hint")}</p>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              setMessage(null);
              setPreviewParams(fd);
              startTransition(async () => {
                const result = await previewBracketAction(fd);
                if (!result.ok) {
                  setError(result.error);
                  setPreview(null);
                  return;
                }
                setPreview(result.data as PreviewData);
              });
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sourceStageId">{t("sourceGroup")}</Label>
                <Select
                  id="sourceStageId"
                  name="sourceStageId"
                  defaultValue={defaultSourceStageId}
                  required
                >
                  {groupStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="targetStageId">{t("targetKnockout")}</Label>
                <Select
                  id="targetStageId"
                  name="targetStageId"
                  defaultValue={defaultTargetStageId}
                  required
                >
                  {knockoutStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="bracketSize">{t("bracketSize")}</Label>
                <Input
                  id="bracketSize"
                  name="bracketSize"
                  type="number"
                  min={2}
                  step={1}
                  defaultValue={defaultBracketSize}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="placementRule">{t("placement")}</Label>
                <Select
                  id="placementRule"
                  name="placementRule"
                  defaultValue="BY_QUALIFICATION_SEED"
                >
                  <option value="BY_QUALIFICATION_SEED">
                    {t("byQualSeed")}
                  </option>
                  <option value="STANDARD_GROUP_CROSS">
                    {t("standardCross")}
                  </option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="byeAssignment">{t("byeAssignment")}</Label>
                <Select id="byeAssignment" name="byeAssignment" defaultValue="TOP_SEEDS">
                  <option value="TOP_SEEDS">{t("topSeeds")}</option>
                  <option value="BOTTOM_SEEDS">{t("bottomSeeds")}</option>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                name="thirdPlaceEnabled"
                defaultChecked={thirdPlaceDefault}
              />
              {t("thirdPlaceMatch")}
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                {t("previewPlacement")}
              </Button>
            </div>
          </form>

          {preview ? (
            <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium">
                {t("previewSummary", {
                  bracketSize: preview.bracket.bracketSize,
                  qualifierCount: preview.qualifiers.length,
                })}
              </p>
              {preview.warnings.length > 0 ? (
                <ul className="list-disc pl-5 text-xs text-amber-800">
                  {preview.warnings.map((w) => (
                    <li key={`${w.code}-${w.message}`}>
                      [{w.code}] {w.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700">{t("noEngineWarnings")}</p>
              )}
              <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
                {preview.bracket.matches
                  .filter((m) => m.roundIndex === 0 && !m.isThirdPlace)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="rounded border border-slate-200 bg-white px-2 py-1.5"
                    >
                      <p className="font-medium text-slate-500">
                        {roundLabelFromStructure(0, preview.bracket.roundCount)}{" "}
                        · M{m.matchIndex + 1}
                      </p>
                      <p>
                        {entryLabel(m.slotA.entryId, entryNames, m.slotA, tCommon)}
                        {m.slotA.sourceGroupId
                          ? ` [${groupCodes[m.slotA.sourceGroupId] ?? "?"}]`
                          : ""}
                      </p>
                      <p>
                        {entryLabel(m.slotB.entryId, entryNames, m.slotB, tCommon)}
                        {m.slotB.sourceGroupId
                          ? ` [${groupCodes[m.slotB.sourceGroupId] ?? "?"}]`
                          : ""}
                      </p>
                    </div>
                  ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!previewParams) return;
                  run(
                    () =>
                      generateBracketAction(
                        tournamentId,
                        eventId,
                        previewParams,
                      ),
                    hasExistingBracket
                      ? t("bracketRegenerated")
                      : t("bracketGenerated"),
                  );
                  setPreview(null);
                  setPreviewParams(null);
                }}
              >
                <Button type="submit" size="sm" disabled={pending || !previewParams}>
                  {t("confirmGenerate")}
                </Button>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {canAdminReset && hasExistingBracket ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-900">{t("adminReset")}</h3>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(
                () => adminResetBracketAction(tournamentId, eventId, fd),
                t("bracketReset"),
              );
            }}
          >
            <input type="hidden" name="stageId" value={defaultTargetStageId} />
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label htmlFor="reason">{tCommon("reason")}</Label>
              <Input id="reason" name="reason" required />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {t("resetBracket")}
            </Button>
          </form>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
