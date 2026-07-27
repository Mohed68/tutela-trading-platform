import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to run the authentication migration.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = await readFile(path.join(root, "migrations", "0001_local_auth.sql"), "utf8");
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });

try {
  await pool.query("BEGIN");
  await pool.query(sql);
  await pool.query("COMMIT");
  console.log("Authentication database migration completed successfully.");
} catch (error) {
  await pool.query("ROLLBACK").catch(() => undefined);
  console.error("Authentication database migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
