"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function remainingSeconds(targetIso: string, nowMs: number): number {
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.round((target - nowMs) / 1000));
}

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Live mm:ss countdown to a target time. Renders `readyLabel` once elapsed.
 * `suppressHydrationWarning` covers the expected server/client clock skew.
 */
export function CountdownTimer({
  target,
  readyLabel,
  className,
  onElapsed,
}: {
  target: string;
  readyLabel: string;
  className?: string;
  onElapsed?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secs = remainingSeconds(target, now);

  useEffect(() => {
    if (secs === 0) {
      onElapsed?.();
    }
  }, [secs, onElapsed]);

  if (secs === 0) {
    return (
      <span className={className} suppressHydrationWarning>
        {readyLabel}
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)} suppressHydrationWarning>
      {formatClock(secs)}
    </span>
  );
}
