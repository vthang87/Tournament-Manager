import { loadLocalEnv } from "./load-local-env";
import { seedDatabase } from "./seed";

loadLocalEnv();

seedDatabase()
  .then(() => {
    console.log("Seed completed successfully.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
