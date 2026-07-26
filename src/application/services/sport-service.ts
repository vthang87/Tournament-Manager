import { asc, eq } from "drizzle-orm";
import { NotFoundError } from "@/application/errors";
import type { Sport } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { sports } from "@/db/schema";

function mapSport(row: typeof sports.$inferSelect): Sport {
  return row;
}

export class SportService {
  constructor(private readonly db: AppDatabase) {}

  async listActive(): Promise<Sport[]> {
    const rows = await this.db
      .select()
      .from(sports)
      .where(eq(sports.active, true))
      .orderBy(asc(sports.name));
    return rows.map(mapSport);
  }

  async getById(id: string): Promise<Sport> {
    const [row] = await this.db
      .select()
      .from(sports)
      .where(eq(sports.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Sport ${id} not found`);
    }
    return mapSport(row);
  }
}
