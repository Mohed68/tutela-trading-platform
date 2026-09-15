import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const test = process.argv.includes('--test');
if (!test && !process.argv.includes('--production')) throw new Error('EXPLICIT_MIGRATION_TARGET_REQUIRED');
const target = test ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!target || (test && target === process.env.DATABASE_URL)) throw new Error('DISTINCT_TEST_DATABASE_REQUIRED');
const name = '0022_vre_baseline', filename = `migrations/${name}.sql`;
const sql = await readFile(new URL(`../${filename}`,import.meta.url),'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const tables = ['vre_policy_activations','vre_verification_reviews','vre_risk_signals','vre_risk_assessments',
  'vre_risk_dispositions','vre_enforcement_cases','vre_enforcement_decisions','vre_enforcement_actions'];
const protectedTables = ['users','offers','orders','contracts','organization_verification_persistence_streams',
  'organization_verification_persistence_appends','organization_verification_durable_evidence',
  'organization_registry_profile_revisions','organization_memberships',
  'organization_participation_runtime_bindings','platform_ownership_assignments'];
const db = new pg.Client({connectionString:target,connectionTimeoutMillis:15000});
try {
  await db.connect(); await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('tutela-migrations'))");
  const protectedCounts = new Map();
  for (const table of protectedTables) {
    const result = await db.query(`SELECT count(*)::int AS count FROM public.${table}`);
    protectedCounts.set(table,result.rows[0].count);
  }
  const predecessor = await db.query("SELECT execution_status FROM public.tutela_migration_journal WHERE migration_identifier='0021_controlled_platform_owner_correction'");
  if (predecessor.rows.length !== 1 || !['succeeded','verified'].includes(predecessor.rows[0].execution_status)) throw new Error('VRE_PREDECESSOR_INVALID');
  const prior = await db.query('SELECT checksum,execution_status,sql_executed FROM public.tutela_migration_journal WHERE migration_identifier=$1',[name]);
  if (prior.rows.length) {
    const row = prior.rows[0];
    if (row.checksum !== checksum || row.execution_status !== 'succeeded' || row.sql_executed !== true) throw new Error('VRE_JOURNAL_CONFLICT');
  } else {
    for (const table of tables) {
      const result = await db.query('SELECT to_regclass($1) AS existing',[`public.${table}`]);
      if (result.rows[0].existing) throw new Error('VRE_OBJECT_COLLISION');
    }
    const existingFunction = await db.query("SELECT to_regprocedure('public.vre_reject_history_mutation()') AS existing");
    if (existingFunction.rows[0].existing) throw new Error('VRE_OBJECT_COLLISION');
    const revision = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
    await db.query(`INSERT INTO public.tutela_migration_journal(migration_identifier,migration_filename,checksum,provenance,
      execution_path,git_revision,execution_status,sql_executed,included_in_bootstrap,notes)
      VALUES ($1,$2,$3,'additive_migration','existing_database_upgrade',$4,'running',false,false,
      'VRE append-only authorities; prospective V2 activation; no business data or history rewriting.')`,[name,filename,checksum,revision]);
    await db.query(sql);
    for (const table of tables.filter(t => t !== 'vre_policy_activations')) {
      const result = await db.query(`SELECT count(*)::int AS count FROM public.${table}`);
      if (result.rows[0].count !== 0) throw new Error('VRE_UNEXPECTED_INITIAL_HISTORY');
    }
    await db.query("UPDATE public.tutela_migration_journal SET execution_status='succeeded',sql_executed=true,execution_timestamp=now() WHERE migration_identifier=$1",[name]);
  }
  for (const table of tables) {
    const result = await db.query(`SELECT count(*)::int AS count FROM pg_trigger WHERE tgrelid=to_regclass($1) AND tgname='vre_history_immutable' AND NOT tgisinternal`,[`public.${table}`]);
    if (result.rows[0].count !== 1) throw new Error('VRE_HISTORY_GUARD_MISSING');
  }
  for (const table of protectedTables) {
    const result = await db.query(`SELECT count(*)::int AS count FROM public.${table}`);
    if (result.rows[0].count !== protectedCounts.get(table)) throw new Error('VRE_PROTECTED_DATA_CHANGED');
  }
  await db.query('COMMIT');
  console.log(`VRE migration ${prior.rows.length ? 'already applied and verified' : 'applied and verified'} (${test ? 'TEST' : 'PRODUCTION'}).`);
} catch (error) {
  await db.query('ROLLBACK').catch(()=>{});
  // Do not print connection URLs, arbitrary driver messages, SQL parameters or secrets.
  console.error('VRE migration failed:',error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'DATABASE_OR_SCHEMA_ERROR');
  process.exitCode=1;
} finally { await db.end().catch(()=>{}); }
