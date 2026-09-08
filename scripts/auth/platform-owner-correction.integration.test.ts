import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createPostgresPlatformOwnershipRepository } from "../../server/platform-ownership/index.js";

const testUrl = process.env.TEST_DATABASE_URL?.trim();
const runtimeUrl = process.env.DATABASE_URL?.trim();
if (!testUrl || testUrl === runtimeUrl) throw new Error("SAFE_TEST_DATABASE_REQUIRED");

const reason = "Correct unintended initial Platform Owner selection to explicitly approved TUTELA owner account.";

async function users(pool: pg.Pool, suffix: string, activeMfa = true) {
  const from = `owner-correction-from:${suffix}`;
  const to = `owner-correction-to:${suffix}`;
  await pool.query(
    `INSERT INTO users(id,email,password_hash,auth_provider,email_verified_at,login_enabled,credential_status,role,created_at,updated_at)
     VALUES($1,$2,'test-hash','local',now(),true,'active','trader',now(),now()),
           ($3,$4,'test-hash','local',now(),true,'active','trader',now(),now())`,
    [from, `${suffix}@from.invalid`, to, `${suffix}@to.invalid`],
  );
  if (activeMfa) {
    await pool.query(
      `INSERT INTO user_mfa_credentials
       (id,user_id,factor_type,status,encrypted_secret,secret_iv,secret_auth_tag,
        encryption_key_version,activated_at,created_at,updated_at)
       VALUES($1,$2,'totp','active',decode('01','hex'),decode(repeat('01',12),'hex'),
              decode(repeat('01',16),'hex'),'test',now(),now(),now())`,
      [randomUUID(), to],
    );
  }
  return { from, to };
}

async function bootstrap(pool: pg.Pool, from: string) {
  const principalId = randomUUID();
  const assignmentId = randomUUID();
  await createPostgresPlatformOwnershipRepository(pool).bootstrapFirstOwner({
    targetUserId: from,
    principalId,
    assignmentId,
    auditEventId: randomUUID(),
    operatorIdentity: "owner-correction-integration-test",
    reason: "Controlled initial ownership bootstrap for correction testing",
    occurredAt: new Date().toISOString(),
  });
  return { principalId, assignmentId };
}

