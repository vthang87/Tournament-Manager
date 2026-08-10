import { runMigrations } from "./migrate";

runMigrations()
  .then(() => {
    console.log("Migrations applied successfully.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
