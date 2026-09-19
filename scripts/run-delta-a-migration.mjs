import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import pg from "pg";

const test = process.argv.includes("--test");
if (!test && !process.argv.includes("--production")) throw new Error("EXPLICIT_MIGRATION_TARGET_REQUIRED");
const target = test ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!target || (test && target === process.env.DATABASE_URL)) throw new Error("DISTINCT_TEST_DATABASE_REQUIRED");
const name = "0026_delta_a_organization_authority", filename = `migrations/${name}.sql`;
const sql = await readFile(new URL(`../${filename}`, import.meta.url), "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
const db = new pg.Client({ connectionString: target, connectionTimeoutMillis: 15_000 });
const tracked = ["users","organization_memberships","organization_registry_profile_revisions","mvp_contract_snapshots","mvp_contract_signatures"];
try {
  await db.connect(); await db.query("BEGIN"); await db.query("SELECT pg_advisory_xact_lock(hashtext('tutela-migrations'))");
  const before = Object.fromEntries(await Promise.all(tracked.map(async (table) => [table, (await db.query(`SELECT count(*)::text count FROM public.${table}`)).rows[0].count])));
  const predecessor = await db.query("SELECT execution_status FROM public.tutela_migration_journal WHERE migration_identifier='0025_contract_engine_v1_1'");
  if (predecessor.rowCount !== 1 || !["succeeded","verified"].includes(predecessor.rows[0].execution_status)) throw new Error("DELTA_A_PREDECESSOR_INVALID");
  const prior = await db.query("SELECT checksum,execution_status,sql_executed FROM public.tutela_migration_journal WHERE migration_identifier=$1", [name]);
  if (prior.rowCount) {
    if (prior.rows[0].checksum !== checksum || prior.rows[0].execution_status !== "succeeded" || prior.rows[0].sql_executed !== true) throw new Error("DELTA_A_JOURNAL_CONFLICT");
  } else {
    const revision = execFileSync("git", ["rev-parse","HEAD"], { encoding: "utf8", windowsHide: true }).trim();
    await db.query("INSERT INTO public.tutela_migration_journal(migration_identifier,migration_filename,checksum,provenance,execution_path,git_revision,execution_status,sql_executed,included_in_bootstrap,notes) VALUES($1,$2,$3,'additive_migration','existing_database_upgrade',$4,'running',false,false,'Delta A prospective organization authority, commercial-rights and external-integrity foundations; no historical reinterpretation.')", [name, filename, checksum, revision]);
    await db.query(sql);
    await db.query("UPDATE public.tutela_migration_journal SET execution_status='succeeded',sql_executed=true,execution_timestamp=now() WHERE migration_identifier=$1", [name]);
  }
  const after = Object.fromEntries(await Promise.all(tracked.map(async (table) => [table, (await db.query(`SELECT count(*)::text count FROM public.${table}`)).rows[0].count])));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("DELTA_A_HISTORICAL_DATA_CHANGED");
  const objects = await db.query("SELECT to_regclass('public.organization_signing_mandates')::text mandates,to_regclass('public.platform_terms_versions')::text terms,to_regclass('public.external_integrity_anchors')::text anchors");
  if (!objects.rows[0].mandates || !objects.rows[0].terms || !objects.rows[0].anchors) throw new Error("DELTA_A_SCHEMA_INVALID");
  const links=await db.query("SELECT count(*)::int count FROM information_schema.columns WHERE table_schema='public' AND table_name='mvp_contract_snapshots' AND column_name IN ('platform_terms_version_id','fee_schedule_id')");
  if(links.rows[0].count!==2)throw new Error("DELTA_A_CONTRACT_LINKS_INVALID");
  await db.query("COMMIT"); console.log(`Delta A migration ${prior.rowCount ? "already applied and verified" : "applied and verified"} (${test ? "TEST" : "PRODUCTION"}).`);
} catch (error) {
  await db.query("ROLLBACK").catch(() => undefined);
  console.error("Delta A migration failed:", error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "DATABASE_OR_SCHEMA_ERROR"); process.exitCode = 1;
} finally { await db.end().catch(() => undefined); }
