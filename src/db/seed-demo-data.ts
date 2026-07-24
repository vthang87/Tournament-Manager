/**
 * Demo fixture: 1 doubles event with 32 teams (8 seeds) across 12 clubs.
 * Idempotent — safe to re-run with `pnpm db:seed`.
 */

import { and, eq, like } from "drizzle-orm";
import type { AppDatabase } from "./client";
import { SEED_IDS } from "./seed-ids";
import {
  clubs,
  entries,
  entryMembers,
  players,
  tournamentEvents,
  tournaments,
} from "./schema";
import { nowIso } from "@/lib/id";

const CLUB_DEFS = [
  { id: "seed-club-01", name: "Sài Gòn Smashers", shortName: "SGS" },
  { id: "seed-club-02", name: "Thủ Đức Ace", shortName: "TDA" },
  { id: "seed-club-03", name: "Bình Thạnh Shuttle", shortName: "BTS" },
  { id: "seed-club-04", name: "Quận 7 Lightning", shortName: "Q7L" },
  { id: "seed-club-05", name: "Phú Nhuận Netters", shortName: "PNN" },
  { id: "seed-club-06", name: "Gò Vấp Smash", shortName: "GVS" },
  { id: "seed-club-07", name: "Tân Bình Flight", shortName: "TBF" },
  { id: "seed-club-08", name: "District 1 Dynamos", shortName: "D1D" },
  { id: "seed-club-09", name: "Cần Giờ Coast", shortName: "CGC" },
  { id: "seed-club-10", name: "Bình Dương Blaze", shortName: "BDB" },
  { id: "seed-club-11", name: "Đồng Nai Drive", shortName: "DND" },
  { id: "seed-club-12", name: "Vũng Tàu Volt", shortName: "VTV" },
] as const;

/** First names + last names for 64 male doubles players. */
const FIRST_NAMES = [
  "Minh",
  "Hoàng",
  "Khoa",
  "Đức",
  "Phúc",
  "Huy",
  "Long",
  "Nam",
  "Quân",
  "Tuấn",
  "Việt",
  "Anh",
  "Bảo",
  "Cường",
  "Dũng",
  "Hải",
  "Khải",
  "Lâm",
  "Phong",
  "Quang",
  "Sơn",
  "Thành",
  "Trí",
  "Vinh",
  "Xuân",
  "Yên",
  "Đạt",
  "Hùng",
  "Kiên",
  "Nhân",
  "Phát",
  "Tài",
] as const;

const LAST_NAMES = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
  "Lý",
] as const;

type EntryDef = {
  id: string;
  displayName: string;
  seed: number | null;
  ranking: number;
  clubIndex: number;
  playerAIndex: number;
  playerBIndex: number;
};

function buildEntryDefs(): EntryDef[] {
  const defs: EntryDef[] = [];
  for (let i = 0; i < 32; i++) {
    const clubIndex = i % CLUB_DEFS.length;
    const playerAIndex = i * 2;
    const playerBIndex = i * 2 + 1;
    const lastA = LAST_NAMES[playerAIndex % LAST_NAMES.length]!;
    const lastB = LAST_NAMES[playerBIndex % LAST_NAMES.length]!;
    const firstA = FIRST_NAMES[playerAIndex % FIRST_NAMES.length]!;
    const firstB = FIRST_NAMES[playerBIndex % FIRST_NAMES.length]!;
    const seed = i < 8 ? i + 1 : null;
    const pad = String(i + 1).padStart(2, "0");
    const seedLabel = seed ? ` [S${seed}]` : "";
    defs.push({
      id: `seed-entry-${pad}`,
      displayName: `${lastA} ${firstA} / ${lastB} ${firstB}${seedLabel}`,
      seed,
      ranking: i + 1,
      clubIndex,
      playerAIndex,
      playerBIndex,
    });
  }
  return defs;
}

function playerName(index: number): { name: string; displayName: string } {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const last = LAST_NAMES[index % LAST_NAMES.length]!;
  // Disambiguate when names cycle
  const suffix = index >= 32 ? ` ${Math.floor(index / 32) + 1}` : "";
  const name = `${last} ${first}${suffix}`;
  return { name, displayName: name };
}

