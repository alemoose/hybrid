// Applies pending migrations, then makes sure the built-in exercises exist.
// Runs before every build, so a fresh Turso database is ready on first deploy.
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { databaseConfig } from "../src/lib/db/config";
import { EXERCISE_LIBRARY } from "../src/lib/db/exercise-library";
import { exercises } from "../src/lib/db/schema";

async function main() {
  const config = databaseConfig();
  const db = drizzle({ connection: config });
  console.log(`Migrating ${config.url.startsWith("file:") ? config.url : "remote database"}…`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  const result = await db.insert(exercises).values(EXERCISE_LIBRARY).onConflictDoNothing({ target: exercises.slug });
  console.log(`Exercise library ready (${result.rowsAffected} new).`);
  db.$client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
