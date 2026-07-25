"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function parseLocalValue(value: string): Date | null {
  if (!value) return null;
  const parsed = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function snapMinute(minute: number): string {
  const snapped = Math.round(minute / 5) * 5;
  const clamped = Math.min(55, Math.max(0, snapped));
  return clamped.toString().padStart(2, "0");
}

/** Date + time picker storing `YYYY-MM-DDTHH:mm` (datetime-local compatible). */
export function DateTimePicker({
  id,
  name,
  value,
  onChange,
  required,
  disabled,
  placeholder = "Select date & time",
  className,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => parseLocalValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const cursor = useMemo(
    () => viewMonth ?? selected ?? new Date(),
    [viewMonth, selected],
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const hour = selected ? format(selected, "HH") : "08";
  const minute = selected ? snapMinute(selected.getMinutes()) : "00";

  function commit(next: Date) {
    onChange(toLocalValue(next));
  }

  function pickDay(day: Date) {
    const next = new Date(day);
    next.setHours(Number(hour), Number(minute), 0, 0);
    commit(next);
    setViewMonth(null);
  }

  function pickHour(h: string) {
    const base = selected ?? cursor;
    const next = new Date(base);
    next.setHours(Number(h), Number(minute), 0, 0);
    commit(next);
  }

  function pickMinute(m: string) {
    const base = selected ?? cursor;
    const next = new Date(base);
    next.setHours(Number(hour), Number(m), 0, 0);
    commit(next);
  }

  const display = selected
    ? format(selected, "dd/MM/yyyy HH:mm")
    : placeholder;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className={cn("truncate tabular-nums", !selected && "text-slate-400")}>
          {display}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          className="absolute z-40 mt-1 w-[min(100%,20rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Previous month"
              onClick={() => setViewMonth(addMonths(cursor, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium text-slate-800">
              {format(cursor, "MMMM yyyy")}
            </p>
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Next month"
              onClick={() => setViewMonth(addMonths(cursor, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const active = selected ? isSameDay(day, selected) : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={cn(
                    "h-8 rounded text-sm tabular-nums",
                    !inMonth && "text-slate-300",
                    inMonth && !active && "text-slate-800 hover:bg-slate-100",
                    active && "bg-slate-900 font-medium text-white",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <label className="sr-only" htmlFor={`${id ?? name}-hour`}>
              Hour
            </label>
            <select
              id={`${id ?? name}-hour`}
              value={hour}
              onChange={(e) => pickHour(e.target.value)}
              className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-slate-400">:</span>
            <label className="sr-only" htmlFor={`${id ?? name}-minute`}>
              Minute
            </label>
            <select
              id={`${id ?? name}-minute`}
              value={minute}
              onChange={(e) => pickMinute(e.target.value)}
              className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
