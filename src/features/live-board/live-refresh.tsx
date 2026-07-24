"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft poll for TV/live boards. Respects prefers-reduced-motion (slower). */
export function LiveRefresh({ intervalMs = 12_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? Math.max(intervalMs * 2, 30_000) : intervalMs;
    const id = window.setInterval(() => {
      router.refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
