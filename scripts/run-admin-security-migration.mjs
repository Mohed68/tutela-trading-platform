import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const id = "0019_platform_authority_security_audit";
const filename = `migrations/${id}.sql`;
const testMode = process.argv.includes("--test");
const testUrl = process.env.TEST_DATABASE_URL?.trim();
const runtimeUrl = process.env.DATABASE_URL?.trim();
const target = testMode ? testUrl : runtimeUrl;
if (!target) throw new Error(testMode ? "TEST_DATABASE_URL_REQUIRED" : "DATABASE_URL_REQUIRED");
if (testMode && runtimeUrl && testUrl === runtimeUrl) throw new Error("TEST_DATABASE_URL_AMBIGUOUS");

const sql = await readFile(path.resolve(filename), "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");
const gitRevision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
const client = new pg.Client({ connectionString: target, connectionTimeoutMillis: 15_000 });

async function assertSchema() {
  const result = await client.query(`SELECT to_regclass('public.platform_principals')::text p, to_regclass('public.platform_role_assignments')::text r, to_regclass('public.security_audit_events')::text a`);
  if (result.rows[0].p !== "platform_principals" || result.rows[0].r !== "platform_role_assignments" || result.rows[0].a !== "security_audit_events") throw new Error("ADMIN_SECURITY_SCHEMA_INVALID");
}

try {
  await client.connect(); await client.query("BEGIN");
  const predecessor = await client.query(`SELECT execution_status FROM public.tutela_migration_journal WHERE migration_identifier='0018_totp_mfa_credentials'`);
  if (predecessor.rowCount !== 1 || !["succeeded", "verified"].includes(predecessor.rows[0].execution_status)) throw new Error("ADMIN_SECURITY_PREDECESSOR_INVALID");
  const existing = await client.query(`SELECT checksum,execution_status,sql_executed FROM public.tutela_migration_journal WHERE migration_identifier=$1`, [id]);
  if (existing.rowCount === 1) {
    if (existing.rows[0].checksum !== checksum || existing.rows[0].execution_status !== "succeeded" || existing.rows[0].sql_executed !== true) throw new Error("ADMIN_SECURITY_EXISTING_STATE_INVALID");
    await assertSchema(); await client.query("COMMIT"); console.log("Admin security migration already applied and verified.");
  } else {
    const collision = await client.query(`SELECT to_regclass('public.platform_principals') IS NOT NULL p, to_regclass('public.platform_role_assignments') IS NOT NULL r, to_regclass('public.security_audit_events') IS NOT NULL a`);
    if (collision.rows[0].p || collision.rows[0].r || collision.rows[0].a) throw new Error("ADMIN_SECURITY_OBJECT_COLLISION");
    const before = await client.query(`SELECT (SELECT count(*)::text FROM users) users,(SELECT count(*)::text FROM offers) offers,(SELECT count(*)::text FROM orders) orders,(SELECT count(*)::text FROM contracts) contracts`);
    await client.query(`INSERT INTO public.tutela_migration_journal (migration_identifier,migration_filename,checksum,provenance,execution_path,git_revision,execution_status,sql_executed,included_in_bootstrap,notes) VALUES ($1,$2,$3,'additive_migration','existing_database_upgrade',$4,'running',false,false,'Platform authority persistence and independent security audit.')`, [id, filename, checksum, gitRevision]);
    await client.query(sql); await assertSchema();
    const after = await client.query(`SELECT (SELECT count(*)::text FROM users) users,(SELECT count(*)::text FROM offers) offers,(SELECT count(*)::text FROM orders) orders,(SELECT count(*)::text FROM contracts) contracts`);
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0])) throw new Error("ADMIN_SECURITY_BUSINESS_DATA_CHANGED");
    await client.query(`UPDATE public.tutela_migration_journal SET execution_timestamp=now(),execution_status='succeeded',sql_executed=true WHERE migration_identifier=$1`, [id]);
    await client.query("COMMIT"); console.log("Admin security migration applied and verified successfully.");
  }
} catch (error) { await client.query("ROLLBACK").catch(() => undefined); console.error("Admin security migration failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR"); process.exitCode = 1; }
finally { await client.end().catch(() => undefined); }
