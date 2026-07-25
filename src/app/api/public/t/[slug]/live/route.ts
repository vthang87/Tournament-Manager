import { NextResponse } from "next/server";
import { NotFoundError } from "@/application/errors";
import { DashboardService } from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";

export const dynamic = "force-dynamic";

/** Public read-only live board snapshot (no auth). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const tournament = await new DrizzleTournamentRepository(db).findBySlug(
      slug,
    );
    if (!tournament) {
      throw new NotFoundError(`Tournament ${slug} not found`);
    }
    const board = await new DashboardService(db).liveBoard(tournament.id);
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
