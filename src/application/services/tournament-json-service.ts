import type { Pool, PoolClient, QueryResultRow } from "pg";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type { ActorContext } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import { TournamentAccessService } from "./tournament-access-service";

const FORMAT = "tournament-manager-json";
const VERSION = 1;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_ROWS = 100_000;

const TABLE_ORDER = [
  "clubs",
  "players",
  "player_sports",
  "tournaments",
  "tournament_events",
  "courts",
  "match_rules",
  "stages",
  "stage_rules",
  "standing_rules",
  "schedule_rules",
  "qualification_rules",
  "entries",
  "entry_members",
  "groups",
  "draw_sessions",
  "draw_results",
  "group_entries",
  "matches",
  "match_sets",
] as const;

type TableName = (typeof TABLE_ORDER)[number];
type JsonRow = Record<string, string | number | boolean | null>;

export type TournamentJsonPackage = {
  format: typeof FORMAT;
  version: typeof VERSION;
  exportedAt: string;
  ownerUsername: string;
  tournamentSlug: string;
  tables: Record<TableName, JsonRow[]>;
};

export type TournamentJsonImportResult = {
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  insertedRows: number;
};

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new ValidationError(`Unsafe JSON field: ${value}`);
  }
  return `"${value}"`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function rows<T extends QueryResultRow>(
  client: PoolClient,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await client.query<T>(query, params)).rows;
}

export class TournamentJsonService {
  private readonly access: TournamentAccessService;

  constructor(
    db: AppDatabase,
    private readonly pool: Pool,
  ) {
    this.access = new TournamentAccessService(db);
  }

  async exportTournament(
    actor: ActorContext,
    tournamentId: string,
  ): Promise<{ filename: string; json: string }> {
    await this.access.assert(actor, tournamentId, "setup");
    const client = await this.pool.connect();
    try {
      const payload = await this.buildExport(client, tournamentId);
      return {
        filename: `tournament-${payload.tournamentSlug}.json`,
        json: `${JSON.stringify(payload, null, 2)}\n`,
      };
    } finally {
      client.release();
    }
  }

  async importTournament(
    actor: ActorContext,
    input: string | Buffer,
  ): Promise<TournamentJsonImportResult> {
    assertCanPerform(actor.role, "setup");
    const byteLength = Buffer.byteLength(input);
    if (byteLength > MAX_IMPORT_BYTES) {
      throw new ValidationError("Tournament JSON exceeds the 5 MB limit");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.toString());
    } catch {
      throw new ValidationError("Invalid JSON file");
    }
    const payload = await this.validatePackage(parsed);
    const tournament = payload.tables.tournaments[0]!;
    const tournamentId = String(tournament.id);
    const tournamentName = String(tournament.name);
    const tournamentSlug = String(tournament.slug);

    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const conflict = await client.query(
        "select id from tournaments where id = $1 or slug = $2 limit 1",
        [tournamentId, tournamentSlug],
      );
      if (conflict.rowCount) {
        throw new ConflictError(
          `Tournament ID or slug already exists: ${tournamentSlug}`,
        );
      }
      const sport = await client.query(
        "select id from sports where id = $1 limit 1",
        [tournament.sport_id],
      );
      if (!sport.rowCount) {
        throw new ValidationError(
          `Sport does not exist in this system: ${String(tournament.sport_id)}`,
        );
      }

      for (const row of payload.tables.clubs) row.owner_user_id = actor.userId;
      for (const row of payload.tables.players) row.owner_user_id = actor.userId;
      tournament.owner_user_id = actor.userId;
      for (const row of payload.tables.draw_sessions) {
        if (row.created_by != null) row.created_by = actor.userId;
      }

