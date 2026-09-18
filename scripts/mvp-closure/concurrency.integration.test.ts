import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { requireTestDatabase } from "../auth/test-database.js";

test("authoritative allocation and second signature serialize under real PostgreSQL concurrency", { timeout: 120_000 }, async () => {
  const identity = requireTestDatabase();
  const schema = `mvp_race_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^mvp_race_[a-f0-9]{32}$/);
  const control = new Client({ connectionString: identity.connectionString });
  const first = new Client({ connectionString: identity.connectionString });
  const second = new Client({ connectionString: identity.connectionString });
  await Promise.all([control.connect(), first.connect(), second.connect()]);
  try {
    await control.query(`CREATE SCHEMA ${schema}`);
    await control.query(`
      CREATE TABLE ${schema}.offers(id text PRIMARY KEY, quantity numeric NOT NULL);
      CREATE TABLE ${schema}.orders(id text PRIMARY KEY, offer_id text NOT NULL, quantity numeric NOT NULL, status text NOT NULL);
      CREATE TABLE ${schema}.transactions(id text PRIMARY KEY, state text NOT NULL);
      CREATE TABLE ${schema}.signatures(transaction_id text NOT NULL, party text NOT NULL, fingerprint text NOT NULL, UNIQUE(transaction_id,party));
      CREATE TABLE ${schema}.events(id bigserial PRIMARY KEY, transaction_id text NOT NULL, event_type text NOT NULL);
      INSERT INTO ${schema}.offers VALUES('offer',100);
      INSERT INTO ${schema}.orders VALUES('a','offer',70,'created'),('b','offer',70,'created');
      INSERT INTO ${schema}.transactions VALUES('tx','AWAITING_BUYER_SIGNATURE');
      INSERT INTO ${schema}.signatures VALUES('tx','SELLER','seller-fingerprint');
    `);

    const accept = async (client: Client, orderId: string) => {
      await client.query("BEGIN");
      const locked = (await client.query(`
        SELECT offer.id,offer.quantity available_quantity
        FROM ${schema}.offers offer JOIN ${schema}.orders candidate ON candidate.offer_id=offer.id
        WHERE candidate.id=$1 FOR UPDATE OF offer
      `, [orderId])).rows[0];
      const result = await client.query(`
        WITH allocated AS MATERIALIZED (
          SELECT COALESCE(sum(existing.quantity),0) allocated_quantity
          FROM ${schema}.orders existing
          WHERE existing.offer_id=$2 AND existing.status='accepted'
        )
        UPDATE ${schema}.orders candidate SET status='accepted'
        FROM allocated
        WHERE candidate.id=$1 AND candidate.status='created'
          AND allocated.allocated_quantity+candidate.quantity<=$3::numeric
        RETURNING candidate.id
      `, [orderId, locked.id, locked.available_quantity]);
      await client.query("COMMIT");
      return result.rowCount;
    };
    const firstAcceptance = accept(first, "a");
    const secondAcceptance = accept(second, "b");
    assert.deepEqual((await Promise.all([firstAcceptance, secondAcceptance])).sort(), [0, 1]);
    const allocation = await control.query(`SELECT count(*)::int accepted_count,COALESCE(sum(quantity),0)::int accepted_quantity FROM ${schema}.orders WHERE status='accepted'`);
    assert.deepEqual(allocation.rows[0], { accepted_count: 1, accepted_quantity: 70 });

    const signBuyer = async (client: Client) => {
      await client.query("BEGIN");
      const tx = (await client.query(`SELECT state FROM ${schema}.transactions WHERE id='tx' FOR UPDATE`)).rows[0];
      if (tx.state === "EXECUTED") {
        const existing = await client.query(`SELECT 1 FROM ${schema}.signatures WHERE transaction_id='tx' AND party='BUYER' AND fingerprint='buyer-fingerprint'`);
        await client.query("COMMIT");
        return existing.rowCount === 1 ? "idempotent" : "conflict";
      }
      assert.equal(tx.state, "AWAITING_BUYER_SIGNATURE");
      await client.query(`INSERT INTO ${schema}.signatures VALUES('tx','BUYER','buyer-fingerprint')`);
      await client.query(`UPDATE ${schema}.transactions SET state='EXECUTED' WHERE id='tx'`);
      await client.query(`INSERT INTO ${schema}.events(transaction_id,event_type) VALUES('tx','CONTRACT_EXECUTED')`);
      await client.query("COMMIT");
      return "executed";
    };
    assert.deepEqual((await Promise.all([signBuyer(first), signBuyer(second)])).sort(), ["executed", "idempotent"]);
    const execution = await control.query(`SELECT (SELECT state FROM ${schema}.transactions WHERE id='tx') state,(SELECT count(*)::int FROM ${schema}.signatures WHERE transaction_id='tx') signature_count,(SELECT count(*)::int FROM ${schema}.events WHERE transaction_id='tx' AND event_type='CONTRACT_EXECUTED') execution_events`);
    assert.deepEqual(execution.rows[0], { state: "EXECUTED", signature_count: 2, execution_events: 1 });
  } finally {
    await Promise.allSettled([first.query("ROLLBACK"), second.query("ROLLBACK")]);
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await Promise.allSettled([control.end(), first.end(), second.end()]);
  }
});
