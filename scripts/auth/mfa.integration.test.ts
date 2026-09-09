import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import crypto from "node:crypto";
import express from "express";
import test from "node:test";
import type { PoolClient } from "pg";
import {
  TotpMfaService,
  encryptMfaSecret,
  generateTotpSecret,
  generateTotpCode,
  totpCounter,
  type MfaServiceClock,
} from "../../server/mfa/index.js";
import { markAuthenticated } from "../../server/session-assurance/index.js";
import {
  createAuthIntegrationTestPool,
  requireTestDatabase,
} from "./test-database.js";

const TEST_ENCRYPTION_KEY = Buffer.from("a1".repeat(32), "hex");

function signedSessionCookie(sid: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/u, "");
  return `tutela.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}

test("actual step-up route upgrades an authenticated TEST_DATABASE session without bypassing replay", { timeout: 60_000 }, async () => {
  const identity = requireTestDatabase();
  const pool = createAuthIntegrationTestPool(identity);
  const userId = `step-up-user:${randomUUID()}`;
  const otherUserId = `step-up-other:${randomUUID()}`;
  const credentialId = `step-up-credential:${randomUUID()}`;
  const sid = `step-up-session:${randomUUID()}`;
  const secret = generateTotpSecret();
  const now = new Date();
  const counter = totpCounter(now);
  const runtimeDatabaseUrl = process.env.DATABASE_URL;
  const runtimeNodeEnv = process.env.NODE_ENV;
  const runtimeTestAdapter = process.env.TUTELA_TEST_NODE_POSTGRES;
  let server: ReturnType<express.Express["listen"]> | null = null;
  let routeError = "NONE";
  try {
    process.env.DATABASE_URL = identity.connectionString;
    process.env.NODE_ENV = "test";
    process.env.TUTELA_TEST_NODE_POSTGRES = "true";
    process.env.MFA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY.toString("hex");
    const sessionSecret = process.env.SESSION_SECRET;
    assert.ok(sessionSecret, "SESSION_SECRET_REQUIRED_FOR_STEP_UP_TEST");
    await pool.query(`INSERT INTO public.users (id,email,role,auth_provider,login_enabled,credential_status,password_hash,email_verified_at,is_2fa_enabled) VALUES ($1,$2,'trader','local',true,'active','test-password-hash',now(),true),($3,$4,'trader','local',true,'active','test-password-hash',now(),false)`, [userId, `${randomUUID()}@mfa-test.tutela.invalid`, otherUserId, `${randomUUID()}@mfa-test.tutela.invalid`]);
    const encrypted = encryptMfaSecret(secret, TEST_ENCRYPTION_KEY, credentialId, userId);
    await pool.query(`INSERT INTO public.user_mfa_credentials (id,user_id,factor_type,status,encrypted_secret,secret_iv,secret_auth_tag,encryption_key_version,last_accepted_counter,activated_at) VALUES ($1,$2,'totp','active',$3,$4,$5,$6,$7,now())`, [credentialId,userId,encrypted.ciphertext,encrypted.iv,encrypted.authTag,encrypted.keyVersion,String(counter - 1)]);
    const sessionData: any = { cookie: { originalMaxAge: 60_000, expires: new Date(Date.now() + 60_000), secure: false, httpOnly: true, path: "/", sameSite: "lax" }, passport: { user: userId } };
    markAuthenticated(sessionData, now, { now: () => now });
    await pool.query("INSERT INTO public.sessions (sid,sess,expire) VALUES ($1,$2::jsonb,$3)", [sid, JSON.stringify(sessionData), new Date(Date.now() + 60_000)]);
    const { setupAuth } = await import("../../server/auth.js");
    const app = express(); app.use(express.json()); await setupAuth(app); app.use((error: unknown, _req: unknown, res: any, _next: unknown) => { const value = error instanceof Error ? error.message : typeof error === "string" ? error : error && typeof error === "object" && "error" in error && (error as { error?: unknown }).error instanceof Error ? (error as { error: Error }).error.message : "unknown"; const code = error && typeof error === "object" && "code" in error ? String(error.code) : "NO_CODE"; const shape = error && typeof error === "object" ? `${Object.getPrototypeOf(error)?.constructor?.name ?? "null"}_${Object.getOwnPropertyNames(error).join("-") || "none"}` : "scalar"; routeError = `${error instanceof Error ? error.name : typeof error}_${code}_${shape}_${value}`.replace(/[^A-Z0-9_ -]/gi, "").slice(0, 180); return res.status(500).json({ message: "test route failure" }); });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const request = (code: string, cookie = signedSessionCookie(sid, sessionSecret)) => fetch(`http://127.0.0.1:${address.port}/api/auth/mfa/step-up`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ code }) });
    const code = generateTotpCode(secret, counter);
    const firstStepUp = await request(code);
    if (firstStepUp.status !== 200) {
      const body = await firstStepUp.json().catch(() => ({ message: "unreadable" })) as { message?: string };
      throw new Error(`STEP_UP_STATUS_${firstStepUp.status}_${routeError}_${String(body.message).replace(/[^A-Z0-9_ -]/gi, "")}`);
    }
    const persisted = await pool.query<{ sess: { privilegedSecurityContext?: { mfaSatisfiedAt?: string; stepUpSatisfiedAt?: string } } }>("SELECT sess FROM public.sessions WHERE sid=$1", [sid]);
    assert.ok(persisted.rows[0].sess.privilegedSecurityContext?.mfaSatisfiedAt);
    assert.ok(persisted.rows[0].sess.privilegedSecurityContext?.stepUpSatisfiedAt);
    assert.equal((await request(code)).status, 401);
    assert.equal((await request(generateTotpCode(secret, counter + 1))).status, 200);
    assert.equal((await request("000000")).status, 401);
    const otherSid = `step-up-other-session:${randomUUID()}`;
    await pool.query("INSERT INTO public.sessions (sid,sess,expire) VALUES ($1,$2::jsonb,$3)", [otherSid, JSON.stringify({ ...sessionData, passport: { user: otherUserId } }), new Date(Date.now() + 60_000)]);
    assert.equal((await request(generateTotpCode(secret, counter + 1), signedSessionCookie(otherSid, sessionSecret))).status, 404);
  } finally {
    process.env.DATABASE_URL = runtimeDatabaseUrl;
    process.env.NODE_ENV = runtimeNodeEnv;
    process.env.TUTELA_TEST_NODE_POSTGRES = runtimeTestAdapter;
    await new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve());
    await pool.query("DELETE FROM public.users WHERE id = ANY($1::varchar[])", [[userId, otherUserId]]).catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
});

