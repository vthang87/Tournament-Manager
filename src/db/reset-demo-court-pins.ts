import { eq, like } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { encryptCourtPin } from "@/lib/auth/court-pin-crypto";
import { hashPassword } from "@/lib/auth/password";
import { createDb } from "./client";
import { loadLocalEnv } from "./load-local-env";
import { courts, tournaments } from "./schema";

loadLocalEnv();

async function resetDemoCourtPins(): Promise<void> {
  const { db, pool } = createDb();
  try {
    const demoCourts = await db
      .select({
        id: courts.id,
        code: courts.code,
        tournamentName: tournaments.name,
      })
      .from(courts)
      .innerJoin(tournaments, eq(courts.tournamentId, tournaments.id))
      .where(like(tournaments.id, "seed-%"));

    for (const court of demoCourts) {
      const pin = String(randomInt(1000, 10_000));
      await db
        .update(courts)
        .set({
          accessPinHash: await hashPassword(pin),
          accessPinEncrypted: encryptCourtPin(pin),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(courts.id, court.id));
    }

    console.log(`Reset PIN for ${demoCourts.length} demo courts.`);
  } finally {
    await pool.end();
  }
}

resetDemoCourtPins().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
