import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  DEFAULT_MFA_SECURITY_POLICY,
  MFA_ENCRYPTION_KEY_VERSION,
  type EncryptedMfaSecret,
  type MfaChallengeResult,
  type MfaEnrollmentConfirmationDto,
  type MfaEnrollmentDto,
  type MfaSecurityPolicy,
  type MfaStatusDto,
  type RecoveryCodeDigest,
} from "./contracts.js";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCodeHash,
} from "./crypto.js";
import {
  createTotpProvisioningUri,
  generateTotpSecret,
  verifyTotpCode,
} from "./totp.js";

interface CredentialRow {
  id: string;
  user_id: string;
  status: "pending_enrollment" | "active" | "revoked";
  encrypted_secret: Buffer;
  secret_iv: Buffer;
  secret_auth_tag: Buffer;
  encryption_key_version: typeof MFA_ENCRYPTION_KEY_VERSION;
  last_accepted_counter: string | null;
  failed_attempts: number;
  locked_until: Date | null;
}

interface RecoveryCodeRow {
  id: string;
  code_salt: Buffer;
  code_hash: Buffer;
}

export interface MfaServiceClock {
  now(): Date;
}

const systemClock: MfaServiceClock = Object.freeze({ now: () => new Date() });

function encryptedSecret(row: CredentialRow): EncryptedMfaSecret {
  return {
    ciphertext: row.encrypted_secret,
    iv: row.secret_iv,
    authTag: row.secret_auth_tag,
    keyVersion: row.encryption_key_version,
  };
}

function secondsUntil(date: Date, now: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1_000));
}

export class TotpMfaService {
  readonly #pool: Pool;
  readonly #encryptionKey: Buffer;
  readonly #policy: Readonly<MfaSecurityPolicy>;
  readonly #clock: MfaServiceClock;

  constructor(input: {
    readonly pool: Pool;
    readonly encryptionKey: Buffer;
    readonly policy?: Readonly<MfaSecurityPolicy>;
    readonly clock?: MfaServiceClock;
  }) {
    if (input.encryptionKey.length !== 32) {
      throw new Error("MFA_ENCRYPTION_KEY_INVALID");
    }
    this.#pool = input.pool;
    this.#encryptionKey = Buffer.from(input.encryptionKey);
    this.#policy = input.policy ?? DEFAULT_MFA_SECURITY_POLICY;
    this.#clock = input.clock ?? systemClock;
  }

