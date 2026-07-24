import { NextResponse } from "next/server";
import { getSqlite } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sqlite = getSqlite();
    const row = sqlite.prepare("select 1 as ok").get() as { ok: number };
    return NextResponse.json({
      status: "ok",
      database: row.ok === 1 ? "up" : "unknown",
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
