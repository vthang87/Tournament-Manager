"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import {
  bulkAssignMatchesAction,
  lockScheduleAction,
  saveScheduleAssignmentsAction,
  validateScheduleAssignmentsAction,
} from "@/features/scheduling/actions";
import {
  addMinutesUtc,
  formatTournamentTime,
  utcIsoToZonedLocal,
  zonedLocalToUtcIso,
} from "@/features/scheduling/lib/timezone";

export type ScheduleMatchDto = {
  id: string;
  stageId: string;
  label: string;
  /** Club labels for both sides, when available. */
  clubLabel: string | null;
  status: string;
  courtId: string | null;
  scheduledAt: string | null;
  estimatedDurationMinutes: number | null;
  stageName: string;
  schedulable: boolean;
};

export type ScheduleCourtDto = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

export type ScheduleStageDto = {
  id: string;
  name: string;
  orderIndex: number;
  status: string;
};

type ConflictDto = {
  code: string;
  message: string;
  severity: "error" | "warning";
  matchIds: string[];
};

type Assignment = {
  matchId: string;
  courtId: string;
  startTime: string;
  estimatedDurationMinutes?: number;
};

function MatchChip({
  match,
  dragging,
}: {
  match: ScheduleMatchDto;
  dragging?: boolean;
}) {
  return (
    <div
      className={`rounded border px-2 py-1 text-xs shadow-sm ${
        dragging
          ? "border-slate-400 bg-white opacity-90"
          : "border-slate-300 bg-white"
      }`}
    >
      <p className="font-medium leading-tight">{match.label}</p>
      <p className="text-[10px] text-slate-500">{match.stageName}</p>
    </div>
  );
}

function DraggableMatch({
  match,
  id,
  disabled = false,
}: {
  match: ScheduleMatchDto;
  id: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled, data: { matchId: match.id } });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={disabled ? "cursor-default" : "cursor-grab"}
      {...listeners}
      {...attributes}
    >
      <MatchChip match={match} />
    </div>
  );
}

