#!/usr/bin/env node
// ESM version: "type": "module" in package.json
import pg from 'pg';
const { Client } = pg;

const email = process.argv[2];
const role  = (process.argv[3] || 'admin').toLowerCase();

if (!email) { console.error('Usage: node scripts/promote-admin.js <email> [role]'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is missing'); process.exit(2); }

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const tryUpdate = async (table) => {
  try {
    const r = await client.query(`UPDATE ${table} SET role=$1 WHERE email=$2 RETURNING email, role`, [role, email]);
    return r.rowCount ? r.rows[0] : null;
  } catch { return null; }
};

let row = await tryUpdate('users');
if (!row) row = await tryUpdate('"User"');

if (row) {
  console.log('✅ promoted:', row);
} else {
  const r = await client.query(
    "SELECT table_schema, table_name FROM information_schema.columns \
     WHERE column_name='email' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2"
  );
  console.log('ℹ️ Tables with an email column:', r.rows);
  console.error('❌ User not found or table name differs. Log in once with this email, or update table name above.');
  process.exit(3);
}

await client.end();