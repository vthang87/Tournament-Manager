"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeSearch } from "@/lib/normalize-search";

export type SearchableOption = {
  value: string;
  label: string;
  /** Secondary line (e.g. club name) — also searchable. */
  description?: string;
  disabled?: boolean;
  hint?: string;
};

export function SearchableSelect({
  id,
  name,
  value,
  options,
  placeholder,
  searchPlaceholder = "Tìm…",
  emptyText = "Không có kết quả",
  required,
  disabled,
  onChange,
  className,
}: {
  id?: string;
  name: string;
  value: string;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options;
    return options.filter(
      (o) =>
        normalizeSearch(o.label).includes(q) ||
        (o.description != null && normalizeSearch(o.description).includes(q)),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  function openMenu() {
    if (disabled) return;
    setHighlight(0);
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      setHighlight(0);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt && !opt.disabled) pick(opt.value);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery("");
            setHighlight(0);
          } else {
            openMenu();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                pick("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder={searchPlaceholder}
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              autoComplete="off"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>
            ) : (
              filtered.map((opt, i) => (
                <li key={opt.value} role="option" aria-selected={opt.value === value}>
                  <button
                    type="button"
                    disabled={opt.disabled}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm",
                      opt.disabled
                        ? "cursor-not-allowed text-slate-400"
                        : "hover:bg-slate-50",
                      i === highlight && !opt.disabled && "bg-slate-100",
                      opt.value === value && "font-medium text-slate-900",
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => {
                      if (!opt.disabled) pick(opt.value);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {opt.description}
                        </span>
                      ) : null}
                    </span>
                    {opt.hint ? (
                      <span className="shrink-0 text-xs text-slate-400">
                        {opt.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
