"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatClubLabel,
  orderPlacementsForCeremony,
  type CeremonyPlacement,
} from "@/features/draw/lib/ceremony-order";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export type CeremonyGroup = {
  id: string;
  name: string;
  code: string;
};

export type { CeremonyPlacement };

type Props = {
  open: boolean;
  groups: CeremonyGroup[];
  placements: CeremonyPlacement[];
  onComplete: () => void;
  onSkip: () => void;
};

type Phase = "intro" | "drawing" | "done";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Slightly faster as the draw progresses so large fields don't drag. */
function paceForIndex(i: number, total: number) {
  const t = total <= 1 ? 1 : i / (total - 1);
  return {
    shuffleTicks: Math.round(gsap.utils.interpolate(10, 5, t)),
    tickGap: gsap.utils.interpolate(0.055, 0.032, t),
    hold: gsap.utils.interpolate(0.42, 0.22, t),
    gap: gsap.utils.interpolate(0.28, 0.12, t),
  };
}

export function DrawCeremonyOverlay({
  open,
  groups,
  placements,
  onComplete,
  onSkip,
}: Props) {
  const t = useTranslations("draw");
  const rootRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const shuffleRef = useRef<HTMLParagraphElement>(null);
  const shuffleClubRef = useRef<HTMLParagraphElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState<CeremonyPlacement | null>(null);
  const [filled, setFilled] = useState<Record<string, CeremonyPlacement[]>>({});
  const [index, setIndex] = useState(0);
  const [lastLandedId, setLastLandedId] = useState<string | null>(null);

  const ordered = useMemo(
    () => orderPlacementsForCeremony(placements),
    [placements],
  );

  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  useGSAP(
    () => {
      if (!open || !rootRef.current) return;

      if (prefersReducedMotion()) {
        const all: Record<string, CeremonyPlacement[]> = {};
        for (const g of groups) all[g.id] = [];
        for (const p of ordered) {
          all[p.groupId] = [...(all[p.groupId] ?? []), p];
        }
        setFilled(all);
        setPhase("done");
        setCurrent(null);
        setIndex(ordered.length);
        return;
      }

      setPhase("intro");
      setCurrent(null);
      setFilled(Object.fromEntries(groups.map((g) => [g.id, []])));
      setIndex(0);
      setLastLandedId(null);

      const root = rootRef.current;
      const particles = root.querySelectorAll("[data-particle]");
      gsap.set(particles, {
        x: () => gsap.utils.random(-40, 40),
        y: () => gsap.utils.random(-20, 20),
        opacity: () => gsap.utils.random(0.15, 0.45),
        scale: () => gsap.utils.random(0.4, 1.2),
      });
      gsap.to(particles, {
        y: "-=28",
        x: "+=12",
        duration: () => gsap.utils.random(3.5, 6),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: { each: 0.12, from: "random" },
      });

      gsap.to("[data-orb]", {
        x: "+=30",
        y: "-=20",
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 1.2,
      });

      const tl = gsap.timeline();
      tl.fromTo(
        root,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power2.out" },
      );
      tl.fromTo(
        "[data-ceremony-beam]",
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.7, ease: "power3.out" },
        0.05,
      );
      tl.fromTo(
        "[data-ceremony-title]",
        { y: 36, opacity: 0, rotateX: -18 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.7,
          ease: "power3.out",
        },
        0.12,
      );
      tl.fromTo(
        "[data-ceremony-sub]",
        { y: 14, opacity: 0, letterSpacing: "0.45em" },
        {
          y: 0,
          opacity: 1,
          letterSpacing: "0.22em",
          duration: 0.55,
          ease: "power2.out",
        },
        0.28,
      );
      tl.fromTo(
        "[data-ceremony-group]",
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.055,
          ease: "power2.out",
          // Avoid lingering transforms — they stack/cover neighbors at browser zoom.
          clearProps: "transform",
          force3D: false,
        },
        0.42,
      );
      tl.fromTo(
        spotlightRef.current,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power3.out",
          clearProps: "transform",
          force3D: false,
        },
        0.55,
      );
      tl.add(() => {
        setPhase("drawing");
        runDrawSequence();
      }, "+=0.55");

      return () => {
        tl.kill();
      };

      function flyNameToGroup(placement: CeremonyPlacement) {
        const fromEl = reelRef.current;
        const toEl = root.querySelector(
          `[data-group-slot="${placement.groupId}"]`,
        );
        if (!fromEl || !toEl || !root) return;

        const from = fromEl.getBoundingClientRect();
        const to = toEl.getBoundingClientRect();
        const clone = document.createElement("div");
        clone.className =
          "pointer-events-none fixed z-[60] max-w-[16rem] rounded-xl border border-emerald-300/50 bg-emerald-950/90 px-3 py-1.5 text-left shadow-[0_0_24px_rgba(16,185,129,0.35)]";
        const nameEl = document.createElement("p");
        nameEl.className =
          "truncate text-sm font-semibold text-emerald-50";
        nameEl.textContent = placement.displayName;
        clone.appendChild(nameEl);
        if (placement.clubCode || placement.clubName) {
          const clubEl = document.createElement("p");
          clubEl.className = "truncate text-[10px] text-emerald-200/80";
          clubEl.textContent =
            formatClubLabel(placement.clubCode, placement.clubName) ?? "";
          clone.appendChild(clubEl);
        }
        clone.style.left = `${from.left}px`;
        clone.style.top = `${from.top}px`;
        clone.style.width = `${Math.min(from.width, 240)}px`;
        document.body.appendChild(clone);

        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + 28 - (from.top + from.height / 2);

        gsap.to(clone, {
          x: dx,
          y: dy,
          scale: 0.55,
          opacity: 0.15,
          duration: 0.55,
          ease: "power3.in",
          onComplete: () => clone.remove(),
        });
      }

      function burstConfetti() {
        const host = confettiRef.current;
        if (!host) return;
        host.innerHTML = "";
        const colors = ["#34d399", "#fbbf24", "#38bdf8", "#f472b6", "#a3e635"];
        for (let i = 0; i < 36; i++) {
          const bit = document.createElement("span");
          bit.className = "absolute h-2 w-2 rounded-sm";
          bit.style.background =
            colors[i % colors.length] ?? colors[0]!;
          bit.style.left = "50%";
          bit.style.top = "40%";
          host.appendChild(bit);
          gsap.fromTo(
            bit,
            { x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 },
            {
              x: gsap.utils.random(-180, 180),
              y: gsap.utils.random(-40, 220),
              rotate: gsap.utils.random(-180, 180),
              opacity: 0,
              scale: gsap.utils.random(0.4, 1.2),
              duration: gsap.utils.random(0.7, 1.35),
              ease: "power2.out",
              delay: gsap.utils.random(0, 0.15),
            },
          );
        }
      }

      function runDrawSequence() {
        let i = 0;
        const filledLocal: Record<string, CeremonyPlacement[]> =
          Object.fromEntries(groups.map((g) => [g.id, []]));

        const revealNext = () => {
          if (i >= ordered.length) {
            setPhase("done");
            setCurrent(null);
            setIndex(ordered.length);
            burstConfetti();
            gsap.fromTo(
              "[data-ceremony-done]",
              { opacity: 0, y: 12 },
              {
                opacity: 1,
                y: 0,
                duration: 0.5,
                ease: "power3.out",
                clearProps: "transform",
                force3D: false,
              },
            );
            gsap.fromTo(
              "[data-group-ring]",
              { opacity: 0, borderColor: "rgba(52,211,153,0)" },
              {
                opacity: 1,
                borderColor: "rgba(52,211,153,0.9)",
                duration: 0.35,
                stagger: 0.04,
                yoyo: true,
                repeat: 1,
                ease: "power1.inOut",
                clearProps: "opacity,borderColor",
              },
            );
            return;
          }

          const placement = ordered[i]!;
          const pace = paceForIndex(i, ordered.length);
          setCurrent(placement);
          setIndex(i + 1);

          if (progressRef.current) {
            gsap.to(progressRef.current, {
              width: `${((i + 1) / ordered.length) * 100}%`,
              duration: 0.35,
              ease: "power2.out",
            });
          }

          if (spotlightRef.current) {
            gsap.fromTo(
              spotlightRef.current,
              { opacity: 0.92 },
              { opacity: 1, duration: 0.3, ease: "power2.out" },
            );
          }

          const placementsPool = ordered
            .slice(i)
            .concat(ordered.slice(0, Math.min(12, Math.max(i, 1))));

          const shuffleTl = gsap.timeline({
            onComplete: () => {
              filledLocal[placement.groupId] = [
                ...(filledLocal[placement.groupId] ?? []),
                placement,
              ];
              setFilled(
                Object.fromEntries(
                  Object.entries(filledLocal).map(([k, v]) => [k, [...v]]),
                ),
              );
              setLastLandedId(placement.entryId);
              flyNameToGroup(placement);

              gsap.delayedCall(0.14, () => {
                const landed = root.querySelector(
                  `[data-entry-chip="${placement.entryId}"]`,
                );
                if (landed) {
                  gsap.fromTo(
                    landed,
                    { opacity: 0, y: -6 },
                    {
                      opacity: 1,
                      y: 0,
                      duration: 0.35,
                      ease: "power2.out",
                      clearProps: "transform",
                      force3D: false,
                    },
                  );
                }
              });

              if (spotlightRef.current) {
                gsap.fromTo(
                  spotlightRef.current,
                  {
                    filter: "brightness(1.25)",
                    boxShadow: "0 0 0 0 rgba(52,211,153,0.45)",
                  },
                  {
                    filter: "brightness(1)",
                    boxShadow: "0 0 0 0 rgba(52,211,153,0)",
                    duration: 0.5,
                    ease: "power2.out",
                  },
                );
              }

              const ring = root.querySelector(
                `[data-group-ring="${placement.groupId}"]`,
              );
              if (ring) {
                gsap.killTweensOf(ring);
                gsap.fromTo(
                  ring,
                  { opacity: 1, borderColor: "rgba(52,211,153,1)" },
                  {
                    opacity: 0.85,
                    borderColor: "rgba(52,211,153,0.75)",
                    duration: 0.65,
                    ease: "power2.out",
                    // Hand control back to React class (isTarget) so rings aren't stuck/clipped.
                    clearProps: "opacity,borderColor",
                  },
                );
              }

              i += 1;
              gsap.delayedCall(pace.gap, revealNext);
            },
          });

          if (shuffleRef.current && placementsPool.length > 0) {
            if (reelRef.current) {
              gsap.fromTo(
                reelRef.current,
                { filter: "blur(6px)", scale: 1.04 },
                {
                  filter: "blur(0px)",
                  scale: 1,
                  duration: pace.shuffleTicks * pace.tickGap + 0.2,
                  ease: "power2.in",
                },
              );
            }

            for (let tick = 0; tick < pace.shuffleTicks; tick++) {
              const candidate =
                placementsPool[
                  Math.floor(Math.random() * placementsPool.length)
                ]!;
              shuffleTl.call(
                () => {
                  if (shuffleRef.current) {
                    shuffleRef.current.textContent = candidate.displayName;
                  }
                  if (shuffleClubRef.current) {
                    shuffleClubRef.current.textContent =
                      formatClubLabel(
                        candidate.clubCode,
                        candidate.clubName,
                      ) ?? t("ceremonyNoClub");
                  }
                  if (reelRef.current) {
                    gsap.fromTo(
                      reelRef.current,
                      { y: 10, opacity: 0.55 },
                      { y: 0, opacity: 1, duration: 0.05, ease: "none" },
                    );
                  }
                },
                [],
                tick * pace.tickGap,
              );
            }

            shuffleTl.call(() => {
              if (shuffleRef.current) {
                shuffleRef.current.textContent = placement.displayName;
              }
              if (shuffleClubRef.current) {
                shuffleClubRef.current.textContent =
                  formatClubLabel(
                    placement.clubCode,
                    placement.clubName,
                  ) ?? t("ceremonyNoClub");
              }
            });

            shuffleTl.fromTo(
              reelRef.current,
              { scale: 1.18, filter: "brightness(1.4)" },
              {
                scale: 1,
                filter: "brightness(1)",
                duration: 0.45,
                ease: "back.out(2.2)",
              },
            );
            shuffleTl.to({}, { duration: pace.hold });
          } else {
            shuffleTl.to({}, { duration: 0.12 });
          }
        };

        revealNext();
      }
    },
    {
      dependencies: [open, ordered, groups],
      scope: rootRef,
      revertOnUpdate: true,
    },
  );

  if (!open) return null;

  const progress =
    ordered.length === 0 ? 1 : Math.min(1, index / ordered.length);
  const currentGroup = current
    ? (groupById.get(current.groupId) ?? null)
    : null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#05080f] text-slate-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-ceremony-title"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          data-orb
          className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-[100px]"
        />
        <div
          data-orb
          className="absolute -right-24 bottom-0 h-[30rem] w-[30rem] rounded-full bg-amber-500/10 blur-[110px]"
        />
        <div
          data-orb
          className="absolute left-1/3 top-1/4 h-64 w-64 rounded-full bg-sky-500/10 blur-[80px]"
        />
        <div
          data-ceremony-beam
          className="absolute left-1/2 top-0 h-px w-[min(90vw,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
        />
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            data-particle
            className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-white/40"
            style={{
              marginLeft: `${((i * 47) % 90) - 45}vw`,
              marginTop: `${((i * 31) % 70) - 35}vh`,
            }}
          />
        ))}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div
        ref={confettiRef}
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
        aria-hidden
      />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md md:px-8">
        <div>
          <p
            data-ceremony-sub
            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90"
          >
            {t("ceremonyLive")}
          </p>
          <h2
            id="draw-ceremony-title"
            data-ceremony-title
            className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-4xl"
          >
            {t("ceremonyTitle")}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <div className="h-2 w-44 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
              <div
                ref={progressRef}
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-amber-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs tabular-nums text-slate-400">
              {index}/{ordered.length}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            onClick={onSkip}
          >
            {t("ceremonySkip")}
          </Button>
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_min(380px,38%)] md:gap-6 md:p-8">
        <div className="min-h-0 overflow-auto pr-1">
          <div className="grid items-start gap-4 p-1 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map((group) => {
              const slots = filled[group.id] ?? [];
              const isTarget = current?.groupId === group.id;
              return (
                <div
                  key={group.id}
                  data-ceremony-group
                  data-group-slot={group.id}
                  className={cn(
                    "relative overflow-visible",
                    isTarget ? "z-30" : "z-0",
                  )}
                >
                  {/* Outer ring sits outside the card so it isn't clipped by overflow */}
                  <div
                    data-group-ring={group.id}
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -inset-[3px] rounded-[1.2rem] border-2 transition-[opacity,border-color] duration-300",
                      isTarget
                        ? "border-emerald-400 opacity-100 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                        : "border-emerald-400/0 opacity-0",
                    )}
                  />
                  <div
                    className={cn(
                      "relative rounded-2xl border bg-slate-950/90 p-3 shadow-lg transition-[border-color,background-color] duration-300",
                      isTarget
                        ? "border-emerald-400/80 bg-emerald-950/40"
                        : "border-white/10",
                    )}
                  >
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold tracking-tight text-white">
                        {group.name}
                      </p>
                      <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        {group.code}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {slots.map((slot) => (
                        <li
                          key={slot.entryId}
                          data-entry-chip={slot.entryId}
                          data-landed={
                            slot.entryId === lastLandedId ? "1" : undefined
                          }
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                            slot.entryId === lastLandedId
                              ? "border-emerald-400/50 bg-emerald-400/25"
                              : "border-emerald-500/15 bg-emerald-500/10",
                          )}
                        >
                          <p className="truncate font-medium text-emerald-50">
                            {slot.displayName}
                          </p>
                          <p className="truncate text-[10px] font-medium text-sky-200/90">
                            {formatClubLabel(slot.clubCode, slot.clubName) ??
                              t("ceremonyNoClub")}
                          </p>
                          <p className="text-[10px] text-emerald-200/60">
                            {slot.seed != null
                              ? t("seedLabel", { seed: slot.seed })
                              : t("unseeded")}
                          </p>
                        </li>
                      ))}
                      {slots.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-white/10 px-2 py-5 text-center text-[11px] text-slate-500">
                          {t("ceremonyWaiting")}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="flex flex-col justify-center">
          <div
            ref={spotlightRef}
            className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-slate-800/95 via-slate-900 to-[#071018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />

            {phase === "intro" ? (
              <div className="space-y-3 py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-300" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("ceremonyPreparing")}
                </p>
                <p className="text-2xl font-semibold tracking-tight">
                  {t("ceremonyShuffling")}
                </p>
              </div>
            ) : null}

            {phase === "drawing" && current ? (
              <div className="space-y-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
                  {t("ceremonyDrawing")}
                </p>
                <div ref={reelRef} className="space-y-3">
                  <div className="relative mx-auto min-h-[4.5rem] overflow-hidden rounded-2xl border border-white/10 bg-black/35 px-3 py-4">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/70 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/70 to-transparent" />
                    <p
                      ref={shuffleRef}
                      className="text-xl font-bold leading-snug tracking-tight text-white md:text-2xl"
                    >
                      {current.displayName}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/80">
                      {t("ceremonyClub")}
                    </p>
                    <p
                      ref={shuffleClubRef}
                      className="mt-1 text-base font-bold tracking-wide text-sky-100"
                    >
                      {formatClubLabel(current.clubCode, current.clubName) ??
                        t("ceremonyNoClub")}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">
                    {t("ceremonyIntoGroup")}
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-emerald-300">
                    {currentGroup?.name ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {current.seed != null ? (
                    <p className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-medium text-amber-200">
                      {t("seedLabel", { seed: current.seed })}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">{t("unseeded")}</p>
                  )}
                </div>
              </div>
            ) : null}

            {phase === "done" ? (
              <div data-ceremony-done className="space-y-5 py-2 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/15 text-2xl">
                  ✓
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
                  {t("ceremonyDone")}
                </p>
                <p className="text-2xl font-bold tracking-tight md:text-3xl">
                  {t("ceremonyDoneBody", { count: ordered.length })}
                </p>
                <p className="text-sm text-slate-400">{t("ceremonyDoneHint")}</p>
                <Button
                  type="button"
                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  onClick={onComplete}
                >
                  {t("ceremonyViewResults")}
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
