import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import pg from "pg";

const id = "0021_controlled_platform_owner_correction";
const filename = `migrations/${id}.sql`;
const testMode = process.argv.includes("--test");
const testUrl = process.env.TEST_DATABASE_URL?.trim();
const runtimeUrl = process.env.DATABASE_URL?.trim();
const target = testMode ? testUrl : runtimeUrl;
if (!target) throw new Error(testMode ? "TEST_DATABASE_URL_REQUIRED" : "DATABASE_URL_REQUIRED");
if (testMode && runtimeUrl && testUrl === runtimeUrl) throw new Error("TEST_DATABASE_URL_AMBIGUOUS");
const sql = await readFile(filename, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
const client = new pg.Client({ connectionString: target, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query("BEGIN");
  const predecessor = await client.query("SELECT execution_status FROM tutela_migration_journal WHERE migration_identifier='0020_platform_ownership'");
  if (predecessor.rowCount !== 1 || !["succeeded", "verified"].includes(predecessor.rows[0].execution_status)) throw new Error("OWNER_CORRECTION_PREDECESSOR_INVALID");
  const existing = await client.query("SELECT checksum,execution_status,sql_executed FROM tutela_migration_journal WHERE migration_identifier=$1", [id]);
  if (existing.rowCount === 1) {
    if (existing.rows[0].checksum !== checksum || existing.rows[0].execution_status !== "succeeded" || existing.rows[0].sql_executed !== true) throw new Error("OWNER_CORRECTION_EXISTING_STATE_INVALID");
  } else {
    const before = await client.query("SELECT (SELECT count(id)::text FROM users) users,(SELECT count(id)::text FROM offers) offers,(SELECT count(id)::text FROM orders) orders,(SELECT count(id)::text FROM contracts) contracts");
    await client.query("INSERT INTO tutela_migration_journal(migration_identifier,migration_filename,checksum,provenance,execution_path,git_revision,execution_status,sql_executed,included_in_bootstrap,notes) VALUES($1,$2,$3,'additive_migration','existing_database_upgrade',$4,'running',false,false,'One-time controlled initial Platform Owner identity correction authority.')", [id, filename, checksum, revision]);
    await client.query(sql);
    const after = await client.query("SELECT (SELECT count(id)::text FROM users) users,(SELECT count(id)::text FROM offers) offers,(SELECT count(id)::text FROM orders) orders,(SELECT count(id)::text FROM contracts) contracts");
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0])) throw new Error("OWNER_CORRECTION_BUSINESS_DATA_CHANGED");
    await client.query("UPDATE tutela_migration_journal SET execution_timestamp=now(),execution_status='succeeded',sql_executed=true WHERE migration_identifier=$1", [id]);
  }
  const verified = await client.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_ownership_assignments' AND column_name='revocation_authority_source') AS revocation_source, EXISTS(SELECT 1 FROM pg_constraint WHERE conname='security_audit_actor_context_check') AS audit_context");
  if (!verified.rows[0].revocation_source || !verified.rows[0].audit_context) throw new Error("OWNER_CORRECTION_SCHEMA_INVALID");
  await client.query("COMMIT");
  console.log(existing.rowCount === 1 ? "Owner correction migration already applied and verified." : "Owner correction migration applied and verified successfully.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Owner correction migration failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

