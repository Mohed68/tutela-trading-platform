import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const email = process.env.TUTELA_USER_EMAIL?.trim().toLowerCase();
const password = process.env.TUTELA_USER_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !email || !password) {
  console.error("DATABASE_URL, TUTELA_USER_EMAIL, and TUTELA_USER_PASSWORD are required.");
  process.exit(1);
}
if (password.length < 10) {
  console.error("TUTELA_USER_PASSWORD must contain at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const passwordHash = ["scrypt-v1", salt.toString("base64"), Buffer.from(key).toString("base64")].join("$");
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });

try {
  const result = await pool.query(
    `UPDATE users
     SET password_hash = $1, auth_provider = 'local', updated_at = NOW()
     WHERE LOWER(email) = $2
     RETURNING id, email`,
    [passwordHash, email],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Expected one user for ${email}, found ${result.rowCount ?? 0}.`);
  }
  console.log(`Local password configured for ${result.rows[0].email}.`);
} catch (error) {
  console.error("Unable to configure local password:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