  async getStatus(userId: string): Promise<Readonly<MfaStatusDto>> {
    const result = await this.#pool.query<{
      status: "pending_enrollment" | "active";
    }>(
      `SELECT status FROM public.user_mfa_credentials
       WHERE user_id = $1 AND status IN ('pending_enrollment', 'active')
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const status = result.rows[0]?.status;
    return Object.freeze({
      enrolled: status === "active",
      status: status ?? "not_enrolled",
      factorType: status ? "totp" : null,
    });
  }

  async beginEnrollment(
    userId: string,
    accountLabel: string,
  ): Promise<Readonly<MfaEnrollmentDto>> {
    const client = await this.#pool.connect();
    const credentialId = randomUUID();
    const secret = generateTotpSecret();
    const encrypted = encryptMfaSecret(
      secret,
      this.#encryptionKey,
      credentialId,
      userId,
    );
    const now = this.#clock.now();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM public.user_mfa_credentials
         WHERE user_id = $1 AND status IN ('pending_enrollment', 'active')
         FOR UPDATE`,
        [userId],
      );
      if (current.rows.some(({ status }) => status === "active")) {
        throw new Error("MFA_ALREADY_ENROLLED");
      }
      for (const pending of current.rows) {
        await client.query(
          `UPDATE public.user_mfa_credentials
           SET status = 'revoked', revoked_at = $2, updated_at = $2,
               version = version + 1
           WHERE id = $1 AND status = 'pending_enrollment'`,
          [pending.id, now],
        );
      }
      await client.query(
        `INSERT INTO public.user_mfa_credentials (
          id, user_id, factor_type, status, encrypted_secret, secret_iv,
          secret_auth_tag, encryption_key_version, created_at, updated_at
        ) VALUES ($1, $2, 'totp', 'pending_enrollment', $3, $4, $5, $6, $7, $7)`,
        [
          credentialId,
          userId,
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.authTag,
          encrypted.keyVersion,
          now,
        ],
      );
      await client.query("COMMIT");
      return Object.freeze({
        credentialId,
        status: "pending_enrollment",
        factorType: "totp",
        secret,
        otpauthUri: createTotpProvisioningUri(secret, accountLabel),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async confirmEnrollment(input: {
    readonly userId: string;
    readonly credentialId: string;
    readonly code: string;
  }): Promise<Readonly<MfaEnrollmentConfirmationDto> | MfaChallengeResult> {
    const client = await this.#pool.connect();
    const now = this.#clock.now();
    try {
      await client.query("BEGIN");
      const row = await this.#lockedCredential(
        client,
        input.userId,
        "pending_enrollment",
        input.credentialId,
      );
      if (!row) throw new Error("MFA_PENDING_ENROLLMENT_NOT_FOUND");
      const lock = this.#activeLock(row, now);
      if (lock) {
        await client.query("ROLLBACK");
        return lock;
      }
      const secret = decryptMfaSecret(
        encryptedSecret(row),
        this.#encryptionKey,
        row.id,
        row.user_id,
      );
      const counter = verifyTotpCode({
        secret,
        code: input.code,
        now,
        lastAcceptedCounter: null,
      });
      if (counter === null) {
        const failure = await this.#recordFailure(client, row, now);
        await client.query("COMMIT");
        return failure;
      }

      const plaintextCodes = generateRecoveryCodes(
        this.#policy.recoveryCodeCount,
      );
      const digests = await Promise.all(
        plaintextCodes.map((code) => hashRecoveryCode(code)),
      );
      await client.query(
        `UPDATE public.user_mfa_credentials
         SET status = 'active', activated_at = $2,
             last_accepted_counter = $3, failed_attempts = 0,
             locked_until = NULL, updated_at = $2, version = version + 1
         WHERE id = $1 AND status = 'pending_enrollment'`,
        [row.id, now, counter],
      );
      for (const digest of digests) {
        await this.#insertRecoveryCode(client, row.id, digest, now);
      }
      await client.query(
        `UPDATE public.users SET is_2fa_enabled = true, updated_at = $2
         WHERE id = $1`,
        [input.userId, now],
      );
      await client.query("COMMIT");
      return Object.freeze({
        credentialId: row.id,
        status: "active",
        recoveryCodes: plaintextCodes,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyChallenge(
    userId: string,
    code: string,
  ): Promise<MfaChallengeResult> {
    const client = await this.#pool.connect();
    const now = this.#clock.now();
    try {
      await client.query("BEGIN");
      const row = await this.#lockedCredential(client, userId, "active");
      if (!row) throw new Error("MFA_ACTIVE_CREDENTIAL_NOT_FOUND");
      const lock = this.#activeLock(row, now);
      if (lock) {
        await client.query("ROLLBACK");
        return lock;
      }

      const secret = decryptMfaSecret(
        encryptedSecret(row),
        this.#encryptionKey,
        row.id,
        row.user_id,
      );
      const lastAcceptedCounter =
        row.last_accepted_counter === null
          ? null
          : Number(row.last_accepted_counter);
      const counter = verifyTotpCode({
        secret,
        code,
        now,
        lastAcceptedCounter,
      });
      if (counter !== null) {
        await client.query(
          `UPDATE public.user_mfa_credentials
           SET last_accepted_counter = $2, failed_attempts = 0,
               locked_until = NULL, updated_at = $3, version = version + 1
           WHERE id = $1 AND status = 'active'`,
          [row.id, counter, now],
        );
        await client.query("COMMIT");
        return Object.freeze({ status: "satisfied", method: "totp" });
      }

      const recoveryCodeId = await this.#matchingRecoveryCode(
        client,
        row.id,
        code,
      );
      if (recoveryCodeId) {
        const consumed = await client.query(
          `UPDATE public.user_mfa_recovery_codes
           SET used_at = $2 WHERE id = $1 AND used_at IS NULL`,
          [recoveryCodeId, now],
        );
        if (consumed.rowCount !== 1) {
          throw new Error("MFA_RECOVERY_CODE_CONFLICT");
        }
        await client.query(
          `UPDATE public.user_mfa_credentials
           SET failed_attempts = 0, locked_until = NULL,
               updated_at = $2, version = version + 1
           WHERE id = $1`,
          [row.id, now],
        );
        await client.query("COMMIT");
        return Object.freeze({
          status: "satisfied",
          method: "recovery_code",
        });
      }

      const failure = await this.#recordFailure(client, row, now);
      await client.query("COMMIT");
      return failure;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeActiveCredential(userId: string, reason: string): Promise<void> {
    if (!userId.trim() || !reason.trim()) {
      throw new Error("MFA_REVOCATION_INPUT_INVALID");
    }
    const client = await this.#pool.connect();
    const now = this.#clock.now();
    try {
      await client.query("BEGIN");
      const row = await this.#lockedCredential(client, userId, "active");
      if (!row) throw new Error("MFA_ACTIVE_CREDENTIAL_NOT_FOUND");
      const revoked = await client.query(
        `UPDATE public.user_mfa_credentials
         SET status = 'revoked', revoked_at = $2, updated_at = $2,
             version = version + 1
         WHERE id = $1 AND status = 'active'`,
        [row.id, now],
      );
      if (revoked.rowCount !== 1) throw new Error("MFA_REVOCATION_CONFLICT");
      await client.query(
        `UPDATE public.users SET is_2fa_enabled = false, updated_at = $2
         WHERE id = $1`,
        [userId, now],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async #lockedCredential(
    client: PoolClient,
    userId: string,
    status: "pending_enrollment" | "active",
    credentialId?: string,
  ): Promise<CredentialRow | undefined> {
    const result = await client.query<CredentialRow>(
      `SELECT id, user_id, status, encrypted_secret, secret_iv,
              secret_auth_tag, encryption_key_version, last_accepted_counter,
              failed_attempts, locked_until
       FROM public.user_mfa_credentials
       WHERE user_id = $1 AND status = $2
         AND ($3::varchar IS NULL OR id = $3)
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId, status, credentialId ?? null],
    );
    return result.rows[0];
  }

  #activeLock(
    row: CredentialRow,
    now: Date,
  ): Extract<MfaChallengeResult, { status: "locked" }> | null {
    if (row.locked_until && row.locked_until.getTime() > now.getTime()) {
      return Object.freeze({
        status: "locked",
        retryAfterSeconds: secondsUntil(row.locked_until, now),
      });
    }
    return null;
  }

  async #recordFailure(
    client: PoolClient,
    row: CredentialRow,
    now: Date,
  ): Promise<MfaChallengeResult> {
    const failedAttempts = row.failed_attempts + 1;
    const lockedUntil =
      failedAttempts >= this.#policy.maximumFailedAttempts
        ? new Date(now.getTime() + this.#policy.temporaryLockMs)
        : null;
    await client.query(
      `UPDATE public.user_mfa_credentials
       SET failed_attempts = $2, locked_until = $3,
           updated_at = $4, version = version + 1
       WHERE id = $1`,
      [row.id, failedAttempts, lockedUntil, now],
    );
    return lockedUntil
      ? Object.freeze({
          status: "locked",
          retryAfterSeconds: secondsUntil(lockedUntil, now),
        })
      : Object.freeze({ status: "invalid" });
  }

  async #insertRecoveryCode(
    client: PoolClient,
    credentialId: string,
    digest: RecoveryCodeDigest,
    now: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO public.user_mfa_recovery_codes (
        id, credential_id, code_salt, code_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), credentialId, digest.salt, digest.digest, now],
    );
  }

  async #matchingRecoveryCode(
    client: PoolClient,
    credentialId: string,
    plaintext: string,
  ): Promise<string | null> {
    const result = await client.query<RecoveryCodeRow>(
      `SELECT id, code_salt, code_hash
       FROM public.user_mfa_recovery_codes
       WHERE credential_id = $1 AND used_at IS NULL
       ORDER BY id FOR UPDATE`,
      [credentialId],
    );
    for (const row of result.rows) {
      if (
        await verifyRecoveryCodeHash(
          plaintext,
          row.code_salt,
          row.code_hash,
        )
      ) {
        return row.id;
      }
    }
    return null;
  }
}
