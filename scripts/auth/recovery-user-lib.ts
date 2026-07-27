import type { Client } from "pg";
import {
  ACTIVE_CREDENTIAL_STATUS,
  LOCAL_AUTH_PROVIDER,
  RECOVERY_PROVENANCE,
} from "../../shared/auth.js";

export interface RecoveryEnvironment {
  NODE_ENV?: string;
  RENDER?: string;
  TUTELA_RECOVERY_MODE?: string;
  TUTELA_RECOVERY_USER_EMAIL?: string;
  TUTELA_RECOVERY_USER_PASSWORD?: string;
}

export interface RecoveryCredentialInput {
  email: string;
  password: string;
}

export function assertRecoveryUserEnvironment(
  environment: RecoveryEnvironment,
): void {
  if (environment.TUTELA_RECOVERY_MODE !== "true") {
    throw new Error("RECOVERY_MODE_REQUIRED");
  }
  if (environment.NODE_ENV === "production") {
    throw new Error("PRODUCTION_MODE_FORBIDDEN");
  }
  if (environment.RENDER) {
    throw new Error("RENDER_FORBIDDEN");
  }
}

export function readRecoveryCredentialInput(
  environment: RecoveryEnvironment,
): RecoveryCredentialInput {
  const email = environment.TUTELA_RECOVERY_USER_EMAIL
    ?.trim()
    .toLowerCase();
  const password = environment.TUTELA_RECOVERY_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("RECOVERY_CREDENTIAL_INPUT_REQUIRED");
  }
  if (!/^[^@\s]+@recovery\.tutela\.invalid$/.test(email)) {
    throw new Error("RECOVERY_IDENTIFIER_MUST_BE_NON_REAL");
  }
  if (password.length < 16 || password.length > 200) {
    throw new Error("RECOVERY_PASSWORD_LENGTH_INVALID");
  }
  return { email, password };
}

export async function verifyRecoveryUserState(client: Client): Promise<void> {
  const recovery = (
    await client.query<{
      count: string;
      valid: boolean;
    }>(
      `
        SELECT
          count(*)::text AS count,
          bool_and(
            auth_provider = $1
            AND login_enabled IS TRUE
            AND credential_status = $2
            AND password_hash IS NOT NULL
            AND role = 'trader'
            AND verified IS FALSE
            AND company_name IS NULL
            AND first_name IS NULL
            AND last_name IS NULL
          ) AS valid
        FROM public.users
        WHERE recovery_provenance = $3
      `,
      [
        LOCAL_AUTH_PROVIDER,
        ACTIVE_CREDENTIAL_STATUS,
        RECOVERY_PROVENANCE,
      ],
    )
  ).rows[0];

  if (recovery.count !== "1" || !recovery.valid) {
    throw new Error("RECOVERY_USER_STATE_INVALID");
  }

  const legacy = (
    await client.query<{
      count: string;
      auth_fields_set: string;
    }>(`
      SELECT
        count(*)::text AS count,
        count(*) FILTER (
          WHERE password_hash IS NOT NULL
             OR auth_provider IS NOT NULL
             OR last_login_at IS NOT NULL
             OR login_enabled IS NOT NULL
             OR credential_status IS NOT NULL
        )::text AS auth_fields_set
      FROM public.users
      WHERE recovery_provenance IS NULL
    `)
  ).rows[0];

  if (legacy.count !== "4" || legacy.auth_fields_set !== "0") {
    throw new Error("LEGACY_USER_AUTHORITY_CHANGED");
  }
}

