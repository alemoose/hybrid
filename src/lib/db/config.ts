/**
 * Locally the database is a file (local.db). In production it's Turso:
 * the Vercel Turso integration sets TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
 */
export function databaseConfig(): { url: string; authToken?: string } {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined;
  if (process.env.VERCEL && url.startsWith("file:")) {
    throw new Error(
      "No database configured. Connect a Turso database in Vercel so TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set.",
    );
  }
  return { url, authToken };
}
