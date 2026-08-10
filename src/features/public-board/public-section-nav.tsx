"use client";

import { useCallback, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
};

type Props = {
  items: Item[];
  ariaLabel: string;
  className?: string;
};

/** In-page section nav with smooth scroll, sticky-offset aware. */
export function PublicSectionNav({ items, ariaLabel, className }: Props) {
  const onNavigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = document.getElementById(id);
      if (!target) {
        return;
      }
      event.preventDefault();
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
      window.history.replaceState(null, "", `#${id}`);
    },
    [],
  );

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-0 z-10 -mx-4 mt-3 flex gap-2 overflow-x-auto border-b border-slate-200 bg-[color:var(--background)] px-4 py-2 text-sm",
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(event) => onNavigate(event, item.id)}
          className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