      let insertedRows = 0;
      for (const table of TABLE_ORDER) {
        insertedRows += await this.insertRows(
          client,
          table,
          payload.tables[table],
          table === "clubs" || table === "players" || table === "player_sports",
        );
      }
      await client.query(
        `insert into audit_logs
          (id, user_id, action, entity_type, entity_id, before_json, after_json, metadata_json, created_at)
         values ($1, $2, $3, $4, $5, null, $6, $7, $8)`,
        [
          createId(),
          actor.userId,
          "tournament.json_import",
          "tournament",
          tournamentId,
          JSON.stringify({ name: tournamentName, slug: tournamentSlug }),
          JSON.stringify({ insertedRows }),
          nowIso(),
        ],
      );
      await client.query("commit");
      return { tournamentId, tournamentName, tournamentSlug, insertedRows };
    } catch (error) {
      await client.query("rollback");
      if (error instanceof AppError) throw error;
      throw new ValidationError(
        error instanceof Error
          ? `Could not import tournament JSON: ${error.message}`
          : "Could not import tournament JSON",
      );
    } finally {
      client.release();
    }
  }

  private async buildExport(
    client: PoolClient,
    tournamentId: string,
  ): Promise<TournamentJsonPackage> {
    const [tournament] = await rows<JsonRow>(
      client,
      "select * from tournaments where id = $1 limit 1",
      [tournamentId],
    );
    if (!tournament) throw new NotFoundError(`Tournament ${tournamentId} not found`);
    const [owner] = await rows<{ username: string }>(
      client,
      "select username from users where id = $1 limit 1",
      [tournament.owner_user_id],
    );
    if (!owner) throw new NotFoundError("Tournament owner not found");

    const events = await rows<JsonRow>(client, "select * from tournament_events where tournament_id = $1 order by created_at, id", [tournamentId]);
    const eventIds = events.map((row) => String(row.id));
    const stages = await rows<JsonRow>(client, "select * from stages where event_id = any($1::text[]) order by event_id, order_index", [eventIds]);
    const stageIds = stages.map((row) => String(row.id));
    const entries = await rows<JsonRow>(client, "select * from entries where event_id = any($1::text[]) order by event_id, ranking nulls last, id", [eventIds]);
    const entryIds = entries.map((row) => String(row.id));
    const entryMembers = await rows<JsonRow>(client, "select * from entry_members where entry_id = any($1::text[]) order by entry_id, position", [entryIds]);
    const playerIds = [...new Set(entryMembers.map((row) => String(row.player_id)))];
    const playerSports = await rows<JsonRow>(client, "select * from player_sports where player_id = any($1::text[]) order by player_id, sport_id", [playerIds]);
    const clubIds = [...new Set([...entries, ...playerSports].map((row) => row.club_id).filter((id): id is string => typeof id === "string"))];
    const groups = await rows<JsonRow>(client, "select * from groups where stage_id = any($1::text[]) order by stage_id, order_index", [stageIds]);
    const groupIds = groups.map((row) => String(row.id));
    const drawSessions = await rows<JsonRow>(client, "select * from draw_sessions where stage_id = any($1::text[]) order by created_at, id", [stageIds]);
    const drawSessionIds = drawSessions.map((row) => String(row.id));
    const matches = await rows<JsonRow>(client, "select * from matches where event_id = any($1::text[]) order by event_id, stage_id, round_number, bracket_position nulls last, id", [eventIds]);
    const matchIds = matches.map((row) => String(row.id));

    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      ownerUsername: owner.username,
      tournamentSlug: String(tournament.slug),
      tables: {
        clubs: await rows(client, "select * from clubs where id = any($1::text[]) order by name, id", [clubIds]),
        players: await rows(client, "select * from players where id = any($1::text[]) order by display_name, id", [playerIds]),
        player_sports: playerSports,
        tournaments: [tournament],
        tournament_events: events,
        courts: await rows(client, "select * from courts where tournament_id = $1 order by code, id", [tournamentId]),
        match_rules: await rows(client, "select * from match_rules where event_id = any($1::text[]) order by event_id, name, id", [eventIds]),
        stages,
        stage_rules: await rows(client, "select * from stage_rules where stage_id = any($1::text[]) order by stage_id", [stageIds]),
        standing_rules: await rows(client, "select * from standing_rules where event_id = any($1::text[]) order by event_id, id", [eventIds]),
        schedule_rules: await rows(client, "select * from schedule_rules where event_id = any($1::text[]) order by event_id, id", [eventIds]),
        qualification_rules: await rows(client, "select * from qualification_rules where source_stage_id = any($1::text[]) or target_stage_id = any($1::text[]) order by source_stage_id, target_stage_id", [stageIds]),
        entries,
        entry_members: entryMembers,
        groups,
        draw_sessions: drawSessions,
        draw_results: await rows(client, "select * from draw_results where draw_session_id = any($1::text[]) order by draw_session_id, group_id, position", [drawSessionIds]),
        group_entries: await rows(client, "select * from group_entries where group_id = any($1::text[]) order by group_id, position", [groupIds]),
        matches,
        match_sets: await rows(client, "select * from match_sets where match_id = any($1::text[]) order by match_id, set_number", [matchIds]),
      },
    };
  }

  private async validatePackage(input: unknown): Promise<TournamentJsonPackage> {
    if (!isPlainObject(input)) throw new ValidationError("Invalid JSON package");
    if (input.format !== FORMAT || input.version !== VERSION) {
      throw new ValidationError("Unsupported tournament JSON format or version");
    }
    if (!isPlainObject(input.tables)) throw new ValidationError("JSON tables are missing");
    const unknownTables = Object.keys(input.tables).filter(
      (table) => !TABLE_ORDER.includes(table as TableName),
    );
    if (unknownTables.length) {
      throw new ValidationError(`Unsupported JSON tables: ${unknownTables.join(", ")}`);
    }

    const client = await this.pool.connect();
    try {
      const tables = {} as Record<TableName, JsonRow[]>;
      let totalRows = 0;
      for (const table of TABLE_ORDER) {
        const value = input.tables[table] ?? [];
        if (!Array.isArray(value)) throw new ValidationError(`${table} must be an array`);
        totalRows += value.length;
        const allowedColumns = new Set(
          (
            await client.query<{ column_name: string }>(
              "select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1",
              [table],
            )
          ).rows.map((row) => row.column_name),
        );
        tables[table] = value.map((candidate, index) => {
          if (!isPlainObject(candidate)) {
            throw new ValidationError(`${table}[${index}] must be an object`);
          }
          const row: JsonRow = {};
          for (const [column, raw] of Object.entries(candidate)) {
            if (!allowedColumns.has(column)) {
              throw new ValidationError(`Unsupported field ${table}.${column}`);
            }
            if (
              raw !== null &&
              typeof raw !== "string" &&
              typeof raw !== "number" &&
              typeof raw !== "boolean"
            ) {
              throw new ValidationError(`Invalid value in ${table}.${column}`);
            }
            row[column] = raw;
          }
          return row;
        });
      }
      if (totalRows > MAX_TOTAL_ROWS) {
        throw new ValidationError("Tournament JSON contains too many rows");
      }
      if (tables.tournaments.length !== 1) {
        throw new ValidationError("Tournament JSON must contain exactly one tournament");
      }
      return {
        format: FORMAT,
        version: VERSION,
        exportedAt: String(input.exportedAt ?? ""),
        ownerUsername: String(input.ownerUsername ?? ""),
        tournamentSlug: String(input.tournamentSlug ?? ""),
        tables,
      };
    } finally {
      client.release();
    }
  }

  private async insertRows(
    client: PoolClient,
    table: TableName,
    tableRows: JsonRow[],
    ignoreConflict: boolean,
  ): Promise<number> {
    let inserted = 0;
    for (const row of tableRows) {
      const columns = Object.keys(row);
      if (!columns.length) throw new ValidationError(`Empty row in ${table}`);
      const result = await client.query(
        `insert into ${identifier(table)} (${columns.map(identifier).join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})${ignoreConflict ? " on conflict do nothing" : ""}`,
        columns.map((column) => row[column]),
      );
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  }
}