function DropCell({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
    data: { cellId: id },
  });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[52px] border border-slate-100 p-0.5 ${
        disabled
          ? "bg-slate-100/80"
          : isOver
            ? "bg-emerald-50"
            : "bg-white"
      }`}
    >
      {children}
    </div>
  );
}

function parseCellId(cellId: string): { courtId: string; startTime: string } {
  const [courtId, ...rest] = cellId.split("::");
  return { courtId: courtId!, startTime: rest.join("::") };
}

export function ScheduleBoard({
  tournamentId,
  eventId,
  timeZone,
  courts,
  stages,
  matches,
  timeSlots,
  defaultDurationMinutes,
  defaultRestMinutes,
  canSchedule,
  scheduleLocked,
  matchDetailBase,
}: {
  tournamentId: string;
  eventId: string;
  timeZone: string;
  courts: ScheduleCourtDto[];
  stages: ScheduleStageDto[];
  matches: ScheduleMatchDto[];
  timeSlots: string[];
  defaultDurationMinutes: number;
  defaultRestMinutes: number;
  canSchedule: boolean;
  scheduleLocked: boolean;
  matchDetailBase: string;
}) {
  const router = useRouter();
  const t = useTranslations("schedule");
  const tCommon = useTranslations("common");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const initialAssignments = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const m of matches) {
      if (m.courtId && m.scheduledAt) {
        map.set(m.id, {
          matchId: m.id,
          courtId: m.courtId,
          startTime: m.scheduledAt,
          estimatedDurationMinutes:
            m.estimatedDurationMinutes ?? defaultDurationMinutes,
        });
      }
    }
    return map;
  }, [matches, defaultDurationMinutes]);

  const [assignments, setAssignments] =
    useState<Map<string, Assignment>>(initialAssignments);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [stagedMatchIds, setStagedMatchIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [stagedRestMinutes, setStagedRestMinutes] =
    useState(defaultRestMinutes);
  const [manualMatchId, setManualMatchId] = useState("");
  const defaultLocalStart = timeSlots[0]
    ? utcIsoToZonedLocal(timeSlots[0], timeZone)
    : "";
  const orderedStages = [...stages].sort(
    (left, right) => left.orderIndex - right.orderIndex,
  );
  const defaultBulkStageId =
    orderedStages.find((stage) =>
      matches.some(
        (match) => match.stageId === stage.id && match.schedulable,
      ),
    )?.id ??
    orderedStages[0]?.id ??
    "";
  const suggestedBulkStart = (stageId: string) => {
    const scheduled = matches
      .filter(
        (match) =>
          match.stageId === stageId &&
          match.schedulable &&
          match.scheduledAt,
      )
      .map((match) => match.scheduledAt!)
      .sort((left, right) => Date.parse(left) - Date.parse(right));
    return scheduled[0]
      ? utcIsoToZonedLocal(scheduled[0], timeZone)
      : defaultLocalStart;
  };
  const [manualStart, setManualStart] = useState(defaultLocalStart);
  const [bulkStageId, setBulkStageId] = useState(defaultBulkStageId);
  const [bulkStart, setBulkStart] = useState(
    suggestedBulkStart(defaultBulkStageId),
  );
  const [pending, startTransition] = useTransition();
  // Capture once after mount so upcoming filter stays stable during render.
  const [referenceNowMs] = useState(() => Date.now());

  const matchById = useMemo(
    () => new Map(matches.map((m) => [m.id, m])),
    [matches],
  );

  const matchSelectOptions = useMemo(
    () =>
      matches.filter((m) => m.schedulable).map((m) => ({
        value: m.id,
        label: m.label,
        description: m.clubLabel ?? undefined,
        hint: m.stageName,
      })),
    [matches],
  );

  const unscheduled = matches.filter(
    (m) => m.schedulable && !assignments.has(m.id),
  );
  const eligibleBulkMatches = matches.filter(
    (match) => match.stageId === bulkStageId && match.schedulable,
  );
  const canEditSchedule = canSchedule && !scheduleLocked;

  const cellOccupants = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments.values()) {
      map.set(`${a.courtId}::${a.startTime}`, a.matchId);
    }
    return map;
  }, [assignments]);

  const upcoming = useMemo(() => {
    return [...assignments.values()]
      .filter((a) => Date.parse(a.startTime) >= referenceNowMs - 60_000)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
      .slice(0, 12);
  }, [assignments, referenceNowMs]);

  const assignmentsArray = () => [...assignments.values()];

  const runValidate = (list: Assignment[]) =>
    validateScheduleAssignmentsAction(
      (() => {
        const fd = new FormData();
        fd.set("eventId", eventId);
        fd.set(
          "assignmentsJson",
          JSON.stringify(
            list.map((assignment) => ({
              ...assignment,
              endTime: addMinutesUtc(
                assignment.startTime,
                assignment.estimatedDurationMinutes ??
                  defaultDurationMinutes,
              ),
            })),
          ),
        );
        return fd;
      })(),
    );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !canEditSchedule) return;
    const matchId =
      (active.data.current?.matchId as string | undefined) ??
      String(active.id).replace(/^match:/, "");
    if (!matchById.get(matchId)?.schedulable) {
      setError(t("matchNotSchedulable"));
      return;
    }
    const overId = String(over.id);
    if (!overId.includes("::")) return;
    const { courtId, startTime } = parseCellId(overId);
    const court = courts.find((c) => c.id === courtId);
    if (!court?.active) {
      setError(t("inactiveHint"));
      return;
    }
    setAssignments((prev) => {
      const next = new Map(prev);
      next.set(matchId, {
        matchId,
        courtId,
        startTime,
        estimatedDurationMinutes:
          matchById.get(matchId)?.estimatedDurationMinutes ??
          defaultDurationMinutes,
      });
      return next;
    });
    setDirty(true);
    setStagedMatchIds((current) => new Set(current).add(matchId));
    setError(null);
  };

  const activeMatch = activeId
    ? matchById.get(activeId.replace(/^match:/, ""))
    : null;

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold">{t("unscheduled")}</h3>
            <p className="text-[11px] text-slate-500">{t("dragHint")}</p>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {unscheduled.length === 0 ? (
                <p className="text-xs text-slate-500">{t("allScheduled")}</p>
              ) : (
                unscheduled.map((m) => (
                  <DraggableMatch
                    key={m.id}
                    id={`match:${m.id}`}
                    match={m}
                    disabled={!canEditSchedule || !m.schedulable}
                  />
                ))
              )}
            </div>
          </aside>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium">
                    {tCommon("court")}
                  </th>
                  {timeSlots.map((slot) => (
                    <th
                      key={slot}
                      className="min-w-[176px] border-b border-slate-200 px-1 py-2 text-center font-medium text-slate-600"
                    >
                      {formatTournamentTime(slot, timeZone)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.id}>
                    <td
                      className={`sticky left-0 z-10 border-r border-b border-slate-200 px-2 py-1 font-medium ${
                        court.active ? "bg-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {court.name}
                      {!court.active ? (
                        <span className="ml-1 text-[10px]">
                          ({tCommon("inactive")})
                        </span>
                      ) : null}
                    </td>
                    {timeSlots.map((slot) => {
                      const cellId = `${court.id}::${slot}`;
                      const occupantId = cellOccupants.get(cellId);
                      const occupant = occupantId
                        ? matchById.get(occupantId)
                        : null;
                      return (
                        <td key={cellId} className="border-b border-slate-100 p-0">
                          <DropCell
                            id={cellId}
                            disabled={!court.active || !canEditSchedule}
                          >
                            {occupant ? (
                              <DraggableMatch
                                id={`match:${occupant.id}`}
                                match={occupant}
                                disabled={
                                  !canEditSchedule || !occupant.schedulable
                                }
                              />
                            ) : null}
                          </DropCell>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DragOverlay>
          {activeMatch ? <MatchChip match={activeMatch} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {scheduleLocked ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {t("scheduleLocked")}
        </div>
      ) : null}

      {canEditSchedule ? (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const matchId = String(fd.get("matchId") ?? "");
              const courtId = String(fd.get("courtId") ?? "");
              const local = String(fd.get("localStart") ?? "");
              const duration =
                Number(fd.get("duration") ?? defaultDurationMinutes) ||
                defaultDurationMinutes;
              const restMinutes = Number(
                fd.get("manualRestMinutes") ?? defaultRestMinutes,
              );
              const court = courts.find((c) => c.id === courtId);
              if (!court?.active) {
                setError(t("inactiveHint"));
                return;
              }
              const startTime = zonedLocalToUtcIso(local, timeZone);
              setAssignments((prev) => {
                const next = new Map(prev);
                next.set(matchId, {
                  matchId,
                  courtId,
                  startTime,
                  estimatedDurationMinutes: duration,
                });
                return next;
              });
              setDirty(true);
              setStagedMatchIds((current) => new Set(current).add(matchId));
              setStagedRestMinutes(restMinutes);
              setMessage(t("assignmentStaged"));
              setError(null);
              setManualMatchId("");
            }}
          >
            <h3 className="text-sm font-semibold">{t("manualAssignment")}</h3>
            <div className="space-y-1">
              <Label htmlFor="matchId">{tCommon("match")}</Label>
              <SearchableSelect
                id="matchId"
                name="matchId"
                value={manualMatchId}
                options={matchSelectOptions}
                placeholder={t("selectMatch")}
                searchPlaceholder={t("searchMatch")}
                emptyText={t("noMatchFound")}
                required
                onChange={setManualMatchId}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="courtId">{tCommon("court")}</Label>
              <Select id="courtId" name="courtId" required defaultValue="">
                <option value="" disabled>
                  {t("selectCourt")}
                </option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.active}>
                    {c.name}
                    {!c.active ? ` (${tCommon("inactive")})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="localStart">
                {t("startLabel", { timezone: timeZone })}
              </Label>
              <DateTimePicker
                id="localStart"
                name="localStart"
                value={manualStart}
                onChange={setManualStart}
                required
                placeholder={t("selectDateTime")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="duration">{t("matchDurationMin")}</Label>
              <Select
                id="duration"
                name="duration"
                defaultValue={defaultDurationMinutes}
              >
                <option value={30}>30</option>
                <option value={45}>45</option>
                <option value={60}>60</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="manualRestMinutes">{t("restMin")}</Label>
              <Select
                id="manualRestMinutes"
                name="manualRestMinutes"
                defaultValue={defaultRestMinutes}
              >
                <option value={0}>0</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
              </Select>
            </div>
            <Button type="submit" size="sm" variant="secondary">
              {t("stageAssignment")}
            </Button>
          </form>

          <form
            className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const local = String(fd.get("bulkStart") ?? "");
              const matchDurationMinutes = Number(
                fd.get("matchDurationMinutes") ?? 30,
              );
              const restMinutes = Number(fd.get("restMinutes") ?? 0);
              const startTime = zonedLocalToUtcIso(local, timeZone);
              const activeCourts = courts.filter((c) => c.active);
              const stageId = String(fd.get("stageId") ?? "");
              const ids = eligibleBulkMatches.map((match) => match.id);
              if (activeCourts.length === 0) {
                setError(t("noActiveCourts"));
                return;
              }
              if (!stageId || ids.length === 0) {
                setError(t("noEligibleStageMatches"));
                return;
              }
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const payload = new FormData();
                payload.set("eventId", eventId);
                payload.set("stageId", stageId);
                payload.set("matchIdsJson", JSON.stringify(ids));
                payload.set(
                  "courtIdsJson",
                  JSON.stringify(activeCourts.map((c) => c.id)),
                );
                payload.set("startTime", startTime);
                payload.set(
                  "matchDurationMinutes",
                  String(matchDurationMinutes),
                );
                payload.set("restMinutes", String(restMinutes));
                const result = await bulkAssignMatchesAction(
                  tournamentId,
                  eventId,
                  payload,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage(t("bulkAssigned", { count: ids.length }));
                const data = result.data as {
                  conflicts?: ConflictDto[];
                };
                setConflicts(data.conflicts ?? []);
                setDirty(false);
                setStagedMatchIds(new Set());
                router.refresh();
              });
            }}
          >
            <h3 className="text-sm font-semibold">{t("bulkAssign")}</h3>
            <p className="text-[11px] text-slate-500">{t("bulkAssignHint")}</p>
            <div className="space-y-1">
              <Label htmlFor="stageId">{t("scheduleStage")}</Label>
              <Select
                id="stageId"
                name="stageId"
                value={bulkStageId}
                onChange={(event) => {
                  const stageId = event.target.value;
                  setBulkStageId(stageId);
                  setBulkStart(suggestedBulkStart(stageId));
                }}
                required
              >
                {orderedStages.map((stage) => {
                  const count = matches.filter(
                    (match) =>
                      match.stageId === stage.id && match.schedulable,
                  ).length;
                  return (
                    <option key={stage.id} value={stage.id} disabled={count === 0}>
                      {stage.name} ({count})
                    </option>
                  );
                })}
              </Select>
              <p className="text-[11px] text-slate-500">
                {t("eligibleStageMatches", {
                  count: eligibleBulkMatches.length,
                })}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulkStart">
                {t("startLabel", { timezone: timeZone })}
              </Label>
              <DateTimePicker
                id="bulkStart"
                name="bulkStart"
                value={bulkStart}
                onChange={setBulkStart}
                required
                placeholder={t("selectDateTime")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="matchDurationMinutes">
                {t("matchDurationMin")}
              </Label>
              <Select
                id="matchDurationMinutes"
                name="matchDurationMinutes"
                defaultValue={30}
              >
                <option value={30}>30</option>
                <option value={45}>45</option>
                <option value={60}>60</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="restMinutes">{t("restMin")}</Label>
              <Select
                id="restMinutes"
                name="restMinutes"
                defaultValue={defaultRestMinutes}
              >
                <option value={0}>0</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
              </Select>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={pending || eligibleBulkMatches.length === 0}
            >
              {t("bulkAssignStage")}
            </Button>
          </form>
        </div>
      ) : null}

      {canEditSchedule ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || assignments.size === 0}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await runValidate(assignmentsArray());
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const data = result.data!;
                setConflicts(data.conflicts as ConflictDto[]);
                if (data.hardCount > 0) {
                  setError(t("hardConflicts", { count: data.hardCount }));
                } else if (data.softCount > 0) {
                  setMessage(t("softWarnings", { count: data.softCount }));
                } else {
                  setMessage(t("noConflicts"));
                }
              });
            }}
          >
            {t("revalidate")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || stagedMatchIds.size === 0}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const list = assignmentsArray().filter((assignment) =>
                  stagedMatchIds.has(assignment.matchId),
                );
                const check = await runValidate(list);
                if (!check.ok) {
                  setError(check.error);
                  return;
                }
                setConflicts(check.data!.conflicts as ConflictDto[]);
                if (check.data!.hardCount > 0) {
                  setError(
                    t("hardBlocked", { count: check.data!.hardCount }),
                  );
                  return;
                }
                const fd = new FormData();
                fd.set("eventId", eventId);
                fd.set("restMinutes", String(stagedRestMinutes));
                fd.set(
                  "assignmentsJson",
                  JSON.stringify(
                    list.map((a) => ({
                      ...a,
                      endTime: addMinutesUtc(
                        a.startTime,
                        a.estimatedDurationMinutes ?? defaultDurationMinutes,
                      ),
                    })),
                  ),
                );
                const result = await saveScheduleAssignmentsAction(
                  tournamentId,
                  eventId,
                  fd,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const data = result.data as { conflicts?: ConflictDto[] };
                setConflicts(data.conflicts ?? []);
                setDirty(false);
                setStagedMatchIds(new Set());
                setMessage(t("scheduleSaved"));
                router.refresh();
              });
            }}
          >
            {t("saveSchedule")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              pending || dirty || assignments.size !== matches.length
            }
            title={dirty ? t("saveBeforeLock") : undefined}
            onClick={() => {
              if (!window.confirm(t("lockConfirm"))) return;
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await lockScheduleAction(
                  tournamentId,
                  eventId,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage(t("scheduleLocked"));
                router.refresh();
              });
            }}
          >
            {t("lockSchedule")}
          </Button>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {conflicts.map((c, i) => (
            <li key={`${c.code}-${i}`}>
              <span className="font-medium">
                [{c.severity}] {c.code}
              </span>
              : {c.message}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("upcomingMatches")}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noUpcoming")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {upcoming.map((a) => {
              const m = matchById.get(a.matchId);
              const court = courts.find((c) => c.id === a.courtId);
              return (
                <li
                  key={a.matchId}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{m?.label ?? a.matchId}</p>
                    <p className="text-xs text-slate-500">
                      {court?.name ?? tCommon("court")} ·{" "}
                      {formatTournamentTime(a.startTime, timeZone, "MMM d HH:mm")}{" "}
                      ({timeZone})
                    </p>
                  </div>
                  <Link
                    href={`${matchDetailBase}/${a.matchId}`}
                    className="text-xs font-medium underline"
                  >
                    {tCommon("openLink")}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
