import { loadEnvFile } from "node:process";

/** Loads the repository .env for standalone database CLI scripts. */
export function loadLocalEnv(): void {
  try {
    loadEnvFile();
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}