test(
  "real TOTP enrollment, replay, recovery, lock, and cleanup use only the test DB",
  { timeout: 60_000 },
  async () => {
    const identity = requireTestDatabase();
    const pool = createAuthIntegrationTestPool(identity);
    const userId = `a1-2b-user:${crypto.randomUUID()}`;
    const email = `${crypto.randomUUID()}@mfa-test.tutela.invalid`;
    let now = new Date("2026-09-07T10:00:00.000Z");
    const serviceClock: MfaServiceClock = { now: () => new Date(now) };
    const service = new TotpMfaService({
      pool,
      encryptionKey: TEST_ENCRYPTION_KEY,
      clock: serviceClock,
    });
    let cleanupClient: PoolClient | null = null;

    try {
      // Keep an authenticated TEST_DATABASE connection for the final cleanup.
      // The MFA service remains free to use the pool independently.
      cleanupClient = await pool.connect();
      const migration = await pool.query<{ status: string }>(
        `SELECT execution_status AS status
         FROM public.tutela_migration_journal
         WHERE migration_identifier = '0018_totp_mfa_credentials'`,
      );
      assert.equal(migration.rows[0]?.status, "succeeded");
      await pool.query(
        `INSERT INTO public.users (
          id, email, role, auth_provider, login_enabled, credential_status,
          is_2fa_enabled
        ) VALUES ($1, $2, 'trader', 'local', true, 'active', false)`,
        [userId, email],
      );

      const enrollment = await service.beginEnrollment(userId, email);
      assert.equal(enrollment.status, "pending_enrollment");
      assert.match(enrollment.otpauthUri, /^otpauth:\/\/totp\//u);
      const stored = await pool.query<{
        plaintext_match: boolean;
        status: string;
      }>(
        `SELECT encrypted_secret = convert_to($2, 'UTF8') AS plaintext_match,
                status
         FROM public.user_mfa_credentials WHERE id = $1`,
        [enrollment.credentialId, enrollment.secret],
      );
      assert.deepEqual(stored.rows[0], {
        plaintext_match: false,
        status: "pending_enrollment",
      });

      const confirmationCode = generateTotpCode(
        enrollment.secret,
        totpCounter(now),
      );
      const confirmation = await service.confirmEnrollment({
        userId,
        credentialId: enrollment.credentialId,
        code: confirmationCode,
      });
      assert.equal(confirmation.status, "active");
      if (confirmation.status !== "active") throw new Error("CONFIRMATION_FAILED");
      assert.equal(confirmation.recoveryCodes.length, 10);
      const account = await pool.query<{ enabled: boolean }>(
        "SELECT is_2fa_enabled AS enabled FROM public.users WHERE id = $1",
        [userId],
      );
      assert.equal(account.rows[0].enabled, true);

      assert.deepEqual(await service.verifyChallenge(userId, confirmationCode), {
        status: "invalid",
      });
      now = new Date(now.getTime() + 30_000);
      const nextCode = generateTotpCode(enrollment.secret, totpCounter(now));
      assert.deepEqual(await service.verifyChallenge(userId, nextCode), {
        status: "satisfied",
        method: "totp",
      });

      assert.deepEqual(
        await service.verifyChallenge(userId, confirmation.recoveryCodes[0]),
        { status: "satisfied", method: "recovery_code" },
      );
      assert.deepEqual(
        await service.verifyChallenge(userId, confirmation.recoveryCodes[0]),
        { status: "invalid" },
      );

      let finalFailure: Awaited<ReturnType<typeof service.verifyChallenge>> | undefined;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        finalFailure = await service.verifyChallenge(userId, "000000");
      }
      assert.equal(finalFailure?.status, "locked");
      assert.equal((await service.verifyChallenge(userId, "000000")).status, "locked");
    } finally {
      assert.ok(cleanupClient, "MFA_TEST_CLEANUP_CONNECTION_UNAVAILABLE");
      await cleanupClient.query("DELETE FROM public.users WHERE id = $1", [userId]);
      const remaining = await cleanupClient.query<{
        users: string;
        credentials: string;
        codes: string;
      }>(
        `SELECT
          (SELECT count(*)::text FROM public.users WHERE id = $1) AS users,
          (SELECT count(*)::text FROM public.user_mfa_credentials WHERE user_id = $1) AS credentials,
          (SELECT count(*)::text FROM public.user_mfa_recovery_codes rc
            JOIN public.user_mfa_credentials c ON c.id = rc.credential_id
            WHERE c.user_id = $1) AS codes`,
        [userId],
      );
      assert.deepEqual(remaining.rows[0], { users: "0", credentials: "0", codes: "0" });
      cleanupClient.release();
      await pool.end().catch(() => undefined);
    }
  },
);
