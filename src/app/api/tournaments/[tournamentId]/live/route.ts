import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/application/errors";
import { DashboardService } from "@/application/services";
import { getDb } from "@/db/client";
import { assertRole, getCurrentUser } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";

const LIVE_ROLES = [
  "ADMIN",
  "OPERATOR",
  "SCOREKEEPER",
  "VIEWER",
] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    assertRole(user, [...LIVE_ROLES]);

    const { tournamentId } = await context.params;
    const board = await new DashboardService(getDb()).liveBoard(tournamentId);
    return NextResponse.json(board, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }
}
