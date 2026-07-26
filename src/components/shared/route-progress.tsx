"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const COMPLETE_DELAY_MS = 180;
const FAILSAFE_DELAY_MS = 12_000;

function isInternalNavigation(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download")
  ) {
    return false;
  }

  const destination = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);

  return (
    destination.origin === current.origin &&
    `${destination.pathname}${destination.search}` !==
      `${current.pathname}${current.search}`
  );
}

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barRef = useRef<HTMLDivElement>(null);
  const incrementTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (incrementTimerRef.current) clearInterval(incrementTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
    incrementTimerRef.current = null;
    hideTimerRef.current = null;
    failsafeTimerRef.current = null;
  }, []);

  const finish = useCallback(() => {
    const bar = barRef.current;
    if (!bar || bar.dataset.state !== "loading") return;

    clearTimers();
    progressRef.current = 100;
    bar.style.setProperty("--route-progress", "100%");
    bar.dataset.state = "complete";
    hideTimerRef.current = setTimeout(() => {
      bar.dataset.state = "idle";
      progressRef.current = 0;
      bar.style.setProperty("--route-progress", "0%");
    }, COMPLETE_DELAY_MS);
  }, [clearTimers]);

  const start = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;

    clearTimers();
    progressRef.current = 12;
    bar.style.setProperty("--route-progress", "12%");
    bar.dataset.state = "loading";

    incrementTimerRef.current = setInterval(() => {
      const remaining = 90 - progressRef.current;
      progressRef.current += Math.max(0.7, remaining * 0.08);
      bar.style.setProperty(
        "--route-progress",
        `${Math.min(progressRef.current, 90)}%`,
      );
    }, 240);

    failsafeTimerRef.current = setTimeout(finish, FAILSAFE_DELAY_MS);
  }, [clearTimers, finish]);

  useEffect(() => {
    const completeNavigation = window.requestAnimationFrame(finish);
    return () => window.cancelAnimationFrame(completeNavigation);
  }, [pathname, searchParams, finish]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (anchor && isInternalNavigation(event, anchor)) start();
    };

    const handlePopState = () => start();

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [clearTimers, start]);

  return (
    <div
      ref={barRef}
      className="route-progress"
      data-state="idle"
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}
