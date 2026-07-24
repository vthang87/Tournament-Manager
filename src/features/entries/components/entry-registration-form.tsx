"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import type { EventType } from "@/core/domain";
import { requiredMemberCount } from "@/core/domain/entry-rules";
import type { ActionResult } from "@/features/shared/action-utils";

type PlayerOption = {
  id: string;
  displayName: string;
  clubName?: string | null;
};
type ClubOption = { id: string; name: string };

function pairDisplayName(a?: string, b?: string): string {
  if (a && b) return `${a} / ${b}`;
  if (a) return a;
  if (b) return b;
  return "";
}

export function EntryRegistrationForm({
  eventType,
  players,
  clubs,
  action,
  defaults,
  submitLabel,
}: {
  eventType: EventType;
  players: PlayerOption[];
  clubs: ClubOption[];
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  defaults?: {
    displayName?: string;
    seed?: number | null;
    ranking?: number | null;
    clubId?: string | null;
    memberPlayerIds?: string[];
  };
  submitLabel: string;
}) {
  const t = useTranslations("entries");
  const tCommon = useTranslations("common");
  const required = requiredMemberCount(eventType);
  const slots =
    eventType === "TEAM"
      ? Math.max(4, defaults?.memberPlayerIds?.length ?? 4)
      : required;

  const initialMembers = useMemo(() => {
    const ids = defaults?.memberPlayerIds ?? [];
    return Array.from({ length: slots }, (_, i) => ids[i] ?? "");
  }, [defaults?.memberPlayerIds, slots]);

  const [memberIds, setMemberIds] = useState<string[]>(initialMembers);
  const [displayName, setDisplayName] = useState(defaults?.displayName ?? "");
  const [autoName, setAutoName] = useState(!defaults?.displayName);

  const playerLabel = (position: number) => {
    if (eventType === "DOUBLES") {
      return position === 1 ? t("player1") : t("player2");
    }
    if (eventType === "SINGLES") return t("player");
    return `${t("members")} ${position}`;
  };

  function updateMember(index: number, playerId: string) {
    const next = [...memberIds];
    next[index] = playerId;
    setMemberIds(next);
    if (autoName) {
      applyNamesFromMembers(next);
    }
  }

  function applyNamesFromMembers(ids: string[] = memberIds) {
    const names = ids
      .map((id) => players.find((p) => p.id === id)?.displayName)
      .filter(Boolean) as string[];
    if (eventType === "DOUBLES") {
      setDisplayName(pairDisplayName(names[0], names[1]));
    } else if (eventType === "SINGLES") {
      setDisplayName(names[0] ?? "");
    } else {
      setDisplayName(names.join(" / "));
    }
    setAutoName(true);
  }

  const canFillFromPlayers =
    eventType === "DOUBLES"
      ? Boolean(memberIds[0] && memberIds[1])
      : eventType === "SINGLES"
        ? Boolean(memberIds[0])
        : memberIds.some(Boolean);

  const selectedSet = new Set(memberIds.filter(Boolean));

  return (
    <ActionForm
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      submitLabel={submitLabel}
      action={action}
    >
      {eventType === "DOUBLES" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t.rich("doublesHint", {
            pair: (chunks) => <strong>{chunks}</strong>,
          })}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="displayName">
          {eventType === "DOUBLES" ? t("pairName") : t("displayName")}
        </Label>
        <div className="flex gap-2">
          <Input
            id="displayName"
            name="displayName"
            required
            value={displayName}
            onChange={(e) => {
              setAutoName(false);
              setDisplayName(e.target.value);
            }}
            className="flex-1"
          />
          {(eventType === "DOUBLES" || eventType === "SINGLES") && (
            <Button
              type="button"
              variant="outline"
              disabled={!canFillFromPlayers}
              onClick={() => applyNamesFromMembers()}
              className="shrink-0"
            >
              {eventType === "DOUBLES" ? t("fillFromPlayers") : t("fillFromPlayer")}
            </Button>
          )}
        </div>
        {eventType === "DOUBLES" ? (
          <p className="text-xs text-slate-500">{t("autoNameHint")}</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="seed">{t("seed")}</Label>
          <Input
            id="seed"
            name="seed"
            type="number"
            min={1}
            defaultValue={defaults?.seed ?? undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ranking">{t("ranking")}</Label>
          <Input
            id="ranking"
            name="ranking"
            type="number"
            min={1}
            defaultValue={defaults?.ranking ?? undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clubId">{t("club")}</Label>
        <Select
          id="clubId"
          name="clubId"
          defaultValue={defaults?.clubId ?? ""}
        >
          <option value="">{tCommon("none")}</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-800">
          {eventType === "DOUBLES"
            ? t("pairMembersHint")
            : eventType === "SINGLES"
              ? t("player")
              : t("members")}
        </p>
        {Array.from({ length: slots }, (_, i) => i).map((index) => {
          const position = index + 1;
          const value = memberIds[index] ?? "";
          const options = players.map((player) => {
            const taken = selectedSet.has(player.id) && player.id !== value;
            return {
              value: player.id,
              label: player.displayName,
              description: player.clubName || undefined,
              disabled: taken,
              hint: taken ? t("alreadySelected") : undefined,
            };
          });
          return (
            <div key={position} className="space-y-1.5">
              <Label htmlFor={`player${position}`}>
                {playerLabel(position)}
                {eventType !== "TEAM" && position <= required ? " *" : ""}
              </Label>
              <SearchableSelect
                id={`player${position}`}
                name={`player${position}`}
                value={value}
                options={options}
                placeholder={t("selectPlayer")}
                searchPlaceholder={t("searchPlayer")}
                emptyText={t("noPlayerMatch")}
                required={eventType !== "TEAM" && position <= required}
                onChange={(next) => updateMember(index, next)}
              />
            </div>
          );
        })}
      </div>
    </ActionForm>
  );
}
