import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  TotpMfaService,
  generateTotpCode,
  totpCounter,
  type MfaServiceClock,
} from "../../server/mfa/index.js";
import {
  createAuthIntegrationTestPool,
  requireTestDatabase,
} from "./test-database.js";

const TEST_ENCRYPTION_KEY = Buffer.from("a1".repeat(32), "hex");

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

    try {
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
      await pool.query("DELETE FROM public.users WHERE id = $1", [userId]).catch(() => undefined);
      const remaining = await pool
        .query<{ users: string; credentials: string; codes: string }>(
          `SELECT
            (SELECT count(*)::text FROM public.users WHERE id = $1) AS users,
            (SELECT count(*)::text FROM public.user_mfa_credentials WHERE user_id = $1) AS credentials,
            (SELECT count(*)::text FROM public.user_mfa_recovery_codes rc
              JOIN public.user_mfa_credentials c ON c.id = rc.credential_id
              WHERE c.user_id = $1) AS codes`,
          [userId],
        )
        .catch(() => ({ rows: [{ users: "unknown", credentials: "unknown", codes: "unknown" }] }));
      assert.deepEqual(remaining.rows[0], { users: "0", credentials: "0", codes: "0" });
      await pool.end().catch(() => undefined);
    }
  },
);
