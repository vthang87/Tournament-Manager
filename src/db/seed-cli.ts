import { seedDatabase } from "./seed";

seedDatabase()
  .then(() => {
    console.log("Seed completed successfully.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
