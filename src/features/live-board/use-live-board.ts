"use client";

import { useEffect, useState } from "react";
import type { LiveBoardSnapshot } from "@/application/services/dashboard-service";

export type LiveConnectionState = "connecting" | "live" | "polling" | "error";

/**
 * Prefer SSE (~1s push) on the public live API. Fall back to JSON polling.
 */
export function useLiveBoard(
  slug: string,
  initialBoard: LiveBoardSnapshot,
): {
  board: LiveBoardSnapshot;
  connection: LiveConnectionState;
} {
  const [board, setBoard] = useState(initialBoard);
  const [connection, setConnection] =
    useState<LiveConnectionState>("connecting");

  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollId: number | null = null;
    let fallbackTimer: number | null = null;
    let receivedBoard = false;

    const clearFallback = () => {
      if (fallbackTimer != null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const stopPoll = () => {
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const snapshotUrl = `/api/public/t/${encodeURIComponent(slug)}/live`;
    const streamUrl = `/api/public/t/${encodeURIComponent(slug)}/live/stream`;

    const fetchSnapshot = async () => {
      const res = await fetch(snapshotUrl, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`live ${res.status}`);
      }
      const next = (await res.json()) as LiveBoardSnapshot;
      if (!cancelled) {
        setBoard(next);
      }
    };

    const startPolling = () => {
      clearFallback();
      stopPoll();
      if (source) {
        source.close();
        source = null;
      }
      if (cancelled) return;
      setConnection("polling");
      void fetchSnapshot().catch(() => {
        if (!cancelled) setConnection("error");
      });
      pollId = window.setInterval(() => {
        void fetchSnapshot().catch(() => {
          if (!cancelled) setConnection("error");
        });
      }, 2_000);
    };

    const startSse = () => {
      clearFallback();
      stopPoll();
      receivedBoard = false;
      setConnection("connecting");
      source = new EventSource(streamUrl);

      fallbackTimer = window.setTimeout(() => {
        if (!cancelled && !receivedBoard) {
          startPolling();
        }
      }, 4_000);

      source.addEventListener("board", (event) => {
        receivedBoard = true;
        clearFallback();
        try {
          const next = JSON.parse(
            (event as MessageEvent).data as string,
          ) as LiveBoardSnapshot;
          if (!cancelled) {
            setBoard(next);
            setConnection("live");
          }
        } catch {
          if (!cancelled) setConnection("error");
        }
      });

      source.onerror = () => {
        if (cancelled) return;
        if (source && source.readyState === EventSource.CLOSED) {
          startPolling();
          return;
        }
        setConnection("connecting");
        clearFallback();
        fallbackTimer = window.setTimeout(() => {
          if (!cancelled && !receivedBoard) {
            startPolling();
          }
        }, 5_000);
      };
    };

    if (typeof EventSource === "undefined") {
      startPolling();
    } else {
      startSse();
    }

    return () => {
      cancelled = true;
      clearFallback();
      stopPoll();
      source?.close();
    };
  }, [slug]);

  return { board, connection };
}
