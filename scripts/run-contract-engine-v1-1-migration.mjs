import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import pg from "pg";

const test=process.argv.includes("--test");
if(!test&&!process.argv.includes("--production"))throw new Error("EXPLICIT_MIGRATION_TARGET_REQUIRED");
const target=test?process.env.TEST_DATABASE_URL:process.env.DATABASE_URL;
if(!target||(test&&target===process.env.DATABASE_URL))throw new Error("DISTINCT_TEST_DATABASE_REQUIRED");
const name="0025_contract_engine_v1_1",filename=`migrations/${name}.sql`,sql=await readFile(new URL(`../${filename}`,import.meta.url),"utf8"),checksum=createHash("sha256").update(sql).digest("hex");
const db=new pg.Client({connectionString:target,connectionTimeoutMillis:15000});
try{
  await db.connect();await db.query("BEGIN");await db.query("SELECT pg_advisory_xact_lock(hashtext('tutela-migrations'))");
  const before=(await db.query("SELECT count(*)::int snapshots,count(*) FILTER (WHERE template_version='tutela-international-commodity-sale-contract/v1')::int v1 FROM public.mvp_contract_snapshots")).rows[0];
  const predecessor=await db.query("SELECT execution_status FROM public.tutela_migration_journal WHERE migration_identifier='0024_mvp_transaction_closure'");if(predecessor.rowCount!==1||!["succeeded","verified"].includes(predecessor.rows[0].execution_status))throw new Error("CONTRACT_V1_1_PREDECESSOR_INVALID");
  const prior=await db.query("SELECT checksum,execution_status,sql_executed FROM public.tutela_migration_journal WHERE migration_identifier=$1",[name]);
  if(prior.rowCount){if(prior.rows[0].checksum!==checksum||prior.rows[0].execution_status!=="succeeded"||prior.rows[0].sql_executed!==true)throw new Error("CONTRACT_V1_1_JOURNAL_CONFLICT")}else{
    const revision=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8",windowsHide:true}).trim();
    await db.query("INSERT INTO public.tutela_migration_journal(migration_identifier,migration_filename,checksum,provenance,execution_path,git_revision,execution_status,sql_executed,included_in_bootstrap,notes) VALUES($1,$2,$3,'additive_migration','existing_database_upgrade',$4,'running',false,false,'Prospectively admit immutable Contract Engine V1.1 snapshots while preserving V1 history.')",[name,filename,checksum,revision]);
    await db.query(sql);await db.query("UPDATE public.tutela_migration_journal SET execution_status='succeeded',sql_executed=true,execution_timestamp=now() WHERE migration_identifier=$1",[name]);
  }
  const after=(await db.query("SELECT count(*)::int snapshots,count(*) FILTER (WHERE template_version='tutela-international-commodity-sale-contract/v1')::int v1 FROM public.mvp_contract_snapshots")).rows[0];if(JSON.stringify(before)!==JSON.stringify(after))throw new Error("CONTRACT_V1_1_HISTORY_CHANGED");
  const constraint=(await db.query("SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='public.mvp_contract_snapshots'::regclass AND conname='mvp_contract_snapshots_template_version_check'")).rows[0]?.definition;if(!constraint?.includes("v1.1")||!constraint.includes("/v1"))throw new Error("CONTRACT_V1_1_CONSTRAINT_INVALID");
  await db.query("COMMIT");console.log(`Contract Engine V1.1 migration ${prior.rowCount?"already applied and verified":"applied and verified"} (${test?"TEST":"PRODUCTION"}).`);
}catch(error){await db.query("ROLLBACK").catch(()=>undefined);console.error("Contract Engine V1.1 migration failed:",error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:"DATABASE_OR_SCHEMA_ERROR");process.exitCode=1}finally{await db.end().catch(()=>undefined)}
