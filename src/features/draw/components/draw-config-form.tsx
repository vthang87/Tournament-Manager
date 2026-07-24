"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
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
import { generateDrawAction } from "@/features/draw/actions";
import {
  DrawCeremonyOverlay,
  type CeremonyGroup,
  type CeremonyPlacement,
} from "@/features/draw/components/draw-ceremony-overlay";

export function DrawConfigForm({
  tournamentId,
  eventId,
  stageId,
  defaults,
  disabled,
}: {
  tournamentId: string;
  eventId: string;
  stageId: string;
  defaults: {
    groupCount: number;
    capacityPerGroup: number;
    seedDistribution: "NORMAL" | "SERPENTINE";
    avoidSameClub: boolean;
    randomSeed: string;
  };
  disabled?: boolean;
}) {
  const t = useTranslations("draw");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [ceremonyGroups, setCeremonyGroups] = useState<CeremonyGroup[]>([]);
  const [ceremonyPlacements, setCeremonyPlacements] = useState<
    CeremonyPlacement[]
  >([]);

  function finishCeremony() {
    setCeremonyOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("configuration")}</CardTitle>
          <CardDescription>{t("configurationHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              setError(null);
              setInfo(null);
              startTransition(async () => {
                const result = await generateDrawAction(
                  tournamentId,
                  eventId,
                  formData,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setInfo(
                  result.data.warningCount > 0
                    ? t("generatedWithWarnings", {
                        count: result.data.warningCount,
                      })
                    : t("generatedStarting"),
                );
                setCeremonyGroups(result.data.groups);
                setCeremonyPlacements(result.data.placements);
                setCeremonyOpen(true);
              });
            }}
          >
            <input type="hidden" name="stageId" value={stageId} />
            <div className="space-y-1.5">
              <Label htmlFor="groupCount">{t("groupCount")}</Label>
              <Input
                id="groupCount"
                name="groupCount"
                type="number"
                min={1}
                required
                defaultValue={defaults.groupCount}
                disabled={disabled || pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacityPerGroup">{t("capacityPerGroup")}</Label>
              <Input
                id="capacityPerGroup"
                name="capacityPerGroup"
                type="number"
                min={1}
                required
                defaultValue={defaults.capacityPerGroup}
                disabled={disabled || pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seedDistribution">{t("seedStrategy")}</Label>
              <Select
                id="seedDistribution"
                name="seedDistribution"
                defaultValue={defaults.seedDistribution}
                disabled={disabled || pending}
              >
                <option value="NORMAL">NORMAL</option>
                <option value="SERPENTINE">SERPENTINE</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="randomSeed">{t("randomSeed")}</Label>
              <Input
                id="randomSeed"
                name="randomSeed"
                defaultValue={defaults.randomSeed}
                disabled={disabled || pending}
              />
            </div>
            <label className="flex items-center gap-2 self-end text-sm">
              <Checkbox
                name="avoidSameClub"
                defaultChecked={defaults.avoidSameClub}
                disabled={disabled || pending}
              />
              {t("avoidSameClub")}
            </label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <Button type="submit" disabled={disabled || pending}>
                {pending ? t("generating") : t("generate")}
              </Button>
            </div>
            {error ? (
              <p
                className="sm:col-span-2 lg:col-span-3 text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="sm:col-span-2 lg:col-span-3 text-sm text-emerald-700">
                {info}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <DrawCeremonyOverlay
        open={ceremonyOpen}
        groups={ceremonyGroups}
        placements={ceremonyPlacements}
        onComplete={finishCeremony}
        onSkip={finishCeremony}
      />
    </>
  );
}
