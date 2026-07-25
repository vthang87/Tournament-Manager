import { runMigrations } from "./migrate";

try {
  runMigrations();
  console.log("Migrations applied successfully.");
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
