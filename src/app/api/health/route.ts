import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute(sql`select 1 as ok`);
    const row = result.rows[0] as { ok: number } | undefined;
    return NextResponse.json({
      status: "ok",
      database: row?.ok === 1 ? "up" : "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      { status: "error", message },
      { status: 503 },
    );
  }
}
