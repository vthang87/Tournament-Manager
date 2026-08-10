"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OrgChartNode } from "./types";

const TONE_CLASS: Record<NonNullable<OrgChartNode["tone"]>, string> = {
  root: "border-slate-800 bg-slate-900 text-white",
  event: "border-sky-300 bg-sky-50 text-sky-950",
  stage: "border-indigo-300 bg-indigo-50 text-indigo-950",
  group: "border-slate-200 bg-white text-slate-900",
  match: "border-slate-300 bg-white text-slate-900",
  court: "border-emerald-300 bg-emerald-50 text-emerald-950",
  muted: "border-slate-200 bg-slate-50 text-slate-600",
};

function NodeCard({ node }: { node: OrgChartNode }) {
  const tone = node.tone ?? "group";
  const inner = (
    <div
      className={cn(
        "inline-flex min-w-[9.5rem] max-w-[14rem] flex-col rounded-lg border px-3 py-2 text-left shadow-sm",
        TONE_CLASS[tone],
        node.href && "transition hover:ring-2 hover:ring-slate-400",
      )}
    >
      <span className="text-sm font-semibold leading-snug">{node.label}</span>
      {node.sublabel ? (
        <span
          className={cn(
            "mt-0.5 text-xs leading-snug",
            tone === "root" ? "text-slate-300" : "text-slate-500",
          )}
        >
          {node.sublabel}
        </span>
      ) : null}
      {node.meta ? (
        <span
          className={cn(
            "mt-0.5 text-[11px] font-medium tabular-nums",
            tone === "root" ? "text-slate-200" : "text-slate-600",
          )}
        >
          {node.meta}
        </span>
      ) : null}
      {node.status ? (
        <span
          className={cn(
            "mt-1 text-[10px] font-semibold uppercase tracking-wider",
            tone === "root" ? "text-emerald-300" : "text-slate-500",
          )}
        >
          {node.status}
        </span>
      ) : null}
    </div>
  );

  if (node.href) {
    return (
      <Link href={node.href} className="inline-block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function OrgBranch({ node }: { node: OrgChartNode }) {
  const kids = node.children ?? [];
  return (
    <li className="relative flex flex-col items-center pt-6">
      {/* vertical connector into this node */}
      <span
        aria-hidden
        className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-slate-300"
      />
      <NodeCard node={node} />
      {kids.length > 0 ? (
        <ul
          className={cn(
            "relative mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2",
            // horizontal bar above children
            "before:absolute before:left-[12.5%] before:right-[12.5%] before:top-0 before:h-px before:bg-slate-300",
            kids.length === 1 && "before:hidden",
          )}
        >
          {kids.map((child) => (
            <OrgBranch key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Classic top-down org chart tree (HTML/CSS connectors). */
export function OrgChartTree({
  root,
  className,
}: {
  root: OrgChartNode;
  className?: string;
}) {
  const kids = root.children ?? [];
  return (
    <div className={cn("overflow-x-auto pb-4", className)}>
      <ul className="flex min-w-min flex-col items-center px-4">
        <li className="flex flex-col items-center">
          <NodeCard node={root} />
          {kids.length > 0 ? (
            <>
              <span aria-hidden className="h-6 w-px bg-slate-300" />
              <ul
                className={cn(
                  "relative flex flex-wrap justify-center gap-x-4 gap-y-2",
                  "before:absolute before:left-[12.5%] before:right-[12.5%] before:top-0 before:h-px before:bg-slate-300",
                  kids.length === 1 && "before:hidden",
                )}
              >
                {kids.map((child) => (
                  <OrgBranch key={child.id} node={child} />
                ))}
              </ul>
            </>
          ) : null}
        </li>
      </ul>
    </div>
  );
}

/** Forest of roots (e.g. final + third-place match trees). */
export function OrgChartForest({
  roots,
  emptyLabel,
  className,
}: {
  roots: OrgChartNode[];
  emptyLabel: string;
  className?: string;
}) {
  if (roots.length === 0) {
    return (
      <p className={cn("px-4 py-8 text-center text-sm text-slate-500", className)}>
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className={cn("space-y-10", className)}>
      {roots.map((root) => (
        <OrgChartTree key={root.id} root={root} />
      ))}
    </div>
  );
}
