import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const test=process.argv.includes('--test');
if(!test&&!process.argv.includes('--production'))throw new Error('EXPLICIT_MIGRATION_TARGET_REQUIRED');
const target=test?process.env.TEST_DATABASE_URL:process.env.DATABASE_URL;
if(!target||(test&&target===process.env.DATABASE_URL))throw new Error('DISTINCT_TEST_DATABASE_REQUIRED');
const name='0024_mvp_transaction_closure',filename=`migrations/${name}.sql`;
const sql=await readFile(new URL(`../${filename}`,import.meta.url),'utf8');
const checksum=createHash('sha256').update(sql).digest('hex');
const newTables=['mvp_contract_signing_authorities','mvp_contract_transactions','mvp_contract_snapshots','mvp_contract_terms_approvals','mvp_contract_artifacts','mvp_contract_signatures','mvp_contract_events','mvp_contract_evidence','mvp_contract_disputes'];
const protectedTables=['users','offers','orders','contracts','organization_registry_profile_revisions','organization_memberships','user_mfa_credentials','vre_enforcement_actions'];
const db=new pg.Client({connectionString:target,connectionTimeoutMillis:15000});
try{
  await db.connect();await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('tutela-migrations'))");
  const counts=new Map();for(const table of protectedTables)counts.set(table,(await db.query(`SELECT count(*)::int count FROM public.${table}`)).rows[0].count);
  const predecessor=await db.query("SELECT execution_status FROM public.tutela_migration_journal WHERE migration_identifier='0023_pre_v3_closure'");
  if(predecessor.rows.length!==1||!['succeeded','verified'].includes(predecessor.rows[0].execution_status))throw new Error('MVP_CLOSURE_PREDECESSOR_INVALID');
  const prior=await db.query('SELECT checksum,execution_status,sql_executed FROM public.tutela_migration_journal WHERE migration_identifier=$1',[name]);
  if(prior.rows.length){const row=prior.rows[0];if(row.checksum!==checksum||row.execution_status!=='succeeded'||row.sql_executed!==true)throw new Error('MVP_CLOSURE_JOURNAL_CONFLICT');}
  else{
    for(const table of newTables)if((await db.query('SELECT to_regclass($1) existing',[`public.${table}`])).rows[0].existing)throw new Error('MVP_CLOSURE_OBJECT_COLLISION');
    const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
    await db.query(`INSERT INTO public.tutela_migration_journal(migration_identifier,migration_filename,checksum,provenance,execution_path,git_revision,execution_status,sql_executed,included_in_bootstrap,notes)
      VALUES($1,$2,$3,'additive_migration','existing_database_upgrade',$4,'running',false,false,'MVP transaction closure authority, artifacts, signatures and append-only execution history; no historical reinterpretation.')`,[name,filename,checksum,revision]);
    await db.query(sql);
    for(const table of newTables)if((await db.query(`SELECT count(*)::int count FROM public.${table}`)).rows[0].count!==0)throw new Error('MVP_CLOSURE_UNEXPECTED_INITIAL_DATA');
    await db.query("UPDATE public.tutela_migration_journal SET execution_status='succeeded',sql_executed=true,execution_timestamp=now() WHERE migration_identifier=$1",[name]);
  }
  for(const table of newTables)if(!(await db.query('SELECT to_regclass($1) existing',[`public.${table}`])).rows[0].existing)throw new Error('MVP_CLOSURE_SCHEMA_VALIDATION_FAILED');
  const triggers=await db.query(`SELECT count(*)::int count FROM pg_trigger trigger JOIN pg_class relation ON relation.oid=trigger.tgrelid
    WHERE NOT trigger.tgisinternal AND relation.relname IN ('mvp_contract_signing_authorities','mvp_contract_transactions','mvp_contract_snapshots','mvp_contract_terms_approvals','mvp_contract_artifacts','mvp_contract_signatures','mvp_contract_events','mvp_contract_evidence','mvp_contract_disputes')`);
  if(triggers.rows[0].count!==9)throw new Error('MVP_CLOSURE_IMMUTABILITY_INVALID');
  for(const table of protectedTables)if((await db.query(`SELECT count(*)::int count FROM public.${table}`)).rows[0].count!==counts.get(table))throw new Error('MVP_CLOSURE_PROTECTED_DATA_CHANGED');
  await db.query('COMMIT');console.log(`MVP closure migration ${prior.rows.length?'already applied and verified':'applied and verified'} (${test?'TEST':'PRODUCTION'}).`);
}catch(error){await db.query('ROLLBACK').catch(()=>{});console.error('MVP closure migration failed:',error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'DATABASE_OR_SCHEMA_ERROR');process.exitCode=1}
finally{await db.end().catch(()=>{})}
