import { NextResponse } from "next/server";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/application/errors";
import {
  DashboardService,
  TournamentAccessService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { liveBoardFingerprint } from "@/features/live-board/live-board-fingerprint";
import { assertRole, getCurrentUser } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIVE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATOR",
  "SCOREKEEPER",
  "VIEWER",
] as const;

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

export async function GET(
  request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  const { tournamentId } = await context.params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    assertRole(user, [...LIVE_ROLES]);
    await new TournamentAccessService(getDb()).resolve(
      { userId: user.id, role: user.role },
      tournamentId,
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }

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
            // controller may already be closed
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // request.signal abort handles loop exit
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