async function upsertClubs(db: AppDatabase): Promise<void> {
  const now = nowIso();
  for (const club of CLUB_DEFS) {
    const existing = await db
      .select()
      .from(clubs)
      .where(eq(clubs.id, club.id))
      .limit(1);

    const values = {
      id: club.id,
      name: club.name,
      shortName: club.shortName,
      logoUrl: null as string | null,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(clubs).set(values).where(eq(clubs.id, club.id));
    } else {
      await db.insert(clubs).values({ ...values, createdAt: now });
    }
  }
}

async function upsertPlayers(db: AppDatabase): Promise<void> {
  const now = nowIso();
  for (let i = 0; i < 64; i++) {
    const pad = String(i + 1).padStart(3, "0");
    const id = `seed-player-${pad}`;
    const { name, displayName } = playerName(i);
    const clubId = CLUB_DEFS[i % CLUB_DEFS.length]!.id;

    const existing = await db
      .select()
      .from(players)
      .where(eq(players.id, id))
      .limit(1);

    const values = {
      id,
      name,
      displayName,
      gender: "MALE" as const,
      dateOfBirth: null as string | null,
      phone: null as string | null,
      email: null as string | null,
      clubId,
      ranking: i + 1,
      metadataJson: null as string | null,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(players).set(values).where(eq(players.id, id));
    } else {
      await db.insert(players).values({ ...values, createdAt: now });
    }
  }
}

async function upsertEntries(db: AppDatabase): Promise<void> {
  const now = nowIso();
  const defs = buildEntryDefs();

  for (const def of defs) {
    const clubId = CLUB_DEFS[def.clubIndex]!.id;
    const playerAId = `seed-player-${String(def.playerAIndex + 1).padStart(3, "0")}`;
    const playerBId = `seed-player-${String(def.playerBIndex + 1).padStart(3, "0")}`;

    const existing = await db
      .select()
      .from(entries)
      .where(eq(entries.id, def.id))
      .limit(1);

    const values = {
      id: def.id,
      eventId: SEED_IDS.eventMensDoubles,
      displayName: def.displayName,
      seed: def.seed,
      ranking: def.ranking,
      clubId,
      status: "ACTIVE" as const,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(entries).set(values).where(eq(entries.id, def.id));
    } else {
      await db.insert(entries).values({ ...values, createdAt: now });
    }

    await db.delete(entryMembers).where(eq(entryMembers.entryId, def.id));
    await db.insert(entryMembers).values([
      { entryId: def.id, playerId: playerAId, position: 1 },
      { entryId: def.id, playerId: playerBId, position: 2 },
    ]);
  }

  // Remove stale seed entries beyond the 32-team fixture if any existed.
  const seeded = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.eventId, SEED_IDS.eventMensDoubles),
        like(entries.id, "seed-entry-%"),
      ),
    );
  const keep = new Set(defs.map((d) => d.id));
  for (const row of seeded) {
    if (!keep.has(row.id)) {
      await db.delete(entryMembers).where(eq(entryMembers.entryId, row.id));
      await db.delete(entries).where(eq(entries.id, row.id));
    }
  }
}

async function markDemoReady(db: AppDatabase): Promise<void> {
  const now = nowIso();

  await db
    .update(tournaments)
    .set({
      status: "DRAW",
      description:
        "Demo tournament: 32 men's doubles teams, 8 seeds, 4 courts. Ready to draw (8 groups × 4).",
      updatedAt: now,
    })
    .where(eq(tournaments.id, SEED_IDS.tournament));

  await db
    .update(tournamentEvents)
    .set({
      status: "DRAW_READY",
      thirdPlaceMatchEnabled: true,
      updatedAt: now,
    })
    .where(eq(tournamentEvents.id, SEED_IDS.eventMensDoubles));
}

export async function seedDemoTournament(db: AppDatabase): Promise<void> {
  await upsertClubs(db);
  await upsertPlayers(db);
  await upsertEntries(db);
  await markDemoReady(db);
}
