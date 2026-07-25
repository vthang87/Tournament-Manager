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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  bulkAssignMatchesAction,
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
  label: string;
  status: string;
  courtId: string | null;
  scheduledAt: string | null;
  estimatedDurationMinutes: number | null;
  stageName: string;
};

export type ScheduleCourtDto = {
  id: string;
  name: string;
  code: string;
  active: boolean;
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
}: {
  match: ScheduleMatchDto;
  id: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data: { matchId: match.id } });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
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
  matches,
  timeSlots,
  defaultDurationMinutes,
  canSchedule,
  matchDetailBase,
}: {
  tournamentId: string;
  eventId: string;
  timeZone: string;
  courts: ScheduleCourtDto[];
  matches: ScheduleMatchDto[];
  timeSlots: string[];
  defaultDurationMinutes: number;
  canSchedule: boolean;
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
  const [pending, startTransition] = useTransition();
  // Capture once after mount so upcoming filter stays stable during render.
  const [referenceNowMs] = useState(() => Date.now());

  const matchById = useMemo(
    () => new Map(matches.map((m) => [m.id, m])),
    [matches],
  );

  const unscheduled = matches.filter((m) => !assignments.has(m.id));

  const cellOccupants = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments.values()) {
      // Snap to nearest slot for display
      const slot =
        timeSlots.find((s) => s === a.startTime) ??
        timeSlots.find(
          (s) =>
            Date.parse(s) <= Date.parse(a.startTime) &&
            Date.parse(a.startTime) <
              Date.parse(s) + defaultDurationMinutes * 60_000,
        ) ??
        a.startTime;
      map.set(`${a.courtId}::${slot}`, a.matchId);
    }
    return map;
  }, [assignments, timeSlots, defaultDurationMinutes]);

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
        fd.set("assignmentsJson", JSON.stringify(list));
        return fd;
      })(),
    );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !canSchedule) return;
    const matchId =
      (active.data.current?.matchId as string | undefined) ??
      String(active.id).replace(/^match:/, "");
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
                  <DraggableMatch key={m.id} id={`match:${m.id}`} match={m} />
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
                      className="min-w-[88px] border-b border-slate-200 px-1 py-2 text-center font-medium text-slate-600"
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
                          <DropCell id={cellId} disabled={!court.active}>
                            {occupant ? (
                              <DraggableMatch
                                id={`match:${occupant.id}`}
                                match={occupant}
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

      {canSchedule ? (
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
              setMessage(t("assignmentStaged"));
              setError(null);
            }}
          >
            <h3 className="text-sm font-semibold">{t("manualAssignment")}</h3>
            <div className="space-y-1">
              <Label htmlFor="matchId">{tCommon("match")}</Label>
              <Select id="matchId" name="matchId" required defaultValue="">
                <option value="" disabled>
                  {t("selectMatch")}
                </option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
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
              <Input
                id="localStart"
                name="localStart"
                type="datetime-local"
                required
                defaultValue={
                  timeSlots[0]
                    ? utcIsoToZonedLocal(timeSlots[0], timeZone)
                    : undefined
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="duration">{t("durationMin")}</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min={5}
                defaultValue={defaultDurationMinutes}
              />
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
              const gap = Number(fd.get("gapMinutes") ?? 0);
              const startTime = zonedLocalToUtcIso(local, timeZone);
              const activeCourts = courts.filter((c) => c.active);
              const ids = unscheduled.map((m) => m.id);
              if (ids.length === 0) {
                setError(t("noUnscheduledBulk"));
                return;
              }
              if (activeCourts.length === 0) {
                setError(t("noActiveCourts"));
                return;
              }
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const payload = new FormData();
                payload.set("eventId", eventId);
                payload.set("matchIdsJson", JSON.stringify(ids));
                payload.set(
                  "courtIdsJson",
                  JSON.stringify(activeCourts.map((c) => c.id)),
                );
                payload.set("startTime", startTime);
                payload.set("gapMinutes", String(gap));
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
                router.refresh();
              });
            }}
          >
            <h3 className="text-sm font-semibold">{t("bulkAssign")}</h3>
            <p className="text-[11px] text-slate-500">{t("bulkAssignHint")}</p>
            <div className="space-y-1">
              <Label htmlFor="bulkStart">
                {t("startLabel", { timezone: timeZone })}
              </Label>
              <Input
                id="bulkStart"
                name="bulkStart"
                type="datetime-local"
                required
                defaultValue={
                  timeSlots[0]
                    ? utcIsoToZonedLocal(timeSlots[0], timeZone)
                    : undefined
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gapMinutes">{t("gapMin")}</Label>
              <Input
                id="gapMinutes"
                name="gapMinutes"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {t("bulkAssignUnscheduled")}
            </Button>
          </form>
        </div>
      ) : null}

      {canSchedule ? (
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
            disabled={pending || assignments.size === 0}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const list = assignmentsArray();
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
                setMessage(t("scheduleSaved"));
                router.refresh();
              });
            }}
          >
            {t("saveSchedule")}
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