function command(from: string, to: string, auditEventId = randomUUID()) {
  return {
    fromUserId: from,
    toUserId: to,
    reason,
    targetPrincipalId: randomUUID(),
    targetAssignmentId: randomUUID(),
    auditEventId,
    requestId: randomUUID(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  };
}

async function cleanup(pool: pg.Pool, ids: readonly string[]) {
  await pool.query("DELETE FROM security_audit_events WHERE target_id IN (SELECT id FROM platform_principals WHERE user_id=ANY($1::varchar[])) OR actor_user_id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM platform_ownership_bootstrap_events WHERE target_user_id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM platform_ownership_assignments WHERE principal_id IN (SELECT id FROM platform_principals WHERE user_id=ANY($1::varchar[]))", [ids]);
  await pool.query("DELETE FROM platform_principals WHERE user_id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM user_mfa_credentials WHERE user_id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [ids]);
}

test("controlled correction refuses wrong FROM, missing MFA, and missing bootstrap provenance", async () => {
  const pool = new pg.Pool({ connectionString: testUrl, max: 3 });
  const all: string[] = [];
  try {
    const first = await users(pool, randomUUID()); all.push(first.from, first.to);
    await bootstrap(pool, first.from);
    await assert.rejects(
      () => createPostgresPlatformOwnershipRepository(pool).correctInitialOwnerIdentity(command(randomUUID(), first.to)),
      /CURRENT_OWNER_MISMATCH/,
    );
    await cleanup(pool, [first.from, first.to]); all.length = 0;

    const second = await users(pool, randomUUID(), false); all.push(second.from, second.to);
    await bootstrap(pool, second.from);
    await assert.rejects(
      () => createPostgresPlatformOwnershipRepository(pool).correctInitialOwnerIdentity(command(second.from, second.to)),
      /ACTIVE_MFA_REQUIRED/,
    );
    await cleanup(pool, [second.from, second.to]); all.length = 0;

    const third = await users(pool, randomUUID()); all.push(third.from, third.to);
    const principal = randomUUID();
    await pool.query("INSERT INTO platform_principals(id,user_id,status,created_at,updated_at) VALUES($1,$2,'active',now(),now())", [principal, third.from]);
    await pool.query("INSERT INTO platform_ownership_assignments(id,principal_id,status,authority_source,granted_at,grant_reason) VALUES($1,$2,'active','initial_bootstrap',now(),'Missing bootstrap provenance test')", [randomUUID(), principal]);
    await assert.rejects(
      () => createPostgresPlatformOwnershipRepository(pool).correctInitialOwnerIdentity(command(third.from, third.to)),
      /INITIAL_OWNER_BOOTSTRAP_PROVENANCE_REQUIRED/,
    );
  } finally {
    if (all.length) await cleanup(pool, all).catch(() => undefined);
    await pool.end();
  }
});

test("controlled correction is atomic, critically audited, session-independent, and exactly idempotent", async () => {
  const pool = new pg.Pool({ connectionString: testUrl, max: 3 });
  const pair = await users(pool, randomUUID());
  try {
    await bootstrap(pool, pair.from);
    const input = command(pair.from, pair.to);
    const repository = createPostgresPlatformOwnershipRepository(pool);
    assert.equal(await repository.correctInitialOwnerIdentity(input), "completed");
    const active = await pool.query("SELECT p.user_id,o.authority_source FROM platform_ownership_assignments o JOIN platform_principals p ON p.id=o.principal_id WHERE o.status='active'");
    assert.deepEqual(active.rows, [{ user_id: pair.to, authority_source: "initial_owner_correction" }]);
    const old = await pool.query("SELECT o.status,o.revoked_by_principal_id,o.revocation_authority_source FROM platform_ownership_assignments o JOIN platform_principals p ON p.id=o.principal_id WHERE p.user_id=$1", [pair.from]);
    assert.deepEqual(old.rows[0], { status: "revoked", revoked_by_principal_id: null, revocation_authority_source: "controlled_recovery" });
    const audit = await pool.query("SELECT actor_user_id,actor_principal_id,actor_roles,session_assurance,severity FROM security_audit_events WHERE id=$1", [input.auditEventId]);
    assert.deepEqual(audit.rows[0], { actor_user_id: null, actor_principal_id: null, actor_roles: ["CONTROLLED_RECOVERY_AUTHORITY"], session_assurance: "controlled_recovery", severity: "critical" });
    assert.equal(await repository.correctInitialOwnerIdentity(command(pair.from, pair.to)), "already_completed");
    await assert.rejects(
      () => repository.correctInitialOwnerIdentity(command(pair.to, pair.from)),
      /OWNER_CORRECTION_ALREADY_COMPLETED/,
    );
  } finally {
    await cleanup(pool, [pair.from, pair.to]).catch(() => undefined);
    await pool.end();
  }
});

test("mandatory audit failure rolls back grant, revocation, and principal creation", async () => {
  const pool = new pg.Pool({ connectionString: testUrl, max: 3 });
  const pair = await users(pool, randomUUID());
  try {
    const current = await bootstrap(pool, pair.from);
    const duplicateAuditId = randomUUID();
    await pool.query(
      `INSERT INTO security_audit_events
       (id,request_id,correlation_id,actor_user_id,actor_principal_id,actor_roles,effective_permission,
        session_assurance,action,target_type,target_id,reason,severity,occurred_at)
       VALUES($1,$2,$3,$4,$5,'["PLATFORM_OWNER"]'::jsonb,'platform.roles.grant',
              'recent_step_up','test_existing_audit','test',$5,'test collision','critical',now())`,
      [duplicateAuditId, randomUUID(), randomUUID(), pair.from, current.principalId],
    );
    await assert.rejects(
      () => createPostgresPlatformOwnershipRepository(pool).correctInitialOwnerIdentity(command(pair.from, pair.to, duplicateAuditId)),
    );
    const active = await pool.query("SELECT p.user_id FROM platform_ownership_assignments o JOIN platform_principals p ON p.id=o.principal_id WHERE o.status='active'");
    assert.deepEqual(active.rows, [{ user_id: pair.from }]);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM platform_principals WHERE user_id=$1", [pair.to])).rows[0].count, 0);
  } finally {
    await cleanup(pool, [pair.from, pair.to]).catch(() => undefined);
    await pool.end();
  }
});
