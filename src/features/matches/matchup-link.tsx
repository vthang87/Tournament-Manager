import Link from "next/link";
import { cn } from "@/lib/utils";

/** Winner = sky on light UI / emerald on dark live board; loser = slate gray. */
export function matchSideClass(
  entryId: string | null | undefined,
  winnerEntryId: string | null | undefined,
  tone: "light" | "dark" = "light",
): string {
  if (!winnerEntryId || !entryId) {
    return "";
  }
  if (entryId === winnerEntryId) {
    return tone === "dark" ? "text-emerald-300" : "text-sky-700";
  }
  return tone === "dark" ? "text-slate-500" : "text-slate-400";
}

export function MatchupLink({
  href,
  labelA,
  labelB,
  entryAId,
  entryBId,
  winnerEntryId,
  vsLabel,
}: {
  href: string;
  labelA: string;
  labelB: string;
  entryAId: string | null | undefined;
  entryBId: string | null | undefined;
  winnerEntryId: string | null | undefined;
  vsLabel: string;
}) {
  return (
    <Link
      href={href}
      className="font-medium underline-offset-2 hover:underline"
    >
      <span className={cn(matchSideClass(entryAId, winnerEntryId))}>
        {labelA}
      </span>{" "}
      <span className="font-normal text-slate-400 no-underline">{vsLabel}</span>{" "}
      <span className={cn(matchSideClass(entryBId, winnerEntryId))}>
        {labelB}
      </span>
    </Link>
  );
}
