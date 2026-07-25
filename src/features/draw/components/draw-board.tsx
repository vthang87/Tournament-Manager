"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  confirmDrawAction,
  generateRoundRobinAction,
  saveManualDrawAction,
  validateManualDrawAction,
} from "@/features/draw/actions";
import {
  allocationFromBuckets,
  bucketsFromResults,
  moveEntryBetweenGroups,
  type GroupBuckets,
} from "@/features/draw/lib/allocations";
import {
  formatClubLabel,
  type CeremonyPlacement,
} from "@/features/draw/lib/ceremony-order";
import {
  DrawCeremonyOverlay,
} from "@/features/draw/components/draw-ceremony-overlay";
import {
  localizeDrawIssue,
  type DrawIssueView,
} from "@/features/draw/lib/localize-draw-issue";
import { ConfirmDrawModal } from "./confirm-draw-modal";
import { cn } from "@/lib/utils";

export type DrawEntryView = {
  id: string;
  displayName: string;
  seed: number | null;
  clubId: string | null;
  clubCode: string | null;
  clubName: string | null;
};

export type DrawGroupView = {
  id: string;
  name: string;
  code: string;
};

type Issue = DrawIssueView & {
  severity: "error" | "warning";
};

function EntryRow({
  entry,
  muted,
  style,
  isDragging,
  className,
  children,
  ...rest
}: {
  entry: DrawEntryView;
  muted?: boolean;
  style?: React.CSSProperties;
  isDragging?: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const clubLabel = formatClubLabel(entry.clubCode, entry.clubName);
  return (
    <div
      style={style}
      className={cn(
        "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm",
        isDragging && "opacity-60 ring-2 ring-slate-400",
        muted && "opacity-80",
        className,
      )}
      {...rest}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {entry.displayName}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {entry.seed != null ? `Seed ${entry.seed}` : "Unseeded"}
            {clubLabel ? ` · ${clubLabel}` : ""}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function SortableEntry({
  entry,
  readOnly,
  groups,
  currentGroupId,
  onMobileMove,
}: {
  entry: DrawEntryView;
  readOnly: boolean;
  groups: DrawGroupView[];
  currentGroupId: string;
  onMobileMove: (entryId: string, toGroupId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <EntryRow
        entry={entry}
        isDragging={isDragging}
        className={cn(
          !readOnly && "cursor-grab touch-none active:cursor-grabbing",
        )}
        {...(readOnly ? {} : { ...attributes, ...listeners })}
      >
        {!readOnly ? (
          <div
            className="md:hidden"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Select
              aria-label={`Move ${entry.displayName}`}
              className="h-8 w-[7.5rem] text-xs"
              value={currentGroupId}
              onChange={(e) => {
                const to = e.target.value;
                if (to !== currentGroupId) {
                  onMobileMove(entry.id, to);
                }
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </EntryRow>
    </div>
  );
}

function StaticGroupColumn({
  group,
  entryIds,
  entriesById,
  capacity,
  dropHint,
}: {
  group: DrawGroupView;
  entryIds: string[];
  entriesById: Map<string, DrawEntryView>;
  capacity: number;
  dropHint: string;
}) {
  const overCapacity = entryIds.length > capacity;

  return (
    <Card className={cn(overCapacity && "border-red-300")}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">{group.name}</CardTitle>
        <CardDescription>
          {entryIds.length}/{capacity}
          {overCapacity ? " · over capacity" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="min-h-[8rem] space-y-2 rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-2">
          {entryIds.map((id) => {
            const entry = entriesById.get(id);
            if (!entry) return null;
            return <EntryRow key={id} entry={entry} />;
          })}
          {entryIds.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-slate-400">
              {dropHint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function GroupColumn({
  group,
  entryIds,
  entriesById,
  capacity,
  readOnly,
  groups,
  revealed,
  onMobileMove,
  dropHint,
}: {
  group: DrawGroupView;
  entryIds: string[];
  entriesById: Map<string, DrawEntryView>;
  capacity: number;
  readOnly: boolean;
  groups: DrawGroupView[];
  revealed: boolean;
  onMobileMove: (entryId: string, toGroupId: string) => void;
  dropHint: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });
  const overCapacity = entryIds.length > capacity;

  return (
    <Card
      className={cn(
        "transition-opacity duration-300",
        !revealed && "opacity-0",
        revealed && "opacity-100",
        isOver && !readOnly && "ring-2 ring-slate-400",
        overCapacity && "border-red-300",
      )}
    >
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">{group.name}</CardTitle>
        <CardDescription>
          {entryIds.length}/{capacity}
          {overCapacity ? " · over capacity" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div
          ref={setNodeRef}
          className="min-h-[8rem] space-y-2 rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-2"
        >
          <SortableContext
            items={entryIds}
            strategy={verticalListSortingStrategy}
          >
            {entryIds.map((id) => {
              const entry = entriesById.get(id);
              if (!entry) return null;
              return (
                <SortableEntry
                  key={id}
                  entry={entry}
                  readOnly={readOnly}
                  groups={groups}
                  currentGroupId={group.id}
                  onMobileMove={onMobileMove}
                />
              );
            })}
          </SortableContext>
          {entryIds.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-slate-400">
              {dropHint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DrawBoard({
  tournamentId,
  eventId,
  stageId,
  sessionId,
  sessionStatus,
  groups,
  results,
  entries,
  capacityPerGroup,
  canEdit,
  canGenerateMatches,
  initialIssues = [],
}: {
  tournamentId: string;
  eventId: string;
  stageId: string;
  sessionId: string;
  sessionStatus: "DRAFT" | "CONFIRMED" | "LOCKED";
  groups: DrawGroupView[];
  results: Array<{ groupId: string; entryId: string; position: number }>;
  entries: DrawEntryView[];
  capacityPerGroup: number;
  canEdit: boolean;
  canGenerateMatches: boolean;
  initialIssues?: Issue[];
}) {
  const entriesById = useMemo(
    () => new Map(entries.map((e) => [e.id, e])),
    [entries],
  );
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const resultsKey = results
    .map((r) => `${r.groupId}:${r.entryId}:${r.position}`)
    .join("|");
  // Remount when session/results change so local buckets reset without syncing in an effect.
  return (
    <DrawBoardInner
      key={`${sessionId}:${resultsKey}`}
      tournamentId={tournamentId}
      eventId={eventId}
      stageId={stageId}
      sessionId={sessionId}
      sessionStatus={sessionStatus}
      groups={groups}
      results={results}
      capacityPerGroup={capacityPerGroup}
      canEdit={canEdit}
      canGenerateMatches={canGenerateMatches}
      initialIssues={initialIssues}
      entriesById={entriesById}
      groupIds={groupIds}
    />
  );
}

function DrawBoardInner({
  tournamentId,
  eventId,
  stageId,
  sessionId,
  sessionStatus,
  groups,
  results,
  capacityPerGroup,
  canEdit,
  canGenerateMatches,
  initialIssues = [],
  entriesById,
  groupIds,
}: {
  tournamentId: string;
  eventId: string;
  stageId: string;
  sessionId: string;
  sessionStatus: "DRAFT" | "CONFIRMED" | "LOCKED";
  groups: DrawGroupView[];
  results: Array<{ groupId: string; entryId: string; position: number }>;
  capacityPerGroup: number;
  canEdit: boolean;
  canGenerateMatches: boolean;
  initialIssues?: Issue[];
  entriesById: Map<string, DrawEntryView>;
  groupIds: string[];
}) {
  const router = useRouter();
  const t = useTranslations("draw");
  const [buckets, setBuckets] = useState<GroupBuckets>(() =>
    bucketsFromResults(groupIds, results),
  );
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [interactiveReady, setInteractiveReady] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const readOnly = !canEdit || sessionStatus !== "DRAFT";
  const locked = sessionStatus === "LOCKED" || sessionStatus === "CONFIRMED";

  useEffect(() => {
    setInteractiveReady(true);
  }, []);

  const ceremonyPlacements: CeremonyPlacement[] = useMemo(
    () =>
      results.map((r) => {
        const entry = entriesById.get(r.entryId);
        return {
          groupId: r.groupId,
          entryId: r.entryId,
          position: r.position,
          displayName: entry?.displayName ?? r.entryId,
          seed: entry?.seed ?? null,
          clubCode: entry?.clubCode ?? null,
          clubName: entry?.clubName ?? null,
        };
      }),
    [results, entriesById],
  );

  useEffect(() => {
    if (!interactiveReady) return;
    const timers: number[] = [];
    groups.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          setRevealedCount((n) => Math.max(n, index + 1));
        }, 40 * index),
      );
    });
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [groups, interactiveReady]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const hardErrors = issues.filter((i) => i.severity === "error");
  const softWarnings = issues.filter((i) => i.severity === "warning");

  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  const formatIssue = (issue: Issue) =>
    localizeDrawIssue(issue, { groupsById, entriesById, t });

  useEffect(() => {
    if (results.length === 0) return;
    let cancelled = false;
    const allocation = allocationFromBuckets(
      bucketsFromResults(groupIds, results),
    );
    void validateManualDrawAction(sessionId, allocation).then((result) => {
      if (!cancelled && result.ok) {
        setIssues(result.data.issues);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, results, groupIds]);

  function findGroupOfEntry(entryId: string, source: GroupBuckets) {
    for (const [groupId, ids] of Object.entries(source)) {
      if (ids.includes(entryId)) return groupId;
    }
    return null;
  }

  function applyMove(next: GroupBuckets) {
    setBuckets(next);
    setDirty(true);
    setMessage(null);
    setError(null);
    const allocation = allocationFromBuckets(next);
    startTransition(async () => {
      const result = await validateManualDrawAction(sessionId, allocation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIssues(result.data.issues);
    });
  }

  function onMobileMove(entryId: string, toGroupId: string) {
    if (readOnly) return;
    applyMove(moveEntryBetweenGroups(buckets, entryId, toGroupId));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (readOnly) return;
    const { active, over } = event;
    if (!over) return;

    const entryId = String(active.id);
    const overId = String(over.id);
    const fromGroupId = findGroupOfEntry(entryId, buckets);
    if (!fromGroupId) return;

    const toGroupId = groupIds.includes(overId)
      ? overId
      : findGroupOfEntry(overId, buckets);
    if (!toGroupId) return;

    let toIndex: number | undefined;
    if (!groupIds.includes(overId)) {
      toIndex = buckets[toGroupId]?.indexOf(overId) ?? undefined;
    }

    if (fromGroupId === toGroupId && toIndex === undefined) {
      return;
    }

    applyMove(
      moveEntryBetweenGroups(buckets, entryId, toGroupId, toIndex),
    );
  }

  function handleSave() {
    setError(null);
    setMessage(null);
    const allocation = allocationFromBuckets(buckets);
    startTransition(async () => {
      const result = await saveManualDrawAction(
        tournamentId,
        eventId,
        sessionId,
        allocation,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDirty(false);
      setMessage(
        result.data.warningCount > 0
          ? `Saved with ${result.data.warningCount} soft warning(s).`
          : "Manual adjustment saved.",
      );
      router.refresh();
    });
  }

  function handleConfirm() {
    setConfirmError(null);
    startTransition(async () => {
      if (dirty) {
        const save = await saveManualDrawAction(
          tournamentId,
          eventId,
          sessionId,
          allocationFromBuckets(buckets),
        );
        if (!save.ok) {
          setConfirmError(save.error);
          return;
        }
        setDirty(false);
      }
      const result = await confirmDrawAction(
        tournamentId,
        eventId,
        sessionId,
      );
      if (!result.ok) {
        setConfirmError(result.error);
        return;
      }
      setConfirmOpen(false);
      setMessage("Draw confirmed and locked.");
      router.refresh();
    });
  }

  function handleGenerateMatches() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await generateRoundRobinAction(
        tournamentId,
        eventId,
        stageId,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Round-robin generated: ${result.data.created} created, ${result.data.skippedExisting} already present.`,
      );
      router.refresh();
    });
  }

  const activeEntry = activeId ? entriesById.get(activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {locked ? t("locked") : t("preview")}
          </h3>
          <p className="text-sm text-slate-600">
            {t("sessionStatus", { status: sessionStatus })}
            {dirty ? t("unsavedChanges") : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {results.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setCeremonyOpen(true)}
            >
              {t("replay")}
            </Button>
          ) : null}
          {!readOnly ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !dirty || hardErrors.length > 0}
                onClick={handleSave}
              >
                {t("saveAdjustment")}
              </Button>
              <Button
                type="button"
                disabled={pending || hardErrors.length > 0}
                onClick={() => {
                  setConfirmError(null);
                  setConfirmOpen(true);
                }}
              >
                {t("confirm")}
              </Button>
            </>
          ) : null}
          {canGenerateMatches ? (
            <Button
              type="button"
              disabled={pending}
              onClick={handleGenerateMatches}
            >
              {t("generateMatches")}
            </Button>
          ) : null}
        </div>
      </div>

      {hardErrors.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">{t("hardViolations")}</p>
          <ul className="mt-1 list-disc pl-5">
            {hardErrors.map((issue) => (
              <li key={`${issue.code}-${issue.groupId ?? ""}-${issue.entityIds?.join(",") ?? issue.message}`}>
                {formatIssue(issue)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {softWarnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">{t("softWarnings")}</p>
          <ul className="mt-1 list-disc pl-5">
            {softWarnings.map((issue) => (
              <li key={`${issue.code}-${issue.groupId ?? ""}-${issue.entityIds?.join(",") ?? issue.message}`}>
                {formatIssue(issue)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700">{message}</p>
      ) : null}

      {!readOnly ? (
        <p className="text-xs text-slate-500 md:hidden">{t("mobileHint")}</p>
      ) : null}

      {interactiveReady ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((group, index) => (
            <GroupColumn
              key={group.id}
              group={group}
              entryIds={buckets[group.id] ?? []}
              entriesById={entriesById}
              capacity={capacityPerGroup}
              readOnly={readOnly}
              groups={groups}
              revealed={index < revealedCount}
              onMobileMove={onMobileMove}
              dropHint={t("dropHere")}
            />
          ))}
        </div>
        <DragOverlay>
          {activeEntry ? <EntryRow entry={activeEntry} /> : null}
        </DragOverlay>
      </DndContext>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <StaticGroupColumn
            key={group.id}
            group={group}
            entryIds={buckets[group.id] ?? []}
            entriesById={entriesById}
            capacity={capacityPerGroup}
            dropHint={t("dropHere")}
          />
        ))}
      </div>
    )}

      <ConfirmDrawModal
        open={confirmOpen}
        pending={pending}
        error={confirmError}
        softWarningCount={softWarnings.length}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <DrawCeremonyOverlay
        open={ceremonyOpen}
        groups={groups}
        placements={ceremonyPlacements}
        onComplete={() => setCeremonyOpen(false)}
        onSkip={() => setCeremonyOpen(false)}
      />
    </div>
  );
}
