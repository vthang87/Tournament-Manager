import { NextResponse } from "next/server";
import { NotFoundError } from "@/application/errors";
import { DashboardService } from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { liveBoardFingerprint } from "@/features/live-board/live-board-fingerprint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 1_000;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Public SSE live board stream (no auth). */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const db = getDb();
  const tournament = await new DrizzleTournamentRepository(db).findBySlug(slug);
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tournamentId = tournament.id;
  const encoder = new TextEncoder();
  let lastFingerprint = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const ping = () => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      };

      try {
        while (!request.signal.aborted) {
          const board = await new DashboardService(getDb()).liveBoard(
            tournamentId,
          );
          const fingerprint = liveBoardFingerprint(board);
          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            send("board", board);
          } else {
            ping();
          }
          await sleep(POLL_MS, request.signal);
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          try {
            send("error", {
              message: err instanceof Error ? err.message : "stream error",
            });
          } catch {
            // closed
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
