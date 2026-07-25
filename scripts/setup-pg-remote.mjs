#!/usr/bin/env node
/**
 * Bootstrap PostgreSQL on a remote host using admin credentials.
 * Usage:
 *   PG_ADMIN_URL=postgresql://admin:secret@192.168.0.17:5432/postgres \
 *   node scripts/setup-pg-remote.mjs
 */
import pg from "pg";

const {
  PG_ADMIN_URL = "postgresql://admin:secret@192.168.0.17:5432/postgres",
  PG_APP_USER = "tournament",
  PG_APP_PASSWORD = "tournament",
  PG_APP_DB = "tournament_manager",
  PG_TEST_DB = "tournament_manager_test",
} = process.env;

const { Client } = pg;

async function main() {
  const admin = new Client({ connectionString: PG_ADMIN_URL });
  await admin.connect();
  console.log(`Connected as admin to ${PG_ADMIN_URL.replace(/:[^:@/]+@/, ":***@")}`);

  const userExists = await admin.query(
    "SELECT 1 FROM pg_roles WHERE rolname = $1",
    [PG_APP_USER],
  );

  if (userExists.rowCount === 0) {
    await admin.query(
      `CREATE ROLE ${quoteIdent(PG_APP_USER)} WITH LOGIN PASSWORD '${escapeLiteral(PG_APP_PASSWORD)}' CREATEDB`,
    );
    console.log(`Created role: ${PG_APP_USER}`);
  } else {
    await admin.query(
      `ALTER ROLE ${quoteIdent(PG_APP_USER)} WITH LOGIN PASSWORD '${escapeLiteral(PG_APP_PASSWORD)}'`,
    );
    console.log(`Updated password for role: ${PG_APP_USER}`);
  }

  for (const dbName of [PG_APP_DB, PG_TEST_DB]) {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(
        `CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(PG_APP_USER)}`,
      );
      console.log(`Created database: ${dbName}`);
    } else {
      console.log(`Database already exists: ${dbName}`);
    }
    await admin.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(dbName)} TO ${quoteIdent(PG_APP_USER)}`,
    );
  }

  await admin.end();

  const base = PG_ADMIN_URL.replace(/\/[^/]+$/, "");
  console.log("");
  console.log("Add to .env:");
  console.log(
    `DATABASE_URL=${base}/${PG_APP_DB}`.replace(
      /:\/\/[^:]+:[^@]+@/,
      `://${PG_APP_USER}:${PG_APP_PASSWORD}@`,
    ),
  );
  console.log(
    `TEST_DATABASE_URL=${base}/${PG_TEST_DB}`.replace(
      /:\/\/[^:]+:[^@]+@/,
      `://${PG_APP_USER}:${PG_APP_PASSWORD}@`,
    ),
  );
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeLiteral(value) {
  return value.replace(/'/g, "''");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
